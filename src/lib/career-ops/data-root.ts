import path from "node:path";

/**
 * data-root.ts — where the vendored career-ops engine reads and writes its
 * canonical files.
 *
 * The engine (engine/*.mjs) is a faithful, byte-identical copy of career-ops.
 * It resolves its data root through its own `path-resolver.mjs`, in this order:
 *   CAREER_OPS_ROOT / CAREER_OPS_DATA_DIR env
 *   → .career-ops-data marker file (in engine/)
 *   → engine/ itself.
 *
 * Careevo must never let the engine write user data into `engine/` (it is
 * vendored source). This helper is the ONE place that computes the data root;
 * every spawn below sets `CAREER_OPS_ROOT` to it explicitly, which the engine
 * honours above all other resolutions. Two copies of "where does the data live"
 * would be two definitions free to drift — the same reason the engine itself
 * centralises the rule in path-resolver.mjs.
 */

/** The vendored engine directory, source-controlled, never written to. */
export function engineRoot(): string {
  return path.join(process.cwd(), "engine");
}

/**
 * The canonical career-ops data root inside Careevo's gitignored runtime data.
 * Mirrors the engine's own layout: data/applications.md, reports/, jds/,
 * batch/tracker-additions/, portals.yml, config/profile.yml.
 */
export function dataRoot(): string {
  const override = process.env.CAREER_OPS_ROOT ?? process.env.CAREER_OPS_DATA_DIR;
  if (override && override.trim()) {
    // The engine resolves relative env values against ITS OWN directory; we
    // resolve against process.cwd() so the meaning stays "Careevo project".
    return path.resolve(process.cwd(), override.trim());
  }
  return path.join(process.cwd(), ".data", "career-ops");
}
