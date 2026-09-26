import fs from "node:fs";
import path from "node:path";
import { dataRoot } from "./data-root";
import {
  lepasNomorLaporan,
  mergeTracker,
  pesanNomorLaporan,
} from "./tracker";
import type { JobFixture } from "@/lib/fixtures";
import type { HasilEvaluasi } from "@/lib/agents/evaluasi/skema";

/**
 * report.ts — A–H evaluation report persistence, following career-ops'
 * canonical report + tracker-addition flow (modes/id/lowongan.md § Pasca-
 * evaluasi, and AGENTS.md "TSV Format for Tracker Additions").
 *
 * One evaluation produces exactly two artifacts:
 *   1. reports/{NNN}-{company-slug}-{YYYY-MM-DD}.md — the full A–H report, with
 *      the JD archived verbatim and a `## Machine Summary` YAML fence (the
 *      fields downstream scripts such as salary-gap.mjs read).
 *   2. batch/tracker-additions/{NNN}-{company-slug}.tsv — a header + one data
 *      row, merged into data/applications.md by `merge-tracker.mjs`.
 *
 * The number is RESERVED through the engine's atomic allocator before the
 * report file exists, and released afterwards (the reservation sentinel must
 * not linger — the allocator treats stale sentinels as occupied). Writing the
 * report before reserving would re-create the #749 race ("compute max+1
 * yourself") that the allocator exists to prevent.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: modes/id/lowongan.md § Pasca-evaluasi, AGENTS.md "TSV Format for
 * Tracker Additions", and templates/report.md.
 * https://github.com/career-ops-hq/career-ops
 */

