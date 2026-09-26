"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CircleCheck,
  Fingerprint,
  GitBranch,
  LockKeyhole,
  MessageSquare,
  Radar,
  Route,
  ScanLine,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { auditLog, jobs, profile, reviewQueue, submission, tasks } from "@/lib/fixtures";
import { cn } from "@/lib/utils";
import { Reveal } from "./primitives";

interface PlatformShowcaseItem {
  id: string;
  navLabel: string;
  headlineBold: string;
  headlineMuted: string;
  renderVisual: () => ReactNode;
}

function ShowcaseFrame({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "relative w-full max-w-6xl overflow-hidden rounded-[20px] border border-[#bfd9e7] bg-[linear-gradient(135deg,#ffffff_0%,#f8fcfe_54%,#e5f3f9_100%)] text-[#0a2a3a] shadow-[0_20px_54px_rgba(10,61,98,0.12)]",
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-28 size-72 rounded-full bg-[#d9f0f8]/70 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 size-64 rounded-full bg-white/80 blur-3xl" />
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 z-10 h-px bg-white/95" />
      <div className="relative">{children}</div>
    </div>
  );
}

function ProductMark({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[11px] border border-[#bfd9e7] bg-white/85 text-[#2a7fb8] shadow-[0_1px_2px_rgba(10,61,98,0.08)]",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={1.6} />
    </span>
  );
}

function FrameTopbar({
  title,
  context,
  icon,
  trailing,
}: {
  title: string;
  context?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center gap-2.5 border-b border-[#cbe6ef] bg-white/78 px-4 text-xs backdrop-blur-md sm:px-5">
      {icon ? <ProductMark icon={icon} className="size-8 rounded-[10px]" /> : null}
      <span className="font-semibold tracking-[-0.01em] text-[#0a3d62]">{title}</span>
      {context ? (
        <>
          <span className="text-[#9bb8c5]">/</span>
          <span className="font-mono text-[10px] tracking-[0.02em] text-[#5d7a89]">{context}</span>
        </>
      ) : null}
      {trailing ? <div className="ml-auto flex items-center gap-3">{trailing}</div> : null}
    </div>
  );
}

function Initials({ value, className }: { value: string; className?: string }) {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[#bfd9e7] bg-white font-mono text-[9px] text-[#486878] shadow-[0_1px_2px_rgba(10,61,98,0.08)]",
        className,
      )}
    >
      {initials || "CR"}
    </span>
  );
}

function formatAction(action: string) {
  return action.replaceAll(".", " / ");
}

function formatRule(rule: string) {
  return rule.replaceAll("_", " ");
}

function jobStatusLabel(status: "clean" | "quarantined" | "rejected") {
  if (status === "clean") return "Aman";
  if (status === "quarantined") return "Ditahan";
  return "Ditolak";
}

/* =========================================================================
 * Showcase 1: Bukti Kriptografis
 * Product-like audit table with a quiet detail pane. Source: local fixtures.
 * ========================================================================= */
function VerifierLedgerVisual() {
  const selectedEntry =
    auditLog.find((entry) => entry.action === "attestation.issued") ?? auditLog[0];
  const selectedBadge = profile.badges[0];
  const selectedToken = String(selectedEntry.metadata?.token ?? "token-demo");
  const selectedHash = String(selectedEntry.metadata?.hash ?? `entry:${selectedEntry.id}`);

  return (
    <ShowcaseFrame label="Pratinjau ledger verifikasi">
      <FrameTopbar
        title="Audit ledger"
        context="HMAC-SHA256"
        icon={Fingerprint}
        trailing={
          <>
            <span className="hidden font-mono text-[10px] text-[#6f8793] sm:inline">
              append-only
            </span>
            <span className="font-mono text-[10px] text-[#6f8793]">fixture / {auditLog.length}</span>
          </>
        }
      />

      <div className="grid min-h-[342px] grid-cols-1 md:grid-cols-[minmax(0,1fr)_218px]">
        <div className="min-w-0 border-b border-[#cbe6ef] md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-[#cbe6ef] px-4 py-2.5 text-[11px] text-[#48606e] sm:px-5">
            <div className="flex items-center gap-3">
              <span className="text-[#0a3d62]">Semua catatan</span>
              <span className="text-[#a8c4d0]">·</span>
              <span>hash bertaut</span>
            </div>
            <span className="font-mono text-[10px]">TERBARU</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[670px] text-left text-[11px] text-[#48606e]">
              <thead className="border-b border-[#cbe6ef] text-[10px] uppercase tracking-[0.12em] text-[#8aa0ac]">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Event</th>
                  <th scope="col" className="px-3 py-3 font-medium">Aktor</th>
                  <th scope="col" className="px-3 py-3 font-medium">Record</th>
                  <th scope="col" className="px-3 py-3 font-medium">Hash / token</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dcecf3]">
                {auditLog.slice(0, 5).map((entry) => {
                  const isSelected = entry.id === selectedEntry.id;
                  const isAttestation = entry.action === "attestation.issued";
                  const isRevision = entry.action === "review.decided";
                  const recordValue = String(
                    entry.metadata?.hash ?? entry.metadata?.token ?? entry.entity_id ?? entry.id,
                  );
                  const state = isAttestation
                    ? "Valid"
                    : isRevision
                      ? "Revisi"
                      : "Tercatat";

                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        "transition-colors",
                        isSelected ? "bg-[#e5f3f9]" : "hover:bg-[#f1f7fa]",
                      )}
                    >
                      <td className="px-5 py-3">
                        <p className="font-mono text-[10px] text-[#0a3d62]">{formatAction(entry.action)}</p>
                        <p className="mt-0.5 max-w-[220px] truncate text-[10px] text-[#6f8793]">
                          {entry.summary}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-mono text-[10px]">{entry.actor_id}</td>
                      <td className="px-3 py-3 font-mono text-[10px] text-[#48606e]">{entry.entity_id ?? "—"}</td>
                      <td className="px-3 py-3 font-mono text-[10px] text-[#48606e]">{recordValue}</td>
                      <td className={cn("px-5 py-3 text-right font-medium", isAttestation ? "text-[#124e78]" : "text-[#48606e]")}>{state}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="bg-[#eef6fa] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-5 md:my-2 md:mr-2 md:rounded-[10px]">
          <div className="flex items-center justify-between border-b border-[#cbe6ef] pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#48606e]">
              Detail entry
            </span>
            <span className="font-mono text-[10px] text-[#8aa0ac]">#{selectedEntry.id}</span>
          </div>
          <p className="mt-4 text-sm font-medium leading-snug text-[#0a2a3a]">
            {selectedBadge?.task_title ?? selectedEntry.summary}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#48606e]">
            Token publik memuat payload yang ditandatangani. Verifikasi dilakukan lintas bahasa tanpa menyimpan data biometrik.
          </p>
          <div className="mt-5 flex items-center gap-3 border-t border-[#cbe6ef] pt-4">
            <ProductMark icon={ShieldCheck} className="size-10 rounded-[12px] text-[#124e78]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold text-[#48606e]">Signature check</span>
                <span className="inline-flex items-center gap-1 font-mono text-[9px] text-[#2a7fb8]">
                  <CircleCheck aria-hidden="true" className="size-3" strokeWidth={1.8} />
                  valid
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#2a7fb8]" />
                <span className="h-px flex-1 bg-[#cbe6ef]" />
                <LockKeyhole aria-hidden="true" className="size-3 text-[#48606e]" strokeWidth={1.6} />
                <span className="h-px flex-1 bg-[#cbe6ef]" />
                <span className="size-1.5 rounded-full bg-[#2a7fb8]" />
              </div>
              <p className="mt-1.5 font-mono text-[9px] text-[#8aa0ac]">payload · signer · chain</p>
            </div>
          </div>
          <dl className="mt-5 space-y-3 text-[10px]">
            <div>
              <dt className="text-[#8aa0ac]">Penerbit</dt>
              <dd className="mt-0.5 font-mono text-[#48606e]">{selectedEntry.actor_id}</dd>
            </div>
            <div>
              <dt className="text-[#8aa0ac]">Task</dt>
              <dd className="mt-0.5 text-[#48606e]">{selectedBadge?.task_title ?? selectedEntry.entity_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#8aa0ac]">Token</dt>
              <dd className="mt-0.5 break-all font-mono text-[#48606e]">{selectedToken}</dd>
            </div>
            <div>
              <dt className="text-[#8aa0ac]">Snapshot</dt>
              <dd className="mt-0.5 font-mono text-[#48606e]">{selectedHash}</dd>
            </div>
          </dl>
          <Link
            href="/audit"
            className="mt-6 inline-flex items-center rounded-[6px] border border-[#cbe6ef] bg-white/70 px-2.5 py-1.5 text-[10px] font-medium text-[#48606e] transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-[#8fd6e3] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fb8] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            Buka audit log
          </Link>
        </aside>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#cbe6ef] bg-[#f1f7fa] px-4 py-3 text-[10px] text-[#48606e] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>Perubahan satu byte memutus rantai entry berikutnya.</span>
        <span className="font-mono">canonical JSON · HMAC-SHA256</span>
      </div>
    </ShowcaseFrame>
  );
}

/* =========================================================================
 * Showcase 2: Socrates AI Sparring
 * A quiet two-pane review workspace. Source: local submission fixtures.
 * ========================================================================= */
function SocratesSparringVisual() {
  const passedTests = submission.autocheck.tests.filter((test) => test.passed).length;
  const activeQuestion = submission.socrates.questions[0];

  return (
    <ShowcaseFrame label="Pratinjau workspace Socrates">
      <FrameTopbar
        title="Socrates"
        context="review workspace"
        icon={MessageSquare}
        trailing={<span className="font-mono text-[10px] text-[#6f8793]">@budi / web-dev</span>}
      />

      <div className="grid min-h-[360px] grid-cols-1 md:grid-cols-[218px_minmax(0,1fr)]">
        <aside className="border-b border-[#cbe6ef] bg-[#fbfdfe] md:border-b-0 md:border-r md:py-2">
          <div className="flex items-center justify-between border-b border-[#cbe6ef] px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#48606e]">Antrean review</span>
            <span className="font-mono text-[10px] text-[#8aa0ac]">{reviewQueue.length}</span>
          </div>
          <div className="space-y-1 p-2">
            {reviewQueue.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "flex gap-2.5 rounded-[8px] border px-3 py-2.5 transition-colors",
                  index === 0
                    ? "border-[#cbe6ef] bg-white shadow-[0_1px_2px_rgba(10,61,98,0.05)]"
                    : "border-transparent hover:bg-[#f1f7fa]",
                )}
              >
                <Initials value={item.username} />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-[#0a3d62]">{item.task_title}</p>
                  <p className="mt-0.5 truncate text-[10px] text-[#6f8793]">@{item.username} · {item.submitted_at}</p>
                  <p className="mt-1 font-mono text-[9px] text-[#48606e]">VTS {item.vts_score} · {item.socrates_answered ? "dijawab" : "menunggu"}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-[#cbe6ef] px-4 py-3 text-[10px] text-[#8aa0ac]">
            <span className="font-mono">filter: all submissions</span>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-[#cbe6ef] bg-white/55 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Initials value="budi" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[#0a3d62]">{submission.task_title}</p>
                <p className="mt-0.5 font-mono text-[9px] text-[#8aa0ac]">submission / {submission.id} · {submission.submitted_at}</p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-[#48606e]">{submission.status}</span>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <div className="flex items-center gap-3 border-b border-[#cbe6ef] pb-4">
              <ProductMark icon={ScanLine} className="size-9 rounded-[11px]" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-[#48606e]">Diff + rubric</p>
                <p className="mt-0.5 truncate text-[10px] text-[#8aa0ac]">Pertanyaan muncul dari keputusan kode</p>
              </div>
              <span className="font-mono text-[10px] text-[#8aa0ac]">03</span>
            </div>
            <div className="rounded-[8px] border border-[#dcecf3] bg-white/65 px-3 py-2.5">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="font-semibold text-[#0a3d62]">Socrates</span>
                <span className="text-[#a8c4d0]">·</span>
                <span className="text-[#6f8793]">10:16</span>
              </div>
              <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-[#48606e]">{activeQuestion}</p>
            </div>

            <div className="rounded-[8px] border border-[#dcecf3] bg-white/65 px-3 py-2.5">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="font-semibold text-[#0a3d62]">Auto-check</span>
                <span className="text-[#a8c4d0]">·</span>
                <span className="text-[#6f8793]">10:14</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#48606e]">
                {passedTests}/{submission.autocheck.tests.length} test lulus. Dua temuan perlu dibuka di revisi berikutnya.
              </p>
            </div>

            <div className="rounded-[8px] border border-[#cbe6ef] bg-[#eef6fa] px-3 py-2.5">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="font-semibold text-[#0a3d62]">Budi</span>
                <span className="text-[#a8c4d0]">·</span>
                <span className="text-[#6f8793]">13:40</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#48606e]">
                Jawaban Socrates dikirim. Draft score {submission.socrates.draft_score}/100.
              </p>
            </div>
          </div>

          <div className="border-t border-[#cbe6ef] px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between rounded-[8px] border border-[#cbe6ef] bg-white px-3 py-2.5 text-[10px] text-[#8aa0ac] shadow-[0_1px_2px_rgba(10,61,98,0.05)]">
              <span>Tulis jawaban atau koreksi alasan…</span>
              <span className="font-mono text-[#6f8793]">send</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-[#cbe6ef] bg-[#f1f7fa] px-4 py-3 text-[10px] text-[#48606e] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>3 pertanyaan nalar dibuat dari diff dan rubric.</span>
        <span className="font-mono">deadline / {submission.socrates.deadline}</span>
      </div>
    </ShowcaseFrame>
  );
}

/* =========================================================================
 * Showcase 3: Sentinel Audit Loker
 * A two-pane policy trace. Source: derived job fixtures and audit entries.
 * ========================================================================= */
function TraceStep({
  number,
  label,
  value,
  tone = "default",
}: {
  number: string;
  label: string;
  value: string;
  tone?: "default" | "decision";
}) {
  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      <span className="relative z-10 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-[#b8dce9] bg-white font-mono text-[9px] text-[#48606e] shadow-[0_1px_2px_rgba(10,61,98,0.06)]">
        {number}
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8aa0ac]">{label}</p>
        <p className={cn("mt-1 text-[11px] leading-relaxed", tone === "decision" ? "font-medium text-[#0a3d62]" : "text-[#48606e]")}>{value}</p>
      </div>
    </div>
  );
}

function SentinelWorkflowVisual() {
  const focusJob = jobs.find((job) => job.sentinel_status === "quarantined") ?? jobs[0];
  const sentinelEntries = auditLog.filter((entry) => entry.actor_id === "sentinel");
  const signals = [...focusJob.fee_flags, ...focusJob.trust_flags];

  return (
    <ShowcaseFrame label="Pratinjau audit Sentinel">
      <FrameTopbar
        title="Sentinel"
        context="policy trace"
        icon={ScanSearch}
        trailing={<span className="font-mono text-[10px] text-[#6f8793]">fixture feed / {jobs.length}</span>}
      />

      <div className="grid min-h-[370px] grid-cols-1 md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="min-w-0 border-b border-[#cbe6ef] bg-[#fbfdfe] md:border-b-0 md:border-r md:py-2">
          <div className="flex items-center justify-between border-b border-[#cbe6ef] px-4 py-3 text-[10px] sm:px-5">
            <span className="font-semibold uppercase tracking-[0.12em] text-[#48606e]">Incoming postings</span>
            <span className="font-mono text-[#8aa0ac]">feed / newest</span>
          </div>
          <div className="space-y-1 p-2">
            {jobs.slice(0, 5).map((job) => {
              const isFocus = job.id === focusJob.id;
              return (
                <div
                  key={job.id}
                  className={cn(
                    "rounded-[8px] border px-3 py-2.5 transition-colors sm:px-4",
                    isFocus
                      ? "border-[#cbe6ef] bg-white shadow-[0_1px_2px_rgba(10,61,98,0.05)]"
                      : "border-transparent hover:bg-[#f1f7fa]",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <Initials value={job.company} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-[#0a3d62]">{job.title}</p>
                          <p className="mt-0.5 truncate text-[10px] text-[#6f8793]">{job.company} · {job.location}</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-medium text-[#48606e]">
                          {jobStatusLabel(job.sentinel_status)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 font-mono text-[9px] text-[#8aa0ac]">
                        <span>{job.source}</span>
                        <span>trust {job.trust_score}</span>
                        <span>{job.level}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#eef6fa] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-5 md:my-2 md:mr-2 md:rounded-[10px]">
          <div className="flex items-center justify-between border-b border-[#cbe6ef] pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#48606e]">Rule trace</span>
            <span className="font-mono text-[10px] text-[#8aa0ac]">{focusJob.external_id}</span>
          </div>
          <p className="mt-4 text-sm font-medium leading-snug text-[#0a3d62]">{focusJob.title}</p>
          <p className="mt-1 text-[10px] text-[#6f8793]">{focusJob.company} · {focusJob.location}</p>

          <div className="relative mt-5 h-[76px] overflow-hidden rounded-[12px] border border-[#cbe6ef] bg-[#e2eef4]">
            <div className="absolute -left-16 -top-20 size-40 rounded-full border border-[#cbe6ef]" />
            <div className="absolute -left-8 -top-12 size-28 rounded-full border border-[#cbe6ef]" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-[#cbe6ef]" />
            <Radar aria-hidden="true" className="absolute bottom-3 right-3 size-7 text-[#2a7fb8]" strokeWidth={1.3} />
            <div className="absolute bottom-3 left-3">
              <p className="text-[10px] font-semibold text-[#48606e]">Policy radar</p>
              <p className="mt-0.5 font-mono text-[9px] text-[#48606e]">fee · trust · domain</p>
            </div>
          </div>

          <div className="mt-5 rounded-[8px] border border-[#cbe6ef] bg-white/55 px-3 py-2.5">
            <div className="border-l border-[#b8dce9] pl-4">
            <TraceStep number="01" label="Input" value={focusJob.description} />
            <TraceStep
              number="02"
              label="Signals"
              value={signals.length ? signals.map(formatRule).join(" · ") : "Belum ada sinyal"}
            />
            <TraceStep
              number="03"
              label="Decision"
              value={`${jobStatusLabel(focusJob.sentinel_status)} · ${focusJob.sentinel_status}`}
              tone="decision"
            />
          </div>
          </div>

          <div className="mt-5 border-t border-[#cbe6ef] pt-3 text-[10px] leading-relaxed text-[#48606e]">
            {sentinelEntries[0]?.summary ?? "Belum ada hasil audit."}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-[#cbe6ef] bg-[#f1f7fa] px-4 py-3 text-[10px] text-[#48606e] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>Policy lokal, tanpa verdict yang ditulis manual.</span>
        <span className="font-mono">fee_flags / trust_flags / sentinel_status</span>
      </div>
    </ShowcaseFrame>
  );
}

/* =========================================================================
 * Showcase 4: Navigator Skill Gap
 * A flat learning and opportunity board. Source: local profile, task, and job fixtures.
 * ========================================================================= */
function NavigatorColumn({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between border-b border-[#cbe6ef] pb-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#48606e]">{label}</h4>
        <span className="font-mono text-[10px] text-[#8aa0ac]">{String(count).padStart(2, "0")}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function NavigatorRoadmapVisual() {
  const verified = profile.badges;
  const practice = tasks.filter((task) => task.status === "available" || task.status === "review");
  const opportunities = jobs.filter((job) => job.sentinel_status === "clean").slice(0, 3);

  return (
    <ShowcaseFrame label="Pratinjau Navigator">
      <FrameTopbar
        title="Navigator"
        context="learning path"
        icon={Route}
        trailing={<span className="font-mono text-[10px] text-[#6f8793]">@{profile.username} / {profile.score_total}</span>}
      />

      <div className="flex items-center justify-between rounded-b-[10px] border-b border-[#cbe6ef] bg-white/55 px-4 py-3 text-[10px] text-[#48606e] sm:px-5">
        <span>{profile.display_name} · {profile.track}</span>
        <span className="font-mono">jadwal {profile.scores[0].value} / karya {profile.scores[1].value} / validasi {profile.scores[2].value}</span>
      </div>

      <div className="mx-3 mt-3 flex items-center gap-3 rounded-[12px] border border-[#cbe6ef] bg-white/65 px-3 py-2.5 shadow-[0_1px_2px_rgba(10,61,98,0.04)] sm:mx-4">
        <ProductMark icon={GitBranch} className="size-9 rounded-[11px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="font-semibold text-[#48606e]">Gap map</span>
            <span className="font-mono text-[#8aa0ac]">target / 100</span>
          </div>
          <div className="relative mt-2 h-1 rounded-full bg-[#dceff7]">
            <div className="h-1 rounded-full bg-[#2a7fb8]" style={{ width: `${profile.score_total}%` }} />
            <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2a7fb8] shadow-[0_1px_2px_rgba(10,61,98,0.18)]" style={{ left: `${profile.score_total}%` }} />
          </div>
        </div>
        <span className="font-mono text-xs font-medium text-[#48606e]">{profile.score_total}</span>
      </div>

      <div className="grid grid-cols-1 divide-y divide-[#cbe6ef] md:grid-cols-3 md:divide-x md:divide-y-0">
        <NavigatorColumn label="Sudah terbukti" count={verified.length}>
          {verified.map((badge) => (
            <div key={badge.id} className="flex gap-2.5 rounded-[8px] border border-transparent bg-white/45 px-2.5 py-2.5 transition-colors hover:border-[#cbe6ef]">
              <Initials value={badge.task_title} />
              <div className="min-w-0">
                <p className="text-[11px] font-medium leading-snug text-[#0a3d62]">{badge.task_title}</p>
                <p className="mt-1 font-mono text-[9px] text-[#8aa0ac]">{badge.track} · {badge.level} · {badge.score}/100</p>
              </div>
            </div>
          ))}
        </NavigatorColumn>

        <NavigatorColumn label="Latihan berikutnya" count={practice.length}>
          {practice.map((task) => (
            <div key={task.id} className="rounded-[8px] border border-transparent bg-white/45 px-2.5 py-2.5 transition-colors hover:border-[#cbe6ef]">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-medium leading-snug text-[#0a3d62]">{task.title}</p>
                <span className="shrink-0 font-mono text-[9px] text-[#8aa0ac]">{task.estimate_min}m</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[#6f8793]">{task.brief}</p>
              <p className="mt-1.5 font-mono text-[9px] text-[#48606e]">{task.status} · {task.level}</p>
            </div>
          ))}
        </NavigatorColumn>

        <NavigatorColumn label="Peluang terarah" count={opportunities.length}>
          {opportunities.map((job) => (
            <div key={job.id} className="rounded-[8px] border border-transparent bg-white/45 px-2.5 py-2.5 transition-colors hover:border-[#cbe6ef]">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-medium leading-snug text-[#0a3d62]">{job.title}</p>
                <Initials value={job.company} />
              </div>
              <p className="mt-1 text-[10px] text-[#6f8793]">{job.company} · {job.location}</p>
              <p className="mt-1.5 font-mono text-[9px] text-[#48606e]">{job.salary_range ?? "gaji belum dicantumkan"}</p>
            </div>
          ))}
        </NavigatorColumn>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#cbe6ef] bg-[#f1f7fa] px-4 py-3 text-[10px] text-[#48606e] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>Skor saat ini {profile.score_total}/100 · {verified.length} badge · {practice.length} latihan terbuka</span>
        <Link href="/belajar" className="inline-flex items-center rounded-[6px] border border-[#cbe6ef] bg-white/70 px-2.5 py-1.5 font-medium text-[#48606e] transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-[#8fd6e3] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fb8] motion-reduce:transition-none motion-reduce:active:scale-100">
          Buka rekomendasi
        </Link>
      </div>
    </ShowcaseFrame>
  );
}

/* =========================================================================
 * Main Component Data
 * ========================================================================= */
const SHOWCASE_ITEMS: PlatformShowcaseItem[] = [
  {
    id: "bukti-kriptografis",
    navLabel: "Rekam jejak kerja",
    headlineBold: "Rekruter cuma perlu satu tautan buat ngecek.",
    headlineMuted:
      "Setiap tugas yang kamu kerjakan dicatat, termasuk revisi dan tesnya. Hasilnya ditandatangani digital dan bisa dibuka publik, jadi rekruter nggak perlu nebak ini hasil kerjamu atau hasil AI.",
    renderVisual: () => <VerifierLedgerVisual />,
  },
  {
    id: "socrates-sparring",
    navLabel: "Uji nalar",
    headlineBold: "Ditanya balik soal keputusan di kodemu sendiri.",
    headlineMuted:
      "Socrates nyusun pertanyaan nalar dari diff dan rubrik kamu — kenapa pilih pendekatan itu, dan apa konsekuensinya. Jawabannya ada batas waktunya.",
    renderVisual: () => <SocratesSparringVisual />,
  },
  {
    id: "sentinel-audit",
    navLabel: "Cek loker palsu",
    headlineBold: "Loker yang minta transfer ke rekening pribadi, nggak muncul.",
    headlineMuted:
      "Sebelum loker masuk ke halamanmu, Sentinel ngecek apakah ada biaya pendaftaran, rekening pribadi, atau domain yang baru didirikan kemarin.",
    renderVisual: () => <SentinelWorkflowVisual />,
  },
  {
    id: "navigator-skill-gap",
    navLabel: "Celah skill",
    headlineBold: "Tahu skill mana yang masih kurang sebelum apply.",
    headlineMuted:
      "Navigator bandingkan profil kamu dengan loker yang lagi kamu incar, lalu susun latihan yang perlu kamu kerjakan biar celahnya ketutup.",
    renderVisual: () => <NavigatorRoadmapVisual />,
  },
];

/* =========================================================================
 * Problem framing
 * Figures are quoted from named sources; none of them are invented.
 * BPS (Indikator Kesejahteraan Rakyat 2025) · Stanford Digital Economy Lab
 * (Canaries in the Coal Mine, 2026) · Kominfo (2024) · Robert Half (2026).
 * ========================================================================= */
interface MasalahSolusiItem {
  id: string;
  nomor: string;
  judul: string;
  masalah: string;
  sumber: string;
  solusi: string;
}

const MASALAH_SOLUSI: MasalahSolusiItem[] = [
  {
    id: "pengangguran-muda",
    nomor: "01",
    judul: "Lulus, tapi belum kepake.",
    masalah:
      "19,44% anak muda 15–24 tahun nggak kerja, nggak sekolah, nggak ikut pelatihan. BPS menyebutnya “potensi tenaga kerja yang hilang”.",
    sumber: "BPS · Indikator Kesejahteraan Rakyat 2025",
    solusi:
      "Latihan diarahkan ke posisi yang benar-benar dibuka, bukan kursus yang berhenti di sertifikat.",
  },
  {
    id: "level-masuk-kena-ai",
    nomor: "02",
    judul: "Level masuk yang paling kena AI.",
    masalah:
      "Perekrutan umur 22–25 di pekerjaan yang paling terpapar AI kini 19% di bawah trennya. Di Indonesia pasokan lulusan IT melimpah, tapi perusahaan tetap sukar dapat talenta yang bisa dibuktikan.",
    sumber: "Stanford Digital Economy Lab · payroll AS 2026 · Kominfo 2024",
    solusi:
      "Materi dan latihan disusun dari celah skill di posisi yang kamu incar, dan lokernya sudah lewat audit Sentinel.",
  },
  {
    id: "bukti-bisa-dibuat-ai",
    nomor: "03",
    judul: "Portofolio dan sertifikat bisa dibuat AI.",
    masalah:
      "65% manajer perekrutan bilang banjir lamaran hasil AI bikin skill kandidat makin sukar diverifikasi, dan 67% pimpinan HR merasa proses rekrutmennya jadi lebih lambat.",
    sumber: "Robert Half · 2.000+ manajer perekrutan, 2026",
    solusi:
      "Tiap tugas diuji, dicatat, dan ditandatangani digital. Kamu harus bisa mempertanggungjawabkan hasil kerjamu sendiri, dan rekruter bisa mengeceknya dari satu tautan.",
  },
];

export function MarketingProblemsSolutions() {
  const [activeItem, setActiveItem] = useState(0);
  const articleRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      const triggerY = window.innerHeight * 0.45;

      for (let i = articleRefs.current.length - 1; i >= 0; i -= 1) {
        const element = articleRefs.current[i];
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= triggerY) {
            setActiveItem(i);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToItem = (index: number) => {
    setActiveItem(index);
    const target = articleRefs.current[index];
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="solusi" className="relative w-full border-b border-[#cbe6ef] bg-white text-[#0a2a3a]">
      <div className="mx-auto max-w-7xl border-x border-[#cbe6ef] bg-white">
        <div className="border-b border-[#cbe6ef] px-6 py-14 sm:px-10 lg:px-14 lg:py-18">
          <Reveal>
            <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.16em] text-[#48606e]">Masalah / Solusi</p>
          </Reveal>

          <Reveal delay={60}>
            <h2 className="max-w-4xl text-3xl font-medium leading-tight tracking-[-0.035em] text-[#0a2a3a] sm:text-4xl lg:text-[44px]">
              <span className="font-semibold">Lowongan makin sempit, pelamar makin susah dibedakan. </span>
              <br className="hidden sm:inline" />
              <span className="font-normal text-[#8aa0ac]">Careevo bikin kemampuanmu bisa dibuktikan, bukan cuma diklaim.</span>
            </h2>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#48606e] sm:text-lg">
              AI bikin lamaran, sertifikat, dan portofolio bisa jadi dalam
              hitungan menit — sementara perusahaan makin hati-hati merekrut.
              Satu jalur menyambung latihan, kerja nyata, dan bukti yang bisa
              dicek siapa pun.
            </p>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 border-t border-[#cbe6ef] md:grid-cols-3">
            {MASALAH_SOLUSI.map((item, index) => (
              <Reveal
                key={item.id}
                delay={140 + index * 60}
                className="flex flex-col border-b border-[#cbe6ef] py-6 last:border-b-0 md:border-b-0 md:border-l md:py-7 md:pl-6 md:pr-6 md:first:border-l-0 md:first:pl-0 md:last:pr-0"
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="font-mono text-[10px] text-[#5d7a89]">{item.nomor}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#48606e]">Masalah</span>
                </div>

                <h3 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-[#0a3d62]">{item.judul}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#48606e]">{item.masalah}</p>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-[#5d7a89]">{item.sumber}</p>

                <div className="mt-4 border-t border-dashed border-[#cbe6ef] pt-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#124e78]">Yang Careevo kerjain</span>
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-[#0a3d62]">{item.solusi}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={340}>
            <div className="mt-10 flex max-w-3xl flex-col gap-3 border-l border-[#8fd6e3] py-1 pl-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              <p className="text-xs italic leading-relaxed text-[#48606e] sm:text-sm">
                &ldquo;In a world where AI can generate anything, having basic critical thinking skills may be the most important thing to success. You don&rsquo;t want to fall for things that are fake, and you don&rsquo;t want to get scammed.&rdquo;
                <span className="mt-1 block font-medium not-italic text-[#0a3d62]">— Dario Amodei, CEO Anthropic</span>
              </p>
              <a
                href="https://x.com/vikktorrrre/status/2102446813714293039"
                target="_blank"
                rel="noopener noreferrer"
                className="w-fit shrink-0 border-b border-[#8fd6e3] pb-0.5 text-xs font-medium text-[#124e78] transition-[color,border-color,transform] duration-200 ease-out hover:border-[#124e78] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2a7fb8] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                Lihat di X
              </a>
            </div>
          </Reveal>
        </div>

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-12">
          <nav
            aria-label="Careevo platform showcases"
            className="sticky top-16 z-20 border-b border-[#cbe6ef] bg-white lg:col-span-3 lg:h-[calc(100vh-5rem)] lg:border-b-0 lg:border-r lg:pt-16"
          >
            <div className="overflow-x-auto bg-white [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
              <ol className="flex w-max min-w-full divide-x divide-[#cbe6ef]">
                {SHOWCASE_ITEMS.map((item, index) => {
                  const isActive = activeItem === index;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => scrollToItem(index)}
                        className={cn(
                          "h-[42px] rounded-[7px] px-5 text-xs font-medium transition-[color,background-color,border-color,transform] duration-200 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fb8] motion-reduce:transition-none motion-reduce:active:scale-100",
                          isActive
                            ? "border border-[#cbe6ef] bg-white text-[#0a3d62] shadow-[0_1px_2px_rgba(10,61,98,0.05)]"
                            : "text-[#48606e] hover:bg-[#f1f7fa] hover:text-[#0a3d62]",
                        )}
                      >
                        {item.navLabel}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <ol className="hidden flex-col gap-2 pl-8 pr-4 lg:flex">
              {SHOWCASE_ITEMS.map((item, index) => {
                const isActive = activeItem === index;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToItem(index)}
                      className="group relative flex w-full cursor-pointer rounded-[7px] py-2 pl-5 pr-4 text-left text-[15px] font-medium transition-[color,background-color,transform] duration-200 ease-out hover:bg-[#f7fbfd] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fb8] xl:text-base motion-reduce:transition-none motion-reduce:active:scale-100"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-y-1.5 left-0 w-0.5 transition-opacity",
                          isActive ? "bg-[#124e78] opacity-100" : "opacity-0",
                        )}
                      />
                      <span className={cn(isActive ? "text-[#0a3d62]" : "text-[#8aa0ac] group-hover:text-[#48606e]")}>{item.navLabel}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex flex-col lg:col-span-9">
            {SHOWCASE_ITEMS.map((item, index) => (
              <article
                key={item.id}
                id={item.id}
                ref={(element) => {
                  articleRefs.current[index] = element;
                }}
                className="scroll-mt-24 border-b border-[#cbe6ef] last:border-b-0"
              >
                <div className="px-6 pb-8 pt-12 sm:px-10 lg:px-12 lg:pb-10 lg:pt-16">
                  <h3 className="max-w-3xl text-2xl font-medium leading-snug tracking-[-0.02em] sm:text-3xl">
                    <span className="font-semibold text-[#0a3d62]">{item.headlineBold}</span>{" "}
                    <span className="font-normal text-[#8aa0ac]">{item.headlineMuted}</span>
                  </h3>
                </div>

                <div className="border-t border-[#cbe6ef]" />

                <div className="flex w-full items-center justify-center overflow-hidden bg-[#e2eef4] p-3 sm:p-6 lg:p-8">
                  {item.renderVisual()}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
