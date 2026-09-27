/**
 * Application service integritas — **server-only**.
 *
 * Permukaan yang dipanggil Server Action, halaman, dan hook completion. Empat
 * layer, satu untuk setiap tanggung jawab:
 *
 * - `katalog.ts` (murni) — jenis pelanggaran & bobotnya.
 * - `skor.ts` (murni) — hitungan skor dari baris yang sudah dibaca.
 * - `repository.ts` — satu-satunya yang menyentuh database.
 * - `service.ts` (**berkas ini**) — otorisasi, penyaringan, transaksi, dan
 *   snapshot penalti.
 *
 * Aturan yang dikunci:
 *
 * - **Hanya staf yang bisa menulis.** Menurunkan skor orang adalah keputusan
 *   yang merugikan, jadi ia tidak pernah berasal dari peran yang sama dengan
 *   yang dirugikan. Gate membaca `principal.roles` dari database (bukan
 *   `principal.role`, adapter kompatibilitas dari cookie) supaya pencabutan role
 *   berlaku pada permintaan berikutnya.
 * - **Penalti disalin dari katalog, tidak pernah diterima dari klien.** Baris
 *   menyimpan snapshot bobot saat dicatat, sehingga mengubah bobot di katalog
 *   tidak menulis ulang keputusan lama.
 * - **Perubahan + audit dalam satu transaksi.** `catatPelanggaran` dan
 *   `catatAudit` commit bersama; audit yang gagal berarti catatan yang gagal.
 * - **Pemulihan adalah `UPDATE status`, bukan `DELETE`.** Baris yang pernah ada
 *   tetap bisa diaudit; hanya bobotnya yang berhenti berlaku.
 */

import { denganTransaksi, getDb } from "@/lib/db/client";
import { catatAudit, saringPayloadAudit } from "@/lib/auth/audit";
import { punyaRoleStaff } from "@/lib/auth/authorization";
import { ambilRolesAktif } from "@/lib/auth/identity-repository";
import { hanyaRoleSah } from "@/lib/auth/principal";
import { ambilEnrollment } from "@/lib/learning/repository";
import type { KejadianIntegritas } from "@/lib/learning/session";
import type { SessionPrincipal } from "@/lib/auth/principal";
import type { IntegrityViolation } from "@/lib/db/schema";
import {
  DAFTAR_PELANGGARAN,
  jenisPelanggaranValid,
  type DefinisiPelanggaran,
  type JenisPelanggaran,
} from "./katalog";
import { hitungSkorIntegritas, skorPada, type RingkasanSkor } from "./skor";
import { deteksiUsulan } from "./deteksi";
import {
  catatPelanggaran,
  konfirmasiPelanggaran,
  listPelanggaranAktif,
  listPelanggaranCourse,
  listPelanggaranProposed,
  listSemuaPelanggaran as listSemuaPelanggaranDb,
  pulihkanPelanggaran,
  pulihkanSemuaPelanggaranCourse,
  tolakUsulan,
  usulkanPelanggaran,
} from "./repository";

/** Galat domain yang dipetakan ke pesan berbahasa Indonesia oleh pemanggil. */
export class GalatIntegritas extends Error {
  constructor(
    readonly kode:
      | "akses_ditolak"
      | "jenis_tidak_sah"
      | "alasan_wajib"
      | "enrollment_tidak_cocok"
      | "pelanggaran_tidak_ditemukan",
    message: string,
  ) {
    super(message);
    this.name = "GalatIntegritas";
  }
}

/**
 * Pastikan principal adalah staf aktif.
 *
 * `roles` (dari database) adalah satu-satunya sumber. `principal.role` sengaja
 * tidak dipakai: ia adapter kompatibilitas dari cookie bertanda tangan yang
 * tidak bisa mencabut role sampai kedaluwarsa, dan keputusan yang menurunkan
 * skor orang tidak boleh bergantung pada mechanism itu.
 */
