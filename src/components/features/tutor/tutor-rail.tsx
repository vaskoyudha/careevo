"use client";

/**
 * Left rail — Careevo's port of DeepTutor's collapsible icon rail.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: web/components/sidebar/WorkspaceSidebar.tsx
 * Source: web/components/sidebar/SidebarShell.tsx
 * Source: web/components/sidebar/nav-entries.ts
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: the rail carries learner nav + this learner's tutor
 * sessions rather than DeepTutor's product-wide feature list, and expansion is
 * hover-driven with a pin button instead of a hover-only affordance.
 */

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  GraduationCap,
  LayoutGrid,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Trash2,
} from "lucide-react";
import { deleteTutorSessionAction, renameTutorSessionAction } from "@/actions/tutor";
import { logoutAction } from "@/actions/auth";
import type { SessionPayload } from "@/lib/auth/types";
import type { RingkasanTutorSession } from "@/lib/tutor/session-store";
import { cn } from "@/lib/utils";

/**
 * Widths mirror DeepTutor's `SidebarShell`: a 60px icon rail at rest, opening
 * to 220px. Below `md` the rail is pinned open or closed by an explicit
 * button rather than hover, because a hover-revealed nav is unusable on touch.
 */
const NAV_ITEMS = [
  { href: "/belajar", label: "Katalog", icon: BookOpen },
  { href: "/belajar/jalur", label: "Jalur Belajar", icon: GraduationCap },
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
] as const;

