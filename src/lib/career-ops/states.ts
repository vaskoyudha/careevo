import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { engineRoot } from "./data-root";

/**
 * states.ts — the canonical application states, read from the engine's own
 * `templates/states.yml`.
 *
 * That YAML file is the single source of truth for career-ops (writer) and
 * dashboard (reader). Careevo reads the SAME file instead of transcribing the
 * states into TypeScript, so the two halves cannot drift: a state added in the
 * engine becomes visible here with no code change. The list is loaded lazily and
 * cached — the file is static source, not runtime data.
 */

export interface StatusKanonisState {
  id: string;
  label: string;
  aliases: string[];
  description: string;
  dashboard_group: string;
  /** Terminal states have no further one-way lifecycle order. */
  terminal: boolean;
}

let cache: StatusKanonisState[] | null = null;

function muatStates(): StatusKanonisState[] {
  if (cache) return cache;
  const file = path.join(engineRoot(), "templates", "states.yml");
  const raw = yaml.load(fs.readFileSync(file, "utf8")) as {
    states?: Array<Record<string, unknown>>;
  };
  const states = (raw.states ?? []).map((s) => ({
    id: String(s.id ?? ""),
    label: String(s.label ?? ""),
    aliases: Array.isArray(s.aliases) ? s.aliases.map(String) : [],
    description: String(s.description ?? ""),
    dashboard_group: String(s.dashboard_group ?? ""),
    terminal: Boolean(s.terminal),
  }));
  cache = states;
  return states;
}

/** All canonical states, in their declared lifecycle order. */
export function daftarStatusKanonis(): StatusKanonisState[] {
  return muatStates();
}

/** Canonical states in lifecycle order (non-terminal first, then terminal). */
export function urutanLifecycle(): StatusKanonisState[] {
  const states = muatStates();
  return [...states].sort((a, b) => Number(a.terminal) - Number(b.terminal));
}

/**
 * Resolve any status spelling (a canonical label or an alias, case-insensitive)
 * to the canonical label, or null when unrecognized — same contract as the
 * engine's `resolveCanonicalState`.
 */
export function statusKanonis(label: string): StatusKanonisState | null {
  const target = label.trim().toLowerCase();
  for (const state of muatStates()) {
    if (state.label.toLowerCase() === target) return state;
    if (state.aliases.some((alias) => alias.toLowerCase() === target)) return state;
  }
  return null;
}
