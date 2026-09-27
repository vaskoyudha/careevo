"use client";

/**
 * A topic's completion, drawn as a ring.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: web/components/space/learning/ProgressRing.tsx
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: Tailwind tokens instead of CSS variables, and the arc
 * uses `--primary` only on completion (see below).
 *
 * Three things it deliberately is not:
 *
 * - **A bare integer in a circle.** "7" with no unit is an id or a step
 *   number, not a measurement. The figure carries a small `%` and the two are
 *   set at different sizes so the number stays the thing you see.
 * - **Action-coloured at every value.** An arc in the link/action blue
 *   competes with the title for the eye and quietly suggests it can be
 *   clicked. It is ink — the page's own foreground — and `--primary` is kept
 *   for the one moment it means something: the path is finished.
 * - **Heavy.** The stroke is a hairline and the unfilled track is dimmer than
 *   the border it is drawn from. A ring is a footnote to the title beside it.
 */
export function CincinProgres({
  value,
  size = 40,
  stroke = 2,
  showLabel = true,
}: {
  /** Completion in 0..1. */
  value: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
}) {
  const safe = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(safe * 100);
  const complete = safe >= 1;

  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Progres ${percent}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        {/* The unfilled track is muted, not absent: at 0% an invisible track
            leaves a lone "0%" floating in a broken-looking circle. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted-foreground/25"
        />
        {safe > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - safe)}
            className={complete ? "stroke-primary" : "stroke-foreground"}
          />
        ) : null}
      </svg>
      {showLabel ? (
        // One text node, not a stacked number + "%". At 32–40px a two-line
        // stack collides with the stroke and reads as a broken widget; inline
        // keeps "0" and "%" on one baseline where they belong.
        <span className="absolute inset-0 grid place-items-center leading-none">
          <span className="text-[10px] font-bold tabular-nums text-foreground">
            {percent}
            <span className="ml-px text-[7px] font-semibold text-muted-foreground">%</span>
          </span>
        </span>
      ) : null}
    </span>
  );
}
