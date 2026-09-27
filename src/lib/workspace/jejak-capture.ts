import { prosesManajer } from "./proses-manajer";
import { ringkasBerkas } from "./snapshot";
import { tambahSnapshot } from "./jejak-store";
import type { MintaWorkspace, PortWorkspace } from "./port";
import type { SnapshotProses } from "./proses";

/**
 * Pengambilan jejak proses ruang kerja — **server-only**.
 *
 * ## Kenapa ada jendela waktu
 *
 * Capture memanggil `find` **di dalam kontainer**, jadi setiap capture adalah satu
 * proses container yang lahir lalu mati. Halaman ruang kerja melakukan `status`
 * secara berkala, jadi tanpa pagar waktu satu sesi lima menit bisa membangkitkan
 * puluhan proses `find` — dan jejaknya sendiri jadi didominasi baris identik,
 * yang tidak membawa informasi apa pun.
 *
 * `JENDELA_JEJAK_MS` (default 5 menit) karena itu adalah pagar keras per ruang
 * kerja. Yang **tidak** dikembalikan ke jalur HTTP adalah "saya menulis atau
 * tidak": itu hanya relevan untuk test dan diagnostik.
 *
 * ## Capture tidak pernah gagalkan alur
 *
 * Semua masalah ditelan. Jejak adalah bukti pelengkap; ruang kerja yang gagal
 * dibuka karena `find` kelambatan adalah kegagalan yang jauh lebih mahal daripada
 * satu snapshot yang telat.
 */

/** Jendela minimum antar capture untuk satu ruang kerja. */
export const JENDELA_JEJAK_MS = 5 * 60_000;

/**
 * Waktu capture terakhir per ruang kerja, di memori proses.
 *
 * **Sengaja hanya di memori.** Menyimpannya ke disk berarti satu I/O extra pada
 * setiap request hanya untuk membaca satu angka, dan kehilangan catatan ini
 * setelah restart hanya menyebabkan satu capture tambahan — yang memang
 * semestinya terjadi setelah restart.
 */
const terakhirCapture = new Map<string, number>();

/** Kunci satu ruang kerja; `courseId` ikut supaya dua course tidak saling menimpa. */
function kunci(userId: string, courseId: string): string {
  return `${userId}\u0000${courseId}`;
}

/** Opsi internal — `port` disuntikkan supaya test tidak menjalankan kontainer. */
export interface OpsiCatatJejak {
  sekarang?: number;
  jendelaMs?: number;
  /** Default `prosesManajer`. Hanya diganti oleh test. */
  port?: Pick<PortWorkspace, "daftarBerkas">;
}

/**
 * Kalau sudah waktunya, ambil daftar berkas dan simpan.
 *
 * Mengembalikan `true` hanya kalau benar-benar ada baris tersimpan.
 */
export async function catatJejakSekarang(
  userId: string,
  courseId: string,
  opsi: OpsiCatatJejak = {},
): Promise<boolean> {
  const sekarang = opsi.sekarang ?? Date.now();
  const jendela =
    typeof opsi.jendelaMs === "number" && opsi.jendelaMs > 0
      ? opsi.jendelaMs
      : JENDELA_JEJAK_MS;

  const k = kunci(userId, courseId);
  const lalu = terakhirCapture.get(k);
  if (lalu !== undefined && sekarang - lalu < jendela) return false;

  // Dicatat **sebelum** I/O: kalau `find` lambat, request berikutnya tidak akan
  // ikut membangkitkan prosesnya sendiri. Trade-offnya satu capture bisa hilang
  // kalau proses mati di tengah jalan — jauh lebih murah daripada yang lain.
  terakhirCapture.set(k, sekarang);

  try {
    const minta: MintaWorkspace = { userId, courseId };
    const mentah = await (opsi.port ?? prosesManajer).daftarBerkas(minta);

    // `null` berarti daftar tidak bisa diambil (ruang kerja mati atau manajer
    // tidak tersedia). Itu "tidak diamati", **bukan** "tidak ada berkasnya" —
    // jadi tidak boleh ditulis sebagai snapshot kosong, yang akan menghapus
    // jejaknya.
    if (mentah === null) return false;

    const snap: SnapshotProses = {
      at: new Date(sekarang).toISOString(),
      ringkasan: ringkasBerkas(mentah),
    };
    return await tambahSnapshot(userId, courseId, snap);
  } catch {
    return false;
  }
}

/** Bersihkan cache capture. Untuk test dan untuk lifecycle yang perlu. */
export function resetJejak(): void {
  terakhirCapture.clear();
}