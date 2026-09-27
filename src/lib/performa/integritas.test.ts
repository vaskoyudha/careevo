import { describe, expect, it } from "vitest";
import type { KejadianIntegritas, SessionRun } from "@/lib/learning/session";
import { ringkasIntegritasByOwner, statusPersetujuan, durasiMenit, temuanSesi } from "./integritas";

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

  it("menyatakan kamera belum diminta, bukan menuduh peserta", () => {
    // "Tidak ada rekaman kamera" menyiratkan ada efforts yang gagal.
    // "Belum diminta" menyebut penyebabnya: produk belum pernah meminta.
    const t = cari(temuanSesi(run({ id: "s1", owner: "a@x.test" })), "kamera_tidak_aktif");
    expect(t?.label).toBe("Belum diminta");
    expect(t?.detail).toContain("bukan pilihan peserta");
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
    // Ini yang paling penting: laporan integritas menyatakan fakta tentang
    // rekaman, bukan vonis. Menuduh di sini berarti menaikkan bukti yang tidak
    // pernah ada, dan mengikat diri pada janji yang tidak dibuat.
    const semua = [
      ...temuanSesi(run({ id: "a", owner: "o@x.test", kejadian: [kejadian("pindah_tab", "kejadian")] })),
      ...temuanSesi(run({ id: "b", owner: "o@x.test", status: "kedaluwarsa" })),
    ];
    const teks = semua.map((t) => `${t.label} ${t.detail}`).join(" ").toLowerCase();
    for (const kata of ["curang", "menyalin", "mencontek", "penyalahgunaan", "bersalah"]) {
      expect(teks).not.toContain(kata);
    }
  });

  it("tidak menyalahkan peserta ketika kamera memang tidak pernah diminta", () => {
    // Tidak adanya kamera adalah kelemahan produk. Kalau laporan menulis
    // "peserta tidak menyalakan kamera", ia menuduh orang atas fitur yang
    // memang tidak ada.
    const t = temuanSesi(run({ id: "s1", owner: "o@x.test" })).find(
      (x) => x.kode === "kamera_tidak_aktif",
    );
    expect(t?.detail).not.toMatch(/tidak menyalakan|tidak mengaktifkan/);
  });
});

describe("statusPersetujuan", () => {
  it("berstatus belum diminta dan penyebabnya produk", () => {
    const s = statusPersetujuan(run({ id: "s1", owner: "o@x.test" }));
    expect(s.status).toBe("belum_diminta");
    expect(s.penyebab).toBe("produk");
    expect(s.label).toBe("Belum diminta");
  });

  it("membedakan kamera yang gagal dari kamera yang tidak pernah diminta", () => {
    // Dua kondisi yang tadinya terlihat sama di laporan, padahal satu berarti
    // tidak ada sinyal sama sekali dan satunya berarti ada gangguan teknis.
    const gagal = statusPersetujuan(
      run({ id: "s1", owner: "o@x.test", kejadian: [kejadian("kamera_gagal", "celah")] }),
    );
    expect(gagal.status).toBe("diminta_gagal");
    expect(gagal.penyebab).toBe("peramban");
  });

  it("mencatat persetujuan yang diberikan lalu kamera berhenti", () => {
    const s = statusPersetujuan(
      run({
        id: "s1",
        owner: "o@x.test",
        kejadian: [kejadian("kamera_mulai", "kejadian"), kejadian("kamera_berhenti", "celah")],
      }),
    );
    expect(s.status).toBe("disetujui_berhenti");
    expect(s.penyebab).toBe("peramban");
  });

  it("mencatat persetujuan yang masih berjalan", () => {
    const s = statusPersetujuan(
      run({ id: "s1", owner: "o@x.test", kejadian: [kejadian("kamera_mulai", "kejadian")] }),
    );
    expect(s.status).toBe("disetujui_aktif");
  });
});

describe("durasiMenit", () => {
  const mulai = "2026-09-25T10:00:00.000Z";

  it("menghitung selisih menit mulai dan berakhir", () => {
    const run1 = run({ id: "s1", owner: "o@x.test", mulai_at: mulai, berakhir_at: "2026-09-25T10:47:00.000Z" });
    expect(durasiMenit(run1)).toBe(47);
  });

  it("mengembalikan null untuk sesi yang masih berjalan", () => {
    expect(durasiMenit(run({ id: "s1", owner: "o@x.test", mulai_at: mulai }))).toBeNull();
  });

  it("mengembalikan null untuk waktu yang tidak bisa diparse", () => {
    const rusak = run({ id: "s1", owner: "o@x.test", mulai_at: "bukan tanggal", berakhir_at: "juga bukan" });
    expect(durasiMenit(rusak)).toBeNull();
  });
});

