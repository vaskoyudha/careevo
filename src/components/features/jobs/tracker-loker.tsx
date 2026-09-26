"use client";

import { useState, useTransition } from "react";
import type { JobFixture } from "@/lib/fixtures";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ubahStatusLamaran, type StatusLamaran } from "@/actions/tracker";
import type { StatusKanonisState } from "@/lib/career-ops/states";

/**
 * TrackerLoker — the loker detail page's tracker section, driven by the
 * canonical career-ops state machine.
 *
 * Three facts the component must not violate:
 *   - The canonical states and their lifecycle order come from the engine's
 *     `templates/states.yml` (via `daftarStatusKanonis`), never a local list.
 *   - The current status is what the tracker FILE says, not a guess: the server
 *     action `ambilStatusLamaran` resolves this posting to its tracker row.
 *   - A status change goes through the server action `ubahStatusLamaran`, which
 *     delegates to the engine's `set-status.mjs` — never a local write.
 *
 * The states array is computed SERVER-SIDE (reading templates/states.yml needs
 * node:fs) and passed as a prop — the browser chunk must not import the engine
 * reader module. Only the plain label/id/aliases/description/terminal data
 * crosses the boundary.
 *
 * Nothing is ever submitted automatically: "Lamar sekarang" is an explicit
 * human action, and even that only records the tracker state (Applied) after
 * the user presses it — the real application still happens on the company's own
 * posting, via the external apply link.
 */

const PESAN_SENTINEL: Record<string, string> = {
  quarantined:
    "Loker ini dikarantina oleh Sentinel dan tidak bisa dilamar sebelum banding diverifikasi verifikator.",
  rejected:
    "Loker ini ditolak Sentinel dan tidak bisa dilamar.",
};

export function TrackerLoker({
  job,
  awal,
  states,
}: {
  job: JobFixture;
  awal: StatusLamaran;
  states: StatusKanonisState[];
}) {
  const [state, setState] = useState(awal);
  const [pending, startTransition] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);

  const baris = state.baris;
  const statusSekarang = baris ? statusKanonisLabel(states, baris.status) : null;
  const indeksSekarang = statusSekarang ? states.findIndex((s) => s.label === statusSekarang) : -1;

  function ubah(statusLabel: string) {
    if (!baris) return;
    setGalat(null);
    startTransition(async () => {
      const hasil = await ubahStatusLamaran(job.id, baris.id, statusLabel);
      if (hasil.ok) {
        setState({
          baris: { ...baris, status: hasil.status ?? statusLabel },
        });
      } else {
        setGalat(hasil.pesan);
      }
    });
  }

  // A quarantined / rejected posting has no apply flow at all. The Sentinel
  // verdict gates the tracker section the same way it gates the rest of the
  // page — a tracker write must not bypass it.
  if (job.sentinel_status !== "clean") {
    return (
      <EmptyState title="Loker dikarantina">
        {PESAN_SENTINEL[job.sentinel_status] ??
          "Loker ini tidak bisa dilamar sebelum verifikasi selesai."}
      </EmptyState>
    );
  }

  return (
    <div>
      <p className="muted">Status lamaran kamu</p>

      <ol style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 1rem" }}>
        {states.map((step, index) => {
          const tercapai = indeksSekarang >= index;
          const iniSekarang = indeksSekarang === index;
          return (
            <li
              key={step.id}
              style={{ display: "flex", gap: "0.6rem", alignItems: "center", padding: "0.3rem 0" }}
            >
              <span
                className={`status ${
                  tercapai ? (step.terminal ? "status-warn" : "status-ok") : "status-info"
                }`}
              >
                {index + 1}
              </span>
              <span className={iniSekarang ? "mono" : ""}>
                {step.label}
                {iniSekarang ? " — posisi sekarang" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      {baris ? (
        <div className="card-head" style={{ paddingLeft: 0 }}>
          <div>
            <p className="caption muted" style={{ marginTop: 0 }}>
              Tercatat di tracker sebagai{" "}
              <span className="mono">#{baris.id}</span> · {baris.company} — {baris.role}
              {baris.report && baris.report !== "—" ? (
                <>
                  {" "}
                  · laporan{" "}
                  <span className="mono">{baris.report}</span>
                </>
              ) : null}
            </p>
            <p className="card-sub">Ubah status: pilih state berikutnya (atau terminal)</p>
          </div>
        </div>
      ) : (
        <p className="alert alert-info">
          Loker ini belum tercatat di tracker. Nilai kecocokannya dulu (panel Kecocokan A–H) —
          laporan akan tercatat otomatis sebagai <span className="mono">Evaluated</span>.
        </p>
      )}

      {baris ? (
        <div className="tag-row" style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          {states.map((step) => (
            <Button
              key={step.id}
              type="button"
              variant={step.terminal ? "outline" : "secondary"}
              size="sm"
              disabled={pending || step.label === statusSekarang}
              onClick={() => ubah(step.label)}
              title={step.description}
            >
              {step.label}
            </Button>
          ))}
        </div>
      ) : null}

      {galat ? (
        <p className="alert alert-warn" role="status" style={{ marginTop: "0.75rem" }}>
          {galat}
        </p>
      ) : null}

      {job.apply_url ? (
        <div style={{ marginTop: "1rem" }}>
          <Button
            type="button"
            variant="brand"
            size="pill"
            onClick={() => window.open(job.apply_url ?? "", "_blank", "noopener,noreferrer")}
          >
            Lamar di portal resmi
          </Button>
          <p className="caption muted" style={{ marginTop: "0.5rem" }}>
            Membuka postingan asli di tab baru. Setelah mengirim lamaran, ubah status ke{" "}
            <span className="mono">Applied</span>.
          </p>
        </div>
      ) : (
        <p className="caption muted" style={{ marginTop: "1rem" }}>
          Loker ini tidak mencantumkan tautan apply. Tandai sebagai{" "}
          <span className="mono">SKIP</span> jika tidak relevan.
        </p>
      )}
    </div>
  );
}

function statusKanonisLabel(
  states: StatusKanonisState[],
  status: string,
): string | null {
  const target = status.toLowerCase();
  const match = states.find(
    (s) => s.label.toLowerCase() === target || s.aliases.some((a) => a.toLowerCase() === target),
  );
  return match?.label ?? null;
}
