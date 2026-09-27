import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prosesManajer } from "@/lib/workspace";
import { MENIT_BERLAKU, alamatBuka, terbitkanTiket } from "@/lib/workspace/tiket";
import { kelayakanKursusSubmission } from "@/lib/review/service";
import { originDiizinkan, PESAN_ORIGIN_DITOLAK, hostPermintaan } from "@/lib/http/origin";
import { batasiRequestMasuk } from "@/lib/rate-limit/next";
import { catatJejakSekarang } from "@/lib/workspace/jejak-capture";

/**
 * POST /api/workspace — menyalakan, memeriksa, dan mematikan ruang kerja.
 *
 * ## Peran route ini hanya gerbang
 *
 * Ia **tidak pernah** menjalankan podman dan tidak pernah menyusun argumen
 * kontainer. Permintaan diteruskan lewat HTTP ke manajer di loopback, dan
 * hasilnya dipetakan ke bentuk yang dikenal klien (P3 spec). Kalau route ini
 * menyusun sendiri baris perintah podman, permukaan audit sandbox bocor ke
 * lapis kedua dan pertanyaan "apa yang boleh dilakukan kode peserta" tidak lagi
 * bisa dijawab dengan membaca satu berkas.
 *
 * ## Gerbangnya lebih banyak dari `/api/jalankan`, dan itu disengaja
 *
 * Ruang kerja jauh lebih mahal daripada satu kompilasi: ia menahan memori dan
 * CPU selama ia hidup. Karena itu ada **dua** gerbang tambahan sebelum manajer
 * disentuh:
 *
 * 1. **Kelayakan Project** (`kelayakanKursusSubmission`). Ruang kerja adalah
 *    tempat mengerjakan karya akhir course, jadi ia hanya dibuka untuk peserta
 *    yang course-nya sudah selesai lewat jalur terverifikasi — definisi yang
 *    **sama** dengan yang menggerbang panel Project di halaman course, bukan
 *    salinan aturan yang bisa menyimpang.
 * 2. **Rate limit `workspace`**, yang jauh lebih ketat dari `jalankanKode`.
 *
 * Urutannya menuruni dari yang paling murah ke yang paling mahal:
 * `originDiizinkan` → `getSession` → `batasiRequestMasuk` → validasi zod →
 * `kelayakanKursusSubmission`. Gerbang kelayakan diletakkan **terakhir** karena
 * ia satu-satunya yang menyentuh database lebih dari sekali, dan meletakkannya
 * lebih awal berarti peserta yang permintaannya sudah pasti ditolak rate limit
 * tetap membayar query itu.
 *
 * ## `aksi` ada di badan, bukan di path
 *
 * Tiga aksi (`mulai`, `status`, `berhenti`) memakai gerbang yang identik.
 * Memisahkannya menjadi tiga route berarti tiga salinan urutan gerbang yang
 * bisa menyimpang — dan penyimpangan pada gerbang otorisasi adalah kelas bug
 * yang paling mahal. `z.enum` menutup daftar aksinya, jadi aksi tak dikenal
 * ditolak di validasi, bukan menjadi 404 yang membingungkan.
 *
 * ## Kode HTTP
 *
 * 4xx/5xx berarti **permintaannya** tidak boleh lewat: 403 asal, 401 sesi,
 * 429 rate limit, 400 bentuk. Sebaliknya, keadaan ruang kerja yang tidak
 * memungkinkan — penuh, manajer mati, course terkunci — tetap **200** dengan
 * `status` semantik di dalam badan. Peserta dalam kasus itu tidak mengalami
 * masalah jaringan; ia perlu membaca alasan yang bisa dimengerti, dan
 * mengubahnya menjadi galat HTTP membuat peramban menampilkan "kesalahan
 * jaringan" di tempat yang seharusnya menampilkan kalimat biasa.
 */

export const dynamic = "force-dynamic";

const skemaTubuh = z.object({
  /**
   * Aksi yang diminta. `mulai` idempoten: ruang kerja yang sudah hidup
   * dikembalikan apa adanya, jadi klik berulang tidak membuat kontainer kedua.
   */
  aksi: z.enum(["mulai", "status", "berhenti"]),
  /**
   * Id course. Panjangnya dibatasi supaya nilai yang tidak masuk akal ditolak
   * di sini, bukan menjadi bagian dari kunci hash yang aneh. Nilai ini **bukan**
   * otorisasi: kelayakan diperiksa di bawah, dan `userId` diambil dari sesi.
   */
  courseId: z.string().min(1, "Course tidak dikenal.").max(200, "Course tidak dikenal."),
});

