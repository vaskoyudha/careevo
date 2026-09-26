"use client";

import { useActionState, useMemo, useState } from "react";
import { decideReview, type ReviewState } from "@/actions/review";
import { hitungSkorKarya, type RubricCriterion } from "@/lib/scoring/karya";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const INITIAL: ReviewState = { ok: false };

const CRITERIA: Array<{ key: RubricCriterion; label: string; bobot: string }> = [
  { key: "kelengkapan", label: "Kelengkapan", bobot: "20%" },
  { key: "kualitas", label: "Kualitas", bobot: "30%" },
  { key: "orisinalitas", label: "Orisinalitas", bobot: "20%" },
  { key: "ketepatan_brief", label: "Ketepatan brief", bobot: "20%" },
  { key: "dokumentasi", label: "Dokumentasi", bobot: "10%" },
];

/**
 * Form keputusan review. Yang menentukan credential hanya `submissionId`,
 * `decision`, `reason`, dan lima nilai rubrik: action `decideReview` membaca
 * payload attestation dari record server-side, bukan dari field di sini. Skor
 * yang ditampilkan murni kosmetik — server menghitungnya ulang dari rubrik.
 * `username` hanya dipakai untuk label tombol kirim.
 */
export function ReviewForm({
  submissionId,
  username,
}: {
  submissionId: string;
  username?: string;
}) {
  const [state, formAction, pending] = useActionState(decideReview, INITIAL);
  const [scores, setScores] = useState<Record<RubricCriterion, number>>({
    kelengkapan: 3,
    kualitas: 3,
    orisinalitas: 3,
    ketepatan_brief: 2,
    dokumentasi: 3,
  });
  const [decision, setDecision] = useState("approved");
  const [reason, setReason] = useState("");

  const skorKarya = useMemo(() => hitungSkorKarya(scores), [scores]);
  const skorTotal = useMemo(() => Math.round((skorKarya / 40) * 100), [skorKarya]);

  return (
    <form
      className="card"
      action={formAction}
      aria-label={
        username ? `Form keputusan review untuk ${username}` : "Form keputusan review"
      }
    >
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="reason" value={reason} />

      <div className="card-head">
        <div>
          <h2 className="card-title">Rubrik 5 kriteria</h2>
          <p className="card-sub">Skala 0 sampai 4. Total karya (bobot 40) dihitung otomatis.</p>
        </div>
        <span className="score-hero">
          <b>{skorKarya}</b>
          <span>/40 (karya)</span>
        </span>
      </div>
      <p className="caption muted" style={{ marginTop: "-0.5rem" }}>
        Skor keseluruhan untuk attestation: {skorTotal}/100.
      </p>

      {CRITERIA.map((criterion) => (
        <div className="rubric-row" key={criterion.key}>
          <div>
            <strong>{criterion.label}</strong>
            <p className="caption muted" style={{ margin: 0 }}>
              Bobot {criterion.bobot}
            </p>
          </div>
          <div>
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={scores[criterion.key]}
              aria-label={`Skor ${criterion.label}`}
              onChange={(event) =>
                setScores((prev) => ({ ...prev, [criterion.key]: Number(event.target.value) }))
              }
            />
            {/* Nilai rubrik ikut terkirim lewat input tersembunyi, bukan lewat
                input range: slider yang dinonaktifkan (`disabled`) tidak
                dikirim browser, sedangkan rubrik wajib ada di FormData. */}
            <input type="hidden" name={criterion.key} value={scores[criterion.key]} />
            <span className="mono">{scores[criterion.key]}/4</span>
          </div>
        </div>
      ))}

      <div className="field mt-5">
        <label htmlFor="r-reason">Alasan (wajib)</label>
        <Textarea
          id="r-reason"
          rows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Jelaskan dasar keputusan. Tidak ada silent reject."
          required
        />
      </div>

      <div
        className="editor-toolbar mt-4"
        role="group"
        aria-label="Keputusan review"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("tab-btn", decision === "approved" && "is-active")}
          onClick={() => setDecision("approved")}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("tab-btn", decision === "rejected" && "is-active")}
          onClick={() => setDecision("rejected")}
        >
          Tolak
        </Button>
      </div>

      {/* `variant="ocean"` memakai `--primary` (#0a3d62), warna utama
          dashboard, dan warna yang sama dengan `.tab-btn.is-active` di atas —
          jadi tombol utama dan segmen pilihan dalam satu form tidak lagi
          berlomba warna. `btn-primary` sengaja dibuang: kelas itu juga hijau
          (`--leaf`) dan berhadapan dengan variant, jadi siapa yang menang
          bergantung urutan stylesheet. */}
      <Button variant="ocean" size="pill" type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : `Kirim keputusan: ${decision}`}
      </Button>

      {state.error ? (
        <p className="alert alert-danger" role="alert" style={{ marginTop: "1rem" }}>
          {state.error}
        </p>
      ) : null}

      {state.ok ? (
        <div className="alert alert-ok" style={{ marginTop: "1rem" }} role="status">
          <p style={{ margin: 0 }}>{state.message}</p>
        </div>
      ) : null}
    </form>
  );
}
