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
const BERKAS_CHAT_ACTION = path.join(ROOT, "src/actions/learning-chat.ts");
const BERKAS_CHAT_UI = path.join(ROOT, "src/components/features/learning/study-chat.tsx");
const BERKAS_SKOR = path.join(ROOT, "src/actions/performa.ts");

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

describe("gerbang aturan bantuan pada tutor", () => {
  it("menolak tutor sebelum pesan disimpan dan sebelum model dipanggil", () => {
    const isi = readFileSync(BERKAS_CHAT_ACTION, "utf8");
    expect(isi).toContain('"policy_denied"');
    // Memindahkan gerbang ke belakang `appendStudyMessage` mengembalikan
    // celahnya: pesan yang ditolak akan tersimpan di transkrip sebagai bukti
    // permintaan yang ditolak.
    expect(isi.indexOf('"policy_denied"')).toBeLessThan(isi.indexOf("await appendStudyMessage("));
  });

  it("komponen klien punya dua jalur yang mengenal penolakan kebijakan", () => {
    // Tepat dua: `submitMessage` (kosongkan isian) dan `displayedSnapshot`
    // (tampilkan transkrip). Menghapus salah satunya membuat penolakan hilang
    // tanpa error sama sekali — tidak ada test render di repo ini yang bisa
    // menangkapnya — jadi jumlahnya dipatok.
    const isi = readFileSync(BERKAS_CHAT_UI, "utf8");
    expect(isi.match(/"policy_denied"/g) ?? []).toHaveLength(2);
  });
});

describe("pencatatan skor kuis", () => {
  it("aksi penyimpanan nilai tidak pernah menyebut kunci jawaban", () => {
    // Whole-file scan, comments included: the answer key must not travel on the
    // new path either.
    expect(readFileSync(BERKAS_SKOR, "utf8")).not.toContain("jawaban_benar");
  });

  it("halaman kursus tetap meneruskan konteks pencatatan", () => {
    // `catat` is optional so the admin previews compile without it — which is
    // exactly why the learner path needs pinning. Dropping it here would make
    // quiz scores stop being recorded with no error anywhere.
    expect(readFileSync(BERKAS_DETAIL, "utf8")).toContain("catat={{ courseId: kursus.id, modulId: m.id }}");
  });
});
