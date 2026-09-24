import type { BlokHalaman, Course, Halaman, Modul } from "@/types/course";
import { segmenKeTeks } from "./blok";

/**
 * Operasi murni atas halaman modul.
 *
 * Sama seperti `blok.ts`: **tidak boleh** menyentuh store atau `node:fs` —
 * berkas ini ikut masuk bundel klien lewat renderer halaman.
 */

/** Judul bawaan halaman ke-`urutan` (1-based). */
export function judulHalamanOtomatis(urutan: number): string {
  return `Halaman ${urutan}`;
}

/**
 * Halaman sebuah modul, terurut menaik.
 *
 * Modul lama belum punya `halaman` sama sekali; `undefined` di sini berarti
 * "tidak ada halaman", bukan error — dan kursus seperti itu tetap memakai modul
 * turunan seperti sebelumnya.
 */
export function halamanUntukModul(modul: Pick<Modul, "halaman">): Halaman[] {
  if (!modul.halaman?.length) return [];
  return [...modul.halaman].sort((a, b) => a.urutan - b.urutan);
}

/** Cari satu halaman di dalam modul, atau `null`. */
export function cariHalaman(modul: Pick<Modul, "halaman">, halamanId: string): Halaman | null {
  return modul.halaman?.find((h) => h.id === halamanId) ?? null;
}

/** Nomor halaman (1-based) dalam modul, atau `null` bila tidak ada. */
export function nomorHalaman(modul: Pick<Modul, "halaman">, halamanId: string): number | null {
  const posisi = (modul.halaman ?? []).findIndex((h) => h.id === halamanId);
  return posisi === -1 ? null : posisi + 1;
}

/** Jawaban "modul ini punya halaman berformat?" — dipakai UI untuk memilih cabang render. */
export function punyaHalaman(modul: Pick<Modul, "halaman">): boolean {
  return (modul.halaman?.length ?? 0) > 0;
}

/**
 * Jumlah kata di seluruh halaman modul — untuk memperkirakan waktu baca.
 *
 * Dihitung dari teks polos segmen, jadi penanda format tidak ikut terhitung.
 */
export function jumlahKata(modul: Pick<Modul, "halaman">): number {
  let total = 0;
  for (const halaman of halamanUntukModul(modul)) {
    for (const blok of halaman.blok) {
      if (blok.tipe === "daftar") {
        for (const butir of blok.butir ?? []) {
          total += kataDari(segmenKeTeks(butir));
        }
      } else if (blok.tipe !== "gambar") {
        total += kataDari(segmenKeTeks(blok.segmen));
      }
    }
  }
  return total;
}

function kataDari(teks: string): number {
  const bersih = teks.trim();
  return bersih ? bersih.split(/\s+/).length : 0;
}

/**
 * Ubah materi bertipe `teks` yang sudah tersimpan menjadi halaman berformat.
 *
 * `TipeMateri` kini hanya `video | pdf | kuis`, tapi berkas `courses.json` di
 * mesin pengembang bisa masih memuat materi `teks` dari versi sebelumnya. Alih-
 * alih membiarkannya sebagai entri yang tidak bisa dirender siapa pun, tiap
 * materi `teks` dipromosikan menjadi satu halaman berisi satu blok paragraf.
 *
 * Tiga sifat yang disengaja:
 *
 * - **Deterministik dan idempoten.** Id halaman diturunkan dari id materi
 *   (`hal-<id materi>`), bukan dari waktu. Menjalankan fungsi ini dua kali
 *   menghasilkan id yang sama, jadi migrasi yang terpanggil berulang tidak
 *   menggandakan halaman.
 * - **Tidak menghapus apa pun bila tidak perlu.** Modul tanpa materi `teks`
 *   dikembalikan apa adanya (referensi yang sama), sehingga tidak ada penulisan
 *   disk yang dipicu tanpa perubahan nyata.
 * - **Halaman hasil migrasi ditaruh di depan.** Halaman itu berisi materi
 *   pengantar yang dulu paling awal dibaca; menaruhnya setelah halaman yang
 *   sudah ditulis admin akan membalik urutan baca.
 *
 * Materi `teks` dibuang dari `materi[]` setelah dipromosikan supaya tidak ada
 * dua sumber untuk prosa yang sama.
 */
/**
 * Bentuk materi `teks` dari versi lama.
 *
 * Didefinisikan sendiri, bukan sebagai `Materi & { tipe: "teks" }`: `Materi`
 * sudah tidak memuat varian `teks`, sehingga irisan semacam itu bertipe `never`
 * dan setiap akses propertinya jadi error tipe. Data dari disk tetap bisa
 * memuatnya, jadi bentuknya dinyatakan terpisah dari union yang berlaku kini.
 */
interface MateriTeksLama {
  id: string;
  judul?: string;
  konten: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Apakah entri ini materi `teks` dari versi lama?
 *
 * Diperiksa lewat bentuk runtime, bukan `tipe === "teks"` saja: nilainya datang
 * dari berkas, dan berkas belum tentu setuju dengan tipe di compile time.
 */
function isMateriTeksLama(materi: unknown): materi is MateriTeksLama {
  if (typeof materi !== "object" || materi === null) return false;
  const kandidat = materi as Record<string, unknown>;
  return (
    kandidat.tipe === "teks" &&
    typeof kandidat.konten === "string" &&
    typeof kandidat.id === "string"
  );
}

export function normalisasiHalamanLama(course: Course): Course {
  if (!course.modul?.length) return course;

  const now = new Date().toISOString();
  let berubah = false;
  const modul: Modul[] = course.modul.map((m) => {
    const materi: unknown[] = m.materi ?? [];
    const teks = materi.filter(isMateriTeksLama);
    if (teks.length === 0) return m;

    berubah = true;

    const dariMateri: Halaman[] = teks.map((item, index) => ({
      id: `hal-${item.id}`,
      modul_id: m.id,
      course_id: course.id,
      judul: item.judul?.trim() || judulHalamanOtomatis(index + 1),
      // 0 supaya selalu berada sebelum halaman yang sudah ada; dirapikan
      // menjadi 1..n begitu digabung di bawah.
      urutan: index,
      blok: [
        {
          id: `blk-${item.id}`,
          tipe: "paragraf",
          ukuran: "normal",
          segmen: [{ teks: item.konten }],
        } satisfies BlokHalaman,
      ],
      created_at: item.created_at ?? now,
      updated_at: item.updated_at ?? now,
    }));

    const gabungan = [...dariMateri, ...(m.halaman ?? [])].map((h, index) => ({
      ...h,
      urutan: index + 1,
    }));

    return {
      ...m,
      halaman: gabungan,
      materi: (m.materi ?? []).filter((item) => !isMateriTeksLama(item)),
    };
  });

  if (!berubah) return course;

  return {
    ...course,
    modul,
    updated_at: now,
  };
}
