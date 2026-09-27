/**
 * Kontrak ruang kerja — **murni**.
 *
 * Berkas ini adalah pasangan `@/lib/exec/port` untuk ruang kerja. Sama seperti
 * di sana: tidak ada I/O, tidak ada `node:*`, tidak ada `fetch`. Komponen klien
 * mengimpornya, jadi satu impor server akan menjatuhkan build.
 *
 * ## Kenapa ada kontrak tersendiri, bukan memperluas `PortJalankan`
 *
 * `PortJalankan` adalah fungsi: masuk kode, keluar hasil, selesai. Ruang kerja
 * adalah **keadaan**: ia hidup lama, punya nama, dan bisa dibuka berkali-kali.
 * Memaksakan keduanya ke satu antarmuka berarti setiap pemakai `PortJalankan`
 * ikut menanggung konsep `status`/`berhenti` yang tidak pernah ia pakai, dan
 * setiap pemakai ruang kerja menanggung konsep `status`/`stdout` yang tidak
 * berlaku. Dua kontrak kecil lebih baik daripada satu kontrak besar yang
 * setengahnya selalu tidak dipakai.
 *
 * Implementasi ruang kerja ada di `@/lib/workspace/proses-manajer` yang
 * server-only.
 */

/**
 * Alasan sebuah permintaan ruang kerja tidak bisa dipenuhi.
 *
 * Ini **alasan**, bukan pesan. Pesannya disusun UI dari `petakanWorkspace`,
 * sehingga copy tidak tersebar di beberapa komponen dan bisa diuji sendiri.
 *
 * `galat_manajer` adalah satu-satunya alasan yang berarti "layanan tidak
 * tersedia". Tiga yang lain adalah keadaan yang bisa dimengerti peserta:
 * kapasitas penuh, course yang belum memenuhi syarat, dan permintaan yang
 * tidak sah.
 */
export type StatusWorkspace =
  | "ok"
  | "penuh"
  | "terkunci"
  | "tidak_sah"
  | "galat_manajer";

/** Permintaan yang sama dipakai `mulai`, `status`, dan `berhenti`. */
export interface MintaWorkspace {
  /** `users.id`. Bukan email: pemilik otoritatif ruang kerja adalah id. */
  userId: string;
  /** `courses.id`. Satu peserta boleh punya ruang kerja di beberapa course. */
  courseId: string;
  /**
   * Hostname yang dipakai peserta untuk membuka aplikasi ini, mis. `localhost`
   * atau `127.0.0.1`.
   *
   * Dikirim supaya URL ruang kerja memakai **origin yang sama** dengan halaman
   * yang membukanya. `localhost:3000` dan `127.0.0.1:3000` adalah dua origin
   * yang berbeda bagi peramban, jadi peserta yang membuka aplikasi di
   * `localhost` lalu mendapat IDE di `127.0.0.1` akan punya keadaan IDE di ember
   * yang berbeda — dan berpindah antar keduanya kehilangan keadaan itu.
   *
   * Nilainya **tidak dipercaya**: manajer memvalidasinya lewat allowlist
   * (`namaHostSah`) dan jatuh ke `127.0.0.1` bila bukan nama loopback yang
   * dikenal, sehingga `Host` yang dikirim klien tidak bisa mengalihkan URL ke
   * mesin lain.
   */
  host?: string;
}

/** Keadaan sebuah ruang kerja pada saat ditanyakan. */
export interface KeadaanWorkspace {
  status: StatusWorkspace;
  /** Ada hanya saat `status === "ok"` **dan** ruang kerjanya hidup. */
  url?: string;
  /** Apakah ruang kerjanya sedang berjalan. `false` = perlu disiapkan. */
  hidup: boolean;
}

export interface PortWorkspace {
  /** Nyalakan ruang kerja, atau temukan kembali yang sudah hidup. Idempoten. */
  mulai(minta: MintaWorkspace): Promise<KeadaanWorkspace>;
  /** Baca keadaan tanpa efek samping — tidak pernah menyalakan apa pun. */
  status(minta: MintaWorkspace): Promise<KeadaanWorkspace>;
  /** Matikan ruang kerja. Volume pekerjaan peserta **tidak** dihapus. */
  berhenti(minta: MintaWorkspace): Promise<KeadaanWorkspace>;
  /**
   * Daftar berkas di ruang kerja, dalam bentuk mentah `<ukuran>\t<path>`.
   *
   * Mengembalikan teks, bukan `BerkasSnapshot[]`, karena pemfilteran dan
   * pemotongan adalah aturan murni yang tinggal di `@/lib/workspace/snapshot`
   * dan sudah teruji di sana. Kalau adapter ini ikut menyaring, aturannya
   * menjadi dua — dan salinan yang menyimpang adalah yang membuat snapshot
   * berbeda dari yang diuji.
   *
   * `null` berarti daftar tidak bisa diambil (ruang kerja mati, manajer tidak
   * tersedia). Pemanggil memperlakukannya sebagai "tidak ada snapshot berkas",
   * bukan sebagai daftar kosong: keduanya berbeda, dan yang kedua berarti
   * "peserta tidak punya berkas".
   */
  daftarBerkas(minta: MintaWorkspace): Promise<string | null>;
}

/** Nada visual, supaya komponen tidak memilih warna dari teks. */
export type NadaWorkspace = "info" | "galat";

export interface PetakanWorkspace {
  judul: string;
  nada: NadaWorkspace;
  detail?: string;
}

/**
 * Pesan untuk peserta.
 *
 * Kalimatnya menyatakan peristiwa, bukan menyalahkan orang — aturan yang sama
 * dengan `petakanStatus` di `@/lib/exec/port`, dan alasannya sama: batas
 * kapasitas adalah limit pelayanan, bukan kesalahan peserta.
 *
 * `penuh` sengaja menyebut angkanya di `detail`. Tanpa angka, "sedang penuh"
 * terbaca seperti kegagalan acak; dengan angka, peserta tahu ini batas yang
 * direncanakan dan tahu apa yang bisa ia lakukan (menutup ruang kerja lain,
 * atau menunggu).
 *
 * `galat_manajer` adalah satu-satunya yang berarti "layanan tidak tersedia",
 * dan ia tidak menyebut sebabnya: podman yang mati, image yang hilang, dan
 * disk yang penuh semuanya satu peristiwa bagi peserta.
 */
export function petakanWorkspace(
  status: StatusWorkspace,
  batasSerentak?: number,
): PetakanWorkspace {
  switch (status) {
    case "ok":
      return { judul: "Ruang kerja siap.", nada: "info" };
    case "penuh":
      return {
        judul: "Ruang kerja sedang penuh.",
        nada: "info",
        detail:
          batasSerentak === undefined
            ? "Coba lagi setelah ruang kerja lain ditutup."
            : `Mesin ini melayani ${String(batasSerentak)} ruang kerja sekaligus. ` +
              "Tutup ruang kerja lain atau coba lagi sebentar lagi.",
      };
    case "terkunci":
      return {
        judul: "Ruang kerja ini belum terbuka.",
        nada: "info",
        detail:
          "Ruang kerja dibuka oleh Project course, dan Project terbuka setelah " +
          "course selesai lewat jalur terverifikasi.",
      };
    case "tidak_sah":
      return { judul: "Permintaan ruang kerja tidak sah.", nada: "galat" };
    case "galat_manajer":
      return {
        judul: "Layanan ruang kerja sedang tidak tersedia.",
        nada: "galat",
        detail: "Coba lagi sebentar lagi.",
      };
  }
}
