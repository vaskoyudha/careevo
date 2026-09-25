import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pemeriksaan statis: membaca teks sumber, bukan menjalankan action-nya. Tidak
// ada berkas yang ditulis dan tidak ada data yang disentuh — uji ini hanya
// menjaga properti keamanan yang mudah hilang saat kode lain disunting.
const ROOT = path.resolve(__dirname, "../../..");
const BERKAS_LEARNING = path.join(ROOT, "src/actions/learning.ts");

function isiLearning(): string {
  return readFileSync(BERKAS_LEARNING, "utf8");
}

describe("keamanan jalur ujian", () => {
  it("tidak mengirim kunci jawaban dari server actions", () => {
    expect(isiLearning()).not.toContain("jawaban_benar");
  });

  it("setiap server action sesi memeriksa getSession", () => {
    const isi = isiLearning();
    const jumlahGate = (isi.match(/await getSession\(\)/g) ?? []).length;
    expect(jumlahGate).toBeGreaterThanOrEqual(4);
  });

  // Dulu uji ini mematok persis `run.owner !== session.email`, sehingga
  // normalisasi trim/toLowerCase yang wajar saja sudah cukup membuatnya merah
  // tanpa ada kebocoran apa pun. Bentuk di bawah tetap menjaga invariannya —
  // kepemilikan run dibandingkan dengan email sesi, bukan dengan apa pun yang
  // dikirim klien — tanpa mengunci gaya penulisannya.
  it("endpoint kejadian tidak mempercayai owner dari klien", () => {
    const isi = isiLearning();
    expect(isi).toMatch(/run\.owner\s*!==\s*session\.email/);
  });
});

// Gerbang UI tidak bisa diuji dengan render di repo ini (Vitest hanya memuat
// `src/**/*.test.ts`, tanpa jsdom), jadi propertinya dijaga dari teks sumber —
// pendekatan yang sama dengan pemerikasan di atas. Yang dijaga bukan gaya
// penulisan, melainkan dua cara gerbang ini hilang diam-diam saat panel
// disunting: ajakan sesi dihapus dari halaman, atau kuis kembali dirender apa
// adanya tanpa keputusan akses.
const BERKAS_DETAIL = path.join(ROOT, "src/components/features/learning/detail-kursus.tsx");
const BERKAS_SESI = path.join(ROOT, "src/components/features/learning/course-session.tsx");

describe("gerbang UI sesi terverifikasi", () => {
  it("halaman kursus selalu menawarkan cara memulai sesi", () => {
    // Modul turunan tidak punya lampiran, sehingga `CourseSessionGate` (tombol
    // "Mulai sesi" yang satunya lagi) tidak pernah ikut terender di sana. Tanpa
    // ajakan tingkat-course ini, tombol "Tandai selesai" tampil tanpa ada satu
    // pun cara memenuhi syaratnya — penyelesaian mustahil, tapi tetap tertolak
    // server.
    expect(readFileSync(BERKAS_DETAIL, "utf8")).toContain("<CourseSessionPrompt />");
    // Ajakan itu harus benar-benar memulai sesi, bukan sekadar label mati.
    expect(readFileSync(BERKAS_SESI, "utf8")).toMatch(
      /export function CourseSessionPrompt[\s\S]*?void mulai\(\)/,
    );
  });

  it("kuis hanya dirender setelah keputusan akses mengizinkan", () => {
    const isi = readFileSync(BERKAS_DETAIL, "utf8");
    // Membuang kedua penanda ini mengembalikan kuis ke render tanpa sesi.
    expect(isi).toContain('keputusanKuis.tipe === "bebas"');
    expect(isi).toContain("<CourseSessionGate pesan={keputusanKuis.pesan} />");
    // Tepat satu tempat merender kuis di ruang belajar — dan itu di cabang `bebas`.
    expect(isi.match(/<KuisView/g) ?? []).toHaveLength(1);
  });
});
