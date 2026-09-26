import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LearnerChrome } from "./learner-chrome";
import { SiteFooter } from "./site-footer";
import { CareevoPlusPromoBanner } from "@/components/features/marketing/careevo-plus/header";
import type { SessionPayload } from "@/lib/auth/types";

function LearnerTopPromoBar() {
  return (
    <div className="relative z-[60] flex min-h-8 items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 px-4 py-2 text-center text-[11px] text-white sm:gap-3 sm:text-[13px]">
      <span className="font-mono text-white/75">Baru</span>
      <Link
        href="/daftar"
        className="inline-flex items-center gap-1 font-medium text-white underline underline-offset-4 transition-opacity hover:opacity-75"
      >
        Coba demo Careevo gratis
        <ArrowUpRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
      </Link>
    </div>
  );
}

export function LearnerShell({
  session,
  queryAwal = "",
  overlayMain = false,
  promoBars = false,
  showFooter = true,
  chrome,
  shellClassName = "",
  children,
}: {
  session: SessionPayload;
  queryAwal?: string;
  overlayMain?: boolean;
  promoBars?: boolean;
  /** Full-height pages (e.g. the framed AI Mastery app) opt out: the footer would
   *  only push content below the fold. */
  showFooter?: boolean;
  /** Swap the navbar wholesale. `/ai-mastery` passes `AiMasteryNavbar`; the
   *  default is the light glass `LearnerChrome`. */
  chrome?: ReactNode;
  /** Modifier for the wrapper, for pages that need to publish a measurement
   *  (bar height) to their content. `ai-mastery-shell` does this. */
  shellClassName?: string;
  children: React.ReactNode;
}) {
  const shouldOverlayMain = overlayMain && !promoBars;

  return (
    <div
      className={`min-h-screen bg-white font-sans text-gray-900 antialiased ${
        shouldOverlayMain ? "learner-shell--overlay" : ""
      } ${shellClassName}`}
    >
      {promoBars ? <LearnerTopPromoBar /> : null}
      {chrome ?? <LearnerChrome session={session} queryAwal={queryAwal} />}
      {promoBars ? <CareevoPlusPromoBanner href="/careevo-plus" /> : null}

      <main id="main">{children}</main>

      {showFooter ? <SiteFooter /> : null}
    </div>
  );
}
