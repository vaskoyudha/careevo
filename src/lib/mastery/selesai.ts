/**
 * Penilaian penyelesaian jalur penguasaan — **murni, tanpa IO**.
 *
 * Jalur — tidak seperti kursus — tidak punya peristiwa terminal: yang ada hanya
 * log `attempts` dan rata-rata `overall` yang tidak bisa mencapai 1. Modul ini
 * menyediakan peristiwa itu sebagai **fungsi murni**, supaya "jalur ini selesai"
 * bisa dihitung ulang kapan pun dari bukti yang sama dan tidak pernah
 * bergantung pada klaim browser.
 *
 * Semua ambang **diturunkan** dari `scoring.ts`, tidak diketik tangan:
 * `CONFIDENCE_CAP` menyiratkan aturan cakupan, `INTERVAL_SEQUENCES`
 * menyiratkan ambang kedalaman. Menyalin angka itu ke sini akan membuat dua
 * sumber kebenaran yang pasti akan berbeda.
 *
 * Modul ini **tidak** membaca database, `node:fs`, atau `next/headers`.
 */

import { DAY_MS, INTERVAL_SEQUENCES, hitungPenguasaan } from "./scoring";
import type {
  Attempt,
  KnowledgePoint,
  KnowledgeType,
  MasteryTopic,
  MasteryTopicBundle,
  Provenance,
} from "./types";

export type { Provenance };

/** Ambang Minimum Yang Harus Dicapai — naik hanya lewat nomor versi. */
export interface AmbangJalur {
  /** Minimal attempt `dinilai` per poin. `0` = semua self-declared. */
  provenanceMinimum: number;
  /** Versi kebijakan; naik saat aturan berubah. */
  policyVersion: number;
}

export const AMBANG_JALUR_V1: AmbangJalur = { provenanceMinimum: 0, policyVersion: 1 };

/**
 * Hari yang harus berlalu sebelum sebuah attempt `review` dihitung sebagai
 * kedalaman.
 *
 * Diturunkan dari `INTERVAL_SEQUENCES` dengan `Math.floor((len - 1) / 2)`,
 * mengikuti prinsip yang sudah ditulis di `rentangTinjauan`: angka yang
 * dihitung dari tabel tidak bisa berbeda dari label yang ditulis di
 * sebelahnya. Hasilnya `design` (tabel 2 langkah) menuntut 14 hari, sementara
 * `memory` (7 langkah) menuntut 7 — dan itu memang yang benar, sebab keputusan
 * desain tidak layak ditinjau mingguan.
 */
export function ambangHari(type: KnowledgeType): number {
  const tabel = INTERVAL_SEQUENCES[type];
  const indeks = Math.floor((tabel.length - 1) / 2);
  return tabel[indeks] ?? 0;
}

export interface PenilaianPoin {
  id: string;
  name: string;
  type: KnowledgeType;
  /** 0..1 dari `hitungPenguasaan`. Bukan persentase kelulusan. */
  mastery: number;
  percobaan: number;
  dariTinjauan: number;
  dariDinilai: number;
  /** Gap terbesar, dalam hari, antara dua attempt berurutan pada poin ini. */
  gapHariTerpanjang: number;
  ambangHari: number;
  cakupan: boolean;
  retensi: boolean;
  kedalaman: boolean;
  terpenuhi: boolean;
}

export interface PenilaianJalur {
  selesai: boolean;
  poin: PenilaianPoin[];
  /** Alasan belum selesai, dalam Bahasa yang bisa ditampilkan. */
  alasan: string[];
  ambang: AmbangJalur;
  ringkasan: {
    totalPoin: number;
    poinTerpenuhi: number;
    percobaan: number;
    dariTinjauan: number;
    dariDinilai: number;
    ambangHariMinimum: number;
  };
}

/** Absen berarti `dideklarasikan` — lihat `Provenance` di `types.ts`. */
function provenance(attempt: Attempt): Provenance {
  return attempt.provenance === "dinilai" ? "dinilai" : "dideklarasikan";
}

