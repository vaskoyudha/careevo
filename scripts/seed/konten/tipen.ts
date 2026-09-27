/**
 * Tipe dan pembantu blok untuk seed konten kursus.
 *
 * Berkas ini **murni** (tanpa I/O, tanpa store) supaya berkas konten
 * (`konten/*.ts`) hanya perlu mengimpornya dan tidak pernah menyentuh
 * `node:fs`. Engine yang menyentuh store ada di `engine.ts`.
 *
 * Blok yang dihasilkan di sini adalah `BlokInput` — bentuk yang diterima
 * `createHalaman`/`updateHalaman`. `id` blok sengaja dikosongkan: store yang
 * memberinya lewat `idBaru("blk")`, dan engine memberi prefiks stabil supaya
 * tautan `#anchor` tidak putus saat skrip dijalankan ulang.
 */

import type { BlokInput } from "@/types/course";
import type { Level, Track } from "@/types/domain";

// ---------------------------------------------------------------------------
// Pembantu blok
// ---------------------------------------------------------------------------

export const p = (teks: string): BlokInput => ({ tipe: "paragraf", segmen: [{ teks }] });

export const h2 = (teks: string): BlokInput => ({ tipe: "heading", level: 2, segmen: [{ teks }] });

export const h3 = (teks: string): BlokInput => ({ tipe: "heading", level: 3, segmen: [{ teks }] });

export const li = (...butir: string[]): BlokInput => ({
  tipe: "daftar",
  butir: butir.map((teks) => [{ teks }]),
});

export const q = (teks: string): BlokInput => ({ tipe: "kutipan", segmen: [{ teks }] });

export interface KodeSeed {
  kode: string;
  /** `false`/absen = blok tampil tanpa tombol Jalankan (fail-closed). */
  dapatDijalankan?: boolean;
  stdin?: string;
  /** Wajib bila `dapatDijalankan: true` — dan **harus** diverifikasi runner. */
  outputHarapan?: string;
}

/** Blok kode C++. Hanya bahasa ini yang bisa dikompilasi runner hari ini. */
export const kode = (seed: KodeSeed): BlokInput => ({
  tipe: "kode",
  bahasa: "cpp",
  dapatDijalankan: seed.dapatDijalankan === true,
  kode: seed.kode,
  ...(seed.stdin !== undefined ? { stdin: seed.stdin } : {}),
  ...(seed.outputHarapan !== undefined ? { outputHarapan: seed.outputHarapan } : {}),
});

// ---------------------------------------------------------------------------
// Bentuk seed
// ---------------------------------------------------------------------------

export interface SoalSeed {
  pertanyaan: string;
  /** Minimal 2, tanpa duplikat. */
  pilihan: string[];
  /** Indeks ke `pilihan`. */
  jawaban_benar: number;
}

export interface KuisSeed {
  judul: string;
  deskripsi?: string;
  /** Ambang lulus 0–100. Absen = 70. */
  nilai_lulus?: number;
  soal: SoalSeed[];
}

export interface HalamanSeed {
  judul: string;
  blok: BlokInput[];
}

export interface ModulSeed {
  judul: string;
  ringkasan: string;
  durasi_min: number;
  /**
   * Halaman modul. **Absen** = halaman yang sudah ada tidak disentuh (dipakai
   * untuk kursus yang sudah punya halaman dan hanya perlu dilengkapi kuis).
   * Ada = halaman di-upsert per judul; halaman lain yang tidak disebut tetap
   * dibiarkan (tidak pernah dihapus oleh seed ini).
   */
  halaman?: HalamanSeed[];
  /** Satu kuis per modul. Idempoten lewat judul kuis. */
  kuis?: KuisSeed;
}

export interface KursusSeed {
  /**
   * Id kursus eksplisit. Dipakai untuk **menutup entri fixture** `r1`–`r12`:
   * kursus store dengan id yang sama membuat `katalogBelajar` membuang fixture
   * itu (dedup by id) dan `getCourseById` menemukan modul tersimpannya.
   */
  id?: string;
  slug: string;
  judul: string;
  deskripsi: string;
  tags: string[];
  level: Level;
  track: Track;
  provider?: string;
  /** Absen = jumlah durasi modul. */
  durasi_min?: number;
  /**
   * Status katalog. Absen = **pertahankan status kursus yang sudah ada**
   * (kursus baru jatuh ke `published`). Ini penting supaya seed yang hanya
   * melengkapi konten tidak diam-diam mempublikasikan kursus yang sengaja
   * masih `draft`.
   */
  status?: "published" | "draft" | "archived";
  modul: ModulSeed[];
}
