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

  it("credits a MULTI-WORD course tag the posting mentions", () => {
    // Regression: `teksJob` holds single tokens, so a tag like "Machine
    // Learning" could never be found in it and the +8 was dead code. That is
    // how "Machine Learning Engineer" came to rank a Git course first.
    const ml = entry({ id: "ml", slug: "machine-learning", title: "Machine Learning", tags: ["Machine Learning"] });
    const generic = entry({ id: "gen", slug: "git", title: "Git", tags: ["Engineer"] });
    const lowongan = job({
      title: "Machine Learning Engineer",
      description: "",
      tags: [],
    });
    expect(skorKursusUntukLoker(ml, lowongan)).toBeGreaterThan(
      skorKursusUntukLoker(generic, lowongan),
    );
  });

  it("does not credit a multi-word tag when only one of its words appears", () => {
    // "Learning" alone must not unlock "Machine Learning": that is how an
    // unrelated course would buy relevance with one common word. The job has no
    // level, so the level tiebreak is silent and cannot mask the tag rule.
    const ml = entry({ id: "ml", slug: "machine-learning", title: "Machine Learning", tags: ["Machine Learning"] });
    const lowongan = job({ title: "Learning Something Else", description: "", tags: [], level: undefined as never });
    const denganTagLain = entry({ id: "x", slug: "machine-learning", title: "Machine Learning", tags: ["Kubernetes"] });
    expect(skorKursusUntukLoker(ml, lowongan)).toBe(skorKursusUntukLoker(denganTagLain, lowongan));
  });

  it("ignores the level tiebreak when the posting has no level", () => {
    // Every scanned inbox row has no level. `indexOf(undefined)` is -1, not 0, so
    // the unguarded version paid a phantom bonus computed against a rung that
    // does not exist, and made inbox scores incomparable with /loker/[id].
    const dasar = entry({ id: "a", level: "dasar" });
    const lanjut = entry({ id: "b", level: "lanjut" });
    const tanpaLevel = { ...job(), level: undefined as never };
    expect(skorKursusUntukLoker(dasar, tanpaLevel)).toBe(
      skorKursusUntukLoker(lanjut, tanpaLevel),
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
