import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Panel "Tutor AI" di sidebar kanan halaman detail kursus.
 *
 * Hanya dirender setelah peserta terdaftar ("course started"): sebelum itu
 * kursus belum dimulai untuk mereka, jadi tombol AI tidak boleh bisa dipicu.
 * Panel ini adalah satu-satunya titik masuk AI dari halaman kursus, dan ia
 * membawa konteks kursus lewat kontrak deep-link AI Mastery:
 * `/ai-mastery?course=<id>&capability=course_study`.
 *
 * Dua lapis konteks:
 * - **Di Careevo** (`ai-mastery/page.tsx`), query `course` + `capability`
 *   diteruskan ke dalam frame AI Mastery.
 * - **Di AI Mastery**, capability `course_study` membaca state kursus itu
 *   (silabus, jalur mastery, bank soal, posisi baca, catatan konvensi) sebelum
 *   giliran model pertama — kontrak yang sama dipakai `CourseNextStep` dan
 *   kartu hand-off di aplikasi AI Mastery.
 *
 * Id kursus Careevo dikirim apa adanya. Bila id itu belum ada di store kursus
 * AI Mastery, aplikasi itu jatuh ke chat biasa alih-alih menolak — deep-link
 * ini tidak pernah meninggalkan peserta di halaman rusak.
 */
export function KursusAiPanel({
  courseId,
  judul,
  penyedia,
  jumlahModul,
}: {
  courseId: string;
  judul: string;
  penyedia: string;
  jumlahModul: number;
}) {
  const href = `/ai-mastery?course=${encodeURIComponent(courseId)}&capability=course_study`;

  return (
    <section
      aria-labelledby="judul-tutor-ai"
      className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-[#0056D2]"
        >
          <Sparkles size={15} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <h2 id="judul-tutor-ai" className="text-sm font-bold text-gray-900">
            Tutor AI
          </h2>
          <p className="text-xs text-gray-500">Tanya materi kursus ini dengan konteks utuh.</p>
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 rounded-xl bg-[#f5f7fa] p-3 text-xs text-gray-600">
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-gray-500">Kursus</dt>
          <dd className="truncate font-medium text-gray-800">{judul}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-gray-500">Penyedia</dt>
          <dd className="truncate font-medium text-gray-800">{penyedia}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-gray-500">Cakupan</dt>
          <dd className="font-medium text-gray-800">{jumlahModul} modul</dd>
        </div>
      </dl>

      <Link
        href={href}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#0056D2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#00419e]"
      >
        <Sparkles size={14} strokeWidth={2} aria-hidden="true" />
        Tanya tutor AI
      </Link>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-gray-500">
        Dibuka di AI Mastery dengan kursus ini sebagai konteks belajarnya.
      </p>
    </section>
  );
}
