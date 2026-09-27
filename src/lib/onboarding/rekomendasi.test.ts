import { describe, expect, it } from "vitest";
import {
  MAKSALAH_BUKTI_DITAMPILKAN,
  analisisLoker,
  rekomendasiKursus,
  rekomendasiLoker,
  skorKursus,
  skorLoker,
} from "@/lib/onboarding/rekomendasi";
import { katalogBelajar, type EntriKatalog } from "@/lib/courses/katalog";
import { jobs, type JobFixture } from "@/lib/fixtures";
import type { OnboardingProfile } from "@/lib/onboarding/types";

const base: OnboardingProfile = {
  owner: "raka@careevo.test",
  experience: "dasar",
  background: "mahasiswa",
  interests: ["web-dev"],
  goal: "dapat-kerja",
  weeklyHours: 8,
  workPreference: "remote",
  completedAt: "2026-09-01T00:00:00.000Z",
  version: 2,
};

function equalScoreCourse(id: string, title: string): EntriKatalog {
  return {
    id,
    slug: id,
    title,
    url: `https://example.test/${id}`,
    provider: "Test Provider",
    type: "course",
    tags: ["React"],
    level: "dasar",
    is_free: true,
    duration_min: 60,
    completed: false,
  };
}

const equalCatalog = [
  equalScoreCourse("id-z", "Zulu Course"),
  equalScoreCourse("id-a", "Alpha Course"),
];

describe("skorKursus", () => {
  it("scores 0 for a course whose track is outside the learner's interests", () => {
    const kursus: EntriKatalog = {
      id: "x",
      slug: "x",
      title: "OWASP Security",
      url: "u",
      provider: "p",
      type: "course",
      tags: ["Security"],
      level: "dasar",
      is_free: true,
      duration_min: 60,
      completed: false,
      // @ts-expect-error track is not part of EntriKatalog but is read by the scorer
      track: "cyber-sec",
    };
    expect(skorKursus(kursus, base)).toBe(0);
  });

  it("scores a matching-track course positively", () => {
    const kursus: EntriKatalog = {
      id: "y",
      slug: "y",
      title: "React Fundamentals",
      url: "u",
      provider: "p",
      type: "course",
      tags: ["React"],
      level: "dasar",
      is_free: true,
      duration_min: 120,
      completed: false,
      // @ts-expect-error see above
      track: "web-dev",
    };
    expect(skorKursus(kursus, base)).toBeGreaterThan(0);
  });

  it("prefers a matching level over a distant one", () => {
    const make = (level: EntriKatalog["level"]): EntriKatalog => ({
      id: level,
      slug: level,
      title: level,
      url: "u",
      provider: "p",
      type: "course",
      tags: [],
      level,
      is_free: true,
      duration_min: 90,
      completed: false,
      // @ts-expect-error test-only track injection
      track: "web-dev",
    });
    expect(skorKursus(make("dasar"), base)).toBeGreaterThan(skorKursus(make("lanjut"), base));
  });
});

describe("skorLoker", () => {
  it("rewards a job whose tags match the interest", () => {
    const frontend = jobs.find((j) => j.tags.includes("React"))!;
    expect(skorLoker(frontend, base)).toBeGreaterThan(0);
  });

  it("ignores an unrelated job", () => {
    const unrelated = {
      ...jobs[0],
      title: "Sales Executive",
      tags: ["Sales"],
      description: "Menjual produk.",
      location: "Onsite",
      level: "lanjut" as const,
    };
    expect(skorLoker(unrelated, base)).toBe(0);
  });
});

/**
 * Ke Highlands: keyword matching here used to be `hay.includes(kw)` over one
 * lowercase blob, which has no word boundaries. Every case below is a substring
 * that used to fire (or fail to fire) and now must not — the panel's claim is
 * that it recommends what the posting *says*, and a false positive there is
 * worse than an empty list because it looks confident.
 */
