import { describe, expect, it } from "vitest";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import {
  hitungCompletionPath,
  hitungSelesaiValid,
  type ProgresModulRingkas,
} from "./service";

/**
 * Test unit policy penyelesaian — **murni, tanpa database**.
 *
 * `service.ts` menyentuh DB lewat repository, jadi fungsi yang butuh query
 * tidak bisa diuji di sini (itu tugas test integrasi). Yang diuji adalah
 * keputusan yang menentukan `completion_path`: diturunkan dari baris
 * `module_progress`, bukan dari input klien.
 *
 * Modul dibuat literal, bukan lewat `modulKursus()`: test ini menguji policy,
 * bukan kurikulum turunan, dan fixture literal membuat id yang diuji terlihat
 * langsung di badan test.
 */

function modul(id: string): ModulKursus {
  return {
    id,
    judul: `Modul ${id}`,
    ringkasan: "ringkasan",
    durasi_min: 10,
    url: "https://example.test/kursus",
  };
}

const MODUL: ModulKursus[] = [modul("crs-1-m1"), modul("crs-1-m2"), modul("crs-1-m3")];

function selesai(
  moduleId: string,
  completionPath: ProgresModulRingkas["completionPath"] = "terverifikasi",
): ProgresModulRingkas {
  return { moduleId, state: "completed", completionPath };
}

describe("hitungCompletionPath", () => {
  it("semua modul selesai lewat jalur terverifikasi → terverifikasi", () => {
    const progres = [
      selesai("crs-1-m1", "terverifikasi"),
      selesai("crs-1-m2", "terverifikasi"),
      selesai("crs-1-m3", "terverifikasi"),
    ];

    expect(hitungCompletionPath(progres, MODUL)).toBe("terverifikasi");
  });

  it("satu modul informal membuat seluruh kursus informal", () => {
    const progres = [
      selesai("crs-1-m1", "terverifikasi"),
      selesai("crs-1-m2", "informal"),
      selesai("crs-1-m3", "terverifikasi"),
    ];

    expect(hitungCompletionPath(progres, MODUL)).toBe("informal");
  });

  it("belum semua modul selesai → null", () => {
    const progres = [selesai("crs-1-m1"), selesai("crs-1-m2")];

    expect(hitungCompletionPath(progres, MODUL)).toBeNull();
  });

  it("modul tanpa baris progres sama sekali → null", () => {
    expect(hitungCompletionPath([], MODUL)).toBeNull();
  });

  it("modul dengan state in_progress tidak dihitung selesai", () => {
    const progres: ProgresModulRingkas[] = [
      selesai("crs-1-m1"),
      selesai("crs-1-m2"),
      { moduleId: "crs-1-m3", state: "in_progress", completionPath: null },
    ];

    expect(hitungCompletionPath(progres, MODUL)).toBeNull();
  });

  it("id modul basi diabaikan, tidak dihitung sebagai progres", () => {
    const progres = [
      selesai("crs-1-m1"),
      selesai("crs-1-m2"),
      selesai("crs-1-m3"),
      selesai("crs-1-m99", "informal"), // modul sudah dihapus dari kurikulum
    ];

    // Id basi informal tidak boleh menurunkan kursus yang seluruhnya terverifikasi.
    expect(hitungCompletionPath(progres, MODUL)).toBe("terverifikasi");
  });

  it("id basi tidak bisa menggantikan modul yang belum selesai", () => {
    const progres = [selesai("crs-1-m1"), selesai("crs-1-m2"), selesai("crs-1-m99")];

    expect(hitungCompletionPath(progres, MODUL)).toBeNull();
  });

  it("modul kurikulum yang hanya punya id basi tetap dianggap belum selesai", () => {
    const progres = [
      selesai("crs-1-m1"),
      selesai("crs-1-m2"),
      selesai("crs-1-m3"),
      selesai("crs-1-m4"),
    ];

    expect(hitungCompletionPath(progres, MODUL)).toBe("terverifikasi");
  });

  it("completion_path null diperlakukan informal, bukan terverifikasi", () => {
    const progres = [
      selesai("crs-1-m1", "terverifikasi"),
      { moduleId: "crs-1-m2", state: "completed", completionPath: null },
      selesai("crs-1-m3", "terverifikasi"),
    ];

    expect(hitungCompletionPath(progres, MODUL)).toBe("informal");
  });

  it("kurikulum kosong → null (tidak ada yang bisa dinyatakan tuntas)", () => {
    expect(hitungCompletionPath([selesai("crs-1-m1")], [])).toBeNull();
  });

  it("modul duplikat pada progres tidak mengubah hasil", () => {
    const progres = [
      selesai("crs-1-m1", "informal"),
      selesai("crs-1-m1", "terverifikasi"),
      selesai("crs-1-m2", "terverifikasi"),
      selesai("crs-1-m3", "terverifikasi"),
    ];

    // Baris terakhir menang: tidak ada dua baris untuk PK yang sama di DB.
    expect(hitungCompletionPath(progres, MODUL)).toBe("terverifikasi");
  });
});

describe("hitungSelesaiValid", () => {
  it("menghitung hanya modul yang ada di kurikulum dan completed", () => {
    const progres = [
      selesai("crs-1-m1"),
      { moduleId: "crs-1-m2", state: "in_progress", completionPath: null },
      selesai("crs-1-m99"),
    ];

    expect(hitungSelesaiValid(progres, MODUL)).toBe(1);
  });

  it("nol bila tidak ada progres", () => {
    expect(hitungSelesaiValid([], MODUL)).toBe(0);
  });

  it("tidak menghitung modul yang sama dua kali", () => {
    const progres = [selesai("crs-1-m1"), selesai("crs-1-m1")];

    expect(hitungSelesaiValid(progres, MODUL)).toBe(1);
  });
});
