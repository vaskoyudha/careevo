import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ringkasBerkas } from "./snapshot";
import type { SnapshotProses } from "./proses";

/**
 * Penyimpanan jejak proses ruang kerja — **server-only**, JSONL.
 *
 * ## Kenapa file, bukan tabel
 *
 * Jejak ini adalah **bukti pengamatan**, bukan keputusan: tidak ada satu pun
 * barisnya yang menurunkan skor. Menaruhnya di database akan memblutukkan tabel
 * yang sekarang bermakna ("`active` = keputusan manusia") dengan baris yang tidak
 * punya keputusan apa pun — persis kebalikan dari yang dikejar CHECK
 * `integrity_violations_status_shape_check`.
 *
 * Bentuknya JSONL, satu snapshot per baris, sama seperti `learning_events`.
 *
 * ## Kenapa ditulis ulang, bukan di-append
 *
 * Idealnya append-only, tapi baris paling lama harus dipotong supaya ruang kerja
 * yang ditinggal terbuka seharian tidak tumbuh tanpa batas. Memotong berarti
 * menulis ulang isi yang dipertahankan, jadi file ini **bukan** append-only
 * murni — dan itu harus jujur, bukan diklaim sebagai "log yang tidak pernah
 * berubah". Yang dijaga: isi baris **yang dipertahankan tidak pernah diubah**,
 * dan hanya baris terlama yang dibuang, berurutan dari yang tertua.
 *
 * `CAREERS_DATA_DIR` mengikuti toko file lain (`resume`, `book`, `latihan`,
 * `mastery`) supaya test bisa mengarahkan ke direktori sementara.
 */

/** Berapa snapshot terakhir yang disimpan per ruang kerja. */
export const BATAS_SNAPSHOT_PROSES = 240;

/** Override direktori data — sama dengan toko file lain. */
function akarData(): string {
  return process.env.CAREERS_DATA_DIR ?? path.join(process.cwd(), ".data");
}

/**
 * Buat satu segmen path yang aman.
 *
 * `userId` dan `courseId` masuk ke path, jadi keduanya harus disanai: `courseId`
 * berasal dari `data/courses.json` dan `userId` adalah UUID, tapi menyandainya
 * membuat jalur keluar dari akar data mustahil secara struktural, bukan karena
 * pemanggilnya kebetulan mengirim nilai yang bersih.
 */
function segmen(nilai: string): string {
  const bersih = typeof nilai === "string" ? nilai.replace(/[^a-zA-Z0-9._-]/g, "_") : "";
  // Nilai kosong setelah disanai menjadi `_`: dua nilai berbeda yang sama-sama
  // berisi karakter terlarang akan bertabrakan kalau keduanya jadi string kosong.
  return bersih === "" || bersih === "." || bersih === ".." ? "_" : bersih;
}

/** Direktori jejak satu ruang kerja. */
function direktoriJejak(userId: string, courseId: string): string {
  return path.join(akarData(), "workspace-jejak", segmen(userId), segmen(courseId));
}

/** Path berkas JSONL untuk satu ruang kerja. */
export function pathJejak(userId: string, courseId: string): string {
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new Error("Jejak ruang kerja perlu userId.");
  }
  if (typeof courseId !== "string" || courseId.trim() === "") {
    throw new Error("Jejak ruang kerja perlu courseId.");
  }
  return path.join(direktoriJejak(userId, courseId), "snapshots.jsonl");
}

/** Bentuk satu baris JSONL. Dipisah supaya bisa diuji tanpa filesystem. */
export function barisSnapshot(snap: SnapshotProses): string {
  return JSON.stringify({
    at: snap.at,
    berkas: snap.ringkasan.berkas,
    terpotong: snap.ringkasan.terpotong,
    total: snap.ringkasan.total,
  });
}

