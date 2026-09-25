"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { katalogBelajar, type EntriKatalog } from "@/lib/courses/katalog";
import { getCourseById } from "@/lib/courses/store";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import { putuskanAkses } from "@/lib/learning/akses";
import {
  cariPendaftaran,
  daftarKursus,
  listPendaftaran,
  pendaftaranPenuh,
} from "@/lib/courses/enrollment";
import { modulKursus, type ModulKursus } from "@/lib/courses/kurikulum";
import { getProfile } from "@/lib/onboarding/store";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import {
  appendStudyMessage,
  clearPendingStudyProposal,
  readStudyChatSnapshot,
  setPendingStudyProposal,
} from "@/lib/learning/chat-store";
import {
  MAX_STUDY_MESSAGE_CHARS,
  type StudyChatActionState,
  type StudyChatMessage,
  type StudyChatSnapshot,
  type StudyPathProposal,
  type StudyProposalActionState,
} from "@/lib/learning/chat-types";
import { validateStudyPathProposal } from "@/lib/learning/path-proposal";
import { generateStudyReply } from "@/lib/agents/study-chat/gemini";
import { cekBatasiAksi } from "@/lib/rate-limit/next";
import type {
  StudyPromptInput,
  StudyReplyFailureReason,
} from "@/lib/agents/study-chat/schema";

const PROVIDER_MESSAGES = {
  missing_api_key: "Tutor Gemini belum dikonfigurasi.",
  rate_limited: "Batas penggunaan tutor tercapai. Coba lagi nanti.",
  provider_error: "Tutor Gemini sedang tidak tersedia.",
} as const satisfies Record<Exclude<StudyReplyFailureReason, "invalid_model_output">, string>;

type PathContext = {
  readonly profile: StudyPromptInput["profile"];
  readonly catalog: EntriKatalog[];
  readonly course: EntriKatalog | null;
  readonly currentModule: ModulKursus | null;
};

type EnrollmentPolicy = { readonly allowed: true; readonly alreadyEnrolled: boolean } | { readonly allowed: false; readonly message: string };

function safeRevalidate(path: string): void {
  try {
    revalidatePath(path);
  } catch {
    return;
  }
}

async function loadPathContext(owner: string): Promise<PathContext | null> {
  const profile = await getProfile(owner);
  if (!profile) return null;

  const catalog = await katalogBelajar();
  const enrollments = await listPendaftaran(owner);
  const path = bangunJalurPersonalisasi({ profile, catalog, enrollments });
  const course = path.course
    ? catalog.find((entry) => entry.id === path.course?.id) ?? null
    : null;
  const currentModuleId =
    path.nextAction?.moduleId ?? path.modules.find((item) => item.status === "current")?.id;
  const currentModule = course && currentModuleId
    ? modulKursus(course).find((item) => item.id === currentModuleId) ?? null
    : null;

  return {
    profile: {
      experience: profile.experience,
      interests: [...profile.interests],
      goal: profile.goal,
      weeklyHours: profile.weeklyHours,
    },
    catalog,
    course,
    currentModule,
  };
}

async function checkEnrollmentPolicy(course: EntriKatalog, owner: string): Promise<EnrollmentPolicy> {
  if (!course.is_free) {
    return { allowed: false, message: "Kursus berbayar ini termasuk paket Careevo Plus." };
  }
  if (await cariPendaftaran(course.id, owner)) {
    return { allowed: true, alreadyEnrolled: true };
  }
  if ((await pendaftaranPenuh()).length >= 50) {
    return { allowed: false, message: "Batas 50 pendaftaran tercapai di peramban ini." };
  }
  return { allowed: true, alreadyEnrolled: false };
}

