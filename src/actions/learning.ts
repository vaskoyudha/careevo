"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/courses/store";
import { progresKursusDb, selesaikanKursusDb, tandaiModulDb } from "@/lib/learning/service";
import {
  akhiriRunDb,
  buktikanSesiDb,
  catatKejadianDb,
  mulaiRunDb,
} from "@/lib/learning/run-service";
import { ambilRun, listEventRun } from "@/lib/learning/repository";
import { sessionRunDariDb } from "@/lib/learning/dashboard";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import {
  JENIS_KEJADIAN_SAH,
  butuhKamera,
  checkpointEfektif,
  lewatBatas,
  putuskanAkses,
  wajibSesiTerverifikasi,
  type KJenisKejadian,
} from "@/lib/learning/akses";
import { BATAS_SESI_BAWAAN_MENIT, type SessionRun } from "@/lib/learning/session";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import type { Course, KebijakanCourse } from "@/types/course";

/**
 * Run yang dikirim balik ke klien.
 *
 * Bentuknya tetap `SessionRun` yang dikenali `course-session.tsx` (termasuk
 * `kejadian[]`), tetapi isinya sekarang dibangun dari `learning_runs` +
 * `learning_events` lewat `sessionRunDariDb` — bukan lagi dari berkas
 * `.data/sessions/*.json`. `owner` karena itu berisi `users.id`, bukan email.
 *
 * `SessionRun` diimpor sebagai tipe; modul nilai `session.ts` tetap dipakai
 * hanya untuk konstanta batas sesi, dan ia tetap menjadi pemilik HMAC bukti.
 */
export type SesiRunView = SessionRun;

export interface SesiActionState {
  ok: boolean;
  error?: string;
  runId?: string;
  bukti?: string;
  run?: SesiRunView;
}

/** Nama lokal sengaja sama dengan helper `safeRevalidate` di `actions/enrollment.ts`. */
function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Abaikan di luar lifecycle request Next.js (mis. unit test).
  }
}

/**
 * Kolom `timestamptz` (`Date`) menjadi ISO untuk fungsi murni yang mengharapkan
 * string. Nilai yang tidak bisa dibaca menjadi string kosong — pemanggilnya
 * (`lewatBatas`) menghitung itu sebagai **lewat**, jadi kegagalan baca
 * menutup gerbang, bukan membukanya.
 */
function waktuIso(nilai: Date | string): string {
  if (nilai instanceof Date) {
    return Number.isFinite(nilai.getTime()) ? nilai.toISOString() : "";
  }
  return Number.isFinite(Date.parse(nilai)) ? nilai : "";
}

/**
 * Kebijakan efektif sebuah kursus.
 *
 * Kursus yang belum pernah disunting kebijakannya tidak membawa field ini,
 * jadi `kebijakanDefault()` (pengawasan `wajib`) tetap berlaku — bukan
 * "tanpa kebijakan", supaya gerbang sesi tidak diam-diam terbuka.
 */
function kebijakanKursus(kursus: Course): KebijakanCourse {
  return kursus.kebijakan ?? kebijakanDefault();
}

/**
 * Apakah run yang sedang diverifikasi punya bukti kamera menyala.
 *
 * **Diturunkan dari run, bukan dari klaim pemanggil.** `kamera_mulai` ditulis
 * ke `learning_events` hanya lewat `catatKejadianDb` pada run aktif milik
 * pemanggil, dan run itu sudah dibaca server di `buktikanSesiDb` — jadi ini
 * bukti yang bisa diaudit, bukan parameter yang bisa diisi `true` oleh klien.
 * Run yang tidak bisa dibaca menghasilkan `false` (gagal-tertutup): bukti yang
 * tidak bisa diperiksa tidak boleh dianggap memenuhi syarat.
 */
async function kameraMenyalaPadaRun(runId: string): Promise<boolean> {
  const kejadian = await listEventRun(runId);
  return kejadian.some((k) => k.kind === "kamera_mulai");
}

