"use server";

import { getSession } from "@/lib/auth/session";
import { katalogBelajar, type EntriKatalog } from "@/lib/courses/katalog";
import { auditBaris, bacaInboxDenganTanggal } from "@/lib/career-ops";
import { jobIdFromUrl } from "@/lib/career-ops/jobstreet-audit";
import { bacaCache } from "@/lib/career-ops/jobstreet-enrich";
import {
  idLokerDariUrl,
  kebutuhanDariInbox,
  labelSumber,
  rekomendasiKursusUntukInbox,
  sebagaiJobFixture,
  type SumberKebutuhan,
} from "@/lib/jobs/persiapan-inbox";
import { jelaskanKursus } from "@/lib/agents/kursus-loker/alasan";
import { MODULE_LOKER, pointIdLoker, susunJalurLoker } from "@/lib/agents/jalur-loker/jalur";
import { createMasteryTopic, listMasteryTopics } from "@/lib/mastery/store";

/**
 * Persiapan untuk satu lowongan hasil pindai: kursus, alasan, dan jalur penguasaan.
 *
 * Ini satu-satunya tempat rekomendasi kursus untuk inbox dibaca. Versi sebelumnya
 * menaruh-nya di dua tempat: expandable kecil di setiap kartu, dan section di
 * popup. Isinya sama, jadi harus diingat untuk diperbarui dua kali. Sekarang
 * jumlahnya hanya di kartu (tip, tanpa jaringan) dan isi lengkapnya di popup.
 *
 * Tiga aturan yang menentukan bentuknya:
 *
 *  1. **Verdict dihitung ulang di server.** Kartu sudah membawa verdict-nya untuk
 *     UI, tapi penjaga jalur tidak boleh bergantung pada apa yangSaid browser.
 *     `auditBaris` menurunkan ulang dari cache, jadi klien yang mengaku "clean"
 *     untuk lowongan yang ditolak tidak bisa membuka jalur.
 *  2. **Kursus deterministik, alasan didekorasi model.** Sama seperti
 *     `rekomendasiKursusLokerAction`: tanpa model, daftar kursus tetap tampil dan
 *     yang hilang hanya kalimat alasannya. Tanpa model, jalur tidak ada sama
 *     sekali, karena poinnya harus dibaca dari deskripsi lowongan.
 *  3. **Satu jalur aktif per lowongan.** Klik kedua membuka jalur yang sudah ada,
 *     bukan membuat duplikat yang harus dibersihkan sendiri.
 */

export type RekomendasiInboxItem = { entry: EntriKatalog; alasan?: string };

export type DetailInboxState =
  | {
      ok: true;
      jobId: string;
      role: string;
      company: string;
      location?: string;
      compensation?: string;
      source?: string;
      status?: "clean" | "quarantined" | "rejected";
      description?: string;
      tags: string[];
      url: string;
      sumber: SumberKebutuhan;
      catatan: string;
      ringkasan?: string;
      kursus: RekomendasiInboxItem[];
      bisaJalur: boolean;
      alasanJalur?: string;
    }
  | { ok: false; pesan: string };

/** Nama papan dibaca dari host URL, dipetakan ke nama yang bisa dibaca orang. */
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

