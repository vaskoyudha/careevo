"use client";

/**
 * One question card, all six types.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: web/components/quiz/QuizViewer.tsx (question rendering + self-grade)
 * Source: web/app/(workspace)/books/components/blocks/QuizBlock.tsx (reveal)
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: one component serves all six types instead of a separate
 *   block component per surface; the A–D / true–false button row, the
 *   "type your answer" input, and the taller textareas for `written` and
 *   `coding` follow upstream, but the badges, colours and copy use this repo's
 *   tokens. The answer is **never** rendered before the learner submits or
 *   asks to reveal it — upstream's rule, kept because a rendered option list is
 *   half of the cheat surface either way.
 */

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { nilaiJuriAction, type JuriState } from "@/actions/latihan";
import { dapatDinilaiOtomatis, nilaiOtomatis } from "@/lib/latihan/nilai";
import { KUNCI_PILIHAN, isKonsep, isPilihanGanda } from "@/lib/latihan/tipe-soal";
import {
  LABEL_TINGKAT,
  LABEL_TIPE,
  type SoalLatihan,
  type SumberPenilaian,
} from "@/lib/latihan/types";
import { cn } from "@/lib/utils";

const JURI_AWAL: JuriState = { status: "idle" };

const TINGKAT_STYLE: Record<SoalLatihan["tingkat"], string> = {
  easy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  hard: "border-rose-200 bg-rose-50 text-rose-700",
};

export interface JawabanTersimpan {
  soalId: string;
  jawaban: string;
  benar: boolean | null;
  penilaian?: string;
  /** The card only ever produces these four values. */
  sumber: SumberPenilaian;
  at: string;
}

