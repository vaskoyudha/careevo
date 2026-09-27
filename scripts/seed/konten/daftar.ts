/**
 * Daftar lengkap seed konten — **murni**, tanpa efek samping.
 *
 * Dipisah dari `index.ts` supaya bisa diimpor test tanpa menjalankan seed.
 * `index.ts` yang memanggil `jalankanSeed`; berkas ini hanya merangkai daftar.
 *
 * Pembagian berkas mengikuti kelompok kursus, bukan urutan abjad: kursus inti
 * (`crs-1`…`crs-8`) ditulis penuh (halaman + kuis), sedangkan kursus pasar
 * (18 kursus yang halaman kurasinya sudah ada) hanya dilengkapi kuis.
 */

import type { KursusSeed } from "./tipen";
import { KURSUS_INTI_A } from "./inti-a";
import { KURSUS_INTI_B } from "./inti-b";
import { KURSUS_INTI_C } from "./inti-c";
import { KURSUS_PASAR_A } from "./pasar-a";
import { KURSUS_PASAR_B } from "./pasar-b";
import { KURSUS_PASAR_C } from "./pasar-c";
import { KURSUS_MATERI_A } from "./materi-a";
import { KURSUS_MATERI_B } from "./materi-b";
import { KURSUS_VERIFIKASI } from "./verifikasi";

export const SEMUA_KURSUS_SEED: KursusSeed[] = [
  ...KURSUS_INTI_A,
  ...KURSUS_INTI_B,
  ...KURSUS_INTI_C,
  ...KURSUS_PASAR_A,
  ...KURSUS_PASAR_B,
  ...KURSUS_PASAR_C,
  // Entri fixture r1–r12: diberi id eksplisit supaya menutup entri fixture di
  // `katalogBelajar` (dedup by id) dan punya modul tersimpan sendiri.
  ...KURSUS_MATERI_A,
  ...KURSUS_MATERI_B,
  ...KURSUS_VERIFIKASI,
];
