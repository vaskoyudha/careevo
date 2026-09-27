import { describe, expect, it } from "vitest";
import type { InboxJob } from "@/lib/career-ops";
import type { ListingJobstreet } from "@/lib/career-ops";
import type { JobFixture } from "@/lib/fixtures";
import {
  kebutuhanDariInbox,
  labelSumber,
  tagInferensiDariPeran,
} from "@/lib/jobs/persiapan-inbox";
import { skorKursusUntukLoker } from "@/lib/jobs/rekomendasi-kursus";
import type { EntriKatalog } from "@/lib/courses/katalog";

function baris(over: Partial<InboxJob> = {}): InboxJob {
  return {
    url: "https://id.jobstreet.com/id/job/1",
    company: "GudangAda",
    role: "Software Engineer (Front End)",
    location: "Tangerang, Banten",
    done: false,
    ...over,
  };
}

function listing(over: Partial<ListingJobstreet> = {}): ListingJobstreet {
  return {
    id: "1",
    title: "Software Engineer (Front End)",
    teaser: "You will build our React and TypeScript dashboard with our design system.",
    bulletPoints: ["3+ years with React", "TypeScript required"],
    companyName: "GudangAda",
    ...over,
  };
}

describe("kebutuhanDariInbox", () => {
  it("mengambil judul, deskripsi, dan kategori dari listing yang terambil", () => {
    const { kebutuhan, sumber } = kebutuhanDariInbox(baris(), listing());
    expect(sumber).toBe("penuh");
    expect(kebutuhan.title).toBe("Software Engineer (Front End)");
    expect(kebutuhan.description).toContain("React");
    expect(kebutuhan.description).toContain("TypeScript");
  });

  it("TIDAK PERNAH mengarang level", () => {
    // Level proximity menambah `(2 - jarak) * 4` di ranker bersama. Level yang
    // ditebak akan menambah sampai 8 poin ke kursus yang dipilih untuk lowongan
    // yang tidak pernah menyebut level — jadi field-nya harus absen, bukan
    //_default_.
    const { kebutuhan } = kebutuhanDariInbox(baris(), listing());
    expect("level" in kebutuhan).toBe(false);
    expect(kebutuhan.level).toBeUndefined();
  });

  it("jatuh ke title-only saat listing tidak bisa diambil, dan mengatakannya", () => {
    const { kebutuhan, sumber } = kebutuhanDariInbox(baris(), null);
    expect(sumber).toBe("ringan");
    expect(kebutuhan.title).toBe("Software Engineer (Front End)");
    expect(kebutuhan.description).toBe("");
    expect(kebutuhan.tags).toEqual([]);
  });

  it("tetap 'penuh' bila hanya teaser yang ada, tanpa bulletPoints", () => {
    const { sumber } = kebutuhanDariInbox(
      baris(),
      listing({ bulletPoints: [], teaser: "Membangun antarmuka React" }),
    );
    expect(sumber).toBe("penuh");
  });

  it("tidak melempar pada row tanpa lokasi atau gaji", () => {
    const minimal: InboxJob = {
      url: "https://apply.workable.com/x/1",
      company: "X",
      role: "Backend Engineer",
      done: false,
    };
    expect(() => kebutuhanDariInbox(minimal, null)).not.toThrow();
  });

  it("mengubah klasifikasi Jobstreet jadi tag, bukan menebak", () => {
    const denganKlasifikasi = {
      ...listing(),
      classifications: [
        {
          classification: { id: "1", description: "Information & Communication Technology" },
          subclassification: { id: "2", description: "Business/Systems Analysts" },
        },
      ],
    } as ListingJobstreet;
    const { kebutuhan, sumber } = kebutuhanDariInbox(baris(), denganKlasifikasi);
    expect(sumber).toBe("penuh");
    expect(kebutuhan.tags).toContain("Information & Communication Technology");
    expect(kebutuhan.tags).toContain("Business/Systems Analysts");
  });
});

