import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Course, Kuis } from "@/types/course";

/**
 * Persistensi kursus ke berkas JSON di disk.
 *
 * Ini satu-satunya modul di aplikasi yang menyentuh `node:fs`. Dipisah dari
 * `store.ts` supaya store tetap bisa diuji tanpa disk dan supaya penukaran ke
 * database sungguhan hanya menyentuh dua fungsi di sini.
 *
 * Direktori data bisa dialihkan lewat `CAREVEO_DATA_DIR` — dipakai test supaya
 * tidak menulis ke `data/` milik repo.
 */

/** Direktori data yang berlaku, dihitung per panggilan agar `CAREVEO_DATA_DIR` bisa di-stub test. */
function direktoriData(): string {
  return process.env.CAREEVO_DATA_DIR ?? path.join(process.cwd(), "data");
}

/** Path berkas kursus. */
export function berkasCourses(): string {
  return path.join(direktoriData(), "courses.json");
}

/**
 * Path berkas bank soal.
 *
 * Terpisah dari `courses.json` karena bank soal adalah entitas lintas kursus:
 * satu kuis bisa dipakai modul di kursus mana pun. Menumpangkannya ke kursus
 * berarti soal yang sama harus disalin ke setiap kursus yang memakainya — persis
 * masalah yang membuat kuis dipisahkan dari materi.
 */
export function berkasKuis(): string {
  return path.join(direktoriData(), "kuis.json");
}

/**
 * Bentuk minimal sebuah `Course` yang layak dipercaya dari disk.
 *
 * Sengaja longgar terhadap field opsional (`modul`, `cover_image`) tetapi ketat
 * pada field yang dipakai UI, supaya berkas yang korup atau hasil edisi tangan
 * tidak membuat halaman gagal render dengan error yang tidak informatif.
 */
function isCourse(value: unknown): value is Course {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    typeof c.slug === "string" &&
    typeof c.description === "string" &&
    typeof c.provider === "string" &&
    typeof c.url === "string" &&
    typeof c.duration_min === "number" &&
    typeof c.is_free === "boolean" &&
    typeof c.status === "string" &&
    Array.isArray(c.tags) &&
    c.tags.every((tag) => typeof tag === "string")
  );
}

/**
 * Baca kursus dari disk.
 *
 * Mengembalikan `null` (bukan melempar) saat berkas belum ada atau tidak bisa
 * diurai — pemanggil yang memutuskan jatuh ke seed. Berkas yang ada tapi
 * isinya bukan array kursus yang valid juga dianggap `null` agar satu berkas
 * rusak tidak menjatuhkan seluruh aplikasi.
 */
export async function muatCourses(): Promise<Course[] | null> {
  let mentah: string;
  try {
    mentah = await readFile(berkasCourses(), "utf8");
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(mentah) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isCourse);
  } catch {
    return null;
  }
}

/**
 * Apakah nilai ini entri bank soal yang layak dipercaya?
 *
 * Longgar pada `deskripsi` (opsional di tipe) tetapi ketat pada `soal`, sebab
 * itu yang dirender dan dinilai. Entri dengan `soal` tidak berbentuk array
 * dibuang di gerbang ini supaya perender tidak perlu mempertahankannya.
 */
function isKuis(value: unknown): value is Kuis {
  if (typeof value !== "object" || value === null) return false;
  const k = value as Record<string, unknown>;
  return (
    typeof k.id === "string" &&
    typeof k.judul === "string" &&
    Array.isArray(k.soal) &&
    typeof k.nilai_lulus === "number"
  );
}

/**
 * Baca bank soal dari disk.
 *
 * Sama seperti `muatCourses`: `null` (bukan lempar) saat berkas belum ada atau
 * tidak bisa diurai, sehingga pemanggil yang memutuskan artinya. Berkas yang
 * ada tapi bukan array kuis valid juga dianggap `null`.
 */
export async function muatKuis(): Promise<Kuis[] | null> {
  let mentah: string;
  try {
    mentah = await readFile(berkasKuis(), "utf8");
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(mentah) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isKuis);
  } catch {
    return null;
  }
}

/**
 * Tulis atomik ke sebuah berkas JSON.
 *
 * Tulis ke berkas sementara lalu `rename`: `rename` bersifat atomik di
 * filesystem yang sama, sehingga proses yang mati di tengah penulisan tidak
 * meninggalkan berkas yang terpotong.
 */
async function tulisAtomik(tujuan: string, isi: unknown): Promise<void> {
  await mkdir(path.dirname(tujuan), { recursive: true });
  const sementara = `${tujuan}.tmp`;
  await writeFile(sementara, `${JSON.stringify(isi, null, 2)}\n`, "utf8");
  await rename(sementara, tujuan);
}

/**
 * Serialisasi penulisan.
 *
 * Satu rantai dipakai bersama oleh `courses.json` dan `kuis.json` — bukan dua
 * rantai terpisah. Keduanya ditulis oleh mutasi yang sama (memasang kuis
 * mengubah kursus **dan** bank), dan rantai bersama menjamin urutan penulisan
 * antara keduanya tetap sesuai urutan pemanggilan. Berkas sementaranya sendiri
 * sudah berbeda karena diturunkan dari path masing-masing.
 */
let rantaiTulis: Promise<void> = Promise.resolve();

function antre(kerja: () => Promise<void>): Promise<void> {
  const berikut = rantaiTulis.then(kerja);
  rantaiTulis = berikut.catch(() => undefined);
  return berikut;
}

/** Tulis seluruh daftar kursus ke disk secara atomik. */
export function simpanCourses(courses: Course[]): Promise<void> {
  return antre(() => tulisAtomik(berkasCourses(), courses));
}

/** Tulis seluruh bank soal ke disk secara atomik. */
export function simpanKuis(kuis: Kuis[]): Promise<void> {
  return antre(() => tulisAtomik(berkasKuis(), kuis));
}
