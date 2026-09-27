"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { katalogBelajar } from "@/lib/courses/katalog";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { modulKursus } from "@/lib/courses/kurikulum";
import { listKuis } from "@/lib/courses/store";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import { hasLlm } from "@/lib/llm/port";
import {
  createLatihan,
  deleteLatihan,
  getLatihan,
  recordAttempt,
  resetAttempts,
  saveSoal,
} from "@/lib/latihan/store";
import { StubLatihanGenerator } from "@/lib/latihan/generator";
import { GeminiLatihanGenerator } from "@/lib/latihan/generator-gemini";
import { hakimKeBoolean, nilaiDenganJuri } from "@/lib/latihan/juri";
import { normalisasiTipeSoal, TIPE_SOAL, type TipeSoal } from "@/lib/latihan/tipe-soal";
import type { SoalLatihan, TingkatSoal } from "@/lib/latihan/types";

/**
 * Server actions for generated practice quizzes.
 *
 * The same shape as `actions/book.ts`: gate on the session, resolve the course
 * from the learner's own personalized path, pick the generator through the LLM
 * port, write one file, redirect into the reader. Generation is synchronous
 * because there is nothing to stream — with the stub it finishes in milliseconds
 * and a fake progress bar would be theatre.
 */

/** Batas jumlah soal. 20 keeps one server action well under a timeout. */
const MAKS_SOAL = 20;
const MIN_SOAL = 3;
const MAKS_FOKUS = 300;

function parseJumlah(raw: FormDataEntryValue | null): number {
  const value = Number(String(raw ?? "8"));
  if (!Number.isFinite(value)) return 8;
  return Math.min(MAKS_SOAL, Math.max(MIN_SOAL, Math.floor(value)));
}

function parseTingkat(raw: FormDataEntryValue | null): TingkatSoal {
  const value = String(raw ?? "medium");
  if (value === "easy" || value === "hard") return value;
  return "medium";
}

/**
 * Read the requested types from the form.
 *
 * A checkbox set arrives as repeated `tipe` entries; anything unrecognised is
 * dropped rather than coerced, so a hand-crafted form cannot inject a type the
 * renderer has no branch for.
 */
function parseTipe(formData: FormData): TipeSoal[] {
  const hasil: TipeSoal[] = [];
  for (const raw of formData.getAll("tipe")) {
    const normalized = normalisasiTipeSoal(raw);
    if (TIPE_SOAL.includes(normalized) && !hasil.includes(normalized)) {
      hasil.push(normalized);
    }
  }
  return hasil;
}

export type LatihanActionState =
  | { status: "idle" }
  | { status: "error"; message: string };

/** Create a quiz from a course and open it. */
export async function buatLatihanAction(
  _state: LatihanActionState,
  formData: FormData,
): Promise<LatihanActionState> {
  const session = await getSession();
  if (!session) redirect("/masuk");

  const profile = await getProfile(session.email);
  if (!profile) redirect("/onboarding");

  const [catalog, enrollments] = await Promise.all([
    katalogBelajar(),
    listPendaftaran(session.email),
  ]);

  const requested = String(formData.get("courseId") ?? "").trim();
  const path = bangunJalurPersonalisasi({ profile, catalog, enrollments });
  const course = requested ? catalog.find((entry) => entry.id === requested) : path.course;
  if (!course) {
    return { status: "error", message: "Pilih kursus yang ingin diuji." };
  }

  const modules = modulKursus(course);
  if (modules.length === 0) {
    return { status: "error", message: "Kursus ini belum punya modul untuk diuji." };
  }

  const jumlah = parseJumlah(formData.get("jumlah"));
  const tingkat = parseTingkat(formData.get("tingkat"));
  const tipe = parseTipe(formData);
  const fokus = String(formData.get("fokus") ?? "").trim().slice(0, MAKS_FOKUS);

  const latihan = await createLatihan({
    owner: session.email,
    judul: `Latihan: ${course.title}`,
    topik: course.title,
    tingkat,
    tipe,
    courseId: course.id,
    courseSlug: course.slug,
  });

  // The port decides: a key means the real generator, no key means the stub.
  // Both produce a complete question set.
  const generator = hasLlm() ? new GeminiLatihanGenerator() : new StubLatihanGenerator();
  const bank = await listKuis();
  const result = await generator.generate({
    course,
    modules,
    kuis: bank,
    jumlah,
    tingkat,
    tipe,
    ...(fokus ? { fokus } : {}),
  });

  if (result.soal.length === 0) {
    await deleteLatihan(session.email, latihan.id);
    return {
      status: "error",
      message: "Tidak ada soal yang bisa disusun dari kursus ini. Coba kursus lain.",
    };
  }

  await saveSoal(latihan, result.soal, result.disusunOleh);

  revalidatePath("/belajar/latihan");
  redirect(`/belajar/latihan/${latihan.id}`);
}

