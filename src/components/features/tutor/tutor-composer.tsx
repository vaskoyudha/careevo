"use client";

/**
 * Tutor composer — Careevo's port of DeepTutor's rounded composer card.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: web/components/chat/home/ChatComposer.tsx (L705–L760)
 * Source: web/components/chat/home/ComposerInput.tsx
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: no attachment picker, no @-references, no knowledge
 * base or model selectors, no dictation. The card radius, the send-arrow
 * button and the top fade over the transcript are kept as-is.
 */

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Square } from "lucide-react";
import { kirimTutorMessageAction, mintaPetunjukTutorAction, type TutorSendState } from "@/actions/tutor";
import { MAX_TUTOR_MESSAGE_CHARS, type TutorSession } from "@/lib/tutor/types";
import { cn } from "@/lib/utils";

const INITIAL_STATE: TutorSendState = { status: "idle" };

/**
 * A notice that has to survive the first-send navigation.
 *
 * The first send creates the session and navigates to `/belajar/tutor/<id>`,
 * which unmounts this component and discards `useActionState`. On a *failed*
 * first send that erased the explanation — the fresh mount fell back to
 * "Tutor siap membantu." and told the learner everything was fine while the
 * transcript showed a question with no answer.
 *
 * The message is therefore held in a module-level store, which survives the
 * client-side route change. `useSyncExternalStore` reads it without a
 * `setState`-in-effect, and both the server and hydration snapshots are `null`,
 * so there is no hydration mismatch.
 *
 * It is keyed by session and only shown while that session is on screen: the
 * notice belongs to the conversation that just failed, and a later unrelated
 * visit must not resurrect stale failure text. It is also cleared the moment
 * the learner sends again.
 */
type Notice = { sessionId: string; message: string } | null;

let noticeStore: Notice = null;
const noticeListeners = new Set<() => void>();

function setNoticeStore(value: Notice): void {
  if (noticeStore?.sessionId === value?.sessionId && noticeStore?.message === value?.message) {
    return;
  }
  noticeStore = value;
  for (const listener of noticeListeners) listener();
}

function subscribeNotice(listener: () => void): () => void {
  noticeListeners.add(listener);
  return () => {
    noticeListeners.delete(listener);
  };
}

function getNoticeSnapshot(): Notice {
  return noticeStore;
}

function getNoticeServerSnapshot(): Notice {
  return null;
}

/**
 * Ask-hints, keyed by session, held outside React for the same reason the
 * notice is: the first send navigates, and a hint fetched for the new session
 * must be there when the new mount paints.
 *
 * The turn count is stored *with* the value, and that is the point: the hint is
 * a second model call fired after the answer is on screen, so a cache that
 * cannot tell "already asked about this turn" from "asked about an older turn"
 * re-pays the call every time the session is opened. An empty prediction is
 * cached too — no model, a timeout, and a prediction the sanitizer rejected are
 * all real answers, and remembering them is what stops a retry loop.
 *
 * The generation counter matters just as much. With a slow model a prediction
 * can outlive the current turn, and a stale one arriving after the learner has
 * already sent their next message would offer a line about a conversation that
 * has moved on. Late results are dropped by sequence, not by hoping they
 * arrive in order.
 */
type HintEntry = { value: string; turnCount: number };
const hintStore = new Map<string, HintEntry>();
const hintListeners = new Set<() => void>();
const hintSequence = new Map<string, number>();

function subscribeHint(listener: () => void): () => void {
  hintListeners.add(listener);
  return () => {
    hintListeners.delete(listener);
  };
}

function setHint(sessionId: string, entry: HintEntry): void {
  const current = hintStore.get(sessionId);
  if (current && current.value === entry.value && current.turnCount === entry.turnCount) return;
  hintStore.set(sessionId, entry);
  for (const listener of hintListeners) listener();
}

/**
 * Ask for a hint for `sessionId` and keep it only if it is still the latest.
 *
 * The sequence is per session, so a slow prediction for an old conversation
 * cannot overwrite the hint for the current one.
 */
async function muatPetunjuk(sessionId: string, turnCount: number): Promise<void> {
  const seq = (hintSequence.get(sessionId) ?? 0) + 1;
  hintSequence.set(sessionId, seq);
  const nilai = await mintaPetunjukTutorAction(sessionId);
  if (hintSequence.get(sessionId) !== seq) return;
  setHint(sessionId, { value: nilai, turnCount });
}

