import { describe, expect, it } from "vitest";
import type { KejadianIntegritas, SessionRun } from "@/lib/learning/session";
import { ringkasIntegritasByOwner, temuanSesi } from "./integritas";

function kejadian(
  jenis: KejadianIntegritas["jenis"],
  jenis_klasifikasi: KejadianIntegritas["jenis_klasifikasi"],
  at = "2026-09-25T10:05:00.000Z",
): KejadianIntegritas {
  return { at, jenis, jenis_klasifikasi, visibilitas: "hidden" };
}

function run(partial: Partial<SessionRun> & Pick<SessionRun, "id" | "owner">): SessionRun {
  return {
    course_id: "crs-1",
    policy_version: 1,
    status: "aktif",
    mulai_at: "2026-09-25T10:00:00.000Z",
    berakhir_at: null,
    kejadian: [],
    ...partial,
  };
}

describe("ringkasIntegritasByOwner", () => {
  it("mengelompokkan kejadian dan celah per pemilik", () => {
    const peta = ringkasIntegritasByOwner([
      run({
        id: "s1",
        owner: "a@x.test",
        kejadian: [kejadian("pindah_tab", "kejadian")],
      }),
      run({
        id: "s2",
        owner: "a@x.test",
        status: "kedaluwarsa",
        kejadian: [kejadian("kamera_gagal", "celah")],
      }),
      run({ id: "s3", owner: "b@x.test" }),
    ]);

    const a = peta.get("a@x.test");
    expect(a?.sesi).toBe(2);
    expect(a?.kejadian).toBe(1);
    expect(a?.celah).toBe(1);
    expect(a?.kedaluwarsa).toBe(1);
    expect(peta.get("b@x.test")?.sesi).toBe(1);
  });

  it("tidak pernah mengembalikan nilai, skor, atau status kelulusan", () => {
    // This summary exists to be displayed. Pinning the field list keeps it from
    // quietly growing a field that would later be read as a verdict.
    const peta = ringkasIntegritasByOwner([run({ id: "s1", owner: "a@x.test" })]);
    expect(Object.keys(peta.get("a@x.test")!).sort()).toEqual([
      "celah",
      "daftar",
      "kedaluwarsa",
      "kejadian",
      "sesi",
    ]);
  });

  it("mengurutkan riwayat sesi dari yang terbaru", () => {
    const peta = ringkasIntegritasByOwner([
      run({ id: "lama", owner: "a@x.test", mulai_at: "2026-09-20T10:00:00.000Z" }),
      run({ id: "baru", owner: "a@x.test", mulai_at: "2026-09-25T10:00:00.000Z" }),
    ]);
    expect(peta.get("a@x.test")?.daftar.map((s) => s.run_id)).toEqual(["baru", "lama"]);
  });

  it("mengembalikan peta kosong untuk tanpa run", () => {
    expect(ringkasIntegritasByOwner([]).size).toBe(0);
  });
});

describe("temuanSesi", () => {
  const cari = (daftar: ReturnType<typeof temuanSesi>, kode: string) =>
    daftar.find((t) => t.kode === kode);

  it("selalu melaporkan bahwa tidak ada rekaman kamera", () => {
    // Bukan sekadar opsional: kamera tidak pernah diminta, jadi "tidak ada
    // yang bisa ditinjau" adalah fakta, bukan ketiadaan data.
    const t = cari(temuanSesi(run({ id: "s1", owner: "a@x.test" })), "kamera_tidak_aktif");
    expect(t?.label).toBe("Tidak ada rekaman kamera");
  });

  it("menghitung keluar tab dan menyebut apa yang tidak diketahui", () => {
    const daftar = temuanSesi(
      run({
        id: "s1",
        owner: "a@x.test",
        kejadian: [
          kejadian("pindah_tab", "kejadian", "2026-09-25T10:05:00.000Z"),
          kejadian("pindah_tab", "kejadian", "2026-09-25T10:09:00.000Z"),
          kejadian("pindah_tab", "kejadian", "2026-09-25T10:12:00.000Z"),
        ],
      }),
    );
    const t = cari(daftar, "pindah_tab");
    expect(t?.label).toBe("Keluar tab 3×");
    // Kalimat singkat yang jujur: data ini tidak bisa membedakan dokumentasi
    // dari bantuan AI, dan itu harus tertulis, bukan disembunyikan.
    expect(t?.detail).toContain("Tidak diketahui");
  });

  it("memisahkan celah pengawasan dari kejadian biasa", () => {
    const daftar = temuanSesi(
      run({
        id: "s1",
        owner: "a@x.test",
        kejadian: [
          kejadian("pindah_tab", "kejadian"),
          kejadian("kamera_gagal", "celah"),
        ],
      }),
    );
    expect(cari(daftar, "celah_pengawasan")?.label).toBe("Celah pengawasan 1×");
  });

  it("menyatakan sesi yang dibiarkan kedaluwarsa", () => {
    const t = cari(
      temuanSesi(run({ id: "s1", owner: "a@x.test", status: "kedaluwarsa" })),
      "kedaluwarsa",
    );
    expect(t?.detail).toContain("batas waktu");
  });

  it("tidak pernah memakai kata yang menyatakan bersalah", () => {
    // Vulgarities ini yang paling penting: laporan integritas menyatakan fakta
    // tentang rekaman, bukan vonis. Menuduh di sini berarti menaikkan bukti
    // yang tidak pernah ada, dan mengikat diri pada janji yang tidak dibuat.
    const semua = [
      ...temuanSesi(run({ id: "a", owner: "o@x.test", kejadian: [kejadian("pindah_tab", "kejadian")] })),
      ...temuanSesi(run({ id: "b", owner: "o@x.test", status: "kedaluwarsa" })),
    ];
    const teks = semua.map((t) => `${t.label} ${t.detail}`).join(" ").toLowerCase();
    for (const kata of ["curang", "menyalin", "mencontek", "penyalahgunaan", "bersalah"]) {
      expect(teks).not.toContain(kata);
    }
  });
});
