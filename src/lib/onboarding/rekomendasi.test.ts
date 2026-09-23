import { describe, expect, it } from "vitest";
import {
  rekomendasiKursus,
  rekomendasiLoker,
  skorKursus,
  skorLoker,
} from "@/lib/onboarding/rekomendasi";
import { katalogBelajar, type EntriKatalog } from "@/lib/courses/katalog";
import { jobs } from "@/lib/fixtures";
import type { OnboardingProfile } from "@/lib/onboarding/types";

const base: OnboardingProfile = {
  experience: "dasar",
  background: "mahasiswa",
  interests: ["web-dev"],
  goal: "dapat-kerja",
  weeklyHours: 8,
  workPreference: "remote",
  completedAt: "2026-09-01T00:00:00.000Z",
  version: 1,
};

describe("skorKursus", () => {
  it("scores 0 for a course whose track is outside the learner's interests", () => {
    const kursus: EntriKatalog = {
      id: "x",
      slug: "x",
      title: "OWASP Security",
      url: "u",
      provider: "p",
      type: "course",
      tags: ["Security"],
      level: "dasar",
      is_free: true,
      duration_min: 60,
      completed: false,
      // @ts-expect-error track is not part of EntriKatalog but is read by the scorer
      track: "cyber-sec",
    };
    expect(skorKursus(kursus, base)).toBe(0);
  });

  it("scores a matching-track course positively", () => {
    const kursus: EntriKatalog = {
      id: "y",
      slug: "y",
      title: "React Fundamentals",
      url: "u",
      provider: "p",
      type: "course",
      tags: ["React"],
      level: "dasar",
      is_free: true,
      duration_min: 120,
      completed: false,
      // @ts-expect-error see above
      track: "web-dev",
    };
    expect(skorKursus(kursus, base)).toBeGreaterThan(0);
  });

  it("prefers a matching level over a distant one", () => {
    const make = (level: EntriKatalog["level"]): EntriKatalog => ({
      id: level,
      slug: level,
      title: level,
      url: "u",
      provider: "p",
      type: "course",
      tags: [],
      level,
      is_free: true,
      duration_min: 90,
      completed: false,
      // @ts-expect-error test-only track injection
      track: "web-dev",
    });
    expect(skorKursus(make("dasar"), base)).toBeGreaterThan(skorKursus(make("lanjut"), base));
  });
});

describe("skorLoker", () => {
  it("rewards a job whose tags match the interest", () => {
    const frontend = jobs.find((j) => j.tags.includes("React"))!;
    expect(skorLoker(frontend, base)).toBeGreaterThan(0);
  });

  it("ignores an unrelated job", () => {
    const unrelated = {
      ...jobs[0],
      title: "Sales Executive",
      tags: ["Sales"],
      description: "Menjual produk.",
      location: "Onsite",
      level: "lanjut" as const,
    };
    expect(skorLoker(unrelated, base)).toBe(0);
  });
});

describe("rekomendasi*", () => {
  it("ranks real catalog entries, highest first, capped at the limit", async () => {
    const katalog = await katalogBelajar();
    const hasil = rekomendasiKursus(katalog, base, 3);
    expect(hasil.length).toBeLessThanOrEqual(3);
    // Every returned entry must score > 0 (no out-of-scope noise).
    for (const entry of hasil) {
      expect(skorKursus(entry, base)).toBeGreaterThan(0);
    }
    // Descending order by score.
    const scores = hasil.map((e) => skorKursus(e, base));
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it("surfaces web-dev jobs for a web-dev learner", () => {
    const hasil = rekomendasiLoker(jobs, base, 4);
    expect(hasil.length).toBeGreaterThan(0);
    expect(hasil.every((j) => j.sentinel_status !== "rejected")).toBe(true);
  });

  it("is deterministic across calls", () => {
    const a = rekomendasiLoker(jobs, base, 4).map((j) => j.id);
    const b = rekomendasiLoker(jobs, base, 4).map((j) => j.id);
    expect(a).toEqual(b);
  });

  it("returns nothing when no interest aligns (empty interest is impossible, but a mismatched one is not)", () => {
    const gameOnly: OnboardingProfile = { ...base, interests: ["game-dev"] };
    const hasil = rekomendasiLoker(jobs, gameOnly, 4);
    // The fixture has no game-dev postings → empty is the correct answer.
    expect(hasil).toEqual([]);
  });
});
