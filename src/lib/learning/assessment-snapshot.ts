/**
 * Snapshot asesmen + penilaian — **murni**, tanpa `node:fs` dan tanpa database.
 *
 * Ini inti ADR 0003 (`docs/adr/0003-assessment-immutable-snapshot.md`): setiap
 * attempt memegang salinan definisi asesmen saat attempt dibuka, dan penilaian
 * server **hanya** membaca salinan itu — bukan `data/kuis.json` yang bisa
 * berubah atau dihapus admin setelahnya. Karena modul ini murni, aturan
 * penilaiannya bisa diuji tanpa PostgreSQL maupun bank soal.
 *
 * Yang dikunci di sini:
 *
 * - **`definitionVersion` berasal dari bentuk kanonik** (key objek terurut
 *   rekursif), bukan dari urutan key saat objek dibuat. Dua `Kuis` dengan isi
 *   sama harus menghasilkan hash yang sama walau urutan field-nya berbeda —
 *   kalau tidak, versi definisi berubah setiap kali kode penyusun objek diubah.
 * - **Skor tidak pernah datang dari klien.** Satu-satunya input penilaian
 *   adalah `selectedOption` per soal; `isCorrect` dihitung di sini terhadap
 *   kunci jawaban di snapshot.
 * - **Gagal-tertutup.** Snapshot yang tidak bisa dibaca tidak menghasilkan
 *   kelulusan: `hitungSkorSnapshot` memberi skor 0, dan `lulusSnapshot`
 *   mengembalikan `false`.
 *
 * `node:crypto` boleh diimpor (hash), tetapi `node:fs` **tidak** — modul ini
 * harus tetap aman dipanggil dari test unit ber-environment `node` tanpa
 * menyentuh disk.
 */

import { createHash } from "node:crypto";

import type { Kuis } from "@/types/course";

/**
 * Satu soal di dalam snapshot.
 *
 * `type` (bukan `interface`) supaya bentuk ini punya implicit index signature
 * dan bisa dikembalikan sebagai `Record<string, unknown>` — bentuk kolom
 * `jsonb` di repository.
 */
export type SoalSnapshot = {
  id: string;
  pertanyaan: string;
  /** Minimal 2 pilihan; indeks `jawaban_benar` menunjuk ke sini. */
  pilihan: string[];
  jawaban_benar: number;
};

/** Isi snapshot yang disimpan di `quiz_attempts.assessment_snapshot`. */
export type SnapshotKuis = {
  judul: string;
  /** Ambang lulus skala 0–100 saat attempt dibuat. */
  nilai_lulus: number;
  soal: SoalSnapshot[];
};

/** Hasil penilaian satu attempt. `perSoal` selalu selaras dengan snapshot. */
export type HasilSkorSnapshot = {
  score: number;
  perSoal: Array<{ questionId: string; isCorrect: boolean }>;
  totalSoal: number;
};

/**
 * Bentuk kanonik sebuah nilai JSON: key objek diurut secara rekursif.
 *
 * Urutan array **tidak** diubah — urutan soal dan pilihan bermakna (indeks
 * `jawaban_benar` menunjuk ke `pilihan[]`), jadi menormalkannya akan merusak
 * arti data. Yang dinormalkan hanya urutan key objek.
 */
export function kanonik(nilai: unknown): unknown {
  if (Array.isArray(nilai)) return nilai.map((item) => kanonik(item));
  if (nilai !== null && typeof nilai === "object") {
    const objek = nilai as Record<string, unknown>;
    const hasil: Record<string, unknown> = {};
    for (const key of Object.keys(objek).sort()) {
      hasil[key] = kanonik(objek[key]);
    }
    return hasil;
  }
  return nilai;
}

/** SHA-256 hex dari bentuk kanonik sebuah nilai. */
function hashKanonik(nilai: unknown): string {
  return createHash("sha256").update(JSON.stringify(kanonik(nilai)), "utf8").digest("hex");
}

/**
 * Bekukan definisi sebuah kuis menjadi snapshot + identitas versinya.
 *
 * `snapshot` sengaja hanya memuat yang dibutuhkan untuk menilai dan mengaudit
 * (`judul`, `nilai_lulus`, `soal[]`); `id`/timestamp kuis tidak ikut karena
 * bukan bagian dari definisi yang dinilai. Array `pilihan` disalin, sehingga
 * mutasi pada objek `Kuis` setelah pemanggilan tidak bisa mengubah snapshot.
 */
export function snapshotKuis(kuis: Kuis): {
  definitionVersion: string;
  snapshot: Record<string, unknown>;
} {
  const snapshot: SnapshotKuis = {
    judul: kuis.judul,
    nilai_lulus: kuis.nilai_lulus,
    soal: kuis.soal.map((soal) => ({
      id: soal.id,
      pertanyaan: soal.pertanyaan,
      pilihan: [...soal.pilihan],
      jawaban_benar: soal.jawaban_benar,
    })),
  };

  return {
    definitionVersion: hashKanonik(snapshot),
    snapshot: { ...snapshot, soal: snapshot.soal.map((s) => ({ ...s, pilihan: [...s.pilihan] })) },
  };
}

