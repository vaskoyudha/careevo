/**
 * Perhitungan skor kejujuran — **murni**.
 *
 * Skor **tidak pernah disimpan**. Ia selalu diturunkan dari baris pelanggaran
 * yang berstatus `active`, dan itulah yang membuat aturan pemulihan bekerja:
 * begitu suatu pelanggaran dipulihkan (`expunged`), barisnya berhenti dihitung dan
 * skor otomatis kembali. Menyimpan angka skor sebagai kolom mutable akan
 * membutuhkan penulisan ulang setiap kali ada pemulihan, dan dua jalur
 * penulisan itu pasti akan menyimpang diam-diam.
 *
 * Yang dikunci di sini:
 *
 * - **Batas 20 poin per course.** Satu course yang ramai tidak boleh menghapus
 *   seluruh skor. Ini analogi IPK: satu mata kuliah punya dampak terbatas.
 *   Penjepitan terjadi **per course**, bukan pada total — kalau penjepitan ada
 *   di total, batas itu sebenarnya hanya membatasi seluruh akun.
 * - **Baris rusak tidak menambah dan tidak mengurangi.** Penalti negatif,
 *   non-finite, dan baris tanpa `course_id` diabaikan (careevo-review §7).
 *   Penalti negatif yang lolos akan menaikkan skor di atas 100, dan baris tanpa
 *   `course_id` tidak punya tempat untuk dipulihkan sehingga skornya tidak akan
 *   pernah bisa naik kembali.
 * - **Skor dijepit 0–100.** Angka negatif tidak punya arti pada skala ini.
 * - **Rincian per course berasal dari hitungan yang sama** dengan `skor`, bukan
 *   dari hitungan kedua, supaya kolom tabel report yang dijumlahkan manual selalu
 *   sama dengan angka besar yang ditampilkan.
 *
 * `now` tidak pernah dipanggil di sini: pemanggil yang memutuskan waktu. Modul
 * ini juga tidak menyentuh database, `node:fs`, atau `next/headers`.
 */

import { KATALOG_PELANGGARAN } from "./katalog";

/** Skor sebelum pelanggaran apa pun. Angka tetap, bukan hasil hitungan. */
export const SKOR_AWAL = 100;

/** Penalti maksimum dari satu course, berapa pun jumlah pelanggannya. */
export const BATAS_PENALTI_PER_COURSE = 20;

/**
 * Bentuk minimum satu baris `integrity_violations` yang dibutuhkan perhitungan.
 *
 * Sengaja lebih sempit dari baris tabel penuh: modul ini tidak butuh `kind`,
 * `reason`, maupun `reviewerUserId`, dan dengan tidak mengambilnya ia tidak bisa
 * ikut membaca (atau salah membandingkan) data yang tidak ada hubungannya dengan
 * skor.
 */
export interface BarisPelanggaran {
  id: string;
  courseId: string;
  /** Snapshot bobot saat dicatat — bukan bobot dari katalog saat ini. */
  penalty: number;
  status: "active" | "expunged";
}

/** Satu course dalam rincian, sudah memakai aturan batas per course. */
export interface RincianCourse {
  courseId: string;
  /** Jumlah baris pelanggaran aktif di course ini. */
  jumlah: number;
  /** Penjumlahan bobot sebelum batas per course. */
  penaltiMentah: number;
  /** Setelah batas 20 — inilah yang benar-benar memotong skor. */
  penaltiDiterapkan: number;
  /** Penalti yang dipotong oleh batas per course. */
  dipotong: boolean;
}

export interface RingkasanSkor {
  /** 0–100, sudah dijepit. */
  skor: number;
  /** Total penalti yang terpakai, bisa lebih besar dari 100 pada akun berat. */
  penaltiTotal: number;
  /** Jumlah baris pelanggaran aktif yang ikut dihitung. */
  jumlahAktif: number;
  /** Per course, dari penalti terbesar. */
  perCourse: RincianCourse[];
}

/** Penalti yang layak dihitung: positif, finite, dan punya course. */
function penaltiLayak(baris: BarisPelanggaran): number {
  const { penalty, courseId } = baris;
  if (typeof penalty !== "number" || !Number.isFinite(penalty) || penalty <= 0) return 0;
  if (typeof courseId !== "string" || courseId.trim() === "") return 0;
  return penalty;
}

