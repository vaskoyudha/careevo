import type { BlokHalaman, Course, Halaman, Modul } from "@/types/course";
import { segmenKeTeks } from "./blok";
import { halamanModul } from "./submodul";

/**
 * Operasi murni atas halaman modul.
 *
 * Sama seperti `blok.ts`: **tidak boleh** menyentuh store atau `node:fs` —
 * berkas ini ikut masuk bundel klien lewat renderer halaman.
 *
 * Sejak tingkat sub-modul ada, halaman **tidak lagi** menempel langsung di
 * modul: ia hidup di dalam `Modul.submodul[].halaman`. Berkas ini karena itu
 * memakai `halamanModul()` dari `submodul.ts` untuk meratakan pohonnya, alih-alih
 * membaca `modul.halaman` — satu tempat meratakan, supaya penomoran halaman di
 * panel dan di pane tidak bisa berbeda.
 */

/** Judul bawaan halaman ke-`urutan` (1-based). */
export function judulHalamanOtomatis(urutan: number): string {
  return `Halaman ${urutan}`;
}

/**
 * Halaman sebuah modul, terurut menaik — hasil ratanya dari seluruh sub-modul.
 *
 * Modul lama belum punya sub-modul sama sekali; `undefined` di sini berarti
 * "tidak ada halaman", bukan error — dan kursus seperti itu tetap memakai modul
 * turunan seperti sebelumnya.
 */
export function halamanUntukModul(modul: Pick<Modul, "submodul">): Halaman[] {
  return halamanModul(modul);
}

/** Cari satu halaman di dalam modul, atau `null`. */
export function cariHalaman(modul: Pick<Modul, "submodul">, halamanId: string): Halaman | null {
  return halamanModul(modul).find((h) => h.id === halamanId) ?? null;
}

/** Nomor halaman (1-based) dalam modul, atau `null` bila tidak ada. */
export function nomorHalaman(modul: Pick<Modul, "submodul">, halamanId: string): number | null {
  const posisi = halamanModul(modul).findIndex((h) => h.id === halamanId);
  return posisi === -1 ? null : posisi + 1;
}

/** Jawaban "modul ini punya halaman berformat?" — dipakai UI untuk memilih cabang render. */
export function punyaHalaman(modul: Pick<Modul, "submodul">): boolean {
  return halamanModul(modul).length > 0;
}

/**
 * Jumlah kata di **satu** halaman — untuk memperkirakan waktu baca.
 *
 * Dihitung dari teks polos segmen, jadi penanda format tidak ikut terhitung.
 * Blok `kode` dan `gambar` tidak dihitung: kode dibaca dengan kecepatan yang
 * sama sekali lain, dan gambar tidak punya kata sama sekali.
 */
export function jumlahKataHalaman(halaman: Halaman): number {
  let total = 0;
  for (const blok of halaman.blok) {
    if (blok.tipe === "daftar") {
      for (const butir of blok.butir ?? []) {
        total += kataDari(segmenKeTeks(butir));
      }
    } else if (blok.tipe !== "gambar" && blok.tipe !== "kode") {
      total += kataDari(segmenKeTeks(blok.segmen));
    }
  }
  return total;
}

/** Jumlah kata di seluruh halaman modul. Asalnya dari jumlah per halaman. */
export function jumlahKata(modul: Pick<Modul, "submodul">): number {
  return halamanUntukModul(modul).reduce((total, h) => total + jumlahKataHalaman(h), 0);
}

/**
 * Kecepatan baca yang dipakai memperkirakan durasi, dalam kata per menit.
 *
 * Angka ini **eksplisit dan bisa diperdebatkan**, bukan tersembunyi di dalam
 * rumus: ia satu-satunya asumsi di balik "≈N mnt", jadi mengubahnya berarti
 * mengubah seluruh perkiraan yang ditampilkan. 200 kpm adalah laju baca diam
 * yang umum untuk teks non-teknis.
 */
export const KATA_PER_MENIT = 200;

/**
 * Perkiraan menit baca satu halaman, dibulatkan **ke atas** dan minimal 1.
 *
 * Ini perkiraan, bukan janji: halaman yang isinya 74 kata (median katalog
 * ter-seed) memang muncul sebagai "1 mnt", dan itu jawaban yang jujur. Karena
 * itu pemakainya menuliskan tanda "≈" di UI — angka ini tidak boleh disajikan
 * sebagai durasi yang diukur.
 */
export function perkiraanMenitBaca(halaman: Halaman): number {
  return Math.max(1, Math.ceil(jumlahKataHalaman(halaman) / KATA_PER_MENIT));
}

