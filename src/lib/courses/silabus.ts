import type { Kuis, Materi, Submodul } from "@/types/course";
import { perkiraanMenitBaca } from "./halaman";
import { halamanModul, halamanSubmodul, submodulUntukModul } from "./submodul";

/**
 * Isi sebuah modul, diratakan menjadi baris-baris yang bisa ditampilkan.
 *
 * Panel silabus reader membuka sebuah modul untuk memperlihatkan isinya —
 * halaman, lampiran, kuis — dan pane modul merender isi yang sama dengan urutan
 * yang sama. Dua tempat itu **wajib** sepakat: kalau panel menyebut "2 halaman"
 * sementara pane merender tiga, tidak ada error di mana pun dan yang rusak hanya
 * kepercayaan peserta pada petanya.
 *
 * Karena itu jenis, urutan, dan ambang "modul ini punya isi" dinyatakan
 * **sekali** di sini, sebagai fungsi murni. Panel memakainya untuk daftar
 * sub-itemnya, dan `materi-pane.tsx` memakai `modulPunyaIsi` untuk memutuskan
 * antara merender pane dan merender ringkasan + tautan eksternal. Urutan
 * barisnya (halaman → kuis → lampiran) adalah urutan yang sama dengan urutan
 * bagian di pane; mengubah salah satunya harus mengubah yang lain, dan itu
 * dikunci `silabus.test.ts`.
 *
 * Berkas ini **tidak boleh** menyentuh store atau `node:fs`: ia masuk bundel
 * klien lewat komponen panel. Alasan lengkapnya ada di `blok.ts`.
 */

/** Satu baris isi modul, sudah ternormalisasi untuk ditampilkan. */
export type ItemModul =
  | {
      jenis: "halaman";
      id: string;
      judul: string;
      /** 1-based, sesuai urutan tampil. */
      nomor: number;
      /** Perkiraan menit baca — turunan `jumlahKataHalaman`, bukan data tersimpan. */
      menit: number;
    }
  | {
      jenis: "kuis";
      id: string;
      judul: string;
      jumlahSoal: number;
    }
  | {
      jenis: "lampiran";
      id: string;
      judul: string;
      /** `"video"`/`"pdf"` apa adanya — labelnya dipetakan pemanggil. */
      tipe: Materi["tipe"];
    };

/** Modul yang bisa dibaca berkas ini. */
export interface ModulSeperti {
  /**
   * Bab modul. Sumber halaman satu-satunya.
   *
   * Bertipe `Pick<Modul, "submodul">`-kompatibel secara struktural, tetapi
   * dinyatakan sendiri karena `ModulKursus.submodul` memakai bentuk yang sama —
   * lihat catatan `kuis` di bawah untuk alasan pola ini dipakai.
   */
  submodul?: Submodul[];
  materi?: Materi[];
  /**
   * Kuis yang **sudah diresolusi**, bukan daftar id.
   *
   * Perhatikan `kuis` punya dua arti di repo ini dan keduanya bernama sama:
   * `Modul.kuis` (tersimpan, di `@/types/course`) adalah daftar **id** ke bank
   * soal, sedangkan `ModulKursus.kuis` (hasil `modul-resolver.ts`) adalah daftar
   * **objek** `Kuis`. Berkas ini melayani UI learner, yang hanya pernah melihat
   * bentuk kedua — dan itulah sebabnya type-nya dinyatakan sendiri di sini
   * alih-alih di-`Pick` dari `Modul`: `Pick<Modul, "kuis">` bertipe `string[]`,
   * dan mencampurnya akan menghasilkan panel yang menghitung satu kuis per huruf
   * id. Kompilator memang menolak `Modul` di parameter fungsi ini, dan itu
   * disengaja.
   */
  kuis?: Kuis[];
}

/**
 * Baris isi sebuah modul, dalam urutan bagian: halaman, lalu kuis, lalu lampiran.
 *
 * Urutan itu bukan pilihan baru — ia urutan baca yang sudah berlaku di
 * `materi-pane.tsx` (prosa dulu, asesmen, lampiran), dipindahkan ke satu tempat
 * supaya panel dan pane tidak bisa berbeda.
 *
 * Modul turunan (tanpa `halaman`/`materi`/`kuis`) menghasilkan daftar kosong —
 * itu jawaban yang benar, bukan kegagalan: isinya memang tidak ditulis admin,
 * melainkan tautan ke materi eksternal (`ModulKursus.url`).
 */
