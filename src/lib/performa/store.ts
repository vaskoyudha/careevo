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
 * **Cermin penyelesaian modul dan penyelesaian kuis kini punya nasib berbeda.**
 * Laporan staf (`/performa`) membaca progres modul dari `module_progress` dan
 * skor kuis dari `quiz_attempts` di PostgreSQL, bukan dari berkas ini. Cermin
 * **penyelesaian modul** sengaja tetap ditulis dari `tandaiModul` peramban: ia
 * jalur informal/backfill yang belum pernah bermigrasi. Cermin **skor kuis**
 * tidak lagi ditulis siapa pun — penilaian pindah penuh ke `quiz_attempts`
 * (lihat `KuisView` → `kirimDanSelesaikanKuisAction`) — sehingga field kuis di
 * sini hanya bertahan untuk membaca catatan lama dan tidak boleh diandalkan;
 * jangan hapus `versi_skema` atau field `kuis` tanpa memeriksa record historis.
 *
 * Direktori dialihkan lewat `CAREEVO_PERFORMA_DIR` (dikonfigurasi di
 * `vitest.config.mts`) supaya test tidak pernah menyentuh `.data/` milik repo.
 */

export type SumberPenyelesaian = "terverifikasi" | "informal";

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
  /**
   * Asal nilai pada record lama — **legacy, jangan dihapus dari kontrak**.
   *
   * Jalur lama (klien menghitung, action skor menyimpan) menulis `"klien"` di
   * sini. Sejak penilaian pindah ke `quiz_attempts` tidak ada penulis baru,
   * tetapi record `.data/performa` yang sudah ada tetap memuat field ini, dan
   * menghapusnya dari tipe berarti mengubah kontrak historis yang membacanya
   * diam-diam (TS tidak menjaga struktur JSON runtime). Karena itu ia
   * opsional: penulis baru tidak perlu mengisinya, pembaca lama tetap utuh.
   */
  sumber?: "klien";
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
