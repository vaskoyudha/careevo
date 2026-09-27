import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { RuangKerjaChrome } from "@/components/features/workspace/ruang-kerja-chrome";
import { RuangKerjaLab } from "@/components/features/workspace/ruang-kerja-lab";
import { kelayakanKursusSubmission, listKaryaCourse } from "@/lib/review/service";
import { cariEntri } from "@/lib/courses/katalog";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import { getCourseById } from "@/lib/courses/store";
import { prosesManajer } from "@/lib/workspace";
import { MENIT_BERLAKU, alamatBuka, terbitkanTiket } from "@/lib/workspace/tiket";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entri = await cariEntri(slug);
  return { title: entri ? `Ruang kerja · ${entri.title}` : "Ruang kerja" };
}

/**
 * Ruang kerja kode — IDE lengkap di dalam course, di `/belajar/[slug]/ruang-kerja`.
 *
 * ## Kenapa halaman ini tinggal di `(focus)`, bukan di `(app)`
 *
 * Rute ini pindah ke `(focus)` supaya ia memakai **permukaan fokus** yang sama
 * dengan reader modul: tanpa navbar mengambang, tanpa sidebar, dokumen tidak
 * menggulir, dan workspace yang menggulir sendiri. Alasannya teknis, bukan
 * selera: `.chrome` `position: sticky` memakan tinggi nyata di dalam flow
 * (lihat `--chrome-h` di `globals.css`), jadi navbar di sini **makan 66px dari
 * tinggi iframe yang sudah dibatasi viewport** — persis tinggi yang paling
 * mahal untuk IDE. Reader sudah menyelesaikan ini di `(focus)`; ruang kerja
 * mengikuti keputusan yang sama, bukan mencarinya sendiri.
 *
 * Karena tidak ada navbar, **bar fokus di dalam halaman adalah satu-satunya
 * jalan keluar** — dan persis seperti di reader, ujung kirinya adalah blok
 * merek yang sekaligus tautan. `aria-label`-nya menyebut tujuannya, bukan
 * mereknya: yang perlu didengar pengguna keyboard adalah "kembali ke halaman
 * kursus". Tanpa itu, di bawah `sm` kata "Careevo" disembunyikan CSS dan
 * tautan ini diumumkan sebagai "link" tanpa keterangan.
 *
 * ## Gerbangnya **sama** dengan panel Project, dan itu disengaja
 *
 * Halaman ini memakai `kelayakanKursusSubmission`, definisi yang sama dengan
 * yang menggerbang panel Project di `/belajar/[slug]` dan yang menggerbang
 * `/api/workspace`. Tiga tempat itu memakai satu fungsi, bukan tiga salinan
 * aturan: peserta yang panel Project-nya terkunci tidak boleh menemukan jalan
 * masuk lewat URL langsung, dan sebaliknya. Menyalin aturannya akan membuat
 * keduanya bisa menyimpang — dan selisihnya baru terlihat saat ada completion
 * di luar jalur terverifikasi.
 *
 *## Keadaan awal dibaca dari server
 *
 * `status()` **tidak menyalakan apa pun** — itu sifat yang dikunci di
 * `port.test.ts`. Yang dilakukannya hanya menjawab "apakah ruang kerja ini
 * sudah hidup". Tanpa pembacaan ini, peserta yang sedang bekerja lalu
 * me-refresh akan melihat tombol "Siapkan" lagi padahal IDE-nya masih jalan.
 *
 * `hidup: false` juga merupakan jawaban yang sah saat manajer mati: halaman
 * tetap dirender, dan tombolnya akan melaporkan "layanan tidak tersedia" dengan
 * kalimat yang bisa dibaca, bukan halaman galat.
 */
