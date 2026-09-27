import Link from "next/link";

/**
 * Kartu ajakan coba paket berbayar.
 *
 * Letaknya di kolom samping, bukan di dalam `DashboardSidebar` — sidebar itu
 * milik shell `AppShell` dan dipakai bersama semua halaman dashboard, jadi
 * tidak boleh diisi per halaman.
 */
export function PromoCard() {
  return (
    <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
      <h2 className="text-[15px] leading-snug font-bold text-gray-900">
        Coba Plus atau Pro dengan uji coba gratis 7 hari
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
        Latihan dengan proyek nyata, penilaian dari verifikator, dan sertifikat
        yang bisa dicantumkan di lamaran.
      </p>
      <Link
        href="/careevo-plus"
        className="mt-3 block rounded-lg bg-[#0056D2] px-3 py-2 text-center text-[13px] font-semibold text-white transition-colors hover:bg-[#00419e]"
      >
        Coba gratis
      </Link>

      <div className="my-3 flex items-center gap-2">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-[11px] text-gray-400">atau</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <p className="text-[12px] leading-relaxed text-gray-600">
        Belajar untuk kerja?{" "}
        <Link href="/bisnis" className="font-medium text-[#0056D2]">
          Lihat Careevo Bisnis
        </Link>{" "}
        untuk tim.
      </p>
    </aside>
  );
}
