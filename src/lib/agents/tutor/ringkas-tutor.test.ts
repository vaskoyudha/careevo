import { describe, expect, it } from "vitest";

import {
  BATAS_GILIRAN_PROMPT,
  faktaTranskrip,
  transkripUntukPrompt,
  type SesiRingkas,
} from "./fakta";
import { validasiRingkasTutor } from "./skema";
import { bangunPromptRingkas } from "./prompt";

function sesi(
  judul: string,
  messages: Array<[("user" | "assistant"), string]>,
  courseId: string | null = "crs-1",
): SesiRingkas {
  return {
    judul,
    courseId,
    messages: messages.map(([role, content]) => ({ role, content })),
  };
}

describe("faktaTranskrip", () => {
  it("tanpa sesi menghasilkan nol semua", () => {
    expect(faktaTranskrip([])).toEqual({
      sesi: 0,
      pesanPeserta: 0,
      pesanTutor: 0,
      course: [],
      topik: [],
      topikDiulang: 0,
    });
  });

  it("menghitung sesi, pesan peserta, dan pesan tutor", () => {
    const fakta = faktaTranskrip([
      sesi("Closure", [
        ["user", "Apa itu closure?"],
        ["assistant", "Closure adalah…"],
      ]),
      sesi("Promise", [
        ["user", "Jelaskan promise"],
        ["assistant", "Promise itu…"],
        ["user", "Kalau reject?"],
      ]),
    ]);
    expect(fakta.sesi).toBe(2);
    expect(fakta.pesanPeserta).toBe(3);
    expect(fakta.pesanTutor).toBe(2);
  });

  it("sesi tanpa pesan peserta tidak dihitung sebagai sesi", () => {
    // Pernah dibuka bukan berarti pernah dipakai. Menghitungnya membuat
    // "2 sesi" terdengar seperti bukti kerja yang isinya tidak ada.
    const fakta = faktaTranskrip([
      sesi("Kosong", []),
      sesi("Ada", [
        ["user", "halo"],
        ["assistant", "hai"],
      ]),
    ]);
    expect(fakta.sesi).toBe(1);
    expect(fakta.pesanTutor).toBe(1);
  });

  it("menyusun topik dari judul sesi, urut dari yang paling sering", () => {
    const fakta = faktaTranskrip([
      sesi("Closure", [["user", "a"]]),
      sesi("Promise", [["user", "a"]]),
      sesi("Closure", [["user", "a"]]),
    ]);
    expect(fakta.topik[0]).toEqual({ judul: "Closure", sesi: 2 });
    expect(fakta.topik[1]).toEqual({ judul: "Promise", sesi: 1 });
    expect(fakta.topikDiulang).toBe(1);
  });

  it("judul dengan beda huruf besar dan spasi tetap satu topik", () => {
    const fakta = faktaTranskrip([
      sesi("Jelaskan  Closure", [["user", "a"]]),
      sesi("jelaskan closure", [["user", "a"]]),
    ]);
    expect(fakta.topik).toHaveLength(1);
    expect(fakta.topik[0]!.sesi).toBe(2);
  });

  it("judul kosong tidak jadi topik", () => {
    const fakta = faktaTranskrip([sesi("", [["user", "a"]])]);
    expect(fakta.topik).toHaveLength(0);
    expect(fakta.sesi).toBe(1);
  });

  it("course tanpa id tidak dihitung", () => {
    const fakta = faktaTranskrip([sesi("Closure", [["user", "a"]], null)]);
    expect(fakta.course).toHaveLength(0);
  });
});

describe("transkripUntukPrompt", () => {
  it("memberi label peran yang berbeda untuk peserta dan tutor", () => {
    const teks = transkripUntukPrompt([
      sesi("Closure", [
        ["user", "Apa itu closure?"],
        ["assistant", "Closure adalah…"],
      ]),
    ]);
    expect(teks).toContain("Peserta: Apa itu closure?");
    expect(teks).toContain("Tutor: Closure adalah…");
  });

  it("memotong pada batas dan menyatakan pemotongannya", () => {
    // Memotong diam-diam membuat model menyimpulkan ada awal percakapan yang
    // tidak ada. Penyataan pemotongan membuat model mengetahuinya.
    const panjang = 200;
    const banyak: SesiRingkas[] = [];
    for (let i = 0; i < 100; i += 1) {
      banyak.push(sesi(`S${i}`, [["user", "x".repeat(panjang)]]));
    }
    const teks = transkripUntukPrompt(banyak, 10);
    expect(teks).toContain("dipotong");
    // Tepat 10 giliran yang masuk: 10 baris percakapan, baris kosong, dan catatan
    // pemotongan. Baris ke-11 (giliran ke-11) **tidak** boleh ikut — itulah yang
    // membuat batasnya benar-benar.
    expect(teks.split("\n")).toHaveLength(12);
    expect(teks.split("\n").filter((b) => b.startsWith("Peserta:"))).toHaveLength(10);
  });

  it("tidak menyatakan pemotongan saat muat semua", () => {
    const teks = transkripUntukPrompt([sesi("A", [["user", "halo"]])], 1);
    expect(teks).not.toContain("dipotong");
  });

  it("batas bawaan ada dan masuk akal", () => {
    expect(BATAS_GILIRAN_PROMPT).toBeGreaterThan(0);
    expect(BATAS_GILIRAN_PROMPT).toBeLessThanOrEqual(500);
  });
});

