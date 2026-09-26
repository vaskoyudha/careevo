import { describe, expect, it } from "vitest";
import {
  AMBANG_PASTE_MINIMAL,
  PINTAKAN_TERLARANG,
  sejakDetikTerakhirMengetik,
  sinyalPaste,
  sinyalPintasan,
  sinyalSalin,
} from "./pengawasan-klien";

describe("sinyalPaste", () => {
  it("mencatat paste yang panjangnya di atas ambang", () => {
    const hasil = sinyalPaste(400, 30);
    expect(hasil).toEqual({ jenis: "paste_massal", panjang: 400, sejak_mengetik_detik: 30 });
  });

  it("mengabaikan paste pendek", () => {
    expect(sinyalPaste(AMBANG_PASTE_MINIMAL - 1, 5)).toBeNull();
  });

  it("mencatat tepat di ambang", () => {
    // Batas inklusif: 200 karakter adalah pola "menyalin satu paragraf".
    expect(sinyalPaste(AMBANG_PASTE_MINIMAL, 1)).not.toBeNull();
  });

  it("tidak pernah melaporkan jeda negatif", () => {
    // Jam bisa melompat mundur (NTP, pergantian jam Sommer). Angka negatif akan
    // tampil di laporan sebagai "jeda -5 detik", yang tidak berarti apa pun.
    const hasil = sinyalPaste(500, -12);
    expect(hasil?.sejak_mengetik_detik).toBe(0);
  });
});

describe("sinyalPintasan", () => {
  it("mencatat ctrl+v dan meta+v", () => {
    expect(sinyalPintasan({ ctrl: true, meta: false, alt: false, shift: false, key: "v" }))
      .toEqual({ jenis: "pintasan_terlarang", kombinasi: "ctrl+v" });
    expect(sinyalPintasan({ ctrl: false, meta: true, alt: false, shift: false, key: "v" }))
      .toEqual({ jenis: "pintasan_terlarang", kombinasi: "meta+v" });
  });

  it("mencatat alt+tab", () => {
    expect(sinyalPintasan({ ctrl: false, meta: false, alt: true, shift: false, key: "tab" }))
      .toEqual({ jenis: "pintasan_terlarang", kombinasi: "alt+tab" });
  });

  it("mengabaikan tombol modifier sendirian", () => {
    // `key` modifier hanya ditekan, belum ada aksi — mencatatnya akan memenuhi
    // kuota kejadian dengan sinyal yang tidak berisi informasi apa pun.
    expect(sinyalPintasan({ ctrl: true, meta: false, alt: false, shift: false, key: "Control" })).toBeNull();
  });

  it("mengabaikan kombinasi yang tidak masuk daftar", () => {
    expect(sinyalPintasan({ ctrl: true, meta: false, alt: false, shift: true, key: "r" })).toBeNull();
  });

  it("mendeteksi seluruh daftar terlarang", () => {
    for (const key of PINTAKAN_TERLARANG) {
      expect(sinyalPintasan({ ctrl: true, meta: false, alt: false, shift: false, key })).not.toBeNull();
    }
  });
});

describe("sinyalSalin", () => {
  it("mencatat menyalin di atas ambang", () => {
    expect(sinyalSalin(300)).toEqual({ jenis: "salin_terlarang", panjang: 300 });
  });

  it("mengabaikan menyalin pendek", () => {
    expect(sinyalSalin(AMBANG_PASTE_MINIMAL - 1)).toBeNull();
  });
});

describe("sejakDetikTerakhirMengetik", () => {
  it("menghitung detik sejak ketikan terakhir", () => {
    expect(sejakDetikTerakhirMengetik(1_000, 31_000)).toBe(30);
  });

  it("mengembalikan ambang besar saat belum ada ketikan", () => {
    // Tanpa ketikan sebelumnya, jeda tidak diketahui — bukan nol. Nilai besar
    // membuat paste pertama terlihat mencurigakan, yang memang Formatsnya benar:
    // menempel 400 karakter tanpa pernah mengetik bukan menulis.
    expect(sejakDetikTerakhirMengetik(null, 0)).toBe(9999);
  });

  it("tidak pernah negatif", () => {
    expect(sejakDetikTerakhirMengetik(10_000, 1_000)).toBe(0);
  });
});
