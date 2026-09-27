"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { RiLoader4Line, RiShieldCrossLine } from "@remixicon/react";
import { mulaiSesiAction, catatKejadianAction, akhiriSesiAction } from "@/actions/learning";
import {
  butuhKamera,
  klasifikasiKejadian,
  putuskanAkses,
  wajibSesiTerverifikasi,
  type JenisKegiatan,
  type KJenisKejadian,
  type KeputusanAkses,
} from "@/lib/learning/akses";
// `kebijakan.ts` murni dan aman untuk bundel klien (hanya `import type`), jadi
// label bisa dirender apa adanya alih-alih menampilkan slug enum ke peserta.
import { LABEL_ATURAN_BANTUAN } from "@/lib/courses/kebijakan";
import {
  sejakDetikTerakhirMengetik,
  sinyalPaste,
  sinyalPintasan,
  sinyalSalin,
} from "@/lib/learning/pengawasan-klien";
import type { SinyalBrowser } from "@/lib/learning/pengawasan-klien";
import type { KebijakanCourse } from "@/types/course";

/**
 * Satu kejadian integritas seperti yang dikirim server.
 *
 * Didefinisikan lokal, bukan diimpor dari `lib/learning/session`, karena modul
 * itu **server-only** (`node:fs/promises`): `import type` memang hilang saat
 * kompilasi, tapi menaruh bentuk data klien di modul server mengundang impor
 * nilai berikutnya, dan satu impor nilai saja langsung menjatuhkan bundel klien.
 * Bentuknya sengaja minimal — hanya field yang benar-benar dihitung panel.
 */
export interface KejadianSesi {
  at: string;
  jenis: KJenisKejadian;
  jenis_klasifikasi: "kejadian" | "celah";
  visibilitas: "visible" | "hidden" | null;
  detail?: string;
}

/**
 * Konteks sesi terverifikasi sisi klien.
 *
 * Provider ini **bukan** penjaga otoritatif: ia hanya menyimpan bukti sesi untuk
 * dipakai gerbang UI dan mengirim kejadian. Pemeriksaan yang menentukan tetap
 * dilakukan di server action — kalau state klien dimanipulasi, server yang
 * menolak. Karena itu `putuskanAkses` diimpor sebagai fungsi murni dari
 * `lib/learning/akses` dan bukan disalin ulang di sini: satu mesin keputusan
 * untuk klien dan server.
 *
 * Sengaja tidak menyentuh `lib/learning/session` (server-only, `node:fs`):
 * modul itu hanya boleh dibaca dari action.
 */

export interface SessionKonteks {
  courseId: string;
  kebijakan: KebijakanCourse;
  bukti: string | null;
  runId: string | null;
  status: "idle" | "menyiapkan" | "aktif" | "diakhiri" | "gagal";
  error: string | null;
  /**
   * Kejadian integritas run yang sedang berjalan.
   *
   * Provider ini satu-satunya tempat yang melihat balasan server
   * (`catatKejadianAction` mengembalikan `run` lengkap), jadi daftar kejadian
   * disimpan di sini supaya panel bisa menghitung tanpa endpoint baca terpisah.
   * Klien tidak pernah membaca dari disk; ia hanya menampilkan apa yang barusan
   * dikonfirmasi server.
   */
  kejadian: KejadianSesi[];
  /** Ringkasan turunan: jumlah `kejadian` vs `celah` pada run aktif. */
  ringkasanKejadian: { kejadian: number; celah: number };
  mulai: () => Promise<boolean>;
  akhiri: () => Promise<void>;
  boleh: (jenis: JenisKegiatan) => KeputusanAkses;
  /**
   * Catat satu kejadian integritas **atas permintaan peserta** (mis. laporan
   * gangguan) dan sinkronkan daftar kejadian begitu server menjawab.
   *
   * Berbeda dari pencatatan latar belakang, pemanggil butuh tahu apakah
   * server menerimanya, jadi fungsi ini mengembalikan `SesiActionState`.
   */
  laporKejadian: (
    jenis: KJenisKejadian,
    visibilitas: "visible" | "hidden" | null,
    detail?: string,
  ) => Promise<boolean>;
  /** True ketika kamera menyala di sesi ini (course `wajib_kamera`). */
  kameraAktif: boolean;
  /** Setter dari dialog izin; provider meneruskannya ke mesin akses. */
  setKameraAktif: (aktif: boolean) => void;
  /**
   * Laporkan satu kejadian kamera ke server.
   *
   * Satu-satunya jalur penulisan kejadian kamera. `KameraIzin` tidak menyentuh
   * server action langsung — ia memanggil ini — supaya `runId` tetap hanya
   * hidup di provider dan tidak ada jalur kedua yang bisa menulis kejadian
   * kamera tanpa run.
   */
  laporKamera: (jenis: JenisKejadianKamera, detail?: string) => void;
}

