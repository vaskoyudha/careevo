import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudyChatMessage } from "@/lib/learning/chat-types";

/**
 * `mintaPetunjuk` is the ask-hint: a second, small model call whose whole
 * output is the composer's placeholder — the one line the learner is likely to
 * type next. It is the only surface in the app where a model writes text the
 * learner does not read as an answer, so the two things that matter are pinned
 * hard here:
 *
 * - it never spends a call it cannot use (no transcript, no provider), and
 * - it never renders a line that is not in the learner's voice — a description
 *   of a question, the assistant's own opening, a fence, a paragraph, or the
 *   learner's own last message read back.
 *
 * Every rejection is an empty string, never an error: upstream's note is that
 * "empty is a real answer, not an error", and the caller keeps the composer's
 * static placeholder in that case.
 *
 * The port is mocked the way `model.test.ts` mocks it, because the contract
 * under test is which provider answers and whether it is asked at all.
 */

const llm = vi.hoisted(() => ({
  calls: [] as string[],
  result: { ok: true, text: "" } as
    | { ok: true; text: string }
    | { ok: false; reason: string; message: string },
  available: true,
  throws: undefined as Error | undefined,
}));

vi.mock("@/lib/llm/port", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/llm/port")>();
  return {
    ...actual,
    getLlm: () => ({
      name: llm.available ? "openai-compat" : "stub",
      available: llm.available,
      async generate(prompt: string) {
        llm.calls.push(prompt);
        if (llm.throws) throw llm.throws;
        return llm.result;
      },
    }),
  };
});

const {
  MAX_HINT_CHARS,
  HINT_HISTORY_TURNS,
  MAX_HINT_MESSAGE_CHARS,
  bersihkanPetunjuk,
  bangunPromptPetunjuk,
  mintaPetunjuk,
  potongPercakapan,
} = await import("@/lib/agents/study-chat/hint");

function pesan(
  role: StudyChatMessage["role"],
  content: string,
  id = `${role}-${content.length}-${Math.random()}`,
): StudyChatMessage {
  return { id, role, content, createdAt: "2026-09-24T00:00:00.000Z" };
}

/** A transcript with a real exchange, so nothing returns early for emptiness. */
const percakapan: StudyChatMessage[] = [
  pesan("user", "Jelaskan perbedaan server component dan client component."),
  pesan("assistant", "Server component dijalankan di server, client component di browser."),
];

const BELAKANGAN_PESAN_PENGGUNA = "Jelaskan perbedaan server component dan client component.";

beforeEach(() => {
  llm.calls.length = 0;
  llm.result = { ok: true, text: "Ambil pilihan kedua saja" };
  llm.available = true;
  llm.throws = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mintaPetunjuk — when it must not call a model", () => {
  it("returns '' without a model call when there are no messages", async () => {
    await expect(mintaPetunjuk([])).resolves.toBe("");
    expect(llm.calls).toHaveLength(0);
  });

  it("returns '' without a model call when every message is blank", async () => {
    await expect(mintaPetunjuk([pesan("user", "   ")])).resolves.toBe("");
    expect(llm.calls).toHaveLength(0);
  });

  // No provider configured is not a failure to report, it is nothing to offer:
  // upstream has no stub for this call, so the composer keeps its own
  // placeholder instead of showing invented text.
  it("returns '' when the port has no model available", async () => {
    llm.available = false;
    await expect(mintaPetunjuk(percakapan)).resolves.toBe("");
    expect(llm.calls).toHaveLength(0);
  });
});

describe("mintaPetunjuk — a clean prediction", () => {
  it("passes a one-line prediction through unchanged", async () => {
    await expect(mintaPetunjuk(percakapan)).resolves.toBe("Ambil pilihan kedua saja");
    expect(llm.calls).toHaveLength(1);
  });

  it("sends the Indonesian rules and the rendered conversation tail", async () => {
    await mintaPetunjuk(percakapan);
    const prompt = llm.calls[0] ?? "";
    expect(prompt).toContain("Di bawah 14 kata");
    expect(prompt).toContain("# Akhir percakapan");
    expect(prompt).toContain(`[Pengguna] ${BELAKANGAN_PESAN_PENGGUNA}`);
    expect(prompt).toContain("[Asisten] Server component dijalankan di server");
    expect(prompt).toContain("Tulis satu baris berikutnya itu.");
  });

  it("never rejects a prediction because of the learner's own message", async () => {
    // Six-plus characters, but a different line: the echo guard must not fire.
    llm.result = { ok: true, text: "Bagaimana kalau percobaan ketiga gagal?" };
    await expect(mintaPetunjuk(percakapan)).resolves.toBe(
      "Bagaimana kalau percobaan ketiga gagal?",
    );
  });
});

