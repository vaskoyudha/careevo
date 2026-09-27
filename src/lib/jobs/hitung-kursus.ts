import type { InboxJob } from "@/lib/career-ops";
import { normalisasiKunciUrl } from "@/lib/career-ops";
import type { IsiCache } from "@/lib/career-ops/job-cache";
import type { EntriKatalog } from "@/lib/courses/katalog";
import {
  kebutuhanDariInbox,
  rekomendasiKursusUntukInbox,
} from "@/lib/jobs/persiapan-inbox";

/**
 * Berapa kursus katalog yang cocok untuk tiap baris inbox.
 *
 * Dipakai untuk lencana "N kursus" di kartu, supaya seorang pembelajar bisa
 * melihat lowongan mana yang punya persiapan tersedia SEBELUM membuka popup.
 *
 * Kenapa tidak diambil dari klien lewat server action per kartu: daftar lengkap
 * punya ratusan baris. Satu permintaan per baris adalah ratusan permintaan untuk
 * sesuatu yang sebenarnya fungsi murni — ranker deterministik, katalog lokal, dan
 * deskripsi yang sudah ada di cache. Diukur pada korpus nyata: seluruh baris
 * dihitung dalam puluhan milidetik, jadi ini satu kali kerja server, bukan
 * jaringan.
 *
 * `Map` bukan objek biasa karena kuncinya adalah URL penuh, dan `Map` tidak
 * bisa terpancing ke "__proto__" seperti objek yang dibangun dari input.
 */
export function hitungJumlahKursus(
  baris: InboxJob[],
  katalog: EntriKatalog[],
  cache: IsiCache,
): Map<string, number> {
  const hasil = new Map<string, number>();
  for (const job of baris) {
    const kunci = normalisasiKunciUrl(job.url);
    const { kebutuhan } = kebutuhanDariInbox(job, (kunci ? cache[kunci] : undefined) ?? null);
    hasil.set(job.url, rekomendasiKursusUntukInbox(katalog, kebutuhan, 3).length);
  }
  return hasil;
}
