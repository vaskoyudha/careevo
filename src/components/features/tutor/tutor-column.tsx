"use client";

/**
 * Center chat column — Careevo's port of DeepTutor's chat workspace centre.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: web/features/chat/components/ChatWorkspace.tsx (L2289–L2510)
 * Source: web/components/chat/home/TurnNavigator.tsx
 * Source: web/hooks/useChatAutoScroll.ts
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: no streaming, no turn branching, no copy/regenerate
 * actions, and the greeting is Indonesian. The masked scrollport and the
 * 960px measure are kept verbatim — they are what makes the transcript read
 * like a book page instead of a feed.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, PanelRight, Sparkles } from "lucide-react";
import type { TutorMessage, TutorSession } from "@/lib/tutor/types";
import { pilihSapaan } from "@/lib/tutor/sapaan";
import { TutorComposer } from "./tutor-composer";
import { MarkdownRingan } from "@/components/ui/markdown-ringan";
import { cn } from "@/lib/utils";

const EMPTY_MESSAGES: TutorMessage[] = [];

/**
 * The greeting is picked from the learner's local clock, which the server
 * cannot know. `useSyncExternalStore` is the primitive for exactly this: it
 * takes a separate server snapshot, so the first paint is the stable
 * Indonesian default and the local greeting swaps in after hydration without
 * a mismatch and without the setState-in-effect that React 19 rightly warns
 * about. DeepTutor solves the same problem with an effect + state; this is the
 * version that survives `react-hooks` v6.
 *
 * The bucket boundaries and the copy live in `@/lib/tutor/sapaan`, not here:
 * this file is a `.tsx` client component, which vitest cannot import in this
 * repo's `node` environment, and a rule that cannot be tested does not stay
 * correct. See that module for the bug that motivated the move.
 */
const GREETING_SERVER = "Apa yang ingin kamu pelajari?";

function subscribeToNothing(): () => void {
  return () => undefined;
}

function getGreetingServerSnapshot(): string {
  return GREETING_SERVER;
}

/**
 * `getSnapshot` is called on every render and must be idempotent — returning a
 * fresh random string each time would re-render forever. So the pick is
 * computed once and cached for the life of the page.
 */
let cachedGreeting: string | null = null;

function getGreetingSnapshot(): string {
  if (cachedGreeting === null) {
    cachedGreeting = pilihSapaan(new Date().getHours());
  }
  return cachedGreeting;
}

function MessageRow({ message }: { message: TutorMessage }) {
  const isUser = message.role === "user";
  return (
    <li className="min-w-0">
      <article
        className={cn(
          "min-w-0",
          isUser
            ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-muted px-4 py-2.5"
            : "w-full border-l-2 border-primary pl-4",
        )}
      >
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {isUser ? "Kamu" : "Tutor"}
        </p>
        {isUser ? (
          <p className="mt-1.5 text-[14.5px] leading-7 break-words whitespace-pre-wrap text-foreground">
            {message.content}
          </p>
        ) : (
          <MarkdownRingan teks={message.content} className="mt-1.5" />
        )}
        {message.truncated ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Balasan dipotong agar riwayat tetap ringkas.
          </p>
        ) : null}
      </article>
    </li>
  );
}

export function TutorColumn({
  activeSession,
  activityOpen,
  onToggleActivity,
}: {
  activeSession: TutorSession | null;
  activityOpen: boolean;
  onToggleActivity: () => void;
}) {
  // `activeSession.messages ?? []` would hand useMemo a brand-new array every
  // render, so the memo never hits. The empty constant keeps the identity
  // stable when there is no session.
  const messages = useMemo(
    () => activeSession?.messages ?? EMPTY_MESSAGES,
    [activeSession],
  );
  const hasMessages = messages.length > 0;
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const greeting = useSyncExternalStore(
    subscribeToNothing,
    getGreetingSnapshot,
    getGreetingServerSnapshot,
  );

  // Keep the newest turn in view, but stop following the moment the learner
  // scrolls up to read earlier — otherwise a long reply yanks them away.
  const shouldFollowRef = useRef(true);
  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldFollowRef.current = distance < 80;
  }, []);

  useEffect(() => {
    if (shouldFollowRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages.length, hasMessages]);

  const turnCount = useMemo(
    () => messages.filter((message) => message.role === "user").length,
    [messages],
  );

  const title = activeSession?.title ?? "Percakapan baru";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[960px] shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-6 pt-3 pb-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link
            href="/belajar/jalur"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Kembali ke Jalur Belajar"
          >
            <ArrowLeft size={15} strokeWidth={1.7} aria-hidden="true" />
          </Link>
          <h1 className="min-w-0 truncate text-[17px] font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {turnCount > 0 ? (
            <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
              {turnCount} pertanyaan
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleActivity}
            aria-pressed={activityOpen}
            aria-label="Aktivitas sesi"
            title="Aktivitas sesi, course & module"
            className={cn(
              "grid size-8 place-items-center rounded-lg transition-colors",
              activityOpen
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <PanelRight size={15} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 w-full flex-1 flex-col">
        {!hasMessages ? (
          <div className="flex min-h-0 w-full flex-1 items-end justify-center px-6 pb-10">
            <div className="flex w-full max-w-[768px] flex-col items-center gap-3 text-center">
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"
              >
                <Sparkles size={20} strokeWidth={1.6} />
              </span>
              <h2 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.015em] text-foreground sm:text-[40px]">
                {greeting}
              </h2>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Tanya satu konsep, minta contoh, atau minta langkah belajar
                yang lebih jelas. Tutor memakai konteks jalur belajarmu.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative flex min-h-0 w-full flex-1 flex-col">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              data-tutor-scroll="true"
              className="w-full flex-1 overflow-y-auto pt-6"
              style={{
                paddingBottom: 48,
                // Content dissolves into the composer gutter instead of
                // ending on a hard edge — and the padding above keeps the
                // fade from clipping the last paragraph.
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0px, #000 32px, #000 calc(100% - 40px), transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0px, #000 32px, #000 calc(100% - 40px), transparent 100%)",
              }}
            >
              <ol className="mx-auto w-full max-w-[960px] space-y-9 px-6">
                {messages.map((message) => (
                  <MessageRow key={message.id} message={message} />
                ))}
              </ol>
              <div ref={bottomRef} className="h-px w-full shrink-0" />
            </div>
          </div>
        )}
      </div>

      <TutorComposer activeSession={activeSession} />
    </div>
  );
}
