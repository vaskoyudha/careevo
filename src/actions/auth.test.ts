import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { loginAction, registerAction } from "./auth";
import type { SessionPrincipal } from "@/lib/auth/principal";

/**
 * The auth actions are Server Actions: POST endpoints, reachable by anyone who
 * can send the request regardless of what the UI renders. These tests drive them
 * the way an attacker would — a hand-built `FormData`, and a direct call — and
 * assert the *decision* the action makes (which input reaches the service, and
 * what it refuses before the service is ever called).
 *
 * `registerAction`/`loginAction` now delegate to the database-backed
 * `auth-service`. That service is mocked here: this file tests the action's
 * *boundary* (role never read from `FormData`, rate limit counted before
 * validation, demo messaging gated on environment), not the database. The
 * database behaviour — email/username uniqueness, concurrent signup, session
 * revocation — lives in `src/lib/auth/auth-service.integration.test.ts`.
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
  headers: async () => new Headers(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * Pembatas di-mock karena yang diuji bukan algoritma Redis-nya (itu di
 * `src/lib/rate-limit/`), melainkan **urutan** penolakan: request cacat pun
 * tetap harus dihitung sebelum validasi, dan email kiriman klien tidak boleh
 * menjadi kunci.
 */
const mocks = vi.hoisted(() => ({
  cekBatasiAksi: vi.fn(),
  daftarPengguna: vi.fn(),
  authenticatePengguna: vi.fn(),
  terbitkanSesi: vi.fn(),
  pasangCookieSesi: vi.fn(),
  destroySession: vi.fn(),
  bacaTokenSesi: vi.fn(),
  landingFor: vi.fn(),
}));

vi.mock("@/lib/rate-limit/next", () => ({ cekBatasiAksi: mocks.cekBatasiAksi }));

vi.mock("@/lib/auth/auth-service", () => ({
  daftarPengguna: mocks.daftarPengguna,
  authenticatePengguna: mocks.authenticatePengguna,
  terbitkanSesi: mocks.terbitkanSesi,
  keluarSession: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  pasangCookieSesi: mocks.pasangCookieSesi,
  destroySession: mocks.destroySession,
  bacaTokenSesi: mocks.bacaTokenSesi,
}));

vi.mock("@/lib/auth/landing", () => ({ landingFor: mocks.landingFor }));

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
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

function principal(roles: string[] = ["user"]): SessionPrincipal {
  return {
    userId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    roles: roles as SessionPrincipal["roles"],
    role: roles.includes("admin") ? "admin" : roles.includes("verifikator") ? "verifikator" : "user",
    nama: "Rina Wati",
    email: "rina@contoh.test",
    username: "rinawati",
    iat: 1_700_000_000_000,
  };
}

const PENDAFTARAN = {
  nama: "Rina Wati",
  username: "rinawati",
  email: "rina@contoh.test",
  password: "rahasia-panjang",
  consent: "on",
};

