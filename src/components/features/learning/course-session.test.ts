import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { kebijakanDefault } from "@/lib/courses/kebijakan";

/**
 * Provider sesi — diuji lewat HTML **dan** lewat konteks yang benar-benar
 * dihasilkan.
 *
 * Dua lapis, karena keduanya membuktikan hal berbeda dan satu tidak bisa
 * menggantikan yang lain:
 *
 * 1. **HTML** (`CourseSessionPrompt`) membuktikan `status` hasil seed: gerbang
 *    `wajib` tidak tampil saat bukti awal ada.
 * 2. **Konteks** (probe `useCourseSession`) membuktikan sisa state yang tidak
 *    terlihat di HTML — `bukti`, `kejadian`, dan terutama **`runRef`**.
 *
 * Lapis kedua ada karena `runRef` **tidak bisa diamati** lewat
 * `renderToStaticMarkup`: ia ref, bukan output render. Padahal justru `runRef`
 * yang menopang syarat integritas task ini — listener kejadian hidup di luar
 * siklus render dan membaca ref, bukan state, sehingga ref yang dibiarkan `null`
 * membuat sesi hasil seed berjalan **tanpa mencatat kejadian apa pun**.
 *
 * Cara membuktikannya tanpa jsdom: `akhiri` dan `laporKejadian` sama-sama
 * early-return saat `runRef.current === null`, jadi **panggilan ke server action
 * yang ter-mock itu sendiri** adalah bukti ref terisi. Action-nya di-mock karena
 * `@/actions/learning` adalah modul `"use server"` yang menarik `next/cache` dan
 * service server-only; yang diuji di sini hanya provider klien.
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

import {
  CourseSessionProvider,
  CourseSessionPrompt,
  useCourseSession,
  type SessionKonteks,
  type KejadianSesi,
} from "./course-session";

/** Prop seed yang diuji; semuanya opsional seperti di provider. */
type PropsSeed = {
  buktiAwal?: string | null;
  runIdAwal?: string | null;
  kejadianAwal?: KejadianSesi[];
};

/**
 * Menyusun props provider di variabel lebih dulu, bukan sebagai literal inline.
 *
 * `children` disertakan lewat objek props karena tipe React 19 mewajibkannya ada
 * di props (bentuk tiga-argumen `createElement` tidak lolos `tsc`), sementara
 * aturan eslint `react/no-children-prop` menandai literal objek yang punya kunci
 * `children` — variabel lolos keduanya.
 */
function propsProvider(props: PropsSeed, children: React.ReactNode) {
  return {
    courseId: "crs-1",
    kebijakan: kebijakanDefault(),
    ...props,
    children,
  };
}

function render(props: PropsSeed) {
  return renderToStaticMarkup(
    createElement(CourseSessionProvider, propsProvider(props, createElement(CourseSessionPrompt))),
  );
}

/**
 * Konteks sesi yang ditangkap saat render.
 *
 * Ditampung di array, bukan variabel tunggal, supaya tipe hasil bacanya tetap
 * `SessionKonteks | undefined` apa adanya — `let` biasa dipersempit `tsc`
 * menjadi `null` karena ia tidak bisa melihat bahwa `Probe` mengisinya.
 */
const tertangkap: SessionKonteks[] = [];

function Probe() {
  tertangkap.push(useCourseSession());
  return null;
}

/** Render provider dengan probe sebagai anak, lalu kembalikan konteksnya. */
function ambilKonteks(props: PropsSeed): SessionKonteks {
  tertangkap.length = 0;
  renderToStaticMarkup(
    createElement(CourseSessionProvider, propsProvider(props, createElement(Probe))),
  );
  const konteks = tertangkap.at(-1);
  if (!konteks) throw new Error("Probe tidak menangkap konteks sesi");
  return konteks;
}

beforeEach(() => {
  vi.clearAllMocks();
  // `ok: false` sengaja: `laporKejadian` pulang lebih awal **sebelum** menyentuh
  // setter state saat balasannya tidak ok, jadi test tidak bergantung pada
  // perilaku `useState` di luar siklus render. Yang diuji tetap panggilannya.
  mocks.catatKejadianAction.mockResolvedValue({ ok: false });
  mocks.akhiriSesiAction.mockResolvedValue({ ok: true });
});

