/* -------------------------------------------------------------------------
 * Data isi tabel perbandingan.
 *
 * ATURAN ISI (jangan diisi asal):
 *
 * 1. Setiap `label` adalah fakta yang bisa dicek di produk publik platform
 *    tersebut, bukan penilaian rasa.
 * 2. `belum` = "tidak ditemukan" saat diperiksa. BUKAN "mereka tidak punya".
 * 3. `na` = kategori tidak berlaku. Karir.com bukan platform belajar, jadi
 *    tidak bisa diminta "tidak punya mentor".
 *
 * Angka harga di baris "Biaya" adalah harga DAFTAR, bukan harga promo, supaya
 * perbandingannya tidak tidak adil. Sumber & tanggal ada di catatan kaki
 * komponen (`comparison.tsx`).
 * ------------------------------------------------------------------------- */

import { HARGA, rupiah } from "@/lib/pricing";

export type Status = "ya" | "tidak" | "sebagian" | "belum" | "na";

/** Sel boleh berupa `Status` (ikon) atau string bebas (mis. harga). */
export type Sel = Status | string;

export type Baris = {
  label: string;
  note?: string;
  careevo: Sel;
  dicoding: Sel;
  detik: Sel;
  skill: Sel;
};

export type Kelompok = {
  judul: string;
  baris: Baris[];
};

export type Key = "careevo" | "dicoding" | "detik" | "skill";

export const PLATFORM: { key: Key; label: string; sub: string; ours?: boolean }[] = [
  { key: "careevo", label: "Careevo", sub: "Belajar + lowongan", ours: true },
  { key: "dicoding", label: "Dicoding", sub: "Kelas & bootcamp" },
  { key: "detik", label: "Karir.com", sub: "Job board" },
  { key: "skill", label: "Skill Academy", sub: "Kelas online" },
];

/** Teks yang dibaca screen reader untuk tiap ikon. */
export const SR: Record<Status, string> = {
  ya: "Ada",
  tidak: "Tidak ada",
  sebagian: "Sebagian",
  belum: "Belum ditemukan",
  na: "Tidak berlaku",
};

export const KELOMPOK: Kelompok[] = [
  {
    judul: "Bukti & kredensial",
    baris: [
      {
        label: "Sertifikat dicek lewat tautan publik",
        note: "Tanpa bikin akun, tanpa minta kode",
        careevo: "ya",
        dicoding: "belum",
        detik: "na",
        skill: "tidak",
      },
      {
        label: "Sertifikat bisa dicabut kalau disalahgunakan",
        careevo: "ya",
        dicoding: "belum",
        detik: "na",
        skill: "belum",
      },
      {
        label: "Bukti tiap materi, bukan cuma status 100% selesai",
        note: "Sesi terverifikasi dan rekaman kuis ikut tersimpan",
        careevo: "ya",
        dicoding: "belum",
        detik: "na",
        skill: "tidak",
      },
    ],
  },
  {
    judul: "Cara belajar",
    baris: [
      {
        label: "Bebas atur kecepatan sendiri",
        note: "Tidak ada cohort, tidak ada absensi harian",
        careevo: "ya",
        dicoding: "tidak",
        detik: "na",
        skill: "ya",
      },
      {
        label: "Dinilai manusia dengan rubrik yang sama",
        careevo: "ya",
        dicoding: "ya",
        detik: "na",
        skill: "sebagian",
      },
      {
        label: "Tutor AI 1-on-1 kapan saja",
        careevo: "ya",
        dicoding: "belum",
        detik: "na",
        skill: "belum",
      },
      {
        label: "Jalur belajar dari lowongan yang kamu incar",
        careevo: "ya",
        dicoding: "belum",
        detik: "na",
        skill: "belum",
      },
    ],
  },
  {
    judul: "Lowongan & karier",
    baris: [
      {
        label: "Papan lowongan kerja",
        careevo: "ya",
        dicoding: "tidak",
        detik: "ya",
        skill: "sebagian",
      },
      {
        label: "Audit lowongan: deteksi biaya & penipuan",
        note: "Diberi label sebelum kamu melamar",
        careevo: "ya",
        dicoding: "tidak",
        detik: "belum",
        skill: "belum",
      },
      {
        label: "Rekomendasi kursus dari lowongan yang dibuka",
        careevo: "ya",
        dicoding: "belum",
        detik: "belum",
        skill: "belum",
      },
    ],
  },
  {
    judul: "Biaya & akses",
    baris: [
      {
        label: "Paket gratis yang bisa dicoba utuh",
        note: "Akses ke fitur inti, bukan cuplikan",
        careevo: "ya",
        dicoding: "sebagian",
        detik: "ya",
        skill: "ya",
      },
      {
        label: "Biaya yang harus kamu tanggung",
        note: "Harga daftar, bukan harga promo",
        careevo: `Rp0 - ${rupiah(HARGA.plusBulanan)}/bulan`,
        dicoding: "Rp1.500.000 / bulan",
        detik: "Rp0",
        skill: "Harga per kelas",
      },
    ],
  },
];
