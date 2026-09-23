import { describe, it, expect } from "vitest";
import {
  decodePendaftaran,
  encodePendaftaran,
  type Pendaftaran,
} from "./enrollment";

const CONTOH: Pendaftaran[] = [
  {
    course_id: "crs-1",
    slug: "fullstack-web-development-nextjs-15-react-19",
    enrolled_at: "2026-09-01T08:00:00.000Z",
    selesai_modul: ["crs-1-m1", "crs-1-m2"],
  },
];

describe("enrollment codec", () => {
  it("encode lalu decode menghasilkan ulang daftar yang sama", () => {
    expect(decodePendaftaran(encodePendaftaran(CONTOH))).toEqual(CONTOH);
  });

  it("menolak cookie tanpa tanda tangan yang valid", () => {
    const body = Buffer.from(JSON.stringify(CONTOH), "utf8").toString("base64url");
    expect(decodePendaftaran(`${body}.tandatangan-palsu`)).toEqual([]);
  });

  it("mengembalikan [] untuk cookie rusak atau kosong", () => {
    expect(decodePendaftaran(undefined)).toEqual([]);
    expect(decodePendaftaran("")).toEqual([]);
    expect(decodePendaftaran("bukan-cookie")).toEqual([]);
    expect(decodePendaftaran("!!!.!!!")).toEqual([]);
  });

  it("membuang entri yang bentuknya tidak valid", () => {
    const campur = [...CONTOH, { course_id: 123 }, null, "teks"];
    expect(decodePendaftaran(encodePendaftaran(campur as never[]))).toEqual(CONTOH);
  });
});
