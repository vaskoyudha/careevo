import path from "node:path";
import { spawn } from "node:child_process";
import { engineRoot, dataRoot } from "./data-root";

/**
 * execEngine.ts — the single spawn boundary between Careevo and the vendored
 * career-ops engine.
 *
 * The engine is orchestrated, never reimplemented: every write to the canonical
 * files goes through `node engine/<script>.mjs`, the same way career-ops' own
 * `web/` app drives its core scripts. Reimplementing a rule here would be the
 * second implementation that silently drifts from the engine — the exact
 * failure career-ops' web/AGENTS.md warns about.
 *
 * Contract, identical to the engine's CLI contract:
 *   - stdout is reserved for the machine-readable result (`--json`),
 *   - stderr carries progress/human logs,
 *   - exit code 0 = success, non-zero = failure (stderr holds the reason).
 */

export interface HasilEksekusi {
  ok: boolean;
  /** Parsed stdout (when `--json` was requested and stdout was valid JSON). */
  data?: unknown;
  /** Raw stdout. */
  stdout: string;
  /** Raw stderr, trimmed. */
  stderr: string;
  exitCode: number | null;
}

export interface OpsiEksekusi {
  /** Set `CAREER_OPS_ROOT`; defaults to dataRoot(). Pass null to omit. */
  root?: string | null;
  /** Environment to merge on top of process.env. */
  env?: Record<string, string>;
  /** Kill the child after this many ms (default 230_000, like upstream web). */
  timeoutMs?: number;
}

const TIMEOUT_BAWAAN = 230_000;

export function runEngine(
  script: string,
  args: string[] = [],
  options: OpsiEksekusi = {},
): Promise<HasilEksekusi> {
  const engine = engineRoot();
  const root = options.root === null ? undefined : (options.root ?? dataRoot());
  // dataRoot() already honours process.env.CAREER_OPS_ROOT, so `root` is the
  // authoritative data dir whatever the source. Order matters: process.env as
  // the base, pinned paths over it, explicit options.env last as the final say.
  //
  // CAREER_OPS_TRACKER is pinned alongside CAREER_OPS_ROOT because set-status.mjs
  // resolves its tracker from its own script directory and only honours the
  // explicit tracker override — unlike tracker.mjs / merge-tracker.mjs, which
  // honour CAREER_OPS_ROOT. Pinning both keeps every script on the same
  // canonical tracker file (and therefore the same lock directory).
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(root ? { CAREER_OPS_ROOT: root } : {}),
    ...(root ? { CAREER_OPS_TRACKER: path.join(root, "data", "applications.md") } : {}),
    ...options.env,
  };

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(engine, script), ...args], {
      cwd: engine,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
    }, options.timeoutMs ?? TIMEOUT_BAWAAN);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on("error", (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        stdout,
        stderr: (stderr + String(err.message)).trim(),
        exitCode: null,
      });
    });

    child.on("close", (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const trimmed = stdout.trim();
      let data: unknown;
      if (trimmed) {
        try {
          data = JSON.parse(trimmed);
        } catch {
          // Not JSON — callers decide whether that is fatal.
        }
      }
      resolve({ ok: code === 0, data, stdout, stderr: stderr.trim(), exitCode: code });
    });
  });
}

/** Run an engine script whose output is expected to be a JSON value. */
export async function runEngineJson(
  script: string,
  args: string[] = [],
  options: OpsiEksekusi = {},
): Promise<{ ok: boolean; data?: unknown; stderr: string; exitCode: number | null }> {
  const result = await runEngine(script, args, options);
  return {
    ok: result.ok,
    data: result.data,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}
