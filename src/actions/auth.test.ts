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

/**
 * Pembatas di-mock di sini karena modul `next/headers` di atas hanya menyediakan
 * `cookies`, sedangkan `cekBatasiAksi()` memanggil `headers()`. Yang diuji bukan
 * algoritma Redis-nya (itu di `src/lib/rate-limit/`), melainkan **urutan dan
 * akibat** penolakan: apa yang tidak ditulis saat pembatas berkata tidak.
 *
 * Default `vi.fn()` mengembalikan `undefined`, yang oleh aksi diperlakukan
 * sebagai "boleh lanjut" — jadi suite lama di bawah tetap berjalan tanpa
 * menyebut pembatas sama sekali.
 */
const mocks = vi.hoisted(() => ({ cekBatasiAksi: vi.fn() }));

vi.mock("@/lib/rate-limit/next", () => ({ cekBatasiAksi: mocks.cekBatasiAksi }));

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

/**
 * Pembatas rate limit pada permukaan kredensial.
 *
 * Properti yang diuji bukan besaran limit, melainkan dua hal:
 *
 * 1. **Kuncinya jujur.** Login dan signup hanya dihitung atas IP tepercaya.
 *    Email/nama dari `FormData` sengaja TIDAK menjadi principal: nilai kiriman
 *    klien akan memberi penyerang cara menghabiskan bucket atas nama akun korban
 *    dan mengunci orang lain dari jarak jauh.
 * 2. **Penolakannya total.** Saat dibatasi, tidak ada akun yang ditulis dan
 *    tidak ada sesi yang dibuat — memeriksa batas setelah `addStoredUser` berarti
 *    pendaftaran massal tetap terjadi, hanya jawabannya yang berubah.
 */
describe("pembatas pada login dan signup", () => {
  beforeEach(() => {
    jar.clear();
    vi.restoreAllMocks();
    mocks.cekBatasiAksi.mockReset();
    // Default: boleh lanjut. Test di bawah menimpanya untuk kasus penolakan.
    mocks.cekBatasiAksi.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("login dihitung atas IP saja — email kiriman klien tidak menjadi kunci", async () => {
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
    // Pendaftaran yang berhasil berakhir dengan `redirect`, yang melempar
    // `NEXT_REDIRECT` — bukan kegagalan, melainkan cara kerja action ini.
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
    // Akun demo dengan password benar pun tidak boleh menghasilkan sesi.
    expect(jar.has("ls_session")).toBe(false);
  });

  it("signup yang dibatasi tidak menulis akun maupun sesi", async () => {
    mocks.cekBatasiAksi.mockResolvedValue({ gagal: { pesan: "Terlalu banyak percobaan." } });

    const res = await registerAction({ ok: false }, formData(PENDAFTARAN));

    expect(res.ok).toBe(false);
    expect(res.message).toBe("Terlalu banyak percobaan.");
    // Pendaftaran massal dicegah tepat di sini: tidak ada baris user yang ditulis.
    expect(penggunaTersimpan()).toHaveLength(0);
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
