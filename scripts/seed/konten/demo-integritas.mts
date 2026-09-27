/**
 * Demo integritas **empat lapisan** — untuk presentasi, bukan produksi.
 *
 * Careevo merekam bukti integritas di empat lapisan berbeda, dan skrip ini
 * mengisi keempatnya supaya laporan staf benar-benar terlihat utuh:
 *
 * | # | Lapisan | Sumber | Terlihat di |
 * |---|---|---|---|
 * | 1 | Catatan keputusan manusia | `integrity_violations` | `/verify` + laporan |
 * | 2 | Sinyal mentah peramban | `learning_events` | laporan integritas |
 * | 3 | Jejak proses ruang kerja | `.data/workspace-jejak/*.jsonl` | laporan integritas |
 * | 4 | Percakapan tutor → ringkasan AI | `.data/tutor/*.json` | laporan integritas |
 *
 * Sertifikat publik sengaja **hanya** memuat lapisan 1 (dan hanya jumlahnya):
 * lapisan 2–4 adalah bahan baca staf, bukan vonis yang boleh dibaca perekrut.
 *
 * ## Tiga peserta, tiga cerita
 *
 * | Peserta | Yang diperlihatkan |
 * |---|---|
 * | **Nadia** | Kasus berat: 3 catatan manual aktif, skor kejujuran 80, rubrik dengan nilai berbeda |
 * | **Bima** | Aturan pemulihan: 2 catatan `expunged` (course diulang bersih) + 1 tetap aktif |
 * | **Citra** | Alur dua tahap: usulan otomatis → **1 disetujui**, **1 ditolak**, **1 dibiarkan menunggu** |
 *
 * Citra adalah demo terpenting: ia memperlihatkan bahwa mesin **mengusulkan**,
 * dan hanya manusia yang memutuskan.
 *
 * ## Urutan penulisan adalah bagian dari demonya
 *
 * Tiga aturan yang mengikat urutan ini, semuanya dikunci di kode:
 *
 * 1. **`learning_events` hanya bisa ditulis saat run masih `active`.**
 *    `catatKejadianRun` menolak run non-aktif (`repository.ts`), jadi sinyal
 *    mentah harus ditulis sebelum `akhiriRunDb`.
 * 2. **Stage 1 hanya berjalan saat run ditutup** (`akhiriRunDb` → deteksi).
 *    Jadi usulan otomatis baru muncul setelah run ditutup.
 * 3. **Pemulihan hanya untuk catatan yang `created_at`-nya sebelum completion**
 *    (`pulihkanSemuaPelanggaranCourse`). Untuk Bima, dua catatan ditulis
 *    sebelum `selesaikanKursusDb` supaya benar-benar jadi `expunged`.
 *
 * Konsekuensinya: menyelesaikan course **setelah** run ditutup memang sah —
 * sudah diuji — dan itu urutan yang dipakai di sini.
 *
 * ## Pakai
 *
 *   npx tsx scripts/seed/konten/demo-integritas.mts          # buat
 *   npx tsx scripts/seed/konten/demo-integritas.mts --hapus  # bersihkan
 *
 * Menolak berjalan di database non-lokal. Semua langkah lewat service produksi
 * (termasuk tanda tangan HMAC), jadi sertifikatnya asli — bukan baris tulisan
 * tangan. Semua teks catatan ditulis netral dan faktual: baris pelanggaran
 * adalah **tuduhan**, jadi ia harus bisa dipertanggungjawabkan.
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";

import { daftarPengguna, authenticatePengguna, keluarSession } from "@/lib/auth/auth-service";
import { beriRole } from "@/lib/auth/invitation";
import type { SessionPrincipal } from "@/lib/auth/principal";
import { getCourseById, getKuis } from "@/lib/courses/store";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import { butuhKamera, type KJenisKejadian } from "@/lib/learning/akses";
import { asalSinyal } from "@/lib/learning/sumber-sinyal";
import { daftarKursusDb, selesaikanKursusDb } from "@/lib/learning/service";
import {
  kirimAttemptVerified,
  mulaiAttemptVerified,
  selesaikanModulKuisVerified,
} from "@/lib/learning/assessment-service";
import { mulaiRunDb, akhiriRunDb, catatKejadianDb } from "@/lib/learning/run-service";
import { ambilEnrollment } from "@/lib/learning/repository";
import {
  ambilKredensialCourse,
  buatSubmissionDb,
  kirimSubmissionDb,
  mulaiReviewDb,
  putuskanReviewDb,
  tetapkanReviewerDb,
  type RubrikReview,
} from "@/lib/review/service";
import {
  catatPelanggaranDb,
  putuskanUsulanDb,
  tolakUsulanDb,
  antrianUsulanDb,
  skorIntegritasDb,
} from "@/lib/integritas/service";
import { ambilAttestationPublik } from "@/lib/review/repository";
import { verifikasiSignature } from "@/lib/attestation/key";
import { dariKanonik } from "@/lib/attestation/payload";
import { tambahSnapshot } from "@/lib/workspace/jejak-store";
import { getDb, tutupDb } from "@/lib/db/client";

const env = process.env as unknown as Record<string, string | undefined>;
env.NODE_ENV ??= "development";
for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (cocok) env[cocok[1]] ??= cocok[2].replace(/^["']|["']$/g, "");
}

const HAPUS = process.argv.includes("--hapus");
const SANDI = "careevo-demo-2026";
const EMAIL_STAF = "e2e-integritas-staf@careevo.test";
const SANDI_STAF = "careevo-e2e-password";
const baseUrl = process.env.CAREEVO_BASE_URL ?? "http://localhost:3000";

const CRS_WEBDEV = "crs-1";
const CRS_UIUX = "crs-mujw9lia-kyf9";

/** Satu sinyal mentah yang ditulis ke `learning_events` saat run masih aktif. */
interface KejadianDemo {
  jenis: KJenisKejadian;
  visibilitas: "visible" | "hidden" | null;
  detail?: string;
}