function promptInput(context: PathContext, snapshot: StudyChatSnapshot): StudyPromptInput {
  return {
    profile: context.profile,
    ...(context.course
      ? {
          course: {
            id: context.course.id,
            slug: context.course.slug,
            title: context.course.title,
            tags: [...context.course.tags],
            level: context.course.level,
          },
        }
      : {}),
    ...(context.currentModule
      ? { module: { id: context.currentModule.id, title: context.currentModule.judul } }
      : {}),
    messages: snapshot.messages,
    ...(snapshot.pendingProposal
      ? {
          pendingProposal: {
            id: snapshot.pendingProposal.id,
            courseId: snapshot.pendingProposal.courseId,
            moduleIds: [...snapshot.pendingProposal.moduleIds],
            rationale: snapshot.pendingProposal.rationale,
            createdAt: snapshot.pendingProposal.createdAt,
          },
        }
      : {}),
  };
}

function messageFor(
  content: string,
  role: StudyChatMessage["role"],
  context: PathContext,
): StudyChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...(context.course ? { courseId: context.course.id } : {}),
    ...(context.currentModule ? { moduleId: context.currentModule.id } : {}),
  };
}

function unavailable(
  reason: Exclude<StudyReplyFailureReason, "invalid_model_output">,
  snapshot: StudyChatSnapshot,
): StudyChatActionState {
  return {
    status: "unavailable",
    reason,
    message: PROVIDER_MESSAGES[reason],
    snapshot,
  };
}

function invalidModelOutput(snapshot: StudyChatSnapshot): StudyChatActionState {
  return {
    status: "invalid_model_output",
    message: "Balasan tutor tidak valid. Silakan coba lagi.",
    snapshot,
  };
}

export async function kirimStudyChatAction(
  _previous: StudyChatActionState,
  formData: FormData,
): Promise<StudyChatActionState> {
  const session = await getSession();
  if (!session) {
    return { status: "unauthenticated", message: "Masuk dulu untuk membuka tutor." };
  }

  // Dibatasi SEBELUM validasi pesan dan SEBELUM `generateStudyReply`, jadi
  // pesan cacat maupun pesan wajar sama-sama dihitung — memvalidasi lebih dulu
  // akan membuka celah menghindari batas dengan request yang selalu ditolak.
  // Principal = email sesi; tanpa itu satu akun dapat berpindah IP.
  //
  // Ditolak dengan `unavailable`/`rate_limited` (state yang sudah ada) dan
  // snapshot asli, bukan snapshot kosong: transkrip yang sudah dimiliki peserta
  // tidak boleh hilang hanya karena ia menembus batas.
  const batas = await cekBatasiAksi("studyChat", { principal: session.email });
  if (batas) {
    return {
      status: "unavailable",
      reason: "rate_limited",
      message: batas.gagal.pesan,
      snapshot: await readStudyChatSnapshot(session.email),
    };
  }

  const rawMessage = formData.get("message");
  const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
  if (message.length === 0 || message.length > MAX_STUDY_MESSAGE_CHARS) {
    return { status: "invalid_input", message: "Pesan harus berisi 1–600 karakter." };
  }

  const owner = session.email;
  const context = await loadPathContext(owner);
  if (!context) {
    return { status: "invalid_input", message: "Profil belajar belum lengkap." };
  }

  // Gerbang aturan bantuan course. Dipasang SEBELUM `appendStudyMessage`:
  // pesan yang ditolak tidak boleh masuk ke transkrip, dan model tidak boleh
  // dipanggil sama sekali — memanggil lalu membuang jawaban tetap membakar kuota
  // dan tetap menghasilkan bantuan yang dilarang.
  //
  // Tanpa konteks course tidak ada kebijakan yang berlaku, jadi tutor tetap
  // dilayani seperti sebelumnya. `context.course` diturunkan dari profil +
  // pendaftaran, bukan dari formulir, jadi peserta tidak bisa mengecualikan
  // dirinya lewat pesan yang ia kirim.
  if (context.course) {
    const kursus = await getCourseById(context.course.id);
    const keputusan = putuskanAkses({
      jenisKegiatan: "bantuan_akademik",
      kebijakan: kursus?.kebijakan ?? kebijakanDefault(),
      // `bantuan_akademik` tidak bergantung bukti sesi — mesin akses tidak
      // membacanya untuk kegiatan ini, jadi nilainya sengaja tidak menebak.
      adaBuktiSesi: false,
    });
    if (keputusan.tipe === "ditolak") {
      return {
        status: "policy_denied",
        message: keputusan.pesan,
        snapshot: await readStudyChatSnapshot(owner),
      };
    }
  }

  const learnerMessage = messageFor(message, "user", context);
  const afterLearner = await appendStudyMessage(owner, learnerMessage);
  const result = await generateStudyReply(promptInput(context, afterLearner));

  if (!result.ok) {
    return result.reason === "invalid_model_output"
      ? invalidModelOutput(afterLearner)
      : unavailable(result.reason, afterLearner);
  }

  const modelProposal = result.reply.pathProposal;
  if (modelProposal === null) {
    const assistant = messageFor(result.reply.message, "assistant", context);
    const afterAssistant = await appendStudyMessage(owner, assistant);
    safeRevalidate("/belajar/jalur");
    return { status: "success", message: "Tutor siap membantu.", snapshot: afterAssistant };
  }
  if (!context.course || modelProposal.courseId !== context.course.id) {
    return invalidModelOutput(afterLearner);
  }

  const proposal: StudyPathProposal = {
    id: crypto.randomUUID(),
    courseId: modelProposal.courseId,
    moduleIds: [...modelProposal.moduleIds],
    rationale: modelProposal.rationale,
    createdAt: new Date().toISOString(),
  };
  const validation = validateStudyPathProposal(proposal, context.catalog);
  if (!validation.valid) return invalidModelOutput(afterLearner);
  const canonicalProposal: StudyPathProposal = {
    ...proposal,
    courseId: validation.course.id,
    moduleIds: validation.modules.map((module) => module.id),
  };
  const assistant = messageFor(result.reply.message, "assistant", context);
  await appendStudyMessage(owner, assistant);
  const snapshot = await setPendingStudyProposal(owner, canonicalProposal);
  safeRevalidate("/belajar/jalur");
  return { status: "success", message: "Jalur belajar siap dijinjau.", snapshot };
}

