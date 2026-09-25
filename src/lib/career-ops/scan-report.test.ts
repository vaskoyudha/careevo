import { describe, expect, it } from "vitest";
// Upstream .mjs fixture, kept verbatim. It typechecks because the repo resolves
// .mjs; the assertion would be that it still PARSES identically.
import * as upstream from "./__fixtures__/pipeline-table.upstream.mjs";
import { parseInbox } from "./pipeline-table";

/**
 * The upstream .mjs is checked in byte-identical so this test can run on a clean
 * checkout with no reference clone present. If this fails, our copy has drifted
 * from the engine's own reader — which is exactly the silent divergence
 * career-ops/web/AGENTS.md warns about ("A second implementation of the same
 * rule is how the two halves start disagreeing, and the disagreement is always
 * silent").
 */
const CONTOH = [
  // 3 columns: url | company | role
  "- [ ] https://a.example/j/1 | Acme | Engineer",
  // 4 columns: + location
  "- [ ] https://a.example/j/2 | Acme | Engineer | Jakarta",
  // 5 columns: + compensation
  "- [ ] https://a.example/j/3 | Acme | Engineer | Jakarta | Rp6-8 jt",
  // labeled segments must NOT be read as location/compensation
  "- [ ] https://a.example/j/4 | Acme | Engineer | Jakarta | posted: 2026-09-18",
  "- [ ] https://a.example/j/5 | Acme | Eng | Remote | 100-200 USD | posted: 2026-09-01 | trust: 62 stale",
  // done flag
  "- [x] https://a.example/j/6 | Acme | Engineer",
  // rejected: fewer than 3 columns
  "- [ ] https://a.example/j/7 | Acme",
  // CRLF, the case the splitLines comment is about
  "- [ ] https://a.example/j/8 | Acme | Engineer\r",
  // non-checkbox lines are ignored
  "## Pending",
  "some prose",
];

describe("parseInbox parity with upstream", () => {
  it("matches the upstream parser on every documented row shape", () => {
    const ours = parseInbox(CONTOH.join("\n"));
    const theirs = (upstream as { parseInbox: (s: string) => unknown }).parseInbox(CONTOH.join("\n"));
    expect(ours).toEqual(theirs);
  });

  it("keeps location and compensation out of the labeled segments", () => {
    const row = parseInbox(
      "- [ ] https://a.example/j/5 | Acme | Eng | Remote | 100-200 USD | posted: 2026-09-01",
    )[0]!;
    expect(row.location).toBe("Remote");
    expect(row.compensation).toBe("100-200 USD");
    expect(row.postedAt).toBe("2026-09-01");
  });

  it("tolerates CRLF, which a plain split on \\n would turn into zero rows", () => {
    expect(parseInbox("- [ ] https://a.example/j/8 | Acme | Engineer\r\n")).toHaveLength(1);
  });

  it("drops rows that cannot fill url | company | role", () => {
    expect(parseInbox("- [ ] https://a.example/j/7 | Acme")).toHaveLength(0);
  });
});