describe("temuanSesi untuk sinyal lapisan baru", () => {
  const cari = (daftar: ReturnType<typeof temuanSesi>, kode: string) =>
    daftar.find((t) => t.kode === kode);

  it("menyatakan keluar layar penuh tanpa menyebut navigasi", () => {
    const t = cari(
      temuanSesi(run({ id: "s1", owner: "o@x.test", kejadian: [kejadian("keluar_fullscreen", "kejadian")] })),
      "keluar_fullscreen",
    );
    expect(t?.label).toBe("Keluar layar penuh 1×");
    // Yang diketahui: keluar dari layar penuh. Yang tidak: apa yang dibuka.
    expect(t?.detail).toContain("Tidak diketahui");
  });

  it("menyatakan paste massal beserta panjangnya", () => {
    const t = cari(
      temuanSesi(
        run({
          id: "s1",
          owner: "o@x.test",
          kejadian: [{ ...kejadian("paste_massal", "kejadian"), detail: "400 karakter, jeda 30s" }],
        }),
      ),
      "paste_massal",
    );
    expect(t?.label).toContain("Paste panjang");
    expect(t?.detail).toContain("400");
  });

  it("menyatakan pintasan terlarang sebagai hitungan saja", () => {
    const t = cari(
      temuanSesi(
        run({
          id: "s1",
          owner: "o@x.test",
          kejadian: [kejadian("pintasan_terlarang", "kejadian"), kejadian("pintasan_terlarang", "kejadian")],
        }),
      ),
      "pintasan_terlarang",
    );
    expect(t?.label).toBe("Pintasan terlarang 2×");
    expect(t?.detail).toContain("Tidak diketahui");
  });

  it("menyatakan wajah kedua sebagai catatan, bukan tuduhan", () => {
    const t = cari(
      temuanSesi(run({ id: "s1", owner: "o@x.test", kejadian: [kejadian("wajah_kedua", "kejadian")] })),
      "wajah_kedua",
    );
    // Kata "wajah kedua" adalah fakta terukur; "ada orang lain yang membantu"
    // adalah kesimpulan yang **tidak** boleh keluar dari aritmetika.
    expect(t?.detail).toContain("Tidak diketahui");
    expect(t?.detail).not.toContain("membantu");
  });

  it("tidak memakai kata vonis untuk sinyal baru mana pun", () => {
    const semua = temuanSesi(
      run({
        id: "s1",
        owner: "o@x.test",
        kejadian: [
          kejadian("keluar_fullscreen", "kejadian"),
          kejadian("paste_massal", "kejadian"),
          kejadian("pintasan_terlarang", "kejadian"),
          kejadian("wajah_kedua", "kejadian"),
        ],
      }),
    );
    for (const t of semua) {
      for (const kata of ["curang", "menyalin", "mencontek", "penyalahgunaan", "bersalah", "membantu"]) {
        expect(`${t.label} ${t.detail}`.toLowerCase()).not.toContain(kata);
      }
    }
  });

  it("tidak menampilkan temuan sinyal baru saat jenisnya memang tidak ada", () => {
    // Kebalikan dari empat tes di atas: absennya sinyal bukan temuan. Laporan
    // yang menampilkan "Paste panjang 0×" membuat setiap peserta terlihat
    // punya catatan.
    const daftar = temuanSesi(run({ id: "s1", owner: "o@x.test" }));
    for (const kode of ["keluar_fullscreen", "paste_massal", "pintasan_terlarang", "wajah_kedua"]) {
      expect(cari(daftar, kode)).toBeUndefined();
    }
  });
});

describe("ringkasanIntegritasByOwner mengelompokkan asal sinyal", () => {
  it("memisahkan sinyal peramban dari turunan kamera", () => {
    const peta = ringkasIntegritasByOwner([
      run({
        id: "s1",
        owner: "o@x.test",
        kejadian: [
          { ...kejadian("pindah_tab", "kejadian"), asal: "browser" },
          { ...kejadian("wajah_kedua", "kejadian"), asal: "kamera" },
        ],
      }),
    ]);
    const isi = peta.get("o@x.test");
    expect(isi?.daftar[0]?.perAsal.browser).toBe(1);
    expect(isi?.daftar[0]?.perAsal.kamera).toBe(1);
  });

  it("menghitung kejadian tanpa asal sebagai sinyal server", () => {
    // Baris lama (sebelum `asal` ada) tidak boleh hilang dari hitungan.
    const peta = ringkasIntegritasByOwner([
      run({ id: "s1", owner: "o@x.test", kejadian: [kejadian("sesi_dimulai", "kejadian")] }),
    ]);
    expect(peta.get("o@x.test")?.daftar[0]?.perAsal.server).toBe(1);
  });
});
