import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, cari, simpan, hapus, jar } = vi.hoisted(() => {
  const cookies = new Map<string, string>();
  return {
    db: {},
    cari: vi.fn(),
    simpan: vi.fn(),
    hapus: vi.fn(),
    jar: {
      get: vi.fn((name: string) => {
        const value = cookies.get(name);
        return value === undefined ? undefined : { name, value };
      }),
      set: vi.fn((name: string, value: string) => {
        if (value) cookies.set(name, value);
        else cookies.delete(name);
      }),
      clear: () => cookies.clear(),
    },
  };
});

vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("@/lib/db/client", () => ({
  getDb: () => db,
  denganTransaksi: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
}));
vi.mock("@/lib/onboarding/profile-repository", () => ({
  cariProfilOnboarding: cari,
  simpanProfilOnboarding: simpan,
  hapusProfilOnboarding: hapus,
}));

const { clearProfile, getProfile, hasProfile, saveProfile, PROFILE_COOKIE } = await import(
  "@/lib/onboarding/store"
);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "learner@example.test";
const sample = {
  experience: "menengah" as const,
  background: "career-switcher" as const,
  interests: ["data", "ai"] as const,
  goal: "ganti-bidang",
  weeklyHours: 12,
  workPreference: "remote" as const,
};

describe("onboarding store backed by PostgreSQL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jar.clear();
    cari.mockResolvedValue(undefined);
    simpan.mockResolvedValue(undefined);
    hapus.mockResolvedValue(true);
  });

  it("reads a profile row by stable user id", async () => {
    const completedAt = new Date("2026-09-27T10:00:00.000Z");
    cari.mockResolvedValue({ ...sample, interests: [...sample.interests], completedAt, version: 2 });
    await expect(getProfile(USER_ID, EMAIL)).resolves.toEqual({
      ...sample,
      owner: EMAIL,
      interests: [...sample.interests],
      completedAt: completedAt.toISOString(),
      version: 2,
    });
    expect(cari).toHaveBeenCalledWith(db, USER_ID);
    expect(await hasProfile(USER_ID, EMAIL)).toBe(true);
  });

  it("does not treat a missing database profile as complete", async () => {
    expect(await hasProfile(USER_ID, EMAIL)).toBe(false);
    expect(cari).toHaveBeenCalledWith(db, USER_ID);
  });

  it("persists answers under the account id, retaining email for personalization", async () => {
    const profile = await saveProfile({ ...sample, interests: [...sample.interests] }, USER_ID, EMAIL);
    expect(profile.owner).toBe(EMAIL);
    expect(simpan).toHaveBeenCalledWith(
      db,
      USER_ID,
      expect.objectContaining({ interests: [...sample.interests], version: 2 }),
    );
  });

  it("migrates a signed legacy cookie only for its matching account", async () => {
    const profile = { ...sample, interests: [...sample.interests], owner: EMAIL, completedAt: new Date().toISOString(), version: 2 };
    const body = Buffer.from(JSON.stringify(profile)).toString("base64url");
    const { createHmac } = await import("node:crypto");
    const { bacaSecret } = await import("@/lib/config/secrets");
    const signature = createHmac("sha256", bacaSecret("SESSION_SECRET")).update(body).digest("base64url");
    jar.set(PROFILE_COOKIE, `${body}.${signature}`);

    await expect(getProfile(USER_ID, EMAIL)).resolves.toMatchObject({ owner: EMAIL });
    expect(simpan).toHaveBeenCalledWith(db, USER_ID, expect.objectContaining({ goal: sample.goal }));
    expect(jar.get(PROFILE_COOKIE)).toBeUndefined();
  });

  it("does not migrate a legacy cookie belonging to another email", async () => {
    const profile = { ...sample, interests: [...sample.interests], owner: "other@example.test", completedAt: new Date().toISOString(), version: 2 };
    const body = Buffer.from(JSON.stringify(profile)).toString("base64url");
    const { createHmac } = await import("node:crypto");
    const { bacaSecret } = await import("@/lib/config/secrets");
    const signature = createHmac("sha256", bacaSecret("SESSION_SECRET")).update(body).digest("base64url");
    jar.set(PROFILE_COOKIE, `${body}.${signature}`);

    expect(await getProfile(USER_ID, EMAIL)).toBeNull();
    expect(simpan).not.toHaveBeenCalled();
  });

  it("resets the authenticated account's database profile", async () => {
    await clearProfile(USER_ID);
    expect(hapus).toHaveBeenCalledWith(db, USER_ID);
    expect(jar.set).toHaveBeenCalledWith(PROFILE_COOKIE, "", expect.objectContaining({ maxAge: 0 }));
  });
});
