import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { pilihJalurPenyelesaian } from "./selesaikan-modul";
import type { CheckpointMateri, KebijakanCourse } from "@/types/course";

/**
 * Keputusan jalur penyelesaian — murni, jadi diuji langsung.
 *
 * Ini satu-satunya aturan yang **wajib** dipakai bersama oleh reader dan halaman
 * kursus (`detail-kursus.tsx`). Kalau salinannya menyimpang, tidak ada yang
 * gagal di tempat lain: dua permukaan cuma akan berperilaku beda pada course
 * yang sama. Karena itu yang dikunci di sini adalah **kedua** jalur, termasuk
 * jalur informal yang mudah dianggap remeh — `opsional`, checkpoint
 * `kuis`/`proyek`, dan pembatalan.
 */

function kebijakan(aturan: KebijakanCourse["aturan_pengawasan"]): KebijakanCourse {
  return {
    aturan_bantuan: "bertutor",
    aturan_pengawasan: aturan,
    versi: 1,
    aturan_pengawasan_sejak: "2026-09-30T00:00:00.000Z",
  };
}

const MATERI: CheckpointMateri = { batas_waktu_menit: 30, mode: "materi" };
const KUIS: CheckpointMateri = { batas_waktu_menit: 30, mode: "kuis" };
const PROYEK: CheckpointMateri = { batas_waktu_menit: 30, mode: "proyek" };

describe("pilihJalurPenyelesaian", () => {
  it("memilih `terverifikasi` untuk course `wajib` dengan checkpoint `materi`", () => {
    expect(
      pilihJalurPenyelesaian({ kebijakan: kebijakan("wajib"), checkpoint: MATERI, sudah: false }),
    ).toBe("terverifikasi");
  });

  it("memilih `terverifikasi` untuk `wajib_kamera` juga", () => {
    // `wajib_kamera` adalah `wajib` plus kamera; ia tetap menuntut sesi, jadi
    // gerbangnya tidak boleh ikut longgar hanya karena kameranya disebut.
    expect(
      pilihJalurPenyelesaian({
        kebijakan: kebijakan("wajib_kamera"),
        checkpoint: MATERI,
        sudah: false,
      }),
    ).toBe("terverifikasi");
  });

  it("memakai checkpoint default yang aman saat modul tidak punya checkpoint", () => {
    // Modul turunan tidak membawa checkpoint; default-nya `materi`, jadi modul
    // tanpa checkpoint di course `wajib` **tidak** boleh lolos ke jalur
    // informal — itu akan membuka pintu belakang untuk penyelesaian sendiri.
    expect(
      pilihJalurPenyelesaian({ kebijakan: kebijakan("wajib"), checkpoint: undefined, sudah: false }),
    ).toBe("terverifikasi");
    // Checkpoint yang rusak (mode tak dikenal) juga jatuh ke default `materi`,
    // bukan ke jalur informal.
    expect(
      pilihJalurPenyelesaian({
        kebijakan: kebijakan("wajib"),
        checkpoint: { batas_waktu_menit: 0, mode: "entah" as CheckpointMateri["mode"] },
        sudah: false,
      }),
    ).toBe("terverifikasi");
  });

  it("memilih `informal` untuk course `opsional`", () => {
    expect(
      pilihJalurPenyelesaian({ kebijakan: kebijakan("opsional"), checkpoint: MATERI, sudah: false }),
    ).toBe("informal");
  });

  it("memilih `informal` untuk checkpoint `kuis` dan `proyek` di course `wajib`", () => {
    // Keduanya dinilai lewat jalur penilaiannya sendiri, jadi penandaan manual
    // tetap sah — kalau tidak, modul kuis di course `wajib` tidak akan pernah
    // bisa ditandai selesai di reader.
    expect(
      pilihJalurPenyelesaian({ kebijakan: kebijakan("wajib"), checkpoint: KUIS, sudah: false }),
    ).toBe("informal");
    expect(
      pilihJalurPenyelesaian({ kebijakan: kebijakan("wajib"), checkpoint: PROYEK, sudah: false }),
    ).toBe("informal");
  });

  it("memilih `informal` saat modul sudah selesai — yaitu pembatalan", () => {
    // `selesaikanMateriAction` hanya bisa menandai selesai; mengoreksi tanda
    // harus tetap mungkin, jadi pembatalan selalu lewat jalur informal apa pun
    // kebijakannya.
    expect(
      pilihJalurPenyelesaian({ kebijakan: kebijakan("wajib"), checkpoint: MATERI, sudah: true }),
    ).toBe("informal");
    expect(
      pilihJalurPenyelesaian({
        kebijakan: kebijakan("wajib_kamera"),
        checkpoint: MATERI,
        sudah: true,
      }),
    ).toBe("informal");
  });

  it("tidak melihat ada/tidaknya bukti — dan `bukti` tidak masuk signature-nya", () => {
    // Properti ini dijaga **tipe**: tidak ada field `bukti` di parameter. Kalau
    // ia ditambahkan, pemanggil berikutnya hampir pasti menyaring dengan itu —
    // dan itulah bug yang sudah dijelaskan panjang di `akses.ts:31–38`.
    // Ditegakkan dari teks sumber karena `tsc` tidak bisa menolak field yang
    // belum ada.
    const sumber = readFileSync(path.resolve(__dirname, "selesaikan-modul.ts"), "utf8");
    const signature = sumber.slice(
      sumber.indexOf("export function pilihJalurPenyelesaian"),
      sumber.indexOf("): JalurPenyelesaian {"),
    );
    expect(signature).not.toContain("bukti");
  });

  it("komposisi tiga gerbang hidup di satu tempat, bukan disalin di pemanggil", () => {
    // Salinan kedua adalah regresi yang tes ini jaga: ia tidak muncul sebagai
    // error, hanya sebagai dua permukaan yang berperilaku beda pada course yang
    // sama. Pemanggil harus lewat helper ini, bukan menyusun gerbangnya sendiri.
    // Membaca teks sumber karena yang dijaga adalah bentuknya — "tidak ada
    // komposisi di luar sini" — bukan perilaku satu pemanggilan.
    const akar = path.resolve(__dirname, "../../..");
    const helper = readFileSync(path.resolve(__dirname, "selesaikan-modul.ts"), "utf8");
    const halamanKursus = readFileSync(
      path.join(akar, "components/features/learning/detail-kursus.tsx"),
      "utf8",
    );

    // Halaman kursus memakai helper, dan **tidak** lagi mengomposisikan
    // `wajibSesiTerverifikasi` dengan `checkpointTerverifikasi` sendiri — pola
    // itulah yang dulu disalin, dan pola itulah yang diperiksa.
    expect(halamanKursus).toContain("pilihJalurPenyelesaian(");
    expect(halamanKursus).not.toMatch(/wajibSesiTerverifikasi\([^)]*\)\s*&&/);
    expect(halamanKursus).not.toContain("checkpointTerverifikasi(");

    // Helper tetap yang mengomposisikannya — kalau tidak, ia berhenti jadi
    // mesin keputusannya dan tes di atasnya tidak lagi menguji apa pun.
    expect(helper).toMatch(/wajibSesiTerverifikasi\(kebijakan\)\s*&&\s*checkpointTerverifikasi\(efektif\)/);
  });
});