beforeEach(() => {
  jar.clear();
  vi.restoreAllMocks();
  mocks.cekBatasiAksi.mockReset().mockResolvedValue(null);
  mocks.daftarPengguna.mockReset();
  mocks.authenticatePengguna.mockReset();
  mocks.terbitkanSesi.mockReset().mockResolvedValue("token-opaque");
  mocks.pasangCookieSesi.mockReset();
  mocks.destroySession.mockReset();
  mocks.bacaTokenSesi.mockReset().mockResolvedValue(null);
  mocks.landingFor.mockReset().mockResolvedValue("/dashboard");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("registerAction — role containment", () => {
  it("mendelegasikan ke service tanpa membawa role sama sekali", async () => {
    mocks.daftarPengguna.mockResolvedValue({ ok: true, principal: principal(["user"]) });

    await jalankanRegistered(formData(PENDAFTARAN));

    expect(mocks.daftarPengguna).toHaveBeenCalledTimes(1);
    // Nilai role dari FormData tidak pernah sampai ke service: `daftarPengguna`
    // hanya menerima { nama, username, email, password }, dan peran defaultnya
    // (learner) ditetapkan service — bukan dibaca dari browser.
    expect(mocks.daftarPengguna.mock.calls[0][0]).not.toHaveProperty("role");
    expect(mocks.terbitkanSesi).toHaveBeenCalled();
    expect(mocks.pasangCookieSesi).toHaveBeenCalledWith("token-opaque");
  });

  it("mengabaikan field role yang dimodifikasi — service tetap dipanggil tanpa role", async () => {
    mocks.daftarPengguna.mockResolvedValue({ ok: true, principal: principal(["user"]) });

    // Serangan yang sebenarnya: kirim `role=verifikator`/`admin` di FormData.
    // Server Action tidak boleh memercayainya.
    await jalankanRegistered(formData({ ...PENDAFTARAN, role: "verifikator" }));
    await jalankanRegistered(formData({ ...PENDAFTARAN, role: "admin" }));

    expect(mocks.daftarPengguna).toHaveBeenCalledTimes(2);
    for (const call of mocks.daftarPengguna.mock.calls) {
      expect(call[0]).not.toHaveProperty("role");
    }
  });

  it("menolak email akun demo sebelum menyentuh service", async () => {
    const res = await registerAction(
      { ok: false },
      formData({ ...PENDAFTARAN, email: "admin@careevo.test" }),
    );

    expect(res.ok).toBe(false);
    expect(res.errors?.email).toContain("demo");
    expect(mocks.daftarPengguna).not.toHaveBeenCalled();
  });

  it("memetakan alasan email_dipakai menjadi pesan email", async () => {
    mocks.daftarPengguna.mockResolvedValue({ ok: false, alasan: "email_dipakai" });

    const res = await registerAction({ ok: false }, formData(PENDAFTARAN));

    expect(res.ok).toBe(false);
    expect(res.errors?.email).toContain("Email sudah terdaftar");
    expect(mocks.pasangCookieSesi).not.toHaveBeenCalled();
  });
});

describe("loginAction — delegasi dan pesan demo", () => {
  it("meneruskan izinkanDemo sesuai environment dan memasang cookie saat berhasil", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_MODE", "1");
    mocks.authenticatePengguna.mockResolvedValue({
      hasil: { ok: true, principal: principal(["admin"]) },
      token: "token-demo",
      demo: true,
    });

    try {
      await loginAction({ ok: false }, formData({ email: "admin@careevo.test", password: "careevo" }));
      throw new Error("loginAction seharusnya mengalihkan halaman (redirect).");
    } catch (error) {
      if (!isRedirectError(error)) throw error;
    }

    expect(mocks.authenticatePengguna).toHaveBeenCalledWith(
      expect.objectContaining({ izinkanDemo: true }),
    );
    expect(mocks.pasangCookieSesi).toHaveBeenCalledWith("token-demo");
  });

  it("meneruskan izinkanDemo=false di luar opt-in demo", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_MODE", "");
    mocks.authenticatePengguna.mockResolvedValue({
      hasil: { ok: false, alasan: "kredensial_salah" },
      demo: false,
    });

    const res = await loginAction(
      { ok: false },
      formData({ email: "salah@contoh.test", password: "apa-saja-panjang" }),
    );

    expect(mocks.authenticatePengguna).toHaveBeenCalledWith(
      expect.objectContaining({ izinkanDemo: false }),
    );
    expect(res.ok).toBe(false);
  });

  it("tidak menyarankan akun demo saat login gagal di production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_MODE", "1");
    mocks.authenticatePengguna.mockResolvedValue({
      hasil: { ok: false, alasan: "kredensial_salah" },
      demo: false,
    });

    const res = await loginAction(
      { ok: false },
      formData({ email: "salah@contoh.test", password: "apa-saja-panjang" }),
    );

    expect(res.ok).toBe(false);
    // Pesan error tidak boleh mengarahkan orang ke kredensial yang justru
    // ditolak server, sekalipun DEMO_MODE diisi.
    expect(res.message).not.toContain("demo");
    expect(mocks.pasangCookieSesi).not.toHaveBeenCalled();
  });

  it("tetap menyebut akun demo saat login gagal di development dengan DEMO_MODE=1", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEMO_MODE", "1");
    mocks.authenticatePengguna.mockResolvedValue({
      hasil: { ok: false, alasan: "kredensial_salah" },
      demo: false,
    });

    const res = await loginAction(
      { ok: false },
      formData({ email: "salah@contoh.test", password: "apa-saja-panjang" }),
    );

    expect(res.message).toContain("demo");
  });
});

