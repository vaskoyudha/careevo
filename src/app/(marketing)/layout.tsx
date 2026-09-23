import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Chrome } from "@/components/ui/chrome";
import { MarketingFooter } from "@/components/features/marketing/footer";
import { geist, geistMono } from "@/components/features/marketing/fonts";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${geist.variable} ${geistMono.variable} min-h-screen bg-white text-gray-900`}
    >
      <div className="guild-type relative z-[60] flex items-center justify-center gap-3 bg-linear-to-r from-blue-600 via-blue-500 to-blue-400 px-4 py-2 text-[13px] text-white">
        <span className="font-mono text-white/75">Baru</span>
        <Link
          href="/daftar"
          className="inline-flex items-center gap-1 font-medium text-white underline underline-offset-4 transition-opacity hover:text-white hover:opacity-75"
        >
          Coba demo Careevo gratis
          <ArrowUpRight className="size-3.5" strokeWidth={2} />
        </Link>
      </div>
      <Chrome />
      <main id="main">{children}</main>
      <div className="marketing-type">
        <MarketingFooter />
      </div>
    </div>
  );
}
