"use client";

import { useState } from "react";
import type { Block } from "@/lib/book/types";
import { cn } from "@/lib/utils";

/**
 * Render one content block.
 *
 * Every block is structured data and every text field is rendered as a React
 * child — there is no `dangerouslySetInnerHTML` anywhere, matching the repo
 * rule that admin/authored content must never become stored XSS. A block the
 * reader does not know is dropped rather than dumped as JSON.
 */
export function BlokRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const Tag = block.level === 2 ? "h2" : block.level === 3 ? "h3" : "h4";
      return (
        <Tag
          className={cn(
            "mt-8 font-bold tracking-tight text-foreground first:mt-0",
            block.level === 2 ? "text-2xl" : block.level === 3 ? "text-xl" : "text-lg",
          )}
        >
          {block.body}
        </Tag>
      );
    }

    case "text":
      return (
        <p className="text-[15px] leading-7 whitespace-pre-wrap text-foreground/90">
          {block.body}
        </p>
      );

    case "list":
      return block.ordered ? (
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] leading-7 text-foreground/90">
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-foreground/90">
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );

    case "callout": {
      const tone = {
        note: "border-primary/30 bg-primary/5",
        tip: "border-emerald-300 bg-emerald-50/60",
        warning: "border-amber-300 bg-amber-50/60",
      }[block.tone];
      const label = { note: "Catatan", tip: "Tips", warning: "Perhatian" }[block.tone];
      return (
        <aside className={cn("rounded-xl border px-4 py-3", tone)}>
          <p className="text-[12px] font-bold tracking-wide text-foreground uppercase">
            {block.title || label}
          </p>
          <p className="mt-1.5 text-[14px] leading-6 text-foreground/90">{block.body}</p>
        </aside>
      );
    }

    case "code":
      return (
        <figure className="overflow-hidden rounded-xl border border-border bg-muted/40">
          <figcaption className="flex items-center justify-between border-b border-border px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <span>{block.language || "code"}</span>
          </figcaption>
          <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-6">
            <code className="font-mono text-foreground/90">{block.code}</code>
          </pre>
          {block.caption ? (
            <p className="border-t border-border px-4 py-2 text-[12px] text-muted-foreground">
              {block.caption}
            </p>
          ) : null}
        </figure>
      );

    case "figure":
      return (
        <figure className="overflow-hidden rounded-xl border border-border">
          {/* Plain <img>, deliberately. These sources are compiler-supplied and
              may be `data:` URLs, which next/image refuses; and the images are
              already local/optimised by whoever produced them. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.src} alt={block.alt} className="w-full bg-muted/40" />
          {block.caption ? (
            <figcaption className="border-t border-border px-4 py-2 text-[12px] text-muted-foreground">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );

    case "quiz":
      return <QuizBlock block={block} />;

    case "flashcards":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {block.cards.map((card, index) => (
            <details
              key={index}
              className="group rounded-xl border border-border bg-card px-4 py-3 transition-colors open:bg-muted/50"
            >
              <summary className="cursor-pointer list-none text-[14px] font-semibold text-foreground marker:content-none">
                <span className="mr-1.5 text-[11px] font-bold text-muted-foreground">
                  {index + 1}.
                </span>
                {card.front}
              </summary>
              <p className="mt-2 border-t border-border pt-2 text-[14px] leading-6 text-foreground/85">
                {card.back}
              </p>
            </details>
          ))}
        </div>
      );

    case "timeline":
      return (
        <ol className="space-y-3 border-l border-border pl-4">
          {block.events.map((event, index) => (
            <li key={index} className="relative">
              <span
                aria-hidden="true"
                className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary"
              />
              <p className="text-[14px] font-semibold text-foreground">{event.label}</p>
              <p className="mt-0.5 text-[14px] leading-6 text-foreground/80">{event.body}</p>
            </li>
          ))}
        </ol>
      );

    case "deepDive":
      return (
        <section className="rounded-xl border border-border bg-muted/30 p-5">
          <h3 className="text-[15px] font-bold text-foreground">Pendalam</h3>
          <p className="mt-2 text-[15px] leading-7 text-foreground/90">{block.body}</p>
          {block.takeaways.length > 0 ? (
            <>
              <p className="mt-4 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
                Yang harus bisa kamu lakukan
              </p>
              <ul className="mt-1.5 space-y-1 pl-5 text-[14px] leading-6 text-foreground/90 list-disc">
                {block.takeaways.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      );

    case "userNote":
      return (
        <aside className="rounded-xl border border-dashed border-border px-4 py-3">
          <p className="text-[12px] font-semibold text-muted-foreground">
            Catatan {block.author || "kamu"} · {new Date(block.at).toLocaleDateString("id-ID")}
          </p>
          <p className="mt-1 text-[14px] leading-6 text-foreground/85">{block.body}</p>
        </aside>
      );

    default:
      return null;
  }
}

/**
 * A practice question.
 *
 * Graded in the browser and nothing is stored — the same deliberate trade-off
 * as the existing quiz view: the answer ships to the reader, so this is a
 * self-check, not an exam.
 */
function QuizBlock({ block }: { block: Extract<Block, { type: "quiz" }> }) {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked === block.correctIndex;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <p className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
        Latihan
      </p>
      <p className="mt-1.5 text-[15px] font-semibold text-foreground">{block.question}</p>
      <ul className="mt-3 space-y-2">
        {block.options.map((option, index) => {
          const isPicked = picked === index;
          const isAnswer = index === block.correctIndex;
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => setPicked(index)}
                disabled={picked !== null}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-[14px] leading-6 transition-colors",
                  picked === null && "border-border hover:bg-muted",
                  isPicked && isAnswer && "border-emerald-400 bg-emerald-50",
                  isPicked && !isAnswer && "border-destructive bg-destructive/5",
                  picked !== null && !isPicked && isAnswer && "border-emerald-400",
                  picked !== null && !isPicked && !isAnswer && "border-border opacity-60",
                )}
              >
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-current text-[10px] font-bold">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="text-foreground/90">{option}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {picked !== null ? (
        <p
          role="status"
          className={cn(
            "mt-3 text-[13px] leading-6 font-medium",
            correct ? "text-emerald-700" : "text-destructive",
          )}
        >
          {correct ? "Benar. " : "Belum tepat. "}
          {block.explanation}
        </p>
      ) : null}
    </section>
  );
}
