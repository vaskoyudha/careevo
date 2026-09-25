import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isStaffRole } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { slugify } from "@/lib/courses/store";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import { originDiizinkan, PESAN_ORIGIN_DITOLAK } from "@/lib/http/origin";
import { batasiRequestMasuk } from "@/lib/rate-limit/next";

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

/**
 * Ekstensi yang diizinkan untuk sebuah MIME, atau `null` bila tidak diizinkan.
 *
 * `Object.hasOwn` wajib ada di sini, bukan sekadar kehati-hatian. `EKSTENSI_PER_MIME`
 * adalah objek literal, jadi ia mewarisi `Object.prototype`; lookup bracket polos
 * (`EKSTENSI_PER_MIME[kunci]`) akan MENGEMBALIKAN FUNGSI untuk kunci seperti
 * `constructor` atau mengembalikan objek untuk `__proto__`. Pemeriksaan
 * `if (!ekstensi)` tidak menangkapnya karena keduanya truthy, sehingga
 * Content-Type "constructor" lolos daftar putih dan nilainya terinterpolasi ke
 * nama berkas sebagai teks tanpa ekstensi — daftar putih MIME buyar total.
 *
 * Parameter MIME dipotong lebih dulu: `image/png; charset=utf-8` adalah bentuk
 * HTTP yang sah, dan tanpa pemotongan ini ia ditolak hanya karena ekor parameter.
 */
export function ekstensiUntukMime(mime: string): string | null {
  const kunci = mime.split(";")[0].trim().toLowerCase();
  return Object.hasOwn(EKSTENSI_PER_MIME, kunci) ? EKSTENSI_PER_MIME[kunci] : null;
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
 * Subjek unggahan harus benar-benar milik kursus yang disebut.
 *
 * Subjek adalah id modul (dipakai editor halaman untuk halaman baru), id
 * materi, atau id halaman — lihat pemanggil `UnggahBerkas`. Modul di sini
 * berasal dari resolver efektif (`modulUntuk`), jadi kursus yang masih memakai
 * modul turunan (`${courseId}-m1`…) juga menerima id modulnya, bukan hanya
 * kursus yang sudah punya modul tersimpan.
 *
 * Tanpa pemeriksaan ini, `subjekId` apa pun diterima dan langsung dipakai
 * sebagai segmen path — seorang staff bisa menaruh berkas di bawah kursus mana
 * pun hanya dengan menebak/menyebut id subjek asing.
 */
export function subjekMilikCourse(modul: ModulKursus[], subjekId: string): boolean {
  for (const m of modul) {
    if (m.id === subjekId) return true;
    if ((m.materi ?? []).some((mat) => mat.id === subjekId)) return true;
    if ((m.halaman ?? []).some((hal) => hal.id === subjekId)) return true;
  }
  return false;
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
  // Validasi Origin lebih dulu — sebelum body disentuh sama sekali. Route
  // handler tidak mendapat perlindungan CSRF bawaan Next.js (itu hanya untuk
  // Server Action), jadi ia memeriksa sendiri. Ini SATU lapisan di antara
  // beberapa (cookie SameSite=Lax + gerbang sesi staff di bawah), bukan
  // satu-satunya pertahanan. Kebijakannya fail-closed: Origin yang absen
  // ditolak kecuali `CAREEVO_ALLOW_MISSING_ORIGIN` diisi eksplisit, dan
  // `X-Forwarded-Host` tidak dipercaya kecuali
  // `CAREEVO_TRUST_PROXY_HEADERS` diisi. Lihat `@/lib/http/origin`.
  if (!originDiizinkan(request)) {
    return galat(403, PESAN_ORIGIN_DITOLAK);
  }

  const sesi = await getSession();
  if (!sesi) {
    return galat(401, "Sesi tidak ditemukan. Silakan masuk terlebih dahulu.");
  }
  if (!isStaffRole(sesi.role)) {
    return galat(403, "Hanya verifikator atau admin yang boleh mengunggah berkas.");
  }

  // Dihitung SETELAH sesi dan peran dipastikan, dan SEBELUM `formData()`:
  // endpoint ini membuffer seluruh body ke memori, jadi menolak lebih awal
  // adalah satu-satunya cara batas ini juga melindungi heap. Bucket kedua per
  // principal ditambahkan supaya satu akun staff tidak bisa memakai banyak IP,
  // dan sebaliknya staff di belakang NAT bersama tidak saling mengunci.
  const batas = await batasiRequestMasuk(request, "unggahCourse", {
    tambahan: `unggah:${sesi.email}`,
  });
  if (batas) return batas;

  // Tolak berdasarkan Content-Length SEBELUM `formData()` dipanggil. Batas 8 MB
  // di bawah tidak menolong di sini: `formData()` sudah membaca habis dan
  // menampung seluruh body di memori, jadi berkas berukuran ratusan MB sempat
  // dialokasikan sebelum `berkas.size` bisa diperiksa. Beberapa permintaan
  // paralel cukup untuk menghabiskan heap. `bodySizeLimit` di next.config.ts
  // TIDAK menutup celah ini — opsi itu hanya berlaku untuk Server Action, bukan
  // route handler. Toleransi 64 KB memberi ruang untuk boundary dan header part.
  const panjangKonten = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(panjangKonten) && panjangKonten > MAKS_UKURAN_BYTE + 64 * 1024) {
    return galat(
      413,
      `Ukuran unggahan (${formatUkuran(panjangKonten)}) melebihi batas maksimum ${formatUkuran(MAKS_UKURAN_BYTE)}.`,
    );
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

  // Resolusi modul kursus sekali di sini: dipakai untuk membuktikan kursusnya
  // ada sekaligus memvalidasi `subjekId`. `modulUntuk` adalah resolver tunggal
  // (stored menang, selain itu turunan), jadi derived module tetap diterima.
  const modul = await modulUntuk(courseId);
  if (modul.length === 0) {
    return galat(404, `Kursus '${courseId}' tidak ditemukan.`);
  }

  if (subjekId && !subjekMilikCourse(modul, subjekId)) {
    return galat(404, `Subjek '${subjekId}' tidak ditemukan pada kursus ini.`);
  }

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
