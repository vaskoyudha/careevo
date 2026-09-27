"use server";

import { getSession } from "@/lib/auth/session";
import { katalogBelajar, type EntriKatalog } from "@/lib/courses/katalog";
import { bacaInboxDenganTanggal } from "@/lib/career-ops";
import { jobIdFromUrl } from "@/lib/career-ops/jobstreet-audit";
import { bacaCache } from "@/lib/career-ops/jobstreet-enrich";
import {
  kebutuhanDariInbox,
  labelSumber,
  rekomendasiKursusUntukInbox,
  type SumberKebutuhan,
} from "@/lib/jobs/persiapan-inbox";

/**
 * Kursus yang menyiapkan untuk SATU lowongan hasil pindai.
 *
 * Tumpukan ini_read-only_ dan tidak menulis apa pun. Yang membedakannya dari
 * `rekomendasiKursusLokerAction` adalah bentuk lowongannya: yang itu memakai
 * `JobFixture` dari katalog fixture, yang ini memakai baris scanner yang tidak
 * punya `id` maupun `description`. Lihat `lib/jobs/persiapan-inbox.ts` untuk
 * adapter-nya.
 *
 * Tiga aturan, semuanya soal jujur:
 *
 *  1. **Sesi diperiksa di sini.** `InboxList` memang berada di dalam `(app)`,
 *     tapi server action adalah endpoint publik — layout yang mengunci halaman
 *     bukan penjaga.
 *  2. **Hanya baris milik akun.** Baris dibaca dari `pipeline.md` milik data
 *     root akun ini, dan `url` harus benar-benar ada di sana. Menerima `url`
 *     dari klien tanpa memeriksanya akan membuat endpoint ini membaca lowongan
 *     milik siapa pun yang menebak URL.
 *  3. **Deskripsi yang tidak bisa diambil tetap menghasilkan rekomendasi, tapi
 *     dari judul saja — dan panel mengatakannya.** Kursus ditentukan
 *     deterministik, jadi tidak adanya alasan bukan alasan untuk menyembunyikan
 *     daftar; yang hilang hanya beberapa bukti pendukungnya.
 */

export type RekomendasiInboxItem = { entry: EntriKatalog };

export type RekomendasiInboxState =
  | { ok: true; sumber: SumberKebutuhan; catatan: string; kursus: RekomendasiInboxItem[] }
  | { ok: false; pesan: string };

export async function rekomendasiKursusInboxAction(
  url: string,
): Promise<RekomendasiInboxState> {
  const session = await getSession();
  if (!session) return { ok: false, pesan: "Masuk dulu untuk melihat rekomendasi." };

  // Normalisasi dulu supaya `pipeline.md` dibandingkan dengan bentuk yang sama.
  const target = url.trim();
  if (!target) return { ok: false, pesan: "Lowongan tidak dikenal." };

  const baris = bacaInboxDenganTanggal().find((r) => r.url === target);
  if (!baris) return { ok: false, pesan: "Lowongan tidak ada di inboxmu." };

  // Daftar yang terambil sudah di-cache oleh `bacaInboxDiaudit`; di sini hanya
  // dibaca. Cache yang rusak adalah cache kosong, bukan error — `bacaCache`
  // sudah begitu, tapi `.catch` menjaga jalur ini bebas dari kegagalan I/O.
  const jobId = jobIdFromUrl(baris.url);
  const cache = await bacaCache().catch(() => ({}) as Record<string, never>);
  const listing = jobId ? cache[jobId] : undefined;

  const { kebutuhan, sumber } = kebutuhanDariInbox(baris, listing ?? null);

  const katalog = await katalogBelajar();
  const shortlist = rekomendasiKursusUntukInbox(katalog, kebutuhan, 3);

  return {
    ok: true,
    sumber,
    catatan: labelSumber(sumber),
    kursus: shortlist.map((entry) => ({ entry })),
  };
}

/**
 * Nama papan dibaca dari host URL-nya.
 *
 * Dipetakan ke label yang bisa dibaca orang, bukan hostname mentah:
 * `id.jobstreet.com` → "Jobstreet", `apply.workable.com` → "Workable".
 * Host yang tidak dikenal jatuh ke hostname-nya sendiri — lebih baik teknis
 * daripada menebak nama papan yang salah.
 */
const PAPAN_DARI_HOST: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|\.)jobstreet\./i, "Jobstreet"],
  [/(^|\.)seek\./i, "SEEK"],
  [/(^|\.)glints\./i, "Glints"],
  [/(^|\.)workable\.com$/i, "Workable"],
  [/(^|\.)breezy\.hr$/i, "Breezy"],
  [/(^|\.)smartrecruiters\.com$/i, "SmartRecruiters"],
  [/(^|\.)ashbyhq\.com$/i, "Ashby"],
  [/(^|\.)greenhouse\.io$/i, "Greenhouse"],
  [/(^|\.)lever\.co$/i, "Lever"],
  [/(^|\.)myworkdayjobs\.com$/i, "Workday"],
];

function namaPapan(url: string): string | undefined {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return undefined;
  }
  for (const [pola, nama] of PAPAN_DARI_HOST) {
    if (pola.test(host)) return nama;
  }
  return host;
}

export type DetailInboxState =
  | {
      ok: true;
      role: string;
      company: string;
      location?: string;
      compensation?: string;
      source?: string;
      status?: "clean" | "quarantined" | "rejected";
      description?: string;
      tags: string[];
      url: string;
      catatan: string;
      kursus: RekomendasiInboxItem[];
    }
  | { ok: false; pesan: string };

/**
 * Detail satu lowongan hasil pindai, untuk popup.
 *
 * **Yang TIDAK di sini, dan itu disengaja:** `fitScore`, `domainAge`,
 * `pipeline`, `activities`. Semuanya milik fixture `FEATURED_ROLES`, dan tidak
 * ada satu pun yang bisa dihitung untuk baris pindai tanpa model atau tanpa
 * verifikasi domain. Mengisi placeholder-nya berarti keputusan yang
 * dipinjam dari lowongan lain.
 */
export async function detailLokerInboxAction(url: string): Promise<DetailInboxState> {
  const session = await getSession();
  if (!session) return { ok: false, pesan: "Masuk dulu." };

  const target = url.trim();
  const baris = bacaInboxDenganTanggal().find((r) => r.url === target);
  if (!baris) return { ok: false, pesan: "Lowongan tidak ada di inboxmu." };

  const jobId = jobIdFromUrl(baris.url);
  const cache = await bacaCache().catch(() => ({}) as Record<string, never>);
  const listing = jobId ? cache[jobId] : undefined;

  const { kebutuhan, sumber } = kebutuhanDariInbox(baris, listing ?? null);
  const katalog = await katalogBelajar();
  const shortlist = rekomendasiKursusUntukInbox(katalog, kebutuhan, 3);

  return {
    ok: true,
    role: baris.role,
    company: baris.company,
    location: baris.location,
    compensation: baris.compensation,
    source: namaPapan(baris.url),
    description: kebutuhan.description || undefined,
    tags: kebutuhan.tags,
    url: baris.url,
    catatan: labelSumber(sumber),
    kursus: shortlist.map((entry) => ({ entry })),
  };
}
