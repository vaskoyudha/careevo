import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { pilihJalurPenyelesaian, modulSelesaiMembaca } from "./selesaikan-modul";
import type { CheckpointMateri, Halaman, KebijakanCourse, Submodul } from "@/types/course";

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

/**
 * Sumber tanpa komentar — untuk pemeriksaan **struktur**.
 *
 * Berkas yang diperiksa di bawah menjelaskan keputusan-keputusannya panjang
 * lebar dalam prosa Indonesia, dan prosa itu menyebut justru nama-nama yang
 * tidak boleh muncul di kode (mis. komentar di `detail-kursus.tsx` yang
 * menerangkan kenapa salinan `selesaikanMateriAction` dibuang). Menguji teks
 * mentah berarti tesnya gagal karena dokumentasinya bagus, dan menghapus
 * komentarnya agar hijau justru menghilangkan alasan keputusan itu. Jadi yang
 * diperiksa adalah kode, bukan prosa.
 *
 * Komentar blok dan `//` baris (yang didahului spasi/awal baris, supaya
 * `https://` di dalam string tidak dimakan) dibuang.
 */
function tanpaKomentar(teks: string): string {
  return teks
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

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
    // Kedua berkas komponen menjelaskan keputusan ini panjang-lebar di
    // komentarnya — menyebut justru nama-nama yang tidak boleh ada di kode.
    // Menguji teks mentah berarti tesnya gagal karena dokumentasinya bagus, jadi
    // komentarnya dibuang dulu (pola yang sama dengan `materi-shell.test.ts`).
    const shellReader = tanpaKomentar(
      readFileSync(
        path.join(akar, "components/features/learning/materi-shell.tsx"),
        "utf8",
      ),
    );
    const halamanKursus = tanpaKomentar(
      readFileSync(
        path.join(akar, "components/features/learning/detail-kursus.tsx"),
        "utf8",
      ),
    );

    // Reader memakai jalurnya lewat hook, dan **tidak** mengomposisikan
    // `wajibSesiTerverifikasi` dengan `checkpointTerverifikasi` sendiri — pola
    // itulah yang dulu disalin, dan pola itulah yang diperiksa.
    expect(shellReader).toContain("useSelesaikanModul(");
    expect(shellReader).not.toMatch(/wajibSesiTerverifikasi\([^)]*\)\s*&&/);
    expect(shellReader).not.toContain("checkpointTerverifikasi(");

    // Halaman kursus **tidak lagi** memegang salinan pelaksanaannya sendiri:
    // penyelesaian modul hanya dijalankan reader (otomatis di halaman terakhir),
    // jadi jalur penyelesaian tidak punya permukaan kedua yang bisa menyimpang.
    expect(halamanKursus).not.toContain("pilihJalurPenyelesaian(");
    expect(halamanKursus).not.toContain("selesaikanMateriAction");
    expect(halamanKursus).not.toContain("tandaiModulAction");

    // Helper tetap yang mengomposisikannya — kalau tidak, ia berhenti jadi
    // mesin keputusannya dan tes di atasnya tidak lagi menguji apa pun.
    expect(helper).toMatch(/wajibSesiTerverifikasi\(kebijakan\)\s*&&\s*checkpointTerverifikasi\(efektif\)/);
  });
});

/**
 * Pemicu penyelesaian otomatis — "sudah selesai membaca?".
 *
 * Ini yang menggantikan tombol "Tandai selesai", jadi yang dikunci di sini
 * adalah **kapan** pemicunya menyala: halaman terakhir modul bacaan. Salah di
 * sini berarti modul ditandai selesai terlalu dini (halaman pertama modul
 * panjang), atau tidak pernah (halaman terakhir tidak dikenali) — keduanya
 * senyap, tanpa error di mana pun.
 */