/** Kejadian yang hanya bisa lahir dari kamera (asal: `kamera`). */
export type JenisKejadianKamera =
  | "kamera_mulai"
  | "kamera_berhenti"
  | "kamera_gagal"
  | "wajah_tidak_terdeteksi"
  | "wajah_kedua";

/** Jumlah kejadian per klasifikasi; dipakai panel untuk menampilkan hitungan. */
function ringkas(daftar: KejadianSesi[]): { kejadian: number; celah: number } {
  let kejadian = 0;
  let celah = 0;
  for (const k of daftar) {
    if (k.jenis_klasifikasi === "celah") celah += 1;
    else kejadian += 1;
  }
  return { kejadian, celah };
}

/**
 * Ringkas satu sinyal browser menjadi detail yang muat di `detail`.
 *
 * Service memotong `detail` 300 karakter, jadi angka panjang harus diringkas
 * di sini — bukan berharap server menampungnya. Nilai diagnostik yang disimpan:
 * panjang paste dan jeda mengetik, yang dua-duanya dipakai untuk melihat pola.
 */
export function ringkasSinyal(sinyal: SinyalBrowser): string {
  switch (sinyal.jenis) {
    case "keluar_fullscreen":
      return "Keluar layar penuh";
    case "paste_massal":
      return `${sinyal.panjang} karakter, jeda ${sinyal.sejak_mengetik_detik}s`;
    case "pintasan_terlarang":
      return `Pintasan ${sinyal.kombinasi}`;
    case "salin_terlarang":
      return `${sinyal.panjang} karakter`;
  }
}

/**
 * Ubah `run` dari balasan server menjadi daftar kejadian minim.
 *
 * Server sudah menentukan `jenis_klasifikasi` lewat `klasifikasiKejadian`, tapi
 * nilainya dihitung ulang di sini sebagai jaring pengaman: bila bentuk balasan
 * berubah atau field hilang, klasifikasi tetap konsisten dengan jenisnya alih-alih
 * membuat panel menghitung nol celah secara diam-diam.
 */
function kejadianDariRun(run: {
  kejadian: ReadonlyArray<{
    at: string;
    jenis: KJenisKejadian;
    jenis_klasifikasi?: "kejadian" | "celah";
    visibilitas: "visible" | "hidden" | null;
    detail?: string;
  }>;
}): KejadianSesi[] {
  return run.kejadian.map((k) => ({
    at: k.at,
    jenis: k.jenis,
    visibilitas: k.visibilitas,
    jenis_klasifikasi: k.jenis_klasifikasi ?? klasifikasiKejadian(k.jenis, k.visibilitas),
    ...(k.detail ? { detail: k.detail } : {}),
  }));
}

export const SessionContext = createContext<SessionKonteks | null>(null);

export function useCourseSession(): SessionKonteks {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useCourseSession dipakai di luar CourseSessionProvider");
  return ctx;
}