export async function detailLokerInboxAction(url: string): Promise<DetailInboxState> {
  const session = await getSession();
  if (!session) return { ok: false, pesan: "Masuk dulu." };

  const baris = bacaInboxDenganTanggal().find((r) => r.url === url.trim());
  if (!baris) return { ok: false, pesan: "Lowongan tidak ada di inboxmu." };

  // Cache yang rusak adalah cache kosong, bukan error.
  const cache = await bacaCache().catch(() => ({}) as Record<string, never>);

  const status = auditBaris([baris], cache)[0].audit.status;
  const jobId = idLokerDariUrl(baris.url);
  const jobstreetId = jobIdFromUrl(baris.url);
  const { kebutuhan, sumber } = kebutuhanDariInbox(
    baris,
    (jobstreetId ? cache[jobstreetId] : undefined) ?? null,
  );

  const katalog = await katalogBelajar();
  const shortlist = rekomendasiKursusUntukInbox(katalog, kebutuhan, 3);

  let ringkasan: string | undefined;
  let kursus: RekomendasiInboxItem[] = shortlist.map((entry) => ({ entry }));

  if (shortlist.length > 0) {
    const alasan = await jelaskanKursus(sebagaiJobFixture(baris, kebutuhan, status), shortlist);
    if (alasan.ok) {
      const peta = new Map(alasan.hasil.kursus.map((item) => [item.id, item.alasan]));
      ringkasan = alasan.hasil.ringkasan || undefined;
      kursus = shortlist.map((entry) => ({ entry, alasan: peta.get(entry.id) }));
    }
  }

  let bisaJalur = true;
  let alasanJalur: string | undefined;
  if (status === "rejected") {
    bisaJalur = false;
    alasanJalur = "Lowongan ini ditolak Sentinel, jadi jalur tidak disusun.";
  } else {
    const ada = (await listMasteryTopics(session.email)).find(
      (topic) => topic.status === "active" && topic.jobId === jobId,
    );
    if (ada) {
      bisaJalur = false;
      alasanJalur = "Jalur penguasaan untuk lowongan ini sudah ada.";
    }
  }

  return {
    ok: true,
    jobId,
    role: baris.role,
    company: baris.company,
    location: baris.location,
    compensation: baris.compensation,
    source: namaPapan(baris.url),
    status,
    description: kebutuhan.description || undefined,
    tags: kebutuhan.tags,
    url: baris.url,
    sumber,
    catatan: labelSumber(sumber),
    ringkasan,
    kursus,
    bisaJalur,
    alasanJalur,
  };
}

export type JalurInboxState =
  | { status: "idle" }
  | { status: "error"; message: string; detail?: string }
  | { status: "success"; topicId: string; moduleId: string };

/**
 * Susun jalur penguasaan untuk satu lowongan hasil pindai.
 *
 * Cermin `buatJalurLokerAction`. Dua perbedaan yang tidak bisa dihindari: lowongan
 * pindai tidak punya `JobFixture`, jadi jobId-nya adalah hash URL yang stabil; dan
 * barisnya diambil ulang dari disk, bukan dipercaya dari klien.
 */
export async function buatJalurLokerInboxAction(url: string): Promise<JalurInboxState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Masuk dulu untuk membuat jalur." };

  const baris = bacaInboxDenganTanggal().find((r) => r.url === url.trim());
  if (!baris) return { status: "error", message: "Lowongan tidak ada di inboxmu." };

  const cache = await bacaCache().catch(() => ({}) as Record<string, never>);
  const status = auditBaris([baris], cache)[0].audit.status;
  if (status === "rejected") {
    return { status: "error", message: "Lowongan ini ditolak Sentinel." };
  }

  const jobId = idLokerDariUrl(baris.url);
  const jobstreetId = jobIdFromUrl(baris.url);
  const { kebutuhan } = kebutuhanDariInbox(baris, (jobstreetId ? cache[jobstreetId] : undefined) ?? null);

  const ada = (await listMasteryTopics(session.email)).find(
    (topic) => topic.status === "active" && topic.jobId === jobId,
  );
  if (ada) return { status: "success", topicId: ada.id, moduleId: MODULE_LOKER(jobId) };

  const hasil = await susunJalurLoker(sebagaiJobFixture(baris, kebutuhan, status));
  if (!hasil.ok) {
    return { status: "error", message: hasil.pesan, detail: hasil.detail };
  }

  // `type` dan `moduleId` wajib di `KnowledgePoint`: `type` datang dari skema
  // jalur (sudah divalidasi model), `moduleId` mengelompokkan poin di bawah satu
  // modul sintetis supaya id-nya tidak bertabrakan dengan kursus lain.
  const points = hasil.hasil.points.map((poin, index) => ({
    id: pointIdLoker(jobId, index),
    name: poin.name,
    type: poin.type,
    moduleId: MODULE_LOKER(jobId),
  }));
  const bundle = await createMasteryTopic({
    owner: session.email,
    title: hasil.hasil.title,
    description: hasil.hasil.description,
    jobId,
    points,
  });
  return { status: "success", topicId: bundle.topic.id, moduleId: MODULE_LOKER(jobId) };
}