describe("bersihkanPetunjuk — the shape rejections", () => {
  it("rejects a multi-line answer", () => {
    expect(bersihkanPetunjuk("Lanjutkan\nJelaskan bagian berikutnya", "")).toBe("");
    expect(bersihkanPetunjuk("Ambil pilihan kedua saja\n\nSemoga membantu!", "")).toBe("");
  });

  it("rejects a fenced answer", () => {
    expect(bersihkanPetunjuk("```\nAmbil pilihan kedua saja\n```", "")).toBe("");
    expect(bersihkanPetunjuk("```Ambil pilihan kedua saja```", "")).toBe("");
  });

  it("rejects an answer over the character cap", () => {
    const panjang = `Tolong ${"jelaskan ".repeat(20)}lebih ringkas`.trim();
    expect(panjang.length).toBeGreaterThan(MAX_HINT_CHARS);
    expect(bersihkanPetunjuk(panjang, "")).toBe("");
  });

  it("keeps an answer exactly at the cap", () => {
    const pas = "a".repeat(MAX_HINT_CHARS);
    expect(bersihkanPetunjuk(pas, "")).toHaveLength(MAX_HINT_CHARS);
  });
});

describe("bersihkanPetunjuk — the cleanups", () => {
  it("unwraps a line that is only quoted", () => {
    expect(bersihkanPetunjuk('"Ambil pilihan kedua saja"', "")).toBe("Ambil pilihan kedua saja");
    expect(bersihkanPetunjuk("“Ambil pilihan kedua saja”", "")).toBe("Ambil pilihan kedua saja");
    expect(bersihkanPetunjuk("‘Ambil pilihan kedua saja’", "")).toBe("Ambil pilihan kedua saja");
    expect(bersihkanPetunjuk("'Ambil pilihan kedua saja'", "")).toBe("Ambil pilihan kedua saja");
  });

  it("strips a leading list marker", () => {
    expect(bersihkanPetunjuk("- Ambil pilihan kedua saja", "")).toBe("Ambil pilihan kedua saja");
    expect(bersihkanPetunjuk("• Ambil pilihan kedua saja", "")).toBe("Ambil pilihan kedua saja");
    expect(bersihkanPetunjuk("# Ambil pilihan kedua saja", "")).toBe("Ambil pilihan kedua saja");
  });

  it("collapses internal whitespace", () => {
    expect(bersihkanPetunjuk("  Ambil    pilihan   kedua saja  ", "")).toBe(
      "Ambil pilihan kedua saja",
    );
  });

  it("does not unwrap a quote that is part of the sentence", () => {
    expect(bersihkanPetunjuk('Jelaskan arti "retry policy"', "")).toBe(
      'Jelaskan arti "retry policy"',
    );
  });
});

describe("bersihkanPetunjuk — the voice rejections", () => {
  it("rejects English meta phrasing", () => {
    expect(bersihkanPetunjuk("You could ask about the retry limit", "")).toBe("");
    expect(bersihkanPetunjuk("Try asking about the retry limit", "")).toBe("");
    expect(bersihkanPetunjuk("Consider asking about the retry limit", "")).toBe("");
  });

  it("rejects Indonesian meta phrasing", () => {
    for (const meta of [
      "Kamu bisa tanya soal batas retry",
      "Kamu dapat menanyakan urutan langkahnya",
      "Coba tanya soal batas retry",
      "Coba bilang lebih sederhana",
      "Mungkin tanyakan contohnya dulu",
      "Sebaiknya tanya bagian awalnya dulu",
    ]) {
      expect(bersihkanPetunjuk(meta, ""), meta).toBe("");
    }
  });

  it("rejects an English assistant opening", () => {
    expect(bersihkanPetunjuk("Sure, here is a more casual version", "")).toBe("");
    expect(bersihkanPetunjuk("Here's a more casual version", "")).toBe("");
    expect(bersihkanPetunjuk("As an AI, I can explain that", "")).toBe("");
  });

  it("rejects an Indonesian assistant opening", () => {
    for (const sapaan of [
      "Tentu saja, berikut penjelasannya",
      "Tentu, ini penjelasannya",
      "Baik, saya jelaskan ulang",
      "Baiklah, kita lanjut",
      "Siap, saya bantu",
      "Berikut penjelasan yang lebih santai",
      "Ini dia versi yang lebih santai",
    ]) {
      expect(bersihkanPetunjuk(sapaan, ""), sapaan).toBe("");
    }
  });

  it("keeps an ordinary sentence that merely contains a greeting word", () => {
    // "Baik" only disqualifies the line when it *opens* it — upstream anchors
    // the assistant-voice pattern at the start for exactly this reason.
    expect(bersihkanPetunjuk("Menurut saya jawabannya baik", "")).toBe(
      "Menurut saya jawabannya baik",
    );
  });

  it("rejects the learner's own last message read back", () => {
    expect(bersihkanPetunjuk(BELAKANGAN_PESAN_PENGGUNA, BELAKANGAN_PESAN_PENGGUNA)).toBe("");
    // Punctuation and case differences do not save it: normalization is on the
    // word characters only, and a prefix of the learner's message is still a
    // contained form.
    expect(
      bersihkanPetunjuk("jelaskan perbedaan server component", BELAKANGAN_PESAN_PENGGUNA),
    ).toBe("");
  });

  it("keeps a short line that only coincidentally sits inside the last message", () => {
    // Under six normalized characters the echo guard is off, so a brief reply
    // is not thrown away just because the learner's sentence contained it.
    expect(bersihkanPetunjuk("oke", "oke sip")).toBe("oke");
  });
});