export async function setujuiStudyPathAction(
  _previous: StudyProposalActionState,
  formData: FormData,
): Promise<StudyProposalActionState> {
  const session = await getSession();
  if (!session) {
    return { status: "unauthenticated", message: "Masuk dulu untuk menyetujui jalur." };
  }

  const owner = session.email;
  const snapshot = await readStudyChatSnapshot(owner);
  const rawProposalId = formData.get("proposalId");
  const proposalId = typeof rawProposalId === "string" ? rawProposalId.trim() : "";
  const proposal = snapshot.pendingProposal;
  if (!proposalId || !proposal || proposal.id !== proposalId) {
    return { status: "invalid_proposal", message: "Usulan jalur tidak valid atau sudah usang." };
  }

  const context = await loadPathContext(owner);
  if (!context?.course || context.course.id !== proposal.courseId) {
    return { status: "invalid_proposal", message: "Usulan jalur sudah tidak cocok." };
  }

  const validation = validateStudyPathProposal(proposal, context.catalog);
  if (!validation.valid) {
    return { status: "invalid_proposal", message: "Usulan jalur tidak valid atau sudah usang." };
  }

  try {
    const policy = await checkEnrollmentPolicy(validation.course, owner);
    if (!policy.allowed) return { status: "error", message: policy.message };
    if (!policy.alreadyEnrolled) {
      await daftarKursus(validation.course.id, validation.course.slug, owner);
    }
    await clearPendingStudyProposal(owner);
  } catch {
    return { status: "error", message: "Pendaftaran gagal. Silakan coba lagi." };
  }
  safeRevalidate("/belajar");
  safeRevalidate("/belajar/jalur");
  safeRevalidate(`/belajar/${validation.course.slug}`);
  return { status: "success", message: "Jalur disetujui. Kursus sudah ditambahkan." };
}
