"use server";

/**
 * inbox.ts — run the Portal Scanner on behalf of the signed-in user, and explain
 * a zero.
 *
 * Read-only with respect to the user's own application data. The engine appends
 * to `data/pipeline.md`; nothing is submitted anywhere, and no application or
 * tracker row is created by this action. A posting is opened on its own site by
 * a human, who then decides whether to track it.
 *
 * A server action is a public endpoint, so the session check lives here and not
 * only in the `(app)` layout that renders the page.
 */

import { getSession } from "@/lib/auth/session";
import {
  bacaInbox,
  bacaRiwayatScan,
  bootstrapCareerOps,
  jalankanScan,
} from "@/lib/career-ops";

export interface HasilScanAction {
  ok: boolean;
  pesan: string;
  /** Postings appended by this run, so the UI can say "9 lowongan baru". */
  ditambah: number;
  /**
   * Why a run that found nothing returned nothing. Empty when something was
   * added. Without this the user sees "0 lowongan" and cannot tell a dead
   * provider from a filter that rejected everything.
   */
  diagnosa: string[];
  /** A board that could not be reached, named. */
  boardGagal: string[];
}

function angka(n: number | undefined): string {
  return (n ?? 0).toLocaleString("id-ID");
}

export async function jalankanScanAction(): Promise<HasilScanAction> {
  const session = await getSession();
  if (!session) {
    return { ok: false, pesan: "Sesi tidak ditemukan.", ditambah: 0, diagnosa: [], boardGagal: [] };
  }

  try {
    bootstrapCareerOps();
  } catch {
    return {
      ok: false,
      pesan: "Data root career-ops tidak bisa disiapkan.",
      ditambah: 0,
      diagnosa: [],
      boardGagal: [],
    };
  }

  const sebelum = bacaInbox().length;
  const hasil = await jalankanScan({ since: 30 });
  const ditambah = Math.max(0, bacaInbox().length - sebelum);

  if (!hasil.ok) {
    return {
      ok: false,
      pesan: hasil.stderr.trim() || "Scan gagal dijalankan.",
      ditambah: 0,
      diagnosa: [],
      boardGagal: [],
    };
  }

  const run = hasil.hasil;
  const boardGagal = (run?.errors ?? []).map((e) => e.company);

  // Attribute a zero with the engine's own counters. Ordered so the biggest
  // explanation reads first — a user needs the dominant cause, not all eleven.
  const cari: string[] = [];
  const ledger = bacaRiwayatScan().at(-1);
  if (ditambah === 0) {
    if (ledger) {
      if (ledger.errors > 0) cari.push(`${angka(ledger.errors)} papan gagal dijangkau.`);
      if (ledger.filteredTitle > 0) {
        cari.push(`${angka(ledger.filteredTitle)} dibuang karena judulnya tidak cocok.`);
      }
      if (ledger.filteredPostedDate > 0) {
        cari.push(`${angka(ledger.filteredPostedDate)} sudah terlalu lama (>30 hari).`);
      }
      if (ledger.filteredLocation > 0) {
        cari.push(`${angka(ledger.filteredLocation)} dibuang oleh filter lokasi.`);
      }
      if (ledger.filteredSalary > 0) cari.push(`${angka(ledger.filteredSalary)} di bawah target gaji.`);
      if (ledger.dupes > 0) cari.push(`${angka(ledger.dupes)} duplikat dari scan sebelumnya.`);
      if (cari.length === 0) {
        cari.push(
          `${angka(ledger.companies)} perusahaan dan ${angka(ledger.boards)} papan discan, tidak ada yang cocok.`,
        );
      }
    } else {
      cari.push("Engine tidak menulis riwayat scan, jadi penyebabnya tidak diketahui.");
    }
  }

  return {
    ok: true,
    pesan:
      ditambah > 0
        ? `${angka(ditambah)} lowongan baru ditemukan.`
        : "Tidak ada lowongan baru.",
    ditambah,
    diagnosa: cari,
    boardGagal,
  };
}