/**
 * Pembatas rate limit pada permukaan kredensial.
 *
 * Properti yang diuji bukan besaran limit, melainkan dua hal:
 *
 * 1. **Kuncinya jujur.** Login dan signup hanya dihitung atas IP tepercaya.
 *    Email/nama dari `FormData` sengaja TIDAK menjadi principal: nilai kiriman
 *    klien akan memberi penyerang cara menghabiskan bucket atas nama akun korban
 *    dan mengunci orang lain dari jarak jauh.
 * 2. **Penolakannya total.** Saat dibatasi, tidak ada service yang dipanggil —
 *    memeriksa batas setelah `daftarPengguna` berarti pendaftaran massal tetap
 *    terjadi, hanya jawabannya yang berubah.
 */
describe("pembatas pada login dan signup", () => {
  it("login dihitung atas IP saja — email kiriman klien tidak menjadi kunci", async () => {
    mocks.authenticatePengguna.mockResolvedValue({
      hasil: { ok: false, alasan: "kredensial_salah" },
      demo: false,
    });

    await loginAction(
      { ok: false },
      formData({ email: "korban@contoh.test", password: "apa-saja-panjang" }),
    );

    // Satu argumen saja: tidak ada principal. Kalau suatu saat email ikut
    // dikirim sebagai principal, assertion ini gagal sebelum celahnya dipakai.
    expect(mocks.cekBatasiAksi).toHaveBeenCalledWith("login");
    expect(mocks.cekBatasiAksi.mock.calls[0]).toHaveLength(1);
  });

  it("signup dihitung atas IP saja", async () => {
    mocks.daftarPengguna.mockResolvedValue({ ok: true, principal: principal(["user"]) });

    await jalankanRegistered(formData(PENDAFTARAN));

    expect(mocks.cekBatasiAksi).toHaveBeenCalledWith("signup");
    expect(mocks.cekBatasiAksi.mock.calls[0]).toHaveLength(1);
  });

  it("login yang dibatasi tidak menulis sesi walau kredensialnya benar", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.cekBatasiAksi.mockResolvedValue({ gagal: { pesan: "Terlalu banyak percobaan." } });

    const res = await loginAction(
      { ok: false },
      formData({ email: "user@careevo.test", password: "careevo" }),
    );

    expect(res.ok).toBe(false);
    expect(res.message).toBe("Terlalu banyak percobaan.");
    // Service tidak boleh dipanggil sama sekali saat dibatasi.
    expect(mocks.authenticatePengguna).not.toHaveBeenCalled();
    expect(jar.has("ls_session")).toBe(false);
  });

  it("signup yang dibatasi tidak menulis akun maupun sesi", async () => {
    mocks.cekBatasiAksi.mockResolvedValue({ gagal: { pesan: "Terlalu banyak percobaan." } });

    const res = await registerAction({ ok: false }, formData(PENDAFTARAN));

    expect(res.ok).toBe(false);
    expect(res.message).toBe("Terlalu banyak percobaan.");
    expect(mocks.daftarPengguna).not.toHaveBeenCalled();
    expect(jar.has("ls_session")).toBe(false);
  });

  it("hanya mengirim pesan ke state klien, tanpa detail internal pembatas", async () => {
    mocks.cekBatasiAksi.mockResolvedValue({ gagal: { pesan: "Terlalu banyak percobaan." } });

    const res = await loginAction(
      { ok: false },
      formData({ email: "siapa@contoh.test", password: "apa-saja-panjang" }),
    );

    // Limit, sisa kuota, dan timestamp reset tidak punya tempat di payload klien.
    const dikirim = JSON.stringify(res);
    expect(dikirim).not.toContain("retryAfter");
    expect(dikirim).not.toContain("resetMs");
    expect(dikirim).not.toContain("limit");
  });

  it("membatasi sebelum validasi bentuk, sehingga request cacat tetap dihitung", async () => {
    // Pesan kosong pasti gagal validasi; bila validasi dijalankan lebih dulu,
    // penyerang dapat mengirim request selalu-invalid untuk menghindari batas.
    mocks.cekBatasiAksi.mockResolvedValue({ gagal: { pesan: "Terlalu banyak percobaan." } });

    await loginAction({ ok: false }, formData({ email: "", password: "" }));

    expect(mocks.cekBatasiAksi).toHaveBeenCalledTimes(1);
  });
});