/** Bentuk yang terbaca dari satu baris JSONL, atau `null` kalau tidak bisa dipakai. */
function keSnapshot(nilai: unknown): SnapshotProses | null {
  if (typeof nilai !== "object" || nilai === null || Array.isArray(nilai)) return null;
  const b = nilai as Record<string, unknown>;
  if (typeof b.at !== "string") return null;
  if (!Array.isArray(b.berkas)) return null;

  // Dilewatkan lewat `ringkasBerkas` supaya aturan penyaringan yang sama
  // berlaku di jejak dan di snapshot submission: path yang diabaikan tidak
  // bisa masuk lewat jalur baca yang lupa memfilter.
  const ringkasan = ringkasBerkas(
    (b.berkas as unknown[])
      .map((x) => {
        if (typeof x !== "object" || x === null) return "";
        const f = x as Record<string, unknown>;
        return `${String(f.ukuran)}\t${String(f.path)}`;
      })
      .join("\n"),
  );

  // `terpotong` dan `total` dibaca dari baris, bukan dari hasil re-`ringkasBerkas`:
  // rekonstruksi tidak bisa tahu bahwa daftar aslinya terpotong, jadi
  // mengarangnya sebagai `false` membuat jejak tampak lengkap padahal tidak.
  const total = typeof b.total === "number" && Number.isFinite(b.total) ? b.total : ringkasan.total;
  return {
    at: b.at,
    ringkasan: {
      berkas: ringkasan.berkas,
      terpotong: b.terpotong === true,
      total,
    },
  };
}

/**
 * Baca semua snapshot yang tersimpan.
 *
 * **Baris rusak dibuang, bukan membuat seluruh pembacaan gagal.** Berkas ditulis
 * dari satu proses, jadi baris rusak berarti penulisan terputus sebagian — dan
 * jejak yang berhenti di baris ke-3 lebih berguna daripada tidak ada jejak sama
 * sekali. Baris yang tidak terbaca juga tidak pernah dihitung sebagai observasi,
 * jadi `observasi` di `hitungJejak` tetap jujur.
 */
export async function bacaSnapshot(
  userId: string,
  courseId: string,
): Promise<SnapshotProses[]> {
  let teks: string;
  try {
    teks = await readFile(pathJejak(userId, courseId), "utf8");
  } catch {
    // Belum ada jejak: "belum pernah diamati", bukan "tidak ada berkasnya".
    return [];
  }

  const hasil: SnapshotProses[] = [];
  for (const baris of teks.split("\n")) {
    if (!baris.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(baris);
    } catch {
      continue;
    }
    const snap = keSnapshot(parsed);
    if (snap) hasil.push(snap);
  }
  return hasil;
}

/**
 * Tambahkan satu snapshot.
 *
 * **Tidak melempar.** Jejak adalah bukti pelengkap; kegagalan menulisnya tidak
 * boleh menghentikan alur ruang kerja yang sedang berjalan. Nilai balik
 * memberi tahu pemanggil apakah ada yang benar-benar tersimpan.
 *
 * Snapshot identik dengan yang terakhir **tidak** ditulis: kontainer yang tidak
 * berubah menghasilkan baris yang sama setiap capture, dan jejak penuh baris
 * identik tidak membawa informasi apa pun.
 */
export async function tambahSnapshot(
  userId: string,
  courseId: string,
  snap: SnapshotProses,
  maks: number = BATAS_SNAPSHOT_PROSES,
): Promise<boolean> {
  try {
    const dir = direktoriJejak(userId, courseId);
    await mkdir(dir, { recursive: true });
    const berkas = path.join(dir, "snapshots.jsonl");

    const batas = Number.isInteger(maks) && maks > 0 ? maks : BATAS_SNAPSHOT_PROSES;
    const ada = await bacaSnapshot(userId, courseId);

    const terakhir = ada[ada.length - 1];
    if (
      terakhir &&
      terakhir.at === snap.at &&
      JSON.stringify(terakhir.ringkasan.berkas) === JSON.stringify(snap.ringkasan.berkas)
    ) {
      return false;
    }

    const garis = [...ada, snap].slice(-batas).map(barisSnapshot);
    await writeFile(berkas, `${garis.join("\n")}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}