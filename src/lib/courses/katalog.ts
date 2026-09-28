import { listCourses } from "@/lib/courses/store";
import { resources, type ResourceFixture } from "@/lib/fixtures";
import type { CourseType } from "@/types/course";

/**
 * Katalog gabungan untuk alur belajar: kursus yang dipublikasikan dari
 * course store didahulukan, lalu dilengkapi fixture resource (tanpa duplikat
 * id). Draft/arsip tidak tampil ke peserta — aturan visibilitas yang sama
 * dipakai halaman daftar maupun detail.
 */
export interface EntriKatalog extends ResourceFixture {
  slug: string;
}

/**
 * Petakan tipe kursus ke tipe fixture yang dimengerti kartu katalog.
 * Total (exhaustive): menambah varian CourseType memaksa pembaruan di sini.
 *
 * Nilai yang dikembalikan (`video` / `artikel` / `course`) adalah nilai data,
 * bukan label. Untuk ditampilkan, pakai `tipeLabel` dari
 * `@/lib/onboarding/types` — modul itu client-safe, sedangkan modul ini
 * membaca course store dari disk.
 */
export function tipeKatalog(tipe: CourseType): "video" | "artikel" | "course" {
  switch (tipe) {
    case "video":
      return "video";
    case "artikel":
      return "artikel";
    case "course":
    case "bootcamp":
      return "course";
  }
}

export async function katalogBelajar(): Promise<EntriKatalog[]> {
  const terbit = await listCourses({ status: "published" });
  const dariKursus: EntriKatalog[] = terbit.map((kursus) => ({
    id: kursus.id,
    slug: kursus.slug,
    title: kursus.title,
    url: kursus.url,
    provider: kursus.provider,
    type: tipeKatalog(kursus.type),
    tags: kursus.tags,
    level: kursus.level,
    is_free: kursus.is_free,
    duration_min: kursus.duration_min,
    completed: false,
    // Diteruskan supaya kartu katalog memakai sampul unggahan admin, bukan
    // thumbnail bawaan yang dipilih lewat hash id.
    cover_image: kursus.cover_image,
  }));

  const idTerpakai = new Set(dariKursus.map((entri) => entri.id));
  const dariFixture: EntriKatalog[] = resources
    .filter((resource) => !idTerpakai.has(resource.id))
    .map((resource) => ({ ...resource, slug: resource.id }));

  return [...dariKursus, ...dariFixture];
}

export async function cariEntri(slug: string): Promise<EntriKatalog | undefined> {
  const katalog = await katalogBelajar();
  return katalog.find((entri) => entri.slug === slug);
}

/** Cari entri katalog by id (course store id atau id fixture resource). */
export async function cariEntriById(id: string): Promise<EntriKatalog | undefined> {
  const katalog = await katalogBelajar();
  return katalog.find((entri) => entri.id === id);
}