async function wajibStaf(principal: SessionPrincipal): Promise<string> {
  if (!principal?.userId) {
    throw new GalatIntegritas("akses_ditolak", "Akses ditolak.");
  }
  // Role dari principal sudah difilter oleh `hanyaRoleSah`; daftar kosong
  // berarti tidak memegang role staff sama sekali.
  if (!punyaRoleStaff(principal.roles ?? [])) {
    throw new GalatIntegritas("akses_ditolak", "Akses ditolak: hanya verifikator atau admin.");
  }
  // Baca ulang dari database: `roles` pada principal bisa sudah basi bila role
  // dicabut di tengah sesi berjalan, dan role yang sudah dicabut harus gagal.
  // `hanyaRoleSah` yang menyaring, persis seperti di `getSession()` — daftar
  // yang tidak disaring akan membuat `punyaRoleStaff` menerima sembarang teks.
  const roles = hanyaRoleSah(await ambilRolesAktif(getDb(), principal.userId));
  if (!punyaRoleStaff(roles)) {
    throw new GalatIntegritas("akses_ditolak", "Akses ditolak: role sudah tidak berlaku.");
  }
  return principal.userId;
}

/* ------------------------------------------------------------------ *
 * Baca
 * ------------------------------------------------------------------ */

/**
 * Riwayat lengkap (aktif + dipulihkan) seorang user, untuk laporan staf.
 *
 * Diekspor untuk integrasi test dan audit internal; halaman tidak pernah
 * memanggilnya dengan `userId` dari input klien — dashboard dan halaman course
 * memakai `skorIntegritasDb` / `ringkasanPelanggaranCourseDb` yang sudah
 * terikat ke principal.
 */
export async function listSemuaPelanggaran(
  userId: string,
): Promise<IntegrityViolation[]> {
  return listSemuaPelanggaranDb(userId);
}

/**
 * Status baris untuk perhitungan skor: hanya `active` yang dihitung.
 *
 * ## Kenapa bukan `b.status === "expunged" ? "expunged" : "active"`
 *
 * Bentuk lama itu benar ketika hanya ada dua status, dan **berbahaya** begitu
 * `proposed`/`dismissed` masuk: keduanya akan jatuh ke cabang `"active"` dan ikut
 * memotong skor — persis hal yang tidak boleh terjadi, karena Stage 1 dan Stage 2
 *玻璃-kan berjalan tanpa manusia. Penalti yang bergerak tanpa keputusan manusia
 * berarti mematikan JavaScript menaikkan skor sendiri.
 *
 * Sebaliknya, `expunged` diteruskan apa adanya: `hitungSkorIntegritas` yang
 * memfilternya, jadi hanya satu tempat yang memutuskan apa yang dihitung.
 */
function keBarisSkor(baris: readonly IntegrityViolation[]) {
  return baris.map((b) => ({
    id: b.id,
    courseId: b.courseId,
    penalty: b.penalty,
    status: b.status === "active" ? ("active" as const) : ("expunged" as const),
  }));
}

/**
 * Skor kejujuran seorang user.
 *
 * Membaca **hanya** `integrity_violations.active` — bukan `learning_events`.
 * Sinyal peramban adalah rekaman yang bisa dimatikan peserta, jadi menjadikannya
 * skor berarti orang bisa menaikkan skornya sendiri dengan mematikan JavaScript.
 */
export async function skorIntegritasDb(userId: string): Promise<RingkasanSkor> {
  const aktif = await listPelanggaranAktif(userId);
  return hitungSkorIntegritas(keBarisSkor(aktif));
}

/**
 * Skor kejujuran seorang user **beserta perubahannya dari sepekan lalu**.
 *
 * `skor` selalu sama dengan `skorIntegritasDb` untuk akun yang sama — keduanya
 * memanggil `hitungSkorIntegritas` atas baris aktif yang sama. Yang ditambahkan
 * di sini hanya pembanding historis, dan pembanding itu tetap diturunkan dari
 * **baris yang benar-benar ada**, bukan dari angka yang disimpan:
 *
 * - `skorSebelumnya` adalah skor sebagaimana pada `sekarang - 7 hari`, dihitung
 *   `skorPada` dari `created_at`/`expunged_at` tiap baris.
 * - `delta` hanya diisi bila pembandingnya bermakna. Kalau akun ini **belum
 *   pernah punya satu pun baris** pelanggaran, delta-nya `null`: "0 dari minggu
 *   lalu" pada akun bersih adalah klaim kosong, dan chip "+0" di kartu hanya
 *   jadi derau yang harus dibaca tanpa memberi tahu apa pun.
 *
 * Pembacaan memakai `listSemuaPelanggaran` (aktif **dan** dipulihkan) karena
 * baris yang dipulihkan *sesudah* titik pembanding masih berlaku pada titik itu.
 */