function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "baru saja";
  if (diff < hour) return `${Math.floor(diff / minute)} mnt`;
  if (diff < day) return `${Math.floor(diff / hour)} jam`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} hr`;
  return new Date(then).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function initials(session: SessionPayload): string {
  return session.nama.charAt(0).toUpperCase();
}

export function TutorRail({
  session,
  sessions,
  activeSessionId,
  expanded,
  onExpandedChange,
}: {
  session: SessionPayload;
  sessions: RingkasanTutorSession[];
  activeSessionId: string | null;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  // The state is the action's own feedback and it used to be discarded here,
  // which made every rename outcome silent: the field closed on blur and the
  // title simply did not change, with nothing to tell the learner why. The
  // action distinguishes "not signed in", "no such session" and "blank title",
  // so the rail has to actually show it.
  const [renameState, renameAction, renamePending] = useActionState(
    renameTutorSessionAction,
    {
      status: "idle" as const,
      message: "",
    },
  );
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Which row is being renamed, paired with the action state it was opened
  // under. The pairing is what closes the field: `useActionState` returns a
  // NEW state object per completed action, so "the state has moved on since
  // this field opened" is a pure comparison done during render. It has to be
  // derived rather than synced in an effect — `react-hooks` v6 rejects
  // setState-in-effect, and this file is the place that rule is easiest to
  // forget. Enter therefore no longer closes the field itself (it has to let
  // the submit through, or nothing is saved at all); this does.
  const [renaming, setRenaming] = useState<{ id: string; openedAt: unknown } | null>(null);
  const renamingId = renaming !== null && renaming.openedAt === renameState ? renaming.id : null;

  const openRename = useCallback((id: string) => {
    setRenaming({ id, openedAt: renameState });
  }, [renameState]);
  const closeRename = useCallback(() => setRenaming(null), []);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const filtered = sessions.filter((item) =>
    item.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <aside
      data-tutor-rail="true"
      data-expanded={expanded}
      // `group/rail` + `data-expanded` lets hover expand the rail on a pointer
      // device while React owns the explicitly pinned state for touch, where
      // there is no hover to reveal the session list.
      //
      // Below `md` an expanded rail overlays instead of pushing: a 220px column
      // against a 390px screen leaves ~170px of transcript, which is too narrow
      // to read a chat in. It is a sibling of the centre column in the flex row
      // (not a child), so it is positioned against the shell — the same split
      // DeepTutor's `AppShell` makes with `max-md:fixed`.
      className={cn(
        "group/rail relative flex h-dvh w-[60px] shrink-0 flex-col border-r border-border bg-muted/40 transition-[width] duration-200",
        "data-[expanded=true]:w-[220px]",
        // As an overlay the rail no longer occupies flex space, so the centre
        // column runs the full width behind it. It has to be opaque or the
        // centre's title shows through the header.
        "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:bg-background max-md:shadow-xl",
      )}
      onMouseEnter={() => {
        // Hover only expands where a hover exists. On a coarse pointer there
        // is no hover, so the explicit expand button is the only way in —
        // which is exactly why the button exists.
        if (window.matchMedia("(hover: hover)").matches) onExpandedChange(true);
      }}
    >
      {/* Scrim: tapping outside dismisses the rail on small screens, where it
          covers the transcript. `z-20` puts it under the rail's own content
          (`z-30`) but over the transcript. */}
      {expanded ? (
        <button
          type="button"
          onClick={() => onExpandedChange(false)}
          aria-label="Tutup navigasi"
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      ) : null}

      <div className="relative z-40 flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 bg-inherit px-3 py-3">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground"
        >
          C
        </span>
        {/* The brand only shows once the rail is wide enough to hold it, so it
            cannot collide with the centre column's title while collapsed. */}
        <span className="hidden min-w-0 flex-1 truncate text-sm font-bold tracking-tight group-data-[expanded=true]/rail:block">
          careevo<span className="text-primary">.</span>
        </span>
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          aria-label={expanded ? "Ciutkan navigasi" : "Lebarkan navigasi"}
          aria-expanded={expanded}
          // Always visible, and it sits on its own row when the rail is
          // collapsed. On a coarse pointer there is no hover, so this button is
          // the *only* way to reach the session list — hiding it while
          // collapsed would lock a touch user out of their own history.
          className="flex size-7 shrink-0 items-center justify-center self-end rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          {expanded ? <PanelLeftClose size={15} strokeWidth={1.6} /> : <PanelLeftOpen size={15} strokeWidth={1.6} />}
        </button>
      </div>

      <nav aria-label="Navigasi tutor" className="px-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  )}
                >
                  <Icon size={15} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />
                  <span className="hidden truncate group-data-[expanded=true]/rail:block">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex items-center gap-2 px-2.5 pb-1.5">
          <MessageSquare size={13} strokeWidth={1.8} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <h2 className="hidden flex-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase group-data-[expanded=true]/rail:block">
            Percakapan
          </h2>
          <span className="ml-auto hidden text-[11px] text-muted-foreground group-data-[expanded=true]/rail:block">
            {sessions.length}
          </span>
        </div>

        {sessions.length > 0 ? (
          <div className="mb-1 hidden px-1 group-data-[expanded=true]/rail:block">
            <label className="relative block">
              <span className="sr-only">Cari percakapan</span>
              <Search
                size={13}
                strokeWidth={1.8}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari…"
                className="w-full rounded-md border border-border bg-background py-1.5 pr-2 pl-7 text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
              />
            </label>
          </div>
        ) : null}

        {/* Hidden while collapsed, unlike every other row in this rail. A 60px
            rail cannot show a title: the row's `pr-8` plus the `shrink-0`
            timestamp leave the title span about 12px, so the list rendered as a
            bare column of "17 jam" / "18 jam" down the left edge with no header
            to explain it. Nothing legible fits, so nothing is drawn. */}
        <ul className="hidden space-y-0.5 group-data-[expanded=true]/rail:block">
          {filtered.map((item) => {
            const active = item.id === activeSessionId;
            return (
              <li key={item.id} className="group/item relative">
                {renamingId === item.id ? (
                  <form action={renameAction} className="px-1">
                    <input type="hidden" name="sessionId" value={item.id} />
                    <input
                      ref={renameInputRef}
                      name="title"
                      defaultValue={item.title}
                      maxLength={80}
                      onBlur={closeRename}
                      onKeyDown={(event) => {
                        // Enter must reach the form. It used to
                        // `preventDefault()` alongside Escape, which cancels
                        // implicit submission — so pressing Enter just closed
                        // the field and never renamed anything. Escape is the
                        // only key that cancels here.
                        if (event.key === "Escape") {
                          event.preventDefault();
                          closeRename();
                        }
                      }}
                      aria-label="Nama percakapan"
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px] focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
                    />
                    <button type="submit" disabled={renamePending} className="sr-only">
                      Simpan
                    </button>
                  </form>
                ) : (
                  <Link
                    href={`/belajar/tutor/${item.id}`}
                    title={item.title}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-lg px-2.5 pr-8 text-[12.5px] transition-colors",
                      active
                        ? "bg-background font-medium text-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelative(item.updatedAt)}
                    </span>
                  </Link>
                )}

                <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => openRename(item.id)}
                    aria-label={`Ubah nama ${item.title}`}
                    className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <PencilIcon />
                  </button>
                  <form action={deleteTutorSessionAction}>
                    <input type="hidden" name="sessionId" value={item.id} />
                    <button
                      type="submit"
                      aria-label={`Hapus ${item.title}`}
                      className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={12} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>

        {sessions.length > 0 && filtered.length === 0 ? (
          <p className="px-2.5 py-2 text-[12px] text-muted-foreground">
            Tidak ada percakapan yang cocok.
          </p>
        ) : null}

        {/* The action's verdict on the last rename. `aria-live` because it
            appears after a submit the learner has already moved focus past, and
            a failure here is otherwise completely invisible. */}
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "hidden px-2.5 pt-2 text-[11.5px] leading-4 group-data-[expanded=true]/rail:block",
            renamePending && "text-muted-foreground",
            !renamePending && renameState.status === "saved" && "text-success",
            !renamePending && renameState.status === "idle" && "text-destructive",
          )}
        >
          {renamePending ? "Menyimpan…" : renameState.message}
        </p>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-2 py-2.5">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 text-[12px] font-semibold text-primary"
        >
          {initials(session)}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-[12px] text-muted-foreground group-data-[expanded=true]/rail:block">
          {session.nama}
        </span>
        <form action={logoutAction} className="hidden group-data-[expanded=true]/rail:block">
          <button
            type="submit"
            className="rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
          >
            Keluar
          </button>
        </form>
      </div>
      </div>
    </aside>
  );
}

/** Pencil, drawn inline so the rail does not pull in a second icon import. */
function PencilIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
