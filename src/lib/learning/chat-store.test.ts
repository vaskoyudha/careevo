import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudyChatMessage, StudyPathProposal } from "./chat-types";

interface CookieOptions {
  readonly httpOnly: boolean;
  readonly sameSite: "lax";
  readonly secure: boolean;
  readonly path: "/";
  readonly maxAge: number;
}

interface CookieWrite {
  readonly name: string;
  readonly value: string;
  readonly options: CookieOptions;
}

const cookieState = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  writes: [] as CookieWrite[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieState.jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string, options: CookieOptions) => {
      cookieState.jar.set(name, value);
      cookieState.writes.push({ name, value, options });
    },
  }),
}));

const {
  MAX_STUDY_CHAT_MESSAGES,
  MAX_STUDY_MESSAGE_CHARS,
  MAX_STUDY_TRANSCRIPT_CHARS,
  STUDY_CHAT_COOKIE,
  STUDY_CHAT_MAX_AGE_SECONDS,
  STUDY_CHAT_VERSION,
} = await import("./chat-types");
const {
  appendStudyMessage,
  clearPendingStudyProposal,
  readStudyChatSnapshot,
  setPendingStudyProposal,
} = await import("./chat-store");

function message(overrides: Partial<StudyChatMessage> = {}): StudyChatMessage {
  return {
    id: "m1",
    role: "user",
    content: "Explain closures",
    createdAt: "2026-09-24T00:00:00.000Z",
    ...overrides,
  };
}

function proposal(overrides: Partial<StudyPathProposal> = {}): StudyPathProposal {
  return {
    id: "proposal-1",
    courseId: "crs-1",
    moduleIds: ["crs-1-m1", "crs-1-m2"],
    rationale: "This path starts with the learner's stated goal.",
    createdAt: "2026-09-24T00:00:00.000Z",
    ...overrides,
  };
}

function setCookie(name: string, value: string): void {
  cookieState.jar.set(name, value);
}

