import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end-ish integration for the onboarding store.
 *
 * `next/headers` is unavailable under vitest (node env), so we mock the cookie
 * jar with an in-memory Map. This exercises the full round-trip the server
 * action relies on: save → sign → read → validate, plus tamper rejection and
 * reset. It is the closest we can get to the real cookie flow without a browser.
 */

const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
  }),
}));

const {
  getProfile,
  saveProfile,
  hasProfile,
  clearProfile,
  PROFILE_COOKIE,
} = await import("@/lib/onboarding/store");

const sample = {
  experience: "menengah" as const,
  background: "career-switcher" as const,
  interests: ["data", "ai"] as const,
  goal: "ganti-bidang",
  weeklyHours: 12,
  workPreference: "remote" as const,
};

describe("onboarding store round-trip", () => {
  beforeEach(() => {
    jar.clear();
  });

  it("starts with no profile", async () => {
    expect(await hasProfile()).toBe(false);
    expect(await getProfile()).toBeNull();
  });

  it("saves then reads back an identical, version-stamped profile", async () => {
    const saved = await saveProfile({ ...sample, interests: [...sample.interests] });
    expect(saved.version).toBe(1);
    expect(saved.completedAt).toBeTruthy();

    const loaded = await getProfile();
    expect(loaded).not.toBeNull();
    expect(loaded!.experience).toBe("menengah");
    expect(loaded!.interests).toEqual(["data", "ai"]);
    expect(await hasProfile()).toBe(true);
  });

  it("rejects a tampered payload (signature mismatch)", async () => {
    await saveProfile({ ...sample, interests: [...sample.interests] });
    const token = jar.get(PROFILE_COOKIE)!;
    const [body, sig] = token.split(".");

    // Forge a body claiming admin-level interests but keep the old signature.
    const forged = Buffer.from(
      JSON.stringify({ ...sample, interests: ["cyber-sec"] }),
    ).toString("base64url");
    jar.set(PROFILE_COOKIE, `${forged}.${sig}`);

    expect(await getProfile()).toBeNull();
    // sanity: original body/sig pair is not simply re-derivable
    expect(body).not.toBe(forged);
  });

  it("clears the profile so onboarding can re-run", async () => {
    await saveProfile({ ...sample, interests: [...sample.interests] });
    expect(await hasProfile()).toBe(true);
    await clearProfile();
    expect(await hasProfile()).toBe(false);
  });
});