describe("mintaPetunjuk — a rejected prediction is empty, not an error", () => {
  it("returns '' when the model describes a question instead of asking it", async () => {
    llm.result = { ok: true, text: "Kamu bisa tanya soal batas retry" };
    await expect(mintaPetunjuk(percakapan)).resolves.toBe("");
  });

  it("returns '' when the model answers in its own voice", async () => {
    llm.result = { ok: true, text: "Tentu saja, berikut penjelasannya" };
    await expect(mintaPetunjuk(percakapan)).resolves.toBe("");
  });

  it("returns '' when the model only echoes the learner", async () => {
    llm.result = { ok: true, text: BELAKANGAN_PESAN_PENGGUNA };
    await expect(mintaPetunjuk(percakapan)).resolves.toBe("");
  });

  it("returns '' on a typed provider failure, never a thrown error", async () => {
    llm.result = { ok: false, reason: "provider_error", message: "raw provider text" };
    const hasil = await mintaPetunjuk(percakapan);
    expect(hasil).toBe("");
    expect(JSON.stringify(hasil)).not.toContain("raw provider text");
  });

  it("returns '' when the port throws", async () => {
    llm.throws = new Error("socket hang up");
    await expect(mintaPetunjuk(percakapan)).resolves.toBe("");
  });

  it("returns '' when sanitizing itself is handed nothing usable", async () => {
    llm.result = { ok: true, text: "" };
    await expect(mintaPetunjuk(percakapan)).resolves.toBe("");
  });
});

describe("potongPercakapan — the tail it sends", () => {
  it("keeps at most HINT_HISTORY_TURNS messages, newest first", () => {
    const panjang: StudyChatMessage[] = Array.from({ length: 10 }, (_, index) =>
      pesan(index % 2 === 0 ? "user" : "assistant", `pesan ${index}`, `m${index}`),
    );
    const tail = potongPercakapan(panjang);
    expect(tail).toHaveLength(HINT_HISTORY_TURNS);
    expect(tail.map((baris) => baris.content)).toEqual([
      "pesan 6",
      "pesan 7",
      "pesan 8",
      "pesan 9",
    ]);
  });

  it("truncates each message to MAX_HINT_MESSAGE_CHARS", () => {
    const panjang = "kata ".repeat(400);
    const tail = potongPercakapan([pesan("assistant", panjang)]);
    expect(tail).toHaveLength(1);
    expect(tail[0]?.content).toHaveLength(MAX_HINT_MESSAGE_CHARS);
  });

  it("collapses internal whitespace so one message stays one prompt line", () => {
    const tail = potongPercakapan([pesan("assistant", "  Halo    dunia\n\nbaris   kedua  ")]);
    expect(tail).toEqual([{ role: "assistant", content: "Halo dunia baris kedua" }]);
  });

  it("drops blank messages and tolerates a non-array", () => {
    expect(potongPercakapan([pesan("user", ""), pesan("assistant", "   ")])).toEqual([]);
    expect(potongPercakapan(null as unknown as StudyChatMessage[])).toEqual([]);
  });

  it("filters unknown roles before the window, as upstream does", () => {
    // The role filter runs first, so a system row does not consume one of the
    // four slots — the tail is the last four *user/assistant* messages.
    const denganSistem = [
      ...Array.from({ length: 6 }, (_, index) => pesan("user", `pesan ${index}`, `m${index}`)),
      { id: "sistem", role: "system", content: "abaikan", createdAt: "2026-09-24T00:00:00.000Z" },
      ...Array.from({ length: 3 }, (_, index) => pesan("assistant", `pesan ${index + 6}`, `m${index + 6}`)),
    ] as unknown as StudyChatMessage[];
    expect(potongPercakapan(denganSistem).map((baris) => baris.content)).toEqual([
      "pesan 5",
      "pesan 6",
      "pesan 7",
      "pesan 8",
    ]);
  });

  it("builds a prompt even with an empty tail", () => {
    const prompt = bangunPromptPetunjuk([]);
    expect(prompt).toContain("# Akhir percakapan");
    expect(prompt).toMatch(/# Akhir percakapan\n+Tulis satu baris berikutnya itu\./);
  });
});