/**
 * Halaman yang harus ditampilkan untuk sebuah permintaan, atau `null` bila
 * modulnya memang tidak punya halaman.
 *
 * **Ini satu-satunya tempat aturan "id basi → halaman pertama" hidup.** Panel
 * silabus memakainya untuk menandai baris yang sedang dibuka, dan pane modul
 * memakainya untuk memilih halaman yang dirender; dua salinan aturan ini akan
 * menyimpang diam-diam — panel menyorot satu halaman sementara pane menampilkan
 * halaman lain, tanpa error di mana pun.
 *
 * Id yang tidak ketemu **bukan** galat: `?halaman=` adalah masukan dari URL,
 * dan tautan lama (atau halaman yang dihapus admin) harus jatuh ke halaman
 * pertama, bukan menampilkan pane kosong.
 */
export function halamanDipilih(
  modul: Pick<Modul, "submodul">,
  halamanId?: string | null,
): Halaman | null {
  const daftar = halamanUntukModul(modul);
  if (daftar.length === 0) return null;
  return daftar.find((h) => h.id === halamanId) ?? daftar[0];
}

/**
 * Modul yang harus dipakai untuk sebuah permintaan, atau `null` bila kurikulum
 * kosong.
 *
 * **Ini satu-satunya tempat aturan "modul mana yang aktif" hidup** untuk
 * permukaan yang memilih modul lewat `?modul=` (ruang kerja). Sisi klien
 * (`RuangKerjaChrome` dan `RuangKerjaLab`) dan panel silabusnya harus menjawab
 * pertanyaan yang sama — modul mana yang disorot, halaman mana yang dirender —
 * dan dua salinan aturan ini akan menyimpang diam-diam: panel menyorot satu
 * modul sementara kolom panduan menampilkan modul lain, tanpa error di mana pun.
 *
 * Modul tanpa halaman **tidak pernah dipilih diam-diam**: `?modul=` yang
 * menunjuk modul kosong (turunan, atau modul tersimpan yang halamannya belum
 * ditulis) akan membuat kolom panduan kosong tanpa sebab yang terlihat. Karena
 * itu fallback-nya jatuh ke modul **pertama yang punya halaman**, bukan ke
 * `modul[0]` buta. Pada course yang modul pertamanya masih turunan dan modul
 * kedua sudah tersimpan, tanpa URL pun yang dipakai adalah modul kedua — modul
 * yang benar-benar punya sesuatu untuk dibaca.
 *
 * `??` dan bukan `||`: `find()` mengembalikan `undefined` saat tidak ada yang
 * cocok, dan `??` menyatakan niatnya — "kalau tidak ketemu, pakai bawaan" —
 * tanpa ikut menelan id yang sah.
 */
export function modulDipilih<T extends { id: string; halaman?: Halaman[] }>(
  modul: T[],
  modulId?: string | null,
): T | null {
  return (
    modul.find((m) => m.id === modulId && (m.halaman?.length ?? 0) > 0) ??
    modul.find((m) => (m.halaman?.length ?? 0) > 0) ??
    modul[0] ??
    null
  );
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

    // Bab pertama modul ini — sudah ada bila `normalisasiSubmodulLama` berjalan
    // lebih dulu (urutan di `pastikanTermuat` memang begitu), dan dibuat di sini
    // untuk modul yang punya materi `teks` tetapi belum punya halaman sama
    // sekali, sehingga migrasi sub-modul melewatinya.
    const pertama = m.submodul?.[0];
    const idPertama = pertama?.id ?? `sub-${m.id}`;

    const dariMateri: Halaman[] = teks.map((item, index) => ({
      id: `hal-${item.id}`,
      submodul_id: idPertama,
      modul_id: m.id,
      course_id: course.id,
      judul: item.judul?.trim() || judulHalamanOtomatis(index + 1),
      // 0-based supaya selalu berada sebelum halaman yang sudah ada; dirapikan
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

    const halamanPertama = [
      ...dariMateri,
      ...(pertama?.halaman ?? []),
    ].map((h, index) => ({ ...h, submodul_id: idPertama, urutan: index + 1 }));

    const submodul = [
      {
        id: idPertama,
        modul_id: m.id,
        course_id: course.id,
        judul: pertama?.judul ?? "Bagian 1",
        ringkasan: pertama?.ringkasan ?? "",
        urutan: 1,
        halaman: halamanPertama,
        created_at: pertama?.created_at ?? now,
        updated_at: now,
      },
      ...(m.submodul ?? []).slice(1),
    ];

    return {
      ...m,
      submodul,
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
