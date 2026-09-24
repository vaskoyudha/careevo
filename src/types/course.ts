import type { Level, Track } from "./domain";

export type CourseType = "course" | "video" | "artikel" | "bootcamp";
export type CourseStatus = "published" | "draft" | "archived";

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  provider: string;
  type: CourseType;
  track: Track;
  level: Level;
  tags: string[];
  url: string;
  duration_min: number;
  is_free: boolean;
  price: number;
  status: CourseStatus;
  enrolled_count: number;
  rating: number;
  cover_image?: string;
  /** Kurikulum tersimpan. Kosong/absen = pakai modul turunan `modulKursus()`. */
  modul?: Modul[];
  /**
   * Kebijakan asesmen tersimpan. Absen = default aman (`kebijakanDefault()`).
   *
   * Kursus lama yang belum pernah disunting kebijakannya tidak membawa field
   * ini; pembaca wajib jatuh ke `kebijakanDefault()` agar gerbang sesi tidak
   * diam-diam terbuka.
   */
  kebijakan?: KebijakanCourse;
  created_at: string;
  updated_at: string;
}

/**
 * Modul pembelajaran milik sebuah kursus.
 *
 * Berbeda dari `ModulKursus` di `lib/courses/kurikulum.ts` yang *diturunkan*
 * dari metadata kursus, `Modul` di sini adalah entitas yang benar-benar
 * disimpan. Kursus yang belum pernah diedit kurikulumnya tetap memakai modul
 * turunan lewat `modulUntuk()`.
 */
/**
 * Gaya konten berformat untuk isi halaman.
 *
 * Bentuk blok (bukan string markdown, dan bukan HTML) dipilih supaya renderer
 * hanya memetakan struktur ke elemen React: tidak ada HTML mentah yang perlu
 * disanitasi, sehingga lubang XSS tersimpan tetap tertutup. Repo ini tidak
 * punya sanitizer — lihat alasan yang sama di `materi-view.tsx`.
 */
export type TipeBlok = "paragraf" | "heading" | "daftar" | "kutipan" | "gambar";

/**
 * Ukuran huruf relatif terhadap skala tema, bukan px bebas.
 *
 * Nilai terbatas (union) supaya `blok-editor` bisa menyediakan pilihan yang
 * pasti dan renderer bisa memetakan ke kelas tema — memberi admin px bebas
 * akan menghasilkan tipografi yang tidak konsisten antar halaman.
 */
export type UkuranBlok = "kecil" | "normal" | "besar" | "lead";

/** Potongan teks sebaris beserta penanda formatnya. */
export interface SegmenTeks {
  teks: string;
  tebal?: boolean;
  miring?: boolean;
  /**
   * `#slug-section` untuk backlink, atau http/https untuk tautan luar.
   * Dua bentuk ini dibedakan dan divalidasi di `validation/blok.ts`.
   */
  tautan?: string;
}

export interface BlokHalaman {
  id: string;
  tipe: TipeBlok;
  /**
   * Level heading 1–3; hanya dipakai `tipe: "heading"`.
   *
   * 1 = judul section, 2 = sub-section, 3 = sub-sub. Heading level 1–3 inilah
   * yang menjadi jangkar daftar isi sekaligus sasaran backlink.
   */
  level?: 1 | 2 | 3;
  ukuran?: UkuranBlok;
  /** Isi sebaris — dipakai `paragraf`, `heading`, dan `kutipan`. */
  segmen?: SegmenTeks[];
  /** Butir daftar; tiap butir satu baris berformat. Dipakai `tipe: "daftar"`. */
  butir?: SegmenTeks[][];
  /** Path `/uploads/...` hasil route unggah; hanya untuk `tipe: "gambar"`. */
  src?: string;
  alt?: string;
}

/**
 * Halaman berformat milik sebuah modul.
 *
 * Bersarang di dalam `Modul` dengan alasan sama seperti `materi`: menghapus
 * modul otomatis menghapus halamannya, tanpa referensi yatim yang perlu
 * dibersihkan terpisah.
 */
export interface Halaman {
  id: string;
  modul_id: string;
  course_id: string;
  judul: string;
  /** 1-based dan eksplisit — sama seperti `Modul.urutan`. */
  urutan: number;
  blok: BlokHalaman[];
  created_at: string;
  updated_at: string;
}