export function CourseSessionProvider({
  courseId,
  kebijakan,
  buktiAwal = null,
  runIdAwal = null,
  kejadianAwal,
  children,
}: {
  courseId: string;
  kebijakan: KebijakanCourse;
  /**
   * Bukti sesi yang sudah sah, dihitung **server** (`reader-sesi.ts`).
   *
   * Dipakai reader: peserta yang memuat ulang halaman atau membuka deep link ke
   * satu modul tidak kehilangan sesi terverifikasi yang masih berjalan. Provider
   * tidak menghitungnya sendiri karena ia klien, dan service sesi server-only.
   *
   * `null` berarti "tidak ada sesi" — sama seperti perilaku lama.
   */
  buktiAwal?: string | null;
  /** Id run aktif pasangan `buktiAwal`; hanya dipakai untuk indikator. */
  runIdAwal?: string | null;
  /** Kejadian yang sudah tercatat di run itu, supaya panel tidak mulai kosong. */
  kejadianAwal?: KejadianSesi[];
  children: React.ReactNode;
}) {
  /**
   * Status awal mengikuti ada/tidaknya bukti seed.
   *
   * Bukti kosong (`""`) diperlakukan sebagai tidak ada: `putuskanAkses` memakai
   * `Boolean(bukti)`, dan status `aktif` untuk token kosong akan menampilkan
   * indikator sesi yang tidak bisa dipertanggungjawabkan server.
   */
  const adaBuktiAwal = Boolean(buktiAwal);
  const [status, setStatus] = useState<SessionKonteks["status"]>(
    adaBuktiAwal ? "aktif" : "idle",
  );
  const [bukti, setBukti] = useState<string | null>(buktiAwal ?? null);
  const [runId, setRunId] = useState<string | null>(runIdAwal ?? null);
  const [error, setError] = useState<string | null>(null);
  const [kejadian, setKejadian] = useState<KejadianSesi[]>(kejadianAwal ?? []);
  /**
   * Status kamera untuk mesin akses.
   *
   * Klien, dan itu memang bukan penjaga otoritatif: server tetap memutuskan
   * lewat `kamera_mulai` di `learning_events` (`kameraMenyalaPadaRun`). Yang
   * dihitung di sini hanya supaya gerbang UI (`boleh`) tidak menutup pane yang
   * server sudah izinkan — dan sebaliknya.
   */
  const [kameraAktif, setKameraAktif] = useState(false);
  /**
   * Cermin `runId` yang bisa dibaca sinkron.
   *
   * Listener kejadian hidup di luar siklus render; membaca state `runId` dari
   * closure akan memakai nilai basi (listener di-mount tanpa runId), sehingga
   * kejadian setelah sesi dimulai hilang. Ref memberi nilai terbaru tanpa
   * memaksa re-subscribe tiap kejadian.
   *
   * Diinisialisasi dari `runIdAwal`: listener kejadian membaca ref ini, bukan
   * state, jadi kalau dibiarkan `null` pada render pertama, sesi hasil seed akan
   * **berjalan tanpa mencatat kejadian** sampai peserta memulai sesi baru —
   * celah integritas, bukan sekadar bug UI.
   */
  const runRef = useRef<string | null>(runIdAwal ?? null);
  /**
   * Waktu ketikan terakhir di halaman ini.
   *
   * Dipakai untuk menghitung jeda saat paste. Tanpa ini, "menempel 400 karakter"
   * dan "mengetik 400 karakter lalu menyisipkan beberapa kata" terlihat sama —
   * padahal hanya yang pertama yang biasanya bukan pekerjaan peserta.
   */
  const ketikRef = useRef<number | null>(null);

  const kirimKejadian = useCallback(
    (
      jenis: Parameters<typeof catatKejadianAction>[0]["jenis"],
      visibilitas: "visible" | "hidden" | null,
    ) => {
      const id = runRef.current;
      if (!id) return;
      // Fire-and-forget: kejadian tidak boleh memblokir UI peserta. Daftar
      // kejadian tetap disinkronkan: satu-satunya tempat peserta bisa melihat
      // apa yang sudah tercatat, dan itu harus mencerminkan server, bukan
      // tebakan klien.
      void catatKejadianAction({ runId: id, jenis, visibilitas })
        .then((hasil) => {
          if (hasil.ok && hasil.run) setKejadian(kejadianDariRun(hasil.run));
        })
        .catch(() => undefined);
    },
    [],
  );

  /**
   * Laporkan satu kejadian kamera ke server (`asal: "kamera"`).
   *
   * Terpisah dari `kirimSinyal` bukan karena bentuknya berbeda, melainkan
   * karena `asal`-nya berbeda: kejadian ini turun dari model di perangkat,
   * bukan dari listener peramban, dan laporan wajib membedakan keduanya (P3).
   * Fire-and-forget seperti yang lain — pencatatan tidak boleh memblokir
   * penghitungan frame.
   */
  const laporKamera = useCallback(
    (jenis: JenisKejadianKamera, detail?: string) => {
      const id = runRef.current;
      if (!id) return;
      void catatKejadianAction({
        runId: id,
        jenis,
        visibilitas: "visible",
        asal: "kamera",
        ...(detail ? { detail } : {}),
      })
        .then((hasil) => {
          if (hasil.ok && hasil.run) setKejadian(kejadianDariRun(hasil.run));
        })
        .catch(() => undefined);
    },
    [],
  );

  /**
   * Kirim satu sinyal browser ke server.
   *
   * Fire-and-forget seperti `kirimKejadian` — pencatatan tidak boleh memblokir
   * UI. `asal` selalu `"browser"` karena semua sinyal di sini datang dari
   * listener peramban, dan `detail` diringkas supaya tidak melewati batas 300
   * karakter di service.
   */
  const kirimSinyal = useCallback(
    (sinyal: SinyalBrowser) => {
      const id = runRef.current;
      if (!id) return;
      void catatKejadianAction({
        runId: id,
        jenis: sinyal.jenis,
        visibilitas: "visible",
        asal: "browser",
        detail: ringkasSinyal(sinyal),
      })
        .then((hasil) => {
          if (hasil.ok && hasil.run) setKejadian(kejadianDariRun(hasil.run));
        })
        .catch(() => undefined);
    },
    [],
  );

  const mulai = useCallback(async () => {    setStatus("menyiapkan");
    setError(null);
    const hasil = await mulaiSesiAction(courseId);
    if (!hasil.ok || !hasil.bukti || !hasil.runId) {
      setStatus("gagal");
      setError(hasil.error ?? "Sesi gagal dimulai.");
      return false;
    }
    runRef.current = hasil.runId;
    setRunId(hasil.runId);
    setBukti(hasil.bukti);
    // Sesi baru selalu dimulai dengan kejadian `sesi_dimulai` di server; ambil
    // dari balasan supaya panel tidak mulai dari daftar kosong (dan tidak
    // menghitung nol celah padahal server punya catatan lain).
    setKejadian(hasil.run ? kejadianDariRun(hasil.run) : []);
    setStatus("aktif");
    return true;
  }, [courseId]);

  const akhiri = useCallback(async () => {
    const id = runRef.current;
    if (!id) return;
    await akhiriSesiAction(id, "peserta_akhiri").catch(() => undefined);
    runRef.current = null;
    setRunId(null);
    setBukti(null);
    setKejadian([]);
    setStatus("diakhiri");
  }, []);

  /**
   * Pelaporan sadar-peserta: menunggu balasan server.
   *
   * Kalau run sudah berakhir, server menolak dan UI harus tahu — melaporkan
   * "terkirim" padahal tidak akan membuat peserta kehilangan kejadian yang ia
   * kira sudah tercatat.
   */
  const laporKejadian = useCallback(
    async (
      jenis: KJenisKejadian,
      visibilitas: "visible" | "hidden" | null,
      detail?: string,
    ): Promise<boolean> => {
      const id = runRef.current;
      if (!id) return false;
      try {
        const hasil = await catatKejadianAction({ runId: id, jenis, visibilitas, detail });
        if (!hasil.ok || !hasil.run) return false;
        setKejadian(kejadianDariRun(hasil.run));
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    if (status !== "aktif") return;
    // Hanya kejadian saat sesi benar-benar berjalan yang dicatat. `blur` juga
    // terjadi saat jendela hanya kehilangan fokus (mis. membuka dialog OS) dan
    // itu bukan pindah tab — karena itu jenisnya dibedakan dan visibilitas
    // dilaporkan apa adanya, bukan disimpulkan "hidden".
    const padaVisibilitas = () => {
      if (document.hidden) kirimKejadian("pindah_tab", "hidden");
    };
    const padaFokusHilang = () =>
      kirimKejadian("fokus_hilang", document.hidden ? "hidden" : "visible");
    document.addEventListener("visibilitychange", padaVisibilitas);
    window.addEventListener("blur", padaFokusHilang);
    return () => {
      document.removeEventListener("visibilitychange", padaVisibilitas);
      window.removeEventListener("blur", padaFokusHilang);
    };
  }, [status, kirimKejadian]);

  useEffect(() => {
    if (status !== "aktif") return;

    // Tandai ketikan terakhir **hanya** untuk tombol karakter (bukan modifier).
    // `keydown` ctrl+v datang sebagai dua kejadian — `Control` lalu `v` — dan
    // menandai keduanya sebagai "ketikan" akan membuat paste yang mengikuti
    // pintasan itu dilaporkan berjeda 0 detik, padahal bukan itu yang terjadi.
    const padaKetik = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;
      ketikRef.current = Date.now();
    };
    // Keluar dari layar penuh = peserta melihat sesuatu yang bukan halaman ini.
    const padaFullscreen = () => {
      if (!document.fullscreenElement) {
        kirimSinyal({ jenis: "keluar_fullscreen", jumlah_keluar: 1 });
      }
    };
    const padaPaste = (e: ClipboardEvent) => {
      const teks = e.clipboardData?.getData("text") ?? "";
      const sinyal = sinyalPaste(
        teks.length,
        sejakDetikTerakhirMengetik(ketikRef.current, Date.now()),
      );
      if (sinyal) kirimSinyal(sinyal);
    };
    const padaSalin = (e: ClipboardEvent) => {
      const teks = e.clipboardData?.getData("text") ?? "";
      const sinyal = sinyalSalin(teks.length);
      if (sinyal) kirimSinyal(sinyal);
    };
    const padaPintasan = (e: KeyboardEvent) => {
      const sinyal = sinyalPintasan({
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
        key: e.key,
      });
      if (sinyal) kirimSinyal(sinyal);
    };

    document.addEventListener("keydown", padaKetik);
    document.addEventListener("fullscreenchange", padaFullscreen);
    document.addEventListener("paste", padaPaste);
    document.addEventListener("copy", padaSalin);
    document.addEventListener("cut", padaSalin);
    document.addEventListener("keydown", padaPintasan);
    return () => {
      document.removeEventListener("keydown", padaKetik);
      document.removeEventListener("fullscreenchange", padaFullscreen);
      document.removeEventListener("paste", padaPaste);
      document.removeEventListener("copy", padaSalin);
      document.removeEventListener("cut", padaSalin);
      document.removeEventListener("keydown", padaPintasan);
    };
  }, [status, kirimSinyal]);

  const boleh = useCallback(
    (jenis: JenisKegiatan) =>
      putuskanAkses({
        jenisKegiatan: jenis,
        kebijakan,
        adaBuktiSesi: Boolean(bukti),
        adaBuktiKamera: kameraAktif,
      }),
    [kebijakan, bukti, kameraAktif],
  );

  return (
    <SessionContext.Provider
      value={{
        courseId,
        kebijakan,
        bukti,
        runId,
        status,
        error,
        kejadian,
        ringkasanKejadian: ringkas(kejadian),
        kameraAktif,
        setKameraAktif,
        laporKamera,
        mulai,
        akhiri,
        boleh,
        laporKejadian,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Gerbang pengerjaan: menampilkan tombol sesi alih-alih isi kegiatan.
 *
 * Dipakai untuk kegiatan yang keputusannya `perlu_sesi`/`ditolak`. Pesan
 * berasal dari `putuskanAkses` (dipakai apa adanya) supaya copy tidak
 * menyimpang dari mesin akses.
 */
export function CourseSessionGate({ pesan }: { pesan: string }) {
  const { mulai, status, error, kebijakan } = useCourseSession();
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-px grid size-7 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"
        >
          <RiShieldCrossLine className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-amber-900">Sesi terverifikasi diperlukan</p>
          {/* Pesan gerbang apa adanya dari `putuskanAkses` — versi yang
              diparafrase di klien akan berbeda ucapan dari penolakan server
              untuk keadaan yang sama. */}
          <p className="mt-1 text-[12.5px] leading-relaxed text-amber-900">{pesan}</p>
        </div>
      </div>
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-amber-800">
        Sesi mencatat pindah tab dan fokus yang hilang selama berjalan.{" "}
        {butuhKamera(kebijakan)
          ? "Course ini menuntut kamera menyala; kamera baru diakses setelah kamu menyetujuinya, dan videonya tidak pernah meninggalkan perangkatmu."
          : "Kamera tidak diminta di course ini."}{" "}
        Tanpa sesi, lampiran ini tidak dihitung sebagai bukti kompetensi terverifikasi.
      </p>
      <button
        type="button"
        onClick={() => void mulai()}
        disabled={status === "menyiapkan"}
        className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#0056D2] px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#00419e] active:scale-[0.97] disabled:opacity-60"
      >
        {status === "menyiapkan" ? (
          <RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />
        ) : null}
        {status === "menyiapkan" ? "Menyiapkan sesi…" : "Mulai sesi terverifikasi"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Indikator sesi aktif.
 *
 * Copy-nya menyebut apa yang benar-benar berjalan: pencatatan kejadian, dan —
 * hanya pada course `wajib_kamera` — kamera yang diminta lewat dialog izin
 * terpisah. Pada course `wajib` biasa, kamera **tidak** diminta, dan copy di
 * sini mengatakannya lewat `butuhKamera`, bukan lewat teks tetap: teks tetap
 * akan berbohong pada salah satu dari dua kebijakan itu.
 *
 * Catatan rumahnya: di **reader** komponen ini tidak dipakai lagi —
 * `KejadianPanel` sudah menggabungkan status, aturan bantuan, tombol akhiri, dan
 * catatan yang bisa dibuka menjadi satu strip, dan menaruh keduanya berarti satu
 * layar mengatakan keadaan yang sama dua kali. Ia tetap dipakai di **silabus**,
 * yang tidak punya panel kejadian. Jangan menambahkannya kembali ke
 * `materi-focus-bar.tsx`.
 */
export function CourseSessionIndicator() {
  const { status, akhiri, kebijakan } = useCourseSession();
  if (status !== "aktif") return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
      <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-emerald-800">
        <span aria-hidden="true" className="status-pulse size-2 rounded-full bg-emerald-500" />
        Sesi terverifikasi aktif
      </span>
      <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-emerald-700">
        Pencatatan kejadian aktif (pindah tab dan fokus yang hilang).{" "}
        {butuhKamera(kebijakan) ? "Kamera: sesuai dialog izinmu. " : "Kamera tidak diminta. "}
        Aturan bantuan: {LABEL_ATURAN_BANTUAN[kebijakan.aturan_bantuan]}.
      </span>
      <a
        href="/pengaturan"
        className="shrink-0 text-[11.5px] font-medium text-emerald-900 underline underline-offset-2"
      >
        Cara kerja pencatatan
      </a>
      <button
        type="button"
        onClick={() => void akhiri()}
        className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-[11.5px] font-semibold text-emerald-900 transition-colors hover:bg-emerald-100 active:scale-[0.97]"
      >
        Akhiri sesi
      </button>
    </div>
  );
}

/**
 * Ajakan memulai sesi — pasangan `CourseSessionIndicator`.
 *
 * Tanpa komponen ini ada jalan buntu. Indikator hanya muncul **setelah** sesi
 * berjalan, dan `CourseSessionGate` (satu-satunya tombol "Mulai sesi" yang lain)
 * hanya dirender di dalam panel modul yang punya lampiran. Modul turunan selalu
 * kosong (`punyaIsi` false di `detail-kursus.tsx`), jadi di seluruh kursus stok
 * tidak ada satu pun tombol untuk memulai sesi — sementara penyelesaian `materi`
 * di course `wajib` selalu ditolak server tanpa bukti. Hasilnya: tidak ada satu
 * pun cara memenuhi syarat penyelesaian modul.
 *
 * Sesinya berlaku untuk seluruh course (`mulaiSesiAction(courseId)`), bukan per
 * modul, jadi ajakan ini memang letaknya di tingkat course — supaya selalu
 * terjangkau, bukan hanya ketika satu modul kebetulan punya lampiran.
 *
 * Copy menyebut pencatatan kejadian, dan kamera hanya lewat `butuhKamera`.
 * Menulis "kamera aktif" pada course yang tidak menuntutnya adalah indikator
 * yang berbohong tentang apa yang dipantau — seperti juga menulis "kamera belum
 * diminta" setelah `getUserMedia` benar-benar ada.
 *
 * Bentuknya **strip mendatar**, bukan kartu bertumpuk: di reader ia tinggal di
 * dalam bar fokus yang lengket, dan kartu amber setinggi empat baris di sana
 * mendorong judul modul keluar dari layar. Kalimat penjelasannya tetap lengkap
 * dan terbaca — hanya susunannya yang mendatar.
 */
export function CourseSessionPrompt() {
  const { status, error, kebijakan, mulai } = useCourseSession();
  // Course `opsional` tidak butuh sesi, jadi tidak ada yang perlu diajak.
  if (!wajibSesiTerverifikasi(kebijakan)) return null;
  // `menyiapkan`/`gagal`/`diakhiri` tetap dirender: tombol perlu menampilkan
  // "Menyiapkan sesi…" dan pesan galat, serta setelah sesi diakhiri peserta
  // harus bisa memulai lagi. Hanya sesi yang sedang berjalan yang diwakili
  // indikator — keduanya tidak pernah tampil bersamaan.
  if (status === "aktif") return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"
        >
          <RiShieldCrossLine className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-amber-900">
          <strong className="font-semibold text-amber-900">
            Course ini mewajibkan sesi terverifikasi
          </strong>{" "}
          untuk menyelesaikan materi. Sesi mencatat pindah tab dan fokus yang hilang.{" "}
          {butuhKamera(kebijakan)
            ? "Kamera juga diwajibkan — ia baru diakses setelah kamu menyetujuinya, dan videonya tidak pernah meninggalkan perangkatmu."
            : "Kamera tidak diminta di course ini."}
        </p>
        <button
          type="button"
          onClick={() => void mulai()}
          disabled={status === "menyiapkan"}
          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#0056D2] px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#00419e] active:scale-[0.97] disabled:opacity-60"
        >
          {status === "menyiapkan" ? (
            <RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          {status === "menyiapkan" ? "Menyiapkan sesi…" : "Mulai sesi terverifikasi"}
        </button>
      </div>
      {/* Satu baris yang menjawab "untuk apa ini?" — pertanyaan pertama tiap
          peserta. Ia menyebut akibatnya (jalur penyelesaian jadi terverifikasi,
          bukan informal) dan bahwa sesinya bisa diakhiri sendiri. Angkanya tidak
          ditulis: batas waktunya per-course (maksimum `batas_waktu_menit` modul),
          jadi satu angka di sini akan salah untuk sebagian course. */}
      <p className="mt-2 text-[11.5px] leading-relaxed text-amber-800">
        Sesi berlaku untuk seluruh course dan bisa kamu akhiri sendiri. Hanya penyelesaian di dalam
        sesi ini yang dihitung sebagai bukti kompetensi terverifikasi.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
