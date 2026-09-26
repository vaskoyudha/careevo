"use client";

/**
 * The quiz viewer.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: web/components/quiz/QuizViewer.tsx
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: upstream's 1,400-line viewer (WebSocket judge streaming,
 * per-question chat follow-up, image attachments, a notebook sidebar) is reduced
 * to what this product needs: a question rail for jumping around, a live score,
 * and one card at a time. The judge call is a server action rather than a
 * WebSocket, and attempts are written to a file store — both documented
 * divergences are in `AGENTS.md`.
 *
 * Grading happens in the browser for the three deterministic types and is then
 * persisted, so a refresh restores every answer. Correct answers still ship to
 * the renderer, so this is a practice tool, not a cheat-resistant exam — the
 * same trade-off the existing course quiz makes, and the reason the next line
 * exists at all.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { catatJawabanAction, hapusLatihanAction, ulangiLatihanAction } from "@/actions/latihan";
import { hitungStatistik, type StatistikLatihan } from "@/lib/latihan/nilai";
import type {
  Latihan,
  PercobaanSoal,
  SoalLatihan,
  SumberPenilaian,
} from "@/lib/latihan/types";
import { cn } from "@/lib/utils";
import { SoalKartu, type JawabanTersimpan } from "./soal-kartu";

export function LatihanView({
  latihan,
  soal,
  percobaanAwal,
}: {
  latihan: Latihan;
  soal: SoalLatihan[];
  percobaanAwal: PercobaanSoal[];
}) {
  const [percobaan, setPercobaan] = useState<PercobaanSoal[]>(percobaanAwal);
  const [aktif, setAktif] = useState(0);
  // Bumped on "Ulangi". A revalidate re-renders the RSC payload but React keeps
  // the mounted instance's state, so `percobaan` (and every card's own
  // `useState`) would otherwise survive a reset and keep showing the old score.
  // Clearing state here, and folding the nonce into the card key, is what
  // actually makes the reset visible.
  const [nonce, setNonce] = useState(0);
  const [mengulang, setMengulang] = useState(false);

  const bySoal = useMemo(
    () => new Map(percobaan.map((item) => [item.soalId, item])),
    [percobaan],
  );

  const statistik: StatistikLatihan = useMemo(
    () => hitungStatistik(soal, percobaan),
    [soal, percobaan],
  );

  /** Update the local attempt list only, without a round trip. */
  function terapkanLokal(next: JawabanTersimpan) {
    setPercobaan((sebelumnya) => [
      ...sebelumnya.filter((item) => item.soalId !== next.soalId),
      {
        soalId: next.soalId,
        jawaban: next.jawaban,
        benar: next.benar,
        ...(next.penilaian ? { penilaian: next.penilaian } : {}),
        // The card narrows its own `sumber` to these four literals, but the
        // field is typed `string` there so the callback stays serialisable.
        // Re-narrowing here keeps the store's union honest at the boundary.
        sumber: next.sumber as SumberPenilaian,
        at: next.at,
      },
    ]);
  }

  async function simpan(next: JawabanTersimpan) {
    // Optimistic: the card already shows the verdict, so waiting for the write
    // to land before updating state would make every submit feel broken.
    terapkanLokal(next);

    const formData = new FormData();
    formData.set("latihanId", latihan.id);
    formData.set("soalId", next.soalId);
    formData.set("jawaban", next.jawaban);
    // Both deterministic and self-assessed verdicts are carried; free text
    // sends nothing so the action stores `null` ("unjudged"). `juri` never
    // reaches here — that verdict is written by the judge action itself.
    if (next.benar !== null && (next.sumber === "otomatis" || next.sumber === "diri")) {
      formData.set("benar", next.benar ? "true" : "false");
      formData.set("sumber", next.sumber);
    }
    await catatJawabanAction(formData);
  }

  /**
   * Clear every answer and persist the reset.
   *
   * The state is cleared *before* the round trip on purpose. `ulangiLatihanAction`
   * calls `revalidatePath`, which refreshes the server-rendered payload but not
   * the already-mounted component's state, so relying on the action alone leaves
   * the old score on screen until a manual reload. Clearing locally is also why
   * the cards are keyed by `nonce`: each `SoalKartu` holds its own `useState`
   * for the typed answer and the submitted flag, and a new key is what forces
   * them all back to their blank initial state.
   */
  async function ulangi() {
    setMengulang(true);
    setPercobaan([]);
    setAktif(0);
    setNonce((n) => n + 1);
    try {
      const formData = new FormData();
      formData.set("latihanId", latihan.id);
      await ulangiLatihanAction(formData);
    } finally {
      setMengulang(false);
    }
  }

  const soalAktif = soal[aktif];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
          <Link
            href="/belajar/latihan"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} strokeWidth={1.7} aria-hidden="true" />
            Latihan
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <form action={ulangi}>
              <input type="hidden" name="latihanId" value={latihan.id} />
              <button
                type="submit"
                disabled={mengulang}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {mengulang ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw size={13} strokeWidth={1.9} aria-hidden="true" />
                )}
                Ulangi
              </button>
            </form>
            <form action={hapusLatihanAction}>
              <input type="hidden" name="latihanId" value={latihan.id} />
              <button
                type="submit"
                aria-label="Hapus latihan ini"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 size={13} strokeWidth={1.9} aria-hidden="true" />
                Hapus
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 sm:px-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{latihan.judul}</h1>
          <span className="text-[12.5px] text-muted-foreground">
            {soal.length} soal
          </span>
        </div>

        <div
          data-latihan-skor={statistik.nilaiPersen}
          className="mt-4 rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-foreground">Skor</span>
            <span className="font-bold text-foreground">
              {statistik.nilaiPersen}
              <span className="font-normal text-muted-foreground"> / 100</span>
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Skor latihan"
            aria-valuenow={statistik.nilaiPersen}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${statistik.nilaiPersen}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">
            {statistik.benar} benar · {statistik.salah} belum tepat · {statistik.belum}{" "}
            belum dinilai
            {statistik.benar + statistik.salah < statistik.dijawab
              ? " — soal uraian menunggu penilaianmu atau juri AI."
              : ""}
          </p>
        </div>

        {soalAktif ? (
          <>
            <nav aria-label="Navigasi soal" className="mt-5 flex flex-wrap gap-1.5">
              {soal.map((item, index) => {
                const attempt = bySoal.get(item.id);
                const sudah = Boolean(attempt && attempt.jawaban.trim());
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAktif(index)}
                    aria-current={index === aktif ? "true" : undefined}
                    aria-label={`Soal ${index + 1}${sudah ? ", sudah dijawab" : ""}`}
                    className={cn(
                      "grid size-8 place-items-center rounded-lg border text-[12.5px] font-semibold transition-colors",
                      index === aktif
                        ? "border-primary bg-primary text-primary-foreground"
                        : attempt?.benar === true
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : attempt?.benar === false
                            ? "border-rose-300 bg-rose-50 text-rose-800"
                            : sudah
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-border bg-background text-muted-foreground hover:border-foreground/25",
                    )}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </nav>

            <div className="mt-4">
              <SoalKartu
                key={`${nonce}-${soalAktif.id}`}
                latihanId={latihan.id}
                soal={soalAktif}
                tersimpan={bySoal.get(soalAktif.id)}
                nomor={aktif + 1}
                total={soal.length}
                onChange={simpan}
                // The judge persists its own verdict server-side, so this only
                // mirrors it into the local list — reusing `simpan` here would
                // write a second, verdict-less attempt over the judged one.
                onJuri={terapkanLokal}
              />
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setAktif(Math.max(0, aktif - 1))}
                disabled={aktif === 0}
                className="rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-foreground/25 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="text-[12.5px] text-muted-foreground">
                {aktif + 1} dari {soal.length}
              </span>
              <button
                type="button"
                onClick={() => setAktif(Math.min(soal.length - 1, aktif + 1))}
                disabled={aktif === soal.length - 1}
                className="rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-foreground/25 disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </>
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
            Latihan ini belum punya soal.
          </p>
        )}

        <p className="mt-10 text-[12px] leading-5 text-muted-foreground">
          Disusun oleh{" "}
          {latihan.disusunOleh === "gemini" ? "Gemini" : "penyusun deterministik (mode contoh)"}
          . Penilaian pilihan ganda, benar/salah, dan isian berjalan di peramban
          dan disimpan ke filemu — jadi bukan ujian yang tahan curang.
        </p>
      </main>
    </div>
  );
}