describe("analisisLoker — presisi bukti", () => {
  /**
   * Bagian ini mengunci sesuatu yang tidak terlihat di layar: daftar ini hanya
   * berisi posting yang **benar-benar menyebut** bukti minat. Tanpa itu, panel
   * menampilkan lowongan yang tidak ada hubungannya dan terlihat yakin —
   * kegagalan yang lebih buruk daripada daftar kosong.
   */
  const posting = (over: Partial<JobFixture>): JobFixture => ({
    ...jobs[0],
    sentinel_status: "clean",
    level: "dasar",
    location: "Jakarta · Onsite",
    work_type: "Onsite",
    tags: [],
    ...over,
  });

  const minat = (minat: OnboardingProfile["interests"][number]): OnboardingProfile => ({
    ...base,
    interests: [minat],
  });

  it('tidak memakai "ml" dari dalam kata "html" sebagai bukti minat AI', () => {
    // "html" memuat "ml" sebagai substring. Minat `ai` tidak boleh terpenuhi
    // oleh lowongan web biasa hanya karena itu.
    const web = posting({
      title: "Frontend Developer",
      tags: ["HTML", "CSS"],
      description: "Membangun antarmuka dengan HTML dan CSS.",
    });
    expect(analisisLoker(web, minat("ai")).skor).toBe(0);
  });

  it('tidak memakai "ai" dari dalam kata "detail"/"maintain" sebagai bukti', () => {
    const kebocoran = posting({
      title: "Operations Associate",
      tags: ["Operations"],
      description: "Menyusun detail laporan dan maintain spreadsheet harian.",
    });
    expect(analisisLoker(kebocoran, minat("ai")).skor).toBe(0);
  });

  it('tidak memakai "data" dari dalam kata "database" sebagai bukti minat data', () => {
    // Sebaliknya dari dua di atas: kata yang benar-benar ada, tapi bukan bukti
    // bahwa orang tersebut bekerja dengan data.
    const backend = posting({
      title: "Backend Engineer",
      tags: ["Node.js", "PostgreSQL"],
      description: "Merancang REST API dan optimasi query PostgreSQL.",
    });
    expect(analisisLoker(backend, minat("data")).skor).toBe(0);
  });

  it("menerima bukti dari deskripsi meski judulnya generik", () => {
    // Judul tidak menyebut web, tapi deskripsi menyebut React dan Node.js.
    // Versi lama melihat satu blob teks tanpa membedakan field, jadi tidak
    // bisa memberi bobot berbeda pada judul, tag, dan deskripsi.
    const generic = posting({
      title: "Software Engineer",
      tags: [],
      description:
        "Mengembangkan fitur end-to-end: API Node.js, antarmuka React, dan integrasi basis data.",
    });
    const analisis = analisisLoker(generic, minat("web-dev"));
    expect(analisis.skor).toBeGreaterThan(0);
    expect(analisis.cocok).toContain("React");
  });

  it("memberi kata di judul nilai lebih tinggi daripada kata yang sama di deskripsi", () => {
    const diJudul = posting({
      title: "React Developer",
      description: "Peran di tim produk.",
    });
    const diDeskripsi = posting({
      title: "Software Engineer",
      description: "Kerja harian dengan React.",
    });
    expect(analisisLoker(diJudul, minat("web-dev")).skor).toBeGreaterThan(
      analisisLoker(diDeskripsi, minat("web-dev")).skor,
    );
  });

  it("menilai luas bukti di atas pengulangan kata yang sama", () => {
    // Dua posting dengan bukti total yang sama bisa dibedakan oleh *jumlah*
    // kata berbeda yang cocok — dan itulah yang membuat lowongan yang
    // benar-benar cocok naik lebih cepat.
    const luas = posting({
      title: "Frontend Engineer",
      tags: ["React", "TypeScript", "CSS"],
      description: "Antarmuka B2B dengan React dan TypeScript.",
    });
    const sempit = posting({
      title: "Frontend Engineer",
      tags: ["React"],
      description: "React.",
    });
    expect(analisisLoker(luas, minat("web-dev")).skor).toBeGreaterThan(
      analisisLoker(sempit, minat("web-dev")).skor,
    );
  });

  it("menampilkan bukti yang lebih spesifik, bukan bagiannya", () => {
    // Postingan ini cocok untuk dua minat. Kalau "React" dan "React Native"
    // sama-sama ditampilkan, kartu mengulang dirinya sendiri.
    const mobile = posting({
      title: "React Native Developer",
      tags: ["React Native", "TypeScript"],
      description: "Aplikasi mobile lintas platform dengan React Native.",
    });
    const analisis = analisisLoker(mobile, { ...base, interests: ["web-dev", "mobile"] });
    expect(analisis.cocok).toContain("React Native");
    expect(analisis.cocok).not.toContain("React");
  });

  it("membaca work_type, bukan menebak dari location", () => {
    // `location` masih memuat kata "Hybrid" pada lowongan Remote — jadi
    // lowongan ini harus dihitung Remote. Pencocokan lama membaca `location`
    // sebagai sumber kebenaran dan akan salah di sini.
    const remote = posting({
      title: "Frontend Developer",
      tags: ["React"],
      description: "Antarmuka produk.",
      location: "Jakarta · Hybrid",
      work_type: "Remote",
    });
    const profilRemote = { ...base, workPreference: "remote" as const };
    const profilHybrid = { ...base, workPreference: "hybrid" as const };
    expect(skorLoker(remote, profilRemote)).toBeGreaterThan(skorLoker(remote, profilHybrid));
  });

  it("membatasi bukti per minat supaya deskripsi panjang tidak menang telak", () => {
    // Yang diuji adalah sifatnya, bukan angkanya: menambah kata kunci lagi
    // berhenti menaikkan skor setelah kuota per minat terpenuhi. Tanpa batas,
    // ranking kembali menjadi "deskripsi terpanjang menang" dan ketiga
    // penentu lain (level, susunan kerja, verdict Sentinel) tak bisa mengalahkan
    // satu paragraf panjang.
    const jenuh = posting({
      title: "Frontend Engineer",
      description:
        "React, Node.js, JavaScript, TypeScript, HTML, CSS, Web, REST API, GraphQL, Vite.",
    });
    const lebihPanjang = posting({
      title: "Frontend Engineer",
      description:
        "React, Node.js, JavaScript, TypeScript, HTML, CSS, Web, REST API, GraphQL, Vite, Web App.",
    });
    const minimal = posting({
      title: "Frontend Engineer",
      description: "Membangun antarmuka.",
    });
    const penuh = analisisLoker(jenuh, minat("web-dev")).skor;
    const lebihPenuh = analisisLoker(lebihPanjang, minat("web-dev")).skor;
    const satu = analisisLoker(minimal, minat("web-dev")).skor;

    // Satu kata kunci di bawah kuota → naik.
    expect(satu).toBeLessThan(penuh);
    // Lewat kuota → kata tambahan tidak menambah apa pun.
    expect(lebihPenuh).toBe(penuh);
  });

  it("membatasi jumlah kata yang ditampilkan di kartu", () => {
    // Kartu menampilkan maksimal `MAKSALAH_BUKTI_DITAMPILKAN` kata. Kalau
    // scorer mengembalikan lebih, kartu akan jadi tembok chip dan menutupi
    // judul lowongannya sendiri.
    const banyak = posting({
      title: "Frontend Engineer",
      tags: ["React", "TypeScript", "JavaScript", "HTML", "CSS", "Node.js"],
      description: "React, TypeScript, JavaScript, HTML, CSS, Node.js, Web, REST API.",
    });
    const analisis = analisisLoker(banyak, minat("web-dev"));
    expect(analisis.cocok.length).toBeLessThanOrEqual(MAKSALAH_BUKTI_DITAMPILKAN);
    expect(analisis.cocok.length).toBeGreaterThan(0);
  });
});

