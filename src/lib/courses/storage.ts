import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Course } from "@/types/course";

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

/** Path berkas kursus, dihitung per panggilan agar `CAREVEO_DATA_DIR` bisa di-stub test. */
export function berkasCourses(): string {
  const dir = process.env.CAREEVO_DATA_DIR ?? path.join(process.cwd(), "data");
  return path.join(dir, "courses.json");
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

async function tulisAtomik(courses: Course[]): Promise<void> {
  const tujuan = berkasCourses();
  await mkdir(path.dirname(tujuan), { recursive: true });

  // Tulis ke berkas sementara lalu rename: `rename` bersifat atomik di
  // filesystem yang sama, sehingga proses yang mati di tengah penulisan tidak
  // meninggalkan `courses.json` yang terpotong.
  const sementara = `${tujuan}.tmp`;
  await writeFile(sementara, `${JSON.stringify(courses, null, 2)}\n`, "utf8");
  await rename(sementara, tujuan);
}

// Serialisasi penulisan: dua mutasi yang berbarengan tidak boleh saling
// menimpa berkas sementara yang sama.
let rantaiTulis: Promise<void> = Promise.resolve();

/** Tulis seluruh daftar kursus ke disk secara atomik. */
export function simpanCourses(courses: Course[]): Promise<void> {
  const berikut = rantaiTulis.then(() => tulisAtomik(courses));
  rantaiTulis = berikut.catch(() => undefined);
  return berikut;
}
