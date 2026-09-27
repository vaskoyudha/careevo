/**
 * E2E: satu peserta menyelesaikan course sampai **sertifikat benar-benar terbit**.
 *
 * Pakai: `npx tsx scripts/seed/konten/e2e-sertifikat.mts [slug] [email]`
 *
 * Berbeda dari `verifikasi-kerja.mts` (yang berhenti di "modul selesai"), skrip
 * ini menyusuri jalur credential sampai habis dan mengukur waktunya:
 *
 *   1. Daftar kursus → enrollment.
 *   2. Sesi terverifikasi (`mulaiRunDb`).
 *   3. Tiap modul: attempt kuis → jawaban benar → `selesaikanModulKuisVerified`.
 *   4. `selesaikanKursusDb` → `course_completions` dengan jalur `terverifikasi`.
 *   5. `buatSubmissionDb` + `kirimSubmissionDb` (karya).
 *   6. Verifikator: `tetapkanReviewerDb` → `mulaiReviewDb` → `putuskanReviewDb`.
 *   7. Baca balik kredensial lewat `ambilKredensialCourse`, verifikasi signature,
 *      lalu buka `/verify/<token>` lewat HTTP.
 *
 * Semua lewat service yang sama dengan aplikasi — bukan stub — jadi ini bukti
 * bahwa rantai service benar-benar menghasilkan kredensial yang bisa diverifikasi
 * pihak ketiga. Setiap langkah mencatat durasi sehingga timeout bisa diketaui.
 *
 * Menjalankan skrip ini **menulis** ke database: progress, attempt, submission,
 * badge, dan satu baris `attestations`. Akun verifikator dibuat bila belum ada.
 */

import { readFileSync } from "node:fs";
import { daftarPengguna, authenticatePengguna, keluarSession } from "@/lib/auth/auth-service";
import { beriRole } from "@/lib/auth/invitation";
import type { SessionPrincipal } from "@/lib/auth/principal";
import { getCourseBySlug, getKuis } from "@/lib/courses/store";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import { butuhKamera } from "@/lib/learning/akses";
import { daftarKursusDb, progresKursusDb, selesaikanKursusDb } from "@/lib/learning/service";
import {
  kirimAttemptVerified,
  mulaiAttemptVerified,
  selesaikanModulKuisVerified,
} from "@/lib/learning/assessment-service";
import { mulaiRunDb } from "@/lib/learning/run-service";
import { ambilEnrollment, ambilRunAktif } from "@/lib/learning/repository";
import {
  ambilKredensialCourse,
  buatSubmissionDb,
  kirimSubmissionDb,
  mulaiReviewDb,
  putuskanReviewDb,
  tetapkanReviewerDb,
  type RubrikReview,
} from "@/lib/review/service";
import { ambilAttestationPublik } from "@/lib/review/repository";
import { verifikasiSignature } from "@/lib/attestation/key";
import { dariKanonik } from "@/lib/attestation/payload";

const env = process.env as unknown as Record<string, string | undefined>;
env.NODE_ENV ??= "development";
for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (cocok) env[cocok[1]] ??= cocok[2].replace(/^["']|["']$/g, "");
}

const slug = process.argv[2] ?? "fullstack-web-development-nextjs-15-react-19";
const email = process.argv[3] ?? "user@careevo.test";
const emailVerifikator = "e2e-verifikator@careevo.test";
const baseUrl = process.env.CAREEVO_BASE_URL ?? "http://127.0.0.1:3000";

/**
 * `--baru` memakai peserta **baru** (email acak) supaya setiap tahap benar-benar
 * dibuktikan dari nol.
 *
 * Tanpa flag ini akun demo dipakai lagi, dan kalau kursus itu sudah pernah
 *untas sebelumnya, `selesaikanKursusDb` mengembalikan `baru: false` — jadi tahap
 * "menyelesaikan kursus" tidak benar-benar diuji, hanya dibaca. Uji manual pertama
 * saya justru terjatuh ke sana; `--baru` menutup celah itu.
 */
const pakaiPesertaBaru = process.argv.includes("--baru");
const emailBaru = `e2e-belajar-${Date.now().toString(36)}@careevo.test`;
const sandiBaru = "careevo-e2e-password";

const RUBRIK_LULUS: RubrikReview = {
  kelengkapan: 4,
  kualitas: 4,
  orisinalitas: 4,
  ketepatan_brief: 4,
  dokumentasi: 4,
};

/** Pengaman: skrip ini menulis production bila DATABASE_URL menunjuk ke sana. */
function PastikanBolehMenulis(): void {
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
    throw new Error(
      `Menolak menulis ke database non-lokal (${host}). Set CAREEVO_IZIN_TULIS_PROD=1 bila memang disengaja.`,
    );
  }
}