export function itemModul(modul: ModulSeperti): ItemModul[] {
  const hasil: ItemModul[] = [];

  // Halaman diratakan dari bab (bukan dari array datar) supaya penomoran
  // "Halaman N" mengikuti urutan baca seluruh modul, bukan urutan per bab.
  halamanModul(modul).forEach((h, index) => {
    hasil.push({
      jenis: "halaman",
      id: h.id,
      judul: h.judul,
      nomor: index + 1,
      menit: perkiraanMenitBaca(h),
    });
  });

  // `modul.kuis` sudah berupa objek hasil resolusi `modul-resolver.ts` (id bank →
  // `Kuis`), bukan daftar id: panel tidak punya akses store, dan mengulang
  // resolusi di klien berarti dua cara menjawab "kuis mana yang terpasang".
  for (const kuis of modul.kuis ?? []) {
    hasil.push({
      jenis: "kuis",
      id: kuis.id,
      judul: kuis.judul,
      jumlahSoal: kuis.soal.length,
    });
  }

  for (const materi of modul.materi ?? []) {
    hasil.push({
      jenis: "lampiran",
      id: materi.id,
      judul: materi.judul,
      tipe: materi.tipe,
    });
  }

  return hasil;
}

/** Jumlah item per jenis — untuk baris meta modul ("2 halaman · 1 kuis"). */
export interface HitunganItem {
  halaman: number;
  kuis: number;
  lampiran: number;
}

export function hitungItem(item: ItemModul[]): HitunganItem {
  const hitung: HitunganItem = { halaman: 0, kuis: 0, lampiran: 0 };
  for (const it of item) hitung[it.jenis] += 1;
  return hitung;
}

/**
 * Apakah modul ini punya isi tersimpan yang bisa dibuka?
 *
 * Ini definisi tunggal untuk dua pemakai: baris modul di silabus memilih
 * "bisa dibentangkan" versus "tautan luar", dan `materi-pane.tsx` memilih
 * "render pane" versus "ringkasan + tautan eksternal". Dua salinan predikat ini
 * akan menyimpang, dan gejalanya adalah baris yang menjanjikan sub-item ke pane
 * yang kosong.
 *
 * Dihitung dari panjang array, bukan dari `itemModul(...).length`: predikat ini
 * tidak butuh judul maupun perkiraan menit, dan menghitung jumlah kata seluruh
 * halaman modul untuk menjawab "ada isi atau tidak" adalah pekerjaan yang tidak
 * diminta.
 */
export function modulPunyaIsi(modul: ModulSeperti): boolean {
  return (
    halamanModul(modul).length > 0 ||
    (modul.kuis?.length ?? 0) > 0 ||
    (modul.materi?.length ?? 0) > 0
  );
}

/**
 * Satu baris halaman di dalam pohon silabus.
 *
 * Bentuk ringkas `ItemModul` versi halaman: panel tidak butuh `jenis` (seluruh
 * isi array ini halaman) maupun jumlah kata per halaman — menit bacanya sudah
 * dihitung sekali di sini.
 */
export interface BarisHalaman {
  id: string;
  judul: string;
  /** 1-based **dalam modul**, bukan dalam babnya — lihat `halamanModul`. */
  nomor: number;
  /** Perkiraan menit baca, turunan jumlah kata. */
  menit: number;
}

/** Satu bab silabus, beserta halamannya yang sudah terurut. */
export interface BabSilabus {
  id: string;
  judul: string;
  ringkasan: string;
  halaman: BarisHalaman[];
}

/**
 * Pohon silabus satu modul: bab → halaman, plus kuis dan lampiran modul.
 *
 * Ini yang dibaca panel silabus untuk menampilkan "modul yang sedang dibuka →
 * daftar babnya → halaman di dalam tiap bab". Dibangun dari **sumber yang sama**
 * dengan `itemModul`, jadi hitungan di baris meta ("2 halaman") tidak bisa
 * berbeda dari jumlah baris yang benar-benar dirender.
 *
 * Nomor halaman dihitung mengikuti urutan seluruh modul (`halamanModul`), bukan
 * `urutan` di dalam bab: peserta melihat "Halaman 4", bukan "halaman 1 dari bab
 * kedua".
 */
export function silabusModul(modul: ModulSeperti): {
  bab: BabSilabus[];
  kuis: ItemModul[];
  lampiran: ItemModul[];
} {
  // Nomor halaman dihitung sekali untuk seluruh modul, lalu dikonsumsi berurutan
  // saat babnya diiterasi — dua loop terpisah akan menghitung nomor dua kali dan
  // berisiko menyimpang pada modul yang salah satu babnya kosong.
  let nomor = 0;

  const bab = submodulUntukModul(modul).map((sub) => ({
    id: sub.id,
    judul: sub.judul,
    ringkasan: sub.ringkasan,
    halaman: halamanSubmodul(sub).map((h) => {
      nomor += 1;
      return {
        id: h.id,
        judul: h.judul,
        nomor,
        menit: perkiraanMenitBaca(h),
      };
    }),
  }));

  const item = itemModul(modul);

  return {
    bab,
    kuis: item.filter((i) => i.jenis === "kuis"),
    lampiran: item.filter((i) => i.jenis === "lampiran"),
  };
}
