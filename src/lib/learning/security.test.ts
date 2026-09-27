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
  // tanpa ada kebocoran apa pun. Sejak cutover Fase 2 kepemilikan run ditegakkan
  // `catatKejadianDb` lewat `principal.userId` (bukan lagi perbandingan email di
  // action), jadi yang dijaga di sini adalah properti yang sama pada bentuk
  // barunya: action hanya boleh menyerahkan **principal dari sesi**, dan tidak
  // pernah membaca owner dari input klien.
  it("endpoint kejadian tidak mempercayai owner dari klien", () => {
    const isi = isiLearning();
    expect(isi).toMatch(/catatKejadianDb\(\{\s*principal: session,/);
    // Tidak ada `owner` yang dibaca dari wire di mana pun pada action ini.
    expect(isi).not.toMatch(/input\.owner/);
    expect(isi).not.toMatch(/session\.email\s*===/);
  });
});

// Gerbang UI tidak bisa diuji dengan render di repo ini (Vitest hanya memuat
// `src/**/*.test.ts`, tanpa jsdom), jadi propertinya dijaga dari teks sumber —
// pendekatan yang sama dengan pemerikasan di atas. Yang dijaga bukan gaya
// penulisan, melainkan dua cara gerbang ini hilang diam-diam saat panel
// disunting: ajakan sesi dihapus dari halaman, atau kuis kembali dirender apa
// adanya tanpa keputusan akses.
//
// Dua berkas, sesuai rumah barunya: silabus (`detail-kursus.tsx`) masih memegang
// ajakan tingkat-course, sedangkan gerbang kuis dan lampiran pindah ke pane
// reader (`materi-pane.tsx`) saat akordeonnya dibongkar. Keduanya dulu satu
// berkas, jadi jangan disatukan kembali hanya karena tesnya dulu begitu.
const BERKAS_DETAIL = path.join(ROOT, "src/components/features/learning/detail-kursus.tsx");
const BERKAS_PANE = path.join(ROOT, "src/components/features/learning/materi-pane.tsx");
const BERKAS_SESI = path.join(ROOT, "src/components/features/learning/course-session.tsx");
const BERKAS_SKOR = path.join(ROOT, "src/actions/assessment.ts");
const BERKAS_KUIS_VIEW = path.join(
  ROOT,
  "src/components/features/learning/kuis-view.tsx",
);
const BERKAS_LAPORAN_BELAJAR = path.join(
  ROOT,
  "src/components/features/performa/performa-belajar.tsx",
);
const BERKAS_LAPORAN_INTEGRITAS = path.join(
  ROOT,
  "src/components/features/performa/performa-integritas.tsx",
);
const BERKAS_DAFTAR_LAPORAN = path.join(ROOT, "src/app/(verifikator)/performa/page.tsx");
const BERKAS_DETAIL_LAPORAN = path.join(
  ROOT,
  "src/app/(verifikator)/performa/[owner]/page.tsx",
);
const BERKAS_DAFTAR_INTEGRITAS = path.join(
  ROOT,
  "src/app/(verifikator)/performa/integritas/page.tsx",
);
const BERKAS_DETAIL_INTEGRITAS = path.join(
  ROOT,
  "src/app/(verifikator)/performa/integritas/[owner]/page.tsx",
);

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
    // Gerbangnya ada di pane reader, bukan lagi di halaman silabus: akordeon
    // halaman kursus dibongkar, dan kuis mengikuti materinya ke `materi-pane.tsx`.
    const isi = readFileSync(BERKAS_PANE, "utf8");
    // Membuang kedua penanda ini mengembalikan kuis ke render tanpa sesi.
    expect(isi).toContain('keputusanKuis.tipe === "bebas"');
    expect(isi).toContain("<CourseSessionGate pesan={keputusanKuis.pesan} />");
    // Tepat satu tempat merender kuis di ruang belajar — dan itu di cabang `bebas`.
    expect(isi.match(/<KuisView/g) ?? []).toHaveLength(1);
  });
});

