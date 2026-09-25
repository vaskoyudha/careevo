"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { mulaiSesiAction, catatKejadianAction, akhiriSesiAction } from "@/actions/learning";
import {
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
}

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
  children,
}: {
  courseId: string;
  kebijakan: KebijakanCourse;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<SessionKonteks["status"]>("idle");
  const [bukti, setBukti] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kejadian, setKejadian] = useState<KejadianSesi[]>([]);
  /**
   * Cermin `runId` yang bisa dibaca sinkron.
   *
   * Listener kejadian hidup di luar siklus render; membaca state `runId` dari
   * closure akan memakai nilai basi (listener di-mount tanpa runId), sehingga
   * kejadian setelah sesi dimulai hilang. Ref memberi nilai terbaru tanpa
   * memaksa re-subscribe tiap kejadian.
   */
  const runRef = useRef<string | null>(null);

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

  const mulai = useCallback(async () => {
    setStatus("menyiapkan");
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

  const boleh = useCallback(
    (jenis: JenisKegiatan) =>
      putuskanAkses({ jenisKegiatan: jenis, kebijakan, adaBuktiSesi: Boolean(bukti) }),
    [kebijakan, bukti],
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
  const { mulai, status, error } = useCourseSession();
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-900">{pesan}</p>
      <p className="mt-2 text-xs text-amber-800">
        Sesi ini mencatat kejadian integritas (pindah tab dan fokus yang hilang) selama berjalan.
        Permintaan akses kamera belum aktif; setelah tersedia, sesi terverifikasi juga memerlukan
        persetujuan kameramu. Tanpa sesi, lampiran kegiatan ini tidak dihitung sebagai bukti
        kompetensi terverifikasi.
      </p>
      <button
        type="button"
        onClick={() => void mulai()}
        disabled={status === "menyiapkan"}
        className="mt-3 cursor-pointer rounded-full bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {status === "menyiapkan" ? "Menyiapkan sesi…" : "Mulai sesi terverifikasi"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

/**
 * Indikator sesi aktif.
 *
 * Copy sengaja hanya menyebut apa yang benar-benar berjalan hari ini —
 * pencatatan kejadian. Jangan menulis "kamera aktif" sebelum kamera benar-benar
 * diminta (itu di Task 8): indikator yang mengklaim lebih dari yang dilakukan
 * kode adalah bohong, dan peserta berhak tahu persis apa yang dipantau.
 */
export function CourseSessionIndicator() {
  const { status, akhiri, kebijakan } = useCourseSession();
  if (status !== "aktif") return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
        <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
        Sesi terverifikasi aktif
      </span>
      <span className="text-xs text-emerald-700">
        Pencatatan kejadian aktif (pindah tab dan fokus yang hilang). Aturan bantuan:{" "}
        {LABEL_ATURAN_BANTUAN[kebijakan.aturan_bantuan]}.
      </span>
      <a href="/pengaturan" className="text-xs font-medium text-emerald-900 underline">
        Cara kerja pencatatan
      </a>
      <button
        type="button"
        onClick={() => void akhiri()}
        className="ml-auto cursor-pointer text-xs font-semibold text-emerald-900 underline"
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
 * di course `wajib` selalu ditolak server tanpa bukti. Hasilnya: tombol "Tandai
 * selesai" tampil lima kali dan tidak ada satu pun cara memenuhinya.
 *
 * Sesinya berlaku untuk seluruh course (`mulaiSesiAction(courseId)`), bukan per
 * modul, jadi ajakan ini memang letaknya di tingkat course — supaya selalu
 * terjangkau, bukan hanya ketika satu modul kebetulan punya lampiran.
 *
 * Copy hanya menyebut pencatatan kejadian: kamera memang belum diminta di sini.
 * Menulis "kamera aktif" sebelum `getUserMedia` benar-benar dipanggil adalah
 * indikator yang berbohong tentang apa yang dipantau.
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
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">
        Course ini mewajibkan sesi terverifikasi untuk menyelesaikan materi.
      </p>
      <p className="mt-1.5 text-xs text-amber-800">
        Sesi ini mencatat kejadian integritas (pindah tab dan fokus yang hilang) selama berjalan.
        Permintaan akses kamera belum aktif; setelah tersedia, sesi terverifikasi juga memerlukan
        persetujuan kameramu.
      </p>
      <button
        type="button"
        onClick={() => void mulai()}
        disabled={status === "menyiapkan"}
        className="mt-3 cursor-pointer rounded-full bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {status === "menyiapkan" ? "Menyiapkan sesi…" : "Mulai sesi terverifikasi"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
