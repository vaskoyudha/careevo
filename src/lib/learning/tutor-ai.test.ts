import { describe, expect, it } from "vitest";
import {
  KAPABILITAS_COURSE_STUDY,
  tautanTutorAi,
  urlFrameAiMastery,
  urlFrameTutorEmbed,
} from "./tutor-ai";

/**
 * Kontrak deep-link "Tutor AI".
 *
 * asserted as property, not as one frozen string: the id kursus adalah `text`
 * di database (lihat `src/lib/db/schema.ts`), bukan uuid, jadi ia bisa memuat
 * karakter yang harus di-encode. Menguji satu id tetap saja membuat tes ini
 * lolos utuh saat encoding-nya dihapus — jadi sifat yang diuji adalah
 * "id-nya masuk sebagai satu parameter", bukan teksnya.
 */
describe("tautanTutorAi", () => {
  it("A1: membawa id kursus dan capability sebagai parameter terpisah", () => {
    const url = new URL(tautanTutorAi("r2"), "http://x");
    expect(url.pathname).toBe("/ai-mastery");
    expect(url.searchParams.get("course")).toBe("r2");
    expect(url.searchParams.get("capability")).toBe(KAPABILITAS_COURSE_STUDY);
  });

  it("A2: meng-encode id kursus, bukan menempelkannya mentah", () => {
    const idKasar = "a b&c?d#e";
    const url = new URL(tautanTutorAi(idKasar), "http://x");
    // Id utuh kembali persis — inilah yang bocor kalau encoding dihapus.
    expect(url.searchParams.get("course")).toBe(idKasar);
    expect(url.href).toContain("course=a+b%26c%3Fd%23e");
  });

  it("A3: id kosong jatuh ke /ai-mastery polos, bukan link rusak", () => {
    // Kursus tanpa id yang bisa dipakai boleh terjadi; ini tidak boleh
    // menjadi `?course=&capability=…` yang tidak berarti apa pun.
    for (const kosong of ["", "   ", "\n"]) {
      expect(tautanTutorAi(kosong)).toBe("/ai-mastery");
    }
  });

  it("A4: capability bisa ditimpa, defaultnya course_study", () => {
    const url = new URL(tautanTutorAi("r2", "chat"), "http://x");
    expect(url.searchParams.get("capability")).toBe("chat");
  });
});

describe("urlFrameAiMastery", () => {
  const DASAR = "http://localhost:3790";

  it("B1: meneruskan course + capability ke dalam frame", () => {
    const out = urlFrameAiMastery(DASAR, { course: "r2", capability: "course_study" });
    const url = new URL(out);
    // Yang dijaga di sini adalah origin, bukan string-nya: menambahkan query
    // memang menormalkan path menjadi "/", dan itu wajar. Byte-identik untuk
    // kasus tanpa query diuji terpisah di B2.
    expect(url.origin).toBe(new URL(DASAR).origin);
    expect(url.searchParams.get("course")).toBe("r2");
    expect(url.searchParams.get("capability")).toBe("course_study");
  });

  it("B2: tanpa query, src tetap polos — navbar dan mastery tetap utuh", () => {
    // `/ai-mastery` polos dipakai chrome.tsx, chrome-parts.tsx, dan
    // mastery-topic-view.tsx. Menempel `?` di sana mengubah perilaku tiga
    // pemanggil yang tidak saya sentuh.
    expect(urlFrameAiMastery(DASAR, {})).toBe(DASAR);
    expect(urlFrameAiMastery(DASAR, { course: "", capability: "" })).toBe(DASAR);
  });

  it("B3: basis yang sudah punya query tidak jadi dua tanda tanya", () => {
    const out = urlFrameAiMastery("http://localhost:3790/?x=1", { course: "r2" });
    const url = new URL(out);
    expect(url.searchParams.get("x")).toBe("1");
    expect(url.searchParams.get("course")).toBe("r2");
  });

  it("B4: base URL tidak valid dilempar, bukan diam-diam jadi frame rusak", () => {
    expect(() => urlFrameAiMastery("not a url", { course: "r2" })).toThrow();
  });
});

describe("urlFrameTutorEmbed", () => {
  const DASAR = "http://localhost:3790";

  it("menempelkan path embed dan query course", () => {
    const out = urlFrameTutorEmbed(DASAR, { course: "r2", capability: "course_study" });
    expect(out).toBe("http://localhost:3790/embed/chat?course=r2&capability=course_study");
  });

  it("tanpa query tetap mengembalikan path embed, bukan baseUrl polos", () => {
    // Berbeda dari `urlFrameAiMastery`, yang mengembalikan `baseUrl` apa adanya.
    // Di sini path-nya sendiri yang penting: `/embed/chat` adalah rutenya.
    expect(urlFrameTutorEmbed(DASAR, {})).toBe("http://localhost:3790/embed/chat");
    expect(urlFrameTutorEmbed(DASAR, { course: "", capability: "" })).toBe(
      "http://localhost:3790/embed/chat",
    );
  });

  it("meng-encode id kursus yang memuat `&`", () => {
    // `courses.id` adalah kolom `text`, bukan uuid: `a&b` mentah akan terpecah
    // jadi dua parameter dan kursus yang tiba bukan kursus yang diklik.
    const out = urlFrameTutorEmbed(DASAR, { course: "a&b" });
    expect(out).toContain("course=a%26b");
    expect(new URL(out).searchParams.get("course")).toBe("a&b");
  });

  it("base URL tidak valid dilempar, bukan jadi frame rusak", () => {
    expect(() => urlFrameTutorEmbed("not a url", { course: "r2" })).toThrow();
  });
});