export interface Modul {
  id: string;
  course_id: string;
  judul: string;
  ringkasan: string;
  /** 1-based dan eksplisit — urutan tidak boleh bergantung pada posisi array. */
  urutan: number;
  durasi_min: number;
  /**
   * Materi dimiliki modul ini. Disimpan bersarang (bukan koleksi terpisah)
   * supaya menghapus modul otomatis menghapus materinya dan tidak ada
   * referensi yatim yang perlu dibersihkan.
   */
  materi?: Materi[];
  /**
   * Halaman berformat modul ini — inilah bagian yang "ditulis" admin.
   *
   * Halaman dan materi hidup berdampingan: halaman untuk prosa, materi untuk
   * lampiran (video/PDF/kuis). Memisahkan keduanya membuat masing-masing punya
   * satu renderer dan satu jalur penyuntingan, bukan dua cara menulis prosa.
   */
  halaman?: Halaman[];
  /** Aturan pengerjaan modul ini. Absen = kebijakan default kursus. */
  checkpoint?: CheckpointMateri;
  created_at: string;
  updated_at: string;
}

/**
 * `teks` sengaja tidak ada di sini.
 *
 * Prosa kini ditulis sebagai halaman berformat. Membiarkan dua cara menulis
 * prosa akan membuat admin ragu harus memakai yang mana dan setiap perubahan
 * tipografi harus dikerjakan dua kali. Materi `teks` yang sudah tersimpan
 * dimigrasikan menjadi halaman saat dibaca — lihat `normalisasiHalamanLama()`.
 */
export type TipeMateri = "video" | "pdf" | "kuis";

export interface SoalKuis {
  id: string;
  pertanyaan: string;
  /** Minimal 2 pilihan. */
  pilihan: string[];
  /** Indeks ke `pilihan`. */
  jawaban_benar: number;
}

/** Field yang dimiliki semua tipe materi. */
interface MateriDasar {
  id: string;
  modul_id: string;
  course_id: string;
  judul: string;
  urutan: number;
  created_at: string;
  updated_at: string;
}

/**
 * Materi pembelajaran — discriminated union per `tipe`.
 *
 * Union (bukan satu antarmuka dengan banyak field opsional) dipilih supaya
 * `switch (m.tipe)` bersifat exhaustive: menambah tipe baru memaksa setiap
 * cabang render dan formulir diperbarui.
 */
export type Materi =
  | (MateriDasar & { tipe: "video"; url: string; durasi_min: number })
  | (MateriDasar & { tipe: "pdf"; path: string; ukuran_bytes: number })
  | (MateriDasar & { tipe: "kuis"; soal: SoalKuis[]; nilai_lulus: number });

export type CreateCourseInput = {
  title: string;
  slug?: string;
  description: string;
  provider: string;
  type?: CourseType;
  track?: Track;
  level?: Level;
  tags?: string[];
  url: string;
  duration_min: number;
  is_free?: boolean;
  price?: number;
  status?: CourseStatus;
  cover_image?: string;
};

/**
 * Perubahan kebijakan asesmen yang dikirim pemanggil.
 *
 * Hanya dua aturan yang boleh diubah manusia: `versi` dan
 * `aturan_pengawasan_sejak` adalah konsekuensi penyimpanan, bukan pilihan —
 * menerimanya dari klien akan membiarkan pemanggil memalsukan versi bukti.
 */
export type CourseKebijakanInput = Partial<
  Pick<KebijakanCourse, "aturan_bantuan" | "aturan_pengawasan">
>;

export type UpdateCourseInput = Partial<CreateCourseInput> & {
  /** Bila ada, store menaikkan `versi` dan menstempel waktu berlaku aturan. */
  kebijakan?: CourseKebijakanInput;
};