/**
 * Urut berdasarkan waktu.
 *
 * Log attempt tidak dijamin urutnya di disk: `recordAttempt` menambahkan di
 * akhir array, tapi file bisa ditulis tangan, dan urutan itulah yang diukur
 * kedalaman. Mengurutkan di sini membuat hitungan tidak bergantung pada
 * kebetulan penulisan.
 */
function urutAttempts(attempts: readonly Attempt[]): Attempt[] {
  return [...attempts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function hariAntara(dari: string, ke: string): number {
  const selisih = Date.parse(ke) - Date.parse(dari);
  return Number.isFinite(selisih) && selisih > 0 ? Math.floor(selisih / DAY_MS) : 0;
}

function nilaiPoin(
  point: KnowledgePoint,
  attempts: readonly Attempt[],
  dibuatPada: string,
  minimumDinilai: number,
): PenilaianPoin {
  const urut = urutAttempts(attempts);
  const mastery = hitungPenguasaan(urut.map((a) => a.correct));

  let retensi = false;
  let gapHariTerpanjang = 0;
  urut.forEach((attempt, index) => {
    if (!attempt.correct || attempt.source !== "review") return;
    retensi = true;
    // Attempt pertama tidak punya sebelumnya; jaraknya diukur dari `createdAt`.
    // Tanpa itu, attempt pertama bisa punya gap `Infinity` dan selalu lolos kedalaman.
    const sebelumnya = index === 0 ? dibuatPada : urut[index - 1].at;
    const gap = hariAntara(sebelumnya, attempt.at);
    if (gap > gapHariTerpanjang) gapHariTerpanjang = gap;
  });

  const dariTinjauan = urut.filter((a) => a.source === "review").length;
  const dariDinilai = urut.filter((a) => provenance(a) === "dinilai").length;
  const ambang = ambangHari(point.type);

  // `>= 1` bukan `> 0.99`: `hitungPenguasaan` menjumlahkan bobot yang sama dalam
  // urutan yang sama untuk `earned` dan `total`, jadi hasilnya benar-benar 1. Test
  // "tiga percobaan benar tepat menghasilkan mastery 1" yang mengunci itu.
  const cakupan = mastery >= 1;
  const kedalaman = retensi && gapHariTerpanjang >= ambang;

  return {
    id: point.id,
    name: point.name,
    type: point.type,
    mastery,
    percobaan: urut.length,
    dariTinjauan,
    dariDinilai,
    gapHariTerpanjang,
    ambangHari: ambang,
    cakupan,
    retensi,
    kedalaman,
    terpenuhi: cakupan && retensi && kedalaman && dariDinilai >= minimumDinilai,
  };
}

export function nilaiJalur(
  bundle: MasteryTopicBundle,
  ambang: AmbangJalur = AMBANG_JALUR_V1,
): PenilaianJalur {
  const poin = bundle.points.map((point) =>
    nilaiPoin(
      point,
      bundle.progress.attempts.filter((a) => a.knowledgePointId === point.id),
      bundle.topic.createdAt,
      ambang.provenanceMinimum,
    ),
  );

  const poinTerpenuhi = poin.filter((p) => p.terpenuhi).length;
  const total = poin.length;
  // Fail-closed: tanpa poin tidak ada yang bisa dinyatakan selesai.
  const selesai =
    total > 0 &&
    poinTerpenuhi === total &&
    bundle.progress.errorPointIds.length === 0;

  const alasan: string[] = [];
  if (total === 0) {
    alasan.push("Topik ini belum punya poin pengetahuan");
  } else {
    const belum = total - poinTerpenuhi;
    if (belum > 0) {
      alasan.push(
        `${belum} dari ${total} poin belum memenuhi syarat: butuh mastery penuh, ` +
          `satu kali benar dari antrean tinjauan, dan jarak antarpercobaan yang cukup.`,
      );
    }
    if (bundle.progress.errorPointIds.length > 0) {
      alasan.push(
        `${bundle.progress.errorPointIds.length} poin masih salah dan belum dibetulkan`,
      );
    }
  }

  const ambangHariMinimum = total === 0 ? 0 : Math.min(...poin.map((p) => p.ambangHari));

  return {
    selesai,
    poin,
    alasan,
    ambang,
    ringkasan: {
      totalPoin: total,
      poinTerpenuhi,
      percobaan: poin.reduce((n, p) => n + p.percobaan, 0),
      dariTinjauan: poin.reduce((n, p) => n + p.dariTinjauan, 0),
      dariDinilai: poin.reduce((n, p) => n + p.dariDinilai, 0),
      ambangHariMinimum,
    },
  };
}

/**
 * Bukti beku untuk `submission_versions.content_snapshot`.
 *
 * Menyertakan `provenanceMinimum` **dan** `policyVersion` yang dipakai, supaya
 * verifier bisa membaca bar mana yang berlaku pada badge lama. Badge yang
 * terbit sebelum bridge hidup akan terlihat sebagai `provenanceMinimum: 0`,
 * bukan meniru badge yang dinilai.
 */
export function snapshotsBuktiJalur(
  penilaian: PenilaianJalur,
  topic: MasteryTopic,
): Record<string, unknown> {
  return {
    jalur: {
      topicId: topic.id,
      judul: topic.title,
      courseId: topic.courseId ?? null,
      jobId: topic.jobId ?? null,
      policyVersion: penilaian.ambang.policyVersion,
      provenanceMinimum: penilaian.ambang.provenanceMinimum,
      perBanding: {
        dinilai: penilaian.ringkasan.dariDinilai,
        dideklarasikan: penilaian.ringkasan.percobaan - penilaian.ringkasan.dariDinilai,
      },
      ringkasan: {
        totalPoin: penilaian.ringkasan.totalPoin,
        poinTerpenuhi: penilaian.ringkasan.poinTerpenuhi,
        percobaan: penilaian.ringkasan.percobaan,
        dariTinjauan: penilaian.ringkasan.dariTinjauan,
        ambangHariMinimum: penilaian.ringkasan.ambangHariMinimum,
      },
      poin: penilaian.poin.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        mastery: p.mastery,
        percobaan: p.percobaan,
        dariTinjauan: p.dariTinjauan,
        gapHariTerpanjang: p.gapHariTerpanjang,
        ambangHari: p.ambangHari,
        terpenuhi: p.terpenuhi,
      })),
    },
  };
}

