import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  INTERVAL_SEQUENCES,
  antreanJatuhTempo,
  bangunAntreanTinjauan,
  hitungPenguasaan,
  initialRepetitionState,
  jadwalkanBerikutnya,
  rentangTinjauan,
} from "./scoring";
import type { KnowledgeType, RepetitionState } from "./types";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");

function state(over: Partial<RepetitionState> = {}): RepetitionState {
  return {
    intervalIndex: 0,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    nextReviewAt: new Date(T0).toISOString(),
    ...over,
  };
}

describe("hitungPenguasaan", () => {
  it("is 0 with no attempts", () => {
    expect(hitungPenguasaan([])).toBe(0);
  });

  it("is 1 when everything is correct and there is enough evidence", () => {
    expect(hitungPenguasaan([true, true, true])).toBe(1);
  });

  it("is 0 when everything is wrong", () => {
    expect(hitungPenguasaan([false, false, false])).toBe(0);
  });

  // The confidence cap is the whole point: one lucky answer must not "master".
  it("caps a single correct answer at 0.5", () => {
    expect(hitungPenguasaan([true])).toBe(0.5);
  });

  it("caps two correct answers at 0.8", () => {
    expect(hitungPenguasaan([true, true])).toBe(0.8);
  });

  // Recency weighting is *per-slot*, not "newer always wins" — at a short
  // history the early slots carry the smallest weight (0.5, 0.7), so the first
  // attempts dominate. Verified against DeepTutor's own `compute_mastery`:
  // [F,F,T] → 0.357, [T,T,F] → 0.643. It only starts favouring recovery once
  // the history is long enough for a low-weight old attempt to be outweighed.
  it("rewards recovery once the history is long enough", () => {
    const recovered = hitungPenguasaan([false, false, true, true, true]);
    const regressed = hitungPenguasaan([true, true, true, false, false]);
    expect(recovered).toBeGreaterThan(regressed);
  });

  it("matches DeepTutor's scores for the same histories", () => {
    // Values asserted from the upstream Python implementation.
    expect(hitungPenguasaan([false, false, true])).toBeCloseTo(0.357142857, 8);
    expect(hitungPenguasaan([true, true, false])).toBeCloseTo(0.642857142, 8);
    expect(hitungPenguasaan([true, true, true])).toBe(1);
  });

  it("only considers the last five attempts", () => {
    const withOldFailures = hitungPenguasaan([
      false, false, false, false, false, true, true, true, true, true,
    ]);
    const clean = hitungPenguasaan([true, true, true, true, true]);
    expect(withOldFailures).toBe(clean);
  });

  it("stays within 0..1 for every input shape", () => {
    for (const input of [[], [true], [false], [true, false], [true, true, false, true]]) {
      const score = hitungPenguasaan(input);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe("interval sequences", () => {
  it("matches DeepTutor's table exactly", () => {
    expect(INTERVAL_SEQUENCES).toEqual({
      memory: [0, 1, 3, 7, 14, 30, 60],
      concept: [3, 7, 14, 30],
      procedure: [3, 7, 14],
      design: [14, 28],
    });
  });

  // The UI shows this string; the table drives the actual schedule. If they
  // ever disagree the learner is told a plan the app will not follow, so the
  // label is derived from the table and pinned here.
  it("describes each type's plan from the table itself", () => {
    expect(rentangTinjauan("memory")).toBe("1 → 3 → 7 → 14 → 30 → 60 hari");
    expect(rentangTinjauan("concept")).toBe("3 → 7 → 14 → 30 hari");
    expect(rentangTinjauan("procedure")).toBe("3 → 7 → 14 hari");
    expect(rentangTinjauan("design")).toBe("14 → 28 hari");
  });

  it("never says 'mingguan' for a type whose spacing is not weekly", () => {
    for (const type of ["memory", "concept", "procedure", "design"] as const) {
      expect(rentangTinjauan(type)).not.toMatch(/mingguan|harian/i);
    }
  });

  it("omits the leading zero — an immediate first review is not a spacing", () => {
    // Not "does the string contain a 0" — 30 and 60 legitimately do. The
    // claim is that the first *term* is not zero.
    expect(rentangTinjauan("memory").startsWith("1 →")).toBe(true);
    expect(rentangTinjauan("memory").startsWith("0")).toBe(false);
  });
});

describe("jadwalkanBerikutnya", () => {
  const types: KnowledgeType[] = ["memory", "concept", "procedure", "design"];

  it("starts due immediately for memory and later for design", () => {
    expect(Date.parse(initialRepetitionState("memory", T0).nextReviewAt)).toBe(T0);
    expect(Date.parse(initialRepetitionState("design", T0).nextReviewAt)).toBe(T0 + 14 * DAY_MS);
  });

  it("advances one interval on a single correct answer", () => {
    const next = jadwalkanBerikutnya(initialRepetitionState("concept", T0), "concept", true, T0);
    expect(next.intervalIndex).toBe(1);
    expect(Date.parse(next.nextReviewAt)).toBe(T0 + 7 * DAY_MS);
  });

  // A correct answer moves the index up by one, and the *second* consecutive
  // correct adds a bonus step on top, so a two-in-a-row streak is 0 → 1 → 3.
  // Verified against DeepTutor's `schedule_next`; the "two" is the second
  // answer, not the second interval.
  it("jumps two intervals after two correct in a row", () => {
    const once = jadwalkanBerikutnya(state({ intervalIndex: 0 }), "concept", true, T0);
    expect(once.intervalIndex).toBe(1);
    const twice = jadwalkanBerikutnya(once, "concept", true, T0);
    expect(twice.intervalIndex).toBe(3);
    expect(Date.parse(twice.nextReviewAt)).toBe(T0 + 30 * DAY_MS);
  });

  it("saturates at the end of the sequence on a long streak", () => {
    const third = jadwalkanBerikutnya(
      jadwalkanBerikutnya(
        jadwalkanBerikutnya(state({ intervalIndex: 0 }), "concept", true, T0),
        "concept",
        true,
        T0,
      ),
      "concept",
      true,
      T0,
    );
    expect(third.intervalIndex).toBe(INTERVAL_SEQUENCES.concept.length - 1);
  });

  it("steps back one interval on a wrong answer", () => {
    const next = jadwalkanBerikutnya(state({ intervalIndex: 2 }), "concept", false, T0);
    expect(next.intervalIndex).toBe(1);
  });

  it("never goes below interval 0", () => {
    const next = jadwalkanBerikutnya(state({ intervalIndex: 0 }), "memory", false, T0);
    expect(next.intervalIndex).toBe(0);
  });

  it("never exceeds the last interval of the sequence", () => {
    let current = state({ intervalIndex: 0 });
    for (let i = 0; i < 30; i += 1) {
      current = jadwalkanBerikutnya(current, "concept", true, T0);
    }
    expect(current.intervalIndex).toBe(INTERVAL_SEQUENCES.concept.length - 1);
  });

  it("resets the wrong streak after two consecutive misses", () => {
    const once = jadwalkanBerikutnya(state({ intervalIndex: 3 }), "concept", false, T0);
    expect(once.consecutiveWrong).toBe(1);
    const twice = jadwalkanBerikutnya(once, "concept", false, T0);
    expect(twice.consecutiveWrong).toBe(0);
  });

  it("clears the wrong streak on a correct answer", () => {
    const next = jadwalkanBerikutnya(state({ intervalIndex: 1, consecutiveWrong: 1 }), "concept", true, T0);
    expect(next.consecutiveWrong).toBe(0);
  });

  it("always produces a parseable future timestamp for every type", () => {
    for (const type of types) {
      const next = jadwalkanBerikutnya(initialRepetitionState(type, T0), type, true, T0);
      expect(Number.isNaN(Date.parse(next.nextReviewAt))).toBe(false);
      expect(Date.parse(next.nextReviewAt)).toBeGreaterThanOrEqual(T0);
    }
  });
});

describe("review queue", () => {
  it("puts a point with an active error ahead of an ordinary one", () => {
    const states = { kp_a: state(), kp_b: state() };
    const types = { kp_a: "memory" as const, kp_b: "memory" as const };
    const queue = bangunAntreanTinjauan(states, types, ["kp_b"]);
    expect(queue.find((task) => task.knowledgePointId === "kp_b")?.priority).toBe(1);
  });

  it("defaults an unknown knowledge type to memory", () => {
    const queue = bangunAntreanTinjauan({ kp_x: state() }, {}, []);
    expect(queue[0]?.knowledgeType).toBe("memory");
  });

  it("returns only what is due, priority first, capped at maxTasks", () => {
    const now = T0 + 5 * DAY_MS;
    const tasks = [
      { id: "r1", knowledgePointId: "a", knowledgeType: "procedure" as const, dueAt: new Date(T0).toISOString(), priority: 4, state: state() },
      { id: "r2", knowledgePointId: "b", knowledgeType: "memory" as const, dueAt: new Date(T0).toISOString(), priority: 2, state: state() },
      { id: "r3", knowledgePointId: "c", knowledgeType: "concept" as const, dueAt: new Date(now + DAY_MS).toISOString(), priority: 3, state: state() },
    ];
    const due = antreanJatuhTempo(tasks, now, 5);
    expect(due.map((task) => task.knowledgePointId)).toEqual(["b", "a"]);
    expect(antreanJatuhTempo(tasks, now, 1)).toHaveLength(1);
  });

  it("is empty when nothing is due yet", () => {
    const future = new Date(T0 + 99 * DAY_MS).toISOString();
    expect(antreanJatuhTempo([{ id: "r", knowledgePointId: "a", knowledgeType: "memory", dueAt: future, priority: 2, state: state() }], T0)).toEqual([]);
  });
});
