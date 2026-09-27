import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { cariEntri } from "@/lib/courses/katalog";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { getCourseById } from "@/lib/courses/store";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import { irisModulSelesai } from "@/lib/courses/kurikulum";
import { progresKursusDb } from "@/lib/learning/service";
import { pastikanBackfill } from "@/lib/learning/backfill-lazy";
import { sesiReaderAwal } from "@/lib/learning/reader-sesi";
import { selaraskanKursusAi } from "@/lib/learning/tutor-ai-kursus";
import { urlFrameTutorEmbed, KAPABILITAS_COURSE_STUDY } from "@/lib/learning/tutor-ai";
import { AI_MASTERY_WEB_URL } from "@/lib/mode/store";
import { CourseSessionProvider } from "@/components/features/learning/course-session";
import { MateriShell } from "@/components/features/learning/materi-shell";

/**
 * Shell reader — tinggal di **layout**, bukan di halaman.
 *
 * Layout Next.js tidak di-render ulang saat navigasi, jadi berpindah modul 1 → 4
 * tidak me-remount provider sesi atau iframe tutor. Kalau shell ini ditaruh di
 * `page.tsx`, setiap klik modul akan memuat ulang iframe dan memutus WebSocket di
 * tengah giliran — dan sesi terverifikasi yang sedang berjalan ikut hilang karena
 * provider-nya dibongkar.
 *
 * Layout ini **tidak** tahu modul mana yang aktif: `params` di sini hanya memuat
 * `slug`, karena `[modulId]` adalah segmen anak. Modul aktif diturunkan dari
 * pathname di dalam `MateriShell` (klien).
 *
 * Gerbang sesi + onboarding tidak diulang di sini: `(focus)/layout.tsx` sudah
 * memilikinya, dan layout ini berada di bawahnya.
 */
export default async function MateriLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { slug } = await params;
  const entri = await cariEntri(slug);
  if (!entri) notFound();

  const kursusAsli = await getCourseById(entri.id);
  const kebijakan = kursusAsli?.kebijakan ?? kebijakanDefault();

  const modul = await modulUntukSumber({
    id: entri.id,
    title: entri.title,
    tags: entri.tags,
    duration_min: entri.duration_min,
    url: entri.url,
  });

  await pastikanBackfill(session);
  const { enrollment, selesai } = await progresKursusDb(session, entri.id);
  const selesaiValid = irisModulSelesai(selesai, modul);

  /**
   * Gerbang enrollment: reader adalah ruang belajar **peserta kursus**.
   *
   * Halaman ini dulu bisa dibaca siapa pun yang sudah masuk, tanpa mendaftar.
   * Sejak gerbangnya pindah ke tombol "Buka materi", prasyarat itu jadi sesuatu
   * yang bisa dilangkahi: URL satu modul cukup untuk masuk tanpa pernah menekan
   * tombolnya. Gerbang di sini menutup jalan itu — bukan dengan mengusir peserta
   * ke beranda, melainkan mengembalikannya ke silabus, tempat `GerbangMulaiCourse`
   * menyelesaikan langkah yang belum beres.
   *
   * `redirect`, bukan `notFound`: halamannya ada dan peserta berhak tahu cara
   * masuk — 404 di sini berbohong tentang sebabnya dan tidak menawarkan jalan.
   *
   * Diletakkan **setelah** pembacaan progres karena enrollment itu sendiri yang
   * dibaca; memindahkannya ke atas berarti membaca `progresKursusDb` dua kali
   * untuk satu permintaan.
   */
  if (!enrollment) redirect(`/belajar/${slug}`);

  // Seed sesi: peserta yang memuat ulang atau membuka deep link ke satu modul
  // tidak kehilangan sesi terverifikasi yang masih berjalan. `null` berarti
  // memang tidak ada sesi — gerbang biasa yang tampil, bukan galat.
  const sesiAwal = await sesiReaderAwal({
    userId: session.userId,
    courseId: entri.id,
    policyVersion: kebijakan.versi,
  });

  /**
   * Id course pasangannya di AI Mastery, hanya untuk peserta yang terdaftar.
   *
   * Gerbangnya bukan hiasan: `selaraskanKursusAi` bukan pembacaan murni. Ia bisa
   * `POST /api/courses` untuk membuat course, `PUT /api/courses/<id>/syllabus`
   * untuk menulis unit silabus, lalu menulis `aiCourseId` kembali ke DB Careevo
   * — tulis lintas layanan yang tidak pantas dipicu orang yang belum terdaftar.
   * Doc comment-nya sendiri mensyaratkan "Hanya dipanggil setelah peserta
   * terdaftar", jadi gerbang ini membuat kode memenuhi kontraknya.
   *
   * Karena `(focus)/layout.tsx` hanya menjaga sesi + profil onboarding — **bukan**
   * enrollment — tanpa gerbang ini peserta yang sudah masuk tetapi belum
   * terdaftar cukup membuka URL satu modul untuk menyalakan tulis-tulis itu.
   *
   * `selaraskanKursusAi` mengembalikan `null` saat bridging tidak dikonfigurasi
   * atau AI Mastery mati; null lalu menjadi `entri.id`, yaitu perilaku lama
   * (link polosan yang ditolak backend secara diam-diam), bukan error.
   */
  const aiCourseId = enrollment
    ? ((await selaraskanKursusAi({
        courseId: entri.id,
        title: entri.title,
        modul: modul.map((m) => m.judul),
      })) ?? entri.id)
    : entri.id;

  const tutorSrc = urlFrameTutorEmbed(AI_MASTERY_WEB_URL, {
    course: aiCourseId,
    capability: KAPABILITAS_COURSE_STUDY,
  });

  return (
    <CourseSessionProvider
      courseId={entri.id}
      kebijakan={kebijakan}
      buktiAwal={sesiAwal?.bukti ?? null}
      runIdAwal={sesiAwal?.runId ?? null}
      kejadianAwal={sesiAwal?.kejadian ?? []}
    >
      <MateriShell
        slug={entri.slug}
        kursusJudul={entri.title}
        kursusPenyedia={entri.provider}
        kursusId={entri.id}
        kebijakan={kebijakan}
        modul={modul}
        selesai={selesaiValid}
        tutorSrc={tutorSrc}
      >
        {children}
      </MateriShell>
    </CourseSessionProvider>
  );
}
