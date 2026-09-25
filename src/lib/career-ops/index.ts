/**
 * index.ts — the Careevo ⇄ career-ops adaptation layer.
 *
 * This directory is the ONLY place Careevo touches the vendored engine
 * (`engine/`). Every rule lives in the engine and is orchestrated from here via
 * child processes — the same architecture career-ops' own `web/` app uses, and
 * the one its web/AGENTS.md mandates: "Orchestrate the core; never reimplement
 * it."
 *
 * Canonical files live under `.data/career-ops/` (gitignored), never under
 * `engine/` (vendored source).
 */
export * from "./types";
export { bootstrapCareerOps } from "./bootstrap";
export { dataRoot, engineRoot } from "./data-root";
export {
  daftarStatusKanonis,
  urutanLifecycle,
  statusKanonis,
  type StatusKanonisState,
} from "./states";
export {
  jalankanScan,
  bacaTracker,
  ubahStatus,
  mergeTracker,
  normalisasiStatus,
  pesanNomorLaporan,
  lepasNomorLaporan,
} from "./tracker";
export { normalisasiKunciUrl } from "./url-key";
export { cariBarisTracker, kunciTeks } from "./match-tracker";
export { bacaTrackerMd } from "./tracker-table";
export { parseInbox, splitLines, type InboxJobShape } from "./pipeline-table";
export {
  bacaInbox,
  bacaInboxDenganTanggal,
  bacaTanggalScan,
  type InboxJob,
} from "./inbox";
export {
  renderLaporan,
  simpanEvaluasi,
  slugPerusahaan,
  type HasilSimpanLaporan,
} from "./report";
