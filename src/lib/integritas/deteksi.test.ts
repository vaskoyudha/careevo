import { describe, expect, it } from "vitest";
import type { KejadianIntegritas } from "@/lib/learning/session";
import {
  AMBANG_KELUAR_TAB,
  AMBANG_PASTE_KARAKTER,
  AMBANG_PASTE_PERISTIWA,
  deteksiUsulan,
  panjangPaste,
} from "./deteksi";
import { JENIS_PELANGGARAN } from "./katalog";

/** Kejadian ringkas; hanya field yang dibaca `deteksiUsulan` yang diisi. */
function k(
  jenis: KejadianIntegritas["jenis"],
  detail?: string,
): KejadianIntegritas {
  return {
    at: "2026-10-03T00:00:00.000Z",
    jenis,
    jenis_klasifikasi: "kejadian",
    visibilitas: "visible",
    ...(detail ? { detail } : {}),
  };
}

describe("panjangPaste", () => {
  it("membaca angka di awal detail", () => {
    expect(panjangPaste("240 karakter")).toBe(240);
  });

  it("detail kosong atau tak terbaca menjadi 0, bukan NaN", () => {
    expect(panjangPaste(undefined)).toBe(0);
    expect(panjangPaste("")).toBe(0);
    expect(panjangPaste("tidak ada angka")).toBe(0);
  });
});

describe("deteksiUsulan — ambang paste", () => {
  it("tidak mengusulkan apa pun untuk sesi bersih", () => {
    expect(deteksiUsulan([])).toEqual([]);
    expect(deteksiUsulan([k("sesi_dimulai"), k("sesi_diakhiri")])).toEqual([]);
  });

  it("tidak mengusulkan untuk satu tempelan pendek", () => {
    // Satu tempelan di bawah kedua ambang: menempel potongan kecil (mis. nama
    // fungsi dari dokumentasi sendiri) adalah hal yang wajar.
    const usulan = deteksiUsulan([k("paste_massal", "50 karakter")]);
    expect(usulan).toEqual([]);
  });

  it("mengusulkan saat satu tempelan melewati ambang karakter", () => {
    const usulan = deteksiUsulan([
      k("paste_massal", `${AMBANG_PASTE_KARAKTER} karakter`),
    ]);
    expect(usulan).toHaveLength(1);
    expect(usulan[0]!.jenis).toBe("pola_salin_tempel");
    expect(usulan[0]!.bukti.panjang_terpanjang).toBe(AMBANG_PASTE_KARAKTER);
  });

  it("mengusulkan saat jumlah peristiwa melewati ambang, walau tiap tempelan pendek", () => {
    const usulan = deteksiUsulan(
      Array.from({ length: AMBANG_PASTE_PERISTIWA }, () => k("paste_massal", "10 karakter")),
    );
    expect(usulan.map((u) => u.jenis)).toContain("pola_salin_tempel");
  });

  it("bobot usulan disalin dari katalog saat usulan dibuat", () => {
    const usulan = deteksiUsulan([k("paste_massal", "999 karakter")]);
    expect(usulan[0]!.penalty).toBe(10);
  });
});

describe("deteksiUsulan — ambang meninggalkan sesi", () => {
  it("tidak mengusulkan untuk satu-dua kali pindah tab", () => {
    const usulan = deteksiUsulan([k("pindah_tab"), k("fokus_hilang")]);
    expect(usulan).toEqual([]);
  });

  it("mengusulkan saat pindah tab dan fokus hilang digabung melewati ambang", () => {
    const kejadian = [
      k("pindah_tab"),
      k("pindah_tab"),
      k("fokus_hilang"),
    ];
    expect(kejadian.length).toBeGreaterThanOrEqual(AMBANG_KELUAR_TAB);
    const usulan = deteksiUsulan(kejadian);
    expect(usulan).toHaveLength(1);
    expect(usulan[0]!.jenis).toBe("meninggalkan_sesi");
    expect(usulan[0]!.penalty).toBe(5);
  });
});

describe("deteksiUsulan — batas yang tidak boleh dilanggar", () => {
  it("tidak pernah mengusulkan plagiarisme", () => {
    // `plagiarisme` menuntut pembacaan isi karya. Mesin yang mengusulkannya akan
    // menuduh setiap orang yang menempel banyak teks, dan tuduhan itu tidak
    // berdasar. Batas ini harus bertahan walau sinyalnya tampak kuat.
    const kejadian = [
      k("paste_massal", "5000 karakter"),
      k("pindah_tab"),
      k("pindah_tab"),
      k("pindah_tab"),
      k("salin_terlarang"),
      k("pintasan_terlarang"),
      k("wajah_kedua"),
      k("wajah_tidak_terdeteksi"),
    ];
    const jenis = deteksiUsulan(kejadian).map((u) => u.jenis);
    expect(jenis).not.toContain("plagiarisme");
  });

  it("hanya mengusulkan jenis yang ada di katalog", () => {
    const kejadian = [
      k("paste_massal", "999 karakter"),
      k("pindah_tab"),
      k("pindah_tab"),
      k("pindah_tab"),
    ];
    for (const u of deteksiUsulan(kejadian)) {
      expect(JENIS_PELANGGARAN).toContain(u.jenis);
    }
  });

  it("tidak memakai kata vonis di alasan", () => {
    const kejadian = [
      k("paste_massal", "999 karakter"),
      k("pindah_tab"),
      k("pindah_tab"),
      k("pindah_tab"),
    ];
    for (const u of deteksiUsulan(kejadian)) {
      const teks = u.alasan.toLowerCase();
      for (const kata of ["curang", "menyalin", "mencontek", "bersalah", "plagiat"]) {
        expect(teks, `alasan memuat "${kata}"`).not.toContain(kata);
      }
    }
  });

  it("tidak memuat token, email, atau identitas di bukti", () => {
    const usulan = deteksiUsulan([k("paste_massal", "999 karakter")]);
    const teks = JSON.stringify(usulan[0]!.bukti);
    expect(teks).not.toContain("@");
    expect(teks).not.toContain("token");
  });

  it("deterministik: urutan hasil sama untuk input yang sama", () => {
    const kejadian = [
      k("paste_massal", "999 karakter"),
      k("pindah_tab"),
      k("pindah_tab"),
      k("pindah_tab"),
    ];
    expect(deteksiUsulan(kejadian)).toEqual(deteksiUsulan(kejadian));
  });

  it("satu usulan per jenis, bukan satu per peristiwa", () => {
    // Lima tempelan panjang adalah satu pola, bukan lima pelanggaran.
    const usulan = deteksiUsulan(
      Array.from({ length: 5 }, () => k("paste_massal", "500 karakter")),
    );
    expect(usulan.filter((u) => u.jenis === "pola_salin_tempel")).toHaveLength(1);
  });
});