function halaman(id: string, urutan: number): Halaman {
  return {
    id,
    submodul_id: "s1",
    modul_id: "m1",
    course_id: "crs-1",
    judul: `Halaman ${urutan}`,
    urutan,
    blok: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function modul(...ids: string[]): Submodul[] {
  return [
    {
      id: "s1",
      modul_id: "m1",
      course_id: "crs-1",
      judul: "Bagian 1",
      ringkasan: "",
      urutan: 1,
      halaman: ids.map((id, i) => halaman(id, i + 1)),
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

/** Modul bacaan bertiga halaman, satu bab. */
const MODUL_TIGA = { submodul: modul("h1", "h2", "h3") };
const MODUL_SATU = { submodul: modul("h1") };

describe("modulSelesaiMembaca", () => {
  it("menyala di halaman terakhir", () => {
    expect(
      modulSelesaiMembaca({
        checkpoint: MATERI,
        modul: MODUL_TIGA,
        halamanId: "h3",
      }),
    ).toBe(true);
  });

  it("tidak menyala di halaman sebelum halaman terakhir", () => {
    for (const id of ["h1", "h2"]) {
      expect(
        modulSelesaiMembaca({
          checkpoint: MATERI,
          modul: MODUL_TIGA,
          halamanId: id,
        }),
      ).toBe(false);
    }
  });

  it("modul satu halaman selesai begitu halaman itu dibuka", () => {
    expect(
      modulSelesaiMembaca({
        checkpoint: MATERI,
        modul: MODUL_SATU,
        halamanId: "h1",
      }),
    ).toBe(true);
  });

  it("memperlakukan id halaman basi sebagai halaman pertama, bukan halaman terakhir", () => {
    // Aturannya sama dengan `halamanDipilih()`: `?halaman=` yang tidak ketemu
    // jatuh ke halaman pertama. Kalau id basi malah dibaca sebagai "terakhir",
    // membuka tautan lama akan menandai modul panjang selesai.
    expect(
      modulSelesaiMembaca({
        checkpoint: MATERI,
        modul: MODUL_TIGA,
        halamanId: "sudah-dihapus",
      }),
    ).toBe(false);
    // `undefined`/`null` sama: berarti halaman pertama.
    expect(
      modulSelesaiMembaca({
        checkpoint: MATERI,
        modul: MODUL_TIGA,
        halamanId: null,
      }),
    ).toBe(false);
  });

  it("tidak pernah menyala untuk modul kuis/proyek — penyelesaiannya bukan peristiwa membaca", () => {
    // Modul kuis diselesaikan lewat penilaiannya sendiri; menandainya dari
    // halaman terakhir akan melewati gerbang asesmen, dan server menolaknya.
    for (const cp of [KUIS, PROYEK]) {
      expect(
        modulSelesaiMembaca({
          checkpoint: cp,
          modul: MODUL_TIGA,
          halamanId: "h3",
        }),
      ).toBe(false);
    }
  });

  it("tidak menyala untuk modul tanpa halaman (turunan)", () => {
    // Modul turunan tidak punya prosa; tidak ada "halaman terakhir" untuk
    // dicapai, jadi tidak ada pemicu — penyelesaiannya memang bukan peristiwa
    // membaca.
    expect(
      modulSelesaiMembaca({
        checkpoint: MATERI,
        modul: { submodul: [] },
        halamanId: "h1",
      }),
    ).toBe(false);
  });

  it("tidak menerima kebijakan — jalur tetap urusan pemanggil", () => {
    // Dijaga **tipe**: menambahkan field `kebijakan` ke parameter berarti
    // pemanggil berikutnya akan menyaring dengannya, dan course `wajib` tanpa
    // sesi jadi tidak pernah mencoba menyelesaikan modulnya. `tsc` tidak bisa
    // menolak field yang belum ada, jadi dijaga dari sumber — pola yang sama
    // dengan pemeriksaan signature `pilihJalurPenyelesaian` di atas.
    const sumber = readFileSync(path.resolve(__dirname, "selesaikan-modul.ts"), "utf8");
    const signature = sumber.slice(
      sumber.indexOf("export function modulSelesaiMembaca"),
      sumber.indexOf("}): boolean {"),
    );
    expect(signature).not.toContain("kebijakan");
  });
});
