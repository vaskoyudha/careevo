"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, BookOpen, List, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { BookBundle } from "@/lib/book/types";
import { CONTENT_TYPE_LABEL } from "@/lib/book/types";
import { BlokRenderer } from "./blok-renderer";
import { cn } from "@/lib/utils";

/**
 * The reader: a table of contents on the left, the page in the middle.
 *
 * The contents rail is collapsible because a book's spine can be long, and a
 * 300px column permanently spent on navigation is a third of a laptop screen.
 */
export function BookReader({ bundle }: { bundle: BookBundle }) {
  const { book, spine, pages, compiledBy } = bundle;
  const [navOpen, setNavOpen] = useState(true);
  const [activePageId, setActivePageId] = useState(pages[0]?.id ?? "");

  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];
  const activeChapter = activePage
    ? spine.chapters.find((chapter) => chapter.id === activePage.chapterId)
    : null;
  const pageIndex = activePage ? pages.findIndex((page) => page.id === activePage.id) : -1;
  const prev = pageIndex > 0 ? pages[pageIndex - 1] : null;
  const next = pageIndex >= 0 && pageIndex < pages.length - 1 ? pages[pageIndex + 1] : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside
        data-book-nav={navOpen ? "open" : "closed"}
        className={cn(
          "flex h-dvh shrink-0 flex-col border-r border-border bg-muted/30 transition-[width] duration-200",
          navOpen ? "w-[260px]" : "w-[52px]",
        )}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          {navOpen ? (
            <Link
              href="/belajar/buku"
              className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft size={14} strokeWidth={1.7} aria-hidden="true" />
              <span className="truncate">Buku</span>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            aria-label={navOpen ? "Sembunyikan daftar isi" : "Tampilkan daftar isi"}
            aria-expanded={navOpen}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            {navOpen ? (
              <PanelLeftClose size={15} strokeWidth={1.6} aria-hidden="true" />
            ) : (
              <PanelLeftOpen size={15} strokeWidth={1.6} aria-hidden="true" />
            )}
          </button>
        </div>

        {navOpen ? (
          <nav aria-label="Daftar isi" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            <ol className="space-y-1">
              {spine.chapters.map((chapter) => {
                const chapterPage = pages.find((page) => page.id === chapter.pageIds[0]);
                const active = chapterPage?.id === activePage?.id;
                return (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      onClick={() => chapterPage && setActivePageId(chapterPage.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                        active
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                      )}
                    >
                      <span className="mt-0.5 shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                        {chapter.order + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] leading-5 font-medium break-words">
                          {chapter.title}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                          {CONTENT_TYPE_LABEL[chapter.contentType]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {spine.chapters.length === 0 ? (
              <p className="px-2.5 py-2 text-[12.5px] text-muted-foreground">
                Buku ini belum punya bab.
              </p>
            ) : null}
          </nav>
        ) : (
          <div className="flex flex-1 flex-col items-center gap-1 py-3">
            <List size={15} strokeWidth={1.6} className="text-muted-foreground" aria-hidden="true" />
          </div>
        )}

        {navOpen ? (
          <div className="border-t border-border px-3 py-2.5">
            <p className="text-[10.5px] leading-4 text-muted-foreground">
              {compiledBy === "gemini"
                ? "Disusun dengan Gemini."
                : "Disusun dari materi kursus (mode contoh)."}
            </p>
          </div>
        ) : null}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {activePage ? (
          <>
            <header className="shrink-0 border-b border-border px-6 py-4">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {activeChapter?.title ?? book.title}
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">
                {activePage.title}
              </h1>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <article className="mx-auto w-full max-w-[720px] space-y-5 px-6 py-8">
                {activePage.learningObjectives.length > 0 ? (
                  <section className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                    <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                      Setelah membaca ini kamu bisa
                    </p>
                    <ul className="mt-1.5 space-y-1 pl-5 text-[13.5px] leading-6 text-foreground/90 list-disc">
                      {activePage.learningObjectives.map((objective, index) => (
                        <li key={index}>{objective}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {activePage.blocks.map((block) => (
                  <BlokRenderer key={block.id} block={block} />
                ))}

                {activePage.blocks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Halaman ini belum punya isi.
                  </p>
                ) : null}
              </article>
            </div>

            <footer className="shrink-0 border-t border-border px-6 py-3">
              <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-3">
                {prev ? (
                  <button
                    type="button"
                    onClick={() => setActivePageId(prev.id)}
                    className="inline-flex h-9 max-w-[45%] items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <ArrowLeft size={13} strokeWidth={1.8} aria-hidden="true" />
                    <span className="truncate">{prev.title}</span>
                  </button>
                ) : (
                  <span />
                )}
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {pageIndex + 1} / {pages.length}
                </span>
                {next ? (
                  <button
                    type="button"
                    onClick={() => setActivePageId(next.id)}
                    className="inline-flex h-9 max-w-[45%] items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <span className="truncate">{next.title}</span>
                    <ArrowLeft size={13} strokeWidth={1.8} className="rotate-180" aria-hidden="true" />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            </footer>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span
              aria-hidden="true"
              className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"
            >
              <BookOpen size={22} strokeWidth={1.6} />
            </span>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Buku ini belum disusun. Kembali ke daftar dan susun ulang.
            </p>
            <Link
              href="/belajar/buku"
              className="mt-2 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Ke daftar buku
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