const catatan: { langkah: string; ms: number }[] = [];

async function langkah<T>(nama: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round(performance.now() - t0);
    catatan.push({ langkah: nama, ms });
    console.log(`   ⏱  ${nama}: ${ms}ms`);
  }
}

async function principalStaff(): Promise<SessionPrincipal> {
  // Akun demo `verifikator@careevo.test` tidak ada di database, jadi skrip ini
  // membuat (atau mencari) akun sendiri lalu memberi role lewat jalur produksi
  // `beriRole` — bukan menulis tabel secara langsung.
  const masuk = await authenticatePengguna({
    email: emailVerifikator,
    password: "careevo-e2e-password",
  });
  if (masuk.token && masuk.hasil.ok) return masuk.hasil.principal;

  const dibuat = await daftarPengguna({
    nama: "Verifikator E2E",
    username: "e2e-verifikator",
    email: emailVerifikator,
    password: "careevo-e2e-password",
  });
  if (!dibuat.ok) throw new Error(`Gagal membuat akun verifikator: ${dibuat.alasan}`);
  const hasil = await beriRole({
    userId: dibuat.principal.userId,
    role: "verifikator",
    grantedByUserId: null,
  });
  if (!hasil.ok) throw new Error("Gagal memberi role verifikator.");
  const masuk2 = await authenticatePengguna({
    email: emailVerifikator,
    password: "careevo-e2e-password",
  });
  if (!masuk2.token || !masuk2.hasil.ok) throw new Error("Login verifikator gagal.");
  return masuk2.hasil.principal;
}