describe("CourseSessionProvider — seed awal", () => {
  it("tanpa bukti awal, gerbang `wajib` tetap tampil", () => {
    expect(render({})).toContain("Mulai sesi terverifikasi");
  });

  it("dengan bukti awal, gerbang tidak tampil", () => {
    // `kebijakanDefault()` adalah `wajib`, jadi inilah jalur yang penting.
    const html = render({ buktiAwal: "token.abc", runIdAwal: "run-1" });
    expect(html).not.toContain("Mulai sesi terverifikasi");
  });

  it("bukti awal kosong diperlakukan sebagai tidak ada sesi", () => {
    expect(render({ buktiAwal: "" })).toContain("Mulai sesi terverifikasi");
    expect(render({ buktiAwal: null })).toContain("Mulai sesi terverifikasi");
  });
});

describe("CourseSessionProvider — seed `bukti`, bukan cuma `status`", () => {
  // Gerbang yang menentukan penyelesaian materi adalah `boleh("materi")`, yang
  // membaca `Boolean(bukti)` lewat `putuskanAkses`. HTML hanya membuktikan
  // `status`, jadi implementasi setengah jadi yang meng-seed `status` tetapi
  // meninggalkan `bukti` null akan lolos tiga test di atas padahal gerbangnya
  // tetap tertutup. Di sini yang diuji keputusannya, bukan tampilannya.
  it("dengan bukti awal, materi bebas dikerjakan", () => {
    const konteks = ambilKonteks({ buktiAwal: "token.abc", runIdAwal: "run-1" });
    expect(konteks.boleh("materi").tipe).toBe("bebas");
  });

  it("tanpa bukti awal, materi butuh sesi", () => {
    expect(ambilKonteks({}).boleh("materi").tipe).toBe("perlu_sesi");
  });

  it("bukti kosong tetap butuh sesi walau status terlihat `aktif`", () => {
    // `""` bukan sesi: `putuskanAkses` memakai `Boolean(bukti)`, jadi status
    // tidak boleh membuat gerbangnya terbuka.
    expect(ambilKonteks({ buktiAwal: "" }).boleh("materi").tipe).toBe("perlu_sesi");
  });
});

describe("CourseSessionProvider — cermin `runRef`", () => {
  // Ini syarat integritas task: kalau `runRef` dibiarkan `null` pada render
  // pertama, sesi hasil seed berjalan tanpa mencatat satu kejadian pun. Test di
  // sini gagal pada implementasi yang mengembalikan `useRef(null)`.
  it("mencatat kejadian untuk sesi hasil seed", async () => {
    const konteks = ambilKonteks({ buktiAwal: "token.abc", runIdAwal: "run-1" });
    await konteks.laporKejadian("pindah_tab", "hidden");
    expect(mocks.catatKejadianAction).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1" }),
    );
  });

  it("tanpa runIdAwal, tidak ada yang dicatat", async () => {
    // Sesi yang terlihat aktif tetapi tanpa run tidak punya tempat mencatat;
    // memanggil action dengan id kosong justru akan ditolak server.
    const konteks = ambilKonteks({ buktiAwal: "token.abc" });
    await konteks.laporKejadian("pindah_tab", "hidden");
    expect(mocks.catatKejadianAction).not.toHaveBeenCalled();
  });

  it("`akhiri` menutup run hasil seed, bukan run kosong", async () => {
    const konteks = ambilKonteks({ buktiAwal: "token.abc", runIdAwal: "run-1" });
    await konteks.akhiri();
    expect(mocks.akhiriSesiAction).toHaveBeenCalledWith("run-1", "peserta_akhiri");
  });
});

describe("CourseSessionProvider — seed `kejadian`", () => {
  const contoh: KejadianSesi[] = [
    {
      at: "2026-09-30T00:00:00.000Z",
      jenis: "pindah_tab",
      jenis_klasifikasi: "celah",
      visibilitas: "hidden",
    },
    {
      at: "2026-09-30T00:01:00.000Z",
      jenis: "sesi_dimulai",
      jenis_klasifikasi: "kejadian",
      visibilitas: "visible",
    },
  ];

  it("memakai kejadianAwal sebagai daftar awal", () => {
    const konteks = ambilKonteks({
      buktiAwal: "token.abc",
      runIdAwal: "run-1",
      kejadianAwal: contoh,
    });
    expect(konteks.kejadian).toHaveLength(2);
    // Ringkasan dihitung dari daftar seed, bukan dari nol: kalau tidak, panel
    // akan menampilkan "0 celah" untuk sesi yang sebenarnya sudah punya celah.
    expect(konteks.ringkasanKejadian).toEqual({ kejadian: 1, celah: 1 });
  });

  it("tanpa kejadianAwal, panel mulai kosong", () => {
    const konteks = ambilKonteks({ buktiAwal: "token.abc", runIdAwal: "run-1" });
    expect(konteks.kejadian).toEqual([]);
    expect(konteks.ringkasanKejadian).toEqual({ kejadian: 0, celah: 0 });
  });
});
