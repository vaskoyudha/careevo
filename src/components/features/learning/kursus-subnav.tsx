"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { ScrollSubNav } from "@/components/ui/scroll-subnav";

/**
 * Sticky course sub-header — the `/careevo-plus` bar, pointed at a course.
 *
 * Same mechanism (see `ScrollSubNav`): absent while the course header is on
 * screen, sliding in underneath the navbar once it has scrolled away, so a long
 * curriculum does not strand the title and the one next action above the fold.
 *
 * The reveal is measured from the header block rather than a scroll offset
 * because that block is content-driven — a long course title wraps and pushes it
 * down — so a fixed `scrollY > 360` would fire while the header was still
 * visible and pop the bar in mid-read.
 *
 * Deliberately **not** the only route to anything: the header keeps its own
 * title and the sidebar its own CTA. This is the shortcut for someone already
 * scrolled, not a replacement.
 */
export function KursusSubNav({
  judul,
  penyedia,
  terdaftar,
  progres,
  selesai,
  total,
  gratis,
  pending,
  onDaftar,
  hrefLanjut,
  trigger,
}: {
  judul: string;
  penyedia: string;
  terdaftar: boolean;
  progres: number;
  selesai: number;
  total: number;
  gratis: boolean;
  pending: boolean;
  onDaftar: () => void;
  /**
   * Reader route for the course's first unfinished module, computed by
   * `detail-kursus.tsx` — the page owns the progress state, so it owns the
   * "which module is next" decision too. `#kurikulum` is the caller's fallback
   * for an empty curriculum.
   */
  hrefLanjut: string;
  /** The course header block, owned by `detail-kursus.tsx`. */
  trigger: RefObject<HTMLElement | null>;
}) {
  return (
    <ScrollSubNav trigger={trigger}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm bg-[#0056D2] text-[10px] font-bold text-white"
        >
          {penyedia.charAt(0)}
        </span>
        {/* Two lines, not one: the title is arbitrary-length user data and a
            single truncated line can reduce to an unidentifiable stub. The bar
            is `min-h` rather than a fixed height so this is free. */}
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-gray-900">{judul}</span>
          <span className="block truncate text-xs text-gray-500">
            {penyedia} · {total} modul
          </span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {terdaftar ? (
          <span
            className="hidden text-xs font-semibold text-emerald-700 sm:inline"
            role="status"
          >
            {progres}% · {selesai}/{total} modul
          </span>
        ) : null}
        {terdaftar ? (
          <Link
            href={hrefLanjut}
            className={`chrome-btn-brand ${progres === 100 ? "chrome-btn-white" : ""}`}
            style={{
              ...(progres === 100 ? {
                color: "#000000",
                background: "linear-gradient(to bottom right, #fafafa, #f5f5f5, #d4d4d4)",
                border: "1px solid #d4d4d4",
                boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
              } : {})
            }}
          >
            {progres === 100 ? "Review & selesaikan" : "Lanjutkan belajar"}
          </Link>
        ) : gratis ? (
          <button
            type="button"
            onClick={onDaftar}
            disabled={pending}
            className="chrome-btn-brand"
          >
            {pending ? "Mendaftar…" : "Daftar gratis"}
          </button>
        ) : (
          <Link href="/careevo-plus#paket" className="chrome-btn-brand">
            Lihat paket Plus
          </Link>
        )}
      </div>
    </ScrollSubNav>
  );
}
