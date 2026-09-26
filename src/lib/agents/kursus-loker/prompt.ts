import type { EntriKatalog } from "@/lib/courses/katalog";
import type { JobFixture } from "@/lib/fixtures";
import { SKEMA_ALASAN } from "./skema";

/**
 * Explain an existing shortlist, never re-pick it.
 *
 * The courses are already chosen by `skorKursusUntukLoker`. The prompt says so
 * explicitly because a model asked to "recommend courses" will happily return
 * something else, and a course nobody ranked is a recommendation the app did
 * not make.
 */
export function bangunPromptAlasan(job: JobFixture, shortlist: EntriKatalog[]): string {
  const daftar = shortlist
    .map(
      (entry) =>
        `- id: ${entry.id}\n  judul: ${entry.title}\n  tag: ${entry.tags.join(", ")}`,
    )
    .join("\n");

  return `Kamu menjelaskan kenapa beberapa kursus cocok dengan satu lowongan.

Kursus sudah dipilih secara deterministik. Tugasmu HANYA menulis alasan —
jangan memilih kursus lain, jangan menukar urutan, jangan menilai ulang.

## Aturan

1. Tulis alasan SPESIFIK: sebut skill atau syarat dari lowongan yang diajarkan
   kursus itu. Satu kalimat, bahasa Indonesia.
2. Jangan mengarang isi kursus; pakai hanya judul dan tag yang diberikan.
3. Isi "id" persis seperti tertulis di daftar, tanpa mengubahnya.
4. Kalau sebuah kursus benar-benar tidak cocok, boleh tulis alasan singkat
   honestly; lebih baik jujur daripada memaksa.

## Lowongan

Judul: ${job.title}
Perusahaan: ${job.company}
Skill yang diminta: ${job.tags.join(", ") || "-"}

Deskripsi:
${job.description}

## Kursus yang sudah dipilih

${daftar}

## Format keluaran

Balas HANYA dengan satu objek JSON, tanpa penjelasan tambahan:

${SKEMA_ALASAN}

Jangan panggil tool apa pun. Balas langsung dengan objek JSON-nya.`;
}
