import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPayload } from "@/lib/auth/types";
import type { StudyModelReply, StudyReplyResult } from "@/lib/agents/study-chat/schema";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { Pendaftaran } from "@/lib/courses/enrollment";
import type { OnboardingProfile } from "@/lib/onboarding/types";
import type { PersonalizedPath } from "@/lib/learning/personalized-path";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import type {
  StudyChatMessage,
  StudyChatSnapshot,
  StudyPathProposal,
} from "@/lib/learning/chat-types";
import { kirimStudyChatAction, setujuiStudyPathAction } from "./learning-chat";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getProfile: vi.fn(),
  katalogBelajar: vi.fn(),
  listPendaftaran: vi.fn(),
  bangunJalurPersonalisasi: vi.fn(),
  modulKursus: vi.fn(),
  readStudyChatSnapshot: vi.fn(),
  appendStudyMessage: vi.fn(),
  setPendingStudyProposal: vi.fn(),
  clearPendingStudyProposal: vi.fn(),
  validateStudyPathProposal: vi.fn(),
  generateStudyReply: vi.fn(),
  cariPendaftaran: vi.fn(),
  pendaftaranPenuh: vi.fn(),
  daftarKursus: vi.fn(),
  getCourseById: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/onboarding/store", () => ({ getProfile: mocks.getProfile }));
