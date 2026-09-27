import { describe, expect, it } from "vitest";
import { JENIS_KEJADIAN_SAH } from "./akses";
import {
  ASAL_SINYAL,
  BATAS_SINYAL,
  asalSinyal,
  deteksiSeb,
  versiSeb,
  type AsalSinyal,
} from "./sumber-sinyal";

describe("asalSinyal", () => {
  it("memetakan tiap jenis yang sah ke tepat satu asal", () => {
    // Tidak ada jenis yang boleh lolos tanpa asal: tanpa asal, laporan
    // menampilkan "3 sinyal" tanpa menyebut dari mana, dan pembaca akan
    // menganggap semuanya sekuat.
    for (const jenis of JENIS_KEJADIAN_SAH) {
      expect(Object.hasOwn(ASAL_SINYAL, jenis)).toBe(true);
    }
  });

  it("menggolongkan sinyal self-report browser sebagai browser", () => {
    expect(asalSinyal("pindah_tab")).toBe("browser");
    expect(asalSinyal("paste_massal")).toBe("browser");
    expect(asalSinyal("pintasan_terlarang")).toBe("browser");
    expect(asalSinyal("keluar_fullscreen")).toBe("browser");
  });

  it("menggolongkan sinyal turunan model sebagai kamera", () => {
    expect(asalSinyal("wajah_tidak_terdeteksi")).toBe("kamera");
    expect(asalSinyal("wajah_kedua")).toBe("kamera");
  });

  it("menggolongkan sinyal dari luar aplikasi sebagai luar", () => {
    expect(asalSinyal("seb_aktif")).toBe("luar");
  });

  it("menggolongkan sinyal yang dihitung server sebagai server", () => {
    expect(asalSinyal("sesi_dimulai")).toBe("server");
    expect(asalSinyal("sesi_diakhiri")).toBe("server");
  });

  it("memakai asal server untuk jenis yang tidak dikenal, bukan melompat", () => {
    // Jenis asing diabaikan saat baca laporan; kalau sampai ke sini, "server"
    // adalah pilihan paling tidak menuduh, dan `BATAS_SINYAL` selalu punya
    // teks untuk asal mana pun.
    expect(asalSinyal("jenis_masa_depan" as never)).toBe("server");
  });
});

describe("BATAS_SINYAL", () => {
  it("memiliki teks untuk setiap asal", () => {
    const asal: AsalSinyal[] = ["browser", "kamera", "luar", "server"];
    for (const a of asal) {
      expect(BATAS_SINYAL[a].length).toBeGreaterThan(20);
    }
  });

  it("menyatakan bahwa sinyal browser bisa dihentikan peserta", () => {
    // Ini batas yang paling sering hilang saat disunting, dan yang paling
    // penting: tanpa itu, "sesi bersih" dibaca sebagai bukti tidak curang.
    expect(BATAS_SINYAL.browser).toContain("dihentikan");
  });

  it("menyatakan bahwa deteksi kamera bisa salah dan tidak mengidentifikasi orang", () => {
    expect(BATAS_SINYAL.kamera).toContain("bisa salah");
    expect(BATAS_SINYAL.kamera).toContain("tidak mengidentifikasi");
  });
});

describe("deteksiSeb", () => {
  const headers = (peta: Record<string, string>) => ({
    get: (nama: string) => peta[nama.toLowerCase()] ?? null,
  });

  it("mengenali sesi yang berjalan di SEB", () => {
    expect(deteksiSeb(headers({ "x-safeexambrowser": "1" }))).toBe(true);
  });

  it("tidak mengenali sesi di browser biasa", () => {
    // Tidak adanya header **tidak** berarti SEB tidak dipakai — hanya berarti kita
    // tidak punya bukti. Keduanya dibedakan di laporan lewat `asal` sinyal.
    expect(deteksiSeb(headers({}))).toBe(false);
  });

  it("membaca versi SEB untuk disimpan sebagai detail", () => {
    expect(versiSeb(headers({ "x-safeexambrowser": "SEB_3_5_0" }))).toBe("SEB_3_5_0");
  });

  it("mengembalikan null versi saat tidak ada", () => {
    expect(versiSeb(headers({}))).toBeNull();
  });

  it("mengenali header walau isinya kosong", () => {
    // SEB versi lama mengirim header tanpa nilai; kehadirannya sudah cukup
    // sebagai sinyal bahwa ujian berjalan di dalamnya.
    expect(deteksiSeb(headers({ "x-safeexambrowser": "" }))).toBe(true);
  });
});