describe("rekomendasi*", () => {
  it("ranks real catalog entries, highest first, capped at the limit", async () => {
    const katalog = await katalogBelajar();
    const hasil = rekomendasiKursus(katalog, base, 3);
    expect(hasil.length).toBeLessThanOrEqual(3);
    // Every returned entry must score > 0 (no out-of-scope noise).
    for (const entry of hasil) {
      expect(skorKursus(entry, base)).toBeGreaterThan(0);
    }
    // Descending order by score.
    const scores = hasil.map((e) => skorKursus(e, base));
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it("preserves catalog order when course scores are equal", () => {
    // Given: equal-score courses whose title order is the reverse of catalog order.
    const katalog = equalCatalog;

    // When: the catalog is ranked with a one-course limit.
    const ids = rekomendasiKursus(katalog, base, 1).map((entry) => entry.id);

    // Then: the first catalog entry wins instead of the first title.
    expect(ids).toEqual(["id-z"]);
  });

  it("returns the same equal-score course order across calls", () => {
    // Given: the same equal-score catalog and profile.
    const katalog = equalCatalog;

    // When: the catalog is ranked twice.
    const first = rekomendasiKursus(katalog, base, 2).map((entry) => entry.id);
    const second = rekomendasiKursus(katalog, base, 2).map((entry) => entry.id);

    // Then: both runs preserve the same stable order.
    expect(second).toEqual(first);
  });

  it("surfaces web-dev jobs for a web-dev learner", () => {
    const hasil = rekomendasiLoker(jobs, base, 4);
    expect(hasil.length).toBeGreaterThan(0);
    expect(hasil.every((r) => r.job.sentinel_status !== "rejected")).toBe(true);
  });

  it("is deterministic across calls", () => {
    const a = rekomendasiLoker(jobs, base, 4).map((r) => r.job.id);
    const b = rekomendasiLoker(jobs, base, 4).map((r) => r.job.id);
    expect(a).toEqual(b);
  });

  it("returns nothing when no interest aligns (empty interest is impossible, but a mismatched one is not)", () => {
    const gameOnly: OnboardingProfile = { ...base, interests: ["game-dev"] };
    const hasil = rekomendasiLoker(jobs, gameOnly, 4);
    // The fixture has no game-dev postings → empty is the correct answer.
    expect(hasil).toEqual([]);
  });

  it("menyertakan bukti pada setiap rekomendasi, karena kartu menampilkannya", () => {
    // Kartu menampilkan kata kunci yang jadi alasan. Kalau `cocok` kosong
    // sementara `skor` > 0, kartu akan menampilkan alasan kosong — dan penghilang
    // -nya paling murah dilakukan dengan membuat field ini opsional.
    const hasil = rekomendasiLoker(jobs, base, 4);
    expect(hasil.length).toBeGreaterThan(0);
    for (const item of hasil) {
      expect(item.skor).toBeGreaterThan(0);
      expect(item.cocok.length).toBeGreaterThan(0);
      expect(item.cocok.length).toBeLessThanOrEqual(MAKSALAH_BUKTI_DITAMPILKAN);
    }
  });
});
