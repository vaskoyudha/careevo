/**
 * Menjembatani satu course Careevo ke course-nya di AI Mastery.
 *
 * AI Mastery (aplik DeepTutor yang di-frame di `/ai-mastery`) punya store course
 * sendiri. Capability `course_study` hanya aktif bila capability itu dan sebuah
 * id course yang tervalidasi terikat ke giliran
 * (`deeptutor/capabilities/course_study/capability.py`, `is_active`), dan
 * backend membuang id yang tidak dikenal tanpa suara
 * (`request_preparer.py`).
 *
 * AI Mastery membuat id sendiri (`course_<hex>`) dan `POST /api/courses` tidak
 * menerima id dari pemanggil. Jadi `courses.id` Careevo tidak pernah bisa jadi
 * id sana; pasangannya disimpan di `courses.ai_course_id`.
 *
 * Yang dialihkan hanya silabus: judul modul Careevo menjadi unit silabus, yang
 * membuat `course_study` punya denominator ("3 dari 5 unit") alih-alih kursus
 * kosong. Jalur mastery, bank soal, dan posisi baca milik AI Mastery dan terisi
 * dari pemakaian peserta di sana, bukan dari CMS Careevo.
 *
 * Fail-soft dengan sengaja. Basis URL kosong, AI Mastery mati, atau jaringan
 * tidak hidup: fungsi mengembalikan `null` dan halaman tetap tampil. Tutor
 * adalah tambahan; menjatuhkan halaman kursus karena mesin lain down jauh lebih
 * buruk daripada tutor yang datang tanpa konteks.
 */

import "server-only";

import { eq } from "drizzle-orm";
import { denganTransaksi, getDb } from "@/lib/db/client";
import { courses } from "@/lib/db/schema";

/**
 * Basis API AI Mastery, bukan basis web-nya di `AI_MASTERY_WEB_URL`.
 *
 * Kosong secara default: tanpa konfigurasi eksplisit tidak ada bridging, dan
 * UI jatuh ke perilaku lama. Default kosong ini membuat repo ini tidak pernah
 * diam-diam menulis ke store course milik mesin lain.
 */
export const AI_MASTERY_API_URL = process.env.AI_MASTERY_API_URL ?? "";

class StatusGagal extends Error {
  constructor(readonly status: number) {
    super(`ai-mastery -> ${status}`);
  }
}

async function panggil(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${AI_MASTERY_API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new StatusGagal(res.status);
  return res.json();
}

function bacaId(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const id = (payload as { course?: { id?: unknown } }).course?.id;
  return typeof id === "string" ? id : "";
}

/** Cari id yang sudah ada untuk sebuah nama, untuk melanjutkan setelah 409. */
async function cariIdByNama(nama: string): Promise<string> {
  const payload = await panggil("/api/courses");
  const daftar = (payload as { courses?: unknown })?.courses;
  if (!Array.isArray(daftar)) return "";
  const cocok = daftar.find(
    (item): item is { id: string; name: string } =>
      typeof item === "object" &&
      item !== null &&
      (item as { name?: unknown }).name === nama,
  );
  return cocok?.id ?? "";
}

/**
 * Pastikan ada course AI Mastery yang mewakili `courseId`, lalu kembalikan id-nya.
 *
 * Hanya dipanggil setelah peserta terdaftar, sehingga course yang belum pernah
 * dibuka tidak pernah menyalakan panggilan ke backend lain.
 *
 * @returns id course AI Mastery, atau `null` bila bridging tidak dikonfigurasi
 *   atau AI Mastery tidak bisa dihubungi. Pemanggil harus memperlakukan `null`
 *   sebagai "tanpa konteks", bukan sebagai error.
 */
export async function selaraskanKursusAi(input: {
  courseId: string;
  title: string;
  /** Judul modul, dipakai sebagai unit silabus. */
  modul: string[];
}): Promise<string | null> {
  if (!AI_MASTERY_API_URL) return null;
  const courseId = input.courseId.trim();
  const title = input.title.trim();
  if (!courseId || !title) return null;

  // Mapping yang sudah ada: jangan pernah memanggil API lagi. Inilah yang
  // membuat halaman kursus murah sejak kunjungan pertama.
  const [ada] = await getDb()
    .select({ aiCourseId: courses.aiCourseId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  const tersimpan = ada?.aiCourseId?.trim();
  if (tersimpan) return tersimpan;

  let aiId = "";
  try {
    try {
      aiId = bacaId(
        await panggil("/api/courses", {
          method: "POST",
          body: JSON.stringify({ name: title }),
        }),
      );
    } catch (err) {
      // Konflik nama (409) berarti course-nya sudah ada: pakai itu, jangan
      // buat duplikat yang tidak bisa dihapus dari UI.
      if (!(err instanceof StatusGagal) || err.status !== 409) return null;
      aiId = await cariIdByNama(title);
      if (!aiId) return null;
    }
    if (!aiId) return null;

    // Silabus = judul modul. Tanpa ini kursus ada tapi kosong, dan
    // `_syllabus_summary` melaporkan "Syllabus: none set".
    if (input.modul.length > 0) {
      await panggil(`/api/courses/${encodeURIComponent(aiId)}/syllabus`, {
        method: "PUT",
        body: JSON.stringify({
          units: input.modul.map((judul) => ({ title: judul, covered: false })),
        }),
      });
    }

    await denganTransaksi(async (tx) => {
      await tx.update(courses).set({ aiCourseId: aiId }).where(eq(courses.id, courseId));
    });

    return aiId;
  } catch {
    // Syllabus yang gagal tidak membatalkan mapping: course-nya sudah ada, dan
    // konteks separuh lebih baik daripada tidak ada sama sekali.
    return aiId || null;
  }
}
