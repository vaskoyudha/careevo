import type { ReactNode } from "react";

export type TerminalTone = "cmd" | "dim" | "ok" | "warn" | "err";

export type TerminalLine = {
  tone: TerminalTone;
  text: string;
  prompt?: string;
  gap?: boolean;
};

export const DEFAULT_TERMINAL_LINES: TerminalLine[] = [
  { tone: "cmd", text: "careevo attest --sign badge:42" },
  { tone: "dim", text: "→ payload hash   : 9f3c…a1e7" },
  { tone: "dim", text: "→ hmac alg       : SHA-256 (public verify)" },
  { tone: "ok", text: "→ VERIFY         : OK (js ↔ python)" },
  { tone: "cmd", text: "careevo audit chain --depth 128", gap: true },
  { tone: "dim", text: "→ blocks sealed  : 128/128" },
  { tone: "dim", text: "→ merkle root    : 0x7b…c2" },
  { tone: "ok", text: "→ chain status   : INTACT" },
  { tone: "cmd", text: "careevo agents", gap: true },
  { tone: "ok", text: "[ok] Navigator   ready" },
  { tone: "ok", text: "[ok] Socrates    quorum" },
  { tone: "ok", text: "[ok] Sentinel    audit" },
  { tone: "cmd", text: "_", gap: true },
];

function TerminalLineView({ line }: { line: TerminalLine }) {
  const style = line.gap ? { marginTop: "0.75rem" } : undefined;

  if (line.tone === "cmd") {
    return (
      <div style={style}>
        <span className="prompt">{line.prompt ?? "$"}</span>{" "}
        <span className="cmd">{line.text}</span>
      </div>
    );
  }

  return (
    <div className={line.tone} style={style}>
      {line.text}
    </div>
  );
}

type TerminalProps = {
  lines?: TerminalLine[];
  title?: string;
  badge?: string;
  label?: string;
  className?: string;
  children?: ReactNode;
};

export function Terminal({
  lines,
  title = "careevo · session preview",
  badge = "PREVIEW",
  label = "Pratinjau terminal Careevo: verifikasi attestation berhasil, rantai audit utuh.",
  className,
  children,
}: TerminalProps) {
  const body =
    children != null
      ? children
      : (lines ?? DEFAULT_TERMINAL_LINES).map((line, index) => (
          <TerminalLineView key={index} line={line} />
        ));

  return (
    <div className={["terminal", className].filter(Boolean).join(" ")} role="img" aria-label={label}>
      <div className="terminal-bar">
        <span className="lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>{title}</span>
        <span>{badge}</span>
      </div>
      <div className="terminal-body">{body}</div>
    </div>
  );
}