export function SoalKartu({
  latihanId,
  soal,
  tersimpan,
  nomor,
  total,
  onChange,
  onJuri,
}: {
  latihanId: string;
  soal: SoalLatihan;
  tersimpan: JawabanTersimpan | undefined;
  nomor: number;
  total: number;
  onChange: (percobaan: JawabanTersimpan) => void;
  /**
   * Mirror a judge verdict into the parent's score panel. Separate from
   * `onChange` because the judge action has already written the attempt
   * server-side — this must not trigger a second write.
   */
  onJuri: (percobaan: JawabanTersimpan) => void;
}) {
  const [jawaban, setJawaban] = useState(tersimpan?.jawaban ?? "");
  // A stored attempt means the learner already submitted this card, whatever
  // graded it. `belum` — typed but not yet scored — is a submitted state too, so
  // restoring it is what brings the self-grade and judge buttons back after a
  // reload. Matching only `otomatis`/`diri` was the bug: a free-text answer
  // survived on disk but reappeared as a blank, unsubmitted card, with no way
  // left to grade it and the score panel still counting it as "belum dinilai".
  const [terkirim, setTerkirim] = useState(Boolean(tersimpan?.jawaban.trim()));
  const [lihatJawaban, setLihatJawaban] = useState(false);
  const [menilai, setMenilai] = useState(false);
  // Restore a stored verdict so the judge's note survives a reload. Without
  // this the answer came back but its feedback did not, and the learner had no
  // way to tell an unjudged essay from one the model had already ruled on.
  const [juri, setJuri] = useState<JuriState>(() =>
    tersimpan?.penilaian
      ? {
          status: "success",
          putusan:
            tersimpan.benar === true ? "benar" : tersimpan.benar === false ? "salah" : "sebagian",
          teks: tersimpan.penilaian,
        }
      : JURI_AWAL,
  );

  const otomatis = dapatDinilaiOtomatis(soal);
  const terkunci = terkirim && otomatis;
  // The verdict chip is shown whenever a definite verdict exists, whichever
  // judge produced it. Self-grading an essay deserves the same on-card
  // confirmation as a multiple-choice submit; gating this on `otomatis` meant
  // "Menurut saya benar" changed the score with nothing on the card to show for
  // it. An ungraded free-text answer (`benar === null`) still gets no chip — it
  // is "menunggu", not wrong.
  const adaNilai = terkirim && (tersimpan?.benar === true || tersimpan?.benar === false);
  const benar = adaNilai ? tersimpan?.benar === true : null;
  // Narrowed once, outside the map: the `Record` is checked above, and keeping
  // that fact in a local is what lets the option label read without a
  // `possibly undefined` guard on every iteration.
  const opsi = isPilihanGanda(soal.tipe) ? soal.pilihan : undefined;

  function perbarui(next: string) {
    setJawaban(next);
    // Editing after a grade means the stored verdict no longer describes what
    // is on screen, so clear the local grade rather than showing a stale one.
    if (terkirim) {
      setTerkirim(false);
      setJuri(JURI_AWAL);
    }
  }

  async function kirim() {
    const nilai = otomatis ? nilaiOtomatis(soal, jawaban) : null;
    onChange({
      soalId: soal.id,
      jawaban,
      benar: nilai,
      sumber: otomatis ? "otomatis" : "belum",
      at: new Date().toISOString(),
    });
    setTerkirim(true);
  }

  function nilaiDiri(ok: boolean) {
    onChange({
      soalId: soal.id,
      jawaban,
      benar: ok,
      sumber: "diri",
      at: new Date().toISOString(),
    });
    // Drop a stale judge note: once the learner overrules it with their own
    // verdict, the stored attempt is `diri`, and leaving the old AI prose on
    // screen would show a verdict that no longer matches what was saved.
    setJuri(JURI_AWAL);
    setTerkirim(true);
    setLihatJawaban(true);
  }

  async function mintaJuri() {
    setMenilai(true);
    try {
      const formData = new FormData();
      formData.set("latihanId", latihanId);
      formData.set("soalId", soal.id);
      formData.set("jawaban", jawaban);
      // Called directly rather than through a `<form action>` so the card can
      // show its own spinner. The action still gates on the session server-side,
      // so this is a different call shape, not a client-side bypass.
      const hasil = await nilaiJuriAction(JURI_AWAL, formData);
      setJuri(hasil);
      if (hasil.status === "success") {
        // "Sebagian" maps to `null`, matching `hakimKeBoolean` on the server:
        // a half-right answer is still ungraded, not wrong. Inlined rather than
        // imported because `juri.ts` pulls in the LLM port, which is server-only.
        const benar =
          hasil.putusan === "benar" ? true : hasil.putusan === "salah" ? false : null;
        setTerkirim(true);
        onJuri({
          soalId: soal.id,
          jawaban,
          benar,
          penilaian: hasil.teks,
          sumber: hasil.putusan === "sebagian" ? "diri" : "juri",
          at: new Date().toISOString(),
        });
      }
    } finally {
      setMenilai(false);
    }
  }

  return (
    <article
      data-latihan-soal={soal.id}
      data-tipe={soal.tipe}
      data-terkirim={terkirim}
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby={`soal-${soal.id}-judul`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Soal {nomor} / {total}
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
            TINGKAT_STYLE[soal.tingkat],
          )}
        >
          {LABEL_TINGKAT[soal.tingkat]}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
          {LABEL_TIPE[soal.tipe]}
        </span>
        {soal.dariBank ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
            dari bank soal
          </span>
        ) : null}
      </header>

      <h3
        id={`soal-${soal.id}-judul`}
        className="mt-3 text-[15px] leading-6 font-semibold text-foreground"
      >
        {soal.pertanyaan}
      </h3>

      <div className="mt-4">
        {isPilihanGanda(soal.tipe) && opsi ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {KUNCI_PILIHAN.map((key) => {
              const dipilih = jawaban.toUpperCase() === key;
              const benarKey = soal.jawaban.toUpperCase() === key;
              const tampilBenar = terkunci && benarKey;
              const tampilSalah = terkunci && dipilih && !benarKey;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={terkunci}
                  aria-pressed={dipilih}
                  onClick={() => perbarui(key)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors",
                    "disabled:cursor-default",
                    tampilBenar
                      ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                      : tampilSalah
                        ? "border-rose-300 bg-rose-50 text-rose-900"
                        : dipilih
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background hover:border-foreground/25",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-bold",
                      tampilBenar
                        ? "bg-emerald-500 text-white"
                        : tampilSalah
                          ? "bg-rose-500 text-white"
                          : dipilih
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {tampilBenar ? <Check size={12} strokeWidth={3} /> : key}
                  </span>
                  <span className="min-w-0 flex-1">{opsi[key]}</span>
                  {tampilSalah ? (
                    <X size={14} className="shrink-0 text-rose-500" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : isKonsep(soal.tipe) ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(["true", "false"] as const).map((value) => {
              const dipilih = jawaban.toLowerCase() === value;
              const benarKey = soal.jawaban === value;
              const tampilBenar = terkunci && benarKey;
              const tampilSalah = terkunci && dipilih && !benarKey;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={terkunci}
                  aria-pressed={dipilih}
                  onClick={() => perbarui(value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-[14px] font-semibold transition-colors",
                    tampilBenar
                      ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                      : tampilSalah
                        ? "border-rose-300 bg-rose-50 text-rose-900"
                        : dipilih
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background hover:border-foreground/25",
                  )}
                >
                  {tampilBenar ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : null}
                  {tampilSalah ? <X size={15} strokeWidth={3} aria-hidden="true" /> : null}
                  {value === "true" ? "Benar" : "Salah"}
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            <label
              htmlFor={`jawaban-${soal.id}`}
              className="mb-1 block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
            >
              {soal.tipe === "fill_in_blank"
                ? "Isian"
                : soal.tipe === "coding"
                  ? "Kode"
                  : "Jawabanmu"}
            </label>
            {soal.tipe === "fill_in_blank" ? (
              <input
                id={`jawaban-${soal.id}`}
                type="text"
                value={jawaban}
                onChange={(event) => perbarui(event.target.value)}
                disabled={terkunci}
                placeholder="Tulis jawabanmu…"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 disabled:bg-muted"
              />
            ) : (
              <textarea
                id={`jawaban-${soal.id}`}
                value={jawaban}
                onChange={(event) => perbarui(event.target.value)}
                disabled={terkunci}
                rows={soal.tipe === "coding" ? 6 : soal.tipe === "written" ? 5 : 3}
                placeholder={
                  soal.tipe === "coding" ? "Tulis kodemu di sini…" : "Tulis jawabanmu…"
                }
                className={cn(
                  "w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 disabled:bg-muted",
                  soal.tipe === "coding" && "font-mono text-[12.5px]",
                )}
              />
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!terkirim ? (
          <button
            type="button"
            onClick={kirim}
            disabled={!jawaban.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Kirim jawaban
          </button>
        ) : null}

        {adaNilai ? (
          <span
            data-latihan-hasil={benar ? "benar" : "salah"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold",
              benar
                ? "bg-emerald-50 text-emerald-800"
                : "bg-rose-50 text-rose-800",
            )}
          >
            {benar ? (
              <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <X size={14} strokeWidth={2.2} aria-hidden="true" />
            )}
            {benar ? "Benar" : "Belum tepat"}
          </span>
        ) : null}

        {!otomatis && terkirim ? (
          <>
            <button
              type="button"
              onClick={() => nilaiDiri(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-foreground/25"
            >
              <ThumbsUp size={13} strokeWidth={1.9} aria-hidden="true" />
              Menurut saya benar
            </button>
            <button
              type="button"
              onClick={() => nilaiDiri(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-foreground/25"
            >
              <ThumbsDown size={13} strokeWidth={1.9} aria-hidden="true" />
              Belum tepat
            </button>
            <button
              type="button"
              onClick={mintaJuri}
              disabled={menilai}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-foreground/25 disabled:opacity-50"
            >
              {menilai ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles size={13} strokeWidth={1.9} aria-hidden="true" />
              )}
              Minta juri AI
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => setLihatJawaban(!lihatJawaban)}
          aria-expanded={lihatJawaban}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {lihatJawaban ? (
            <EyeOff size={13} strokeWidth={1.9} aria-hidden="true" />
          ) : (
            <Eye size={13} strokeWidth={1.9} aria-hidden="true" />
          )}
          {lihatJawaban ? "Sembunyikan jawaban" : "Lihat jawaban"}
        </button>
      </div>

      {juri.status === "error" ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800">
          {juri.message}
        </p>
      ) : null}

      {juri.status === "success" ? (
        <div
          data-latihan-juri={juri.putusan}
          className="mt-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3"
        >
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Catatan juri
          </p>
          <p className="mt-1.5 text-[13px] leading-6 whitespace-pre-line text-foreground">
            {juri.teks}
          </p>
        </div>
      ) : null}

      {lihatJawaban ? (
        <div
          data-latihan-pembahasan={soal.id}
          className="mt-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3"
        >
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Jawaban acuan
          </p>
          <p className="mt-1.5 text-[13px] leading-6 font-medium text-foreground">
            {soal.jawaban}
          </p>
          <p className="mt-2.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Pembahasan
          </p>
          <p className="mt-1.5 text-[13px] leading-6 whitespace-pre-line text-muted-foreground">
            {soal.pembahasan}
          </p>
        </div>
      ) : null}
    </article>
  );
}