async function main() {
  PastikanBolehMenulis();

  const kursus = await getCourseBySlug(slug);
  if (!kursus) throw new Error(`Kursus ${slug} tidak ada.`);
  const kebijakan = kursus.kebijakan ?? kebijakanDefault();

  // Peserta baru: daftar lewat jalur produksi (`daftarPengguna`) lalu login biasa
  // (bukan `izinkanDemo`) supaya akunnya benar-benar baru, tanpa enrollment,
  // completion, submission, atau badge apa pun.
  let learner: SessionPrincipal;
  let tokenSesi: string | undefined;
  if (pakaiPesertaBaru) {
    const dibuat = await daftarPengguna({
      nama: "Peserta E2E",
      username: `e2e${Date.now().toString(36)}`,
      email: emailBaru,
      password: sandiBaru,
    });
    if (!dibuat.ok) throw new Error(`Gagal membuat peserta baru: ${dibuat.alasan}`);
    learner = dibuat.principal;
    const m = await authenticatePengguna({ email: emailBaru, password: sandiBaru });
    if (!m.token || !m.hasil.ok) throw new Error("Login peserta baru gagal.");
    tokenSesi = m.token;
  } else {
    const masuk = await authenticatePengguna({ email, password: "careevo", izinkanDemo: true });
    if (!masuk.token || !masuk.hasil.ok) {
      throw new Error(`Login ${email} gagal. (Akun demo butuh NODE_ENV=development + DEMO_MODE=1.)`);
    }
    learner = masuk.hasil.principal;
    tokenSesi = masuk.token;
  }

  const staff = await principalStaff();
  console.log(`Kursus : ${kursus.title}`);
  console.log(`Slug   : ${slug}`);
  console.log(`Learner: ${emailBaru} (${learner.userId.slice(0, 8)}…)${pakaiPesertaBaru ? " [BARU]" : ` [demo: ${email}]`}`);
  console.log(`Staff  : ${emailVerifikator}\n`);

  try {
    const enrollment = await langkah("daftar kursus", async () => {
      await daftarKursusDb({
        principal: learner,
        courseId: kursus.id,
        slug: kursus.slug,
        title: kursus.title,
      });
      const e = await ambilEnrollment(learner.userId, kursus.id);
      if (!e) throw new Error("Enrollment tidak terbentuk.");
      return e;
    });
    console.log(`   → enrollment ${enrollment.id.slice(0, 8)}…\n`);

    await langkah("mulai sesi terverifikasi", async () => {
      if (await ambilRunAktif(learner.userId, kursus.id)) return;
      await mulaiRunDb({
        principal: learner,
        enrollmentId: enrollment.id,
        courseId: kursus.id,
        policyVersion: kebijakan.versi,
        batasMenit: 240,
      });
    });

    const modul = await modulUntuk(kursus.id);
    console.log(`Kurikulum: ${modul.length} modul\n`);

    for (const [i, m] of modul.entries()) {
      const kuis = (m.kuis ?? [])[0];
      if (!kuis) {
        console.log(`   [${i + 1}/${modul.length}] ${m.judul} — TANPA kuis, dilewati`);
        continue;
      }
      const definisi = await getKuis(kuis.id);
      if (!definisi) throw new Error(`Kuis ${kuis.id} tidak ada di bank.`);

      const { attempt } = await langkah(`modul ${i + 1}: ${m.judul}`, async () =>
        mulaiAttemptVerified({
          principal: learner,
          enrollmentId: enrollment.id,
          quizId: kuis.id,
        }),
      );
      const kirim = await kirimAttemptVerified({
        principal: learner,
        attemptId: attempt.id,
        jawaban: definisi.soal.map((s) => ({ questionId: s.id, selectedOption: s.jawaban_benar })),
      });
      if (!kirim.lulus) throw new Error(`Kuis "${kuis.judul}" tidak lulus (skor ${kirim.score}).`);
      await selesaikanModulKuisVerified({
        principal: learner,
        courseId: kursus.id,
        modulId: m.id,
        quizId: kuis.id,
        attemptId: attempt.id,
        policyVersion: kebijakan.versi,
        wajibKamera: butuhKamera(kebijakan),
      });
      console.log(`   [${i + 1}/${modul.length}] ✓ ${m.judul} — skor ${kirim.score}`);
    }

    const progres = await progresKursusDb(learner, kursus.id);
    const selesai = modul.filter((m) => progres.selesai.includes(m.id)).length;
    console.log(`\nModul selesai: ${selesai}/${modul.length}`);

    const completion = await langkah("selesaikan kursus", () =>
      selesaikanKursusDb({
        principal: learner,
        courseId: kursus.id,
        policyVersion: kebijakan.versi,
      }),
    );
    if (!completion.selesai) {
      throw new Error(
        `Kursus belum tuntas: ${completion.selesaiCount}/${completion.total} modul. Sertifikat butuh jalur terverifikasi.`,
      );
    }
    console.log(
      `   → completion jalur=${completion.completion.completionPath} ` +
        `(dicatat otomatis oleh modul terakhir; panggilan ini idempoten)`,
    );

    // Catatan penting soal `baru`: `selesaikanModulKuisVerified` memanggil
    // `selesaikanKursusDb` setelah **setiap** modul (assessment-service.ts:444),
    // jadi modul terakhir sudah otomatis merekam completion. Panggilan eksplisit
    // di sini karena itu idempoten dan selalu mengembalikan `baru: false` —
    // itu perilaku yang benar, bukan kebocoran state.
    //
    // Bukti "completion benar-benar baru" bukan `baru`, melainkan facta bahwa
    // peserta dibuat beberapa detik lalu: tidak mungkin ada completion lama
    // untuk akun yang belum ada. Yang diuji di sini adalah completion bertipe
    // `terverifikasi` benar-benar ada setelah modul terakhir.
    if (!completion.selesai || completion.completion.completionPath !== "terverifikasi") {
      throw new Error(
        `Completion tidak terverifikasi: jalur=${completion.selesai ? completion.completion.completionPath : "tidak ada"}.`,
      );
    }

    const { submission } = await langkah("buat karya", () =>
      buatSubmissionDb({
        principal: learner,
        courseId: kursus.id,
        enrollmentId: enrollment.id,
        konten: { judul: `Karya E2E — ${kursus.title}`, catatan: "Dihasilkan oleh skrip e2e-sertifikat." },
      }),
    );
    await langkah("kirim karya", () => kirimSubmissionDb({ principal: learner, submissionId: submission.id }));
    await langkah("tetapkan reviewer", () =>
      tetapkanReviewerDb({ principal: staff, submissionId: submission.id, reviewerUserId: staff.userId }),
    );
    await langkah("mulai review", () => mulaiReviewDb({ principal: staff, submissionId: submission.id }));
    const keputusan = await langkah("putuskan review", () =>
      putuskanReviewDb({
        principal: staff,
        submissionId: submission.id,
        decision: "approved",
        rubric: RUBRIK_LULUS,
        rationale: "E2E: karya lengkap, orisinal, dan sesuai brief.",
      }),
    );
    console.log(
      `   → submission=${keputusan.submission.status} ` +
        `badge=${keputusan.badge ? "ya" : "tidak"} ` +
        `attestation=${keputusan.attestation?.status ?? "tidak"}`,
    );

    const token = await langkah("ambil kredensial", () => ambilKredensialCourse(learner, kursus.id));
    if (!token) {
      throw new Error("Kredensial tidak terbit setelah review approved — ini bug, bukan kelemahan fitur.");
    }

    const hasilVerifikasi = await langkah("verifikasi token (DB + HMAC)", async () => {
      const baris = await ambilAttestationPublik(token);
      if (!baris) throw new Error("Token tidak ditemukan lewat ambilAttestationPublik.");
      const signatureValid = verifikasiSignature(
        baris.attestation.payloadCanonical,
        baris.attestation.signature,
        baris.attestation.keyVersion,
      );
      if (!signatureValid) throw new Error("Signature HMAC tidak cocok.");
      return { baris, signatureValid };
    });
    const { baris: publik, signatureValid } = hasilVerifikasi;

    const payload = dariKanonik(publik.attestation.payloadCanonical);
    console.log("\n=== SERTIFIKAT ===");
    console.log(`URL        : ${baseUrl}/verify/${token}`);
    console.log(`Penerbit   : ${publik.subject.nama} (@${publik.subject.username})`);
    console.log(`Task       : ${payload?.task_title ?? "-"}`);
    console.log(`Skor       : ${payload?.score ?? "-"}`);
    console.log(`Terbit     : ${payload?.issued_at ?? "-"}`);
    console.log(`Signature  : ${signatureValid ? "VALID" : "TIDAK VALID"}`);
    console.log(`Status DB  : ${publik.attestation.status}`);

    // Halaman publik: dibuktikan lewat HTTP kalau dev server hidup. Kegagalan di
    // sini tidak membatalkan Service Layer — hanya berarti tidak ada server.
    try {
      const res = await fetch(`${baseUrl}/verify/${token}`, { redirect: "manual" });
      const html = await res.text();
      const tampil = /valid|terbit|Raka|Sertifikat/i.test(html);
      console.log(`HTTP       : ${res.status} (${tampil ? "konten kredensial tampil" : "konten tidak terdeteksi"})`);
    } catch {
      console.log(`HTTP       : dilewati (tidak ada server di ${baseUrl})`);
    }

    const total = catatan.reduce((n, c) => n + c.ms, 0);
    const terlambat = catatan.filter((c) => c.ms > 2000);
    console.log("\n=== PERFORMA ===");
    console.log(`Langkah    : ${catatan.length}`);
    console.log(`Total      : ${total}ms`);
    const rata = catatan.length ? Math.round(total / catatan.length) : 0;
    console.log(`Rata-rata  : ${rata}ms/langkah`);
    const lambat = catatan.slice().sort((a, b) => b.ms - a.ms).slice(0, 3);
    console.log(`Terlambat  : ${lambat.map((c) => `${c.langkah} (${c.ms}ms)`).join(", ")}`);
    if (terlambat.length === 0) console.log(`Catatan    : tidak ada langkah > 2000ms.`);
    console.log("\nHASIL: E2E LULUS — kursus tuntas, karya disetujui, sertifikat terbit & signature valid.");
  } finally {
    if (tokenSesi) await keluarSession(tokenSesi);
  }
}

main().catch((err: unknown) => {
  console.error("\nE2E GAGAL:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
