import type { InboxJob, ListingJobstreet } from "@/lib/career-ops";
import { jobIdFromUrl } from "@/lib/career-ops/jobstreet-audit";
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
 * punya 246 baris. Satu permintaan per baris adalah 246 permintaan untuk
 * sesuatu yang sebenarnya fungsi murni — ranker deterministik, katalog lokal, dan
 * deskripsi yang sudah ada di cache. Diukur pada korpus nyata: seluruh 246 baris
 * dihitung dalam ~37 ms, jadi ini satu kali kerja server, bukan jaringan.
 *
 * `Map` bukan objek biasa karena kuncinya adalah URL penuh, dan `Map` tidak
 * bisa terpancing ke "__proto__" seperti objek yang dibangun dari input.
 */
export function hitungJumlahKursus(
  baris: InboxJob[],
  katalog: EntriKatalog[],
  cache: Record<string, ListingJobstreet>,
): Map<string, number> {
  const hasil = new Map<string, number>();
  for (const job of baris) {
    const id = jobIdFromUrl(job.url);
    const { kebutuhan } = kebutuhanDariInbox(job, (id ? cache[id] : undefined) ?? null);
    hasil.set(job.url, rekomendasiKursusUntukInbox(katalog, kebutuhan, 3).length);
  }
  return hasil;
}