/** Persist one answer. Called by the viewer on submit. */
export async function catatJawabanAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const latihanId = String(formData.get("latihanId") ?? "");
  const soalId = String(formData.get("soalId") ?? "");
  const jawaban = String(formData.get("jawaban") ?? "").slice(0, 4000);
  if (!latihanId || !soalId) return;

  // `benar` is computed in the browser for the deterministic types (see
  // `nilaiOtomatis`) and also supplied by self-assessment, and passed through,
  // because grading choice/concept/fill-in-the-blank is pure text comparison and
  // self-assessment is a judgement only the learner can make — a round trip to
  // the server would add latency without adding authority. Free-text answers
  // send `null` and are graded by the judge action instead.
  //
  // `sumber` decides how the stored row is labelled, and it is an allowlist, not
  // free text: `juri` is deliberately rejected here — a verdict the model did not
  // give must not be able to claim the model gave it. That verdict is written by
  // `nilaiJuriAction`, which is the only writer allowed to set `sumber: "juri"`.
  const mentahBenar = String(formData.get("benar") ?? "");
  const benar = mentahBenar === "true" ? true : mentahBenar === "false" ? false : null;
  const mentahSumber = String(formData.get("sumber") ?? "");
  const sumber =
    benar === null ? "belum" : mentahSumber === "diri" ? "diri" : "otomatis";

  await recordAttempt(session.email, latihanId, {
    soalId,
    jawaban,
    benar,
    sumber,
    at: new Date().toISOString(),
  });
}

export type JuriState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; putusan: "benar" | "sebagian" | "salah"; teks: string };

/** Grade a free-text answer with the AI judge and store the verdict. */
export async function nilaiJuriAction(
  _state: JuriState,
  formData: FormData,
): Promise<JuriState> {
  const session = await getSession();
  if (!session) redirect("/masuk");

  const latihanId = String(formData.get("latihanId") ?? "");
  const soalId = String(formData.get("soalId") ?? "");
  const jawaban = String(formData.get("jawaban") ?? "");
  if (!latihanId || !soalId) return { status: "error", message: "Soal tidak ditemukan." };

  const bundle = await getLatihanForAction(session.email, latihanId, soalId);
  if (!bundle) return { status: "error", message: "Soal tidak ditemukan." };

  const hasil = await nilaiDenganJuri({ soal: bundle.soal, jawabanLearner: jawaban });

  await recordAttempt(session.email, latihanId, {
    soalId,
    jawaban,
    benar: hakimKeBoolean(hasil.putusan),
    penilaian: hasil.teks,
    sumber: hasil.sumber === "juri" ? "juri" : "diri",
    at: new Date().toISOString(),
  });

  return { status: "success", putusan: hasil.putusan, teks: hasil.teks };
}

/** Load a bundle and locate one question, or `null` for any miss. */
async function getLatihanForAction(
  owner: string,
  latihanId: string,
  soalId: string,
): Promise<{ soal: SoalLatihan } | null> {
  const bundle = await getLatihan(owner, latihanId);
  if (!bundle) return null;
  const soal = bundle.soal.find((item) => item.id === soalId);
  return soal ? { soal } : null;
}

export async function hapusLatihanAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const latihanId = String(formData.get("latihanId") ?? "");
  if (!latihanId) return;
  await deleteLatihan(session.email, latihanId);
  revalidatePath("/belajar/latihan");
  redirect("/belajar/latihan");
}

export async function ulangiLatihanAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const latihanId = String(formData.get("latihanId") ?? "");
  if (!latihanId) return;
  await resetAttempts(session.email, latihanId);
  revalidatePath(`/belajar/latihan/${latihanId}`);
}