/**
 * Skor kejujuran dari daftar pelanggaran.
 *
 * Hanya baris `active` yang dihitung; `expunged` sengaja diteruskan ke sini
 * (bukan difilter pemanggil) supaya satu tempat yang memutuskan apa yang
 * dihitung.
 */
export function hitungSkorIntegritas(
  baris: readonly BarisPelanggaran[],
): RingkasanSkor {
  const perCourse = new Map<string, { jumlah: number; mentah: number }>();
  let jumlahAktif = 0;

  for (const b of baris) {
    if (b.status !== "active") continue;
    const bobot = penaltiLayak(b);
    if (bobot === 0) continue;
    const isi = perCourse.get(b.courseId) ?? { jumlah: 0, mentah: 0 };
    isi.jumlah += 1;
    isi.mentah += bobot;
    perCourse.set(b.courseId, isi);
    jumlahAktif += 1;
  }

  const rincian: RincianCourse[] = [...perCourse.entries()]
    .map(([courseId, isi]) => {
      const diterapkan = Math.min(isi.mentah, BATAS_PENALTI_PER_COURSE);
      return {
        courseId,
        jumlah: isi.jumlah,
        penaltiMentah: isi.mentah,
        penaltiDiterapkan: diterapkan,
        dipotong: isi.mentah > BATAS_PENALTI_PER_COURSE,
      };
    })
    .sort((a, b) => b.penaltiDiterapkan - a.penaltiDiterapkan || a.courseId.localeCompare(b.courseId));

  const penaltiTotal = rincian.reduce((n, r) => n + r.penaltiDiterapkan, 0);
  const skor = Math.max(0, Math.min(SKOR_AWAL, SKOR_AWAL - penaltiTotal));

  return { skor, penaltiTotal, jumlahAktif, perCourse: rincian };
}

/**
 * Bentuk satu baris pelanggaran **beserta waktunya**, untuk skor pada satu
 * titik waktu.
 *
 * `BarisPelanggaran` sengaja tidak punya `created_at`, dan itu bukan kelalaian:
 * skor hari ini tidak butuh waktu, hanya status. Skor *masa lalu* butuh, jadi
 * tipe yang lebih lebar dipisahkan di sini alih-alih melebarkan
 * `BarisPelanggaran` untuk semua pemanggil.
 */
export interface BarisPelanggaranBertanggal extends BarisPelanggaran {
  createdAt: Date;
  /** `null` selama baris masih aktif. */
  expungedAt: Date | null;
}

/**
 * Skor kejujuran **sebagaimana pada saat `saat`**.
 *
 * Dipakai kartu dashboard untuk delta "dari minggu lalu". Aturannya sama persis
 * dengan skor hari ini — penalti per course, penjepitan 0–100 — yang berubah
 * hanya *baris mana yang berlaku*:
 *
 * - Baris yang **belum dicatat** pada `saat` itu belum ada, jadi tidak memotong.
 * - Baris yang **sudah dipulihkan sebelum** `saat` itu sudah tidak berlaku.
 *   Baris yang dipulihkan *sesudah* `saat` masih memotong pada saat itu — itu
 *   justru isi dari cerita "skornya naik kembali".
 *
 * Hasilnya diturunkan dengan memanggil `hitungSkorIntegritas` yang sama, bukan
 * hitungan kedua: dua implementasi penjepitan per course pasti akan menyimpang,
 * dan yang menyimpang adalah angka yang dilihat peserta.
 *
 * `saat` yang tidak terbaca menghasilkan skor penuh: baris yang tidak bisa
 * dibandingkan tidak boleh memotong apa pun.
 */