export async function skorIntegritasDenganDelta(
  userId: string,
  opsi: { sekarang?: Date; hariPembanding?: number } = {},
): Promise<RingkasanSkor & { skorSebelumnya: number | null; delta: number | null }> {
  const sekarang = opsi.sekarang ?? new Date();
  const hari = opsi.hariPembanding ?? 7;

  const semua = await listSemuaPelanggaran(userId);

  // Akun tanpa riwayat pelanggaran sama sekali tidak punya cerita pembanding.
  if (semua.length === 0) {
    return { ...hitungSkorIntegritas([]), skorSebelumnya: null, delta: null };
  }

  const ringkasan = hitungSkorIntegritas(keBarisSkor(semua.filter((b) => b.status === "active")));

  const titik = new Date(sekarang.getTime() - hari * 86_400_000);
  const sebelumnya = skorPada(
    semua.map((b) => ({
      id: b.id,
      courseId: b.courseId,
      penalty: b.penalty,
      status: b.status === "active" ? ("active" as const) : ("expunged" as const),
      createdAt: b.createdAt,
      expungedAt: b.expungedAt,
    })),
    titik,
  );

  return {
    ...ringkasan,
    skorSebelumnya: sebelumnya.skor,
    delta: ringkasan.skor - sebelumnya.skor,
  };
}

/**
 * Skor kejujuran seorang user **sebagaimana pada saat `saat`**.
 *
 * Dipakai sertifikat: yang dicetak adalah keadaan kejujuran **ketika kredensial
 * diterbitkan**, bukan hari ini. Tanpa ini, sertifikat 2026 yang dicetak saat
 * akun bersih akan berubah angkanya setelah pelanggaran 2027 — dan dokumen yang
 * isinya bergerak tidak bisa diverifikasi siapa pun.
 *
 * Diturunkan dari `skorPada` yang sudah ada, bukan hitungan kedua: dua
 * implementasi penjepitan per course pasti akan menyimpang.
 */
export async function skorIntegritasPada(
  userId: string,
  saat: Date,
): Promise<RingkasanSkor> {
  const semua = await listSemuaPelanggaran(userId);
  return keBarisSkorBertanggal(semua, saat);
}

/**
 * Ringkasan integritas untuk satu sertifikat: skor **saat terbit**, skor
 * **sekarang**, dan rincian per jenis katalog.
 *
 * `perJenis` memakai katalog utuh (termasuk yang nol) supaya pembaca bisa
 * membedakan "tidak ada catatan" dari "kategori ini belum ada" — aturan yang
 * sama dengan `ringkasanPelanggaranCourseDb`.
 *
 * **Dua cakupan, dan bedanya disengaja.** Skor adalah properti **akun** —
 * `hitungSkorIntegritas` menjepit per course lalu menjumlahkannya, jadi
 * memotongnya ke satu course akan mengubah arti angka yang sudah dikunci. Yang
 * dicakupkan ke course hanyalah `perJenis`; lihat `integritasSertifikatDb`.
 */
export interface IntegritasSertifikat {
  skorSaatTerbit: number;
  skorSekarang: number;
  jumlahAktifSaatTerbit: number;
  perJenis: Array<{ jenis: JenisPelanggaran; label: string; jumlah: number }>;
  /**
   * Penalti yang benar-benar memotong skor saat terbit, dipecah menurut cakupan.
   *
   * Keduanya berasal dari `saat.perCourse` — hitungan yang **sama** dengan yang
   * menghasilkan `skorSaatTerbit`, bukan hitungan kedua. Jadi
   * `skorSaatTerbit === 100 − penaltiCourseIni − penaltiCourseLain` selalu benar,
   * dan pembaca bisa menjumlahkan sendiri.
   *
   * Tanpa ini, panel menampilkan angka yang tidak bisa direkonsiliasi: skor
   * memuat course lain, sementara daftar baris hanya course ini. Pembaca yang
   * teliti akan menemukan selisih dan menyimpulkan ada yang disembunyikan —
   * padahal tidak.
   */
  penaltiCourseIni: number;
  penaltiCourseLain: number;
}

