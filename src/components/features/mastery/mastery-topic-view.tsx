"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Clock, MessageSquare, X } from "lucide-react";
import {
  arsipkanTopikAction,
  catatPercobaanAction,
  hapusTopikAction,
  type MasteryActionState,
} from "@/actions/mastery";
import type { KnowledgeType, MasteryTopic } from "@/lib/mastery/types";
import { rentangTinjauan } from "@/lib/mastery/scoring";
import { CincinProgres } from "./cincin-progres";

const INITIAL: MasteryActionState = { status: "idle" };

const TYPE_LABEL: Record<KnowledgeType, string> = {
  memory: "Ingat",
  concept: "Paham",
  procedure: "Kerjakan",
  design: "Rancang",
};

export interface TopicPoint {
  id: string;
  name: string;
  type: KnowledgeType;
  moduleId: string;
  mastery: number;
  attempts: number;
  nextReviewAt: string | null;
}

function formatTanggal(iso: string | null): string {
  if (!iso) return "Belum dijadwalkan";
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "Belum dijadwalkan";
  const days = Math.round((at - Date.now()) / 86_400_000);
  if (days <= 0) return "Jatuh tempo";
  if (days === 1) return "Kembali besok";
  if (days < 30) return `Kembali ${days} hari lagi`;
  return `Kembali ${new Date(at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`;
}

/**
 * One knowledge point, with its own answer buttons.
 *
 * The two buttons post the learner's own self-assessment. That is honest here:
 * we are not running an exam, we are letting them mark whether they got it —
 * and an ungraded self-report would leave the review schedule frozen forever.
 */
function PointRow({
  topicId,
  point,
  due,
}: {
  topicId: string;
  point: TopicPoint;
  due: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(catatPercobaanAction, INITIAL);


  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <CincinProgres value={point.mastery} size={36} stroke={1.75} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[14px] font-semibold text-foreground">{point.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground/70">{TYPE_LABEL[point.type]}</span>
            <span aria-hidden="true">·</span>
            <span>{point.attempts} percobaan</span>
            <span aria-hidden="true">·</span>
            <span className={due ? "font-semibold text-primary" : undefined}>
              {formatTanggal(point.nextReviewAt)}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            Tinjauan: {rentangTinjauan(point.type)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          Tandai hasil belajar
        </button>

        {/* AI Mastery is a separate origin behind an iframe, so this is a plain
            link: there is no server round trip to make and no per-topic opening
            message to write — the learner arrives at the chat and opens it. */}
        <Link
          href="/ai-mastery"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          <MessageSquare size={13} strokeWidth={1.8} aria-hidden="true" />
          Belajar di AI Mastery
        </Link>
      </div>

      {open ? (
        <form action={formAction} className="mt-3 border-t border-border pt-3">
          <input type="hidden" name="topicId" value={topicId} />
          <input type="hidden" name="knowledgePointId" value={point.id} />
          <input type="hidden" name="source" value={due ? "review" : "session"} />
          <p className="text-[12.5px] text-muted-foreground">
            Apakah kamu bisa menjelaskan <strong className="font-semibold text-foreground">{point.name}</strong> tanpa melihat materi?
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="submit"
              name="correct"
              value="true"
              disabled={pending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Check size={13} strokeWidth={2.2} aria-hidden="true" />
              Bisa
            </button>
            <button
              type="submit"
              name="correct"
              value="false"
              disabled={pending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              <X size={13} strokeWidth={2.2} aria-hidden="true" />
              Belum
            </button>
          </div>
          {state.status === "success" ? (
            <p role="status" className="mt-2 text-[12px] font-medium text-success">
              {state.message}
            </p>
          ) : null}
          {state.status === "error" ? (
            <p role="status" className="mt-2 text-[12px] font-medium text-destructive">
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}

export function MasteryTopicView({
  topic,
  points,
  duePointIds,
  upcoming,
}: {
  topic: MasteryTopic;
  points: TopicPoint[];
  duePointIds: string[];
  upcoming: { knowledgePointId: string; nextReviewAt: string }[];
}) {
  const attempted = points.filter((point) => point.mastery > 0);
  const overall =
    points.length === 0 ? 0 : attempted.reduce((sum, point) => sum + point.mastery, 0) / points.length;

  const dueSet = new Set(duePointIds);
  const duePoints = points.filter((point) => dueSet.has(point.id));
  const rest = points.filter((point) => !dueSet.has(point.id));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto w-full max-w-4xl px-6 pt-6 pb-0">
        <Link
          href="/belajar/mastery"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} strokeWidth={1.7} aria-hidden="true" />
          Jalur Penguasaan
        </Link>

        <div className="mt-3 flex items-start gap-4">
          <CincinProgres value={overall} size={48} stroke={2.5} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {topic.title}
            </h1>
            {topic.description ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                {topic.description}
              </p>
            ) : null}
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              {points.length} poin
              {topic.courseSlug ? (
                <>
                  {" · "}
                  <Link
                    href={`/belajar/${topic.courseSlug}#kurikulum`}
                    className="font-semibold text-primary hover:underline"
                  >
                    Buka kursus
                  </Link>
                </>
              ) : null}
              {/* A job-sourced topic has no course to reopen, so it links back
                  to the posting it was derived from instead. */}
              {topic.jobId ? (
                <>
                  {" · "}
                  <Link
                    href={`/loker/${topic.jobId}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    Buka lowongan
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {duePoints.length > 0 ? (
          <section aria-labelledby="jatuh-tempo-heading">
            <h2
              id="jatuh-tempo-heading"
              className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-primary uppercase"
            >
              <Clock size={12} strokeWidth={2} aria-hidden="true" />
              Jatuh tempo · {duePoints.length}
            </h2>
            <ul className="mt-3 space-y-2">
              {duePoints.map((point) => (
                <PointRow key={point.id} topicId={topic.id} point={point} due />
              ))}
            </ul>
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-[13px] text-muted-foreground">
              Tidak ada yang jatuh tempo hari ini. Jadwal tinjauan berikutnya
              ada di daftar di bawah.
            </p>
          </section>
        )}

        <section className="mt-10" aria-labelledby="semua-poin-heading">
          <h2
            id="semua-poin-heading"
            className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
          >
            Semua poin
          </h2>
          <ul className="mt-3 space-y-2">
            {(duePoints.length > 0 ? rest : points).map((point) => (
              <PointRow key={point.id} topicId={topic.id} point={point} due={false} />
            ))}
          </ul>
        </section>

        {upcoming.length > 0 ? (
          <section className="mt-10" aria-labelledby="jadwal-heading">
            <h2
              id="jadwal-heading"
              className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Jadwal tinjauan
            </h2>
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
              {upcoming.map((item) => (
                <li
                  key={item.knowledgePointId}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {points.find((point) => point.id === item.knowledgePointId)?.name ??
                      item.knowledgePointId}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatTanggal(item.nextReviewAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-10 flex flex-wrap gap-2">
          <form action={arsipkanTopikAction}>
            <input type="hidden" name="topicId" value={topic.id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Arsipkan
            </button>
          </form>
          <form action={hapusTopikAction}>
            <input type="hidden" name="topicId" value={topic.id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              Hapus
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