export function skorPada(
  baris: readonly BarisPelanggaranBertanggal[],
  saat: Date,
): RingkasanSkor {
  const batas = saat instanceof Date ? saat.getTime() : Number.NaN;
  if (!Number.isFinite(batas)) return hitungSkorIntegritas([]);

  const berlaku: BarisPelanggaran[] = [];
  for (const b of baris) {
    const dibuat = b.createdAt instanceof Date ? b.createdAt.getTime() : Number.NaN;
    // Baris tanpa waktu dibuat tidak bisa ditempatkan di titik mana pun. Ia
    // dibuang, bukan dipaksa ikut: memasukkannya berarti mengarang riwayat.
    if (!Number.isFinite(dibuat) || dibuat > batas) continue;

    if (b.status !== "active") {
      const dipulihkan =
        b.expungedAt instanceof Date ? b.expungedAt.getTime() : Number.NaN;
      // Sudah dipulihkan sebelum `saat` → tidak lagi memotong. Dipulihkan
      // sesudahnya → pada `saat` itu ia **masih berlaku**.
      if (!Number.isFinite(dipulihkan) || dipulihkan <= batas) continue;
    }

    // Statusnya dinormalkan ke `active` di sini, dan itu bukan penyamaran:
    // pertanyaan `skorPada` adalah "baris mana yang berlaku pada `saat`", dan
    // baris yang baru dipulihkan sesudah `saat` memang berlaku saat itu. Tanpa
    // normalisasi ini, `hitungSkorIntegritas` akan melewatinya karena statusnya
    // `expunged` — dan skor masa lalu terbaca terlalu tinggi.
    berlaku.push({ id: b.id, courseId: b.courseId, penalty: b.penalty, status: "active" });
  }

  return hitungSkorIntegritas(berlaku);
}

/**
 * Tingkat skor untuk label ringkas di kartu dashboard.
 *
 * **Turunan dari `skor` yang sama**, bukan hitungan kedua: satu tempat yang
 * memutuskan batas tingkat, sehingga chip di kartu dan angka besar di bawahnya
 * tidak bisa menyimpang. Batasnya sengaja lebar di puncak — akun dengan catatan
 * bersih tidak boleh kehilangan label "Sangat Baik" hanya karena satu pemotongan
 * kecil.
 *
 * Labelnya menyatakan **kondisi catatan**, bukan vonis: kata yang dilarang
 * `katalog.test.ts` tidak muncul di sini, dan "Baik" tidak berarti "tidak pernah
 * salah" — kalimat penjelas di kartu yang menanggung arti itu.
 */
export function tingkatSkor(skor: number): "sangat-baik" | "baik" | "perhatian" {
  if (skor >= 90) return "sangat-baik";
  if (skor >= 70) return "baik";
  return "perhatian";
}

/** Label Indonesia untuk `tingkatSkor`. */
export function labelTingkatSkor(skor: number): string {
  const tingkat = tingkatSkor(skor);
  if (tingkat === "sangat-baik") return "Sangat Baik";
  if (tingkat === "baik") return "Baik";
  return "Perlu perhatian";
}

/**
 * Skor(kursus saja) untuk satu course — dipakai kartu ringkas di halaman course.
 *
 * Mengambil baris yang sama persis dengan yang jadi skor akun, jadi angka di
 * course page dan angka di dashboard tidak mungkin berbeda untuk course yang sama.
 */
export function skorUntukCourse(
  baris: readonly BarisPelanggaran[],
  courseId: string,
): { skor: number; penalti: number; jumlah: number } {
  const hasil = hitungSkorIntegritas(baris.filter((b) => b.courseId === courseId));
  return {
    skor: hasil.skor,
    penalti: hasil.penaltiTotal,
    jumlah: hasil.jumlahAktif,
  };
}

/**
 * Label untuk satu tingkat — dipakai chip di UI.
 *
 * Berada di modul ini supaya tiering tidak ditulis ulang di tiap komponen.
 * `tingkatPelanggaranValid` menjaga agar nilai dari database yang tak dikenal
 * tidak punya label.
 */
export function labelTingkat(tingkat: string): string | null {
  if (tingkat === "ringan") return "Ringan";
  if (tingkat === "sedang") return "Sedang";
  if (tingkat === "berat") return "Berat";
  return null;
}

/**
 * Bobot yang akan dipakai untuk satu jenis.
 *
 * Catatan: pemanggil sudah memvalidasi jenisnya sebelum menulis baris, jadi
 * fungsi ini hanya menjawab "kalau jenis ini sah, bobotnya berapa" untuk
 * form reviewer. Jenis asing menghasilkan `null`, bukan bobot default — bobot
 * default akan diam-diam mencatat pelanggaran dengan nilai yang tidak disetujui
 * siapa pun.
 */
export function bobotUntukJenis(jenis: string): number | null {
  const definisi = Object.hasOwn(KATALOG_PELANGGARAN, jenis)
    ? KATALOG_PELANGGARAN[jenis as keyof typeof KATALOG_PELANGGARAN]
    : null;
  return definisi?.bobot ?? null;
}
