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
   * Modul yang diselesaikan lewat gerbang sesi terverifikasi.
   *
   * Angka ini hidup di laporan integritas, bukan laporan belajar: ia menyebut
   * **jalur** penyelesaian, bukan hasil belajar. Menaruhnya di sebelah skor
   * belajar hanya mengajak orang menghitung antara keduanya.
   */
  terverifikasi: number;
  /** Total modul tercatat selesai, dipakai sebagai penyebut rasio. */
  selesai: number;
}

/**
 * Gabungkan catatan performa dengan run sesi.
 *
 * Pemilik dari **kedua** sumber dimasukkan, bukan hanya yang punya catatan:
 * peserta yang punya sesi tapi nol modul selesai justru bukti paling berharga
 * bahwa pengumpulan datanya bermasalah, dan dia tidak boleh hilang dari daftar.
 *
 * Kalau nama belum diketahui (hanya ada run), email dipakai apa adanya.
 */
export function barisIntegritas(
  catatan: RecordPerforma[],
  integritas: Map<string, RingkasanIntegritas>,
): BarisIntegritas[] {
  const baris = new Map<string, BarisIntegritas>();

  for (const record of catatan) {
    const isi = integritas.get(record.owner);
    baris.set(record.owner, {
      owner: record.owner,
      nama: record.nama,
      sesi: isi?.sesi ?? 0,
      kejadian: isi?.kejadian ?? 0,
      celah: isi?.celah ?? 0,
      kedaluwarsa: isi?.kedaluwarsa ?? 0,
      terverifikasi: record.kursus.reduce(
        (n, k) => n + k.selesai.filter((s) => s.sumber === "terverifikasi").length,
        0,
      ),
      selesai: record.kursus.reduce((n, k) => n + k.selesai.length, 0),
    });
  }

  for (const [owner, isi] of integritas) {
    if (baris.has(owner)) continue;
    baris.set(owner, {
      owner,
      nama: owner,
      sesi: isi.sesi,
      kejadian: isi.kejadian,
      celah: isi.celah,
      kedaluwarsa: isi.kedaluwarsa,
      terverifikasi: 0,
      selesai: 0,
    });
  }

  return [...baris.values()].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}