/** Bentuk respons gerbang. Satu kontrak, dipakai oleh semua penolakan. */
function galat(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  // Validasi Origin lebih dulu — sebelum body disentuh sama sekali. Alasan yang
  // sama dengan `/api/jalankan`: route handler tidak mendapat perlindungan CSRF
  // bawaan Next, jadi ia memeriksa sendiri. Kebijakannya fail-closed.
  if (!originDiizinkan(request)) {
    return galat(403, PESAN_ORIGIN_DITOLAK);
  }

  // Peserta yang sedang belajar, bukan staf. `getSession`, **bukan** gate staf:
  // endpoint ini memang untuk peserta yang sudah masuk.
  const sesi = await getSession();
  if (!sesi) {
    return galat(401, "Sesi tidak ditemukan. Silakan masuk terlebih dahulu.");
  }

  // Bucket per akun selain bucket per IP, dengan prefiks `workspace:` supaya
  // kunci bucket tidak pernah bentrok dengan kunci kebijakan lain.
  const batas = await batasiRequestMasuk(request, "workspace", {
    tambahan: `workspace:${sesi.email}`,
  });
  if (batas) return batas;

  let badan: unknown;
  try {
    badan = await request.json();
  } catch {
    return galat(400, "Badan permintaan harus berupa JSON yang sah.");
  }

  const parsed = skemaTubuh.safeParse(badan);
  if (!parsed.success) {
    return galat(400, parsed.error.issues[0]?.message ?? "Permintaan tidak sah.");
  }

  const { aksi, courseId } = parsed.data;

  // Gerbang kelayakan, memakai definisi yang **sama** dengan panel Project.
  // `null` berarti terkunci: belum terdaftar, belum selesai, selesai lewat
  // jalur informal, atau course-nya tidak ada. Semua keadaan itu satu jawaban
  // bagi peserta, dan tidak ada gunanya membedakannya di sini.
  const layak = await kelayakanKursusSubmission(sesi, courseId);
  if (!layak) {
    return Response.json({ ok: true, status: "terkunci", hidup: false });
  }

  // `userId` diambil dari **sesi**, bukan dari badan permintaan. Ini yang
  // membuat peserta tidak bisa membuka ruang kerja orang lain dengan mengirim
  // `userId` yang bukan miliknya — `courseId` boleh datang dari klien karena
  // kelayakannya sudah diperiksa di atas, tetapi identitas tidak pernah.
  //
  // `host` datang dari header permintaan dan diteruskan apa adanya; manajer
  // memvalidasinya lewat allowlist, jadi nilai ini tidak bisa mengalihkan URL
  // ruang kerja ke mesin lain.
  const minta = { userId: sesi.userId, courseId, host: hostPermintaan(request) ?? undefined };

  const keadaan =
    aksi === "mulai"
      ? await prosesManajer.mulai(minta)
      : aksi === "berhenti"
        ? await prosesManajer.berhenti(minta)
        : await prosesManajer.status(minta);

  /**
   * Jejak proses diambil setelah keadaan diketahui, dan **hanya kalau ruang
   * kerjanya hidup** — snapshot dari kontainer yang mati atau belum ada
   *artefaknya hanya menghasilkan baris kosong yang menghapus jejak.
   *
   * `berhenti` sengaja tidak diambil: pada saat itu kontainer sudah tidak ada,
   * dan jejak terakhir sudah tercatat oleh capture sebelum-sebelumnya.
   *
   * Panggilannya tidak awaited bersama jawaban: `void` di sini karena jejak tidak
   * boleh menunda balasan ke peserta. `catatJejakSekarang` sendiri sudah menelan
   * semua galatnya.
   */
  if (keadaan.status === "ok" && keadaan.hidup && aksi !== "berhenti") {
    void catatJejakSekarang(sesi.userId, courseId);
  }

  // Tiket diterbitkan hanya untuk ruang kerja yang **hidup**, dan hanya untuk
  // aksi yang memang membuka IDE. `berhenti` tidak butuh tiket — tidak ada
  // peramban yang akan memuat ruang kerja yang baru saja dimatikan.
  //
  // Tiket diterbitkan di sini, bukan di halaman, karena halaman tidak punya
  // rahasia bersama; hanya route server yang boleh menandatangani. Yang
  // dikembalikan ke klien adalah **tiket**, bukan rahasianya.
  const tiket =
    keadaan.status === "ok" && keadaan.hidup && aksi !== "berhenti"
      ? terbitkanTiket(process.env.CAREEVO_WORKSPACE_SECRET ?? "", {
          userId: sesi.userId,
          courseId,
          kedaluwarsa: Date.now() + MENIT_BERLAKU * 60_000,
        })
      : null;

  // `url` mentah dari manajer **tidak** diteruskan ke klien. Klien hanya boleh
  // tahu alamat yang sudah melewati gerbang (`/api/workspace/buka`); meneruskan
  // alamat mentah akan memberi jalan pintas yang melewati tiket, dan itu persis
  // lubang yang sedang ditutup lapisan ini.
  return Response.json({
    ok: true,
    status: keadaan.status,
    hidup: keadaan.hidup,
    ...(tiket ? { buka: alamatBuka(courseId, tiket) } : {}),
  });
}