/** Satu observasi ruang kerja. `berkas` = path relatif + ukuran byte. */
interface SnapshotDemo {
  at: string;
  berkas: Array<{ path: string; ukuran: number }>;
}

/** Satu catatan yang ditulis staf. */
interface CatatanDemo {
  kind: string;
  reason: string;
}

/**
 * Nasib satu usulan otomatis: disetujui, ditolak, atau dibiarkan menunggu.
 * Ini yang memperlihatkan bahwa mesin mengusulkan, manusia memutuskan.
 */
type PutusanUsulan = "setuju" | "tolak" | "biarkan";

interface KursusDemo {
  courseId: string;
  slug: string;
  /** Course ini yang menerbitkan sertifikat. */
  disertifikasi: boolean;
  events: KejadianDemo[];
  snapshots: SnapshotDemo[];
  /** Ditulis SEBELUM completion → ikut dipulihkan. */
  catatanSebelum: CatatanDemo[];
  /** Ditulis SESUDAH completion → tetap aktif. */
  catatanSesudah: CatatanDemo[];
  /** Per jenis usulan otomatis. */
  putusan: Record<string, PutusanUsulan>;
}

interface Profil {
  email: string;
  username: string;
  nama: string;
  rubrik: RubrikReview;
  kursus: KursusDemo[];
  tutor: Array<{ judul: string; courseId: string; messages: Array<{ role: "user" | "assistant"; content: string }> }>;
}

/**
 * Workspace yang "dikerjakan" — beberapa berkas tumbuh antar observasi, supaya
 * panel jejak proses punya `perubahan` dan jeda yang bisa dibaca, bukan satu
 * berkas yang muncul sekali lalu diam.
 */
function snapshotProgres(mulai: number, langkah: number, menit: number): SnapshotDemo[] {
  const out: SnapshotDemo[] = [];
  for (let i = 0; i <= langkah; i += 1) {
    const at = new Date(mulai + i * menit * 60_000).toISOString();
    out.push({
      at,
      berkas: [
        { path: "package.json", ukuran: 412 },
        { path: "README.md", ukuran: 180 + i * 40 },
        ...(i >= 1 ? [{ path: "src/app/page.tsx", ukuran: 900 + i * 320 }] : []),
        ...(i >= 2 ? [{ path: "src/lib/utils.ts", ukuran: 260 + i * 90 }] : []),
        ...(i >= 3 ? [{ path: "src/app/api/route.ts", ukuran: 640 + i * 150 }] : []),
        ...(i >= 4 ? [{ path: "src/components/card.tsx", ukuran: 380 + i * 60 }] : []),
      ],
    });
  }
  return out;
}

/** Sinyal browser yang ramai tapi sengaja di BAWAH ambang deteksi. */
function sinyalDiBawahAmbang(): KejadianDemo[] {
  // Ambang Stage 1: ≥3 `pindah_tab`/`fokus_hilang`, dan ≥2 `paste_massal`
  // (atau 1 dengan ≥200 karakter). Di bawah itu tidak ada usulan otomatis —
  // jadi catatan peserta ini murni keputusan manusia.
  return [
    { jenis: "sesi_dimulai", visibilitas: null },
    { jenis: "kamera_mulai", visibilitas: null },
    { jenis: "pindah_tab", visibilitas: "hidden" },
    { jenis: "fokus_hilang", visibilitas: null },
    { jenis: "keluar_fullscreen", visibilitas: null },
    { jenis: "pintasan_terlarang", visibilitas: null, detail: "Ctrl+Shift+I" },
    { jenis: "paste_massal", visibilitas: null, detail: "140 karakter" },
    { jenis: "kamera_berhenti", visibilitas: null },
  ];
}

