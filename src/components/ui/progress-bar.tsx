import type { CSSProperties } from "react";
import { Progress } from "@/components/ui/progress";

type Tone = "info" | "ok" | "warn" | "danger";

const TONE_VAR: Record<Tone, string> = {
  info: "var(--primary)",
  ok: "var(--success)",
  warn: "var(--warning)",
  danger: "var(--danger)",
};

export function ProgressBar({
  value,
  max = 100,
  tone = "info",
  label,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <Progress
      value={pct}
      aria-label={label}
      className="h-2 bg-primary/15"
      style={{ "--progress-tone": TONE_VAR[tone] } as CSSProperties}
    />
  );
}

export function BarRow({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone?: Tone;
}) {
  return (
    <div className="bar-row">
      <span className="muted">{label}</span>
      <ProgressBar value={value} max={max} tone={tone} label={label} />
      <span className="bar-value">
        {value}/{max}
      </span>
    </div>
  );
}
