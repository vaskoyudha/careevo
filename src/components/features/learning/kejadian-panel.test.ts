import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import type { KejadianSesi } from "./course-session";

/**
 * Panel kejadian — bentuk barunya (strip sesi yang bisa dibuka).
 *
 * Dua kelas properti, dan keduanya adalah keluhan yang memicu perubahan ini:
 *
 * 1. **Ringkasannya selalu terlihat.** Versi lama adalah panel setinggi ~390px
 *    yang tidak bisa ditutup; isi modul terdorong ke bawah lipatan. Yang baru
 *    harus menampilkan status + hitungan dalam satu baris, dan menyembunyikan
 *    sisanya di balik `hidden` sampai peserta memintanya.
 * 2. **Isinya tetap lengkap dan terjangkau.** Menyembunyikan bukan menghapus:
 *    penjelasan, pelaporan kamera, dan catatan terakhir harus tetap ada di
 *    dokumen dan dirujuk `aria-controls` yang sah.
 *
 * Repo ini lingkungan `node` tanpa jsdom, jadi `renderToStaticMarkup` **tidak
 * menjalankan klik**: keadaan terbuka tidak bisa dicapai dari `KejadianPanel`
 * sendirian. Karena itu `IsiPanelKejadian` diperiksa dengan merendernya
 * langsung — pola yang sama dengan `IsiPanelSilabus` di `reader-silabus.test.ts`
 * — sementara `KejadianPanel` diperiksa pada keadaan tertutupnya, yang justru
 * keadaan default yang harus dibuktikan.
 */

const mocks = vi.hoisted(() => ({
  mulaiSesiAction: vi.fn(),
  catatKejadianAction: vi.fn(),
  akhiriSesiAction: vi.fn(),
}));

vi.mock("@/actions/learning", () => ({
  mulaiSesiAction: mocks.mulaiSesiAction,
  catatKejadianAction: mocks.catatKejadianAction,
  akhiriSesiAction: mocks.akhiriSesiAction,
}));

const { CourseSessionProvider } = await import("./course-session");
const { KejadianPanel, IsiPanelKejadian } = await import("./kejadian-panel");

const CELAH: KejadianSesi = {
  at: "2026-09-30T03:05:00.000Z",
  jenis: "pindah_tab",
  jenis_klasifikasi: "celah",
  visibilitas: "hidden",
};
const BIASA: KejadianSesi = {
  at: "2026-09-30T03:00:00.000Z",
  jenis: "sesi_dimulai",
  jenis_klasifikasi: "kejadian",
  visibilitas: "visible",
};

function propsProvider(kejadianAwal: KejadianSesi[], children: React.ReactNode) {
  return {
    courseId: "crs-1",
    kebijakan: kebijakanDefault(),
    buktiAwal: "t.a",
    runIdAwal: "r-1",
    kejadianAwal,
    children,
  };
}

/** Panel tertutup (keadaan default) dengan daftar kejadian yang diberikan. */
function renderPanel(kejadianAwal: KejadianSesi[], buktiAwal: string | null = "t.a") {
  const isi = propsProvider(kejadianAwal, createElement(KejadianPanel));
  return renderToStaticMarkup(
    createElement(CourseSessionProvider, { ...isi, buktiAwal }),
  );
}

/** Isi panel, dirender langsung — satu-satunya cara memeriksanya tanpa jsdom. */
function renderIsi(kejadianAwal: KejadianSesi[]) {
  return renderToStaticMarkup(
    createElement(CourseSessionProvider, propsProvider(kejadianAwal, createElement(IsiPanelKejadian))),
  );
}

/** Teks yang benar-benar dirender, tanpa tag — copy harus terbaca, bukan sekadar ada di atribut. */
function teks(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.catatKejadianAction.mockResolvedValue({ ok: false });
  mocks.akhiriSesiAction.mockResolvedValue({ ok: true });
});

describe("KejadianPanel — ringkasan selalu terlihat", () => {
  it("menampilkan status sesi dan hitungan dalam keadaan tertutup", () => {
    // Inti perbaikan UX: tanpa pembukaan apa pun, peserta melihat bahwa sesi
    // berjalan dan berapa yang sudah dicatat.
    const html = renderPanel([BIASA, CELAH]);
    expect(teks(html)).toContain("Sesi terverifikasi aktif");
    expect(teks(html)).toContain("2 catatan");
    expect(teks(html)).toContain("1 celah pengawasan");
  });

  it("menyebut aturan bantuan course supaya kebijakannya terbaca tanpa membuka apa pun", () => {
    // `kebijakanDefault()` adalah `bertutor`, jadi labelnya spesifik — bukan
    // sekadar kata "bantuan" yang selalu ada di kalimat lain.
    const html = renderPanel([BIASA]);
    expect(teks(html)).toContain("Tutor Careevo boleh; AI eksternal wajib diungkap");
  });

  it("membedakan 'tidak ada celah' dari 'belum ada yang dicatat'", () => {
    // Hitungan nol adalah informasi, bukan alasan menyembunyikan barisnya:
    // peserta harus bisa membedakan "aman" dari "panel belum jalan".
    const nolCelah = renderPanel([BIASA]);
    expect(teks(nolCelah)).toContain("tidak ada celah");
    expect(teks(nolCelah)).not.toContain("celah pengawasan");
  });

  it("memakai warna peringatan hanya saat ada celah", () => {
    // Warna menyandikan keadaan; kalau warnanya sama, angka amber di samping
    // baris hijau kehilangan artinya. Yang diuji adalah kelas yang membawa
    // warnanya — ikon dan barisnya — bukan border kartunya: kartunya sengaja
    // netral supaya tidak bersaing dengan amber di dalamnya.
    const ada = renderPanel([BIASA, CELAH]);
    expect(ada).toContain("bg-amber-100 text-amber-700");
    expect(ada).toContain("font-medium text-amber-700");
    const tidak = renderPanel([BIASA]);
    expect(tidak).not.toContain("bg-amber-100");
    expect(tidak).not.toContain("text-amber-700");
    // Keadaan aman memakai hijau, bukan sekadar "tidak amber".
    expect(tidak).toContain("bg-emerald-50 text-emerald-600");
  });
});

