import Link from "next/link";
import { LockKeyhole, Sparkles } from "lucide-react";
import { tautanTutorAi } from "@/lib/learning/tutor-ai";
import type { KeputusanAkses } from "@/lib/learning/akses";

/**
 * Panel "Tutor AI" di sidebar kanan halaman detail kursus.
 *
 * Dua syarat, keduanya fail-closed:
 *
 * 1. Terdaftar. Dicek oleh pemanggil (`sudahDaftar`), bukan di sini.
 * 2. Boleh minta bantuan. `akses` adalah keputusan `putuskanAkses` untuk
 *    `jenisKegiatan: "bantuan_akademik"`, jadi `aturan_bantuan` dihormati lewat
 *    satu mesin keputusan, bukan salinan aturan. `tanpa_ai` membuat tombol
 *    tampil tapi tidak bisa dipakai.
 *
 * Panel tidak disembunyikan saat `tanpa_ai`: peserta berhak tahu fitur ini ada
 * dan kenapa ia tidak bisa dipakai.
 *
 * `courseId` yang diteruskan sudah di-resolve di server (lihat
 * `tutor-ai-kursus.ts`), bukan id Careevo mentah: AI Mastery hanya mengenali id
 * yang ada di store kursus-nya sendiri.
 */
export function KursusAiPanel({
  courseId,
  judul,
  penyedia,
  jumlahModul,
  akses,
}: {
  courseId: string;
  judul: string;
  penyedia: string;
  jumlahModul: number;
  /** Keputusan `putuskanAkses` untuk `bantuan_akademik`. */
  akses: KeputusanAkses;
}) {
  // Fail-closed: apa pun selain "bebas" menutup tombol. `perlu_sesi` dan
  // `perlu_kamera` tidak pernah terjadi untuk `bantuan_akademik` saat ini, tapi
  // keduanya akan terlihat terbuka di sini kalau suatu saat ditambahkan.
  const boleh = akses.tipe === "bebas";
  const href = tautanTutorAi(courseId);

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

      {boleh ? (
        <>
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
        </>
      ) : (
        <>
          {/* `disabled` pada <button> asli, bukan `aria-disabled` pada sebuah
              link: `aria-disabled` mengeluarkan node dari accessibility tree,
              bukan dari urutan tab, jadi link-nya tetap bisa di-fokus dan
              di-Enter. Lihat careevo-browser-verify, "focusable but hidden". */}
          <button
            type="button"
            disabled
            aria-describedby="catatan-tutor-ai"
            className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-full bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-400"
          >
            <LockKeyhole size={14} strokeWidth={2} aria-hidden="true" />
            Tanya tutor AI
          </button>
          {/* Pesan dipakai apa adanya dari `putuskanAkses`, sama seperti
              `CourseSessionGate`, supaya copy tidak menyimpang dari mesin akses. */}
          <p id="catatan-tutor-ai" className="mt-2 text-center text-[11px] leading-relaxed text-gray-500">
            {akses.pesan}
          </p>
        </>
      )}
    </section>
  );
}
