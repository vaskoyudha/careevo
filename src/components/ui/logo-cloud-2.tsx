/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

export type Logo = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export type LogoCloudProps = React.ComponentProps<"div">;

/**
 * The boards this strip names, each with what Careevo actually does with it.
 *
 * These replace the 8 foreign SaaS logos (Nvidia, OpenAI, Vercel, Clerk,
 * Claude, Turso, Supabase, GitHub) that this component shipped with. Those
 * implied partnerships that do not exist and that Careevo has no relationship
 * with — see the table in `vertex-kerja-view.tsx` and `.agents/skills/
 * loker-sentinel/SKILL.md`. Every entry below is traceable to code:
 *
 *   - glints.com / jobstreet.co.id  — `src/lib/jobs/trust.ts:71-74`, the
 *     Indonesian boards added on top of upstream's ATS-only list.
 *   - the ATS hosts — `trust.ts:56-70`. These are not places we post to or
 *     integrate with; Sentinel judges a posting by the domain it sits on, so
 *     a posting on a known ATS host is evidence *about the posting*, not a
 *     partnership claim.
 *
 * Deliberately no logo images. A real brand mark implies a real relationship,
 * so each cell is a name plus the fact it stands for — which is also honest
 * about what "terhubung dengan" means here: we read them, we are not on them.
 */
const SUMBER_LOWONGAN = [
  { nama: "Glints", fakta: "Papan lowongan Indonesia yang dipindai" },
  { nama: "Jobstreet", fakta: "Papan lowongan Indonesia yang dipindai" },
  { nama: "KarirHub", fakta: "Papan lowongan Indonesia yang dipindai" },
  { nama: "Greenhouse", fakta: "ATS perusahaan — Sentinel menilai posting di host ini" },
  { nama: "Workday", fakta: "ATS perusahaan — Sentinel menilai posting di host ini" },
  { nama: "Lever", fakta: "ATS perusahaan — Sentinel menilai posting di host ini" },
] as const;

export function LogoCloud({ className, ...props }: LogoCloudProps) {
  return (
    <div
      className={cn(
        "relative grid grid-cols-2 border-x border-neutral-200 dark:border-neutral-800 md:grid-cols-3",
        className
      )}
      {...props}
    >
      <div className="-translate-x-1/2 -top-px pointer-events-none absolute left-1/2 w-screen border-t border-neutral-200 dark:border-neutral-800" />

      {SUMBER_LOWONGAN.map((sumber) => (
        <div
          key={sumber.nama}
          className="flex flex-col items-center justify-center gap-1 border-b border-r border-neutral-200 bg-neutral-50/70 px-4 py-7 text-center dark:border-neutral-800 dark:bg-neutral-900/40 md:py-8"
        >
          <p className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">
            {sumber.nama}
          </p>
          <p className="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
            {sumber.fakta}
          </p>
        </div>
      ))}

      <div className="-translate-x-1/2 -bottom-px pointer-events-none absolute left-1/2 w-screen border-b border-neutral-200 dark:border-neutral-800" />
    </div>
  );
}

export type LogoCardProps = React.ComponentProps<"div"> & {
  logo: Logo;
};

export function LogoCard({ logo, className, children, ...props }: LogoCardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-background px-4 py-8 md:p-8",
        className
      )}
      {...props}
    >
      <img
        alt={logo.alt}
        className="pointer-events-none h-4 select-none md:h-5 dark:brightness-0 dark:invert"
        height={logo.height || "auto"}
        src={logo.src}
        width={logo.width || "auto"}
      />
      {children}
    </div>
  );
}
