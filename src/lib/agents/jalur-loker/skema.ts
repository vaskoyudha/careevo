import { KNOWLEDGE_TYPES, type KnowledgeType } from "@/lib/mastery/types";

/**
 * The shape of a job-sourced mastery path, and the boundary that decides
 * whether a model's answer may be shown to a learner.
 *
 * The failure direction that matters is reject, never coerce. A path with an
 * unknown point type would schedule reviews on an interval nobody chose, and it
 * would look like a considered plan while being wrong — so anything not in
 * `KNOWLEDGE_TYPES` is an error, not a default.
 */
export interface PoinJalurLoker {
  name: string;
  type: KnowledgeType;
}

export interface HasilJalurLoker {
  title: string;
  description: string;
  points: PoinJalurLoker[];
}

/**
 * Below 3, a path is too thin to be worth tracking as mastery. Above 12, the
 * review queue stops being a daily task and becomes a syllabus nobody finishes.
 */
export const MIN_POIN = 3;
export const MAX_POIN = 12;

export const SKEMA_JALUR = `{
  "title": "<judul jalur, mis. 'Kuasai kebutuhan Frontend Engineer'>",
  "description": "<1-2 kalimat kenapa jalur ini disusun dari lowongan ini>",
  "points": [
    { "name": "<satu kemampuan yang bisa diuji>", "type": "concept|procedure|memory|design" }
  ]
}`;

const teks = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export function validasiJalurLoker(raw: unknown): HasilJalurLoker {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Hasil jalur bukan objek");
  }
  const obj = raw as Record<string, unknown>;

  const title = teks(obj.title);
  if (!title) throw new Error("title wajib ada");

  const description = teks(obj.description);

  if (!Array.isArray(obj.points)) throw new Error("points wajib berupa array");
  const points: PoinJalurLoker[] = [];
  for (const row of obj.points) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = teks(r.name);
    if (!name) throw new Error("setiap poin butuh name");
    const type = teks(r.type) as KnowledgeType;
    if (!(KNOWLEDGE_TYPES as readonly string[]).includes(type)) {
      throw new Error(`type poin tidak dikenal: ${String(r.type)}`);
    }
    points.push({ name, type });
  }

  if (points.length < MIN_POIN || points.length > MAX_POIN) {
    throw new Error(`points harus ${MIN_POIN}-${MAX_POIN} poin, dapat ${points.length}`);
  }

  return { title, description, points };
}
