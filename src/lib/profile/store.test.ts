import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration test for the editable public-profile store.
 *
 * Same approach as `src/lib/onboarding/integration.test.ts`: `next/headers` is
 * unavailable under vitest, so the cookie jar is an in-memory Map. This covers
 * the round-trip the server action relies on — save → sign → read → validate —
 * plus owner scoping (so a profile never leaks across accounts) and reset.
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
  getEditableProfile,
  saveEditableProfile,
  clearEditableProfile,
  PUBLIC_PROFILE_COOKIE,
} = await import("@/lib/profile/store");

const input = {
  firstName: "Raka",
  lastName: "Pratama",
  username: "raka",
  website: "raka.dev",
  bio: "Frontend learner.",
  avatarUrl: "data:image/jpeg;base64,AAAA",
  coverUrl: "",
};

const OWNER = "raka@careevo.test";

beforeEach(() => {
  jar.clear();
});

describe("profile store", () => {
  it("returns null when nothing is stored", async () => {
    expect(await getEditableProfile()).toBeNull();
  });

  it("round-trips a saved profile", async () => {
    await saveEditableProfile(input, OWNER);
    const read = await getEditableProfile(OWNER);

    expect(read).not.toBeNull();
    expect(read?.firstName).toBe("Raka");
    expect(read?.lastName).toBe("Pratama");
    expect(read?.username).toBe("raka");
    expect(read?.website).toBe("raka.dev");
    expect(read?.bio).toBe("Frontend learner.");
    expect(read?.avatarUrl).toBe("data:image/jpeg;base64,AAAA");
    expect(read?.coverUrl).toBe("");
    expect(read?.version).toBe(1);
  });

  it("normalizes owner (lowercase) and strips @ from username", async () => {
    await saveEditableProfile({ ...input, username: "@Raka" }, "  RAKA@careevo.test ");
    const read = await getEditableProfile("raka@careevo.test");
    expect(read?.username).toBe("Raka");
    expect(read?.owner).toBe("raka@careevo.test");
  });

  it("is owner-scoped: another account does not inherit it", async () => {
    await saveEditableProfile(input, OWNER);
    expect(await getEditableProfile("lain@careevo.test")).toBeNull();
    expect(await getEditableProfile(OWNER)).not.toBeNull();
  });

  it("rejects a tampered cookie", async () => {
    await saveEditableProfile(input, OWNER);
    const raw = jar.get(PUBLIC_PROFILE_COOKIE)!;
    const [body, sig] = raw.split(".");
    jar.set(PUBLIC_PROFILE_COOKIE, `${body}.${sig.slice(0, -2)}xx`);
    expect(await getEditableProfile(OWNER)).toBeNull();
  });

  it("clears the profile", async () => {
    await saveEditableProfile(input, OWNER);
    await clearEditableProfile();
    expect(await getEditableProfile(OWNER)).toBeNull();
  });
});
