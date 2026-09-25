import type { KejadianIntegritas, SessionRun } from "@/lib/learning/session";

/**
 * Pembacaan integritas untuk laporan staf.
 *
 * Membaca `.data/sessions/` secara langsung dan **menyimpan ulang tidak apa pun**
 * ke toko performa: menyalin akan menciptakan dua sumber kebenaran yang bisa
 * berbeda tanpa ada yang memperingatkan, sedangkan `.data/sessions/` sudah
 * merupakan sumber kebenarannya.
 *
 * Yang dikembalikan adalah **konteks**, bukan vonis. Ringkasan di bawah tidak
 * pernah menjadi skor, tidak pernah memengaruhi kelulusan, dan tidak pernah
 * memengaruhi reputasi. Angka "celah" menjelaskan apa yang tercatat — bukan siapa
 * yang dipercaya.
 */
export interface RingkasanSesi {
  run_id: string;
  course_id: string;
  status: SessionRun["status"];
  mulai_at: string;
  berakhir_at: string | null;
  kejadian: number;
  celah: number;
  /** Catatan mentah, chronological, untuk lini masa di halaman detail. */
  catatan: KejadianIntegritas[];
}

export interface RingkasanIntegritas {
  sesi: number;
  kejadian: number;
  celah: number;
  kedaluwarsa: number;
  daftar: RingkasanSesi[];
}

export function ringkasIntegritasByOwner(runs: SessionRun[]): Map<string, RingkasanIntegritas> {
  const peta = new Map<string, RingkasanIntegritas>();

  for (const run of runs) {
    const isi = peta.get(run.owner) ?? {
      sesi: 0,
      kejadian: 0,
      celah: 0,
      kedaluwarsa: 0,
      daftar: [],
    };
    // `klasifikasiKejadian` sudah ditetapkan server saat kejadian dicatat, jadi
    // yang dihitung ulang di sini hanya pengelompokannya, bukan artinya.
    const kejadian = run.kejadian.filter((k) => k.jenis_klasifikasi === "kejadian").length;
    const celah = run.kejadian.length - kejadian;

    isi.sesi += 1;
    isi.kejadian += kejadian;
    isi.celah += celah;
    if (run.status === "kedaluwarsa") isi.kedaluwarsa += 1;
    isi.daftar.push({
      run_id: run.id,
      course_id: run.course_id,
      status: run.status,
      mulai_at: run.mulai_at,
      berakhir_at: run.berakhir_at,
      kejadian,
      celah,
      catatan: [...run.kejadian].sort((a, b) => a.at.localeCompare(b.at)),
    });
    peta.set(run.owner, isi);
  }

  for (const isi of peta.values()) {
    isi.daftar.sort((a, b) => b.mulai_at.localeCompare(a.mulai_at));
  }
  return peta;
}

/** Label singkat untuk satu kejadian, dipakai apa adanya di lini masa. */
export const LABEL_KEJADIAN: Record<KejadianIntegritas["jenis"], string> = {
  pindah_tab: "Keluar tab",
  fokus_hilang: "Fokus hilang",
  kamera_mulai: "Kamera menyala",
  kamera_berhenti: "Kamera berhenti",
  kamera_gagal: "Kamera gagal",
  sesi_dimulai: "Sesi dimulai",
  sesi_diakhiri: "Sesi diakhiri",
};

export type KodeTemuan =
  | "kamera_tidak_aktif"
  | "pindah_tab"
  | "fokus_hilang"
  | "celah_pengawasan"
  | "kedaluwarsa";

export interface Temuan {
  kode: KodeTemuan;
  /** Satu frasa, tanpa kalimat. */
  label: string;
  /** Satu kalimat pendek: faktanya, lalu apa yang tidak bisa disimpulkan. */
  detail: string;
}

/**
 * Temuan faktual untuk satu sesi.
 *
 * Ini **bukan** daftar pelanggaran. Data yang terkumpul adalah catatan
 * pengamatan — keluar tab, fokus hilang, kamera berhenti — dan catatan itu tidak
 * bisa membedakan "buka dokumentasi" dari "salin dari AI". Jadi setiap temuan
 * menyatakan apa yang tercatat dan, kalau perlu, apa yang tidak diketahui.
 *
 * Fungsi ini tidak pernah mengembalikan skor, tingkat bahaya, atau label
 * "curang": penilaian itu milik manusia, bukan turunan aritmetika. Test
 * `temuanSesi tidak pernah memakai kata yang menyatakan bersalah` menjaga itu.
 */
export function temuanSesi(run: SessionRun): Temuan[] {
  const hasil: Temuan[] = [
    {
      kode: "kamera_tidak_aktif",
      label: "Tidak ada rekaman kamera",
      detail: "Kamera tidak pernah diminta, jadi tidak ada yang bisa ditinjau.",
    },
  ];

  const pindah = run.kejadian.filter((k) => k.jenis === "pindah_tab").length;
  if (pindah > 0) {
    hasil.push({
      kode: "pindah_tab",
      label: `Keluar tab ${pindah}×`,
      detail: "Tidak diketahui apa yang dibuka: dokumentasi dan bantuan AI sama-sama mungkin.",
    });
  }

  const fokus = run.kejadian.filter((k) => k.jenis === "fokus_hilang").length;
  if (fokus > 0) {
    hasil.push({
      kode: "fokus_hilang",
      label: `Fokus hilang ${fokus}×`,
      detail: "Jendela kehilangan fokus, bisa karena pindah jendela atau dialog sistem.",
    });
  }

  const celah = run.kejadian.filter((k) => k.jenis_klasifikasi === "celah").length;
  if (celah > 0) {
    hasil.push({
      kode: "celah_pengawasan",
      label: `Celah pengawasan ${celah}×`,
      detail: "Ada saat pencatatan berhenti, jadi catatan kegiatan tidak lengkap.",
    });
  }

  if (run.status === "kedaluwarsa") {
    hasil.push({
      kode: "kedaluwarsa",
      label: "Sesi dibiarkan kedaluwarsa",
      detail: "Diotomatis lewat batas waktu, bukan ditutup oleh peserta.",
    });
  }

  return hasil;
}