const LABEL_TIPE: Readonly<Record<KnowledgeType, string>> = {
  memory: "hafalan",
  concept: "konsep",
  procedure: "prosedur",
  design: "desain",
};

/**
 * "1 poin" vs "7 poin" — Bahasa Indonesia tidak mengubah bentuk jamak untuk
 * kata benda countable seperti "poin" atau "percobaan", jadi yang dijaga di
 * sini hanya konsistensi, bukan bentuk tunggal.
 */
function jumlah(n: number, kata: string): string {
  return `${n} ${kata}`;
}

/**
 * Kalimat klaim yang dibaca verifier.
 *
 * Sengaja **tidak** memuat kata "lulus" atau "penuh": yang dilakukan peserta
 * adalah menunjukkan penguasaan pada N poin, bukan kelulusan ujian. Kalau
 * kalimat ini tidak bisa ditulis jujur untuk suatu topik, topik itu tidak
 * seharusnya punya badge.
 */
export function kalimatKlaimJalur(
  penilaian: PenilaianJalur,
  topic: MasteryTopic,
): string {
  const r = penilaian.ringkasan;
  const komposisi = Object.entries(LABEL_TIPE)
    .filter(([type]) => penilaian.poin.some((p) => p.type === type))
    .map(([type, label]) => {
      const n = penilaian.poin.filter((p) => p.type === type).length;
      return `${n} ${label}`;
    })
    .join(", ");

  return [
    `Menunjukkan penguasaan ${topic.title} pada ${jumlah(r.totalPoin, "poin pengetahuan")}`,
    komposisi ? `(${komposisi})` : "",
    `· ${jumlah(r.percobaan, "percobaan")}`,
    r.dariTinjauan > 0
      ? `· ${jumlah(r.dariTinjauan, "di antaranya dari antrean tinjauan")}`
      : "",
    r.ambangHariMinimum > 0 ? `· dinilai ulang setelah ${r.ambangHariMinimum} hari` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
