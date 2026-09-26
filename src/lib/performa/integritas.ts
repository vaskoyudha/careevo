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
  /** Menit berjalan; `null` untuk sesi yang masih aktif. */
  durasiMenit: number | null;
  /** True kalau ditutup oleh peserta, false kalau berakhir sendiri. */
  ditutupPeserta: boolean;
  persetujuan: RingkasanPersetujuan;
  kejadian: number;
  celah: number;
  /** Catatan mentah, kronologis, untuk lini masa di halaman detail. */
  catatan: KejadianIntegritas[];
  /** Rincian per jenis kejadian, untuk tabel di halaman detail. */
  perJenis: Array<{ jenis: KejadianIntegritas["jenis"]; label: string; jumlah: number }>;
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
      durasiMenit: durasiMenit(run),
      ditutupPeserta: run.kejadian.some((k) => k.jenis === "sesi_diakhiri"),
      persetujuan: statusPersetujuan(run),
      kejadian,
      celah,
      catatan: [...run.kejadian].sort((a, b) => a.at.localeCompare(b.at)),
      perJenis: [...new Set(run.kejadian.map((k) => k.jenis))]
        .map((j) => ({
          jenis: j,
          label: LABEL_KEJADIAN[j],
          jumlah: run.kejadian.filter((k) => k.jenis === j).length,
        }))
        .sort((a, b) => b.jumlah - a.jumlah),
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

/**
 * Status persetujuan akses kamera.
 *
 * `belum_diminta` **bukan** pilihan peserta yang tidak menyalakan kamera —
 * itu keadaan di mana produknya belum pernah meminta. Membedakan keduanya
 * penting: yang pertama berarti tidak ada sinyal apa pun tentang peserta, yang
 * kedua berarti ada gangguan teknis yang perlu dijelaskan.
 */
export type StatusPersetujuan =
  | "belum_diminta"
  | "diminta_gagal"
  | "disetujui_aktif"
  | "disetujui_berhenti";

/** Siapa yang menyebabkan keadaan itu terjadi. */
export type PenyebabPersetujuan = "produk" | "peramban";

export interface RingkasanPersetujuan {
  status: StatusPersetujuan;
  penyebab: PenyebabPersetujuan;
  label: string;
  detail: string;
}

const LABEL_PERSETUJUAN: Record<StatusPersetujuan, string> = {
  belum_diminta: "Belum diminta",
  diminta_gagal: "Diminta, gagal",
  disetujui_aktif: "Disetujui, berjalan",
  disetujui_berhenti: "Disetujui, berhenti",
};

const DETAIL_PERSETUJUAN: Record<StatusPersetujuan, string> = {
  belum_diminta: "Aplikasi belum pernah meminta akses kamera. Tidak ada yang bisa ditinjau, dan ini bukan pilihan peserta.",
  diminta_gagal: "Akses kamera diminta tapi peramban gagal menyalakannya.",
  disetujui_aktif: "Kamera menyala dan berjalan saat sesi berlangsung.",
  disetujui_berhenti: "Kamera sempat menyala, lalu berhenti di tengah sesi.",
};

/**
 * Status persetujuan kamera turunan dari kejadian run.
 *
 * Tidak ada field persetujuan terpisah di `SessionRun`; kejadian adalah satu
 * satu-satunya sumber kebenaran, jadi tidak ada yang bisa berbeda antara yang
 * tercatat di sini dan yang benar-benar terjadi.
 */
export function statusPersetujuan(run: SessionRun): RingkasanPersetujuan {
  const jenis = new Set(run.kejadian.map((k) => k.jenis));

  let status: StatusPersetujuan = "belum_diminta";
  if (jenis.has("kamera_mulai")) status = "disetujui_aktif";
  if (jenis.has("kamera_gagal")) status = "diminta_gagal";
  // Berhenti hanya bermakna kalau kamera memang sempat menyala.
  if (jenis.has("kamera_berhenti") && jenis.has("kamera_mulai")) status = "disetujui_berhenti";

  return {
    status,
    // `belum_diminta` adalah kelemahan produk, bukan keputusan peserta.
    penyebab: status === "belum_diminta" ? "produk" : "peramban",
    label: LABEL_PERSETUJUAN[status],
    detail: DETAIL_PERSETUJUAN[status],
  };
}

/** Urutan paling informing lebih dulu saat menggabungkan beberapa sesi. */
const PRIORITAS_PERSETUJUAN: StatusPersetujuan[] = [
  "disetujui_aktif",
  "disetujui_berhenti",
  "diminta_gagal",
  "belum_diminta",
];

/**
 * Gabungkan status persetujuan beberapa sesi milik satu pemilik.
 *
 * Kalau satu saja sesi pernah kamera menyala, itu yang dilaporkan — bukan
 * "belum diminta", yang akan mengecilkan bukti yang sudah ada. Sebaliknya,
 * "belum diminta" dipakai hanya kalau **tidak ada** sesi yang punya persetujuan
 * apa pun.
 */
export function gabungPersetujuan(daftar: RingkasanPersetujuan[]): RingkasanPersetujuan {
  for (const status of PRIORITAS_PERSETUJUAN) {
    const ketemu = daftar.find((p) => p.status === status);
    if (ketemu) return ketemu;
  }
  return {
    status: "belum_diminta",
    penyebab: "produk",
    label: LABEL_PERSETUJUAN.belum_diminta,
    detail: "Belum ada sesi sama sekali untuk peserta ini.",
  };
}

/** Durasi sesi dalam menit, atau `null` kalau masih berjalan atau tak terbaca. */
export function durasiMenit(run: SessionRun): number | null {
  if (!run.berakhir_at) return null;
  const a = Date.parse(run.mulai_at);
  const b = Date.parse(run.berakhir_at);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60_000);
}

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
  const izin = statusPersetujuan(run);
  const hasil: Temuan[] = [
    {
      kode: "kamera_tidak_aktif",
      label: izin.label === "Belum diminta" ? izin.label : `Kamera: ${izin.label}`,
      detail: izin.detail,
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
