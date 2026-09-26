"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { ambilLokerById } from "@/lib/jobs/cache";
import { katalogBelajar, type EntriKatalog } from "@/lib/courses/katalog";
import { rekomendasiKursusUntukLoker } from "@/lib/jobs/rekomendasi-kursus";
import { jelaskanKursus } from "@/lib/agents/kursus-loker/alasan";
import { MODULE_LOKER, pointIdLoker, susunJalurLoker } from "@/lib/agents/jalur-loker/jalur";
import { createMasteryTopic, listMasteryTopics } from "@/lib/mastery/store";

/**
 * Persiapan kandidat untuk satu lowongan: kursus yang cocok, dan jalur penguasaan
 * yang disusun dari syarat lowongan itu.
 *
 * Dua aturan berlaku di kedua aksi:
 *
 *  1. **Sesi diperiksa ulang di sini.** Route handler dan server action adalah
 *     endpoint publik; `(app)` yang mengunci halaman tidak bisa diandalkan.
 *  2. **Kegagalan yang berbeda punya bentuk yang berbeda.** Tanpa model, daftar
 *     kursus tetap tampil (yang hilang hanya kalimat "alasan"), karena kursus
 *     itu ditentukan deterministik dan sudah benar. Tanpa model, jalur penguasaan
 *     tidak ada sama sekali, karena poinnya harus dibaca dari deskripsi lowongan.
 *     Menampilkan jalur tebakan akan terlihat seperti rencana yang benar.
 */

export type RekomendasiKursusItem = { entry: EntriKatalog; alasan?: string };

export type RekomendasiState =
  | { ok: true; ringkasan?: string; kursus: RekomendasiKursusItem[] }
  | { ok: false; pesan: string };

export async function rekomendasiKursusLokerAction(
  jobId: string,
): Promise<RekomendasiState> {
  const session = await getSession();
  if (!session) return { ok: false, pesan: "Masuk dulu untuk melihat rekomendasi." };

  const job = await ambilLokerById(jobId);
  if (!job) return { ok: false, pesan: "Loker tidak ditemukan." };

  const katalog = await katalogBelajar();
  const shortlist = rekomendasiKursusUntukLoker(katalog, job, 3);
  if (shortlist.length === 0) return { ok: true, kursus: [] };

  const alasan = await jelaskanKursus(job, shortlist);
  if (!alasan.ok) {
    // The deterministic picks still stand; only the explanation is missing.
    return { ok: true, kursus: shortlist.map((entry) => ({ entry })) };
  }

  const peta = new Map(alasan.hasil.kursus.map((item) => [item.id, item.alasan]));
  return {
    ok: true,
    ringkasan: alasan.hasil.ringkasan || undefined,
    kursus: shortlist.map((entry) => ({ entry, alasan: peta.get(entry.id) })),
  };
}

export type JalurLokerState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; topicId: string };

export async function buatJalurLokerAction(
  _previous: JalurLokerState,
  formData: FormData,
): Promise<JalurLokerState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Masuk dulu untuk membuat jalur." };

  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!jobId) return { status: "error", message: "Loker tidak valid." };

  const job = await ambilLokerById(jobId);
  if (!job) return { status: "error", message: "Loker tidak ditemukan." };
  if (job.sentinel_status === "rejected") {
    return { status: "error", message: "Loker ini ditolak Sentinel." };
  }

  // One active path per posting: a second click opens the existing path rather
  // than creating a duplicate the learner would have to clean up.
  const ada = (await listMasteryTopics(session.email)).find(
    (topic) => topic.status === "active" && topic.jobId === jobId,
  );
  if (ada) return { status: "success", topicId: ada.id };

  const hasil = await susunJalurLoker(job);
  if (!hasil.ok) return { status: "error", message: hasil.pesan };

  const points = hasil.hasil.points.map((poin, index) => ({
    id: pointIdLoker(jobId, index),
    name: poin.name,
    type: poin.type,
    moduleId: MODULE_LOKER(jobId),
  }));

  const created = await createMasteryTopic({
    owner: session.email,
    title: hasil.hasil.title,
    description: hasil.hasil.description,
    jobId,
    points,
  });

  revalidatePath("/belajar/mastery");
  return { status: "success", topicId: created.topic.id };
}