beforeEach(() => {
  cookieState.jar.clear();
  cookieState.writes.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("owner-scoped study chat store", () => {
  it("round-trips a bounded owner snapshot", async () => {
    // Given
    const learnerMessage = message({ courseId: "crs-1" });

    // When
    const snapshot = await appendStudyMessage("a@careevo.test", learnerMessage);

    // Then
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot).not.toHaveProperty("owner");
    expect((await readStudyChatSnapshot("A@Careevo.Test")).messages).toEqual(
      snapshot.messages,
    );
  });

  it("writes the normalized owner only into the signed envelope", async () => {
    // Given / When
    await appendStudyMessage("  A@Careevo.Test  ", message());
    const rawCookie = cookieState.jar.get(STUDY_CHAT_COOKIE);
    const separator = rawCookie?.indexOf(".") ?? -1;
    const body = rawCookie?.slice(0, separator) ?? "";
    const envelope: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    );

    // Then
    expect(envelope).toMatchObject({ owner: "a@careevo.test" });
  });

  it("does not expose another owner's transcript", async () => {
    // Given
    await appendStudyMessage("a@careevo.test", message({ content: "Private study note" }));

    // When
    const snapshot = await readStudyChatSnapshot("b@careevo.test");

    // Then
    expect(snapshot.messages).toEqual([]);
  });

  it("drops oldest messages after the six-message limit", async () => {
    // Given
    for (let index = 0; index < MAX_STUDY_CHAT_MESSAGES + 2; index += 1) {
      await appendStudyMessage(
        "a@careevo.test",
        message({ id: `m${index}`, content: `Message ${index}` }),
      );
    }

    // When
    const snapshot = await readStudyChatSnapshot("a@careevo.test");

    // Then
    expect(snapshot.messages).toHaveLength(MAX_STUDY_CHAT_MESSAGES);
    expect(snapshot.messages[0]?.id).toBe("m2");
    expect(snapshot.messages.at(-1)?.id).toBe("m7");
  });

  it("drops oldest messages and enforces transcript limits", async () => {
    // Given
    for (let index = 0; index < 8; index += 1) {
      await appendStudyMessage(
        "a@careevo.test",
        message({
          id: `m${index}`,
          role: index % 2 === 0 ? "user" : "assistant",
          content: "x".repeat(500),
          createdAt: `2026-09-24T00:00:0${index}.000Z`,
        }),
      );
    }

    // When
    const snapshot = await readStudyChatSnapshot("a@careevo.test");

    // Then
    expect(snapshot.messages.length).toBeLessThanOrEqual(MAX_STUDY_CHAT_MESSAGES);
    expect(
      snapshot.messages.reduce((total, item) => total + item.content.length, 0),
    ).toBeLessThanOrEqual(MAX_STUDY_TRANSCRIPT_CHARS);
  });

  it("truncates oversized assistant content with explicit metadata", async () => {
    // Given
    const assistantMessage = message({
      role: "assistant",
      content: "x".repeat(MAX_STUDY_MESSAGE_CHARS + 100),
    });

    // When
    const snapshot = await appendStudyMessage("a@careevo.test", assistantMessage);

    // Then
    expect(snapshot.messages[0]).toMatchObject({
      content: "x".repeat(MAX_STUDY_MESSAGE_CHARS),
      truncated: true,
    });
    expect((await readStudyChatSnapshot("a@careevo.test")).messages[0]).toEqual(
      snapshot.messages[0],
    );
  });

  it("returns an empty snapshot for malformed or unsigned data", async () => {
    // Given
    setCookie(STUDY_CHAT_COOKIE, "not-a-valid-envelope");

    // When
    const snapshot = await readStudyChatSnapshot("a@careevo.test");

    // Then
    expect(snapshot).toEqual({ version: STUDY_CHAT_VERSION, messages: [] });
  });

  it("returns an empty snapshot for an invalid signature", async () => {
    // Given
    await appendStudyMessage("a@careevo.test", message());
    const rawCookie = cookieState.jar.get(STUDY_CHAT_COOKIE) ?? "";
    const separator = rawCookie.lastIndexOf(".");
    const tamperedCookie = `${rawCookie.slice(0, separator + 1)}${
      rawCookie.endsWith("a") ? "b" : "a"
    }`;
    setCookie(STUDY_CHAT_COOKIE, tamperedCookie);

    // When
    const snapshot = await readStudyChatSnapshot("a@careevo.test");

    // Then
    expect(snapshot).toEqual({ version: STUDY_CHAT_VERSION, messages: [] });
  });

  it("rejects a sparse proposal without losing the existing transcript", async () => {
    // Given
    const transcript = await appendStudyMessage("a@careevo.test", message());
    const sparseProposal = proposal({ moduleIds: new Array<string>(1) });

    // When
    const snapshot = await setPendingStudyProposal("a@careevo.test", sparseProposal);

    // Then
    expect(snapshot.pendingProposal).toBeUndefined();
    expect((await readStudyChatSnapshot("a@careevo.test")).messages).toEqual(
      transcript.messages,
    );
  });

  it("copies only declared proposal fields into the return value and cookie", async () => {
    // Given
    const expected = proposal();
    const runtimeProposal = Object.assign(proposal(), {
      unsafeRuntimeField: "must-not-leak",
    });

    // When
    const snapshot = await setPendingStudyProposal("a@careevo.test", runtimeProposal);
    runtimeProposal.moduleIds.push("crs-1-m3");

    // Then
    expect(snapshot.pendingProposal).toEqual(expected);
    const rawCookie = cookieState.jar.get(STUDY_CHAT_COOKIE) ?? "";
    const separator = rawCookie.indexOf(".");
    const body = rawCookie.slice(0, separator);
    const envelope: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    );
    expect(envelope).toEqual({
      version: STUDY_CHAT_VERSION,
      owner: "a@careevo.test",
      messages: [],
      pendingProposal: expected,
    });
  });

  it("replaces a pending proposal", async () => {
    // Given
    await appendStudyMessage("a@careevo.test", message());
    await setPendingStudyProposal("a@careevo.test", proposal());
    const replacement = proposal({
      id: "proposal-2",
      courseId: "crs-2",
      moduleIds: ["crs-2-m1"],
    });

    // When
    const snapshot = await setPendingStudyProposal("a@careevo.test", replacement);

    // Then
    expect(snapshot.pendingProposal).toEqual(replacement);
  });

  it("clears a pending proposal without clearing the transcript", async () => {
    // Given
    const withMessage = await appendStudyMessage("a@careevo.test", message());
    await setPendingStudyProposal("a@careevo.test", proposal());

    // When
    const snapshot = await clearPendingStudyProposal("a@careevo.test");

    // Then
    expect(snapshot.pendingProposal).toBeUndefined();
    expect(snapshot.messages).toEqual(withMessage.messages);
  });

  it("uses the existing secure cookie contract outside production", async () => {
    // Given
    vi.stubEnv("NODE_ENV", "test");

    // When
    await appendStudyMessage("a@careevo.test", message());

    // Then
    expect(cookieState.writes.at(-1)).toMatchObject({
      name: STUDY_CHAT_COOKIE,
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: STUDY_CHAT_MAX_AGE_SECONDS,
      },
    });
  });

  it("marks the cookie secure in production", async () => {
    // Given — the cookie `secure` flag is the only production concern here, so
    // a valid production secret is set: without it the signer would (correctly)
    // refuse to run in production and this test would fail for the wrong reason.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "s".repeat(48));

    // When
    await appendStudyMessage("a@careevo.test", message());

    // Then
    expect(cookieState.writes.at(-1)?.options.secure).toBe(true);
  });
});
