/**
 * Test server action administrasi staff.
 *
 * Dua hal yang dijaga di sini, dan keduanya adalah properti keamanan:
 *
 * 1. **Learner tidak bisa memanggil action staff.** Server Action adalah
 *    endpoint POST; layout `/admin` tidak menjaga apa pun. Test memanggil
 *    action langsung dari kode — cara penyerang memanggilnya.
 * 2. **Role tidak pernah berasal dari FormData sebagai nilai bebas.** FormData
 *    boleh membawa field `role`, tetapi nilainya harus lolos daftar tertutup
 *    `ROLE_UNDANGAN_STAFF` sebelum menyentuh service. Nilai `user` (atau apa
 *    pun di luar verifikator/admin) harus ditolak, bukan diteruskan.
 *
 * Service (`@/lib/auth/invitation`) di-mock: unit test ini menguji keputusan
 * action, bukan query database. Perilaku service diuji di
 * `invitation.integration.test.ts` dengan PostgreSQL sungguhan.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { sesiSekarang } = vi.hoisted(() => ({
  // Slot sesi menerima baik principal database (`SessionPrincipal`) maupun
  // objek cookie legacy (tanpa `userId`/`roles`) — dua-duanya diuji di sini.
  sesiSekarang: { nilai: null as SessionPrincipal | Record<string, unknown> | null },
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => sesiSekarang.nilai,
}));

const layanan = vi.hoisted(() => ({
  buatUndanganStaff: vi.fn(),
  redeemUndangan: vi.fn(),
  cabutUndangan: vi.fn(),
  beriRole: vi.fn(),
  cabutRole: vi.fn(),
}));

vi.mock("@/lib/auth/invitation", async (importAsli) => {
  // Konstanta dan tipe nyata tetap dipakai; hanya fungsi I/O yang di-mock.
  const asli = await importAsli<typeof import("@/lib/auth/invitation")>();
  return {
    ...asli,
    buatUndanganStaff: layanan.buatUndanganStaff,
    redeemUndangan: layanan.redeemUndangan,
    cabutUndangan: layanan.cabutUndangan,
    beriRole: layanan.beriRole,
    cabutRole: layanan.cabutRole,
  };
});

import type { SessionPrincipal } from "@/lib/auth/principal";
import type { Role } from "@/lib/auth/types";
import {
  beriRoleAction,
  buatUndanganAction,
  cabutRoleAction,
  cabutUndanganAction,
  redeemUndanganAction,
} from "./staff";

const ADMIN_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
// UUID v4 yang sah: Zod 4 memeriksa bit version/variant, bukan sekadar bentuk
// `8-4-4-4-12`. Nilai yang hanya "terlihat seperti uuid" ditolak skema.
const TARGET_ID = "11111111-2222-4333-8444-555555555555";

function principal(roles: Role[], role: Role = roles[0] ?? "user"): SessionPrincipal {
  return {
    userId: ADMIN_ID,
    roles,
    role,
    nama: "Budi",
    email: "budi@contoh.test",
    username: "budi",
    iat: 1_700_000_000_000,
  };
}

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

beforeEach(() => {
  sesiSekarang.nilai = null;
  vi.clearAllMocks();
});

describe("action admin — menolak non-admin", () => {
  const adminActions = [
    {
      nama: "buatUndanganAction",
      jalankan: () => buatUndanganAction({ ok: false }, formData({ email: "a@b.test", role: "admin" })),
    },
    {
      nama: "cabutUndanganAction",
      jalankan: () => cabutUndanganAction({ ok: false }, formData({ invitation_id: TARGET_ID })),
    },
    {
      nama: "beriRoleAction",
      jalankan: () =>
        beriRoleAction({ ok: false }, formData({ user_id: TARGET_ID, role: "admin" })),
    },
    {
      nama: "cabutRoleAction",
      jalankan: () =>
        cabutRoleAction({ ok: false }, formData({ user_id: TARGET_ID, role: "admin" })),
    },
  ];

  it("menolak tanpa sesi dan tidak menyentuh service", async () => {
    sesiSekarang.nilai = null;

    for (const aksi of adminActions) {
      const hasil = await aksi.jalankan();
      expect(hasil.ok, aksi.nama).toBe(false);
      expect(hasil.error, aksi.nama).toContain("Akses ditolak");
    }

    expect(layanan.buatUndanganStaff).not.toHaveBeenCalled();
    expect(layanan.beriRole).not.toHaveBeenCalled();
    expect(layanan.cabutRole).not.toHaveBeenCalled();
    expect(layanan.cabutUndangan).not.toHaveBeenCalled();
  });

  it("menolak learner yang login", async () => {
    sesiSekarang.nilai = principal(["user"]);

    for (const aksi of adminActions) {
      const hasil = await aksi.jalankan();
      expect(hasil.ok, aksi.nama).toBe(false);
      expect(hasil.error, aksi.nama).toContain("Akses ditolak");
    }

    expect(layanan.beriRole).not.toHaveBeenCalled();
  });

  it("menolak verifikator — memberi role bukan hak verifikator", async () => {
    sesiSekarang.nilai = principal(["verifikator"]);

    const hasil = await beriRoleAction(
      { ok: false },
      formData({ user_id: TARGET_ID, role: "verifikator" }),
    );

    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("Akses ditolak");
    expect(layanan.beriRole).not.toHaveBeenCalled();
  });

  it("menolak sesi cookie legacy yang tidak punya principal database", async () => {
    sesiSekarang.nilai = {
      email: "budi@contoh.test",
      nama: "Budi",
      username: "budi",
      role: "admin",
      iat: 1_700_000_000_000,
    };

    const hasil = await beriRoleAction(
      { ok: false },
      formData({ user_id: TARGET_ID, role: "admin" }),
    );

    expect(hasil.ok).toBe(false);
    expect(layanan.beriRole).not.toHaveBeenCalled();
  });
});

describe("beriRoleAction — role dari FormData divalidasi", () => {
  beforeEach(() => {
    sesiSekarang.nilai = principal(["admin"]);
  });

  it("meneruskan role yang sah ke service dengan pelaku dari principal", async () => {
    layanan.beriRole.mockResolvedValue({ ok: true, granted: true, diaktifkanKembali: false });

    const hasil = await beriRoleAction(
      { ok: false },
      formData({ user_id: TARGET_ID, role: "verifikator" }),
    );

    expect(hasil.ok).toBe(true);
    expect(layanan.beriRole).toHaveBeenCalledWith({
      userId: TARGET_ID,
      role: "verifikator",
      grantedByUserId: ADMIN_ID,
    });
  });

  it("menolak role 'user' dan role yang tidak dikenal sebelum service dipanggil", async () => {
    for (const roleTerlarang of ["user", "superadmin", "", "ADMIN "]) {
      const hasil = await beriRoleAction(
        { ok: false },
        formData({ user_id: TARGET_ID, role: roleTerlarang }),
      );

      expect(hasil.ok, `role=${roleTerlarang}`).toBe(false);
      expect(hasil.fieldErrors, `role=${roleTerlarang}`).toHaveProperty("role");
    }

    expect(layanan.beriRole).not.toHaveBeenCalled();
  });

  it("menolak user_id yang bukan uuid", async () => {
    const hasil = await beriRoleAction(
      { ok: false },
      formData({ user_id: "bukan-uuid", role: "admin" }),
    );

    expect(hasil.ok).toBe(false);
    expect(hasil.fieldErrors).toHaveProperty("user_id");
    expect(layanan.beriRole).not.toHaveBeenCalled();
  });
});

describe("buatUndanganAction — token hanya muncul sekali", () => {
  beforeEach(() => {
    sesiSekarang.nilai = principal(["admin"]);
  });

  it("mengembalikan token pada respons pertama dan tidak menyimpannya di field lain", async () => {
    layanan.buatUndanganStaff.mockResolvedValue({
      ok: true,
      token: "TOKEN-ASLI-SEKALI",
      undangan: {
        id: TARGET_ID,
        emailNormalized: "calon@contoh.test",
        role: "verifikator",
        invitedByUserId: ADMIN_ID,
        tokenHash: "hash",
        expiresAt: new Date(),
        consumedAt: null,
        revokedAt: null,
      },
    });

    const hasil = await buatUndanganAction(
      { ok: false },
      formData({ email: "Calon@Contoh.test", role: "verifikator" }),
    );

    expect(hasil.ok).toBe(true);
    expect(hasil.token).toBe("TOKEN-ASLI-SEKALI");
    // Pembuat diambil dari principal, bukan FormData.
    expect(layanan.buatUndanganStaff).toHaveBeenCalledWith(
      expect.objectContaining({ invitedByUserId: ADMIN_ID, role: "verifikator" }),
    );

    // Memanggil lagi tanpa input sah tidak memunculkan token lama.
    const gagal = await buatUndanganAction(
      { ok: false },
      formData({ email: "bukan-email", role: "verifikator" }),
    );
    expect(gagal.ok).toBe(false);
    expect(gagal.token).toBeUndefined();
  });

  it("menolak role staff yang tidak sah tanpa memanggil service", async () => {
    const hasil = await buatUndanganAction(
      { ok: false },
      formData({ email: "calon@contoh.test", role: "user" }),
    );

    expect(hasil.ok).toBe(false);
    expect(layanan.buatUndanganStaff).not.toHaveBeenCalled();
  });

  it("menolak email berspasi, tidak memangkasnya diam-diam", async () => {
    // Sebelum ini `z.email().trim().toLowerCase()` menerima `"  ...  "` dengan
    // memangkasnya, padahal `z.email()` polos di lib/validation/auth.ts
    // menolaknya. Dua aturan untuk masukan yang sama adalah dua definisi yang
    // bisa menyimpang; action ini sekarang menolak, bukan menormalkan.
    const hasil = await buatUndanganAction(
      { ok: false },
      formData({ email: "  calon@contoh.test  ", role: "verifikator" }),
    );

    expect(hasil.ok).toBe(false);
    expect(hasil.fieldErrors).toHaveProperty("email");
    expect(layanan.buatUndanganStaff).not.toHaveBeenCalled();
  });

  it("menerima email sah tanpa spasi dan meneruskannya apa adanya ke service", async () => {
    layanan.buatUndanganStaff.mockResolvedValue({ ok: true, token: "T", undangan: {} });

    const hasil = await buatUndanganAction(
      { ok: false },
      formData({ email: "calon@contoh.test", role: "verifikator" }),
    );

    expect(hasil.ok).toBe(true);
    // Normalisasi sebenarnya tetap milik service (`normalizeOwner`), bukan
    // action — action hanya tidak lagi menerima bentuk yang berbeda dari
    // schema auth lain.
    expect(layanan.buatUndanganStaff).toHaveBeenCalledWith(
      expect.objectContaining({ emailNormalized: "calon@contoh.test" }),
    );
  });
});

describe("redeemUndanganAction — identitas dari principal", () => {
  it("menolak tanpa sesi", async () => {
    const hasil = await redeemUndanganAction({ ok: false }, formData({ token: "t".repeat(40) }));

    expect(hasil.ok).toBe(false);
    expect(layanan.redeemUndangan).not.toHaveBeenCalled();
  });

  it("memakai userId dari principal, bukan FormData", async () => {
    sesiSekarang.nilai = principal(["user"]);
    layanan.redeemUndangan.mockResolvedValue({
      ok: true,
      invitationId: TARGET_ID,
      userId: ADMIN_ID,
      role: "verifikator",
      diaktifkanKembali: false,
    });

    const hasil = await redeemUndanganAction(
      { ok: false },
      // Attacker menambahkan `user_id` sendiri; nilainya harus diabaikan.
      formData({ token: "t".repeat(40), user_id: TARGET_ID }),
    );

    expect(hasil.ok).toBe(true);
    expect(layanan.redeemUndangan).toHaveBeenCalledWith({
      token: "t".repeat(40),
      userId: ADMIN_ID,
    });
  });

  it("menolak token yang terlalu pendek sebelum memanggil service", async () => {
    sesiSekarang.nilai = principal(["user"]);

    const hasil = await redeemUndanganAction({ ok: false }, formData({ token: "pendek" }));

    expect(hasil.ok).toBe(false);
    expect(layanan.redeemUndangan).not.toHaveBeenCalled();
  });

  it("meneruskan pesan kegagalan service apa adanya", async () => {
    sesiSekarang.nilai = principal(["user"]);
    layanan.redeemUndangan.mockResolvedValue({
      ok: false,
      alasan: "kedaluwarsa",
      pesan: "Undangan ini sudah kedaluwarsa.",
    });

    const hasil = await redeemUndanganAction({ ok: false }, formData({ token: "t".repeat(40) }));

    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("kedaluwarsa");
  });
});
