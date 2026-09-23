"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { nilaiLokerAction, type EvaluasiState } from "@/actions/evaluasi";
import { DIMENSI_SKOR } from "@/lib/agents/evaluasi/prompt";
import { tafsirSkor, type HasilEvaluasi } from "@/lib/agents/evaluasi/skema";

/**
 * The A–H evaluation panel.
 *
 * Three states, and the absent one matters most: when evaluation is unavailable
 * the panel shows NO score. It never falls back to a heuristic number — a
 * plausible-looking score that was not produced by an evaluation is worse than a
 * blank, because the candidate cannot tell the difference.
 *
 * The score is 1–5 (career-ops' scale), rendered as a percentage bar for visual
 * consistency with the rest of the app, with the raw 1–5 shown as the number.
 */

const LABEL_DIMENSI: Record<string, string> = Object.fromEntries(
  DIMENSI_SKOR.map((d) => [d.key, d.label]),
);

const PESAN_GAGAL: Record<string, string> = {
  tanpa_kunci:
    "Evaluasi AI belum aktif. Setel GEMINI_API_KEY untuk mengaktifkan skor kecocokan. Selama belum aktif, loker tetap bisa dilamar — hanya skornya yang belum tersedia.",
  kuota:
    "Kuota API sedang habis. Coba lagi beberapa saat lagi. Skor sengaja tidak ditampilkan supaya tidak ada angka perkiraan yang menyesatkan.",
  hasil_tidak_valid:
    "Model mengembalikan hasil yang tidak sesuai format. Skor tidak ditampilkan.",
  gagal: "Evaluasi gagal dijalankan. Skor tidak ditampilkan.",
};

export function EvaluasiPanel({ jobId }: { jobId: string }) {
  const [state, setState] = useState<EvaluasiState | null>(null);
  const [pending, startTransition] = useTransition();

  function jalankan() {
    startTransition(async () => {
      const hasil = await nilaiLokerAction(jobId);
      setState(hasil);
    });
  }

  if (pending) {
    return (
      <div>
        <p className="muted" aria-live="polite">
          Menilai lowongan ini dengan AI… butuh 30–60 detik.
        </p>
        <div className="skeleton" style={{ height: 8, marginTop: "0.75rem" }} />
      </div>
    );
  }

  if (state && !state.ok) {
    return (
      <div>
        <p className="alert alert-warn" role="status">
          {state.pesan || PESAN_GAGAL[state.alasan ?? "gagal"]}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={jalankan} style={{ marginTop: "0.75rem" }}>
          Coba lagi
        </Button>
      </div>
    );
  }

  if (!state?.hasil) {
    return (
      <div>
        <p className="muted" style={{ marginTop: 0 }}>
          Belum dinilai. Evaluasi memakai AI (Gemini) dan menilai lowongan ini terhadap profil kamu
          memakai sistem A–H: kecocokan CV, keselarasan target, kompensasi, sinyal budaya, dan red flag.
        </p>
        <Button type="button" variant="brand" size="sm" onClick={jalankan} style={{ marginTop: "0.75rem" }}>
          Nilai kecocokan
        </Button>
      </div>
    );
  }

  return <HasilView hasil={state.hasil} onUlang={jalankan} />;
}

function HasilView({ hasil, onUlang }: { hasil: HasilEvaluasi; onUlang: () => void }) {
  const pct = (hasil.skor_global / 5) * 100;
  const tone = hasil.skor_global >= 4.5 ? "ok" : hasil.skor_global >= 3.5 ? "warn" : "danger";

  return (
    <div>
      <div className="card-head">
        <div>
          <h3 className="card-title">Skor kecocokan</h3>
          <p className="card-sub">{tafsirSkor(hasil.skor_global)}</p>
        </div>
        <span className="score-hero">
          <b>{hasil.skor_global.toFixed(1)}</b>
          <span>/5</span>
        </span>
      </div>

      <ProgressBar value={pct} max={100} tone={tone} label="Skor kecocokan" />

      <p className="caption muted" style={{ marginTop: "0.5rem" }}>
        Arketipe: {hasil.arketipe}
      </p>

      <p style={{ marginTop: "0.75rem" }}>{hasil.ringkasan}</p>

      <table className="table" style={{ marginTop: "0.75rem" }}>
        <caption className="caption muted" style={{ textAlign: "left" }}>
          Lima dimensi penilaian (skor 1–5)
        </caption>
        <tbody>
          {Object.entries(hasil.dimensi).map(([key, value]) => (
            <tr key={key}>
              <td>{LABEL_DIMENSI[key] ?? key}</td>
              <td className="mono" style={{ width: "3rem", textAlign: "right" }}>
                {value}/5
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasil.kecocokan.length > 0 ? (
        <div style={{ marginTop: "1rem" }}>
          <p className="section-label">Kecocokan syarat vs profil</p>
          <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {hasil.kecocokan.map((row, i) => (
              <li className="log-line" key={`${row.syarat}-${i}`}>
                <span>
                  <b>{row.syarat}</b>
                  {row.bobot === "tinggi" ? <span className="status status-warn"> penting</span> : null}
                  <br />
                  <span className="muted">{row.bukti || "belum ada bukti di profil"}</span>
                  {row.gap ? (
                    <>
                      <br />
                      <span className="caption muted">Gap: {row.gap}</span>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasil.personalisasi.length > 0 ? (
        <div style={{ marginTop: "1rem" }}>
          <p className="section-label">Rencana personalisasi CV</p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {hasil.personalisasi.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasil.wawancara.length > 0 ? (
        <div style={{ marginTop: "1rem" }}>
          <p className="section-label">Persiapan wawancara</p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {hasil.wawancara.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="alert alert-ok" style={{ marginTop: "1rem" }}>
        {hasil.rekomendasi}
      </p>

      <p className="caption muted" style={{ marginTop: "0.75rem" }}>
        Skor ini hasil penilaian AI terhadap profilmu, bukan jaminan. Keputusan tetap di kamu.
      </p>

      <Button type="button" variant="ghost" size="sm" onClick={onUlang} style={{ marginTop: "0.5rem" }}>
        Nilai ulang
      </Button>
    </div>
  );
}
