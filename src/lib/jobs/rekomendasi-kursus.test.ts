import { describe, expect, it } from "vitest";
import { rekomendasiKursusUntukLoker, skorKursusUntukLoker } from "./rekomendasi-kursus";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { JobFixture } from "@/lib/fixtures";

const entry = (over: Partial<EntriKatalog> = {}): EntriKatalog =>
  ({
    id: "c1",
    slug: "react-dasar",
    title: "React Dasar",
    url: "/belajar/react-dasar",
    provider: "Careevo",
    type: "course",
    tags: ["React"],
    level: "dasar",
    is_free: true,
    duration_min: 60,
    completed: false,
    ...over,
  }) as EntriKatalog;

const job = (over: Partial<JobFixture> = {}): JobFixture =>
  ({
    id: "1",
    title: "Frontend Engineer (Junior)",
    company: "PT Nusantara",
    location: "Jakarta",
    description: "Membangun antarmuka dengan React dan TypeScript.",
    tags: ["React", "TypeScript", "Testing"],
    level: "dasar",
    sentinel_status: "clean",
    ...over,
  }) as unknown as JobFixture;

describe("skorKursusUntukLoker", () => {
  it("scores an exact tag match far above an unrelated course", () => {
    const cocok = entry({ tags: ["React"] });
    const asing = entry({ id: "c2", slug: "godot", title: "Game Dev", tags: ["Godot"] });
    expect(skorKursusUntukLoker(cocok, job())).toBeGreaterThan(
      skorKursusUntukLoker(asing, job()),
    );
  });

  it("gives credit when a course tag appears in the posting text", () => {
    const job2 = job({ tags: ["Testing"] });
    const kursus = entry({ tags: ["Playwright"], title: "Testing dengan Playwright" });
    // "Testing" is in the job's tags and the course's title, so it must not be 0.
    expect(skorKursusUntukLoker(kursus, job2)).toBeGreaterThan(0);
  });

  it("scores a level-matching course above a far-level one", () => {
    const dasar = entry({ level: "dasar" });
    const lanjut = entry({ id: "c3", slug: "react-lanjut", level: "lanjut" });
    expect(skorKursusUntukLoker(dasar, job())).toBeGreaterThan(
      skorKursusUntukLoker(lanjut, job()),
    );
  });
});

describe("rekomendasiKursusUntukLoker", () => {
  it("drops courses below the relevance floor", () => {
    const katalog = [
      entry({ tags: ["React"] }),
      entry({ id: "c2", slug: "godot", title: "Game Dev", tags: ["Godot"] }),
    ];
    const hasil = rekomendasiKursusUntukLoker(katalog, job());
    expect(hasil.map((e) => e.id)).toEqual(["c1"]);
  });

  it("respects the limit", () => {
    const katalog = [
      entry({ id: "a", tags: ["React"] }),
      entry({ id: "b", tags: ["TypeScript"] }),
      entry({ id: "c", tags: ["Testing"] }),
    ];
    expect(rekomendasiKursusUntukLoker(katalog, job(), 2)).toHaveLength(2);
  });

  it("is deterministic for identical input", () => {
    const katalog = [entry({ id: "a", tags: ["React"] }), entry({ id: "b", tags: ["TypeScript"] })];
    const a = rekomendasiKursusUntukLoker(katalog, job());
    const b = rekomendasiKursusUntukLoker(katalog, job());
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
  });
});
