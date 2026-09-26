import { describe, expect, it } from "vitest";
import { bucketSalam, pilihSapaan, SAPAAN, SEMUA_BUCKET } from "./sapaan";

describe("bucketSalam", () => {
  it("maps every hour of the day to a bucket", () => {
    // The bug this pins: a three-branch chain left `malam` unreachable, so a
    // learner at 23:00 was told "Selamat sore." The invariant is the property —
    // all 24 hours resolve to a real bucket — not any particular boundary.
    for (let jam = 0; jam < 24; jam += 1) {
      expect(SEMUA_BUCKET).toContain(bucketSalam(jam));
    }
  });

  it("reaches all four buckets across a single day", () => {
    const terpakai = new Set(Array.from({ length: 24 }, (_, jam) => bucketSalam(jam)));
    expect([...terpakai].sort()).toEqual([...SEMUA_BUCKET].sort());
  });

  it("uses the documented boundaries", () => {
    expect(bucketSalam(0)).toBe("pagi");
    expect(bucketSalam(11)).toBe("pagi");
    expect(bucketSalam(12)).toBe("siang");
    expect(bucketSalam(16)).toBe("siang");
    expect(bucketSalam(17)).toBe("sore");
    expect(bucketSalam(18)).toBe("sore");
    expect(bucketSalam(19)).toBe("malam");
    expect(bucketSalam(23)).toBe("malam");
  });

  it("normalises an out-of-range hour instead of falling through", () => {
    expect(bucketSalam(24)).toBe(bucketSalam(0));
    expect(bucketSalam(-1)).toBe(bucketSalam(23));
    expect(bucketSalam(23.9)).toBe(bucketSalam(23));
  });
});

describe("pilihSapaan", () => {
  it("only ever returns a line from the chosen bucket", () => {
    for (let jam = 0; jam < 24; jam += 1) {
      for (const acak of [() => 0, () => 0.5, () => 0.999]) {
        expect(SAPAAN[bucketSalam(jam)] as readonly string[]).toContain(pilihSapaan(jam, acak));
      }
    }
  });

  it("covers the whole bucket rather than pinning the first line", () => {
    const bucket = SAPAAN[bucketSalam(23)];
    const chosen = new Set(
      bucket.map((_, i) => pilihSapaan(23, () => i / bucket.length)),
    );
    expect(chosen.size).toBe(bucket.length);
  });

  it("never greets a learner at night with a daytime greeting", () => {
    expect(pilihSapaan(23, () => 0)).toBe("Selamat malam.");
    expect(pilihSapaan(2, () => 0)).toBe("Selamat pagi.");
  });
});