describe("tagInferensiDariPeran", () => {
  it("membaca tech dari judul peran", () => {
    expect(tagInferensiDariPeran("Software Engineer (Front End)")).toContain("frontend");
    expect(tagInferensiDariPeran("Data Analyst")).toContain("data analyst");
    expect(tagInferensiDariPeran("DevOps Engineer")).toContain("devops");
  });

  it("tidak menebak dari peran yang tidak menyebut teknologi", () => {
    expect(tagInferensiDariPeran("Product Manager")).toContain("product manager");
    // Tidak ada sinyal teknologi di judul ini — daftar harus kosong, bukan
    // menebak dari kata "engineer" yang ada di hampir semua baris papan.
    expect(tagInferensiDariPeran("Operations Specialist")).toEqual([]);
  });

  it("tidak menyimpulkan bahasa dari kata yang tidak menyebutnya", () => {
    // "Machine Learning" bukan "Python". Menebak python di sini akan
    // recommending kursus Python ke siapa saja yangHN memperlua
    // machine learning, dan itu klaim yang tidak ada di lowongannya.
    expect(tagInferensiDariPeran("Staff Machine Learning Engineer")).not.toContain("python");
    expect(tagInferensiDariPeran("Backend Engineer Go")).toContain("golang");
    expect(tagInferensiDariPeran("Backend Engineer Go")).not.toContain("python");
  });
});

describe("labelSumber", () => {
  it("mengatakan pada sumbernya, dan tidak menjanjikan lebih dari yang ada", () => {
    expect(labelSumber("penuh")).toMatch(/deskripsi/i);
    expect(labelSumber("ringan")).toMatch(/judul peran saja/i);
    expect(labelSumber("peran")).toMatch(/judul peran saja/i);
  });
});

describe("kesesuaian dengan ranker yang dipakai ulang", () => {
  // `KebutuhanLoker` sengaja dibungkus sebagai `JobFixture` supaya ranker
  // yang produksi bisa dijalankan. Yang diuji di sini adalah hal yang penting:
  // adapter ini tidak mengubah rekomendasi dibanding memberi ranker bentuk
  // yang biasa. Kalau skor berubah, kursus yang dipilih berubah — dan itu
  // regresi yang tidak akan terlihat dari tipe saja.
  const katalog = [
    { id: "fe-1", title: "Frontend Engineering with React", slug: "fe-react", tags: ["frontend", "react", "typescript"], level: "menengah", is_free: false },
    { id: "da-1", title: "Data Analysis Fundamentals", slug: "da", tags: ["data analyst", "sql"], level: "pemula", is_free: true },
    { id: "un-1", title: "Unrelated Cooking", slug: "cooking", tags: ["cooking"], level: "pemula", is_free: true },
  ] as unknown as EntriKatalog[];

  const { kebutuhan } = kebutuhanDariInbox(baris(), listing());

  it("memberi skor yang sama dengan JobFixture setara", () => {
    const jobFixture = {
      title: kebutuhan.title,
      description: kebutuhan.description,
      tags: kebutuhan.tags,
    } as unknown as JobFixture;

    for (const entry of katalog) {
      expect(skorKursusUntukLoker(entry, kebutuhan as unknown as JobFixture)).toBe(
        skorKursusUntukLoker(entry, jobFixture),
      );
    }
  });

  it("memberi skor tertinggi ke kursus yang memang cocok", () => {
    const skor = new Map(
      katalog.map((e) => [e.id, skorKursusUntukLoker(e, kebutuhan as unknown as JobFixture)]),
    );
    expect(skor.get("fe-1")).toBeGreaterThan(0);
  });

  it("menolak kursus yang tidak berbagi isi apa pun dengan lowongan", () => {
    // Kursus analisis data untuk lowongan React harus TIDAK masuk daftar, dan
    // bukan sekadar berada di urutan bawah: `rekomendasiKursusUntukLoker`
    // membuang apa pun di bawah lantai relevansi 10. asserting-nya di sini
    // menjaga adapter ini tidak menaikkan skor courses yang tidak relevan —
    // itulah yang akan membuat daftar jadi lebih pendek, bukan lebih tepat.
    const skorData = new Map(
      katalog.map((e) => [e.id, skorKursusUntukLoker(e, kebutuhan as unknown as JobFixture)]),
    );
    expect(skorData.get("da-1")).toBe(0);
    expect(skorData.get("un-1")).toBe(0);
  });

  it("tidak menaikkan relevance lewat level yang dikarang", () => {
    // `level` absen di KebutuhanLoker, jadi jarak level dihitung terhadap
    // `indexOf(undefined) === -1` dan tidak menambah poin relevansi. Kalau
    // suatu saat adapter mulai mengisi level, skor harus naik — dan uji ini
    // gagal dengan memberi tahu bahwa perubahan itu disengaja.
    const tanpaLevel = katalog.map((e) =>
      skorKursusUntukLoker(e, kebutuhan as unknown as JobFixture),
    );
    const denganLevel = katalog.map((e) =>
      skorKursusUntukLoker(e, {
        ...kebutuhan,
        level: "menengah",
      } as unknown as JobFixture),
    );
    expect(denganLevel[0]).toBeGreaterThan(tanpaLevel[0]);
  });
});
