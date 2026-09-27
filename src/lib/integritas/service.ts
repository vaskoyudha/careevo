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
import type { SessionPrincipal } from "@/lib/auth/principal";
import type { IntegrityViolation } from "@/lib/db/schema";
import {
  DAFTAR_PELANGGARAN,
  jenisPelanggaranValid,
  type DefinisiPelanggaran,
  type JenisPelanggaran,
} from "./katalog";
import { hitungSkorIntegritas, skorPada, type RingkasanSkor } from "./skor";
import {
  catatPelanggaran,
  listPelanggaranAktif,
  listPelanggaranCourse,
  listSemuaPelanggaran as listSemuaPelanggaranDb,
  pulihkanPelanggaran,
  pulihkanSemuaPelanggaranCourse,
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

/** Baris yang bentuknya bisa dihitung skor — dipetakan, bukan dikirim mentah. */
function keBarisSkor(baris: readonly IntegrityViolation[]) {
  return baris.map((b) => ({
    id: b.id,
    courseId: b.courseId,
    penalty: b.penalty,
    status: b.status === "expunged" ? ("expunged" as const) : ("active" as const),
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
      status: b.status === "expunged" ? ("expunged" as const) : ("active" as const),
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
 * Satu baris tabel report: satu jenis katalog, dengan hitungannya.
 *
 * Ekstensinya `DefinisiPelanggaran` (nilai), bukan indeks dari array — TypeScript
 * hanya bisa meng-`extend` nama yang punya tipe argumen opsional, dan
 * `(typeof DAFTAR_PELANGGARAN)[number]` bukan salah satunya.
 */
export interface BarisPelanggaran extends DefinisiPelanggaran {
  /** Jumlah baris tercatat untuk jenis ini, `expunged` pun ikut. */
  jumlah: number;
  /** Yang masih memotong skor. */
  jumlahAktif: number;
  /** Yang sudah dipulihkan. */
  jumlahDipulihkan: number;
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
    { jumlah: number; jumlahAktif: number; jumlahDipulihkan: number }
  >();

  for (const b of baris) {
    if (!jenisPelanggaranValid(b.kind)) continue;
    const isi = hitung.get(b.kind) ?? {
      jumlah: 0,
      jumlahAktif: 0,
      jumlahDipulihkan: 0,
    };
    isi.jumlah += 1;
    if (b.status === "expunged") isi.jumlahDipulihkan += 1;
    else isi.jumlahAktif += 1;
    hitung.set(b.kind, isi);
  }

  return DAFTAR_PELANGGARAN.map((definisi) => {
    const isi = hitung.get(definisi.jenis);
    return {
      ...definisi,
      jumlah: isi?.jumlah ?? 0,
      jumlahAktif: isi?.jumlahAktif ?? 0,
      jumlahDipulihkan: isi?.jumlahDipulihkan ?? 0,
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