/**
 * @param courseId Course yang dicakup `perJenis`. **Hanya `perJenis`, bukan
 *   skornya.** Sertifikat menyebut satu course, jadi baris rincian harus
 *   menyebut catatan course itu; tanpa ini, sertifikat "Keamanan Aplikasi" bisa
 *   menampilkan catatan dari course UI/UX dan terbaca seolah pelanggarannya
 *   terjadi di course yang disertifikasi.
 *
 *   Skor sengaja **tidak** dipotong ke course. `hitungSkorIntegritas` menjepit
 *   penalti per course lalu menjumlahkannya (`BATAS_PENALTI_PER_COURSE`), jadi
 *   memotong input ke satu course menghasilkan angka yang berbeda dari "skor
 *   kejujuran akun ini". Angka itu aturan yang sudah dikunci — mengubahnya
 *   karena alasan tata letak akan membuat dua sertifikat menyebut skor berbeda
 *   untuk akun yang sama.
 *
 *   Diberikan `courseId` dari `payload.task_id` yang **ditandatangani**: staf
 *   tidak boleh bisa membuat sertifikat menyebut course lain.
 */
export async function integritasSertifikatDb(
  userId: string,
  saatTerbit: Date,
  courseId?: string,
): Promise<IntegritasSertifikat> {
  const semua = await listSemuaPelanggaran(userId);
  const saat = keBarisSkorBertanggal(semua, saatTerbit);
  const sekarang = hitungSkorIntegritas(
    keBarisSkor(semua.filter((b) => b.status === "active")),
  );

  const hitung = new Map<JenisPelanggaran, number>();
  for (const b of semua) {
    if (b.status !== "active" || !jenisPelanggaranValid(b.kind)) continue;
    if (courseId !== undefined && b.courseId !== courseId) continue;
    const dibuat = b.createdAt instanceof Date ? b.createdAt.getTime() : Number.NaN;
    if (!Number.isFinite(dibuat) || dibuat > saatTerbit.getTime()) continue;
    hitung.set(b.kind, (hitung.get(b.kind) ?? 0) + 1);
  }

  return {
    skorSaatTerbit: saat.skor,
    skorSekarang: sekarang.skor,
    jumlahAktifSaatTerbit: saat.jumlahAktif,
    perJenis: DAFTAR_PELANGGARAN.map((d) => ({
      jenis: d.jenis,
      label: d.label,
      jumlah: hitung.get(d.jenis) ?? 0,
    })),
    // Diambil dari `saat.perCourse` — penjumlahan yang sama dengan yang dipakai
    // `skorSaatTerbit`. Menghitung ulang dari baris di sini akan menciptakan
    // hitungan kedua, dan dua hitungan penjepitan per course pasti menyimpang.
    penaltiCourseIni: saat.perCourse
      .filter((c) => courseId !== undefined && c.courseId === courseId)
      .reduce((n, c) => n + c.penaltiDiterapkan, 0),
    penaltiCourseLain: saat.perCourse
      .filter((c) => courseId === undefined || c.courseId !== courseId)
      .reduce((n, c) => n + c.penaltiDiterapkan, 0),
  };
}

/** Varian murni dari `skorIntegritasPada` yang menerima baris yang sudah dibaca. */
function keBarisSkorBertanggal(
  semua: readonly IntegrityViolation[],
  saat: Date,
): RingkasanSkor {
  return skorPada(
    semua.map((b) => ({
      id: b.id,
      courseId: b.courseId,
      penalty: b.penalty,
      status: b.status === "active" ? ("active" as const) : ("expunged" as const),
      createdAt: b.createdAt,
      expungedAt: b.expungedAt,
    })),
    saat,
  );
}

/**
 * Satu baris tabel report: satu jenis katalog, dengan hitungannya.
 *
 * Ekstensinya `DefinisiPelanggaran` (nilai), bukan indeks dari array — TypeScript
 * hanya bisa meng-`extend` nama yang punya tipe argumen opsional, dan
 * `(typeof DAFTAR_PELANGGARAN)[number]` bukan salah satunya.
 */
