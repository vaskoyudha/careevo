import { describe, it, expect } from "vitest";
import {
  MENIT_BERLAKU,
  alamatBuka,
  terbitkanTiket,
  tiketUntuk,
  verifikasiTiket,
} from "./tiket";

const RAHASIA = "rahasia-uji-tiket-1234567890abcdef";
const SEKARANG = Date.parse("2026-10-03T12:00:00Z");
const NANTI = SEKARANG + MENIT_BERLAKU * 60_000;

/** Tiket sah untuk `(u1, c1)` yang berlaku pada `SEKARANG`. */
function tiketSah(): string {
  const t = terbitkanTiket(RAHASIA, { userId: "u1", courseId: "c1", kedaluwarsa: NANTI });
  if (!t) throw new Error("terbitkanTiket mengembalikan null untuk isi yang sah");
  return t;
}

describe("terbitkanTiket", () => {
  it("menerbitkan tiket berbentuk payload.tanda", () => {
    const tiket = tiketSah();
    expect(tiket.split(".")).toHaveLength(2);
    expect(tiket).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("deterministik untuk isi yang sama", () => {
    // Tiket adalah fungsi murni atas isinya, bukan token acak — itu yang
    // membuat server bisa menerbitkan ulang tiket yang identik saat halaman
    // dimuat ulang, tanpa tabel sesi.
    const a = terbitkanTiket(RAHASIA, { userId: "u1", courseId: "c1", kedaluwarsa: NANTI });
    const b = terbitkanTiket(RAHASIA, { userId: "u1", courseId: "c1", kedaluwarsa: NANTI });
    expect(a).toBe(b);
  });

  it("menolak rahasia kosong, bukan menerbitkan tiket yang bisa dipalsukan", () => {
    expect(terbitkanTiket("", { userId: "u1", courseId: "c1", kedaluwarsa: NANTI })).toBeNull();
  });

  it("menolak kolom yang kosong atau memuat pemisah", () => {
    // Kolom yang memuat pemisah membuat pembacaan kolom tidak lagi sepakat
    // dengan yang ditandatangani — kelas bug yang sama dengan `PEMISAH_BUKTI`
    // di `@/lib/learning/session`.
    expect(terbitkanTiket(RAHASIA, { userId: "", courseId: "c1", kedaluwarsa: NANTI })).toBeNull();
    expect(terbitkanTiket(RAHASIA, { userId: "u1", courseId: "", kedaluwarsa: NANTI })).toBeNull();
    expect(
      terbitkanTiket(RAHASIA, { userId: "u\u0001x", courseId: "c1", kedaluwarsa: NANTI }),
    ).toBeNull();
    expect(
      terbitkanTiket(RAHASIA, { userId: "u1", courseId: "c\u0001x", kedaluwarsa: NANTI }),
    ).toBeNull();
  });

  it("menolak kedaluwarsa yang bukan angka positif", () => {
    for (const k of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(terbitkanTiket(RAHASIA, { userId: "u1", courseId: "c1", kedaluwarsa: k })).toBeNull();
    }
  });
});

describe("verifikasiTiket", () => {
  it("menerima tiket yang sah dan belum kedaluwarsa", () => {
    const isi = verifikasiTiket(RAHASIA, tiketSah(), SEKARANG);
    expect(isi).toEqual({ userId: "u1", courseId: "c1", kedaluwarsa: NANTI });
  });

  it("menolak tiket yang sudah kedaluwarsa", () => {
    const lewat = SEKARANG - 1;
    const t = terbitkanTiket(RAHASIA, { userId: "u1", courseId: "c1", kedaluwarsa: lewat })!;
    expect(verifikasiTiket(RAHASIA, t, SEKARANG)).toBeNull();
  });

  it("menolak tepat pada detik kedaluwarsa", () => {
    // `now >= kedaluwarsa` — batasnya eksklusif. Tiket yang masa berlakunya
    // habis **tidak** boleh masih diterima; itu arah yang benar untuk sebuah
    // kredensial.
    const t = terbitkanTiket(RAHASIA, { userId: "u1", courseId: "c1", kedaluwarsa: SEKARANG })!;
    expect(verifikasiTiket(RAHASIA, t, SEKARANG)).toBeNull();
  });

  it("menolak tiket dengan rahasia yang berbeda", () => {
    expect(verifikasiTiket("rahasia-lain", tiketSah(), SEKARANG)).toBeNull();
  });

  it("menolak payload yang diubah walau tanda tangannya tetap ada", () => {
    // Ini serangan yang sebenarnya: ambil payload, ubah `userId` menjadi orang
    // lain, tempelkan tanda tangan lama. Tanda tangan dihitung atas payload
    // mentah, jadi perubahan sekecil apa pun menggagalkannya.
    const [payload, tanda] = tiketSah().split(".");
    const isi = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    isi.userId = "penyusup";
    const payloadPalsu = Buffer.from(JSON.stringify(isi), "utf8").toString("base64url");
    expect(verifikasiTiket(RAHASIA, `${payloadPalsu}.${tanda}`, SEKARANG)).toBeNull();
  });

  it("menolak tiket yang tanda tangannya dipindah ke payload lain", () => {
    const [payloadA] = tiketSah().split(".");
    const b = terbitkanTiket(RAHASIA, { userId: "u2", courseId: "c2", kedaluwarsa: NANTI })!;
    const tandaB = b.split(".")[1];
    expect(verifikasiTiket(RAHASIA, `${payloadA}.${tandaB}`, SEKARANG)).toBeNull();
  });

  it("menolak bentuk yang tidak sah tanpa melempar", () => {
    // Route ini publik. Bentuk apa pun dari luar harus menjadi `null`, bukan
    // pengecualian yang menjadi 500.
    for (const buruk of [
      "",
      ".",
      "..",
      "hanya-payload",
      "a.b.c",
      "!!!.???",
      "eyJhIjoxfQ.", // payload sah, tanda kosong
      ".tanda",
      "payload-bukan-base64.tanda",
    ]) {
      expect(() => verifikasiTiket(RAHASIA, buruk, SEKARANG)).not.toThrow();
      expect(verifikasiTiket(RAHASIA, buruk, SEKARANG)).toBeNull();
    }
  });

  it("menolak tiket yang payload-nya bukan JSON objek", () => {
    for (const isiSalah of ["[1,2,3]", "null", "42", '"teks"', "{}"]) {
      const payload = Buffer.from(isiSalah, "utf8").toString("base64url");
      const palsu = `${payload}.${"x".repeat(43)}`;
      expect(verifikasiTiket(RAHASIA, palsu, SEKARANG)).toBeNull();
    }
  });

  it("menolak rahasia kosong, tidak menerima apa pun", () => {
    // Fail-closed: rahasia yang belum diisi berarti **tidak ada** tiket yang
    // sah. Kalau tidak, konfigurasi yang lupa diisi membuat semua tiket palsu
    // diterima.
    expect(verifikasiTiket("", tiketSah(), SEKARANG)).toBeNull();
  });
});

describe("tiketUntuk", () => {
  it("menerima tiket milik pasangan yang tepat", () => {
    expect(tiketUntuk(RAHASIA, tiketSah(), "u1", "c1", SEKARANG)).not.toBeNull();
  });

  it("menolak tiket milik peserta lain", () => {
    // Ini yang membuat tiket yang dicuri tidak berguna: isinya menunjuk
    // pemilik aslinya, dan itu dibandingkan dengan identitas sesi.
    expect(tiketUntuk(RAHASIA, tiketSah(), "u2", "c1", SEKARANG)).toBeNull();
  });

  it("menolak tiket untuk course lain", () => {
    // Tiket yang sah untuk satu course tidak boleh membuka course lain —
    // termasuk course yang peserta itu juga layak membukanya, karena tiket
    // adalah otorisasi untuk **satu** ruang kerja.
    expect(tiketUntuk(RAHASIA, tiketSah(), "u1", "c2", SEKARANG)).toBeNull();
  });
});

describe("alamatBuka", () => {
  it("menyusun alamat gerbang dengan tiket ter-encode", () => {
    const alamat = alamatBuka("crs-1", "payload.tanda+slash/");
    expect(alamat).toContain("/api/workspace/buka");
    expect(alamat).toContain("courseId=crs-1");
    // Nilai yang memuat `+`, `/`, atau `=` harus ter-encode, kalau tidak
    // pembacaan query di sisi gerbang akan memotongnya.
    expect(alamat).not.toContain("payload.tanda+slash/");
    expect(alamat).toContain("tiket=payload.tanda%2Bslash%2F");
  });

  it("menghasilkan alamat yang bisa di-parse dan mengembalikan nilai aslinya", () => {
    const tiket = tiketSah();
    const url = new URL(alamatBuka("crs-1", tiket), "http://127.0.0.1:3000");
    expect(url.pathname).toBe("/api/workspace/buka");
    expect(url.searchParams.get("courseId")).toBe("crs-1");
    expect(url.searchParams.get("tiket")).toBe(tiket);
  });
});