export function TutorComposer({ activeSession }: { activeSession: TutorSession | null }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const composing = useRef(false);
  const navigatingRef = useRef(false);
  const notice = useSyncExternalStore(
    subscribeNotice,
    getNoticeSnapshot,
    getNoticeServerSnapshot,
  );
  // Only surface a notice for the conversation it belongs to.
  const pesanGagal =
    notice && activeSession?.id === notice.sessionId ? notice.message : null;

  // The ask-hint for the conversation on screen, or "" when there is none.
  // Reading it through the same store (rather than a prop from the page) is what
  // lets a hint fetched *before* the first-send navigation still be there after.
  const hint = useSyncExternalStore(
    subscribeHint,
    () => (activeSession ? (hintStore.get(activeSession.id)?.value ?? "") : ""),
    () => "",
  );

  // Ask for the next-line prediction whenever the conversation advances. The
  // hint is deliberately not awaited before the reply renders, and an empty
  // answer is normal (no model, timeout, a prediction the sanitizer rejected),
  // so the static placeholder simply stays.
  //
  // The two primitives are hoisted out on purpose. Depending on `activeSession`
  // itself would refetch on every server re-render, because the prop is a fresh
  // object each time; the turn count is what actually signals a new turn. And
  // the already-asked check is what keeps re-opening a conversation from
  // re-buying the same prediction.
  const sessionId = activeSession?.id ?? "";
  const turnCount = activeSession?.messages.length ?? 0;
  useEffect(() => {
    if (!sessionId || turnCount === 0) return;
    if (hintStore.get(sessionId)?.turnCount === turnCount) return;
    const handle = setTimeout(() => {
      void muatPetunjuk(sessionId, turnCount);
    }, 250);
    return () => {
      clearTimeout(handle);
    };
  }, [sessionId, turnCount]);

  const showHint = hint.length > 0 && message.length === 0;

  const submit = useCallback(
    async (previous: TutorSendState, formData: FormData) => {
      const requestedId = String(formData.get("sessionId") ?? "");
      // A new send supersedes any message about the previous one.
      setNoticeStore(null);
      const next = await kirimTutorMessageAction(previous, formData);
      if (next.status === "success" || next.status === "unavailable") {
        setMessage("");
      }
      // The first send from the empty workspace creates the session, and the
      // action hands its id back rather than redirecting. Navigate here so the
      // question the learner already typed survives the transition.
      if ((next.status === "success" || next.status === "unavailable") && !navigatingRef.current) {
        if (next.sessionId !== requestedId) {
          navigatingRef.current = true;
          // Only a failure can be lost to the remount; a success is legible from
          // the reply that is now in the transcript.
          if (next.status === "unavailable") {
            setNoticeStore({ sessionId: next.sessionId, message: next.message });
          }
          router.push(`/belajar/tutor/${next.sessionId}`);
        }
      }
      return next;
    },
    [router],
  );

  const [sendState, formAction, sendPending] = useActionState(submit, INITIAL_STATE);
  const trimmed = message.trim();
  const disabled = sendPending || trimmed.length === 0;

  const status =
    sendPending
      ? "Mengirim pertanyaan..."
      : sendState.status === "idle"
        ? (pesanGagal ?? "Tutor siap membantu.")
        : sendState.message;
  const failed = sendPending
    ? false
    : sendState.status !== "idle" && sendState.status !== "success";

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Tab accepts the prediction instead of moving focus, but only while the
    // hint is on screen — once the learner has typed, the field behaves
    // normally so focus traversal is never trapped.
    if (event.key === "Tab" && showHint && !event.shiftKey) {
      event.preventDefault();
      setMessage(hint);
      return;
    }
    if (event.key !== "Enter" || event.shiftKey) return;
    // `nativeEvent.isComposing` is what makes Enter safe inside an IME — a
    // learner typing in Bahasa Indonesia is frequently mid-composition, and
    // submitting then swallows the character they were choosing.
    if (composing.current || event.nativeEvent.isComposing) return;
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div
      data-tutor-composer="true"
      className={cn(
        "relative z-20 mx-auto w-full shrink-0 px-6 pb-5",
        activeSession ? "max-w-[960px] pt-1" : "max-w-[768px]",
      )}
    >
      {activeSession ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-transparent to-background/70"
        />
      ) : null}

      <form action={formAction} className="relative">
        {/* Empty on the empty workspace: the action treats a missing id as
            "create the session now", which is what the first send should do. */}
        <input type="hidden" name="sessionId" value={activeSession?.id ?? ""} />
        <div
          className={cn(
            "relative rounded-[26px] border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.025),0_10px_28px_-10px_rgba(0,0,0,0.08)] transition-colors",
            "border-border/60 focus-within:border-primary/50",
          )}
        >
          <label htmlFor="tutor-message" className="sr-only">
            Pertanyaan untuk tutor
          </label>
          <textarea
            id="tutor-message"
            name="message"
            rows={3}
            value={message}
            maxLength={MAX_TUTOR_MESSAGE_CHARS}
            disabled={sendPending}
            required
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            placeholder={showHint ? "" : "Contoh: jelaskan closures dengan analogi sederhana."}
            className="min-h-[88px] w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[14.5px] leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          />
          {/* The prediction sits in the empty field where the learner is about
              to type, as upstream does — greyed, and Tab-able. It is
              aria-hidden because the real placeholder is cleared and the text is
              already a live copy of a prediction, not an input value. */}
          {showHint ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 px-5 pt-4 pb-2 text-[14.5px] leading-6"
            >
              <span className="text-muted-foreground">{hint}</span>
              <span className="ml-1.5 text-muted-foreground/70">— Tab untuk mengisi</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 px-3 pt-0 pb-3">
            <span className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">
                {activeSession
                  ? "Enter untuk mengirim · Shift+Enter untuk baris baru"
                  : "Tulis pertanyaan untuk memulai percakapan"}
              </span>
              <span className="shrink-0 tabular-nums">
                {message.length}/{MAX_TUTOR_MESSAGE_CHARS}
              </span>
            </span>

            <button
              type="submit"
              disabled={disabled}
              aria-label={sendPending ? "Mengirim" : "Kirim pertanyaan"}
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full transition-all",
                disabled
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90",
              )}
            >
              {sendPending ? (
                <Square size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
              ) : (
                <ArrowUp size={17} strokeWidth={2.2} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </form>

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "mt-2 min-h-5 px-1 text-[12px] font-medium",
          sendState.status === "success"
            ? "text-success"
            : sendPending
              ? "text-primary"
              : failed || pesanGagal
                ? "text-destructive"
                : "text-muted-foreground",
        )}
      >
        {status}
      </p>
    </div>
  );
}
