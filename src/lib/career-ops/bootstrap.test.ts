import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cariSeedPortals } from "./bootstrap";

/** A real file at a real path, so existsSync is meaningful. */
function seedFile(nama: string): string {
  const p = path.join(mkdtempSync(path.join(tmpdir(), "careevo-seed-")), nama);
  fs.writeFileSync(p, "title_filter: {}\n", "utf8");
  return p;
}

/**
 * The seed is DATA, and a bad one can cost a whole market quietly. A missing or
 * unparseable portals.yml is loud — an `Error:` line and exit 1
 * (engine/scan.mjs:3296-3299 and :3301-3307) — but two shapes are not. YAML
 * that parses to a non-object is replaced by `{}` (engine/scan.mjs:3308), so
 * both lists normalise to [], and a well-formed config whose entries are all
 * `enabled: false` is skipped entry by entry (engine/scan.mjs:3354). Both exit
 * 0 behind a summary that reads exactly like a correct scan which matched
 * nothing.
 *
 * So the fallback is not defensive noise; it is the thing that keeps a typo in
 * the Careevo config from becoming another invisible zero.
 *
 * Temp files, not the real tree: the Careevo config does not exist until Task 3,
 * and this test must pass before and after it does.
 */
describe("cariSeedPortals", () => {
  it("prefers the first candidate when both exist", () => {
    const careevo = seedFile("portals-careevo.yml");
    const engine = seedFile("portals.example.yml");
    expect(cariSeedPortals([careevo, engine])).toBe(careevo);
  });

  it("falls back to the engine template when the Careevo config is absent", () => {
    const engine = seedFile("portals.example.yml");
    expect(cariSeedPortals([path.join(tmpdir(), "tidak-ada.yml"), engine])).toBe(
      engine,
    );
  });

  it("returns null when no seed exists at all", () => {
    expect(cariSeedPortals([path.join(tmpdir(), "tidak-ada-1.yml")])).toBeNull();
  });
});
