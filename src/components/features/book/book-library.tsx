"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Sparkles, Trash2 } from "lucide-react";
import { buatBukuAction, hapusBukuAction } from "@/actions/book";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { Book, BookDepth } from "@/lib/book/types";

const DEPTH_LABEL: Record<BookDepth, string> = {
  brief: "Ringkas",
  standard: "Menengah",
  deep: "Mendalam",
};

const DEPTH_HINT: Record<BookDepth, string> = {
  brief: "±500 kata per bab",
  standard: "±1.000 kata per bab",
  deep: "±1.600 kata per bab",
};

export function BookLibrary({
  books,
  suggestedCourse,
  hasProfile,
  pakaiModel,
}: {
  books: Book[];
  suggestedCourse: EntriKatalog | null;
  hasProfile: boolean;
  pakaiModel: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto w-full max-w-4xl px-6 pt-6 pb-0">
        <Link
          href="/belajar/jalur"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} strokeWidth={1.7} aria-hidden="true" />
          Jalur Belajar
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Buku</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Buku belajar yang disusun dari kursus yang kamu jalani — satu bab
          per modul, lengkap dengan latihan dan kartu ingatan.
        </p>
        {!pakaiModel ? (
          <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-[12.5px] leading-5 text-muted-foreground">
            Tanpa kunci model, buku disusun dari materi kursus secara
            deterministik. Tetap terbaca dan lengkap; prosanya yang akan ditulis
            model setelah kuncinya diisi.
          </p>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {books.length > 0 ? (
          <section>
            <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Bukumu
            </h2>
            <ul className="mt-3 space-y-3">
              {books.map((book) => (
                <li key={book.id} className="flex items-center gap-3">
                  <Link
                    href={`/belajar/buku/${book.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/25 sm:p-5"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
                    >
                      <BookOpen size={19} strokeWidth={1.6} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-foreground">
                        {book.title}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        {book.status === "ready" ? "Siap dibaca" : "Belum disusun"} ·{" "}
                        {DEPTH_LABEL[book.depth]}
                      </p>
                    </div>
                  </Link>
                  <form action={hapusBukuAction}>
                    <input type="hidden" name="bookId" value={book.id} />
                    <button
                      type="submit"
                      aria-label={`Hapus ${book.title}`}
                      className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={books.length > 0 ? "mt-10" : undefined}>
          <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {books.length > 0 ? "Susun buku baru" : "Belum ada buku"}
          </h2>

          {!hasProfile ? (
            <p className="mt-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Lengkapi onboarding dulu untuk mendapat rekomendasi kursus.
            </p>
          ) : suggestedCourse ? (
            <form
              action={buatBukuAction}
              className="mt-3 rounded-2xl border border-border bg-card p-5"
            >
              <input type="hidden" name="courseId" value={suggestedCourse.id} />

              <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                <Sparkles size={15} strokeWidth={1.7} className="text-primary" aria-hidden="true" />
                Susun dari {suggestedCourse.title}
              </p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {suggestedCourse.provider} · {suggestedCourse.duration_min} menit ·{" "}
                {suggestedCourse.level}
              </p>

              <label className="mt-5 block">
                <span className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Kedalaman
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["brief", "standard", "deep"] as const).map((depth) => (
                    <label key={depth} className="cursor-pointer">
                      <input
                        type="radio"
                        name="depth"
                        value={depth}
                        defaultChecked={depth === "standard"}
                        className="peer sr-only"
                      />
                      <span className="inline-flex flex-col rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30">
                        {DEPTH_LABEL[depth]}
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {DEPTH_HINT[depth]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </label>

              <label className="mt-5 block">
                <span className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Apa yang kamu butuhkan dari buku ini? (opsional)
                </span>
                <textarea
                  name="intent"
                  rows={3}
                  maxLength={400}
                  placeholder="Contoh: aku masih bingung soal flexbox, tolong tekankan dari contoh."
                  className="mt-2 w-full resize-y rounded-lg border border-border bg-background px-3.5 py-2.5 text-[14px] leading-6 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
                />
              </label>

              <button
                type="submit"
                className="mt-5 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Susun buku
              </button>
            </form>
          ) : (
            <Link
              href="/belajar"
              className="mt-3 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Jelajahi kursus
            </Link>
          )}
        </section>
      </main>
    </div>
  );
}
