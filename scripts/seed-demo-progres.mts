/**
 * Seed progres demo — mengisi Enrollment + `module_progress` untuk **akun demo**,
 * supaya halaman `/progres` bisa dilihat dalam keadaan terisi.
 *
 * Pakai: `npm run seed:demo`
 *        `npm run seed:demo -- admin@careevo.test`
 *
 * ## Batasannya, dan kenapa
 *
 * - **Hanya akun demo.** `findDemoAccount` menolak di luar
 *   `NODE_ENV=development` + `DEMO_MODE=1`, dan `pastikanUserDemo` sengaja tidak
 *   diekspor. Jadi skrip ini berhenti dengan pesan untuk email yang bukan akun
 *   demo, bukan membuat user diam-diam.
 * - **Selalu lewat service, tidak pernah SQL langsung.** `daftarKursusDb` dan
 *   `tandaiModulDb` dipakai apa adanya, jadi progress yang dibentuk menaati
 *   validasi resolver modul dan tidak bisa menghasilkan id modul palsu.
 * - **Modul ditandai sebagai `informal`.** Itu jalur yang memang didukung dan
 *   bisa dibuat peserta sendiri. Yang **tidak** dibuat di sini:
 *   `quiz_attempts`, `course_completions`, `badges`, dan `attestations`. Jadi
 *   kursus 100% di sini berarti "semua modul selesai secara informal", **bukan**
 *   "sertifikat terbit" — atestasi tetap harus lewat alur submission → review.
 *   Jangan pakai skrip ini untuk menguji klaim terverifikasi.
 * - **Idempoten, dan itu wajib.** `tandaiModulDb` adalah TOGGLE: memanggilnya
 *   dua kali untuk modul yang sama akan **membatalkan**. Skrip ini karena itu
 *   membaca progres yang ada lebih dulu dan hanya menandai yang memang perlu,
 *   supaya aman dijalankan berkali-kali.
 * - **Sesi dicabut di akhir.** Login hanya dipakai untuk mendapat principal, lalu
 *   `keluarSession` supaya tidak meninggalkan baris `sessions` sampah.
 *
 * Catatan lingkungan: `docs/local-db.md`.
 */

import { readFileSync } from "node:fs";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, findDemoAccount } from "@/lib/auth/demo-accounts";
import { authenticatePengguna, keluarSession } from "@/lib/auth/auth-service";
import { katalogBelajar } from "@/lib/courses/katalog";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { daftarKursusDb, tandaiModulDb } from "@/lib/learning/service";
import { ambilEnrollment, listModulSelesai } from "@/lib/learning/repository";