export interface BarisPelanggaran extends DefinisiPelanggaran {
  /** Jumlah baris tercatat untuk jenis ini, semua status ikut. */
  jumlah: number;
  /**
   * Yang **sudah diputuskan manusia dan masih memotong skor**.
   *
   * Bukan kebalikan dari `jumlahDipulihkan`: `proposed` dan `dismissed` bukan
   * salah satu dari keduanya, jadi keduanya dihitung sendiri di
   * `jumlahBelumPutus`.
   */
  jumlahAktif: number;
  /** Yang sudah dipulihkan. */
  jumlahDipulihkan: number;
  /** Usulan otomatis yang belum diputuskan (`proposed`). */
  jumlahBelumPutus: number;
  /** Usulan yang ditolak verifikator (`dismissed`). */
  jumlahDitolak: number;
}

/**
 * Tabel report pelanggaran untuk satu course.
 *
 * **Selalu tepat satu baris per jenis katalog**, termasuk yang nol. Katalog
 * yang utuh adalah disengaja: "0" adalah informasi yang berarti ("tidak ada
 * catatan jenis ini"), sedangkan baris yang hilang membuat peserta tidak bisa
 * membedakan "tidak ada" dari "produk belum punya kategori ini".
 *
 * Hanya baris milik `userId` pada `courseId` itu yang dibaca. Baris yang tidak
 * dikenal jenisnya **tidak** ikut: ia akan muncul di daftar sebagai "jenis lain"
 * supaya angka total tetap sama dengan yang tercatat di database.
 */
