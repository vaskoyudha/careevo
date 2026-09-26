import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPayload } from "@/lib/auth/types";
import type { StudyModelReply, StudyReplyResult } from "@/lib/agents/study-chat/schema";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { Pendaftaran } from "@/lib/courses/enrollment";
import type { OnboardingProfile } from "@/lib/onboarding/types";
import type { PersonalizedPath } from "@/lib/learning/personalized-path";
import type { StudyChatMessage, StudyChatSnapshot } from "@/lib/learning/chat-types";
import { kirimStudyChatAction } from "./learning-chat";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getProfile: vi.fn(),
  katalogBelajar: vi.fn(),
  listPendaftaran: vi.fn(),
  bangunJalurPersonalisasi: vi.fn(),
  modulKursus: vi.fn(),
  readStudyChatSnapshot: vi.fn(),
  appendStudyMessage: vi.fn(),
  generateStudyReply: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/onboarding/store", () => ({ getProfile: mocks.getProfile }));
vi.mock("@/lib/courses/katalog", () => ({ katalogBelajar: mocks.katalogBelajar }));
vi.mock("@/lib/courses/enrollment", () => ({
  listPendaftaran: mocks.listPendaftaran,
}));
vi.mock("@/lib/learning/personalized-path", () => ({
  bangunJalurPersonalisasi: mocks.bangunJalurPersonalisasi,
}));
vi.mock("@/lib/courses/kurikulum", () => ({ modulKursus: mocks.modulKursus }));
vi.mock("@/lib/learning/chat-store", () => ({
  readStudyChatSnapshot: mocks.readStudyChatSnapshot,
  appendStudyMessage: mocks.appendStudyMessage,
}));
vi.mock("@/lib/agents/study-chat/model", () => ({
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

const REPLY = {
  message: "Closure adalah fungsi yang mengingat lexical scope.",
} satisfies StudyModelReply;

let storedSnapshot: StudyChatSnapshot;

function messageForm(message: string): FormData {
  const form = new FormData();
  form.set("message", message);
  return form;
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

beforeEach(() => {
  vi.clearAllMocks();
  storedSnapshot = { version: 1, messages: [] };
  mocks.getSession.mockResolvedValue(SESSION);
  mocks.getProfile.mockResolvedValue(PROFILE);
  mocks.katalogBelajar.mockResolvedValue([COURSE, OTHER_COURSE]);
  mocks.listPendaftaran.mockResolvedValue([] as Pendaftaran[]);
  mocks.modulKursus.mockReturnValue([MODULE]);
  setCoursePath();
  mocks.readStudyChatSnapshot.mockImplementation(async () => storedSnapshot);
  mocks.appendStudyMessage.mockImplementation(
    async (_owner: string, message: StudyChatMessage) => {
      storedSnapshot = { ...storedSnapshot, messages: [...storedSnapshot.messages, message] };
      return storedSnapshot;
    },
  );
  mocks.generateStudyReply.mockResolvedValue({
    ok: true,
    reply: REPLY,
  } satisfies StudyReplyResult);
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

  it("appends server metadata and passes only safe profile/path context to Gemini", async () => {
    // Given: an authenticated learner and a successful reply without a proposal.
    mocks.generateStudyReply.mockResolvedValue({
      ok: true,
      reply: REPLY,
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
    ["missing_api_key", "Tutor belum dikonfigurasi."],
    ["rate_limited", "Batas penggunaan tutor tercapai. Coba lagi nanti."],
    ["provider_error", "Tutor sedang tidak tersedia. Coba lagi sebentar lagi."],
  ] as const)("publishes Careevo's own wording when the provider returns %s", async (reason, message) => {
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


  it("allows a course-less learner to chat", async () => {
    // Given: the published catalog is populated but the current path has no course.
    setCoursePath(null);

    // When: the learner sends a message.
    const result = await kirimStudyChatAction({ status: "idle" }, messageForm("Jelaskan closures"));

    // Then: chat remains available without fabricating course context.
    expect(result).toMatchObject({ status: "success" });
  });



});
