import Link from "next/link";
import { LearnerChrome } from "./learner-chrome";
import type { SessionPayload } from "@/lib/auth/types";

const FOOTER_GROUPS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Belajar",
    links: [
      { label: "Katalog kursus", href: "/belajar" },
      { label: "Careevo Plus", href: "/careevo-plus" },
      { label: "Paket tim", href: "/careevo-plus#paket" },
    ],
  },
  {
    heading: "Karier",
    links: [
      { label: "Loker", href: "/loker" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Pengaturan", href: "/pengaturan" },
    ],
  },
];

export function LearnerShell({
  session,
  queryAwal = "",
  children,
}: {
  session: SessionPayload;
  queryAwal?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased">
      <LearnerChrome session={session} queryAwal={queryAwal} />

      <main id="main">{children}</main>

      <footer className="border-t border-gray-200 bg-[#f5f7fa]">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-lg font-bold tracking-tight text-gray-900">
              careevo<span className="text-[#0056D2]">.</span>
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-600">
              Belajar terukur, challenge praktik, dan karya terverifikasi — satu
              alur sampai siap kerja.
            </p>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.heading} aria-label={`Footer ${group.heading}`}>
              <h2 className="text-sm font-semibold tracking-wide text-gray-900 uppercase">
                {group.heading}
              </h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-[#0056D2] hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-gray-200">
          <p className="mx-auto w-full max-w-7xl px-4 py-4 text-xs text-gray-500 sm:px-6 lg:px-8">
            © 2026 Careevo · Prototipe fixture — tanpa database.
          </p>
        </div>
      </footer>
    </div>
  );
}
