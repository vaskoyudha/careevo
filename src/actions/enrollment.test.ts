import { describe, it, expect, beforeEach, vi } from "vitest";
import { daftarKursusAction, tandaiModulAction } from "./enrollment";
import { resetCourses } from "@/lib/courses/store";
import {
  cariPendaftaran,
  daftarKursus,
  decodePendaftaran,
  encodePendaftaran,
  listPendaftaran,
  type Pendaftaran,
} from "@/lib/courses/enrollment";
import * as sessionModule from "@/lib/auth/session";
import * as cacheModule from "next/cache";
import type { SessionPayload } from "@/lib/auth/types";

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

const sesi: SessionPayload = {
  email: "user@careevo.test",
  nama: "Raka Pratama",
  username: "raka",
  role: "user",
  iat: Math.floor(Date.now() / 1000),
};

const OWNER_A = "a@careevo.test";
const OWNER_B = "b@careevo.test";

function sesiUntuk(email: string): SessionPayload {
  return { ...sesi, email };
}

function buatPendaftaran(
  owner: string | undefined,
  courseId = "crs-1",
  selesai_modul: string[] = [],
): Pendaftaran {
  const base = {
    course_id: courseId,
    slug: "fullstack-web-development-nextjs-15-react-19",
    enrolled_at: "2026-09-01T08:00:00.000Z",
    selesai_modul,
  };
  return owner === undefined ? base : { ...base, owner };
}

function seedPendaftaran(...entries: Pendaftaran[]): void {
  jar.set("ls_enroll", encodePendaftaran(entries));
}

function bacaPendaftaran(): Pendaftaran[] {
  return decodePendaftaran(jar.get("ls_enroll"));
}

