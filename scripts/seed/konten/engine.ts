/**
 * Engine seed konten kursus — idempoten, satu jalur untuk seluruh katalog.
 *
 * Pakai: `npx tsx scripts/seed/konten/index.ts`
 *
 * ## Sifat yang dikunci
 *
 * - **Idempoten lewat pencocokan, bukan "buat lalu lupakan".** Kursus dicocokkan
 *   dari slug, modul dari judul, halaman dari judul, kuis dari judul yang
 *   terpasang di modul. Menjalankan skrip berkali-kali aman: isi yang ada
 *   diperbarui, bukan digandakan.
 * - **Tidak pernah menghapus.** Berbeda dari seed C++ yang membuang modul/halaman
 *   di luar seed, engine ini hanya menambah dan memperbarui. Alasannya: ia
 *   dipakai untuk **melengkapi** kursus yang sudah punya halaman kurasi (18
 *   kursus pasar) tanpa menimpanya.
 * - **Halaman absen = tidak disentuh.** Kursus yang hanya perlu dilengkapi kuis
 *   mengosongkan `halaman` di seed-nya, sehingga halaman kurasi tetap utuh.
 * - **Id blok stabil.** Diberi prefiks `${slug}-m{n}-h{n}-b{n}` supaya tautan
 *   `#anchor` tidak putus saat skrip diulang — sama seperti seed C++.
 */

import {
  createCourse,
  createHalaman,
  createKuis,
  createModul,
  getCourseBySlug,
  listHalaman,
  listKuis,
  listModul,
  pasangKuis,
  updateCourse,
  updateHalaman,
  updateKuis,
  updateModul,
} from "@/lib/courses/store";
import type { BlokInput } from "@/types/course";
import type { KursusSeed, ModulSeed } from "./tipen";

/** Beri id blok yang stabil supaya tautan `#anchor` tidak putus saat skrip diulang. */
function beriId(blok: BlokInput[], prefiks: string): BlokInput[] {
  return blok.map((item, index) => ({ ...item, id: `${prefiks}-b${index}` }));
}

/** Nomori ulang halaman agar tidak ada celah nomor setelah upsert. */
async function selaraskanModul(kursusId: string, slug: string, indexModul: number, seed: ModulSeed) {
  const ada = await listModul(kursusId);
  const posisi = ada.findIndex((m) => m.judul === seed.judul);

  const modul =
    posisi === -1
      ? await createModul(kursusId, {
          judul: seed.judul,
          ringkasan: seed.ringkasan,
          durasi_min: seed.durasi_min,
        })
      : await updateModul(kursusId, ada[posisi].id, {
          judul: seed.judul,
          ringkasan: seed.ringkasan,
          durasi_min: seed.durasi_min,
        });

  if (!modul) throw new Error(`modul gagal diselaraskan: ${slug} / ${seed.judul}`);

  // Halaman: hanya disentuh bila seed benar-benar membawanya.
  if (seed.halaman) {
    const halamanAda = await listHalaman(kursusId, modul.id);
    for (const [indexHalaman, seedHalaman] of seed.halaman.entries()) {
      const prefiks = `${slug}-m${indexModul + 1}-h${indexHalaman + 1}`;
      const isi = {
        judul: seedHalaman.judul,
        blok: beriId(seedHalaman.blok, prefiks),
      };
      const lama = halamanAda.find((h) => h.judul === seedHalaman.judul);
      const hasil = lama
        ? await updateHalaman(kursusId, modul.id, lama.id, isi)
        : await createHalaman(kursusId, modul.id, isi);
      if (!hasil) throw new Error(`halaman gagal diselaraskan: ${prefiks}`);
    }
  }

  // Kuis: dicocokkan dari judul yang sudah terpasang di modul ini.
  if (seed.kuis) {
    const bank = await listKuis();
    const terpasang = (await listModul(kursusId)).find((m) => m.id === modul.id)?.kuis ?? [];
    const lama = bank.find((k) => terpasang.includes(k.id) && k.judul === seed.kuis!.judul);

    const isiKuis = {
      judul: seed.kuis.judul,
      deskripsi: seed.kuis.deskripsi ?? "",
      nilai_lulus: seed.kuis.nilai_lulus ?? 70,
      soal: seed.kuis.soal.map((soal, indexSoal) => ({
        id: `${slug}-m${indexModul + 1}-s${indexSoal + 1}`,
        pertanyaan: soal.pertanyaan,
        pilihan: soal.pilihan,
        jawaban_benar: soal.jawaban_benar,
      })),
    };

    if (lama) {
      await updateKuis(lama.id, isiKuis);
    } else {
      const baru = await createKuis(isiKuis);
      await pasangKuis(kursusId, modul.id, baru.id);
    }
  }
}

async function seedKursus(seed: KursusSeed): Promise<"baru" | "diperbarui"> {
  const durasi =
    seed.durasi_min ?? seed.modul.reduce((total, m) => total + m.durasi_min, 0);
  const ada = await getCourseBySlug(seed.slug);
  const induk = {
    ...(seed.id ? { id: seed.id } : {}),
    title: seed.judul,
    slug: seed.slug,
    description: seed.deskripsi,
    provider: seed.provider ?? "Careevo",
    type: "course" as const,
    track: seed.track,
    level: seed.level,
    tags: seed.tags,
    url: `/belajar/${seed.slug}`,
    duration_min: durasi,
    is_free: true,
    // Status dipertahankan bila seed tidak menyebutkannya: seed yang hanya
    // melengkapi konten tidak boleh mempublikasikan kursus yang masih `draft`.
    status: seed.status ?? ada?.status ?? "published",
  };

  const kursus = ada ? await updateCourse(ada.id, induk) : await createCourse(induk);
  if (!kursus) throw new Error(`kursus gagal dibuat: ${seed.slug}`);

  for (const [indexModul, modul] of seed.modul.entries()) {
    await selaraskanModul(kursus.id, seed.slug, indexModul, modul);
  }

  return ada ? "diperbarui" : "baru";
}

export async function jalankanSeed(daftar: KursusSeed[]) {
  let baru = 0;
  let diperbarui = 0;
  let modul = 0;
  let halaman = 0;
  let kuis = 0;

  for (const seed of daftar) {
    const hasil = await seedKursus(seed);
    if (hasil === "baru") baru += 1;
    else diperbarui += 1;

    modul += seed.modul.length;
    halaman += seed.modul.reduce((total, m) => total + (m.halaman?.length ?? 0), 0);
    kuis += seed.modul.filter((m) => m.kuis).length;

    console.log(`  ${hasil === "baru" ? "+" : "~"} ${seed.judul}`);
  }

  console.log(
    `\nkursus: ${baru} baru, ${diperbarui} diperbarui · ` +
      `modul: ${modul} · halaman di-seed: ${halaman} · kuis: ${kuis}`,
  );
}
