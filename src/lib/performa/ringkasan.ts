import type { RecordPerforma } from "@/lib/performa/store";
import type { RingkasanIntegritas } from "@/lib/performa/integritas";

/**
 * Turunan baris untuk dua laporan yang **sengaja dipisah**.
 *
 * Modul belajar dan catatan integritas menjawab pertanyaan berbeda dan dipakai
 * untuk keputusan berbeda, jadi keduanya tidak pernah dirender bersama. Fungsi
 * ini ada supaya penggabungannya murni dan bisa diuji tanpa browser — dan
 * supaya "pemecahan" itu benar-benar terjadi di data, bukan hanya di tampilan.
 */

export interface BarisPembelajaran {
  owner: string;
  nama: string;
  /** Total modul tercatat selesai, apa pun jalurnya. */
  selesai: number;
  /**
   * Berapa di antaranya yang diselesaikan lewat gerbang sesi terverifikasi.
   *
   * Angka ini **ikut** di laporan belajar, bukan di laporan integritas: ia hanya
   * bermakna sebagai bagian dari penyebutnya. "3 dari 10" terpisah dari "10" akan
   * dibaca sebagai proporsi, dan proporsi itulah yang membuat orang menghitung
   * sendiri antara kedua laporan.
   */
  terverifikasi: number;
  /**
   * Rata-rata skor kuis, atau `null` bila belum ada nilai.
   *
   * `null` bukan `0`: "belum ada data" dan "nilai nol" adalah dua klaim berbeda,
   * dan tabel harus bisa membedakannya.
   */
  rataRataKuis: number | null;
}

export function barisPembelajaran(catatan: RecordPerforma[]): BarisPembelajaran[] {
  return catatan
    .map((record) => {
      const nilai = record.kursus.flatMap((k) => k.kuis.map((q) => q.nilai));
      return {
        owner: record.owner,
        nama: record.nama,
        selesai: record.kursus.reduce((n, k) => n + k.selesai.length, 0),
        terverifikasi: record.kursus.reduce(
          (n, k) => n + k.selesai.filter((s) => s.sumber === "terverifikasi").length,
          0,
        ),
        rataRataKuis:
          nilai.length === 0
            ? null
            : Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length),
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

export interface BarisIntegritas {
  owner: string;
  nama: string;
  sesi: number;
  kejadian: number;
  celah: number;
  kedaluwarsa: number;
  /**
   * Jumlah sinyal **berasal kamera** di seluruh sesi pemilik ini.
   *
   * Ada di sini karena tabel daftar sebelumnya menulis "kamera: tidak ada"
   * sebagai teks tetap — sebuah klaim yang tidak membaca data apa pun dan
   * karenanya salah untuk setiap peserta yang kamera-nya memang menyala.
   * Menulis keadaan tanpa memeriksanya lebih buruk daripada tidak menulis.
   *
   * Ini tetap **fakta sesi**, bukan metrik belajar: daftar field di test
   * mengunci bahwa tidak ada metrik belajar yang boleh masuk ke laporan
   * integritas, dan sinyal kamera bukan hasil belajar.
   */
  kamera: number;
}

/**
 * Baris laporan integritas.
 *
 * Sumbernya **hanya** ringkasan sesi. Fungsi ini menerima peta nama, bukan
 * `RecordPerforma[]`, karena nama adalah identitas sedangkan yang lain adalah
 * metrik — dan tidak ada metrik belajar yang boleh masuk ke sini.
 *
 * Dulu parameternya catatan performa dan barisnya membawa `selesai` serta
 * `terverifikasi`. Angka itu menampilkan "3 / 10" di laporan integritas:
 * `selesai` adalah hasil belajar, dan `3` dibanding `10` di halaman sebelah
 * cukup untuk membuat orang menarik kesimpulan sendiri. Komentarnya sendiri yang
 * memperingatkan hal itu, sementara kodenya melakukannya.
 *
 * Owners pun hanya diambil dari peta sesi. Pemilik yang belum punya sesi tidak
 * punya apa pun untuk dilaporkan di sini, dan menyertakannya berarti tabel
 * temuan menampilkan ketiadaan data seolah-olah ia data.
 */
export function barisIntegritas(
  nama: ReadonlyMap<string, string>,
  integritas: Map<string, RingkasanIntegritas>,
): BarisIntegritas[] {
  return [...integritas.entries()]
    .map(([owner, isi]) => ({
      owner,
      nama: nama.get(owner) ?? owner,
      sesi: isi.sesi,
      kejadian: isi.kejadian,
      celah: isi.celah,
      kedaluwarsa: isi.kedaluwarsa,
      // Dijumlahkan dari `perAsal` tiap sesi, bukan dari daftar kejadian mentah:
      // `perAsal` sudah memakai aturan yang sama dengan label di halaman detail,
      // termasuk baris lama yang `asal`-nya diturunkan dari jenisnya.
      kamera: isi.daftar.reduce((n, s) => n + s.perAsal.kamera, 0),
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}