describe("enrollment actions", () => {
  beforeEach(() => {
    resetCourses();
    jar.clear();
    vi.clearAllMocks();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi);
  });

  it("menolak bila belum masuk", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);
    const res = await daftarKursusAction("crs-1");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Masuk");
    const tandai = await tandaiModulAction("crs-1", "crs-1-m1");
    expect(tandai.ok).toBe(false);
  });

  it("mendaftarkan kursus gratis dan idempoten", async () => {
    const pertama = await daftarKursusAction("crs-1");
    expect(pertama.ok).toBe(true);
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith("/belajar");
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(
      "/belajar/fullstack-web-development-nextjs-15-react-19",
    );
    const kedua = await daftarKursusAction("crs-1");
    expect(kedua.ok).toBe(true);
    expect(kedua.message).toContain("sudah terdaftar");
  });

  it("menolak kursus berbayar dengan penanda butuhPlus", async () => {
    const res = await daftarKursusAction("crs-5");
    expect(res.ok).toBe(false);
    expect(res.butuhPlus).toBe(true);
  });

  it("menolak kursus draft yang belum dipublikasikan", async () => {
    const res = await daftarKursusAction("crs-8");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("dipublikasikan");
  });

  it("menolak id yang tidak dikenal", async () => {
    const res = await daftarKursusAction("tidak-ada");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak ditemukan");
  });

  it("mendaftarkan fixture resource gratis lewat id-nya", async () => {
    const res = await daftarKursusAction("r1");
    expect(res.ok).toBe(true);
  });

  it("menandai modul hanya setelah terdaftar", async () => {
    const tanpaDaftar = await tandaiModulAction("crs-2", "crs-2-m1");
    expect(tanpaDaftar.ok).toBe(false);
    expect(tanpaDaftar.error).toContain("Daftar");

    await daftarKursusAction("crs-2");
    const tandai = await tandaiModulAction("crs-2", "crs-2-m1");
    expect(tandai.ok).toBe(true);
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(
      "/belajar/membangun-rest-api-modern-dengan-nodejs",
    );

    const batal = await tandaiModulAction("crs-2", "crs-2-m1");
    expect(batal.ok).toBe(true);
  });

  it("menolak id modul yang tidak dikenal", async () => {
    await daftarKursusAction("crs-2");
    const res = await tandaiModulAction("crs-2", "crs-2-m99");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak dikenal");
  });

  it("menolak tandai untuk kursus draft", async () => {
    const res = await tandaiModulAction("crs-8", "crs-8-m1");
    expect(res.ok).toBe(false);
  });

  it("menyimpan pendaftaran di cookie yang bisa dibaca kembali", async () => {
    await daftarKursusAction("crs-1");
    await tandaiModulAction("crs-1", "crs-1-m1");
    const mentah = jar.get("ls_enroll");
    expect(mentah).toBeDefined();
    const daftar = decodePendaftaran(mentah);
    expect(daftar).toHaveLength(1);
    expect(daftar[0].course_id).toBe("crs-1");
    expect(daftar[0].selesai_modul).toEqual(["crs-1-m1"]);
  });

  it("owner written normalized after daftarKursusAction", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(
      sesiUntuk("  RAKA@Careevo.Test  "),
    );

    await daftarKursusAction("crs-1");

    expect(bacaPendaftaran()[0]?.owner).toBe("raka@careevo.test");
  });

  it("owner remains normalized after tandaiModulAction", async () => {
    await daftarKursus(
      "crs-1",
      "fullstack-web-development-nextjs-15-react-19",
      "raka@careevo.test",
    );
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(
      sesiUntuk(" RAKA@Careevo.Test "),
    );

    await tandaiModulAction("crs-1", "crs-1-m1");

    expect(bacaPendaftaran()[0]?.owner).toBe("raka@careevo.test");
  });

  it("listPendaftaran filters another account", async () => {
    const recordA = buatPendaftaran(OWNER_A);
    const recordB = buatPendaftaran(OWNER_B, "crs-2");
    seedPendaftaran(recordA, recordB);

    expect(await listPendaftaran(OWNER_A)).toEqual([recordA]);
  });

  it("two accounts can hold separate records for the same course_id", async () => {
    await daftarKursus(
      "crs-1",
      "fullstack-web-development-nextjs-15-react-19",
      OWNER_A,
    );
    await daftarKursus(
      "crs-1",
      "fullstack-web-development-nextjs-15-react-19",
      OWNER_B,
    );

    expect(bacaPendaftaran().map((item) => item.owner)).toEqual([OWNER_A, OWNER_B]);
  });

  it("cariPendaftaran cannot retrieve another account's record", async () => {
    seedPendaftaran(buatPendaftaran(OWNER_A));

    expect(await cariPendaftaran("crs-1", OWNER_B)).toBeUndefined();
  });

  it("ownerless legacy record is ignored by owner-scoped reads", async () => {
    seedPendaftaran(buatPendaftaran(undefined));

    expect(await listPendaftaran(OWNER_A)).toEqual([]);
    expect(await cariPendaftaran("crs-1", OWNER_A)).toBeUndefined();
  });

  it("tandaiModulAction changes only the active owner's record", async () => {
    const recordB = buatPendaftaran(OWNER_B, "crs-1", ["crs-1-m2"]);
    const recordA = buatPendaftaran(OWNER_A);
    seedPendaftaran(recordB, recordA);
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesiUntuk(OWNER_A));

    await tandaiModulAction("crs-1", "crs-1-m1");

    expect(bacaPendaftaran()).toEqual([
      recordB,
      { ...recordA, selesai_modul: ["crs-1-m1"] },
    ]);
  });

  it("pendaftaranPenuh counts the full signed-cookie array", async () => {
    const otherOwners = Array.from({ length: 50 }, (_, index) =>
      buatPendaftaran(OWNER_B, `other-${index}`),
    );
    seedPendaftaran(...otherOwners, buatPendaftaran(OWNER_A, "active-course"));
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesiUntuk(OWNER_A));

    const result = await daftarKursusAction("crs-1");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("50");
  });
});