export async function ringkasanPelanggaranCourseDb(
  userId: string,
  courseId: string,
): Promise<BarisPelanggaran[]> {
  const baris = await listPelanggaranCourse(userId, courseId);

  const hitung = new Map<
    JenisPelanggaran,
    {
      jumlah: number;
      jumlahAktif: number;
      jumlahDipulihkan: number;
      jumlahBelumPutus: number;
      jumlahDitolak: number;
    }
  >();

  for (const b of baris) {
    if (!jenisPelanggaranValid(b.kind)) continue;
    const isi = hitung.get(b.kind) ?? {
      jumlah: 0,
      jumlahAktif: 0,
      jumlahDipulihkan: 0,
      jumlahBelumPutus: 0,
      jumlahDitolak: 0,
    };
    isi.jumlah += 1;
    // Empat status, empat tempat — bukan `else`. `else` di sini akan menghitung
    // `proposed` sebagai "aktif", dan tabel akan menampilkan usulan yang belum
    // diputuskan seolah sudah memotong skor.
    if (b.status === "active") isi.jumlahAktif += 1;
    else if (b.status === "expunged") isi.jumlahDipulihkan += 1;
    else if (b.status === "proposed") isi.jumlahBelumPutus += 1;
    else if (b.status === "dismissed") isi.jumlahDitolak += 1;
    hitung.set(b.kind, isi);
  }

  return DAFTAR_PELANGGARAN.map((definisi) => {
    const isi = hitung.get(definisi.jenis);
    return {
      ...definisi,
      jumlah: isi?.jumlah ?? 0,
      jumlahAktif: isi?.jumlahAktif ?? 0,
      jumlahDipulihkan: isi?.jumlahDipulihkan ?? 0,
      jumlahBelumPutus: isi?.jumlahBelumPutus ?? 0,
      jumlahDitolak: isi?.jumlahDitolak ?? 0,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Tulis (staf)
 * ------------------------------------------------------------------ */

/**
 * Catat satu pelanggaran integritas.
 *
 * `kind` dan `reason` berasal dari form reviewer; **penalti tidak pernah**.
 * Bobot disalin dari katalog ke dalam baris, jadi jawaban yang tersimpan
 * kalimat "seorang staf memutuskan bahwa ini plagiarism, berbobot 20" — bukan
 * "form pernah mengirim angka 20".
 */
export async function catatPelanggaranDb(input: {
  principal: SessionPrincipal;
  userId: string;
  courseId: string;
  kind: string;
  reason: string;
  /** Pointer ke `learning_events` / `quiz_attempts`; disaring sebelum disimpan. */
  bukti?: Record<string, unknown> | null;
}): Promise<IntegrityViolation> {
  const reviewerUserId = await wajibStaf(input.principal);

  if (!jenisPelanggaranValid(input.kind)) {
    throw new GalatIntegritas("jenis_tidak_sah", "Jenis pelanggaran tidak dikenal.");
  }
  // Type-guard di atas sudah menyempitkan `input.kind`; variabelnya yang dipakai
  // seterusnya supaya TypeScript ikut tahu, dan supaya tidak ada pembacaan
  // `input.kind` lagi yang harus di-cast.
  const kind: JenisPelanggaran = input.kind;
  const reason = input.reason?.trim() ?? "";
  if (reason === "") {
    throw new GalatIntegritas("alasan_wajib", "Tuliskan alasan singkat yang bisa ditinjau.");
  }
  if (input.courseId.trim() === "") {
    throw new GalatIntegritas("jenis_tidak_sah", "Course tidak boleh kosong.");
  }

  // Peserta harus benar-benar punya enrollment di course itu. Tanpa cek ini,
  // `enrollment_id` bisa berasal dari course lain, dan pemulihan otomatis pada
  // course yang salah akan menghapus dari akun yang bukan miliknya.
  const enrollment = await ambilEnrollment(input.userId, input.courseId);
  if (!enrollment || enrollment.userId !== input.userId) {
    throw new GalatIntegritas(
      "enrollment_tidak_cocok",
      "Peserta tidak terdaftar pada course ini.",
    );
  }

  return denganTransaksi(async (tx) => {
    const baris = await catatPelanggaran(tx, {
      userId: input.userId,
      courseId: input.courseId,
      enrollmentId: enrollment.id,
      kind,
      // Di-snapshot di sini: nilai katalog **saat ini**, bukan yang dipanggil.
      penalty: DAFTAR_PELANGGARAN.find((d) => d.jenis === kind)!.bobot,
      reason,
      reviewerUserId,
      evidenceRedacted: input.bukti ? saringPayloadAudit(input.bukti) : null,
    });

    await catatAudit(tx, {
      actorUserId: reviewerUserId,
      action: "integrity_violation.recorded",
      entityType: "integrity_violation",
      entityId: baris.id,
      payloadRedacted: {
        user_id: input.userId,
        course_id: input.courseId,
        kind,
        penalty: baris.penalty,
      },
    });

    return baris;
  });
}

/** Cabut satu pelanggaran — hanya staf, dengan alasan yang wajib ada. */
export async function pulihkanPelanggaranDb(input: {
  principal: SessionPrincipal;
  id: string;
  alasan: string;
}): Promise<IntegrityViolation | null> {
  const actorUserId = await wajibStaf(input.principal);
  const alasan = input.alasan?.trim() ?? "";
  if (alasan === "") {
    throw new GalatIntegritas("alasan_wajib", "Tuliskan alasan pemulihan.");
  }

  return denganTransaksi(async (tx) => {
    const hasil = await pulihkanPelanggaran(tx, { id: input.id, alasan });
    await catatAudit(tx, {
      actorUserId,
      action: "integrity_violation.expunged",
      entityType: "integrity_violation",
      entityId: input.id,
      payloadRedacted: { alasan },
    });
    return hasil;
  });
}

/* ------------------------------------------------------------------ *
 * Stage 1 — deteksi otomatis (sistem)
 * ------------------------------------------------------------------ */

/**
 * Usulkan pelanggaran dari rekaman sesi — **Stage 1, tanpa staf**.
 *
 * ## Aturan yang tidak bisa dilanggar di sini
 *
 * 1. **Tidak ada `wajibStaf`.** Fungsi ini dipanggil sistem, bukan manusia, jadi
 *    tidak ada `principal` untuk diperiksa. Itu justru alasan barisnya berstatus
 *    `proposed`: penalti belum bergerak.
 * 2. **Skor tidak bergerak.** Baris ditulis `proposed`, dan `hitungSkorIntegritas`
 *    hanya menghitung `active`. Kalau Stage 1 boleh memotong skor, mematikan
 *    JavaScript akan menaikkan skor sendiri — seluruh sinyalnya dilaporkan
 *    peramban.
 * 3. **Tidak melempar.** Session end bukan tempat gagal. Kalau pencatatan usulan
 *    gagal, sesi tetap selesai dicatat dan verifikasi tetap terjadi; yang hilang
 *    hanya usulan yang bisa dilihat staf.
 * 4. **Idempoten per (user, course, jenis).** Sesi bisa berakhir lebih dari sekali
 *    (retry, reconnect), dan tanpa penjaga itu antrian akan berisi salinan yang
 *    sama beberapa kali.
 *
 * Tidak menerima `principal` sama sekali — bukan kelalaian, tapi yang memastikan
 * Stage 1 tidak bisa menulis `active` lewat jalur ini.
 */
export async function usulkanPelanggaranDb(input: {
  userId: string;
  courseId: string;
  kejadian: readonly KejadianIntegritas[];
  /** Id run, untuk jejak; ikut masuk `evidence_redacted`. */
  runId?: string;
}): Promise<IntegrityViolation[]> {
  const usulan = deteksiUsulan(input.kejadian);
  if (usulan.length === 0) return [];
  if (input.courseId.trim() === "") return [];

  // Idempoten: kalau untuk (user, course, jenis) ini sudah ada baris yang belum
  // diputuskan, jangan tulis lagi. Dibaca **sebelum** transaksi supaya tidak ada
  // satu query per jenis.
  const belumPutus = await listPelanggaranProposed({
    userId: input.userId,
    courseId: input.courseId,
  });
  const sudahAda = new Set(belumPutus.map((b) => b.kind));

  let enrollmentId: string | null = null;
  try {
    const enrollment = await ambilEnrollment(input.userId, input.courseId);
    enrollmentId = enrollment?.userId === input.userId ? enrollment.id : null;
  } catch {
    // Usulan tetap bisa dibuat tanpa enrollment: ketiadaan enrollment berarti
    // course tak terdaftar, dan itu bukan alasan membatalkan pencatatan bukti.
  }

  const tersimpan: IntegrityViolation[] = [];
  for (const u of usulan) {
    if (sudahAda.has(u.jenis)) continue;
    try {
      const baris = await denganTransaksi(async (tx) => {
        const baru = await usulkanPelanggaran(tx, {
          userId: input.userId,
          courseId: input.courseId,
          enrollmentId,
          kind: u.jenis,
          penalty: u.penalty,
          reason: u.alasan,
          evidenceRedacted: saringPayloadAudit({
            ...u.bukti,
            ...(input.runId ? { run_id: input.runId } : {}),
          }),
        });

        await catatAudit(tx, {
          // `actor_user_id` null = peristiwa sistem, bukan keputusan staf.
          actorUserId: null,
          action: "integrity_violation.proposed",
          entityType: "integrity_violation",
          entityId: baru.id,
          payloadRedacted: {
            user_id: input.userId,
            course_id: input.courseId,
            kind: u.jenis,
            penalty: baru.penalty,
          },
        });
        return baru;
      });
      tersimpan.push(baris);
    } catch {
      continue;
    }
  }
  return tersimpan;
}

/* ------------------------------------------------------------------ *
 * Stage 2 — keputusan manusia
 * ------------------------------------------------------------------ */

/** Usulan yang belum diputuskan untuk satu peserta — antrian kerja verifikator. */
export async function antrianUsulanDb(
  userId: string,
): Promise<IntegrityViolation[]> {
  return listPelanggaranProposed({ userId });
}

/** Usulan yang belum diputuskan untuk seluruh akun — daftar lintas peserta. */
export async function antrianUsulanSemuaDb(): Promise<IntegrityViolation[]> {
  return listPelanggaranProposed();
}

/**
 * Konfirmasi usulan jadi pelanggaran yang berlaku — **Stage 2**.
 *
 * Hanya staf, dan hanya baris berstatus `proposed`. Itulah inti dari model dua
 * tahap ini: `active` adalah satu-satunya status yang memotong skor, jadi skor
 * hanya bisa bergerak dari manusia yang menekan tombol ini — tidak bisa dari
 * skrip yang memanggil Stage 1.
 *
 * `null` berarti usulan sudah diputuskan (seseorang lebih dulu). Itu bukan
 * kegagalan: dua verifikator bisa menekan bersamaan, dan hanya satu keputusan
 * yang boleh berlaku.
 */
export async function putuskanUsulanDb(input: {
  principal: SessionPrincipal;
  id: string;
}): Promise<IntegrityViolation | null> {
  const reviewerUserId = await wajibStaf(input.principal);

  return denganTransaksi(async (tx) => {
    const hasil = await konfirmasiPelanggaran(tx, { id: input.id, reviewerUserId });
    if (!hasil) return null;
    await catatAudit(tx, {
      actorUserId: reviewerUserId,
      action: "integrity_violation.confirmed",
      entityType: "integrity_violation",
      entityId: hasil.id,
      payloadRedacted: { kind: hasil.kind, penalty: hasil.penalty },
    });
    return hasil;
  });
}

/**
 * Tolak usulan — **Stage 2**, skor tidak bergerak.
 *
 * Alasan wajib: keputusan menolak tanpa penjelasan tidak bisa ditinjau siapa pun
 * nanti, dan staf berikutnya akan melihat usulan itu muncul lagi dari sesi yang
 * sama tanpa tahu pernah ditolak.
 */
export async function tolakUsulanDb(input: {
  principal: SessionPrincipal;
  id: string;
  alasan: string;
}): Promise<IntegrityViolation | null> {
  const reviewerUserId = await wajibStaf(input.principal);
  const alasan = input.alasan?.trim() ?? "";
  if (alasan === "") {
    throw new GalatIntegritas("alasan_wajib", "Tuliskan alasan penolakan.");
  }

  return denganTransaksi(async (tx) => {
    const hasil = await tolakUsulan(tx, {
      id: input.id,
      reviewerUserId,
      alasan,
    });
    if (!hasil) return null;
    await catatAudit(tx, {
      actorUserId: reviewerUserId,
      action: "integrity_violation.dismissed",
      entityType: "integrity_violation",
      entityId: hasil.id,
      payloadRedacted: { alasan },
    });
    return hasil;
  });
}

/* ------------------------------------------------------------------ *
 * Pemulihan otomatis
 * ------------------------------------------------------------------ */

/**
 * Pulihkan seluruh pelanggaran aktif pada satu course setelah course itu
 * diselesaikan ulang.
 *
 * **Dipanggil dari hook completion, bukan dari action.** Yang memicu adalah
 * `selesaikanKursusDb` yang mengembalikan `selesai: true` — yaitu peserta benar
 * yang menyelesaikan course itu, bukan sekadar membuka halamannya.
 *
 * **Syarat `completionAt` itu wajib, bukan opsional.** `course_completions` unik
 * per enrollment, jadi menyelesaikan ulang tidak membuat baris baru; tanpa batas
 * waktu, satu panggilan yang kebetulan terjadi sebelum pelanggaran dicatat akan
 * memulihkan pelanggaran itu sendiri. Pelanggaran yang dicatat *setelah*
 * completion tersebut tetap memotong skor sampai peserta menyelesaikan ulang lagi.
 *
 * Sifat penting: pemanggilan ini **tidak melempar**. Kalau expunge gagal
 * (koneksi, constraint), completion tetap sah dan dicatat — dan pelanggaran
 * masih aktif, jadi skor masih memotong. Arahnya aman: kesalahan di sini
 * membuat skor terlalu rendah, bukan terlalu tinggi. Melempar sebaliknya akan
 * membatalkan completion yang sah karena masalah yang terpisah, dan peserta
 * kehilangan progres yang sudah terbukti.
 *
 * Karena skor **diturunkan** dan tidak disimpan, tidak ada yang perlu
 * "dihitung ulang" setelah expunge: pembacaan berikutnya otomatis memakai baris
 * yang baru dipulihkan.
 */
export async function pulihkanPelanggaranSetelahUlang(
  userId: string,
  courseId: string,
  completionAt: Date,
): Promise<number> {
  try {
    return await denganTransaksi(async (tx) => {
      const jumlah = await pulihkanSemuaPelanggaranCourse(tx, {
        userId,
        courseId,
        alasan: "Course diselesaikan ulang tanpa catatan pelanggaran baru.",
        sebelum: completionAt,
      });
      if (jumlah > 0) {
        await catatAudit(tx, {
          actorUserId: null,
          action: "integrity_violation.expunged_by_completion",
          entityType: "integrity_violation",
          entityId: `${userId}:${courseId}`,
          payloadRedacted: { jumlah, course_id: courseId, user_id: userId },
        });
      }
      return jumlah;
    });
  } catch {
    // Completion sudah terekam; pemulihan yang gagal di sini hanya berarti
    // skor belum pulih. Pemanggilan berikutnya akan mencobanya lagi, dan tabel
    // report tetap menunjukkan status yang benar selama ini.
    return 0;
  }
}