/**
 * Mulai sesi terverifikasi untuk sebuah kursus.
 *
 * Sesi dibuat hanya untuk peserta yang benar-benar terdaftar — tanpa
 * pemeriksaan ini, siapa pun yang tahu id kursus dapat membuat sesi dan
 * mengklaim pengerjaan. Keikutsertaannya dibaca dari database (`enrollments`),
 * bukan lagi dari cookie `ls_enroll`: `enrollment.id` juga yang dibutuhkan run
 * di `learning_runs`.
 */
export async function mulaiSesiAction(courseId: string): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Masuk dulu untuk memulai sesi belajar." };

  const kursus = await getCourseById(courseId);
  if (!kursus) return { ok: false, error: "Kursus tidak ditemukan." };
  if (kursus.status !== "published") return { ok: false, error: "Kursus belum dipublikasikan." };

  const { enrollment } = await progresKursusDb(session, courseId);
  if (!enrollment) return { ok: false, error: "Daftar kursus ini dulu sebelum memulai sesi." };

  const kebijakan = kebijakanKursus(kursus);

  // Sesi berlaku untuk seluruh course, sedangkan `batas_waktu_menit` terikat
  // per modul. Maka angka course diambil **maksimum**nya: kalau dipakai
  // minimum, satu modul berlimit 5 menit akan membuat sesi modul 30 menit ikut
  // kedaluwarsa — membiarkan bukti mati hanya karena ada modul lain.
  const modul = await modulUntukSumber({
    id: kursus.id,
    title: kursus.title,
    tags: kursus.tags,
    duration_min: kursus.duration_min,
    url: kursus.url,
  });
  const batasMenit =
    modul.length === 0
      ? BATAS_SESI_BAWAAN_MENIT
      : Math.max(...modul.map((m) => checkpointEfektif(m).batas_waktu_menit));

  // Satu course = satu run aktif. `mulaiSesiAction` berjalan setiap kali peserta
  // menekan tombol, dan status sesi hanya hidup di state React — memuat ulang
  // halaman membuat tombol itu muncul lagi. Aturan "lanjutkan run aktif"
  // ditegakkan service (`mulaiRunDb` → `ambilRunAktif`), bukan di sini: run
  // kedaluwarsa ditutup di sana lalu digantikan run baru, sehingga tidak ada
  // run duplikat yang saling menyaingi.
  const { run, bukti } = await mulaiRunDb({
    principal: session,
    enrollmentId: enrollment.id,
    courseId,
    policyVersion: kebijakan.versi,
    batasMenit,
  });

  // Kejadian `sesi_dimulai` ditulis setelah run pasti ada, dan **hanya** untuk
  // run yang belum punya satu pun kejadian. `mulaiRunDb` sengaja tidak
  // menuliskannya: run yang dilanjutkan sudah memilikinya, dan menulis di sini
  // tanpa syarat akan menggandakan kejadian pada setiap muat ulang halaman.
  const kejadianLama = await listEventRun(run.id);
  if (kejadianLama.length === 0) {
    await catatKejadianDb({
      principal: session,
      runId: run.id,
      jenis: "sesi_dimulai",
      visibilitas: "visible",
    });
  }

  const kejadian =
    kejadianLama.length === 0 ? await listEventRun(run.id) : kejadianLama;
  return { ok: true, runId: run.id, bukti, run: sessionRunDariDb(run, kejadian) };
}