describe("pencatatan skor kuis", () => {
  it("UI kuis memakai jalur penilaian server, bukan action skor lama", () => {
    // Jalur lama menghitung nilai di peramban lalu mengirimnya sebagai catatan
    // yang tidak pernah dibaca laporan. Yang dijaga di sini: UI tidak kembali ke
    // jalur itu, dan penilaiannya lewat action asesmen terverifikasi.
    const isi = readFileSync(BERKAS_KUIS_VIEW, "utf8");
    expect(isi).toContain("mulaiKuisVerifiedAction");
    expect(isi).toContain("kirimDanSelesaikanKuisAction");
    expect(isi).not.toContain("simpanNilaiKuisAction");
  });

  it("UI kuis memeriksa hasil penyimpanan dan menampilkan kegagalannya", () => {
    // Inti bug MVP: jalur lama fire-and-forget (`.catch(() => undefined)`), jadi
    // kegagalan penyimpanan tidak pernah terlihat peserta. Empat penanda ini
    // membuat regresi itu tidak bisa kembali diam-diam:
    //   1. hasil action diperiksa (`if (!kirim.ok)`),
    //   2. ada state gagal,
    //   3. pesannya benar-benar disimpan untuk ditampilkan, dan
    //   4. tidak ada lagi pola fire-and-forget.
    const isi = readFileSync(BERKAS_KUIS_VIEW, "utf8");
    expect(isi).toContain("if (!kirim.ok)");
    expect(isi).toContain('fase: "gagal"');
    expect(isi).toContain("if (terjawab < soal.length) return;");
    expect(isi).toContain("Nilai belum tersimpan");
    expect(isi).not.toContain(".catch(() => undefined)");
    expect(isi).not.toMatch(/void\s+kirimDanSelesaikan/);
  });

  it("skor yang ditampilkan berasal dari balasan server", () => {
    // Skor lokal hanya umpan balik sementara; yang tersimpan — dan yang dibaca
    // laporan — adalah `score` dari server.
    expect(readFileSync(BERKAS_KUIS_VIEW, "utf8")).toContain("server.score");
  });

  it("retry memakai ulang attempt, bukan membuka attempt baru", () => {
    // Bila pengiriman gagal setelah server sempat menyimpan, retry harus
    // mengirim ulang attempt yang sama (idempoten), bukan menumpuk attempt
    // `in_progress` baru.
    expect(readFileSync(BERKAS_KUIS_VIEW, "utf8")).toContain("attemptRef");
  });

  it("klaim Lulus hanya setelah server menyimpan; sebelum itu hasil sementara", () => {
    // "Lulus!" adalah klaim kelulusan yang memicu progres terverifikasi. Di
    // atas `nilaiLokal` (hitungan peramban yang belum tersimpan) ia akan
    // melebihkan. Karena itu teksnya dipisah per fase: hanya `tersimpan` yang
    // menghasilkan "Lulus!", dan keadaan lain memakai "Hasil latihan sementara".
    const isi = readFileSync(BERKAS_KUIS_VIEW, "utf8");
    expect(isi).toContain('const tersimpan = server.fase === "sukses"');
    expect(isi).toContain("Hasil latihan sementara");
    // Pesan pada banner tidak lagi memakai `nilaiLokal` untuk mengklaim lulus.
    expect(isi).toMatch(/lulusTampil = server\.lulus/);
  });

  it("aksi penyimpanan nilai tidak pernah menyebut kunci jawaban", () => {
    // Whole-file scan, comments included: the answer key must not travel on the
    // new path either.
    expect(readFileSync(BERKAS_SKOR, "utf8")).not.toContain("jawaban_benar");
  });

  it("halaman kursus tetap meneruskan konteks penilaian", () => {
    // `konteks` is optional so the admin previews compile without it — which is
    // exactly why the learner path needs pinning. Dropping it here would make
    // quiz answers stop being graded on the server with no error anywhere.
    //
    // Rumahnya sekarang pane reader, dan nama variabelnya berbeda karena pane
    // menerima keduanya sebagai prop (`kursusId`, `modul.id`) — yang diuji adalah
    // `konteks` benar-benar sampai ke `KuisView` di jalur peserta, bukan ejaan
    // prop-nya.
    expect(readFileSync(BERKAS_PANE, "utf8")).toContain(
      "konteks={{ courseId: kursusId, modulId: modul.id }}",
    );
  });
});