export default async function RuangKerjaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) return null;

  const { slug } = await params;
  const entri = await cariEntri(slug);
  if (!entri) notFound();

  const layak = await kelayakanKursusSubmission(session, entri.id);

  // Ruang kerja hanya dibaca untuk peserta yang layak. Membacanya untuk semua
  // orang berarti satu panggilan ke manajer yang dijamin tidak berguna, pada
  // jalur yang justru paling sering — peserta yang belum selesai course.
  //
  // `host` diambil dari header permintaan supaya URL ruang kerja memakai origin
  // yang sama dengan halaman ini (`localhost` tetap `localhost`). Manajer
  // memvalidasinya lewat allowlist; nilai ini tidak dipercaya.
  const host = (await headers()).get("host") ?? undefined;
  const keadaan = layak
    ? await prosesManajer.status({ userId: session.userId, courseId: entri.id, host })
    : null;

  // Tiket diterbitkan **di server**, saat render, untuk ruang kerja yang sudah
  // hidup. Itu yang membuat halaman yang dimuat ulang tidak menampilkan
  // "Siapkan" untuk ruang kerja yang sebenarnya sedang jalan, dan sekaligus
  // tidak pernah mengirim alamat mentah ke peramban.
  //
  // Tiket hanya diterbitkan bila ruang kerjanya benar-benar hidup: tiket untuk
  // ruang kerja yang mati akan mengarahkan iframe ke gerbang yang menjawab 409,
  // dan peserta melihat pesan galat di tempat yang seharusnya menampilkan IDE.
  //
  // `new Date().getTime()` dan bukan `Date.now()`: keduanya sama, tetapi React
  // compiler lint menandai `Date.now()` sebagai ketidakmurnian saat render —
  // konvensi yang sama dengan `(focus)/belajar/mastery/page.tsx`. Satu pembacaan
  // jam per permintaan, supaya seluruh perbandingan di bawah menyepakati arti
  // "sekarang".
  const sekarang: number = new Date().getTime();
  const rahasia = process.env.CAREEVO_WORKSPACE_SECRET ?? "";
  const tiket =
    keadaan?.status === "ok" && keadaan.hidup
      ? terbitkanTiket(rahasia, {
          userId: session.userId,
          courseId: entri.id,
          kedaluwarsa: sekarang + MENIT_BERLAKU * 60_000,
        })
      : null;

  /**
   * Kurikulum course, untuk kolom panduan.
   *
   * Dibaca lewat **`modulUntuk`** — resolver tunggal yang wajib dipakai setiap
   * halaman dan aksi (`modul-resolver.ts`): stored menang, kalau tidak ada baru
   * derived. Halaman yang memanggil `modulKursus()` langsung menggambar
   * kurikulum yang berbeda dari yang dibaca reader saat course punya modul
   * tersimpan, dan selisihnya tidak memunculkan error.
   *
   * Hanya untuk peserta yang layak: kolom panduan adalah isi kiri yang gagal
   * dibaca di halaman terkunci, jadi memanggil resolver di sana hanya menambah
   * pekerjaan pada jalur yang sudah tahu jawabannya.
   */
  const modul = layak ? await modulUntuk(entri.id) : [];

  /**
   * Ringkasan course untuk kepala kolom panduan.
   *
   * `EntriKatalog` adalah bentuk kartu katalog (`ResourceFixture`) dan tidak
   * membawa `description`, jadi diambil dari course-nya sendiri lewat
   * `getCourseById`. `?? ""` bukan defensif tanpa alasan: entri bisa berasal
   * dari fixture katalog yang course-nya sudah tidak ada di store, dan kolom
   * panduan harus tetap merender judul dan daftar modulnya.
   */
  const ringkasan = layak ? ((await getCourseById(entri.id))?.description ?? "") : "";

  /**
   * Jumlah karya untuk kartu "Project course" di kolom panduan.
   *
   * `listKaryaCourse` sudah memakai `kelayakanKursusSubmission` di dalamnya
   * (`service.ts`), jadi pemanggilannya di sini tidak membuka jalan baru:
   * peserta yang tidak layak tetap melihat `0`.
   */
  const karya = layak ? await listKaryaCourse(session, entri.id) : [];

  return (
    /**
     * Kerangka halaman (`RuangKerjaChrome`) yang membawa bar fokus, **sidebar
     * silabus**, dan bar kaki — sama seperti permukaan fokus lain di repo ini.
     * Halaman ini hanya menyiapkan datanya: kurikulum, ringkasan course, jumlah
     * karya, dan tiket ruang kerja.
     *
     * Kenapa kerangkanya komponen klien terpisah, bukan markup di sini: sidebar
     * dan bar kaki membaca modul aktif dari URL (`?modul=`), dan pembacaan itu
     * harus terjadi di klien agar tidak dihitung ulang di server lalu dikirim
     * sebagai state kedua yang bisa menyimpang. Halaman tetap server component
     * supaya tiket ruang kerja tidak pernah menyentuh peramban.
     *
     * Alasan `(focus)` dan bukan `(app)` sudah ditulis di doc komponen ini di
     * atas: `.chrome` `position: sticky` memakan 66px tinggi yang paling mahal
     * untuk IDE.
     */
    <RuangKerjaChrome
      slug={entri.slug}
      title={entri.title}
      provider={entri.provider}
      modul={modul}
      tautanKarya={`/belajar/${entri.slug}/karya`}
      jumlahKarya={karya.length}
    >
      {layak ? (
        <RuangKerjaLab
          courseId={entri.id}
          judul={entri.title}
          ringkasan={ringkasan}
          modul={modul}
          seed={{
            hidup: Boolean(tiket),
            buka: tiket ? alamatBuka(entri.id, tiket) : undefined,
          }}
          tautanKarya={`/belajar/${entri.slug}/karya`}
          jumlahKarya={karya.length}
        />
      ) : (
        // Terkunci. Kalimatnya menyebut apa yang membukanya, bukan hanya
        // bahwa ia tertutup — sama seperti pesan `terkunci` di `port.ts`.
        //
        // Pembungkusnya `<div>`, bukan `<main>`: `<main>` sudah milik kerangka
        // di atas, dan dua `<main>` bersarang adalah penanda struktural yang
        // salah untuk pembaca layar.
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
          <section className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white px-5 py-6 lg:px-6 lg:py-7">
            <h1 className="text-lg font-bold tracking-tight text-gray-900">
              Ruang kerja terkunci
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Ruang kerja dibuka oleh Project course, dan Project terbuka setelah course ini
              selesai lewat jalur terverifikasi. Progres informal tidak membukanya.
            </p>
            <div className="mt-5">
              <Link
                href={`/belajar/${entri.slug}`}
                className="chrome-btn chrome-btn-brand !h-11"
              >
                Kembali ke course
              </Link>
            </div>
          </section>
        </div>
      )}
    </RuangKerjaChrome>
  );
}