/** Sinyal yang melewati ambang → Stage 1 mengusulkan dua jenis. */
function sinyalLewatAmbang(): KejadianDemo[] {
  return [
    { jenis: "sesi_dimulai", visibilitas: null },
    { jenis: "pindah_tab", visibilitas: "hidden" },
    { jenis: "pindah_tab", visibilitas: "hidden" },
    { jenis: "pindah_tab", visibilitas: "hidden" },
    { jenis: "fokus_hilang", visibilitas: null },
    { jenis: "paste_massal", visibilitas: null, detail: "260 karakter" },
    { jenis: "salin_terlarang", visibilitas: null },
    { jenis: "paste_massal", visibilitas: null, detail: "215 karakter" },
  ];
}

const PROFIL: Profil[] = [
  {
    email: "demo-integrity-nadia@careevo.test",
    username: "nadiahputri",
    nama: "Nadia Pertiwi",
    rubrik: { kualitas: 3, kelengkapan: 4, ketepatan_brief: 3, orisinalitas: 2, dokumentasi: 3 },
    tutor: [
      {
        judul: "Cara kerja useEffect dan dependency array",
        courseId: CRS_WEBDEV,
        messages: [
          { role: "user", content: "Aku bingung kenapa useEffect-ku jalan terus padahal isinya cuma fetch. Apa yang salah?" },
          {
            role: "assistant",
            content:
              "Biasanya karena dependency array-nya tidak ada atau isinya berubah tiap render. Objek dan fungsi yang dibuat di dalam komponen selalu punya identitas baru, jadi React menganggapnya berubah.",
          },
          { role: "user", content: "Jadi kalau aku taruh fungsinya di luar komponen, itu beres?" },
          {
            role: "assistant",
            content:
              "Bisa, tapi cara yang lebih umum adalah memindahkan fungsi ke dalam useEffect atau membungkusnya dengan useCallback. Yang penting identitasnya stabil antar render.",
          },
          { role: "user", content: "Terus cara tahu kalau-nya kejadian infinite loop?" },
        ],
      },
      {
        judul: "Bedanya server component dan client component",
        courseId: CRS_WEBDEV,
        messages: [
          { role: "user", content: "Kapan aku harus pakai 'use client'?" },
          {
            role: "assistant",
            content:
              "Ketika komponen butuh interaktivitas: state, event handler, atau API peramban. Kalau cuma menampilkan data yang sudah diambil server, biarkan sebagai server component supaya bundelnya kecil.",
          },
          { role: "user", content: "Kalau komponennya butuh keduanya gimana?" },
        ],
      },
    ],
    kursus: [
      {
        courseId: CRS_WEBDEV,
        slug: "fullstack-web-development-nextjs-15-react-19",
        disertifikasi: true,
        events: sinyalDiBawahAmbang(),
        snapshots: snapshotProgres(Date.parse("2026-10-04T08:00:00Z"), 5, 7),
        catatanSebelum: [],
        catatanSesudah: [
          {
            kind: "meninggalkan_sesi",
            reason:
              "Peserta meninggalkan halaman asesmen saat sesi terverifikasi berjalan; tercatat pada modul 2.",
          },
          {
            kind: "pola_salin_tempel",
            reason:
              "Ditemukan penempelan teks sepanjang 1.240 karakter pada jawaban asesmen modul 2, jauh di atas panjang jawaban yang diketik.",
          },
          {
            kind: "plagiarisme",
            reason:
              "Sebagian besar isi karya akhir identik dengan contoh publik yang tidak disebutkan sebagai sumber.",
          },
        ],
        putusan: {},
      },
    ],
  },
  {
    email: "demo-integrity-bima@careevo.test",
    username: "bimasantoso",
    nama: "Bima Santoso",
    rubrik: { kualitas: 4, kelengkapan: 4, ketepatan_brief: 4, orisinalitas: 3, dokumentasi: 4 },
    tutor: [
      {
        judul: "Normalisasi database sampai 3NF",
        courseId: CRS_WEBDEV,
        messages: [
          { role: "user", content: "Tabel pesanan-ku nyimpen nama pelanggan. Itu salah ya?" },
          {
            role: "assistant",
            content:
              "Itu redundansi: satu pelanggan dengan lima pesanan berarti namanya tersimpan lima kali. Kalau namanya berubah, kamu harus memperbarui lima baris — dan satu yang terlewat membuat datanya tidak konsisten.",
          },
          { role: "user", content: "Jadi aku bikin tabel pelanggan terpisah dan simpan id-nya?" },
          {
            role: "assistant",
            content:
              "Tepat. Itu bentuk normal kedua. Untuk sampai 3NF, pastikan tidak ada kolom non-kunci yang bergantung pada kolom non-kunci lain.",
          },
          { role: "user", content: "Contoh yang melanggar 3NF apa?" },
          { role: "user", content: "Sudah aku perbaiki, sekarang jadi tiga tabel. Terima kasih." },
        ],
      },
    ],
    kursus: [
      {
        courseId: CRS_WEBDEV,
        slug: "fullstack-web-development-nextjs-15-react-19",
        disertifikasi: true,
        events: sinyalDiBawahAmbang(),
        snapshots: snapshotProgres(Date.parse("2026-10-04T08:20:00Z"), 6, 6),
        // Ditulis sebelum completion → dipulihkan saat course diulang bersih.
        catatanSebelum: [
          {
            kind: "meninggalkan_sesi",
            reason: "Peserta meninggalkan halaman asesmen saat sesi terverifikasi berjalan.",
          },
          {
            kind: "pola_salin_tempel",
            reason:
              "Ditemukan penempelan teks pada jawaban asesmen; peserta kemudian mengulang course ini dengan bersih.",
          },
        ],
        // Sesudah completion → tetap memotong skor.
        catatanSesudah: [
          {
            kind: "pola_salin_tempel",
            reason:
              "Ditemukan penempelan teks pada jawaban asesmen lanjutan, dicatat setelah course selesai.",
          },
        ],
        putusan: {},
      },
      {
        // Satu catatan di course LAIN — membuktikan daftar di sertifikat hanya
        // mencakup course yang disertifikatkan, sementara skornya seluruh akun.
        courseId: CRS_UIUX,
        slug: "ui-ux-design-fundamental",
        disertifikasi: false,
        events: [{ jenis: "sesi_dimulai", visibilitas: null }],
        snapshots: [],
        catatanSebelum: [],
        catatanSesudah: [
          {
            kind: "meninggalkan_sesi",
            reason: "Peserta meninggalkan halaman asesmen pada course ini.",
          },
        ],
        putusan: {},
      },
    ],
  },
  {
    email: "demo-integrity-citra@careevo.test",
    username: "citrawardani",
    nama: "Citra Wardani",
    rubrik: { kualitas: 4, kelengkapan: 3, ketepatan_brief: 4, orisinalitas: 4, dokumentasi: 2 },
    tutor: [
      {
        judul: "Kenapa query-ku lambat padahal datanya sedikit",
        courseId: CRS_WEBDEV,
        messages: [
          { role: "user", content: "Query-ku lambat padahal cuma 2000 baris. Kok bisa?" },
          {
            role: "assistant",
            content:
              "Jumlah baris jarang jadi masalah; yang mahal biasanya pemindaian penuh berulang. Cek rencana eksekusinya dulu untuk melihat apakah indeksnya benar-benar dipakai.",
          },
          { role: "user", content: "Ini hasil EXPLAIN-nya, yang mana yang perlu aku lihat?" },
          { role: "user", content: "Ternyata ada nested loop yang jalan seribu kali. Sudah aku tambahkan indeks." },
        ],
      },
      {
        judul: "Indeks komposit dan urutan kolom",
        courseId: CRS_WEBDEV,
        messages: [
          { role: "user", content: "Urutan kolom di indeks komposit itu penting ya?" },
          {
            role: "assistant",
            content:
              "Sangat. Indeks (a, b) bisa melayani pencarian berdasarkan a saja, tapi tidak berdasarkan b saja — jadi kolom yang paling sering dipakai sendirian harus di depan.",
          },
          { role: "user", content: "Berarti kolom yang dipakai sendirian harus di depan." },
        ],
      },
    ],
    kursus: [
      {
        courseId: CRS_WEBDEV,
        slug: "fullstack-web-development-nextjs-15-react-19",
        disertifikasi: true,
        // Melewati ambang → Stage 1 mengusulkan `meninggalkan_sesi` DAN
        // `pola_salin_tempel`. Staf lalu menyetujui satu dan menolak satu.
        events: sinyalLewatAmbang(),
        snapshots: snapshotProgres(Date.parse("2026-10-04T08:40:00Z"), 7, 5),
        catatanSebelum: [],
        catatanSesudah: [
          {
            kind: "plagiarisme",
            reason:
              "Sebagian besar isi karya akhir identik dengan repositori publik yang tidak disebutkan sebagai sumber.",
          },
        ],
        putusan: { pola_salin_tempel: "setuju", meninggalkan_sesi: "tolak" },
      },
      {
        // Usulan di course ini sengaja DIBIARKAN: memperlihatkan antrian kerja
        // yang masih menunggu keputusan.
        courseId: CRS_UIUX,
        slug: "ui-ux-design-fundamental",
        disertifikasi: false,
        events: sinyalLewatAmbang(),
        snapshots: [],
        catatanSebelum: [],
        catatanSesudah: [],
        putusan: { pola_salin_tempel: "biarkan", meninggalkan_sesi: "biarkan" },
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Jalur bantu
 * ------------------------------------------------------------------ */

/** Pengaman: skrip ini menulis banyak baris, jadi jangan sampai salah database. */
function pastikanLokal(): void {
  const url = env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL kosong — tidak tahu database mana yang ditulis.");
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (process.env.CAREEVO_IZIN_TULIS_PROD === "1") return;
  if (host && !/^(localhost|127\.0\.0\.1|careevo)/.test(host)) {
    throw new Error(`Menolak menulis ke database non-lokal (${host}).`);
  }
}

/**
 * Direktori transkrip tutor untuk satu email: **`sha256(email)[:32]`**.
 *
 * Aturan ini disalin dari `src/lib/tutor/transkrip.ts` (bukan ditebak):
 * `direktoriTutor` memakai hash itu, dan versi pertama modul itu pernah salah
 * menebak `basename(email)` sehingga selalu membaca nol sesi.
 */
function direktoriTutor(email: string): string {
  const akar = process.env.CAREERS_DATA_DIR ?? path.join(process.cwd(), ".data");
  const kunci = createHash("sha256").update(email.trim()).digest("hex").slice(0, 32);
  return path.join(akar, "tutor", path.basename(kunci));
}

async function principalStaf(): Promise<SessionPrincipal> {
  const masuk = await authenticatePengguna({ email: EMAIL_STAF, password: SANDI_STAF });
  if (masuk.token && masuk.hasil.ok) return masuk.hasil.principal;

  const dibuat = await daftarPengguna({
    nama: "Staf Demo Integritas",
    username: "demostafintegritas",
    email: EMAIL_STAF,
    password: SANDI_STAF,
  });
  if (!dibuat.ok) throw new Error(`Gagal membuat akun staf: ${dibuat.alasan}`);
  const r = await beriRole({ userId: dibuat.principal.userId, role: "admin", grantedByUserId: null });
  if (!r.ok) throw new Error("Gagal memberi role admin.");
  const lagi = await authenticatePengguna({ email: EMAIL_STAF, password: SANDI_STAF });
  if (!lagi.token || !lagi.hasil.ok) throw new Error("Login staf gagal.");
  return lagi.hasil.principal;
}

async function pastikanPeserta(p: Profil): Promise<{ principal: SessionPrincipal; token: string }> {
  const ada = await authenticatePengguna({ email: p.email, password: SANDI });
  if (ada.token && ada.hasil.ok) {
    throw new Error(
      `Akun ${p.email} sudah ada. Jalankan --hapus dulu supaya demo dimulai dari nol.`,
    );
  }
  const dibuat = await daftarPengguna({
    nama: p.nama,
    username: p.username,
    email: p.email,
    password: SANDI,
  });
  if (!dibuat.ok) throw new Error(`Gagal membuat ${p.email}: ${dibuat.alasan}`);
  const masuk = await authenticatePengguna({ email: p.email, password: SANDI });
  if (!masuk.token || !masuk.hasil.ok) throw new Error(`Login ${p.email} gagal.`);
  return { principal: masuk.hasil.principal, token: masuk.token };
}

/** Isi semua modul course lewat kuis, lalu tanda tangani penyelesaiannya. */
async function selesaikanCourse(principal: SessionPrincipal, courseId: string): Promise<void> {
  const kursus = await getCourseById(courseId);
  if (!kursus) throw new Error(`Kursus ${courseId} tidak ada.`);
  const kebijakan = kursus.kebijakan ?? kebijakanDefault();
  const enrollment = await ambilEnrollment(principal.userId, courseId);
  if (!enrollment) throw new Error("Enrollment tidak terbentuk.");

  for (const m of await modulUntuk(courseId)) {
    const kuis = (m.kuis ?? [])[0];
    if (!kuis) continue;
    const definisi = await getKuis(kuis.id);
    if (!definisi) throw new Error(`Kuis ${kuis.id} tidak ada di bank.`);
    const { attempt } = await mulaiAttemptVerified({
      principal,
      enrollmentId: enrollment.id,
      quizId: kuis.id,
    });
    const kirim = await kirimAttemptVerified({
      principal,
      attemptId: attempt.id,
      jawaban: definisi.soal.map((s) => ({ questionId: s.id, selectedOption: s.jawaban_benar })),
    });
    if (!kirim.lulus) throw new Error(`Kuis "${kuis.judul}" tidak lulus.`);
    await selesaikanModulKuisVerified({
      principal,
      courseId,
      modulId: m.id,
      quizId: kuis.id,
      attemptId: attempt.id,
      policyVersion: kebijakan.versi,
      wajibKamera: butuhKamera(kebijakan),
    });
  }

  const selesai = await selesaikanKursusDb({ principal, courseId, policyVersion: kebijakan.versi });
  if (!selesai.selesai) throw new Error("Course belum tuntas — sertifikat butuh jalur terverifikasi.");
}

async function catatSemua(
  staff: SessionPrincipal,
  peserta: SessionPrincipal,
  courseId: string,
  daftar: CatatanDemo[],
): Promise<void> {
  for (const v of daftar) {
    await catatPelanggaranDb({
      principal: staff,
      userId: peserta.userId,
      courseId,
      kind: v.kind,
      reason: v.reason,
    });
  }
}

/** Proses satu course: run → sinyal → jejak → catatan → tutup → selesai. */
async function jalankanKursus(
  staff: SessionPrincipal,
  peserta: SessionPrincipal,
  k: KursusDemo,
): Promise<void> {
  const kursus = await getCourseById(k.courseId);
  if (!kursus) throw new Error(`Kursus ${k.courseId} tidak ada.`);
  const kebijakan = kursus.kebijakan ?? kebijakanDefault();

  await daftarKursusDb({
    principal: peserta,
    courseId: kursus.id,
    slug: kursus.slug,
    title: kursus.title,
  });
  const enrollment = await ambilEnrollment(peserta.userId, kursus.id);
  if (!enrollment) throw new Error("Enrollment tidak terbentuk.");

  // Batas menit sengaja longgar: kalau run kedaluwarsa sendiri, ia ditutup
  // otomatis dan tidak ada sinyal yang bisa ditulis setelahnya.
  const { run } = await mulaiRunDb({
    principal: peserta,
    enrollmentId: enrollment.id,
    courseId: kursus.id,
    policyVersion: kebijakan.versi,
    batasMenit: 600,
  });

  // (1) Sinyal mentah — HARUS saat run masih `active`.
  //
  // `asal` dikirim eksplisit, dengan nilai yang sama seperti `asalSinyal()`
  // memetakan jenis ini. Tanpa itu, `catatKejadianDb` menurunkannya ke
  // `"server"`, dan panel "asal sinyal" akan melaporkan sinyal peramban sebagai
  // catatan server — menggambarkan arsitekturnya secara salah.
  let ditulis = 0;
  for (const e of k.events) {
    const hasil = await catatKejadianDb({
      principal: peserta,
      runId: run.id,
      jenis: e.jenis,
      visibilitas: e.visibilitas,
      asal: asalSinyal(e.jenis),
      ...(e.detail ? { detail: e.detail } : {}),
    });
    if (hasil) ditulis += 1;
  }

  // (2) Jejak proses ruang kerja — lewat penulis produksi, jadi aturan
  //     penyaringan path yang sama berlaku.
  let snapDitulis = 0;
  for (const s of k.snapshots) {
    const ok = await tambahSnapshot(peserta.userId, kursus.id, {
      at: s.at,
      ringkasan: { berkas: s.berkas, terpotong: false, total: s.berkas.length },
    });
    if (ok) snapDitulis += 1;
  }

  // (3) Catatan yang harus terpulihkan — sebelum completion.
  if (k.catatanSebelum.length > 0) {
    await catatSemua(staff, peserta, kursus.id, k.catatanSebelum);
  }

  // (4) Tutup run → di sinilah Stage 1 otomatis mengusulkan.
  await akhiriRunDb({ principal: peserta, runId: run.id, alasan: "Sesi demo ditutup peserta." });

  // (5) Selesaikan course → memulihkan catatan sebelum completion.
  await selesaikanCourse(peserta, kursus.id);

  // (6) Catatan yang harus tetap aktif — sesudah completion.
  if (k.catatanSesudah.length > 0) {
    await catatSemua(staff, peserta, kursus.id, k.catatanSesudah);
  }

  // (7) Putuskan usulan otomatis sesuai profil.
  const usulan = (await antrianUsulanDb(peserta.userId)).filter((u) => u.courseId === kursus.id);
  for (const u of usulan) {
    const putusan = k.putusan[u.kind] ?? "biarkan";
    if (putusan === "setuju") {
      await putuskanUsulanDb({ principal: staff, id: u.id });
    } else if (putusan === "tolak") {
      await tolakUsulanDb({
        principal: staff,
        id: u.id,
        alasan: "Catatan sesi terlalu umum dan tidak cukup untuk menyimpulkan apa pun.",
      });
    }
  }

  console.log(
    `  ${kursus.id}: ${ditulis} sinyal · ${snapDitulis} snapshot jejak · ` +
      `${k.catatanSebelum.length} sebelum + ${k.catatanSesudah.length} sesudah completion · ` +
      `usulan: ${usulan.length === 0 ? "tidak ada" : usulan.map((u) => `${u.kind}=${k.putusan[u.kind] ?? "biarkan"}`).join(", ")}`,
  );
}

/** Tulis transkrip tutor ke `.data/tutor/` supaya panel ringkasan AI terisi. */
async function tulisTutor(p: Profil): Promise<void> {
  if (p.tutor.length === 0) return;
  const dir = direktoriTutor(p.email);
  await mkdir(dir, { recursive: true });
  for (const [i, s] of p.tutor.entries()) {
    const id = `demo${i + 1}${p.username}`;
    await writeFile(
      path.join(dir, `${id}.json`),
      JSON.stringify(
        {
          version: 1,
          session: {
            id,
            owner: p.email,
            title: s.judul,
            createdAt: new Date(Date.parse("2026-10-04T08:05:00Z") + i * 900_000).toISOString(),
            updatedAt: new Date(Date.parse("2026-10-04T08:35:00Z") + i * 900_000).toISOString(),
            courseId: s.courseId,
            moduleId: null,
            messages: s.messages,
          },
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  console.log(`  transkrip tutor: ${p.tutor.length} sesi`);
}

async function buatSertifikat(
  peserta: SessionPrincipal,
  staff: SessionPrincipal,
  k: KursusDemo,
  rubrik: RubrikReview,
): Promise<string> {
  const enrollment = await ambilEnrollment(peserta.userId, k.courseId);
  if (!enrollment) throw new Error("Enrollment tidak ada.");

  const { submission } = await buatSubmissionDb({
    principal: peserta,
    courseId: k.courseId,
    enrollmentId: enrollment.id,
    konten: {
      judul: "Karya akhir — demo integritas",
      catatan: "DATA CONTOH untuk presentasi panel integritas. Bukan karya peserta sungguhan.",
    },
  });
  await kirimSubmissionDb({ principal: peserta, submissionId: submission.id });
  await tetapkanReviewerDb({ principal: staff, submissionId: submission.id, reviewerUserId: staff.userId });
  await mulaiReviewDb({ principal: staff, submissionId: submission.id });
  const keputusan = await putuskanReviewDb({
    principal: staff,
    submissionId: submission.id,
    decision: "approved",
    rubric: rubrik,
    rationale: "Demo: karya dinilai sesuai rubrik lima kriteria.",
  });

  const token =
    (await ambilKredensialCourse(peserta, k.courseId)) ?? keputusan.attestation?.publicToken ?? null;
  if (!token) throw new Error("Sertifikat tidak terbit.");
  return token;
}

/* ------------------------------------------------------------------ *
 * Buat / hapus
 * ------------------------------------------------------------------ */

async function buatDemo(): Promise<void> {
  const staff = await principalStaf();
  const ringkasan: Array<{ nama: string; email: string; token: string; skor: number }> = [];

  for (const p of PROFIL) {
    console.log(`\n=== ${p.nama} (${p.email}) ===`);
    const { principal, token: tokenSesi } = await pastikanPeserta(p);
    try {
      await tulisTutor(p);

      // Semua course diproses dulu, baru sertifikat dicetak.
      //
      // Urutan ini disengaja: skor kejujuran di sertifikat **dibekukan saat
      // terbit**. Mencetak di tengah proses membuat angka di sertifikat (skor
      // saat terbit) berbeda dari angka di laporan hari ini, dan pembaca akan
      // menemukan dua angka berbeda untuk orang yang sama tanpa penjelasan.
      // Perilaku pembekuan itu tetap benar dan teruji terpisah — yang dihindari
      // di sini hanya menyajikannya sebagai kebingungan di data contoh.
      let token = "";
      for (const k of p.kursus) {
        await jalankanKursus(staff, principal, k);
      }
      const disertifikasi = p.kursus.find((k) => k.disertifikasi);
      if (disertifikasi) {
        token = await buatSertifikat(principal, staff, disertifikasi, p.rubrik);
      }

      const skor = await skorIntegritasDb(principal.userId);
      const publik = await ambilAttestationPublik(token);
      const payload = publik ? dariKanonik(publik.attestation.payloadCanonical) : null;
      const sig = publik
        ? verifikasiSignature(
            publik.attestation.payloadCanonical,
            publik.attestation.signature,
            publik.attestation.keyVersion,
          )
        : false;

      const menunggu = (await antrianUsulanDb(principal.userId)).length;
      console.log(`  skor kejujuran : ${skor.skor}/100 (${skor.jumlahAktif} catatan aktif)`);
      console.log(`  skor karya     : ${payload?.score ?? "-"}/100`);
      console.log(`  usulan menunggu: ${menunggu}`);
      console.log(`  signature      : ${sig ? "VALID" : "TIDAK VALID"}`);
      console.log(`  sertifikat     : ${baseUrl}/verify/${token}`);
      console.log(`  laporan staf   : ${baseUrl}/performa/integritas/${encodeURIComponent(p.email)}`);

      ringkasan.push({ nama: p.nama, email: p.email, token, skor: skor.skor });
    } finally {
      await keluarSession(tokenSesi);
    }
  }

  console.log(
    [
      "",
      "=== SELESAI ===",
      "",
      "Masuk sebagai staf (NODE_ENV=development + DEMO_MODE=1):",
      "  email    : verifikator@careevo.test",
      "  password : careevo",
      "",
      "Yang perlu diperlihatkan di laporan integritas:",
      "  · Skor kejujuran  — Nadia 80, Bima 85 (10+5 dari dua course), Citra sesuai keputusan",
      "  · Usulan otomatis — Citra: 1 disetujui, 1 ditolak, 2 masih menunggu",
      "  · Percakapan tutor — ringkasan AI dari transkrip (butuh LLM hidup)",
      "  · Jejak proses    — berkas mana yang berubah dan berapa kali",
      "  · Ringkasan       — asal sinyal: browser / kamera / luar / server",
      "  · Riwayat sesi    — lini masa sinyal mentah per sesi",
      "",
      "Di sertifikat publik, hanya lapisan 1 yang tampil (dan hanya jumlahnya) —",
      "lapisan 2–4 sengaja tidak, karena itu bahan baca staf, bukan vonis.",
      "",
      "Semua catatan di sini DATA CONTOH buatan skrip, bukan penilaian atas orang",
      "sungguhan. Bersihkan dengan --hapus.",
    ].join("\n"),
  );
}

/** Hapus akun demo + seluruh turunannya, termasuk berkas transkrip tutor. */
async function hapusDemo(): Promise<void> {
  const db = getDb();
  const emails = PROFIL.map((p) => p.email);

  for (const p of PROFIL) {
    await rm(direktoriTutor(p.email), { recursive: true, force: true });
  }

  const cocok = await db.execute<{ id: string }>(
    sql`select id from users where email_normalized in (${sql.join(
      emails.map((e) => sql`${e}`),
      sql`, `,
    )})`,
  );
  const ids = cocok.map((r) => r.id);
  if (ids.length === 0) {
    console.log("Tidak ada akun demo — sudah bersih.");
    return;
  }
  const idList = sql.join(ids.map((i) => sql`${i}`), sql`, `);

  // Urutan penting: FK RESTRICT (`attestations`, `badges`, `reviews`) harus
  // dilepas lebih dulu; sisanya CASCADE dari `users`.
  await db.execute(sql`
    delete from attestation_events where attestation_id in (
      select id from attestations where subject_user_id in (${idList})
    )`);
  await db.execute(sql`delete from attestations where subject_user_id in (${idList})`);
  await db.execute(sql`delete from badges where user_id in (${idList})`);
  await db.execute(sql`
    delete from reviews where submission_id in (
      select id from submissions where user_id in (${idList})
    )`);
  await db.execute(sql`delete from submissions where user_id in (${idList})`);
  await db.execute(sql`delete from integrity_violations where user_id in (${idList})`);
  await db.execute(sql`delete from users where id in (${idList})`);

  console.log(`Dihapus: ${ids.length} akun demo, sertifikat, catatan, dan transkrip tutornya.`);
}

async function main(): Promise<void> {
  pastikanLokal();
  if (HAPUS) await hapusDemo();
  else await buatDemo();
  await tutupDb();
}

main().catch(async (err: unknown) => {
  console.error("\nGAGAL:", err instanceof Error ? err.message : String(err));
  await tutupDb().catch(() => {});
  process.exit(1);
});