/** Lowercase, hyphenated, filesystem-safe company slug — same rule as upstream. */
export function slugPerusahaan(company: string): string {
  return company
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tanggalHariIni(): string {
  // Local date in the user's timezone, matching the engine's `localToday()`.
  return new Date().toLocaleDateString("en-CA");
}

/** Block G legitimacy tier, derived from the Sentinel verdict (rule-based Block G). */
function tierLegitimasi(job: JobFixture): "High Confidence" | "Proceed with Caution" | "Suspicious" {
  if (job.sentinel_status === "clean") return "High Confidence";
  if (job.sentinel_status === "rejected") return "Suspicious";
  return "Proceed with Caution";
}

function keputusan(hasil: HasilEvaluasi): "Apply" | "Consider" | "Research first" | "Skip" {
  if (hasil.skor_global >= 4.5) return "Apply";
  if (hasil.skor_global >= 4.0) return "Apply";
  if (hasil.skor_global >= 3.5) return "Consider";
  return "Skip";
}

function yamlKutip(teks: string): string {
  return JSON.stringify(teks ?? "");
}

/**
 * Render the report markdown. The section headings and Machine Summary keys are
 * upstream's, kept exact: `check-jd-archive.mjs` matches the archive heading by
 * its literal `## Job Description` prefix, and downstream scripts parse the YAML
 * keys — a translated heading or renamed key reports a real report as missing.
 */
export function renderLaporan(job: JobFixture, hasil: HasilEvaluasi): string {
  const dimensi = hasil.dimensi;
  const barisB: string[] = [];
  for (const row of hasil.kecocokan) {
    const bukti = row.bukti ? `✅ ${row.bukti}` : "❌";
    const gap = row.gap || "—";
    barisB.push(`| ${row.syarat} | ${row.bobot} | ${bukti} | ${gap} |`);
  }
  const personalisasi = hasil.personalisasi.map((p) => `- ${p}`).join("\n");
  const wawancara = hasil.wawancara.map((w) => `- ${w}`).join("\n");

  const machine = [
    `company: ${yamlKutip(job.company)}`,
    `role: ${yamlKutip(job.title)}`,
    `score: ${hasil.skor_global.toFixed(1)}`,
    `legitimacy_tier: ${yamlKutip(tierLegitimasi(job))}`,
    `archetype: ${yamlKutip(hasil.arketipe)}`,
    `final_decision: ${yamlKutip(keputusan(hasil))}`,
    `hard_stops:`,
    ...(dimensi.red_flag < 3 ? ["  - red_flag_score_below_3"] : ["  - none"]),
    `soft_gaps:`,
    ...(hasil.kecocokan.filter((r) => r.gap).length
      ? hasil.kecocokan.filter((r) => r.gap).slice(0, 8).map((r) => `  - ${yamlKutip(r.gap)}`)
      : ["  - none"]),
    `top_strengths:`,
    ...(hasil.kecocokan.filter((r) => r.bukti).length
      ? hasil.kecocokan.filter((r) => r.bukti).slice(0, 3).map((r) => `  - ${yamlKutip(r.bukti)}`)
      : ["  - none"]),
    `risk_level: ${yamlKutip(dimensi.red_flag >= 4 ? "Low" : dimensi.red_flag >= 2.5 ? "Medium" : "High")}`,
    `confidence: ${yamlKutip("Medium")}`,
    `next_action: ${yamlKutip(hasil.rekomendasi)}`,
    `work_auth: ${yamlKutip("not_needed")}`,
    `discard_reasons:`,
    ...(keputusan(hasil) === "Skip" || keputusan(hasil) === "Consider"
      ? [`  - ${yamlKutip(hasil.rekomendasi)}`]
      : ["  - none"]),
    `via: ${yamlKutip(job.source)}`,
    `company_confidential: false`,
    `advertised_comp: ${job.salary_range ? yamlKutip(job.salary_range) : "null"}`,
    `reports_to: null`,
    `requirement_importance:`,
    ...hasil.kecocokan.map((r) => [
      `  - requirement: ${yamlKutip(r.syarat)}`,
      `    jd_signal: null`,
      `    evidence: inferred`,
      `    importance: ${r.bobot === "tinggi" ? "high" : r.bobot === "rendah" ? "low_signal" : "meaningful"}`,
      `    match: ${r.bukti ? "strong" : r.gap ? "partial" : "missing"}`,
    ]).flat(),
    `risk_summary:`,
    `  legitimacy: ${yamlKutip(tierLegitimasi(job).toLowerCase().replace(/ /g, "_"))}`,
    `  classification: ${yamlKutip(job.sentinel_status === "clean" ? "clear" : "flagged")}`,
    `  culture: ${yamlKutip("not_evaluated")}`,
    `  interview_redflags: ${yamlKutip("not_evaluated")}`,
    `  ai_infra: ${yamlKutip("not_evaluated")}`,
    `  ai_screening_disclosure: ${yamlKutip("no_match")}`,
  ].join("\n");

  const barisKecocokan =
    barisB.length > 0
      ? `| Syarat | Bobot | Bukti | Gap |\n|---|---|---|---|\n${barisB.join("\n")}`
      : "_(tidak ada syarat yang bisa dipetakan)_";

  return `# Evaluation: ${job.company} — ${job.title}

**Tanggal:** ${tanggalHariIni()}
**Arketipe:** ${hasil.arketipe}
**Score:** ${hasil.skor_global.toFixed(1)}/5
**Legitimacy:** ${tierLegitimasi(job)}
**URL:** ${job.apply_url ?? "tidak ada"}
**PDF:** tidak dibuat — jalankan mode pdf untuk membuat sesuai permintaan

---

## Job Description (archived verbatim)

${job.description}

---

## Machine Summary

\`\`\`yaml
${machine}
\`\`\`

---

## A) Ringkasan role

${hasil.ringkasan}

## B) Kecocokan dengan CV

${barisKecocokan}

## C) Level dan strategi

${hasil.level || "—"}

## D) Kompensasi dan permintaan

${hasil.kompensasi || "—"}

## E) Rencana personalisasi

${personalisasi || "—"}

## F) Rencana wawancara

${wawancara || "—"}

## G) Posting Legitimacy

Sentinel audit (rule-based): **${job.sentinel_status}** — trust score ${job.trust_score}/100.
${job.flags.length ? job.flags.map((f) => `- ${f}`).join("\n") : "- Tidak ada sinyal terdeteksi."}

## H) Rekomendasi

${hasil.rekomendasi || "—"}
`;
}

export interface HasilSimpanLaporan {
  ok: boolean;
  /** Report number (NNN), when saved. */
  nomor?: number;
  /** Report path relative to the data root. */
  reportPath?: string;
  pesan: string;
}

/**
 * Persist an evaluation as a numbered report + tracker TSV, then merge.
 *
 * Failure policy mirrors the evaluation panel's: persistence problems must not
 * masquerade as success, and a partially-written report is cleaned up (number
 * released) so the allocator never re-issues a number whose report is missing.
 */
export async function simpanEvaluasi(
  job: JobFixture,
  hasil: HasilEvaluasi,
): Promise<HasilSimpanLaporan> {
  const root = dataRoot();
  const slug = slugPerusahaan(job.company);
  const tanggal = tanggalHariIni();

  const nomor = (await pesanNomorLaporan(1))[0];
  if (!nomor) {
    return { ok: false, pesan: "Gagal memesan nomor laporan (allocator tidak tersedia)." };
  }
  const padded = String(nomor).padStart(3, "0");
  const namaDasar = `${padded}-${slug}-${tanggal}`;

  try {
    const reportsDir = path.join(root, "reports");
    fs.mkdirSync(reportsDir, { recursive: true });

    const reportPath = path.join(reportsDir, `${namaDasar}.md`);
    fs.writeFileSync(reportPath, renderLaporan(job, hasil), "utf8");

    // TSV addition: header row of column labels, then exactly one data row.
    // The header is REQUIRED (#3517) — merge-tracker resolves fields by NAME.
    const additionsDir = path.join(root, "batch", "tracker-additions");
    fs.mkdirSync(additionsDir, { recursive: true });
    const score = `${hasil.skor_global.toFixed(1)}/5`;
    const link = `[${nomor}](reports/${namaDasar}.md)`;
    const tsvPath = path.join(additionsDir, `${namaDasar}.tsv`);
    const tsv = [
      "num\tdate\tcompany\trole\tstatus\tscore\tpdf\treport\tnotes\tvia\turl",
      [
        nomor,
        tanggal,
        job.company,
        job.title,
        "Evaluated",
        score,
        "❌",
        link,
        "",
        job.source,
        job.apply_url ?? "",
      ].join("\t"),
    ].join("\n");
    fs.writeFileSync(tsvPath, tsv + "\n", "utf8");

    const merged = await mergeTracker();
    if (!merged.ok) {
      // The TSV stays in batch/tracker-additions for a retry; report is already
      // on disk, so the number is correctly occupied. Do NOT release it.
      return {
        ok: false,
        nomor,
        reportPath: path.relative(root, reportPath),
        pesan: `Laporan tersimpan, tetapi merge tracker gagal: ${merged.stderr || "tanpa pesan"}`,
      };
    }

    await lepasNomorLaporan([nomor]);
    return {
      ok: true,
      nomor,
      reportPath: path.relative(root, reportPath),
      pesan: `Laporan tersimpan dan tracker diperbarui.`,
    };
  } catch (err) {
    await lepasNomorLaporan([nomor]);
    return {
      ok: false,
      pesan: `Gagal menyimpan laporan: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
