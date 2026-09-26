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
    <aside className="rounded-[14px] border border-[#cbe6ef] bg-white p-4">
      <h2 className="text-[15px] leading-snug font-semibold text-[#0a2a3a]">
        Coba Plus atau Pro dengan uji coba gratis 7 hari
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[#48606e]">
        Latihan dengan proyek nyata, penilaian dari verifikator, dan sertifikat
        yang bisa dicantumkan di lamaran.
      </p>
      <Link
        href="/careevo-plus"
        className="mt-3 block rounded-[10px] bg-[#0a3d62] px-3 py-2 text-center text-[13px] font-semibold text-white transition-colors hover:bg-[#124e78]"
      >
        Coba gratis
      </Link>

      <div className="my-3 flex items-center gap-2">
        <span className="h-px flex-1 bg-[#cbe6ef]" />
        <span className="text-[11px] text-[#8aa0ac]">atau</span>
        <span className="h-px flex-1 bg-[#cbe6ef]" />
      </div>

      <p className="text-[12px] leading-relaxed text-[#48606e]">
        Belajar untuk kerja?{" "}
        <Link href="/bisnis" className="font-medium text-[#1b6ca8] hover:underline">
          Lihat Careevo Bisnis
        </Link>{" "}
        untuk tim.
      </p>
    </aside>
  );
}