describe("laporan performa tidak mengklaim lebih dari yang dilakukan", () => {
  it("laporan belajar menyatakan skor dinilai server tetapi bukan tahan-curang", () => {
    const isi = readFileSync(BERKAS_LAPORAN_BELAJAR, "utf8");
    expect(isi).toContain("PERINGATAN_PEMBELAJARAN");
    expect(isi).toContain("dinilai di server");
    expect(isi).toContain("tahan-curang");
  });

  it("laporan integritas menyatakan catatan bukan pelanggaran", () => {
    const isi = readFileSync(BERKAS_LAPORAN_INTEGRITAS, "utf8");
    expect(isi).toContain("PERINGATAN_INTEGRITAS");
    // Batasnya: data ini hanya catatan pengamatan, jadi laporan tidak boleh
    // menyebut sesuatu sebagai pelanggaran maupun menyatakan angka ini
    // memengaruhi nilai siapa pun.
    expect(isi).toContain("bukan pelanggaran");
    expect(isi).toContain("Tidak diketahui");
  });

  it("laporan integritas menyatakan bahwa tidak ada rekaman kamera", () => {
    // Kolom kamera kosong akan salah dibaca sebagai "sesi bersih" kalau tidak
    // dijelaskan. "Tidak ada yang dicatat" adalah satu-satunya klaim benar
    // saat ini — kamera tidak pernah diminta.
    const isi = readFileSync(BERKAS_LAPORAN_INTEGRITAS, "utf8");
    expect(isi).toContain("Tidak ada rekaman kamera");
    expect(isi).toContain("tidak menurunkan skor");
  });

  it("peringatan integritas tetap pendek dan tidak bertele-tele", () => {
    // Laporan ini dibaca orang yang sedang menilai. Kalimat panjang di situ
    // hanya menunda keputusan, dan disclaimer yang panjang justru membuat orang
    // berhenti membacanya.
    const isi = readFileSync(BERKAS_LAPORAN_INTEGRITAS, "utf8");
    const blok = isi.match(/PERINGATAN_INTEGRITAS\s*=\s*\[([\s\S]*?)\]\s*as const/);
    expect(blok).not.toBeNull();
    const baris = [...(blok![1].matchAll(/"([^"]+)"/g))].map((m) => m[1]);
    expect(baris.length).toBeGreaterThanOrEqual(3);
    for (const b of baris) {
      expect(b.length).toBeLessThanOrEqual(110);
      // Bukan paragraf: paling dua kalimat pendek per baris.
      expect(b.split(". ").length).toBeLessThanOrEqual(2);
    }
  });

  it("kedua halaman daftar tetap memeriksa sesi sendiri", () => {
    // The role gate comes from the `(verifikator)` layout; these pages check on
    // their own too so moving them cannot silently open learner records.
    expect(readFileSync(BERKAS_DAFTAR_LAPORAN, "utf8")).toContain("getSession");
    expect(readFileSync(BERKAS_DAFTAR_INTEGRITAS, "utf8")).toContain("getSession");
  });

  it("kedua halaman detail mendekode segmen rute sebelum mencari berkas", () => {
    // Route params arrive URL-encoded in this Next version. The store keys files
    // by a hash of the email, so an undecoded `user%40careevo.test` silently
    // misses every record and every learner detail page 404s. Only a live HTTP
    // probe found this one; typecheck and unit tests both stayed green.
    expect(readFileSync(BERKAS_DETAIL_LAPORAN, "utf8")).toContain("decodeURIComponent(segmen)");
    expect(readFileSync(BERKAS_DETAIL_INTEGRITAS, "utf8")).toContain("decodeURIComponent(segmen)");
  });
});

describe("laporan belajar dan laporan integritas tidak bercampur", () => {
  it("halaman belajar tidak membaca data sesi sama sekali", () => {
    // Pemisahan ini bukan aturan tampilan: kalau halaman belajar masih
    // mengimpor `listRun`, datanya bisa bocor kembali ke sana.
    for (const f of [BERKAS_DAFTAR_LAPORAN, BERKAS_DETAIL_LAPORAN, BERKAS_LAPORAN_BELAJAR]) {
      const isi = readFileSync(f, "utf8");
      expect(isi).not.toContain("listRun");
      expect(isi).not.toContain("ringkasIntegritasByOwner");
      expect(isi).not.toContain("kejadian");
    }
  });

  it("tabel belajar tidak menampilkan kolom integritas", () => {
    const isi = readFileSync(BERKAS_LAPORAN_BELAJAR, "utf8");
    expect(isi).not.toContain("Kejadian / celah");
    expect(isi).not.toContain("kedaluwarsa");
  });

  it("kedua tabel saling menaut, bukan saling menggandakan data", () => {
    // Tautan silang harus ada supaya "pemilik ini punya sesi tapi nol modul"
    // tetap bisa dicari dari kedua sisi.
    expect(readFileSync(BERKAS_LAPORAN_BELAJAR, "utf8")).toContain("/performa/integritas/");
    expect(readFileSync(BERKAS_LAPORAN_INTEGRITAS, "utf8")).toContain("/performa/${encodeURIComponent");
  });
});