export interface CreateModulInput {
  judul: string;
  ringkasan: string;
  /** Bila kosong, store menaruhnya di urutan terakhir. */
  urutan?: number;
  durasi_min: number;
  /**
   * Berapa halaman kosong yang dibuat sekaligus bersama modul ini.
   *
   * Ini kontrol "tentukan jumlah halaman saat membuat modul". Halaman tetap
   * bisa ditambah/dihapus setelahnya; nilai ini hanya menentukan titik awal.
   * `undefined`/`0` berarti modul dibuat tanpa halaman.
   */
  jumlah_halaman?: number;
  /**
   * Aturan pengerjaan modul. Kosong = store memakai default aman
   * (`{ mode: "materi", batas_waktu_menit: 30 }`).
   */
  checkpoint?: CheckpointMateri;
}

/**
 * Perubahan modul.
 *
 * `jumlah_halaman` sengaja **tidak** ikut: menambah halaman saat menyunting
 * modul berarti menyisipkan halaman kosong ke dalam daftar yang mungkin sudah
 * ditulis, dan tidak jelas harus ditaruh di posisi mana. Menambah halaman
 * dikerjakan lewat tombol "Tambah halaman" di editor halaman; mengubah judul
 * modul tidak boleh diam-diam menambah halaman.
 */
export type UpdateModulInput = Partial<Omit<CreateModulInput, "jumlah_halaman">>;

/**
 * Aturan bantuan: siapa yang boleh membantu sewaktu asesmen.
 *
 * Tiga tingkat (bukan boolean "boleh AI/tidak") karena kebijakan nyata bukan
 * biner: banyak course membolehkan tutor manusia dan koreksi AI Careevo, tapi
 * melarang AI eksternal. `bertutor` adalah titik tengah itu.
 */
export type AturanBantuan = "bebas" | "bertutor" | "tanpa_ai";

/**
 * Aturan pengawasan: apakah hasil hanya sah bila dikerjakan di sesi
 * terverifikasi.
 *
 * `wajib`/`opsional` (bukan daftar kontrol kamera) supaya kebijakan yang
 * tersimpan stabil saat detail teknis sesi berubah — detail kamera hidup di
 * mesin akses, bukan di data course.
 */
export type AturanPengawasan = "wajib" | "opsional";

export interface KebijakanCourse {
  aturan_bantuan: AturanBantuan;
  aturan_pengawasan: AturanPengawasan;
  /** Naik setiap kali ahli menyimpan perubahan kebijakan. */
  versi: number;
  aturan_pengawasan_sejak: string;
}

export type ModeCheckpoint = "materi" | "kuis" | "proyek";

export interface CheckpointMateri {
  /** Batas waktu mengerjakan/menyelesaikan, dalam menit. */
  batas_waktu_menit: number;
  /**
   * Materi = cek pemahaman; kuis/proyek menautkan lampiran yang sudah ada.
   * `ref` adalah id materi `kuis` di modul yang sama, atau id tugas (challenge).
   */
  mode: ModeCheckpoint;
  ref?: string;
}

/**
 * Blok saat dikirim pemanggil.
 *
 * `id` boleh kosong: store yang memberinya lewat `idBaru("blk")`, sama seperti
 * id modul/materi. Menerima id dari klien untuk blok baru akan membuat klien
 * bisa menumbuk id blok lain, dan mengubah id blok yang sudah ada berarti
 * memutus kaitan jangkar backlink.
 */
export type BlokInput = Omit<BlokHalaman, "id"> & { id?: string };

export interface CreateHalamanInput {
  judul: string;
  blok?: BlokInput[];
  /** Bila kosong, store menaruhnya di urutan terakhir. */
  urutan?: number;
}

export type UpdateHalamanInput = CreateHalamanInput;

/**
 * Input materi: tipe beserta payload-nya.
 *
 * `Materi` yang tersimpan menambahkan `id`, `modul_id`, `course_id`, `urutan`,
 * dan timestamp yang diisi store — bukan oleh pemanggil.
 */
export type CreateMateriInput =
  | { tipe: "video"; judul: string; url: string; durasi_min: number }
  | { tipe: "pdf"; judul: string; path: string; ukuran_bytes: number }
  | { tipe: "kuis"; judul: string; soal: SoalKuis[]; nilai_lulus: number };

/** Ubah materi sekaligus tipe-nya: payload selalu diganti utuh. */
export type UpdateMateriInput = CreateMateriInput;

export interface CourseStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  free: number;
  paid: number;
}
