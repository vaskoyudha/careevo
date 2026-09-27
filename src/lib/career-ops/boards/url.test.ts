import { describe, expect, it } from "vitest";
import { applyUrlOffPlatform, hostDari } from "./url";

describe("hostDari", () => {
  it("lowercases the hostname", () => {
    expect(hostDari("https://Apply.Workable.com/j/X")).toBe("apply.workable.com");
  });

  it("returns an empty string for an unparseable url", () => {
    expect(hostDari("not a url")).toBe("");
  });
});

describe("applyUrlOffPlatform", () => {
  const posting = "https://kredivo-group.breezy.hr/p/abc-engineer";

  it("keeps the posting url when the candidate is absent", () => {
    expect(applyUrlOffPlatform(null, posting)).toBe(posting);
    expect(applyUrlOffPlatform("  ", posting)).toBe(posting);
  });

  it("keeps the posting url when the candidate is on the same board host", () => {
    expect(applyUrlOffPlatform("https://kredivo-group.breezy.hr/p/abc", posting)).toBe(posting);
    expect(applyUrlOffPlatform("https://jobs.smartrecruiters.com/GudangAda/1", posting)).toBe(posting);
  });

  it("returns the off-platform url — the one signal worth judging", () => {
    expect(applyUrlOffPlatform("https://bit.ly/2yX06A9", posting)).toBe("https://bit.ly/2yX06A9");
    expect(applyUrlOffPlatform("https://careers.acme.co.id/apply/1", posting)).toBe(
      "https://careers.acme.co.id/apply/1",
    );
  });

  it("falls back to the posting url for a non-http scheme", () => {
    expect(applyUrlOffPlatform("mailto:hr@acme.co.id", posting)).toBe(posting);
  });

  it("falls back to the posting url for an unparseable candidate", () => {
    expect(applyUrlOffPlatform(":::", posting)).toBe(posting);
  });
});
