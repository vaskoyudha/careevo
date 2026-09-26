/**
 * Adapter dashboard staff: baris database → bentuk yang dirender laporan.
 *
 * **Murni.** Modul ini tidak menyentuh database, `node:fs`, maupun
 * `next/headers`; ia menerima baris yang sudah dibaca repository dan
 * mengembalikan bentuk yang dipakai halaman. Alasannya bukan kerapian: aturan
 * seperti "attempt submitted tanpa skor tidak boleh menarik rata-rata ke bawah"
 * adalah keputusan yang harus bisa diuji tanpa PostgreSQL, dan laporan yang
 * salah hitung tidak menimbulkan error — ia hanya menampilkan angka keliru
 * dengan yakin.
 *
 * Yang dikunci di sini:
 *
 * - **Rata-rata hanya dari attempt yang benar-benar punya skor.** Attempt
 *   `in_progress` (dan baris rusak dengan `score: null`) dibuang dari penyebut.
 *   Memasukkannya sebagai nol membuat "belum dinilai" terlihat seperti "dinilai
 *   nol", dan itu dua klaim berbeda.
 * - **`null` bukan `0`.** Tanpa satu pun skor, hasilnya `null` — tabel
 *   menampilkannya sebagai "—", bukan "0/100".
 * - **`terverifikasi` dihitung per baris `module_progress` completed**, bukan
 *   dari completion kursus: satu modul terverifikasi sudah layak dilaporkan
 *   walau kursusnya belum tuntas.
 * - **Status run dipetakan eksplisit** dari `learning_runs.state`. Nilai tak
 *   dikenal menjadi `kedaluwarsa` — gagal-tertutup: run yang statusnya tidak
 *   bisa dibaca tidak boleh tampil sebagai sesi yang baik-baik saja.
 * - **Owner pada laporan adalah email pemilik** (`users.email_normalized`),
 *   karena itulah segmen rute halaman detail staf. Nama tampilan tetap
 *   `users.display_name`.
 *
 * Nama fungsi bisnis berbahasa Indonesia; tipe/helper infrastruktur Inggris.
 */

import type { SessionRun, KejadianIntegritas, StatusRun } from "@/lib/learning/session";
import {
  JENIS_KEJADIAN_SAH,
  klasifikasiKejadian,
  type KJenisKejadian,
} from "@/lib/learning/akses";
import type { LearningEvent, LearningRun, ModuleProgressRow } from "@/lib/db/schema";
import type { BarisPembelajaran } from "@/lib/performa/ringkasan";
import type { EnrollmentStaf } from "@/lib/learning/repository";

/* ------------------------------------------------------------------ *
 * Bentuk masukan
 * ------------------------------------------------------------------ */

/**
 * Bentuk minimal satu attempt yang dibutuhkan dashboard.
 *
 * Sengaja lebih sempit dari `QuizAttempt`: `assessment_snapshot` memuat kunci
 * jawaban, dan adapter ini tidak punya urusan dengannya. `QuizAttempt` tetap
 * bisa diteruskan apa adanya (struktural), jadi halaman tidak perlu memetakan.
 */
export interface AttemptDashboard {
  id: string;
  enrollmentId: string;
  quizId: string | null;
  status: string;
  score: number | null;
  submittedAt: Date | string | null;
}

/* ------------------------------------------------------------------ *
 * Laporan belajar (daftar peserta)
 * ------------------------------------------------------------------ */

/** `Date` → ISO; nilai yang tidak bisa dibaca menjadi string kosong. */
function iso(nilai: Date | string | null | undefined): string {
  if (nilai instanceof Date) return Number.isFinite(nilai.getTime()) ? nilai.toISOString() : "";
  if (typeof nilai === "string") return nilai;
  return "";
}

/**
 * Baris laporan belajar dari enrollment + progres + attempt.
 *
 * Satu baris **per peserta**, bukan per enrollment: peserta dengan dua kursus
 * tetap satu baris, dan angka modulnya adalah jumlah seluruh kursusnya — bentuk
 * yang sama dengan `barisPembelajaran()` versi catatan performa.
 *
 * Peserta yang terdaftar tetapi belum menyelesaikan satu modul tetap muncul
 * dengan `selesai: 0`; justru itulah yang perlu dilihat verifikator.
 */
