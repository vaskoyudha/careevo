import type { EntriKatalog } from "@/lib/courses/katalog";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { KnowledgePoint, KnowledgeType } from "./types";

/**
 * Derive a mastery topic's knowledge points from a course's modules.
 *
 * This is DeepTutor's "outline" step done **deterministically**. Upstream runs
 * an LLM over the learner's sources to propose a topic tree; here the tree is
 * read straight off the course the learner is already enrolled in, because the
 * modules *are* the outline. The result is the same shape the LLM path
 * produces, so swapping in a real generator later is a drop-in change.
 *
 * Why this matters: a mastery path is the one surface that must work with no
 * API key. Mastery math and the review schedule are deterministic, so the
 * entire loop — tree, progress, due queue — is real today.
 */

/** Stable, readable ids so a point keeps its history across regenerations. */
function pointId(moduleId: string, index: number): string {
  return `${moduleId}::kp${index + 1}`;
}

/**
 * A module becomes `concept` or `procedure` depending on what it teaches.
 *
 * The heuristic is deliberately coarse and legible rather than clever: a
 * module whose title names a thing to *use* ("Membangun", "Menggunakan",
 * "Menerapkan") is a procedure and gets a shorter, more frequent schedule;
 * everything else is a concept. Guessing wrong costs a slightly wrong review
 * interval, which is recoverable, whereas a wrong *label* shown to the
 * learner ("you have mastered this") is not.
 */
function inferKnowledgeType(title: string, ringkasan: string): KnowledgeType {
  const haystack = `${title} ${ringkasan}`.toLowerCase();
  const procedureSignals = [
    "membangun", "membuat", "menggunakan", "menerapkan", "menjalankan",
    "praktik", "latihan", "menyusun", "merancang", "implementasi", "setup",
    "konfigurasi", "deploy", "menguji",
  ];
  return procedureSignals.some((signal) => haystack.includes(signal))
    ? "procedure"
    : "concept";
}

/**
 * How many knowledge points a module contributes.
 *
 * One per module would make a five-module course a five-point path — too thin
 * to feel like mastery tracking. Three splits a module into "what it is", "how
 * it works", "how to do it" without inventing content, and the count scales
 * with the summary so a substantial module earns a deeper point set.
 */
// Named `modul`, not `module`: the Next.js lint rule forbids binding a
// variable called `module` (it shadows the CommonJS global).
function pointsPerModule(modul: ModulKursus): number {
  const material = modul.ringkasan.trim().length;
  if (material >= 220) return 3;
  if (material >= 100) return 2;
  return 1;
}

const POINT_ROLES = [
  { suffix: "konsep", label: "Konsep" },
  { suffix: "mekanisme", label: "Cara kerja" },
  { suffix: "praktik", label: "Praktik" },
] as const;

/**
 * Build the knowledge points for a course's modules.
 *
 * Deterministic and order-stable: the same modules always produce the same ids
 * in the same order, so a learner's attempt history stays attached to the
 * point it was recorded against.
 */
export function turunkanPoinPenguasaan(modules: readonly ModulKursus[]): KnowledgePoint[] {
  const points: KnowledgePoint[] = [];
  for (const modul of modules) {
    const type = inferKnowledgeType(modul.judul, modul.ringkasan);
    const count = pointsPerModule(modul);
    for (let index = 0; index < count; index += 1) {
      const role = POINT_ROLES[index] ?? POINT_ROLES[0];
      points.push({
        id: pointId(modul.id, index),
        name: count === 1 ? modul.judul : `${modul.judul} · ${role.label.toLowerCase()}`,
        type,
        moduleId: modul.id,
      });
    }
  }
  return points;
}

/** The default topic title for a course, used when none is supplied. */
export function judulTopikDefault(course: EntriKatalog): string {
  return `Kuasai ${course.title}`;
}

export function deskripsiTopikDefault(course: EntriKatalog): string {
  return `Jalur penguasaan disusun dari ${course.title} (${course.provider}). Selesaikan tiap poin, lalu ulangi poin yang sudah lewat jadwal tinjauan.`;
}