vi.mock("@/lib/courses/katalog", () => ({ katalogBelajar: mocks.katalogBelajar }));
vi.mock("@/lib/courses/enrollment", () => ({
  listPendaftaran: mocks.listPendaftaran,
  cariPendaftaran: mocks.cariPendaftaran,
  pendaftaranPenuh: mocks.pendaftaranPenuh,
  daftarKursus: mocks.daftarKursus,
}));
// The course store is mocked so the policy gate can load `kebijakan` without
// reading the real `data/courses.json` from disk during tests.
vi.mock("@/lib/courses/store", () => ({ getCourseById: mocks.getCourseById }));
vi.mock("@/lib/learning/personalized-path", () => ({
  bangunJalurPersonalisasi: mocks.bangunJalurPersonalisasi,
}));
vi.mock("@/lib/courses/kurikulum", () => ({ modulKursus: mocks.modulKursus }));
vi.mock("@/lib/learning/chat-store", () => ({
  readStudyChatSnapshot: mocks.readStudyChatSnapshot,
  appendStudyMessage: mocks.appendStudyMessage,
  setPendingStudyProposal: mocks.setPendingStudyProposal,
  clearPendingStudyProposal: mocks.clearPendingStudyProposal,
}));
vi.mock("@/lib/learning/path-proposal", () => ({
  validateStudyPathProposal: mocks.validateStudyPathProposal,
}));
vi.mock("@/lib/agents/study-chat/gemini", () => ({
  generateStudyReply: mocks.generateStudyReply,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const SESSION = {
  email: "learner@careevo.test",
  nama: "Raka Pratama",
  username: "raka",
  role: "user",
  iat: 1_800_000_000,
} satisfies SessionPayload;

const PROFILE = {
  owner: SESSION.email,
  experience: "dasar",
  background: "mahasiswa",
  interests: ["web-dev"],
  goal: "Bangun portfolio teknis.",
  weeklyHours: 8,
  workPreference: "remote",
  completedAt: "2026-09-24T00:00:00.000Z",
  version: 2,
} satisfies OnboardingProfile;

const COURSE = {
  id: "crs-1",
  slug: "fullstack-web-development-nextjs-15-react-19",
  title: "Fullstack Web Development: Next.js 15 & React 19",
  url: "https://nextjs.org/docs",
  provider: "Careevo Academy",
  type: "course",
  tags: ["Next.js", "React", "TypeScript"],
  level: "dasar",
  is_free: true,
  duration_min: 180,
  completed: false,
} satisfies EntriKatalog;

const OTHER_COURSE = {
  ...COURSE,
  id: "crs-2",
  slug: "membangun-rest-api-modern-dengan-nodejs",
  title: "Membangun REST API Modern",
} satisfies EntriKatalog;

const PAID_COURSE = {
  ...COURSE,
  id: "crs-5",
  slug: "machine-learning-ai-prompt-engineering",
  title: "Machine Learning & AI Prompt Engineering",
  is_free: false,
} satisfies EntriKatalog;

const MODULE = {
  id: "crs-1-m1",
  judul: "Mendalami Next.js",
  ringkasan: "Konsep dasar Next.js.",
  durasi_min: 18,
  url: "https://nextjs.org/docs",
} satisfies ModulKursus;

const PATH = {
  course: COURSE,
  source: "recommendation",
  modules: [
    {
      id: MODULE.id,
      title: MODULE.judul,
      status: "current",
      href: `/belajar/${COURSE.slug}#kurikulum`,
    },
  ],
  nextAction: {
    kind: "start-course",
    label: "Mulai kursus",
    href: `/belajar/${COURSE.slug}`,
  },
} satisfies PersonalizedPath;

const PROPOSAL = {
  id: "proposal-1",
  courseId: COURSE.id,
  moduleIds: [MODULE.id],
  rationale: "Mulai dari konsep dasar.",
  createdAt: "2026-09-24T00:00:00.000Z",
} satisfies StudyPathProposal;

const REPLY_WITHOUT_PATH = {
  message: "Closure adalah fungsi yang mengingat lexical scope.",
  followUpQuestion: "Bisakah kamu memberi contoh closure?",
  pathProposal: null,
} satisfies StudyModelReply;

const REPLY_WITH_PATH = {
  ...REPLY_WITHOUT_PATH,
  pathProposal: {
    courseId: COURSE.id,
    moduleIds: [MODULE.id],
    rationale: "Mulai dari konsep dasar.",
  },
} satisfies StudyModelReply;

let storedSnapshot: StudyChatSnapshot;

function messageForm(message: string): FormData {
  const form = new FormData();
  form.set("message", message);
  return form;
}

function approvalForm(proposalId = PROPOSAL.id): FormData {
  const form = new FormData();
  form.set("proposalId", proposalId);
  return form;
}

function seedProposal(proposal: StudyPathProposal = PROPOSAL): void {
  storedSnapshot = { version: 1, messages: [], pendingProposal: proposal };
}

function enrollmentRecords(count: number): Pendaftaran[] {
  return Array.from({ length: count }, (_, index) => ({
    course_id: `other-${index}`,
    slug: `other-${index}`,
    owner: "other@careevo.test",
    enrolled_at: "2026-09-01T08:00:00.000Z",
    selesai_modul: [],
  }));
}

function setCoursePath(course: EntriKatalog | null = COURSE): void {
  mocks.bangunJalurPersonalisasi.mockReturnValue({
    ...PATH,
    course,
    modules: course ? PATH.modules : [],
    nextAction: course ? PATH.nextAction : {
      kind: "explore-courses",
      label: "Jelajahi kursus",
      href: "/belajar",
    },
  });
}

/**
 * Course as the store returns it. `EntriKatalog` deliberately carries no
 * `kebijakan`, so the policy gate has to load the course itself.
 */
function setKebijakanCourse(aturanBantuan: "bebas" | "bertutor" | "tanpa_ai") {
  mocks.getCourseById.mockResolvedValue({
    id: COURSE.id,
    kebijakan: { ...kebijakanDefault(), aturan_bantuan: aturanBantuan },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  storedSnapshot = { version: 1, messages: [] };
  mocks.getSession.mockResolvedValue(SESSION);
  mocks.getProfile.mockResolvedValue(PROFILE);
  mocks.katalogBelajar.mockResolvedValue([COURSE, OTHER_COURSE]);
  mocks.listPendaftaran.mockResolvedValue([] as Pendaftaran[]);
  mocks.cariPendaftaran.mockResolvedValue(undefined);
  mocks.pendaftaranPenuh.mockResolvedValue([]);
  mocks.modulKursus.mockReturnValue([MODULE]);
  setCoursePath();
  mocks.readStudyChatSnapshot.mockImplementation(async () => storedSnapshot);
  mocks.appendStudyMessage.mockImplementation(
    async (_owner: string, message: StudyChatMessage) => {
      storedSnapshot = { ...storedSnapshot, messages: [...storedSnapshot.messages, message] };
      return storedSnapshot;
    },
  );
  mocks.setPendingStudyProposal.mockImplementation(
    async (_owner: string, proposal: StudyPathProposal) => {
      storedSnapshot = { ...storedSnapshot, pendingProposal: proposal };
      return storedSnapshot;
    },
  );
  mocks.clearPendingStudyProposal.mockImplementation(async () => {
    storedSnapshot = {
      version: storedSnapshot.version,
      messages: storedSnapshot.messages,
    };
    return storedSnapshot;
  });
  mocks.validateStudyPathProposal.mockReturnValue({
    valid: true,
    course: COURSE,
    modules: [MODULE],
  });
  mocks.generateStudyReply.mockResolvedValue({
    ok: true,
    reply: REPLY_WITHOUT_PATH,
  } satisfies StudyReplyResult);
  mocks.daftarKursus.mockResolvedValue([]);
  mocks.getCourseById.mockResolvedValue(undefined);
});

describe("kirimStudyChatAction", () => {
  it("returns unauthenticated before reading owner data or calling Gemini", async () => {
    // Given: no authenticated session.
    mocks.getSession.mockResolvedValue(null);

    // When: the action receives a valid message.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm("hello"));

    // Then: it exposes only the safe unauthenticated state and performs no owner work.
    expect(result).toEqual({
      status: "unauthenticated",
      message: "Masuk dulu untuk membuka tutor.",
    });
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(mocks.readStudyChatSnapshot).not.toHaveBeenCalled();
    expect(mocks.generateStudyReply).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", "   "],
    ["oversized", "x".repeat(601)],
  ])("rejects %s input before persistence or provider calls", async (_label, message) => {
    // Given: an authenticated learner submits invalid message text.
    mocks.getSession.mockResolvedValue(SESSION);

    // When: the action validates the form.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm(message));

    // Then: no owner store or provider is touched.
    expect(result).toMatchObject({ status: "invalid_input" });
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(mocks.appendStudyMessage).not.toHaveBeenCalled();
    expect(mocks.generateStudyReply).not.toHaveBeenCalled();
  });

  it("refuses the tutor when the course bans AI help, before persisting or calling the provider", async () => {
    // Given: a course whose help rule closes academic assistance.
    setKebijakanCourse("tanpa_ai");

    // When: the learner asks for help anyway.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm("Tolong kerjakan ini."));

    // Then: the request is refused, and the refusal is total — the model is
    // never called (calling it and discarding the answer still burns quota and
    // still produces the forbidden help), and the rejected text never lands in
    // the transcript as evidence of a suppressed request.
    expect(result.status).toBe("policy_denied");
    expect(mocks.generateStudyReply).not.toHaveBeenCalled();
    expect(mocks.appendStudyMessage).not.toHaveBeenCalled();
    if (result.status !== "policy_denied") return;
    expect(result.message).toContain("melarang");
    expect(result.snapshot.messages).toHaveLength(0);
  });

  it("still serves the tutor when the course help rule allows it", async () => {
    // Given: a course that permits the Careevo tutor.
    setKebijakanCourse("bertutor");

    // When: the learner asks a normal question.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm("What is a server component?"));

    // Then: the gate is transparent and behaviour is unchanged.
    expect(result).toMatchObject({ status: "success" });
    expect(mocks.generateStudyReply).toHaveBeenCalled();
  });

  it("appends server metadata and passes only safe profile/path context to Gemini", async () => {
    // Given: an authenticated learner and a successful reply without a proposal.
    mocks.generateStudyReply.mockResolvedValue({
      ok: true,
      reply: REPLY_WITHOUT_PATH,
    } satisfies StudyReplyResult);

    // When: the learner sends a trimmed message.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm("  Jelaskan closures  "));

    // Then: both messages are persisted and the provider receives no owner/session data.
    expect(result).toMatchObject({ status: "success" });
    expect(mocks.readStudyChatSnapshot).not.toHaveBeenCalled();
    if (result.status !== "success") return;
    expect(result.snapshot.messages.map((item) => item.role)).toEqual(["user", "assistant"]);
    expect(result.snapshot.messages[0]?.content).toBe("Jelaskan closures");
    expect(result.snapshot.messages[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    const createdAt = result.snapshot.messages[0]?.createdAt;
    expect(createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isNaN(Date.parse(createdAt ?? ""))).toBe(false);
    const providerInput = mocks.generateStudyReply.mock.calls[0]?.[0];
    expect(providerInput).toMatchObject({
      profile: {
        experience: PROFILE.experience,
        interests: PROFILE.interests,
        goal: PROFILE.goal,
        weeklyHours: PROFILE.weeklyHours,
      },
      course: {
        id: COURSE.id,
        slug: COURSE.slug,
        title: COURSE.title,
        tags: COURSE.tags,
        level: COURSE.level,
      },
      module: { id: MODULE.id, title: MODULE.judul },
    });
    expect(JSON.stringify(providerInput)).not.toContain(SESSION.email);
    expect(JSON.stringify(result)).not.toContain("owner");
  });

  it.each([
    ["missing_api_key", "Tutor Gemini belum dikonfigurasi."],
    ["rate_limited", "Batas penggunaan tutor tercapai. Coba lagi nanti."],
    ["provider_error", "Tutor Gemini sedang tidak tersedia."],
  ] as const)("preserves the learner message when Gemini returns %s", async (reason, message) => {
    // Given: the adapter reports a typed provider failure.
    mocks.generateStudyReply.mockResolvedValue({
      ok: false,
      reason,
      message: `raw provider detail ${message}`,
    } satisfies StudyReplyResult);

    // When: the learner sends a message.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm("Jelaskan closures"));

    // Then: the state is safe and the learner turn remains persisted.
    expect(result).toMatchObject({ status: "unavailable", reason, message });
    if (result.status !== "unavailable") return;
    expect(result.snapshot.messages.at(-1)?.content).toBe("Jelaskan closures");
    expect(result.snapshot.messages).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("raw provider detail");
    expect(mocks.setPendingStudyProposal).not.toHaveBeenCalled();
  });

  it("preserves the learner message and returns invalid_model_output for invalid replies", async () => {
    // Given: the adapter rejects the model response.
    mocks.generateStudyReply.mockResolvedValue({
      ok: false,
      reason: "invalid_model_output",
      message: "raw malformed model response",
    } satisfies StudyReplyResult);

    // When: the action handles the send.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm("Jelaskan closures"));

    // Then: no assistant turn or proposal is fabricated.
    expect(result).toMatchObject({ status: "invalid_model_output" });
    if (result.status !== "invalid_model_output") return;
    expect(result.snapshot.messages).toHaveLength(1);
    expect(result.snapshot.messages[0]?.role).toBe("user");
    expect(JSON.stringify(result)).not.toContain("raw malformed model response");
  });

  it("persists a canonical proposal only after the current-course and curriculum gates pass", async () => {
    // Given: a reply names a course but supplies duplicate/out-of-order model ids.
    mocks.generateStudyReply.mockResolvedValue({
      ok: true,
      reply: {
        ...REPLY_WITH_PATH,
        pathProposal: {
          courseId: COURSE.id,
          moduleIds: [MODULE.id, "crs-1-m1"],
          rationale: "Mulai dari konsep dasar.",
        },
      },
    } satisfies StudyReplyResult);

    // When: the action validates the response.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm("Buat jalur"));

    // Then: the stored proposal uses the validator's canonical course and module order.
    expect(result).toMatchObject({ status: "success" });
    expect(mocks.validateStudyPathProposal).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: COURSE.id, moduleIds: [MODULE.id, "crs-1-m1"] }),
      [COURSE, OTHER_COURSE],
    );
    expect(mocks.setPendingStudyProposal).toHaveBeenCalledWith(
      SESSION.email,
      expect.objectContaining({ courseId: COURSE.id, moduleIds: [MODULE.id] }),
    );
    expect(mocks.appendStudyMessage).toHaveBeenCalledTimes(2);
  });

  it("allows a course-less learner to chat when the reply has no proposal", async () => {
    // Given: the published catalog is populated but the current path has no course.
    setCoursePath(null);

    // When: the learner sends a message.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm("Jelaskan closures"));

    // Then: chat remains available without fabricating a path.
    expect(result).toMatchObject({ status: "success" });
    expect(mocks.setPendingStudyProposal).not.toHaveBeenCalled();
    expect(mocks.validateStudyPathProposal).not.toHaveBeenCalled();
  });

  it("rejects a non-null proposal when the current path has no course", async () => {
    // Given: a populated catalog and a course-less current path.
    setCoursePath(null);
    mocks.generateStudyReply.mockResolvedValue({
      ok: true,
      reply: REPLY_WITH_PATH,
    } satisfies StudyReplyResult);

    // When: the action receives a proposed path.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm("Buat jalur"));

    // Then: the model proposal cannot escape the course-less boundary.
    expect(result).toMatchObject({ status: "invalid_model_output" });
    expect(mocks.setPendingStudyProposal).not.toHaveBeenCalled();
    expect(mocks.validateStudyPathProposal).not.toHaveBeenCalled();
  });

  it("rejects a proposal whose course does not equal the current course", async () => {
    // Given: the current course is crs-1 but the model names crs-2.
    mocks.generateStudyReply.mockResolvedValue({
      ok: true,
      reply: {
        ...REPLY_WITH_PATH,
        pathProposal: {
          courseId: OTHER_COURSE.id,
          moduleIds: ["crs-2-m1"],
          rationale: "Mulai dari Node.js.",
        },
      },
    } satisfies StudyReplyResult);

    // When: the action receives the mismatched proposal.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm("Buat jalur"));

    // Then: it is rejected before catalog validation or persistence.
    expect(result).toMatchObject({ status: "invalid_model_output" });
    expect(mocks.validateStudyPathProposal).not.toHaveBeenCalled();
    expect(mocks.setPendingStudyProposal).not.toHaveBeenCalled();
    expect(mocks.appendStudyMessage).toHaveBeenCalledTimes(1);
  });
});

describe("setujuiStudyPathAction", () => {
  it("returns unauthenticated before reading the owner-scoped proposal", async () => {
    // Given: no authenticated session.
    mocks.getSession.mockResolvedValue(null);

    // When: approval is requested.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm());

    // Then: no owner-scoped read or mutation occurs.
    expect(result).toEqual({
      status: "unauthenticated",
      message: "Masuk dulu untuk menyetujui jalur.",
    });
    expect(mocks.readStudyChatSnapshot).not.toHaveBeenCalled();
    expect(mocks.daftarKursus).not.toHaveBeenCalled();
  });

  it("enrolls the canonical course only after explicit proposal approval", async () => {
    // Given: the owner has a valid stored proposal for the current course.
    seedProposal();

    // When: the learner submits the stored proposal id.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm());

    // Then: owner-aware enrollment uses the canonical id/slug and no module is completed.
    expect(result).toMatchObject({ status: "success" });
    expect(mocks.readStudyChatSnapshot).toHaveBeenCalledWith(SESSION.email);
    expect(mocks.daftarKursus).toHaveBeenCalledWith(
      "crs-1",
      "fullstack-web-development-nextjs-15-react-19",
      "learner@careevo.test",
    );
    expect(mocks.clearPendingStudyProposal).toHaveBeenCalledWith(SESSION.email);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/belajar");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/belajar/jalur");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/belajar/fullstack-web-development-nextjs-15-react-19",
    );
    expect(storedSnapshot.pendingProposal).toBeUndefined();
  });

  it("rejects a paid canonical course before enrollment", async () => {
    // Given: the current published course is paid and has a valid stored proposal.
    const paidProposal = {
      ...PROPOSAL,
      courseId: PAID_COURSE.id,
      moduleIds: ["crs-5-m1"],
    } satisfies StudyPathProposal;
    seedProposal(paidProposal);
    setCoursePath(PAID_COURSE);
    mocks.katalogBelajar.mockResolvedValue([COURSE, PAID_COURSE]);
    mocks.validateStudyPathProposal.mockReturnValue({
      valid: true,
      course: PAID_COURSE,
      modules: [MODULE],
    });

    // When: the learner approves it.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm(paidProposal.id));

    // Then: the existing paid-course policy blocks every enrollment mutation.
    expect(result).toEqual({
      status: "error",
      message: "Kursus berbayar ini termasuk paket Careevo Plus.",
    });
    expect(mocks.cariPendaftaran).not.toHaveBeenCalled();
    expect(mocks.pendaftaranPenuh).not.toHaveBeenCalled();
    expect(mocks.daftarKursus).not.toHaveBeenCalled();
    expect(mocks.clearPendingStudyProposal).not.toHaveBeenCalled();
    expect(storedSnapshot.pendingProposal).toEqual(paidProposal);
  });

  it("rejects a new enrollment when the 50-record cap is full", async () => {
    // Given: the owner is not enrolled and the signed browser array already has 50 records.
    seedProposal();
    mocks.pendaftaranPenuh.mockResolvedValue(enrollmentRecords(50));

    // When: the learner approves a free course.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm());

    // Then: the cap is enforced before raw persistence.
    expect(result).toEqual({
      status: "error",
      message: "Batas 50 pendaftaran tercapai di peramban ini.",
    });
    expect(mocks.cariPendaftaran).toHaveBeenCalledWith(COURSE.id, SESSION.email);
    expect(mocks.daftarKursus).not.toHaveBeenCalled();
    expect(mocks.clearPendingStudyProposal).not.toHaveBeenCalled();
  });

  it("keeps an already-enrolled canonical course idempotent at the cap", async () => {
    // Given: the owner already has the canonical course while the browser array is full.
    seedProposal();
    mocks.cariPendaftaran.mockResolvedValue({
      course_id: COURSE.id,
      slug: COURSE.slug,
      owner: SESSION.email,
      enrolled_at: "2026-09-01T08:00:00.000Z",
      selesai_modul: ["crs-1-m2"],
    } satisfies Pendaftaran);
    mocks.pendaftaranPenuh.mockResolvedValue(enrollmentRecords(50));

    // When: the learner approves the same proposal.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm());

    // Then: approval succeeds without appending a duplicate enrollment record.
    expect(result).toMatchObject({ status: "success" });
    expect(mocks.daftarKursus).not.toHaveBeenCalled();
    expect(mocks.clearPendingStudyProposal).toHaveBeenCalledWith(SESSION.email);
  });

  it("maps a non-Error enrollment rejection to a safe state", async () => {
    // Given: raw enrollment rejects with a string.
    seedProposal();
    mocks.daftarKursus.mockRejectedValue("raw enrollment failure");

    // When: approval is attempted.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm());

    // Then: the action remains serializable and preserves the proposal.
    expect(result).toEqual({ status: "error", message: "Pendaftaran gagal. Silakan coba lagi." });
    expect(JSON.stringify(result)).not.toContain("raw enrollment failure");
    expect(storedSnapshot.pendingProposal).toEqual(PROPOSAL);
    expect(mocks.clearPendingStudyProposal).not.toHaveBeenCalled();
  });

  it("maps a non-Error proposal-clear rejection to a safe state", async () => {
    // Given: enrollment succeeds but clearing the proposal rejects with an object.
    seedProposal();
    mocks.clearPendingStudyProposal.mockRejectedValue({ code: "COOKIE_WRITE" });

    // When: approval completes its mutation sequence.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm());

    // Then: the raw object is not exposed and the proposal remains available for retry.
    expect(result).toEqual({ status: "error", message: "Pendaftaran gagal. Silakan coba lagi." });
    expect(JSON.stringify(result)).not.toContain("COOKIE_WRITE");
    expect(storedSnapshot.pendingProposal).toEqual(PROPOSAL);
  });

  it("resolves safely when post-mutation revalidation throws a non-Error", async () => {
    // Given: enrollment and proposal clearing succeed, but path revalidation throws a string.
    seedProposal();
    mocks.revalidatePath.mockImplementation((path: string) => {
      if (path === "/belajar/jalur") throw "raw revalidation failure";
    });

    // When: approval finishes the successful mutation.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm());

    // Then: revalidation cannot reject the already-successful action.
    expect(result).toMatchObject({ status: "success" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/belajar");
    expect(JSON.stringify(result)).not.toContain("raw revalidation failure");
    expect(storedSnapshot.pendingProposal).toBeUndefined();
  });

  it("rejects a proposal id that does not match the owner-scoped store", async () => {
    // Given: a pending proposal with a different id, as if it belonged to another owner.
    seedProposal({ ...PROPOSAL, id: "other-owner" });

    // When: the client submits the expected id.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm());

    // Then: the proposal is rejected without catalog access or enrollment.
    expect(result).toMatchObject({ status: "invalid_proposal" });
    expect(mocks.katalogBelajar).not.toHaveBeenCalled();
    expect(mocks.daftarKursus).not.toHaveBeenCalled();
    expect(mocks.clearPendingStudyProposal).not.toHaveBeenCalled();
  });

  it("rejects a stale proposal before validation or enrollment", async () => {
    // Given: the stored proposal targets crs-1 but the current path is crs-2.
    seedProposal();
    setCoursePath(OTHER_COURSE);

    // When: approval is requested against the changed path.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm());

    // Then: the exact current-course gate blocks the stale mutation.
    expect(result).toMatchObject({ status: "invalid_proposal" });
    expect(mocks.validateStudyPathProposal).not.toHaveBeenCalled();
    expect(mocks.daftarKursus).not.toHaveBeenCalled();
    expect(mocks.clearPendingStudyProposal).not.toHaveBeenCalled();
  });

  it("rejects an invalid canonical proposal and preserves it", async () => {
    // Given: the stored proposal cannot pass the current catalog validator.
    seedProposal();
    mocks.validateStudyPathProposal.mockReturnValue({
      valid: false,
      reason: "unknown_module",
    });

    // When: approval is requested.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm());

    // Then: no enrollment or clearing occurs.
    expect(result).toMatchObject({ status: "invalid_proposal" });
    expect(mocks.daftarKursus).not.toHaveBeenCalled();
    expect(mocks.clearPendingStudyProposal).not.toHaveBeenCalled();
  });

  it("preserves the proposal when enrollment fails", async () => {
    // Given: owner-aware enrollment rejects.
    seedProposal();
    mocks.daftarKursus.mockRejectedValue(new Error("cookie write failed"));

    // When: approval is attempted.
    const result = await setujuiStudyPathAction({ status: "idle" }, approvalForm());

    // Then: a safe retryable error is returned and the proposal remains.
    expect(result).toMatchObject({ status: "error" });
    expect(JSON.stringify(result)).not.toContain("cookie write failed");
    expect(mocks.clearPendingStudyProposal).not.toHaveBeenCalled();
    expect(storedSnapshot.pendingProposal).toEqual(PROPOSAL);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