export function barisPembelajaranDariDb(input: {
  enrollments: EnrollmentStaf[];
  progress: ModuleProgressRow[];
  attempts: AttemptDashboard[];
}): BarisPembelajaran[] {
  // enrollmentId → userId, dan userId → identitas tampilan.
  const pemilik = new Map<string, string>();
  const identitas = new Map<string, { owner: string; nama: string }>();
  for (const baris of input.enrollments) {
    pemilik.set(baris.enrollment.id, baris.user.userId);
    identitas.set(baris.user.userId, {
      owner: baris.user.email,
      nama: baris.user.nama,
    });
  }

  const selesai = new Map<string, number>();
  const terverifikasi = new Map<string, number>();
  for (const baris of input.progress) {
    if (baris.state !== "completed") continue;
    const userId = pemilik.get(baris.enrollmentId);
    if (!userId) continue; // progres tanpa enrollment — baris yatim, dilewati
    selesai.set(userId, (selesai.get(userId) ?? 0) + 1);
    if (baris.completionPath === "terverifikasi") {
      terverifikasi.set(userId, (terverifikasi.get(userId) ?? 0) + 1);
    }
  }

  const nilai = new Map<string, number[]>();
  for (const attempt of input.attempts) {
    if (attempt.status !== "submitted") continue;
    if (typeof attempt.score !== "number" || !Number.isFinite(attempt.score)) continue;
    const userId = pemilik.get(attempt.enrollmentId);
    if (!userId) continue;
    const daftar = nilai.get(userId) ?? [];
    daftar.push(attempt.score);
    nilai.set(userId, daftar);
  }

  return [...identitas.entries()]
    .map(([userId, { owner, nama }]) => {
      const skor = nilai.get(userId) ?? [];
      return {
        owner,
        nama,
        selesai: selesai.get(userId) ?? 0,
        terverifikasi: terverifikasi.get(userId) ?? 0,
        rataRataKuis:
          skor.length === 0
            ? null
            : Math.round(skor.reduce((a, b) => a + b, 0) / skor.length),
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

/* ------------------------------------------------------------------ *
 * Detail belajar (satu peserta)
 * ------------------------------------------------------------------ */

/** Satu baris progres modul, dalam kosakata yang dirender (`sumber`/`at`). */
export interface BarisSelesaiModul {
  modul_id: string;
  /** Jalur tak dikenal turun ke "informal" — klaim tidak dinaikkan. */
  sumber: "terverifikasi" | "informal";
  at: string;
}

/**
 * Satu percobaan kuis pada halaman detail.
 *
 * `sumber` sengaja tetap `"klien"`: sejak Fase 2 penilaian memang dihitung
 * server dari snapshot, tetapi label itu adalah **janji laporan lama** yang
 * tidak boleh dicabut diam-diam oleh adapter. Mengubahnya menjadi klaim
 * terverifikasi adalah keputusan produk.
 */
export interface BarisPercobaanKuis {
  kuis_id: string;
  attempt_id: string;
  nilai: number | null;
  at: string;
  sumber: "klien";
}

export interface BarisKursusPeserta {
  course_id: string;
  judul: string;
  selesai: BarisSelesaiModul[];
  kuis: BarisPercobaanKuis[];
}

export interface DetailPembelajaran {
  owner: string;
  nama: string;
  kursus: BarisKursusPeserta[];
}

/**
 * Detail satu peserta, dikelompokkan per kursus.
 *
 * Judul kursus datang dari `judul` yang disisipkan pemanggil (halaman staf
 * tidak boleh membaca store JSON); tanpa itu `course_id` dipakai apa adanya —
 * menampilkan id lebih baik daripada kursus tanpa nama.
 *
 * `null` bila tidak ada enrollment sama sekali: pemanggil yang memutuskan 404,
 * bukan fungsi ini yang mengarang peserta kosong.
 */
export function detailPembelajaranDariDb(input: {
  enrollments: EnrollmentStaf[];
  progress: ModuleProgressRow[];
  attempts: AttemptDashboard[];
  judul?: ReadonlyMap<string, string>;
}): DetailPembelajaran | null {
  if (input.enrollments.length === 0) return null;

  const perKursus = new Map<string, BarisKursusPeserta>();
  // courseId per enrollment, supaya progres/attempt diletakkan di kursus yang
  // benar walau peserta mengikuti lebih dari satu kursus.
  const courseDariEnrollment = new Map<string, string>();
  for (const baris of input.enrollments) {
    courseDariEnrollment.set(baris.enrollment.id, baris.enrollment.courseId);
    perKursus.set(baris.enrollment.courseId, {
      course_id: baris.enrollment.courseId,
      judul: input.judul?.get(baris.enrollment.courseId) ?? baris.enrollment.courseId,
      selesai: [],
      kuis: [],
    });
  }

  for (const baris of input.progress) {
    if (baris.state !== "completed") continue;
    const courseId = courseDariEnrollment.get(baris.enrollmentId);
    if (!courseId) continue;
    perKursus.get(courseId)?.selesai.push({
      modul_id: baris.moduleId,
      sumber: baris.completionPath === "terverifikasi" ? "terverifikasi" : "informal",
      at: iso(baris.completedAt),
    });
  }

  for (const attempt of input.attempts) {
    const courseId = courseDariEnrollment.get(attempt.enrollmentId);
    if (!courseId) continue;
    perKursus.get(courseId)?.kuis.push({
      kuis_id: attempt.quizId ?? "—",
      attempt_id: attempt.id,
      nilai: typeof attempt.score === "number" && Number.isFinite(attempt.score) ? attempt.score : null,
      at: iso(attempt.submittedAt),
      sumber: "klien",
    });
  }

  const kursus = [...perKursus.values()]
    .map((k) => ({
      ...k,
      selesai: [...k.selesai].sort((a, b) => a.at.localeCompare(b.at)),
      kuis: [...k.kuis].sort((a, b) => a.at.localeCompare(b.at)),
    }))
    .sort((a, b) => a.judul.localeCompare(b.judul, "id"));

  const pertama = input.enrollments[0];
  return { owner: pertama.user.email, nama: pertama.user.nama, kursus };
}

/* ------------------------------------------------------------------ *
 * Laporan integritas
 * ------------------------------------------------------------------ */

/**
 * Satu kejadian `learning_events` → `KejadianIntegritas`, atau `null` bila
 * `kind`-nya tidak ada di `JENIS_KEJADIAN_SAH`.
 *
 * Kejadian tak dikenal **dibuang**, bukan diberi label karangan: komponen lini
 * masa menerjemahkan `jenis` lewat tabel label, dan jenis di luar tabel itu akan
 * tampil sebagai label kosong — entri yang menyatakan sesuatu yang tidak
 * didukung datanya. Server hanya pernah menulis jenis dari daftar itu
 * (`catatKejadianDb` memvalidasinya), jadi cabang ini hanya berlaku untuk baris
 * yang disunting tangan atau berasal dari versi lain.
 *
 * `jenis_klasifikasi` diambil dari payload yang sudah ditetapkan server saat
 * pencatatan; hanya bila tidak ada, aturannya dihitung ulang dari jenis +
 * visibilitas — bukan ditebak menjadi "kejadian".
 */
export function kejadianDariEvent(event: LearningEvent): KejadianIntegritas | null {
  if (!(JENIS_KEJADIAN_SAH as readonly string[]).includes(event.kind)) return null;
  const jenis = event.kind as KJenisKejadian;

  const payload =
    event.payloadRedacted !== null && typeof event.payloadRedacted === "object"
      ? (event.payloadRedacted as Record<string, unknown>)
      : {};
  const visibilitas =
    payload.visibilitas === "visible" || payload.visibilitas === "hidden"
      ? payload.visibilitas
      : null;
  const tersimpan = payload.jenis_klasifikasi;

  return {
    at: iso(event.occurredAt),
    jenis,
    jenis_klasifikasi:
      tersimpan === "kejadian" || tersimpan === "celah"
        ? tersimpan
        : klasifikasiKejadian(jenis, visibilitas),
    visibilitas,
    ...(typeof payload.detail === "string" && payload.detail.length > 0
      ? { detail: payload.detail.slice(0, 300) }
      : {}),
  };
}

/** `learning_runs.state` → kosakata `SessionRun.status` yang dipakai UI. */
export function statusRunDari(run: Pick<LearningRun, "state">): StatusRun {
  if (run.state === "active") return "aktif";
  if (run.state === "completed") return "diakhiri";
  // `expired`, dan nilai tak dikenal: kedaluwarsa adalah kegagalan yang terlihat,
  // sedangkan "aktif" untuk run yang tidak bisa dibaca akan menyembunyikannya.
  return "kedaluwarsa";
}

/**
 * Satu `LearningRun` + kejadiannya → bentuk `SessionRun` yang dirender
 * komponen integritas yang sudah ada.
 *
 * `owner` diisi `run.userId` (uuid): itu id pemilik sesi sejak migrasi ini.
 * Pemetaan ke email hanya dipakai untuk membangun tautan halaman.
 */
export function sessionRunDariDb(run: LearningRun, events: LearningEvent[]): SessionRun {
  const status = statusRunDari(run);
  return {
    id: run.id,
    course_id: run.courseId,
    owner: run.userId,
    policy_version: run.integrityVersion,
    status,
    mulai_at: iso(run.startedAt),
    berlaku_hingga: iso(run.expiresAt) || undefined,
    berakhir_at: status === "aktif" ? null : iso(run.completedAt) || null,
    kejadian: events
      .map(kejadianDariEvent)
      .filter((k): k is KejadianIntegritas => k !== null),
  };
}
