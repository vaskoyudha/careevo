import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cariEntri } from "@/lib/courses/katalog";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { MateriPane } from "@/components/features/learning/materi-pane";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entri = await cariEntri(slug);
  return { title: entri ? `Materi · ${entri.title}` : "Materi" };
}

/**
 * Satu modul di dalam shell reader.
 *
 * Halaman ini sengaja **tipis**. Shell-nya — bar fokus, rail, drawer tutor, dan
 * `CourseSessionProvider` — hidup di `materi/layout.tsx` supaya tidak di-remount
 * saat berpindah modul. Yang dikerjakan di sini hanya tiga hal: menolak id modul
 * yang tidak ada di kurikulum saat ini, memilih halaman dari `?halaman=`, dan
 * merender pane-nya.
 *
 * `?halaman=` dibaca **di sini**, bukan dengan `useSearchParams` di klien:
 * halaman sudah punya `searchParams` dari Next, jadi satu nilai mengalir ke
 * pane sebagai prop dan tidak ada hook klien yang perlu Suspense. Nilainya
 * diteruskan **apa adanya** — id yang tidak dikenal diterjemahkan menjadi
 * halaman pertama oleh `halamanDipilih()` di pane, yang juga dipakai panel
 * silabus untuk menyorot barisnya.
 *
 * Modul dibaca ulang di sini karena halaman ini yang harus memvalidasi `modulId`
 * dan menyerahkan modulnya ke pane. Pembacaan kedua ini murah: store kursus
 * menghidrasi dirinya **sekali per proses** ke state modul (`pastikanTermuat`,
 * `store.ts:235`), jadi `modulUntukSumber` setelah itu hanya bekerja di memori.
 * Yang **tidak** dibaca ulang di sini adalah progres dan bukti sesi: keduanya
 * sudah dibaca layout, dan membacanya lagi berarti dua pembacaan yang bisa
 * menyimpang.
 *
 * `MateriPane` membaca keputusan aksesnya sendiri dari `useCourseSession()` —
 * ia berada di bawah provider yang dipasang layout, jadi konteksnya tersedia.
 */
export default async function MateriModulPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; modulId: string }>;
  searchParams: Promise<{ halaman?: string }>;
}) {
  const { slug, modulId } = await params;
  const { halaman } = await searchParams;
  const entri = await cariEntri(slug);
  if (!entri) notFound();

  const modul = await modulUntukSumber({
    id: entri.id,
    title: entri.title,
    tags: entri.tags,
    duration_min: entri.duration_min,
    url: entri.url,
  });

  // Id modul yang tidak ada di kurikulum saat ini adalah 404, bukan render modul
  // kosong: modul yang dihapus admin tidak boleh tampil sebagai halaman hampa.
  const modulAktif = modul.find((m) => m.id === modulId);
  if (!modulAktif) notFound();

  return <MateriPane kursusId={entri.id} modul={modulAktif} halamanAwal={halaman} />;
}
