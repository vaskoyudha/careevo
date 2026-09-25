import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Catatan performa peserta — **server-only**, dan **sengaja terpisah** dari
 * cookie pendaftaran.
 *
 * Cookie `ls_enroll` milik peramban peserta: verifikator tidak bisa membacanya,
 * dan itulah alasan cermin ini ada. Yang dicerminkan adalah **hasil**, bukan
 * cookie-nya — `tandaiModul` menulis ke keduanya dalam satu operasi supaya
 * keduanya tidak mungkin berbeda.
 *
 * Direktori dialihkan lewat `CAREEVO_PERFORMA_DIR` (dikonfigurasi di
 * `vitest.config.mts`) supaya test tidak pernah menyentuh `.data/` milik repo.
 */

export type SumberPenyelesaian = "terverifikasi" | "informal";
/** Selalu `"klien"` di pass ini: penilaian server adalah pekerjaan terpisah. */
export type SumberSkor = "klien";

/**
 * Cara menyebut jalur penyelesaian dalam satu kalimat.
 *
 * Satu definisi untuk daftar dan detail: kalau dua tempat menulis rumusan
 * sendiri, keduanya bebas berbeda dan yang berbeda akaniat diam-diam.
 */
export const LABEL_SUMBER: Record<SumberPenyelesaian, string> = {
  terverifikasi: "lewat sesi terverifikasi",
  informal: "tanpa sesi terverifikasi",
};

export interface PenyelesaianModul {
  modul_id: string;
  at: string;
  sumber: SumberPenyelesaian;
}

export interface PercobaanKuis {
  kuis_id: string;
  modul_id: string;
  nilai: number;
  total_soal: number;
  at: string;
  sumber: SumberSkor;
}

export interface KursusPerforma {
  course_id: string;
  judul: string;
  selesai: PenyelesaianModul[];
  kuis: PercobaanKuis[];
}

export interface RecordPerforma {
  owner: string;
  nama: string;
  versi_skema: 1;
  kursus: KursusPerforma[];
}

/** Batas percobaan per kuis: yang lebih lama dipangkas, bukan ditolak. */
const MAKS_PERCOBAAN = 50;

/** Direktori catatan; dihitung per panggilan agar override test ikut terbaca. */
export function tempatPerforma(): string {
  return process.env.CAREEVO_PERFORMA_DIR ?? path.join(process.cwd(), ".data", "performa");
}

/**
 * Nama berkas = hash email, jadi email tidak menentukan struktur direktori dan
 * tidak pernah jadi nama berkas di disk. Email tetap disimpan di dalam record
 * karena dashboard perlu menampilkannya.
 */
function berkasPerforma(owner: string): string {
  const hash = createHash("sha256").update(owner.trim().toLowerCase()).digest("hex");
  return path.join(tempatPerforma(), `${hash}.json`);
}

function recordKosong(owner: string, nama: string): RecordPerforma {
  return { owner: owner.trim().toLowerCase(), nama, versi_skema: 1, kursus: [] };
}

/**
 * Validasi baca dari disk.
 *
 * `versi_skema` diperiksa ketat: field baru yang menyusul tidak boleh membuat
 * record lama terbaca sebagai record yang memenuhi syarat padahal tidak — yang
 * jauh lebih buruk daripada membacanya sebagai tidak ada.
 */
function isRecord(value: unknown): value is RecordPerforma {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.owner === "string" &&
    typeof c.nama === "string" &&
    c.versi_skema === 1 &&
    Array.isArray(c.kursus)
  );
}

