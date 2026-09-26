"use client";

import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { mulaiTopikAction } from "@/actions/mastery";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { MasteryTopic } from "@/lib/mastery/types";
import { CincinProgres } from "./cincin-progres";

export interface MasteryCard {
  topic: MasteryTopic;
  pointCount: number;
  overall: number;
  due: number;
  points: { id: string; name: string; type: string; mastery: number }[];
}

/**
 * The mastery index: every path the learner has started, plus the one course
 * we would suggest starting.
 */
export function MasteryIndex({
  cards,
  suggestedCourse,
  hasProfile,
}: {
  cards: MasteryCard[];
  suggestedCourse: EntriKatalog | null;
  hasProfile: boolean;
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
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Jalur Penguasaan</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Setiap jalur membagi kursus jadi poin-poin yang bisa diuji. Skor
          penguasaan seorang tidak akan penuh dari satu jawaban benar saja —
          ulangi yang sudah jatuh tempo agar jadwalnya mundur.
        </p>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {!hasProfile ? (
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Lengkapi onboarding dulu untuk mendapat rekomendasi kursus.
          </p>
        ) : null}

        {cards.length === 0 ? (
          <section className="rounded-2xl border border-border bg-card p-6">
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"
            >
              <Compass size={20} strokeWidth={1.6} />
            </span>
            <h2 className="mt-3 text-xl font-bold text-foreground">Belum ada jalur penguasaan</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Mulai dari kursus yang kamu jalani. Jalur ini akan mengubah
              modul-modulnya menjadi poin yang bisa diuji dan dijadwalkan ulang.
            </p>

            {suggestedCourse ? (
              <form action={mulaiTopikAction} className="mt-5">
                <input type="hidden" name="courseId" value={suggestedCourse.id} />
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Rekomendasi
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{suggestedCourse.title}</p>
                <button
                  type="submit"
                  className="mt-4 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Mulai jalur penguasaan
                </button>
              </form>
            ) : (
              <Link
                href="/belajar"
                className="mt-5 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Jelajahi kursus
              </Link>
            )}
          </section>
        ) : (
          <>
            <section>
              <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Jalur kamu
              </h2>
              <ul className="mt-3 space-y-3">
                {cards.map((card) => (
                  <li key={card.topic.id}>
                    <Link
                      href={`/belajar/mastery/${card.topic.id}`}
                      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/25 sm:p-5"
                    >
                      <CincinProgres value={card.overall} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-foreground">
                          {card.topic.title}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                          {card.pointCount} poin
                          {card.due > 0 ? (
                            <span className="font-semibold text-primary">
                              {" "}
                              · {card.due} jatuh tempo
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {suggestedCourse ? (
              <section className="mt-10">
                <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Mulai jalur baru
                </h2>
                <form
                  action={mulaiTopikAction}
                  className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border p-4 sm:p-5"
                >
                  <input type="hidden" name="courseId" value={suggestedCourse.id} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-foreground">
                      {suggestedCourse.title}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                      {suggestedCourse.provider} · {suggestedCourse.duration_min} menit
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex h-10 shrink-0 items-center rounded-lg border border-border px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    Mulai jalur
                  </button>
                </form>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