describe("KejadianPanel — penjelasan tertutup secara default", () => {
  it("tidak membuka isinya saat pertama kali dirender", () => {
    // `hidden`, bukan dihapus: `aria-controls` yang menunjuk id tidak ada
    // melanggar ARIA, dan id-nya harus selalu sah. `hidden` juga mengeluarkan
    // kendali di dalamnya dari urutan tab.
    const html = renderPanel([BIASA]);
    const isi = html.match(/<div id="isi-panel-kejadian"[^>]*>/)?.[0];
    expect(isi).toBeDefined();
    expect(isi).toContain("hidden");
  });

  it("menyembunyikan seluruh kendali pelaporan sampai diminta", () => {
    // Keluhan aslinya: peserta tidak bisa menutup panel. Kalau tombol dan radio
    // di dalamnya tetap dirender di luar `hidden`, ia masih memakan ruang.
    const html = renderPanel([BIASA]);
    const isiTertutup = html.slice(html.indexOf('id="isi-panel-kejadian"'));
    // Potongan setelah pembuka panel tidak memuat teks penjelasannya: ia hidup
    // di dalam node ber-`hidden`.
    expect(isiTertutup).toContain("hidden");
    // Baris "Ak hiri sesi" tetap di luar panel — ia aksi, bukan isi.
    expect(html).toContain("Akhiri sesi");
  });

  it("menghubungkan tombol ke isinya lewat `aria-controls` dan `aria-expanded`", () => {
    const html = renderPanel([BIASA]);
    const tombol = html.match(/<button [^>]*aria-controls="isi-panel-kejadian"[^>]*>/)?.[0];
    expect(tombol).toBeDefined();
    expect(tombol).toContain('aria-expanded="false"');
    // Id yang dirujuk harus benar-benar ada di dokumen.
    expect(html).toContain('id="isi-panel-kejadian"');
  });

  it("memberi `<section>` nama aksesibel lewat heading yang tidak terlihat", () => {
    // Label yang terlihat hidup di dalam `<button>`, dan `<h3>` di dalam
    // `<button>` tidak sah; jadi heading-nya `sr-only` tapi tetap mengikat
    // `aria-labelledby`.
    const html = renderPanel([BIASA]);
    expect(html).toContain('aria-labelledby="judul-panel-kejadian"');
    expect(html).toMatch(/id="judul-panel-kejadian"[^>]*>Catatan kejadian sesi</);
  });

  it("tidak dirender sama sekali saat tidak ada sesi dan tidak ada celah", () => {
    // Kursus `opsional` tanpa celah tidak boleh meninggalkan rongga kosong.
    const html = renderPanel([], null);
    expect(html).toBe("");
  });

  it("tetap tampil saat sesi sudah berakhir tapi masih ada celah tercatat", () => {
    // Cabang ini yang menjaga celah tidak menghilang diam-diam kalau kelak
    // kejadian dipertahankan setelah sesi ditutup: tanpa bukti sesi statusnya
    // bukan `aktif`, tapi celah yang masih ada tetap harus dijelaskan.
    const html = renderPanel([BIASA, CELAH], null);
    expect(teks(html)).toContain("Sesi terverifikasi berakhir");
    expect(teks(html)).toContain("1 celah pengawasan");
    // Tidak ada sesi berjalan, jadi tidak ada tombol untuk mengakhirinya.
    expect(html).not.toContain("Akhiri sesi");
  });
});

describe("IsiPanelKejadian — penjelasan, pelaporan, dan catatan", () => {
  it("menjelaskan apa yang dicatat dan apa yang belum", () => {
    const isi = teks(renderIsi([BIASA]));
    expect(isi).toContain("Pindah tab, keluar layar penuh");
    // Batas jujur soal kamera wajib tetap ada: panel yang mengklaim memantau
    // lebih dari yang dilakukan kode akan berbohong ke peserta.
    expect(isi).toContain("belum");
    expect(isi).toContain("mengakses kameramu");
  });

  it("menegaskan kejadian tidak otomatis menggagalkan penilaian", () => {
    // Spec mewajibkannya, dan tanpa kalimat ini panelnya terbaca seperti tuduhan.
    const isi = teks(renderIsi([BIASA]));
    expect(isi).toContain("tidak otomatis menggagalkan penilaian");
  });

  it("menyediakan pelaporan kamera yang jelas tidak menyalakan kamera", () => {
    const isi = renderIsi([BIASA]);
    expect(teks(isi)).toContain("Kamera: lapor apa yang kamu alami");
    expect(teks(isi)).toContain("tidak menyalakan kamera");
    expect(teks(isi)).toContain("Laporkan gangguan");
  });

  it("mendaftar catatan terakhir beserta klasifikasinya", () => {
    const isi = renderIsi([BIASA, CELAH]);
    expect(teks(isi)).toContain("Pindah tab");
    expect(teks(isi)).toContain("celah pengawasan");
    expect(teks(isi)).toContain("Sesi dimulai");
  });

  it("menautkan ke Pengaturan untuk cara kerja pencatatan", () => {
    expect(renderIsi([BIASA])).toContain('href="/pengaturan"');
  });

  it("tidak menampilkan bagian catatan saat belum ada kejadian", () => {
    const isi = teks(renderIsi([]));
    expect(isi).not.toContain("Catatan terakhir");
  });
});
