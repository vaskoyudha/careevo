import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isStaffRole } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { slugify } from "@/lib/courses/store";

/**
 * POST /api/unggah — unggah berkas materi/kursus (gambar atau PDF).
 *
 * Route handler, bukan server action, karena endpoint ini menerima
 * `multipart/form-data` langsung: sebuah action hanya bisa dipanggil dari form
 * React yang dirender server, sedangkan panel materi juga perlu bisa memanggil
 * endpoint ini dari kode klien (drag-and-drop, preview sebelum simpan).
 *
 * Gerbang sesi ada DI DALAM handler. Route handler berada di luar seluruh route
 * group, jadi layout yang menggating `/review` atau `/verifikator` tidak
 * melindunginya — tanpa pemeriksaan ini siapa pun bisa menulis berkas ke server.
 */
export const dynamic = "force-dynamic";

/** Batas ukuran 8 MB. Angka ini juga dipantulkan di `next.config.ts`. */
export const MAKS_UKURAN_BYTE = 8 * 1024 * 1024;

/**
 * Daftar putih MIME → ekstensi yang diizinkan.
 *
 * Hanya empat tipe ini: tiga format gambar yang didukung `next/image` dan PDF
 * untuk modul. Tipe lain (SVG, HTML, ZIP, skrip) ditolak karena bisa dieksekusi
 * atau dirender sebagai halaman saat disajikan dari `public/`.
 */
const EKSTENSI_PER_MIME: Readonly<Record<string, string>> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

/**
 * Nama berkas final yang aman.
 *
 * Ekstensi diambil dari MIME yang sudah lolos daftar putih, BUKAN dari nama
 * kiriman pengguna: `Content-Type` adalah tipe yang benar-benar akan dipakai
 * browser/server saat menyajikan berkas, sedangkan nama kiriman bisa berbohong
 * (`materi.pdf` berisi HTML, atau `x.php`). Karena ekstensi menentukan bagaimana
 * berkas diperlakukan, hanya ekstensi turunan MIME yang boleh dipakai.
 *
 * Base name disanitasi dengan `slugify` supaya tidak ada `/`, `..`, atau
 * karakter shell yang bisa keluar dari folder tujuan atau menimpa berkas lain.
 * Sufiks waktu+acak membuat dua unggahan bernama sama tidak saling menimpa.
 */
export function namaBerkasTersanitasi(namaAsli: string, ekstensi: string): string {
  const tanpaEkstensi = namaAsli.replace(/\.[A-Za-z0-9]{1,8}$/, "");
  const base = slugify(tanpaEkstensi) || "berkas";
  const sufiks = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
  return `${base}-${sufiks}${ekstensi}`;
}

/** Ekstensi yang diizinkan untuk sebuah MIME, atau `null` bila tidak diizinkan. */
export function ekstensiUntukMime(mime: string): string | null {
  return EKSTENSI_PER_MIME[mime.toLowerCase()] ?? null;
}

/** Ukuran dalam satuan yang enak dibaca untuk pesan galat. */
export function formatUkuran(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

function bacaTeks(nilai: FormDataEntryValue | null): string {
  return typeof nilai === "string" ? nilai.trim() : "";
}

/**
 * Bentuk respons galat, seragam dengan `CourseActionState` / `ModulActionState`
 * (`{ ok: false, error }`) supaya pemanggil klien hanya perlu tahu satu kontrak
 * untuk unggahan dan untuk Server Action.
 */
function galat(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const sesi = await getSession();
  if (!sesi) {
    return galat(401, "Sesi tidak ditemukan. Silakan masuk terlebih dahulu.");
  }
  if (!isStaffRole(sesi.role)) {
    return galat(403, "Hanya verifikator atau admin yang boleh mengunggah berkas.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return galat(400, "Body permintaan harus berupa multipart/form-data.");
  }

  const berkas = form.get("berkas");
  if (!(berkas instanceof File)) {
    return galat(400, "Field 'berkas' wajib berisi sebuah file.");
  }

  const courseId = bacaTeks(form.get("courseId"));
  if (!courseId) {
    return galat(400, "Field 'courseId' wajib diisi.");
  }

  // `subjek` diterima sebagai alias agar pemanggil lama tidak langsung rusak.
  const subjekId = bacaTeks(form.get("subjekId")) || bacaTeks(form.get("subjek"));

  const ekstensi = ekstensiUntukMime(berkas.type);
  if (!ekstensi) {
    const dilaporkan = berkas.type || "tidak diketahui";
    return galat(
      415,
      `Tipe berkas '${dilaporkan}' tidak diizinkan. Gunakan PNG, JPEG, WebP, atau PDF.`,
    );
  }

  // Dicek setelah MIME: berkas kosong dengan tipe benar tetap tidak berguna,
  // dan menolaknya lebih awal menghindari berkas 0 byte berserakan di disk.
  if (berkas.size === 0) {
    return galat(400, "Berkas kosong (0 byte) tidak bisa diunggah.");
  }

  if (berkas.size > MAKS_UKURAN_BYTE) {
    return galat(
      413,
      `Ukuran berkas ${formatUkuran(berkas.size)} melebihi batas maksimum ${formatUkuran(MAKS_UKURAN_BYTE)}.`,
    );
  }

  // Setiap segmen disanitasi terpisah; `slugify("")` bisa kosong, jadi ada
  // cadangan "umum" agar folder tidak pernah menjadi path kosong.
  const segmen = ["uploads", "courses", slugify(courseId) || "umum"];
  if (subjekId) {
    segmen.push(slugify(subjekId) || "umum");
  }

  const namaFile = namaBerkasTersanitasi(berkas.name, ekstensi);
  const direktori = path.join(process.cwd(), "public", ...segmen);
  const isi = Buffer.from(await berkas.arrayBuffer());

  try {
    await mkdir(direktori, { recursive: true });
    // Flag "wx" menolak menimpa berkas yang sudah ada. Sufiks acak membuat
    // tumbukan praktis tidak mungkin, tapi bila terjadi kita gagal keras
    // daripada diam-diam mengganti materi milik orang lain.
    await writeFile(path.join(direktori, namaFile), isi, { flag: "wx" });
  } catch {
    return galat(500, "Gagal menyimpan berkas ke penyimpanan server.");
  }

  // Seluruh `segmen` dipertahankan — termasuk "uploads". Membuang segmen
  // pertama akan menghasilkan URL tanpa `/uploads`, padahal berkasnya ditulis
  // ke `public/uploads/...`, sehingga `src`/`href` yang dikembalikan 404.
  const pathPublik = `/${[...segmen, namaFile].join("/")}`;

  return Response.json({
    ok: true,
    path: pathPublik,
    namaAsli: berkas.name,
    ukuran_bytes: berkas.size,
    tipe_mime: berkas.type,
  });
}
