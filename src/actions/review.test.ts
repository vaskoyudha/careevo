import { describe, expect, it, vi, beforeEach } from "vitest";
import { decideReview } from "./review";
import * as sessionModule from "@/lib/auth/session";
import { principalUji } from "@/lib/auth/test-principal";
import type { Role } from "@/lib/auth/types";

/**
 * `decideReview` used to issue HMAC attestations from fields the browser sent
 * (username, task title, score) with no principal check at all. A Server Action
 * is a POST endpoint, so the `/review` layout gated nothing: anyone could mint a
 * credential for any username and score. These tests call the action directly —
 * the way an attacker would — and assert no credential comes out.
 */

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value ? { value } : undefined;
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function sesi(role: Role) {
  return principalUji({ email: `${role}@careevo.test`, role, nama: role, username: role });
}

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

/** What the old vulnerability let anyone ask for. */
const KLAIM = {
  decision: "approved",
  reason: "Hasil karya saya sudah bagus dan lengkap.",
  total: "100",
  username: "budi",
  task_title: "Rebuild Landing Page",
};

describe("decideReview — staff gate", () => {
  beforeEach(() => {
    jar.clear();
    vi.restoreAllMocks();
  });

  it("menolak pemanggilan tanpa sesi dan tidak menerbitkan token", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);

    const res = await decideReview({ ok: false }, formData(KLAIM));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    // Tidak ada field attestation sama sekali — bukan hanya kosong.
    expect(res).not.toHaveProperty("token");
  });

  it("menolak learner yang mencoba menerbitkan attestation untuk dirinya sendiri", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));

    const res = await decideReview({ ok: false }, formData(KLAIM));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    // Tidak ada field attestation sama sekali — bukan hanya kosong.
    expect(res).not.toHaveProperty("token");
  });

  it("menolak learner bahkan untuk keputusan non-approve", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("user"));

    const res = await decideReview(
      { ok: false },
      formData({ ...KLAIM, decision: "revision" }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
    // Tidak ada field attestation sama sekali — bukan hanya kosong.
    expect(res).not.toHaveProperty("token");
  });

  it("menerima verifikator untuk keputusan non-approve dan tidak mengklaim tersimpan", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("verifikator"));

    const res = await decideReview(
      { ok: false },
      formData({ ...KLAIM, decision: "revision" }),
    );

    expect(res.ok).toBe(true);
    // Pesan tidak boleh mengklaim audit log/database terisi: `logAudit` masih
    // stub dan belum ada store review sebelum Fase 3.
    expect(res.message).not.toMatch(/tercatat di audit log/i);
    expect(res.message).toMatch(/belum tersimpan/i);
  });

  it("menerima admin untuk keputusan non-approve dan tidak mengklaim tersimpan", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("admin"));

    const res = await decideReview(
      { ok: false },
      formData({ ...KLAIM, decision: "rejected" }),
    );

    expect(res.ok).toBe(true);
    expect(res.message).not.toMatch(/tercatat di audit log/i);
    expect(res.message).toMatch(/belum tersimpan/i);
  });

  it("menolak keputusan yang tidak sah meski staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("admin"));

    const res = await decideReview(
      { ok: false },
      formData({ ...KLAIM, decision: "menerima-suap", reason: "Ini alasan yang cukup panjang." }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Keputusan tidak valid");
  });

  it("menolak alasan yang terlalu pendek meski staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("admin"));

    const res = await decideReview({ ok: false }, formData({ ...KLAIM, reason: "oke" }));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Alasan wajib diisi");
  });
});

describe("decideReview — attestation issuance is disabled", () => {
  beforeEach(() => {
    jar.clear();
    vi.restoreAllMocks();
  });

  // Fase 0 stops issuance entirely: a valid credential has to be derived from a
  // server-side review record, and no such record exists before Fase 3. An
  // authorized staff call therefore gets an explicit refusal, not a token.
  it("tidak menerbitkan token meski dipanggil staff yang sah", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("verifikator"));

    const res = await decideReview({ ok: false }, formData(KLAIM));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("belum aktif");
    expect(res).not.toHaveProperty("token");
  });

  it("menolak klaim skor dari browser alih-alih menandatanganinya", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi("admin"));

    // Skor 100 dari klien: dulu langsung masuk ke payload attestation.
    const res = await decideReview({ ok: false }, formData({ ...KLAIM, total: "100" }));

    expect(JSON.stringify(res)).not.toContain("100");
  });
});
