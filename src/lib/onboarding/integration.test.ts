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

const OWNER = "raka@careevo.test";

describe("onboarding store round-trip", () => {
  beforeEach(() => {
    jar.clear();
  });

  it("starts with no profile", async () => {
    expect(await hasProfile(OWNER)).toBe(false);
    expect(await getProfile(OWNER)).toBeNull();
  });

  it("saves then reads back an identical, version-stamped profile", async () => {
    const saved = await saveProfile({ ...sample, interests: [...sample.interests] }, OWNER);
    expect(saved.version).toBe(2);
    expect(saved.owner).toBe(OWNER);
    expect(saved.completedAt).toBeTruthy();

    const loaded = await getProfile(OWNER);
    expect(loaded).not.toBeNull();
    expect(loaded!.experience).toBe("menengah");
    expect(loaded!.interests).toEqual(["data", "ai"]);
    expect(await hasProfile(OWNER)).toBe(true);
  });

  it("does not leak one account's profile to another on the same browser", async () => {
    await saveProfile({ ...sample, interests: [...sample.interests] }, OWNER);

    // A different account signing in on the same browser must look un-onboarded.
    expect(await hasProfile("other@careevo.test")).toBe(false);
    expect(await getProfile("other@careevo.test")).toBeNull();
    // ...but the owner still sees theirs.
    expect(await hasProfile(OWNER)).toBe(true);
  });

  it("matches owners case-insensitively", async () => {
    await saveProfile({ ...sample, interests: [...sample.interests] }, "Raka@Careevo.TEST");
    expect(await hasProfile("raka@careevo.test")).toBe(true);
  });

  it("rejects a tampered payload (signature mismatch)", async () => {
    await saveProfile({ ...sample, interests: [...sample.interests] }, OWNER);
    const token = jar.get(PROFILE_COOKIE)!;
    const [body, sig] = token.split(".");

    // Forge a body claiming admin-level interests but keep the old signature.
    const forged = Buffer.from(
      JSON.stringify({ ...sample, interests: ["cyber-sec"] }),
    ).toString("base64url");
    jar.set(PROFILE_COOKIE, `${forged}.${sig}`);

    expect(await getProfile(OWNER)).toBeNull();
    // sanity: original body/sig pair is not simply re-derivable
    expect(body).not.toBe(forged);
  });

  it("clears the profile so onboarding can re-run", async () => {
    await saveProfile({ ...sample, interests: [...sample.interests] }, OWNER);
    expect(await hasProfile(OWNER)).toBe(true);
    await clearProfile();
    expect(await hasProfile(OWNER)).toBe(false);
  });
});