// `findDemoAccount` membaca env per panggilan. `.env.local` dimuat manual di
// sini karena skrip dijalankan lewat `tsx`, bukan di dalam server Next — dan,
// tidak seperti `scripts/migrate.ts`, skrip ini benar-benar butuh `DEMO_MODE`
// dari file itu, bukan cuma fallback bawaan kode.
//
// `NODE_ENV` dideklarasikan read-only oleh tipe Next, jadi env ditulis lewat
// satu alias di sini, bukan dengan assignment langsung.
const env = process.env as unknown as Record<string, string | undefined>;
env.NODE_ENV ??= "development";
for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (cocok) env[cocok[1]] ??= cocok[2].replace(/^["']|["']$/g, "");
}

const email = process.argv[2]?.trim() ?? "user@careevo.test";

/**
 * Target progres per kursus, dalam persen modul selesai.
 *
 * Ragamnya disengaja: `/progres` punya tiga filter (Kursus diambil / Sedang
 * dipelajari / Selesai) dan ketiganya harus punya isi supaya filter itu bisa
 * dibedakan — bukan kebetulan kosong semua. Salah satu targetnya 0% supaya kartu
 * "baru terdaftar, belum mulai" ikut terlihat.
 */
const RENCANA: readonly number[] = [100, 100, 60, 60, 40, 40, 20, 0];

function gagal(pesan: string): never {
  console.error(pesan);
  process.exit(1);
}

if (!findDemoAccount(email)) {
  gagal(
    `Email ${email} bukan akun demo yang tersedia di mesin ini.\n` +
      `Akun demo: ${DEMO_ACCOUNTS.map((a) => a.email).join(", ")}\n` +
      `Butuh NODE_ENV=development dan DEMO_MODE=1 — lihat docs/local-db.md.`,
  );
}

const masuk = await authenticatePengguna({ email, password: DEMO_PASSWORD, izinkanDemo: true });
if (!masuk.token || !masuk.hasil.ok) {
  gagal(`Login demo gagal: ${JSON.stringify(masuk.hasil)}`);
}
const principal = masuk.hasil.principal;

try {
  const katalog = await katalogBelajar();
  if (katalog.length < RENCANA.length) {
    gagal(`Katalog hanya ${katalog.length} entri, sedangkan rencana butuh ${RENCANA.length}.`);
  }

  console.log(`Seed progres untuk ${email} (userId=${principal.userId})\n`);

  const hasil: Array<{ judul: string; selesai: number; total: number; persen: number }> = [];

  for (const [index, persen] of RENCANA.entries()) {
    const kursus = katalog[index];
    const modul = await modulUntukSumber({
      id: kursus.id,
      title: kursus.title,
      tags: kursus.tags,
      duration_min: kursus.duration_min,
      url: kursus.url,
    });

    await daftarKursusDb({
      principal,
      courseId: kursus.id,
      slug: kursus.slug,
      title: kursus.title,
    });
    const enrollment = await ambilEnrollment(principal.userId, kursus.id);
    if (!enrollment) gagal(`Enrollment untuk ${kursus.id} tidak terbentuk.`);

    const sudah = new Set(await listModulSelesai(enrollment.id));

    // `Math.ceil` supaya target 0% benar-benar 0 modul, dan 20% dari 5 modul
    // menjadi 1 modul (20%) — bukan 0 modul karena pembagian bulat ke bawah.
    const target = Math.ceil((persen / 100) * modul.length);
    const harusSelesai = new Set(modul.slice(0, target).map((m) => m.id));

    for (const modulKursus of modul) {
      const sudahSelesai = sudah.has(modulKursus.id);
      if (harusSelesai.has(modulKursus.id) === sudahSelesai) continue;
      const hasilTandai = await tandaiModulDb({
        principal,
        courseId: kursus.id,
        modulId: modulKursus.id,
        sumber: "informal",
        nama: principal.nama,
      });
      if (!hasilTandai.ok) gagal(`Modul ${modulKursus.id} ditolak: ${hasilTandai.alasan}`);
    }

    // Dihitung ulang dari database, bukan dari `harusSelesai` — jadi yang
    // dicetak adalah angka yang benar-benar akan dilihat halaman.
    const finalSet = new Set(await listModulSelesai(enrollment.id));
    const selesai = modul.filter((m) => finalSet.has(m.id)).length;
    hasil.push({
      judul: kursus.title,
      selesai,
      total: modul.length,
      persen: Math.round((selesai / modul.length) * 100),
    });
  }

  const tuntun = hasil.filter((h) => h.persen >= 100).length;

  console.log("  persen    modul  kursus");
  for (const h of hasil) {
    const modul = `${h.selesai}/${h.total}`.padStart(6);
    console.log(`  ${String(h.persen).padStart(5)}%  ${modul}    ${h.judul.slice(0, 52)}`);
  }
  console.log(
    `\n${hasil.length} kursus diisi: ${tuntun} selesai, ${hasil.length - tuntun} berjalan.`,
  );
  console.log(`\nLogin: ${email} / ${DEMO_PASSWORD}  →  http://localhost:3000/progres`);
} finally {
  await keluarSession(masuk.token);
}
