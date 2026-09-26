"use client";

/**
 * Right activity drawer — Careevo's port of DeepTutor's `SessionViewerPanel`.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: web/components/chat/home/SessionViewerPanel.tsx
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: one tab (Activity) instead of Activity + file previews
 * + web pages, and the content is the learner's course/module path rather than
 * a tool trace. The persisted-toggle key and the "open panel, then focus a
 * section" behaviour are kept from upstream.
 */

import Link from "next/link";
import { Activity, BookOpen, Clock, MessageSquare, X } from "lucide-react";
import type { TutorSession } from "@/lib/tutor/types";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "—";
  return new Date(parsed).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TutorActivity({
  open,
  activeSession,
  onClose,
}: {
  open: boolean;
  activeSession: TutorSession | null;
  onClose: () => void;
}) {
  return (
    <aside
      data-tutor-activity={open ? "open" : "closed"}
      aria-label="Aktivitas sesi"
      // `aria-hidden` alone does not remove a subtree from the tab order — it
      // only hides it from assistive tech. The closed drawer is translated off
      // screen but was still mounted, so Tab from the composer walked into a
      // "Tutup panel aktivitas" button and a "Buka Jalur Belajar" link that no
      // screen reader announces and no sighted user can see. `inert` closes both
      // gaps at once. It is a boolean attribute in React 19, not `inert="true"`.
      inert={!open}
      aria-hidden={!open}
      // On a narrow viewport the drawer overlays rather than squeezing the
      // transcript — a 340px panel beside a 390px screen would leave the chat
      // unusable. Matches DeepTutor's `chat-preview-shell` behaviour.
      className={cn(
        "absolute inset-y-0 right-0 z-30 flex w-[340px] max-w-[85vw] shrink-0 flex-col border-l border-border bg-background",
        "transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <Activity size={14} strokeWidth={1.8} aria-hidden="true" />
          Aktivitas
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel aktivitas"
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!activeSession ? (
          <div className="px-4 py-5">
            <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
              Aktivitas sesi
            </h3>
            <p className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-3 text-[12.5px] leading-6 text-muted-foreground">
              Begitu kamu mengirim pertanyaan, konteks kursus, modul yang
              sedang dipelajari, dan waktu jawabannya akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <section className="px-4 py-4">
              <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                Percakapan
              </h3>
              <dl className="mt-2.5 space-y-2 text-[12.5px]">
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageSquare size={12} strokeWidth={1.8} aria-hidden="true" />
                    Judul
                  </dt>
                  <dd className="min-w-0 text-right font-medium break-words text-foreground">
                    {activeSession.title}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                    <Clock size={12} strokeWidth={1.8} aria-hidden="true" />
                    Dibuat
                  </dt>
                  <dd className="text-right text-foreground">{formatDateTime(activeSession.createdAt)}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                    <Clock size={12} strokeWidth={1.8} aria-hidden="true" />
                    Diperbarui
                  </dt>
                  <dd className="text-right text-foreground">{formatDateTime(activeSession.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            <section className="px-4 py-4">
              <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                Konteks belajar
              </h3>
              {activeSession.courseId ? (
                <p className="mt-2 flex items-start gap-2 text-[12.5px] leading-6 text-foreground">
                  <BookOpen size={13} strokeWidth={1.8} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    Percakapan ini memakai konteks{" "}
                    <strong className="font-semibold">
                      {/* The title, not the id. `r1` is a database key; a
                          learner cannot act on it and it says nothing about
                          what they are studying. The id stays available as a
                          tooltip for a report or a bug. */}
                      <span title={activeSession.courseId}>
                        {activeSession.courseTitle ?? activeSession.courseId}
                      </span>
                    </strong>
                    .
                    {activeSession.moduleId ? (
                      <>
                        {" "}
                        Modul:{" "}
                        <strong className="font-semibold">
                          <span title={activeSession.moduleId}>
                            {activeSession.moduleTitle ?? activeSession.moduleId}
                          </span>
                        </strong>
                        .
                      </>
                    ) : null}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">
                  Percakapan ini belum terikat pada kursus mana pun, jadi tutor
                  menjawab tanpa konteks jalur belajarmu. Buka Jalur Belajar untuk
                  mendapat rekomendasi yang lebih tepat.
                </p>
              )}
              <Link
                href="/belajar/jalur"
                className="mt-3 inline-block text-[12.5px] font-semibold text-primary hover:underline"
              >
                Buka Jalur Belajar
              </Link>
            </section>

            <section className="px-4 py-4">
              <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                Penyimpanan
              </h3>
              {/* This used to claim the transcript "disimpan di berkas milik
                  akunmu di peramban ini — tidak ada di database bersama, dan
                  hilang bila data peramban dihapus". All three clauses were
                  false: nothing is kept in the browser, the files are one
                  server-side store shared by every account, and clearing site
                  data does not delete them. Stating a storage location the
                  learner cannot verify is worse than saying nothing, so it now
                  matches `src/lib/tutor/session-store.ts`. */}
              <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">
                Setiap percakapan disimpan di berkas milik akunmu di server
                aplikasi, terpisah dari akun lain dan tidak tampil di profil
                publikmu. Hapus percakapan dari daftar di samping untuk
                menghapusnya.
              </p>
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}
