import type { ReactNode } from "react";
import {
  uraikanInline,
  uraikanMarkdown,
  type BlokMarkdown,
  type SpanInline,
} from "@/lib/markdown/ringan";
import { cn } from "@/lib/utils";

/**
 * The single React component allowed to know about `uraikanMarkdown`.
 *
 * It maps the typed blocks onto JSX *children* — never an HTML string — so
 * escaping is React's job and no raw-HTML injection prop ever enters the file.
 * No hooks and no "use client": this renders identically on the server and in
 * the browser, which matters for streamed tutor answers.
 */

function Inline({ teks }: { teks: string }) {
  return <>{uraikanInline(teks).map((s, i) => renderSpan(s, i))}</>;
}

function renderSpan(span: SpanInline, kunci: number): ReactNode {
  switch (span.jenis) {
    case "teks":
      return span.teks;
    case "tebal":
      return (
        <strong key={kunci} className="font-semibold">
          {span.teks}
        </strong>
      );
    case "miring":
      return (
        <em key={kunci} className="italic">
          {span.teks}
        </em>
      );
    case "kode":
      return (
        <code
          key={kunci}
          className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono"
        >
          {span.teks}
        </code>
      );
  }
}

function renderBlok(blok: BlokMarkdown, kunci: number): ReactNode {
  switch (blok.jenis) {
    case "judul": {
      // Tag is chosen per level; classes per the repo's heading scale. Headings
      // take the `mt-5 first:mt-0` rhythm so the first one does not push off the
      // container's own top padding.
      if (blok.tingkat === 1) {
        return (
          <h1
            key={kunci}
            className="mt-5 text-lg font-semibold tracking-tight text-foreground first:mt-0"
          >
            <Inline teks={blok.teks} />
          </h1>
        );
      }
      if (blok.tingkat === 2) {
        return (
          <h2
            key={kunci}
            className="mt-5 text-base font-semibold text-foreground first:mt-0"
          >
            <Inline teks={blok.teks} />
          </h2>
        );
      }
      if (blok.tingkat === 3) {
        return (
          <h3
            key={kunci}
            className="mt-5 text-sm font-semibold text-foreground first:mt-0"
          >
            <Inline teks={blok.teks} />
          </h3>
        );
      }
      return (
        <h4
          key={kunci}
          className="mt-5 text-sm font-semibold text-foreground first:mt-0"
        >
          <Inline teks={blok.teks} />
        </h4>
      );
    }
    case "paragraf":
      return (
        <p key={kunci} className="whitespace-pre-line">
          <Inline teks={blok.teks} />
        </p>
      );
    case "daftar":
      return blok.terurut ? (
        <ol
          key={kunci}
          start={blok.awal}
          className="list-decimal space-y-1 pl-5"
        >
          {blok.item.map((item, i) => (
            <li key={i}>
              <Inline teks={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul key={kunci} className="list-disc space-y-1 pl-5">
          {blok.item.map((item, i) => (
            <li key={i}>
              <Inline teks={item} />
            </li>
          ))}
        </ul>
      );
    case "kode":
      // `bahasa` is intentionally not rendered as a class. It comes from the
      // model, and a language we do not highlight would be a lie; a future
      // highlighter can consume it without changing the parse layer.
      return (
        <pre
          key={kunci}
          className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-[13px] leading-6 font-mono"
        >
          <code>{blok.isi}</code>
        </pre>
      );
    case "kutipan":
      return (
        <blockquote
          key={kunci}
          className="border-l-2 border-border pl-4 text-muted-foreground"
        >
          <Inline teks={blok.teks} />
        </blockquote>
      );
    case "pemisah":
      return <hr key={kunci} className="my-5 h-px bg-border" />;
  }
}

export function MarkdownRingan({
  teks,
  className,
}: {
  teks: string;
  className?: string;
}) {
  const blok = uraikanMarkdown(teks);
  if (blok.length === 0) return null;
  return (
    <div
      className={cn("space-y-3 text-[14.5px] leading-7 text-foreground", className)}
    >
      {blok.map((b, i) => renderBlok(b, i))}
    </div>
  );
}
