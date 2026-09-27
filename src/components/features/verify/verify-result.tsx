import type { CSSProperties } from "react";

import type { AttestationPayload } from "@/lib/attestation/sign";
import type { VerifyReason } from "@/lib/attestation/verify";
import { Chip } from "@/components/ui/chip";
import { Btn } from "@/components/ui/btn";
import { CopyLinkButton } from "./copy-link-button";

export type VerifyStatus = "valid" | "invalid" | "expired" | "revoked";

type StatusConfig = {
  title: string;
  chip: string;
  tone: "ok" | "danger" | "warn";
  explanation: string;
};

const CONFIG: Record<VerifyStatus, StatusConfig> = {
  valid: {
    title: "TERVERIFIKASI",
    chip: "HMAC terverifikasi",
    tone: "ok",
    explanation:
      "Signature HMAC-SHA256 cocok dengan payload attestation. Badge diterbitkan Careevo dan tidak diubah sejak terbit.",
  },
  invalid: {
    title: "TIDAK VALID",
    chip: "Perlu perhatian",
    tone: "danger",
    explanation:
      "Token tidak dikenal, rusak, atau signature tidak cocok dengan payload. Periksa kembali tautan verifikasi yang kamu terima.",
  },
  expired: {
    title: "KEDALUWARSA",
    chip: "Masa berlaku habis",
    tone: "warn",
    explanation:
      "Signature masih cocok, tetapi masa berlaku verifikasi sudah berakhir. Pemegang badge dapat menerbitkan ulang setelah validasi terbaru.",
  },
  revoked: {
    title: "DICABUT",
    chip: "Kredensial dicabut",
    tone: "danger",
    explanation:
      "Signature masih cocok, tetapi Careevo sudah mencabut kredensial ini. Pencabutan adalah keputusan penerbit: badge tidak lagi berlaku meskipun payload-nya tidak diubah sejak terbit.",
  },
};

const ICON_PATH: Record<VerifyStatus, string> = {
  valid: "M9 12l2 2 4-4M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  invalid: "M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61M2 2l20 20",
  expired:
    "M12 6v6l4 2M21 12a9 9 0 1 1-6.22-8.56",
  revoked: "M18.36 6.64A9 9 0 1 1 5.64 19.36M2 2l20 20",
};

const REASON_LABEL: Record<VerifyReason, string> = {
  malformed: "Token tidak dapat dibaca",
  signature_mismatch: "Signature tidak cocok",
};

export type VerifyResultProps = {
  status: VerifyStatus;
  payload?: AttestationPayload;
  signature?: string;
  reason?: VerifyReason;
  /**
   * Tujuan tombol "rincian". Dihilangkan kalau rinciannya memang tidak dirender
   * (mis. payload cacat atau status `invalid`), supaya tombolnya tidak pernah
   * menggulir ke tempat yang kosong.
   */
  rincianHref?: string;
};

function formatIssuedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Kartu verifikasi — jawaban, bukan buktinya.
 *
 * ## Kenapa skor muncul sebagai bar di baris ringkas
 *
 * Skor ikut di baris `verify-rows` supaya bisa dibandingkan sejajar dengan Track
 * dan Level. Batangnya paralel dengan nilai, bukan menggantikannya: panjang
 * memberi proporsi, angka di kanan tetap angka yang ditandatangani. Karena kartu
 * ini dirender di server dan tidak pernah berubah setelah dimuat, tidak ada
 * transisi di sini — yang beranimasi hanya elemen yang memang bergerak.
 *
 * ## Kenapa tombolnya di dalam kartu
 *
 * Pembaca datang dengan pertanyaan "ini asli atau tidak", lalu langsung
 * "bagusnya di mana". Tombol rincian menjawab pertanyaan kedua tanpa menggulir
 * manual mencari panelnya, dan karena targetnya `#id` di halaman yang sama, ia
 * tetap bekerja tanpa JavaScript. Tombol disembunyikan saat panelnya tidak
 * dirender, bukan dibuat tidak aktif — tautan mati lebih buruk daripada tidak ada
 * tautan.
 */
export function VerifyResult({
  status,
  payload,
  signature,
  reason,
  rincianHref,
}: VerifyResultProps) {
  const config = CONFIG[status];
  const showPayload = Boolean(payload) && status !== "invalid";
  const skor = payload?.score;

  return (
    <div className="focal-card verify-card">
      <span
        className={`verify-icon verify-icon-${config.tone}`}
        aria-hidden="true"
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={ICON_PATH[status]} />
        </svg>
      </span>

      <p className="section-label verify-eyebrow">Verifikasi Attestation</p>
      <h1 className="verify-title">{config.title}</h1>
      <p className="verify-chip">
        <Chip ok={status === "valid"}>{config.chip}</Chip>
      </p>

      {showPayload && payload ? (
        <dl className="verify-rows">
          <div className="verify-row">
            <dt>Pemegang</dt>
            <dd>@{payload.username}</dd>
          </div>
          <div className="verify-row">
            <dt>Task</dt>
            <dd>{payload.task_title}</dd>
          </div>
          <div className="verify-row">
            <dt>Track</dt>
            <dd>{payload.track}</dd>
          </div>
          <div className="verify-row">
            <dt>Level</dt>
            <dd>{payload.level}</dd>
          </div>
          <div className="verify-row verify-row-skor">
            <dt>Skor</dt>
            <dd>
              {typeof skor === "number" && Number.isFinite(skor) ? (
                <span className="verify-skor">
                  <span
                    className="verify-skor-track"
                    aria-hidden="true"
                    style={{ "--skor-w": `${Math.max(0, Math.min(100, skor))}%` } as CSSProperties}
                  >
                    <span className="verify-skor-fill" />
                  </span>
                  <span className="verify-skor-angka">{skor}/100</span>
                </span>
              ) : (
                <span className="verify-row-note">tidak terbaca</span>
              )}
            </dd>
          </div>
          <div className="verify-row">
            <dt>Tanggal terbit</dt>
            <dd>{formatIssuedAt(payload.issued_at)}</dd>
          </div>
          <div className="verify-row">
            <dt>Penerbit</dt>
            <dd>Careevo</dd>
          </div>
          {signature ? (
            <div className="verify-row">
              <dt>Signature</dt>
              <dd className="verify-sig">{signature}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <p className="verify-explain">{config.explanation}</p>
      {status === "invalid" && reason ? (
        <p className="caption verify-reason">{REASON_LABEL[reason]}</p>
      ) : null}

      <div className="hero-actions verify-actions">
        {rincianHref ? (
          <Btn href={rincianHref} className="verify-btn-rincian">
            <span>Lihat rincian penilaian</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </Btn>
        ) : null}
        <Btn variant="ghost" href={payload ? `/p/${payload.username}` : "/loker"}>
          {payload ? "Lihat Profil" : "Buka Job Board"}
        </Btn>
        <CopyLinkButton />
      </div>
    </div>
  );
}
