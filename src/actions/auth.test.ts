import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { loginAction, registerAction } from "./auth";
import type { StoredUser } from "@/lib/auth/user-store";

/**
 * The auth actions are Server Actions: POST endpoints, reachable by anyone who
 * can send the request regardless of what the UI renders. These tests drive them
 * the way an attacker would — a hand-built `FormData`, and a direct call — and
 * assert the outcome that actually matters (which role got persisted), not just
 * the returned state.
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

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

/** Minimal signed-cookie decoder: enough to read what the action persisted. */
function bacaCookiePayload<T>(name: string): T | null {
  const raw = jar.get(name);
  if (!raw) return null;
  const body = raw.split(".")[0];
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
}

function penggunaTersimpan(): StoredUser[] {
  return bacaCookiePayload<StoredUser[]>("ls_users") ?? [];
}

function sesiTersimpan(): { role: string; email: string } | null {
  return bacaCookiePayload<{ role: string; email: string }>("ls_session");
}

/** `registerAction` ends in `redirect`, which throws by design. */
async function jalankanRegistered(form: FormData): Promise<void> {
  try {
    await registerAction({ ok: false }, form);
    throw new Error("registerAction seharusnya mengalihkan halaman (redirect).");
  } catch (error) {
    if (isRedirectError(error)) return;
    throw error;
  }
}

const PENDAFTARAN = {
  nama: "Rina Wati",
  username: "rinawati",
  email: "rina@contoh.test",
  password: "rahasia-panjang",
  consent: "on",
};

describe("registerAction — role containment", () => {
  beforeEach(() => {
    jar.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("membuat akun learner dari form biasa", async () => {
    await jalankanRegistered(formData(PENDAFTARAN));

    expect(penggunaTersimpan()).toHaveLength(1);
    expect(penggunaTersimpan()[0].role).toBe("user");
    expect(sesiTersimpan()?.role).toBe("user");
  });

  it("mengabaikan field role yang dimodifikasi dan tetap membuat learner", async () => {
    // Serangan yang sebenarnya: kirim `role=verifikator` seperti yang dulu
    // disediakan form. Server Action tidak boleh memercayai FormData.
    await jalankanRegistered(
      formData({ ...PENDAFTARAN, role: "verifikator" }),
    );

    expect(penggunaTersimpan()).toHaveLength(1);
    expect(penggunaTersimpan()[0].role).toBe("user");
    expect(sesiTersimpan()?.role).toBe("user");
  });

  it("menolak juga saat role admin dipaksakan", async () => {
    await jalankanRegistered(formData({ ...PENDAFTARAN, role: "admin" }));
    expect(penggunaTersimpan()[0]?.role).toBe("user");
  });

  it("tidak menulis akun staff ketika FormData role dikirim berulang", async () => {
    const form = formData(PENDAFTARAN);
    form.append("role", "verifikator");
    form.append("role", "admin");

    await jalankanRegistered(form);

    expect(penggunaTersimpan().every((user) => user.role === "user")).toBe(true);
  });

  it("menolak email akun demo", async () => {
    const res = await registerAction(
      { ok: false },
      formData({ ...PENDAFTARAN, email: "admin@careevo.test" }),
    );

    expect(res.ok).toBe(false);
    expect(res.errors?.email).toContain("demo");
    expect(penggunaTersimpan()).toHaveLength(0);
  });
});

describe("loginAction — demo account gate", () => {
  beforeEach(() => {
    jar.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("menerima akun demo di development dengan DEMO_MODE=1", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_MODE", "1");

    try {
      await loginAction({ ok: false }, formData({ email: "admin@careevo.test", password: "careevo" }));
      throw new Error("loginAction seharusnya mengalihkan halaman (redirect).");
    } catch (error) {
      if (!isRedirectError(error)) throw error;
    }

    expect(sesiTersimpan()?.role).toBe("admin");
  });

  it("menolak akun demo di development biasa tanpa opt-in DEMO_MODE", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_MODE", "");

    const res = await loginAction(
      { ok: false },
      formData({ email: "admin@careevo.test", password: "careevo" }),
    );

    // Fail-closed: `npm run dev` tanpa flag tidak menerima kredensial yang
    // dipublikasikan di repositori.
    expect(res.ok).toBe(false);
    expect(jar.has("ls_session")).toBe(false);
  });

  it("menolak akun demo di production walau password benar", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "1");

    const res = await loginAction(
      { ok: false },
      formData({ email: "admin@careevo.test", password: "careevo" }),
    );

    expect(res.ok).toBe(false);
    // Tidak ada sesi yang ditulis: akun demo bukan jalan masuk di staging/produksi.
    expect(jar.has("ls_session")).toBe(false);
  });

  it("tidak menyarankan akun demo saat login gagal di production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "1");

    const res = await loginAction(
      { ok: false },
      formData({ email: "salah@contoh.test", password: "apa-saja-panjang" }),
    );

    // Pesan error tidak boleh mengarahkan orang ke kredensial yang justru
    // ditolak server.
    expect(res.ok).toBe(false);
    expect(res.message).not.toContain("demo");
  });

  it("tidak menyarankan akun demo di development tanpa opt-in", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_MODE", "");

    const res = await loginAction(
      { ok: false },
      formData({ email: "salah@contoh.test", password: "apa-saja-panjang" }),
    );

    expect(res.ok).toBe(false);
    expect(res.message).not.toContain("demo");
  });

  it("tetap menyebut akun demo saat login gagal di development dengan DEMO_MODE=1", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_MODE", "1");

    const res = await loginAction(
      { ok: false },
      formData({ email: "salah@contoh.test", password: "apa-saja-panjang" }),
    );

    expect(res.message).toContain("demo");
  });
});
