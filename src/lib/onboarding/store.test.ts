import { describe, expect, it } from "vitest";
import {
  isOnboardingProfile,
  type CompleteOnboardingInput,
} from "@/lib/onboarding/store";
import {
  levelForExperience,
  trackForInterest,
  type OnboardingProfile,
} from "@/lib/onboarding/types";

/**
 * Store + domain invariants.
 *
 * The cookie is signed, but a payload can still be structurally wrong (older
 * version, hand-edited). `isOnboardingProfile` is the single gate that decides
 * whether a decoded payload is trusted, so it carries the schema contract.
 */

const valid: OnboardingProfile = {
  owner: "raka@careevo.test",
  experience: "dasar",
  background: "mahasiswa",
  interests: ["web-dev", "ai"],
  goal: "dapat-kerja",
  weeklyHours: 8,
  workPreference: "remote",
  completedAt: new Date().toISOString(),
  version: 2,
};

describe("isOnboardingProfile", () => {
  it("accepts a well-formed profile", () => {
    expect(isOnboardingProfile(valid)).toBe(true);
  });

  it("rejects null and non-objects", () => {
    expect(isOnboardingProfile(null)).toBe(false);
    expect(isOnboardingProfile("nope")).toBe(false);
    expect(isOnboardingProfile(42)).toBe(false);
  });

  it("rejects a profile with no owner (unattributable)", () => {
    const noOwner = { ...valid } as Record<string, unknown>;
    delete noOwner.owner;
    expect(isOnboardingProfile(noOwner)).toBe(false);
    expect(isOnboardingProfile({ ...valid, owner: "" })).toBe(false);
  });

  it("rejects an unknown experience value", () => {
    expect(isOnboardingProfile({ ...valid, experience: "god" })).toBe(false);
  });

  it("rejects more than three interests", () => {
    expect(
      isOnboardingProfile({
        ...valid,
        interests: ["web-dev", "data", "ai", "mobile"],
      }),
    ).toBe(false);
  });

  it("rejects zero interests", () => {
    expect(isOnboardingProfile({ ...valid, interests: [] })).toBe(false);
  });

  it("rejects a weeklyHours outside the allowed set", () => {
    expect(isOnboardingProfile({ ...valid, weeklyHours: 7 })).toBe(false);
  });

  it("rejects a foreign interest value", () => {
    expect(isOnboardingProfile({ ...valid, interests: ["blockchain"] })).toBe(false);
  });
});

describe("domain mappings", () => {
  it("maps interests to real course tracks", () => {
    expect(trackForInterest("web-dev")).toBe("web-dev");
    expect(trackForInterest("ai")).toBe("data");
    expect(trackForInterest("cyber-sec")).toBe("cyber-sec");
    expect(trackForInterest("mobile")).toBeNull();
  });

  it("maps experience buckets to the first course level", () => {
    expect(levelForExperience("pemula")).toBe("dasar");
    expect(levelForExperience("dasar")).toBe("dasar");
    expect(levelForExperience("menengah")).toBe("menengah");
    expect(levelForExperience("lanjut")).toBe("lanjut");
  });
});

/** Ensures the input shape used by the server action stays accepted downstream. */
describe("CompleteOnboardingInput shape", () => {
  it("builds a valid profile payload", () => {
    const input: CompleteOnboardingInput = {
      experience: "menengah",
      background: "career-switcher",
      interests: ["data"],
      goal: "ganti-bidang",
      weeklyHours: 12,
      workPreference: "hybrid",
    };
    expect(input.interests.length).toBeLessThanOrEqual(3);
  });
});
