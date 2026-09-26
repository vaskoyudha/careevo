/**
 * Adapted from DeepTutor (HKUDS), v1.6.11.
 * Source: web/components/chat/home/ComposerInput.tsx
 * Source: web/components/chat/home/ChatComposer.tsx
 * Source: web/components/space/learning/MasteryComposer.tsx
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a053fecf6eeca51ded680de8b8fc41ef63857b11
 * Original license: Apache License 2.0
 * Modified for Careevo.
 */
"use client";

import Link from "next/link";
import { useActionState, useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { kirimStudyChatAction } from "@/actions/learning-chat";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MarkdownRingan } from "@/components/ui/markdown-ringan";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_STUDY_MESSAGE_CHARS,
  type StudyChatActionState,
  type StudyChatSnapshot,
} from "@/lib/learning/chat-types";

const INITIAL_SEND_STATE: StudyChatActionState = { status: "idle" };
const PATH_SOURCE_LABEL = {
  "active-enrollment": "jalur belajar aktif",
  recommendation: "jalur rekomendasi",
  empty: "belum ada jalur aktif",
} as const;

export interface StudyChatProps {
  initialSnapshot: StudyChatSnapshot;
  context: {
    courseId: string | null;
    courseSlug?: string;
    courseTitle?: string;
    moduleId?: string;
    moduleTitle?: string;
    completedModuleIds: string[];
    pathSource: "active-enrollment" | "recommendation" | "empty";
  };
}

export function StudyChat({ initialSnapshot, context }: StudyChatProps) {
  const [message, setMessage] = useState("");
  const composing = useRef(false);
  const transcriptTitleId = useId();
  const messageId = useId();

  const submitMessage = useCallback(async (previous: StudyChatActionState, formData: FormData) => {
    const next = await kirimStudyChatAction(previous, formData);
    if (next.status === "success" || next.status === "unavailable" || next.status === "invalid_model_output") {
      setMessage("");
    }
    return next;
  }, []);
  const [sendState, sendFormAction, sendPending] = useActionState(submitMessage, INITIAL_SEND_STATE);
  const displayedSnapshot =
    sendState.status === "success" || sendState.status === "unavailable" || sendState.status === "invalid_model_output"
      ? sendState.snapshot
      : initialSnapshot;
  const trimmedMessage = message.trim();
  const whitespaceOnly = message.length > 0 && trimmedMessage.length === 0;
  const completedCount = context.completedModuleIds.length;
  const hasCourseContext = context.courseId !== null;
  const contextSummary = hasCourseContext
    ? `Tutor memakai konteks ${PATH_SOURCE_LABEL[context.pathSource]}${context.moduleTitle ? ` dan modul ${context.moduleTitle}` : ""}.`
    : "Chat tetap tersedia tanpa kursus, tanpa konteks materi tertentu.";
  const completedLabel = completedCount === 1 ? "1 modul selesai" : `${completedCount} modul selesai`;
  const sendStatus = sendPending
    ? "Mengirim pertanyaan..."
    : sendState.status === "idle"
      ? "Tutor siap membantu."
      : sendState.status === "success"
        ? `Pesan terkirim. ${sendState.message}`
        : sendState.message;
  const sendStatusClass = sendState.status === "success"
    ? "text-success"
    : sendPending
      ? "text-primary"
      : sendState.status === "idle"
        ? "text-muted-foreground"
        : "text-destructive";

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (composing.current || event.nativeEvent.isComposing) return;
    if (sendPending || trimmedMessage.length === 0) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <section
      data-study-chat="ready"
      aria-busy={sendPending}
      className="w-full min-w-0 overflow-x-clip rounded-2xl border border-border bg-card shadow-xs"
    >
      <header className="border-b border-border px-4 py-5 sm:px-6">
        <p className="text-sm font-semibold text-primary">Tutor belajar</p>
        <h2 id={transcriptTitleId} className="mt-1 break-words text-2xl font-bold tracking-tight text-foreground">
          {context.courseTitle ?? "Belajar dengan konteks"}
        </h2>
        <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-muted-foreground">{contextSummary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span>{completedLabel}</span>
          {context.courseSlug ? (
            <Link href={`/belajar/${context.courseSlug}#kurikulum`} className="font-semibold text-primary hover:underline">
              Buka kurikulum
            </Link>
          ) : null}
        </div>
      </header>

      <section aria-labelledby={transcriptTitleId} data-study-chat-transcript="ready" className="min-w-0 px-4 py-5 sm:px-6">
        {displayedSnapshot.messages.length === 0 ? (
          <EmptyState title="Mulai dengan pertanyaan">
            Tanyakan satu konsep, mintah contoh, atau minta langkah belajar yang lebih jelas. Riwayat percakapan ini tersimpan di perambanmu.
          </EmptyState>
        ) : (
          <ol className="space-y-4">
            {displayedSnapshot.messages.map((chatMessage) => (
              <li key={chatMessage.id} className="min-w-0">
                <article className={chatMessage.role === "user"
                  ? "w-full min-w-0 rounded-xl bg-muted/70 p-4"
                  : "w-full min-w-0 border-l-2 border-primary pl-4"}>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {chatMessage.role === "user" ? "Kamu" : "Tutor"}
                  </p>
                  {chatMessage.role === "user" ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-card-foreground">
                      {chatMessage.content}
                    </p>
                  ) : (
                    <MarkdownRingan teks={chatMessage.content} className="mt-2 text-sm text-card-foreground" />
                  )}
                  {chatMessage.truncated ? (
                    <p className="mt-2 text-xs text-muted-foreground">Balasan dipotong agar riwayat tetap ringkas.</p>
                  ) : null}
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="border-t border-border px-4 py-5 sm:px-6">
        <form action={sendFormAction} className="min-w-0 space-y-3">
          <label htmlFor={messageId} className="text-sm font-semibold text-foreground">Pertanyaan untuk tutor</label>
          <Textarea
            id={messageId}
            name="message"
            rows={4}
            value={message}
            maxLength={MAX_STUDY_MESSAGE_CHARS}
            disabled={sendPending}
            required
            placeholder="Contoh: jelaskan closures dengan analogi sederhana."
            aria-invalid={whitespaceOnly}
            aria-describedby={`${messageId}-help ${messageId}-status`}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={() => { composing.current = false; }}
            className="min-h-28 resize-y bg-background"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p id={`${messageId}-help`} className={whitespaceOnly ? "text-destructive" : "text-muted-foreground"}>
              {whitespaceOnly ? "Tulis pertanyaan sebelum mengirim." : "Enter untuk mengirim. Shift+Enter untuk baris baru."}
            </p>
            <span className="text-muted-foreground">{message.length}/{MAX_STUDY_MESSAGE_CHARS} karakter</span>
          </div>
          <ProgressBar
            value={message.length}
            max={MAX_STUDY_MESSAGE_CHARS}
            tone={message.length === MAX_STUDY_MESSAGE_CHARS ? "warn" : "info"}
            label={`Panjang pesan ${message.length} dari ${MAX_STUDY_MESSAGE_CHARS} karakter`}
          />
          <p id={`${messageId}-status`} role="status" aria-live="polite" aria-atomic="true" className={`min-h-5 text-sm font-medium ${sendStatusClass}`}>
            {sendStatus}
          </p>
          <Button type="submit" size="lg" className="h-11 w-full sm:w-auto" disabled={sendPending || trimmedMessage.length === 0}>
            {sendPending ? "Mengirim" : "Kirim pertanyaan"}
          </Button>
        </form>
      </section>
    </section>
  );
}