/** Catat kejadian integritas dari klien; selalu ditandai sumbernya. */
export async function catatKejadianAction(input: {
  runId: string;
  jenis: KJenisKejadian;
  visibilitas: "visible" | "hidden" | null;
  detail?: string;
  asal?: string;
}): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesi pengguna tidak ditemukan." };

  // `jenis` datang dari klien sebagai JSON mentah, jadi tipenya belum tentu
  // benar saat berjalan. Tanpa pemeriksaan ini, string apa pun masuk ke catatan
  // integritas dan `klasifikasiKejadian` diam-diam memperlakukannya sebagai
  // "kejadian" biasa — bukti jadi tampak lengkap padahal isinya di luar skema.
  // Urutannya tetap: validasi wire lebih dulu, baru delegasi ke service.
  if (!(JENIS_KEJADIAN_SAH as readonly string[]).includes(input.jenis)) {
    return { ok: false, error: "Jenis kejadian tidak dikenal." };
  }
  // `visibilitas` menumpang validasi yang sama: nilai asing akan lolos ke
  // klasifikasi kejadian/celah dan mengubah arti catatan.
  if (input.visibilitas !== null && input.visibilitas !== "visible" && input.visibilitas !== "hidden") {
    return { ok: false, error: "Jenis kejadian tidak dikenal." };
  }

  // Kepemilikan, keberadaan run, dan keadaan `active` semuanya ditegakkan
  // `catatKejadianDb` (ia yang mengunci baris dan menulis `max + 1`). Satu pesan
  // untuk semua kegagalan itu disengaja: membedakan balasan "run tidak ada" dari
  // "bukan milikmu" membuat pemanggil bisa menebak keberadaan run orang lain.
  const kejadian = await catatKejadianDb({
    principal: session,
    runId: input.runId,
    // Pemakaian cast di sini aman karena daftar sah sudah diperiksa di atas.
    jenis: input.jenis as KJenisKejadian,
    visibilitas: input.visibilitas,
    asal: input.asal,
    // `detail` dipotong di service (`catatKejadianDb`), tidak diulang di sini.
    detail: input.detail,
  });
  if (!kejadian) {
    return { ok: false, error: "Sesi sudah berakhir atau bukan milikmu; kejadian tidak dicatat." };
  }

  // Klien menampilkan daftar kejadian dari balasan ini, jadi baris run dibaca
  // ulang bersama seluruh kejadiannya. Jalur ini **baca**, bukan tulis kedua:
  // satu-satunya penulis kejadian tetap `catatKejadianDb` di atas.
  const run = await ambilRun(input.runId);
  if (!run) return { ok: false, error: "Sesi belajar tidak ditemukan untuk akun ini." };
  return { ok: true, run: sessionRunDariDb(run, await listEventRun(run.id)) };
}

/**
 * Selesaikan satu modul.
 *
 * Gerbang server: untuk course yang mewajibkan sesi (`wajibSesiTerverifikasi`),
 * modul dengan checkpoint `materi` hanya bisa ditandai selesai dengan bukti sesi
 * yang sah; course `opsional` tidak butuh bukti. Tanpa gerbang ini, peserta bisa
 * menyelesaikan modul kuis hanya dengan memanggil action ini.
 */
