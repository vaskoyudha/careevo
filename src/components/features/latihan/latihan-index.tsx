"use client";

/**
 * The quiz index: every quiz the learner has made, plus the form to make one.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: web/components/quiz/QuizConfigPanel.tsx
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: upstream's panel has a mode selector (custom vs mimic an
 *   exam), a draggable per-type ratio bar, and difficulty presets. Only the
 *   difficulty presets and the per-type selection are kept: "mimic an exam" has
 *   no source document in Careevo, and the ratio bar is replaced by a count per
 *   type because a drag-only control is unusable by keyboard and on touch —
 *   the data it edits is identical, so swapping it back is a UI change, not a
 *   schema change.
 */

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ListChecks, Sparkles, Trash2 } from "lucide-react";
import { buatLatihanAction, hapusLatihanAction, type LatihanActionState } from "@/actions/latihan";
import type { EntriKatalog } from "@/lib/courses/katalog";
import { TIPE_SOAL } from "@/lib/latihan/tipe-soal";
import { KETERANGAN_TIPE, LABEL_TINGKAT, type Latihan, type TingkatSoal } from "@/lib/latihan/types";
import { cn } from "@/lib/utils";

const AWAL: LatihanActionState = { status: "idle" };

const TINGKAT: readonly TingkatSoal[] = ["easy", "medium", "hard"];

export interface KartuLatihan {
  latihan: Latihan;
  jumlahSoal: number;
  nilaiPersen: number;
  dijawab: number;
}

export function LatihanIndex({
  kartu,
  katalog,
  courseIdPilihan,
  hasProfile,
  pakaiModel,
}: {
  kartu: KartuLatihan[];
  katalog: EntriKatalog[];
  courseIdPilihan: string | null;
  hasProfile: boolean;
  pakaiModel: boolean;
}) {
  const [state, formAction, pending] = useActionState(buatLatihanAction, AWAL);
  const [tipe, setTipe] = useState<string[]>(["choice", "concept", "short_answer"]);

  function toggleTipe(value: string) {
    // Never allow an empty selection: a quiz with no types has nothing to
    // generate, and the form would submit a request that can only fail.
    setTipe((sebelumnya) =>
      sebelumnya.includes(value)
        ? sebelumnya.length > 1
          ? sebelumnya.filter((item) => item !== value)
          : sebelumnya
        : [...sebelumnya, value],
    );
  }

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
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Latihan Soal</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Kuis singkat dari kursus yang sedang kamu jalankan. Pilihan ganda, benar
          atau salah, dan isian menilai sendiri; uraian bisa kamu nilai sendiri
          atau diserahkan ke juri AI.
        </p>
        {!pakaiModel ? (
          <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-[12.5px] leading-5 text-muted-foreground">
            Tanpa kunci model, soal disusun dari materi kursus secara
            deterministik. Soal dari bank soal admin dipakai apa adanya;
            sisanya diturunkan dari judul dan ringkasan modul, jadi tidak ada
            kalimat yang dikarang.
          </p>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {kartu.length > 0 ? (
          <section aria-labelledby="judul-daftar-latihan">
            <h2
              id="judul-daftar-latihan"
              className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Latihanmu
            </h2>
            <ul className="mt-3 space-y-2.5">
              {kartu.map(({ latihan, jumlahSoal, nilaiPersen, dijawab }) => (
                <li key={latihan.id} className="flex items-center gap-3">
                  <Link
                    href={`/belajar/latihan/${latihan.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/25"
                  >
                    <ListChecks
                      size={18}
                      strokeWidth={1.6}
                      className="shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-foreground">
                        {latihan.judul}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {jumlahSoal} soal · {LABEL_TINGKAT[latihan.tingkat]} ·{" "}
                        {dijawab > 0 ? `${nilaiPersen}/100` : "belum dikerjakan"}
                      </p>
                    </div>
                  </Link>
                  <form action={hapusLatihanAction}>
                    <input type="hidden" name="latihanId" value={latihan.id} />
                    <button
                      type="submit"
                      aria-label={`Hapus ${latihan.judul}`}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          aria-labelledby="judul-buat-latihan"
          className={cn("rounded-2xl border border-border bg-card p-5 sm:p-6", kartu.length > 0 && "mt-8")}
        >
          <h2
            id="judul-buat-latihan"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Buat latihan baru
          </h2>

          {!hasProfile ? (
            <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-[13px] text-muted-foreground">
              Lengkapi onboarding dulu supaya latihanmu bisa mengikuti jalur belajarmu.
            </p>
          ) : (
            <form action={formAction} className="mt-4 space-y-5">
              <div>
                <label
                  htmlFor="courseId"
                  className="mb-1.5 block text-[12px] font-semibold text-foreground"
                >
                  Kursus
                </label>
                <select
                  id="courseId"
                  name="courseId"
                  defaultValue={courseIdPilihan ?? ""}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] text-foreground outline-none focus:border-primary/40"
                >
                  <option value="">Ikuti jalur belajarmu</option>
                  {katalog.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-[12px] font-semibold text-foreground">
                  Kesulitan
                </legend>
                <div className="flex flex-wrap gap-2">
                  {TINGKAT.map((value) => (
                    <label
                      key={value}
                      className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="radio"
                        name="tingkat"
                        value={value}
                        defaultChecked={value === "medium"}
                        className="sr-only"
                      />
                      {LABEL_TINGKAT[value]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label
                  htmlFor="jumlah"
                  className="mb-1.5 block text-[12px] font-semibold text-foreground"
                >
                  Jumlah soal
                </label>
                <input
                  id="jumlah"
                  name="jumlah"
                  type="number"
                  min={3}
                  max={20}
                  defaultValue={8}
                  className="w-28 rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] text-foreground outline-none focus:border-primary/40"
                />
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  3–20 soal. Kalau materinya belum cukup, jumlah sebenarnya bisa
                  lebih sedikit.
                </p>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-[12px] font-semibold text-foreground">
                  Tipe soal
                </legend>
                <ul className="space-y-1.5">
                  {TIPE_SOAL.map((value) => (
                    <li key={value}>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border px-3 py-2.5 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <input
                          type="checkbox"
                          name="tipe"
                          value={value}
                          checked={tipe.includes(value)}
                          onChange={() => toggleTipe(value)}
                          className="mt-0.5 size-4 accent-[var(--primary)]"
                        />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-foreground">
                            {value === "choice"
                              ? "Pilihan Ganda"
                              : value === "concept"
                                ? "Benar / Salah"
                                : value === "fill_in_blank"
                                  ? "Isian"
                                  : value === "short_answer"
                                    ? "Jawaban Singkat"
                                    : value === "written"
                                      ? "Uraian"
                                      : "Kode"}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">
                            {KETERANGAN_TIPE[value]}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>

              <div>
                <label
                  htmlFor="fokus"
                  className="mb-1.5 block text-[12px] font-semibold text-foreground"
                >
                  Fokus (opsional)
                </label>
                <input
                  id="fokus"
                  name="fokus"
                  type="text"
                  maxLength={300}
                  placeholder="misalnya: state dan efek di React"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                />
              </div>

              {state.status === "error" ? (
                <p
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-800"
                >
                  {state.message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles size={15} strokeWidth={1.9} aria-hidden="true" />
                {pending ? "Menyusun soal…" : "Susun latihan"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