describe("validasiRingkasTutor", () => {
  it("lempar kalau bentuknya bukan objek", () => {
    // Satu-satunya kondisi yang benar-benar gagal: bentuknya salah, sehingga
    // tidak ada yang bisa dip_display.
    expect(() => validasiRingkasTutor(null)).toThrow();
    expect(() => validasiRingkasTutor("teks")).toThrow();
    expect(() => validasiRingkasTutor([1, 2])).toThrow();
  });

  it("objek kosong adalah sukses dengan daftar kosong, bukan kegagalan", () => {
    // Fakta deterministik tetap berdiri sendiri; melaporkan gagal di sini
    // menyiratkan ringkasan rusak padahal tidak.
    expect(validasiRingkasTutor({})).toEqual({
      ringkasan: "",
      dipahami: [],
      kesulitan: [],
      batas: [],
    });
  });

  it("poin tanpa bukti dibuang", () => {
    // Poin tanpa bukti adalah klaim yang tidak bisa ditinjau, dan panel ini
    // ada supaya pemeriksa bisa memverifikasinya.
    const hasil = validasiRingkasTutor({
      dipahami: [
        { teks: "Closure", bukti: "Peserta: closure itu…" },
        { teks: "Tanpa bukti" },
        { bukti: "hanya bukti" },
        { teks: "", bukti: "bukti tapi teks kosong" },
        "bukan objek",
        null,
      ],
    });
    expect(hasil.dipahami).toHaveLength(1);
    expect(hasil.dipahami[0]!.teks).toBe("Closure");
  });

  it("batas berupa string, bukan objek, diabaikan", () => {
    const hasil = validasiRingkasTutor({ batas: ["  tidak tahu  ", 42, null, ""] });
    expect(hasil.batas).toEqual(["tidak tahu"]);
  });

  it("hasil tidak pernah memuat field numerik apa pun", () => {
    // Penjaga yang paling penting di berkas ini. Kalau suatu saat ada yang
    // menambahkan `skor` ke skema, ringkasan menjadi angka yang bisa bergerak
    // sendiri — persis yang dikunci AGENTS.md.
    const hasil = validasiRingkasTutor({
      ringkasan: "r",
      dipahami: [],
      kesulitan: [],
      batas: [],
      skor: 100,
      nilai: 80,
      percentage: 95,
    });
    expect(Object.keys(hasil).sort()).toEqual(["batas", "dipahami", "kesulitan", "ringkasan"]);
    for (const nilai of Object.values(hasil)) {
      expect(typeof nilai).not.toBe("number");
    }
  });

  it("kolom numerik di dalam poin ikut hilang", () => {
    const hasil = validasiRingkasTutor({
      dipahami: [{ teks: "x", bukti: "y", skor: 100, confidence: 0.9 }],
    });
    expect(Object.keys(hasil.dipahami[0]!).sort()).toEqual(["bukti", "teks"]);
  });
});

describe("bangunPromptRingkas", () => {
  it("menyertakan fakta yang sudah dihitung dan meminta model memakainya", () => {
    const daftar = [sesi("Closure", [["user", "apa closure?"], ["assistant", "Closure adalah…"]])];

    const prompt = bangunPromptRingkas(faktaTranskrip(daftar), daftar);
    expect(prompt).toContain("Peserta: apa closure?");
    expect(prompt).toContain("Gunakan angka ini apa adanya");
    // Topik ikut dikirim supaya model tidak mengarang topik dari isi jawaban.
    expect(prompt).toContain("Closure");
  });

  it("meminta bukti untuk setiap poin", () => {
    const daftar = [sesi("A", [["user", "x"]])];
    expect(bangunPromptRingkas(faktaTranskrip(daftar), daftar)).toContain("bukti");
  });

  it("melarang model menilai peserta", () => {
    const daftar = [sesi("A", [["user", "x"]])];
    const prompt = bangunPromptRingkas(faktaTranskrip(daftar), daftar);
    expect(prompt).toContain("Jangan menilai");
  });
});