export async function selesaikanMateriAction(input: {
  courseId: string;
  modulId: string;
  bukti: string;
}): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Masuk dulu untuk menyelesaikan materi." };

  const kursus = await getCourseById(input.courseId);
  if (!kursus) return { ok: false, error: "Kursus tidak ditemukan." };

  // Modul kuis/proyek tidak boleh diselesaikan lewat penandaan manual: periksa
  // checkpoint modul target lebih dulu, sebelum biaya verifikasi bukti sesi.
  const modul = await modulUntukSumber({
    id: kursus.id,
    title: kursus.title,
    tags: kursus.tags,
    duration_min: kursus.duration_min,
    url: kursus.url,
  });
  const target = modul.find((m) => m.id === input.modulId);
  if (!target) return { ok: false, error: "Modul tidak ditemukan pada kurikulum saat ini." };

  const checkpoint = checkpointEfektif(target);
  if (checkpoint.mode !== "materi") {
    return {
      ok: false,
      error: "Modul ini diselesaikan lewat checkpoint kuis/proyek, bukan penandaan manual.",
    };
  }

  const kebijakan = kebijakanKursus(kursus);
  // Sebelum ini, biaya verifikasi bukti selalu dibayar walaupun course-nya
  // `opsional` — padahal keputusannya pasti `bebas`. Lewati saja: hasilnya sama
  // dan tidak ada token yang dibaca untuk course yang tidak membutuhkannya.
  //
  // Verifikasi bukti sekarang terhadap database: `buktikanSesiDb` memeriksa
  // tanda tangan HMAC (bentuk token tidak berubah), lalu keberadaan run aktif
  // milik user untuk course ini, masa berlakunya, dan `integrity_version` run
  // terhadap versi yang diminta. `owner` di dalam token adalah `users.id`.
  const bukti =
    input.bukti && wajibSesiTerverifikasi(kebijakan)
      ? await buktikanSesiDb({
          userId: session.userId,
          courseId: input.courseId,
          policyVersion: kebijakan.versi,
          token: input.bukti,
        })
      : null;

  // Pemanggil tidak menyaring berdasarkan ada/tidaknya bukti: keputusannya
  // serahkan ke `putuskanAkses` di sini. `keputusan.tipe` selalu `bebas` untuk
  // course `opsional` (lihat `wajibSesiTerverifikasi`), jadi rute klien yang
  // mengirim permintaan ini pada course `opsional` tidak ikut ditolak.
  //
  // Bukti kamera dibaca dari run **setelah** `bukti` terverifikasi: tanpa run
  // yang sah tidak ada catatan yang bisa diperiksa, jadi membacanya lebih awal
  // tidak menambah apa pun.
  //
  // Yang menentukan apakah pembacaan itu dibayar adalah kebijakannya, bukan
  // keberadaan `bukti`: `putuskanAkses` membaca `adaBuktiKamera` hanya di dalam
  // cabang `butuhKamera`, jadi pada course `wajib` hasilnya dibuang. Tanpa
  // syarat itu, `wajib` — kebijakan bawaan kursus seed — membayar satu
  // `learning_events` per penyelesaian untuk jawaban yang tidak pernah dipakai.
  // Bentuknya sengaja meniru gerbang jalur kuis (`wajibKamera` di
  // `selesaikanModulKuisVerified`) supaya dua gerbang dibaca sama. Syarat `bukti`
  // tetap ikut ada: pada course `wajib_kamera` bukti bisa saja kosong, dan
  // `bukti.id` tidak boleh dibaca lebih dulu supaya tidak jatuh ke galat.
  const kameraMenyala =
    butuhKamera(kebijakan) && bukti ? await kameraMenyalaPadaRun(bukti.id) : false;

  const keputusan = putuskanAkses({
    jenisKegiatan: "materi",
    kebijakan,
    adaBuktiSesi: Boolean(bukti),
    adaBuktiKamera: kameraMenyala,
  });
  // Pesan keputusan dipakai apa adanya agar copy tidak menyimpang dari mesin
  // akses: `perlu_sesi`/`perlu_kamera` untuk syarat yang belum terpenuhi,
  // `ditolak` untuk larangan.
  if (keputusan.tipe === "perlu_sesi") return { ok: false, error: keputusan.pesan };
  if (keputusan.tipe === "perlu_kamera") return { ok: false, error: keputusan.pesan };
  if (keputusan.tipe === "ditolak") return { ok: false, error: keputusan.pesan };

  // Batas per modul ditegakkan terpisah dari masa berlaku sesi.
  // `batas_waktu_menit` punya makna yang sudah didokumentasikan ("batas waktu
  // mengerjakan/menyelesaikan"), jadi tidak boleh tetap jadi field yang ditulis
  // lalu tidak pernah dibaca.
  //
  // Batas ini bisa dilewati dengan memulai sesi baru — tetapi itu terlihat
  // jelas: run lama ditutup dan run baru tercatat. Itu pemecatan yang terlihat,
  // bukan pemalsuan tersembunyi, dan konsisten dengan posisi spesifikasi bahwa
  // kontrol memperkuat bukti tanpa menjanjikannya.
  //
  // `mulai_at` run adalah `timestamptz` (`Date`); `lewatBatas` menerima string
  // ISO. Tanggal yang tidak bisa dibaca dikirim sebagai string kosong supaya
  // `lewatBatas` menghitungnya **lewat** (gagal-tertutup), bukan melempar galat
  // `toISOString` yang akan menjatuhkan seluruh action.
  const mulaiAt = bukti ? waktuIso(bukti.startedAt) : "";
  if (bukti && lewatBatas(mulaiAt, checkpoint.batas_waktu_menit)) {
    return {
      ok: false,
      error: "Sesi ini sudah melewati batas waktu pengerjaan. Mulai sesi baru untuk mencoba kembali.",
    };
  }

  // Mulai dari sini keputusannya `bebas`: sesi terverifikasi sah, atau kursus
  // `opsional` yang memang tidak menuntutnya. Baru di titik ini penyimpanan
  // boleh terjadi — semua gerbang di atas (sesi, kursus, modul, checkpoint,
  // bukti) sudah lolos lebih dulu, jadi tidak ada jalur penolakan yang menulis.
  //
  // Sebelum ini action hanya me-revalidasi dan mengembalikan `ok: true`, jadi
  // centang "terverifikasi" hidup di state klien saja dan hilang saat halaman
  // dimuat ulang — persis kegagalan "tampak terverifikasi tetapi tidak" yang
  // dilarang. Gejalanya diperparah oleh gerbang kebijakan di
  // `tandaiModulAction`: jalur informal menolak penyelesaian `materi` di kursus
  // `wajib`, sedangkan kursus seed memakai `kebijakanDefault()` (`wajib`).
  // Tanpa penulisan di sini, tidak ada satu pun jalur penyelesaian yang bekerja
  // untuk kursus bawaan.
  //
  // Gerbang pendaftaran: keikutsertaan tetap wajib, bukan karena jalur ini
  // kurang aman, melainkan karena tanpa baris `enrollments` tidak ada yang bisa
  // ditulisi — `tandaiModulDb()` mengembalikan `{ ok: false }` dan peserta akan
  // melihat "siap" padahal progresnya tidak tersimpan. Pendaftaran sengaja
  // tidak diadakan di sini (itu tindakan berbayar/aksi lain); cukup ditolak
  // dengan pesan yang memandu, dan **sebelum** ada penulisan.
  const { enrollment, selesai } = await progresKursusDb(session, kursus.id);
  if (!enrollment) {
    return { ok: false, error: "Daftar kursus ini dulu sebelum menyelesaikan materi." };
  }

  // Jalur terverifikasi hanya boleh **menambah** penyelesaian, tidak pernah
  // membatalkannya — pembatalan tetap milik jalur informal `tandaiModulAction`.
  // Karena itu id yang sudah tercatat tidak dipanggil ulang: `tandaiModulDb`
  // untuk modul yang sudah selesai terverifikasi memang idempoten, tetapi
  // melewatinya menghemat satu tulisan dan menjaga niatnya eksplisit.
  if (!selesai.includes(input.modulId)) {
    // `evidenceId` diisi id run yang buktinya barusan diverifikasi: itulah ikatan
    // antara baris progres dan bukti sesi yang mendasarinya. Tanpa itu, laporan
    // tidak bisa membedakan penyelesaian yang benar-benar lewat sesi dari yang
    // hanya diklaim.
    await tandaiModulDb({
      principal: session,
      courseId: kursus.id,
      modulId: input.modulId,
      sumber: "terverifikasi",
      nama: session.nama,
      evidenceId: bukti?.id ?? null,
    });
  }

  // Setiap modul bisa menjadi yang terakhir. Rekam completion dari progres
  // server-side; tanpa ini panel Project di halaman course tidak pernah terbuka.
  const completion = await selesaikanKursusDb({
    principal: session,
    courseId: kursus.id,
    policyVersion: kebijakan.versi,
  });
  if (completion.selesai) safeRevalidate(`/belajar/${kursus.slug}/karya`);

  // Revalidasi disamakan dengan `tandaiModulAction` (`/belajar` dan halaman
  // kursus): keduanya menulis progres yang sama, jadi keduanya harus menyegarkan
  // permukaan yang sama. Halaman `/belajar` ikut karena daftar progres di sana
  // membaca progres pendaftaran yang baru saja berubah.
  safeRevalidate("/belajar");
  safeRevalidate(`/belajar/${kursus.slug}`);
  return { ok: true, runId: bukti?.id };
}

/** Akhiri sesi secara eksplisit (mis. peserta menutup ruang belajar). */
export async function akhiriSesiAction(runId: string, alasan = "peserta_akhiri"): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesi pengguna tidak ditemukan." };

  // Kepemilikan dan status run diperiksa `akhiriRunDb`; `alasan` tidak
  // dipersistensi (lihat catatan di service) tetapi tetap diteruskan supaya
  // pemanggil bisa memakainya untuk audit.
  const diakhiri = await akhiriRunDb({ principal: session, runId, alasan });
  if (!diakhiri) return { ok: false, error: "Sesi belajar tidak ditemukan untuk akun ini." };
  return { ok: true, run: sessionRunDariDb(diakhiri, await listEventRun(diakhiri.id)) };
}
