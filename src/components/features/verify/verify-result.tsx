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
};

function formatIssuedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

export function VerifyResult({
  status,
  payload,
  signature,
  reason,
}: VerifyResultProps) {
  const config = CONFIG[status];
  const showPayload = Boolean(payload) && status !== "invalid";

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
          <div className="verify-row">
            <dt>Skor</dt>
            <dd>{payload.score}/100</dd>
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
        <Btn href={payload ? `/p/${payload.username}` : "/loker"}>
          {payload ? "Lihat Profil" : "Buka Job Board"}
        </Btn>
        <CopyLinkButton />
      </div>
    </div>
  );
}
