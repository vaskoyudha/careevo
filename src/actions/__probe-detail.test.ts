import { writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// PROBE ONLY — runs the real popup action against the repo's real data root,
// with only the session stubbed (the action's only out-of-scope dependency).
const SESI = {
  userId: "probe",
  email: "user@careevo.test",
  nama: "U",
  username: "u",
  role: "user" as const,
  roles: ["user"],
};

const out: Record<string, unknown> = {};

afterEach(() => {
  vi.doUnmock("@/lib/auth/session");
  vi.resetModules();
});

describe("probe detail action", () => {
  it("runs for a real inbox url", async () => {
    vi.doMock("@/lib/auth/session", () => ({ getSession: async () => SESI }));
    const { detailLokerInboxAction } = await import("@/actions/loker-inbox-persiapan");

    const urls = [
      "https://akar-inti-teknologi.breezy.hr/p/223a0c298ec0-devops-engineer",
      "https://akar-inti-teknologi.breezy.hr/p/baef2f21f8fb-mobile-engineer-ios",
      "https://akar-inti-teknologi.breezy.hr/p/ef839266e4da-software-engineer-java",
    ];
    out.hasil = [];
    for (const url of urls) {
      const r = await detailLokerInboxAction(url);
      (out.hasil as unknown[]).push(
        r.ok
          ? { url, ok: true, status: r.status, kursus: r.kursus.length, bisaJalur: r.bisaJalur }
          : { url, ok: false, pesan: r.pesan },
      );
    }
    writeFileSync("/tmp/probe-detail.json", JSON.stringify(out, null, 2));
    expect(Array.isArray(out.hasil)).toBe(true);
  }, 60000);
});