export async function bacaPerforma(owner: string): Promise<RecordPerforma | null> {
  let mentah: string;
  try {
    mentah = await readFile(berkasPerforma(owner), "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(mentah) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function tulisPerforma(record: RecordPerforma): Promise<RecordPerforma> {
  const tujuan = berkasPerforma(record.owner);
  await mkdir(path.dirname(tujuan), { recursive: true });
  // Tulis ke berkas sementara lalu rename: rename atomik di filesystem yang
  // sama, sehingga proses yang mati di tengah penulisan tidak meninggalkan
  // catatan terpotong yang terbaca sebagai "peserta punya data".
  const sementara = `${tujuan}.tmp`;
  await writeFile(sementara, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(sementara, tujuan);
  return record;
}

/** Semua peserta yang punya catatan — pembacaan lintas-pemilik untuk staf. */
export async function indeksPerforma(): Promise<RecordPerforma[]> {
  let berkas: string[];
  try {
    berkas = await readdir(tempatPerforma());
  } catch {
    return [];
  }
  const hasil: RecordPerforma[] = [];
  for (const nama of berkas) {
    if (!nama.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(
        await readFile(path.join(tempatPerforma(), nama), "utf8"),
      ) as unknown;
      if (isRecord(parsed)) hasil.push(parsed);
    } catch {
      // Berkas rusak dilewati, bukan menggagalkan seluruh daftar: satu catatan
      // yang tidak terbaca tidak boleh membuat halaman staf kosong.
      continue;
    }
  }
  return hasil.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

function entriKursus(record: RecordPerforma, courseId: string, judul: string): KursusPerforma {
  const ada = record.kursus.find((k) => k.course_id === courseId);
  if (ada) {
    if (!ada.judul) ada.judul = judul;
    return ada;
  }
  const baru: KursusPerforma = { course_id: courseId, judul, selesai: [], kuis: [] };
  record.kursus.push(baru);
  return baru;
}

/**
 * Cermin satu penyelesaian modul.
 *
 * `batal` melepas entri yang sudah ada. `tandaiModul` adalah **toggle**:
 * tanpa cabang ini, pembatalan akan meninggalkan cermin yang menyatakan modul
 * selesai, dan dashboard akan menampilkan sesuatu yang tidak lagi berlaku di
 * cookie.
 */
export async function catatPenyelesaian(input: {
  owner: string;
  nama: string;
  courseId: string;
  judulKursus: string;
  modulId: string;
  sumber: SumberPenyelesaian;
  at?: string;
  batal?: boolean;
}): Promise<RecordPerforma | null> {
  const lama = (await bacaPerforma(input.owner)) ?? recordKosong(input.owner, input.nama);
  const entri = entriKursus(lama, input.courseId, input.judulKursus);
  if (input.batal) {
    entri.selesai = entri.selesai.filter((s) => s.modul_id !== input.modulId);
  } else if (!entri.selesai.some((s) => s.modul_id === input.modulId)) {
    entri.selesai.push({
      modul_id: input.modulId,
      at: input.at ?? new Date().toISOString(),
      sumber: input.sumber,
    });
  }
  return tulisPerforma(lama);
}

/**
 * Catat satu skor kuis.
 *
 * `nilai` **dilaporkan klien** dan belum dinilai server (kunci jawaban ikut
 * terkirim ke peramban), jadi yang diperiksa di sini hanya **bentuk** angkanya —
 * rentang 0–100 dan jumlah soal yang masuk akal. Substansinya tidak. Field
 * `sumber` ada supaya penilaian server yang menyusul tidak perlu melabeli ulang
 * catatan lama.
 */
export async function catatSkorKuis(input: {
  owner: string;
  nama: string;
  courseId: string;
  judulKursus: string;
  kuisId: string;
  modulId: string;
  nilai: number;
  totalSoal: number;
  at?: string;
}): Promise<RecordPerforma | null> {
  if (!Number.isFinite(input.nilai) || input.nilai < 0 || input.nilai > 100) return null;
  if (!Number.isInteger(input.totalSoal) || input.totalSoal < 1) return null;

  const lama = (await bacaPerforma(input.owner)) ?? recordKosong(input.owner, input.nama);
  const entri = entriKursus(lama, input.courseId, input.judulKursus);
  // Anotasi eksplisit: tanpa itu `sumber: "klien"` di dalam literal array
  // melebar jadi `string` dan tidak cocok dengan union `SumberSkor`.
  const percobaan: PercobaanKuis = {
    kuis_id: input.kuisId,
    modul_id: input.modulId,
    nilai: Math.round(input.nilai),
    total_soal: input.totalSoal,
    at: input.at ?? new Date().toISOString(),
    sumber: "klien",
  };
  entri.kuis = [...entri.kuis, percobaan].slice(-MAKS_PERCOBAAN);
  return tulisPerforma(lama);
}