/** Baca satu soal dari nilai yang belum dipercaya. `null` bila bentuknya tidak sah. */
function bacaSoal(nilai: unknown): SoalSnapshot | null {
  if (nilai === null || typeof nilai !== "object" || Array.isArray(nilai)) return null;
  const soal = nilai as Record<string, unknown>;

  if (typeof soal.id !== "string" || soal.id.length === 0) return null;
  if (!Array.isArray(soal.pilihan) || !soal.pilihan.every((p) => typeof p === "string")) {
    return null;
  }
  if (typeof soal.jawaban_benar !== "number" || !Number.isInteger(soal.jawaban_benar)) {
    return null;
  }

  return {
    id: soal.id,
    pertanyaan: typeof soal.pertanyaan === "string" ? soal.pertanyaan : "",
    pilihan: [...(soal.pilihan as string[])],
    jawaban_benar: soal.jawaban_benar,
  };
}

/**
 * Baca snapshot dari `jsonb` menjadi bentuk bertipe.
 *
 * Satu soal yang rusak membatalkan **seluruh** snapshot (`null`), bukan dibuang
 * diam-diam: membuang soal mengubah penyebut skor, sehingga snapshot yang cacat
 * bisa menghasilkan skor yang tampak sah. Pemanggil (service) yang memutuskan
 * menolak, bukan menilai dengan data yang tidak utuh.
 *
 * `nilai_lulus` yang hilang/bukan angka menjadi `NaN`, yang membuat
 * `lulusSnapshot` mengembalikan `false` — lihat komentar di sana.
 */
export function bacaSnapshotKuis(nilai: unknown): SnapshotKuis | null {
  if (nilai === null || typeof nilai !== "object" || Array.isArray(nilai)) return null;
  const objek = nilai as Record<string, unknown>;

  if (!Array.isArray(objek.soal)) return null;
  const soal: SoalSnapshot[] = [];
  for (const item of objek.soal) {
    const dibaca = bacaSoal(item);
    if (!dibaca) return null;
    soal.push(dibaca);
  }

  const lulus = objek.nilai_lulus;
  return {
    judul: typeof objek.judul === "string" ? objek.judul : "",
    nilai_lulus:
      typeof lulus === "number" && Number.isFinite(lulus) ? lulus : Number.NaN,
    soal,
  };
}

/**
 * Nilai jawaban terhadap snapshot — **server-side, tanpa input skor dari klien**.
 *
 * Soal yang tidak dijawab tetap masuk `perSoal` dengan `isCorrect: false`
 * (penyebut `totalSoal` tidak berubah karena klien melewatkan soal). Jawaban
 * untuk `questionId` yang tidak ada di snapshot diabaikan; bila `questionId`
 * yang sama dikirim dua kali, yang pertama dipakai supaya pengiriman ganda
 * tidak bisa menggeser hasil.
 *
 * `selectedOption` di luar rentang `pilihan[]` dihitung salah, bukan dijepit ke
 * pilihan terdekat.
 */
export function hitungSkorSnapshot(
  snapshot: unknown,
  jawaban: Array<{ questionId: string; selectedOption: number }>,
): HasilSkorSnapshot {
  const dibaca = bacaSnapshotKuis(snapshot);
  const soal = dibaca?.soal ?? [];
  const totalSoal = soal.length;

  const dipilih = new Map<string, number>();
  for (const jawab of jawaban) {
    if (typeof jawab?.questionId !== "string") continue;
    if (!dipilih.has(jawab.questionId)) dipilih.set(jawab.questionId, jawab.selectedOption);
  }

  const perSoal = soal.map((s) => {
    const opsi = dipilih.get(s.id);
    const isCorrect =
      typeof opsi === "number" &&
      Number.isInteger(opsi) &&
      opsi >= 0 &&
      opsi < s.pilihan.length &&
      opsi === s.jawaban_benar;
    return { questionId: s.id, isCorrect };
  });

  const benar = perSoal.filter((p) => p.isCorrect).length;
  const score = totalSoal === 0 ? 0 : Math.round((benar / totalSoal) * 100);

  return { score, perSoal, totalSoal };
}

/**
 * Lulus bila `score` mencapai `nilai_lulus` **snapshot**, bukan bank soal.
 *
 * Snapshot tanpa ambang lulus yang sah (`NaN`) mengembalikan `false`: bukti
 * yang tidak bisa dibaca tidak boleh menghasilkan kelulusan.
 */
export function lulusSnapshot(snapshot: unknown, score: number): boolean {
  const dibaca = bacaSnapshotKuis(snapshot);
  if (!dibaca) return false;
  if (!Number.isFinite(dibaca.nilai_lulus)) return false;
  if (!Number.isFinite(score)) return false;
  return score >= dibaca.nilai_lulus;
}
