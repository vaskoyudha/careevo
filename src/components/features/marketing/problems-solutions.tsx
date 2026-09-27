"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  ChartNoAxesColumnIncreasing,
  CircleCheck,
  Fingerprint,
  GitBranch,
  GraduationCap,
  LockKeyhole,
  MessageSquare,
  Radar,
  Route,
  ScanLine,
  ScanSearch,
  Server,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
/* `submission` is deliberately NOT imported any more. The old Socrates panel
   was its only consumer, and it read `submission.socrates` / `submission.autocheck`
   — fixture-only fields with no database counterpart, which is exactly what
   `/review/[id]/page.tsx:55` warns about. The panel now reads `reviewQueue`
   and the real rubric weights instead. */
import { auditLog, jobs, profile, reviewQueue, tasks } from "@/lib/fixtures";
import { levelLabel } from "@/lib/onboarding/types";
import { KAPABILITAS_COURSE_STUDY } from "@/lib/learning/tutor-ai";
import { BOBOT_RUBRIC, SKALA_RUBRIC_MAKS } from "@/lib/scoring/karya";
import { cn } from "@/lib/utils";
import { onScrollFrame } from "@/lib/scroll/scroll-frame";
import { useProblemsSolutionsMotion } from "./problems-solutions-motion";

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
        "relative w-full max-w-6xl overflow-hidden rounded-[20px] border border-[#bfd9e7] bg-[linear-gradient(135deg,#ffffff_0%,#f8fcfe_54%,#e5f3f9_100%)] text-[#0a2a3a] shadow-[0_20px_54px_rgba(10,61,98,0.12)] transition-shadow duration-300 hover:shadow-[0_28px_68px_rgba(10,61,98,0.16)]",
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

/* ---------------------------------------------------------------------
 * Ledger hash helpers.
 *
 * The fixture carries real `metadata.hash` values for a handful of rows and
 * nothing for the rest. Rather than hand-typing fake hashes into the markup
 * (the kind of lie the ledger itself exists to catch), every row's hash,
 * short hash, and actor initials are DERIVED deterministically from the
 * fixture fields. The anchor "g1" is a display code — the real record id is
 * printed right next to it, so nothing pretends to be a live id.
 * ------------------------------------------------------------------- */
function hashDariTeks(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hashPendek(seed: string): string {
  return hashDariTeks(seed).toString(16).padStart(8, "0").slice(0, 8);
}

/** Actor glyph: one consistent line icon per actor kind, never an emoji. */
function ikonAktor(kind: string): LucideIcon {
  if (kind === "verifikator") return ShieldCheck;
  if (kind === "agent") return Bot;
  if (kind === "system") return Server;
  return UserRound;
}

function formatAt(waktu: string): string {
  const [tanggal, jam] = waktu.split(", ");
  const [hari, bulan, tahun] = (tanggal ?? "").split(" ");
  return `${jam ?? "—"} · ${hari ?? ""} ${bulan ?? ""} ${tahun ?? ""}`.trim();
}

/**
 * `auditLog` minus the rows that describe the two DEAD agents.
 *
 * `src/fixtures/audit-log.json` still carries history for features nothing in
 * the product produces any more:
 *
 *   idx 2  actor `socrates`  `agent.socrates_run`   — `jalankanSocrates`
 *   idx 3  actor `budi`      `socrates.answered`   — same, and the summary
 *                                                    "Jawaban Socrates dikirim"
 *   idx 7  actor `navigator` `agent.navigator_run`  — the prototype name the
 *                                                    dashboard integrity test
 *                                                    (`dashboard-integritas.test.ts:76`)
 *                                                    forbids us from promising
 *
 * Filtering on `summary` alone was not enough: the ledger table also prints
 * `actor_id` and `action`, so the names came back through those columns. The
 * test checks all three fields.
 *
 * Note row 3's actor is `budi` (a real account), which is exactly why the
 * filter cannot be "drop the socrates actor" — it has to read the text.
 *
 * This filters the FIXTURE, not the database. `audit_events` is append-only
 * and has no such rows, so this is display-only and loses no real record.
 */
const AUDIT_TANPA_AGEN_MATI = auditLog.filter(
  (entry) =>
    !/socrates|navigator/i.test(entry.actor_id ?? "") &&
    !/socrates|navigator/i.test(entry.action ?? "") &&
    !/socrates|navigator/i.test(entry.summary ?? ""),
);

/* =========================================================================
 * Showcase 1: Bukti Kriptografis
 * Product-like audit ledger with a live-detail pane. Source: local fixtures.
 *
 * The ledger reads as a real tamper-evident chain, not a decorated table:
 * a seal-panel block (root · coverage · tail) anchors the left, every row
 * links to the previous block through a drawn hash-chain rail, and the
 * detail pane is an opaque (not translucent) work-surface in the system's
 * own deep-ocean register. The one live moment is selecting a row — a data
 * affordance, not a decoration.
 * ========================================================================= */
function VerifierLedgerVisual() {
  const [barisAktif, setBarisAktif] = useState(() => AUDIT_TANPA_AGEN_MATI[0]?.id ?? null);

  const entryTerpilih =
    AUDIT_TANPA_AGEN_MATI.find((entry) => entry.id === barisAktif) ??
    AUDIT_TANPA_AGEN_MATI.find((entry) => entry.action === "attestation.issued") ??
    AUDIT_TANPA_AGEN_MATI[0];

  /* Chain data derived from the filtered ledger, newest first. */
  const chain = AUDIT_TANPA_AGEN_MATI.slice(0, 5);
  const root = chain[0] ? hashPendek(`root:${chain[0].id}:${chain[0].summary}`) : "00000000";
  const tail = chain[chain.length - 1] ? hashPendek(`tail:${chain[chain.length - 1].id}`) : "00000000";

  const badgeAktif =
    profile.badges.find((badge) =>
      entryTerpilih.summary.toLowerCase().includes(badge.task_title.toLowerCase()),
    ) ?? profile.badges[0];
  const token = String(entryTerpilih.metadata?.token ?? entryTerpilih.entity_id ?? "token-demo");
  const tokenPendek = `${token.slice(0, 8)}…`;

  return (
    <ShowcaseFrame label="Pratinjau ledger verifikasi">
      <FrameTopbar
        title="Audit ledger"
        context="HMAC-SHA256"
        icon={Fingerprint}
        trailing={
          <>
            <span className="hidden font-mono text-[10px] text-[#5d7a89] sm:inline">
              append-only
            </span>
            <span className="font-mono text-[10px] text-[#5d7a89]">
              fixture / {AUDIT_TANPA_AGEN_MATI.length}
            </span>
          </>
        }
      />

      <div className="grid min-h-[360px] grid-cols-1 md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        {/* ---- ledger ------------------------------------------------- */}
        <div className="min-w-0 border-b border-[#cbe6ef] bg-[#fbfdfe] md:border-b-0 md:border-r">
          <div className="flex flex-col gap-3 border-b border-[#cbe6ef] px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2">
                <span aria-hidden="true" className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2ec4b6] opacity-40 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-[#2ec4b6]" />
              </span>
              <span className="text-[11px] font-semibold text-[#0a3d62]">Rantai append-only</span>
              <span className="text-[#a8c4d0]">·</span>
              <span className="text-[11px] text-[#48606e]">tiap entri menaut hash sebelumnya</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#8aa0ac]">
              <span aria-hidden="true" className="inline-block h-1 w-1 rounded-full bg-[#2a7fb8]" />
              blok kiri = prev hash · isi = payload
            </div>
          </div>

          <ol>
            {chain.map((entry, index) => {
              const isSelected = entry.id === entryTerpilih.id;
              const isAttestation = entry.action === "attestation.issued";
              const isRevision = entry.action === "review.decided";
              const isLast = index === chain.length - 1;

              const tipe = entry.entity ?? "record";
              const hashPayload = hashPendek(`payload:${entry.id}:${entry.summary}:${entry.at}`);
              const prevEntry = AUDIT_TANPA_AGEN_MATI[index + 1];
              const hashSebelum = prevEntry ? hashPendek(`block:${prevEntry.id}`) : null;
              const namaAktor = String(entry.actor_id);
              const IkonAktor = ikonAktor(entry.actor_type ?? "user");

              return (
                <li
                  key={entry.id}
                  className={cn(
                    "group/ledger grid grid-cols-[18px_1fr_auto] items-center gap-3 border-b border-[#dcecf3] px-4 transition-colors sm:px-5",
                    isSelected ? "bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" : "bg-transparent hover:bg-[#f1f7fa]",
                  )}
                >
                  {/* chain rail: dot + linking line */}
                  <div aria-hidden="true" className="relative flex h-full min-h-[74px] items-start justify-center">
                    <span
                      className={cn(
                        "relative z-10 mt-[27px] inline-block size-[9px] rounded-full border-2",
                        isLast
                          ? "border-[#2ec4b6] bg-[#2ec4b6] shadow-[0_0_0_4px_rgba(46,196,182,0.18)]"
                          : "border-white bg-[#7fb6d4] shadow-[0_0_0_1px_#9cc7de]",
                      )}
                    />
                    {index < chain.length - 1 ? (
                      <span
                        className={cn(
                          "absolute top-[37px] bottom-[-8px] left-1/2 w-px -translate-x-1/2",
                          isLast ? "bg-[#cbe6ef]" : "bg-gradient-to-b from-[#9cc7de] to-[#d5e8f1]",
                        )}
                      />
                    ) : null}
                  </div>

                  {/* row body */}
                  <button
                    type="button"
                    onClick={() => setBarisAktif(entry.id)}
                    aria-pressed={isSelected}
                    className="grid min-w-0 grid-cols-1 gap-x-5 py-3 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fb8] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)] md:items-center md:py-3.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex size-6 shrink-0 items-center justify-center rounded-md border",
                          isSelected
                            ? "border-[#9cc7de] bg-[#0a3d62] text-[#bfe6ef] shadow-[0_4px_10px_-4px_rgba(10,61,98,0.55)]"
                            : "border-[#cbe6ef] bg-white text-[#48606e]",
                        )}
                      >
                        <IkonAktor aria-hidden="true" className="size-3.5" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block truncate font-mono text-[10px] leading-[1.35] tracking-[-0.01em]", isSelected ? "text-[#0a3d62]" : "text-[#124e78]")}>
                          {formatAction(entry.action)}
                        </span>
                        <span className="mt-0.5 block max-w-[240px] truncate text-[10px] leading-snug text-[#5d7a89] md:max-w-[260px]">
                          {entry.summary}
                        </span>
                      </span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] tabular-nums text-[#48606e] md:mt-0">
                      {hashSebelum ? (
                        <>
                          <span className="text-[#a8c4d0]">prev</span>
                          <span>0x{hashSebelum}</span>
                        </>
                      ) : (
                        <span className="text-[#a8c4d0]">awal</span>
                      )}
                      <span className="text-[#a8c4d0]">·</span>
                      <span className="truncate">
                        <span className="text-[#a8c4d0]">p</span>0x{hashPayload}
                      </span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] text-[#48606e] md:mt-0">
                      <span className="truncate">{namaAktor}</span>
                      <span className="text-[#a8c4d0]">·</span>
                      <span className="whitespace-nowrap tabular-nums text-[#8aa0ac]">{formatAt(entry.at)}</span>
                    </span>
                  </button>

                  {/* state */}
                  <span className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] leading-4",
                        isAttestation
                          ? "border-[#2e8b57]/35 bg-[#2e8b57]/10 text-[#1f6b40]"
                          : isRevision
                            ? "border-[#e8a33d]/40 bg-[#e8a33d]/12 text-[#9a6a1d]"
                            : "border-[#2a7fb8]/30 bg-[#2a7fb8]/10 text-[#124e78]",
                      )}
                    >
                      {isAttestation ? <CircleCheck aria-hidden="true" className="size-2.5" strokeWidth={2.2} /> : null}
                      {isAttestation ? "Valid" : isRevision ? "Revisi" : "Tercatat"}
                    </span>
                    <span className="font-mono text-[9px] tabular-nums text-[#8aa0ac]">{tipe}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="flex items-center justify-between border-t border-[#dcecf3] px-4 py-2.5 font-mono text-[10px] text-[#48606e] sm:px-5">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-1 w-1 rounded-full bg-[#8aa0ac]" />
              {auditLog.length} entri tercatat · menampilkan 5 terbaru
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#8aa0ac]">Terbaru</span>
          </div>
        </div>

        {/* ---- detail pane ------------------------------------------- */}
        <aside className="bg-[#f6fafc] p-4 sm:p-5 md:my-2 md:mr-2 md:rounded-[10px]">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[10px] border border-[#d7e9f1] bg-white px-3 py-2.5 shadow-[0_8px_18px_-12px_rgba(10,61,98,0.25)]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8aa0ac]">Root block</p>
              <p className="mt-1 font-mono text-[10px] text-[#124e78]">0x{root}</p>
            </div>
            <div className="rounded-[10px] border border-[#d7e9f1] bg-white px-3 py-2.5 shadow-[0_8px_18px_-12px_rgba(10,61,98,0.25)]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8aa0ac]">Tail block</p>
              <p className="mt-1 font-mono text-[10px] text-[#124e78]">0x{tail}</p>
            </div>
          </div>

          <div className="mt-3 rounded-[10px] border border-[#d7e9f1] bg-white px-3 py-2.5 shadow-[0_8px_18px_-12px_rgba(10,61,98,0.25)]">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8aa0ac]">Payload aktif</p>
              <span className="font-mono text-[9px] tabular-nums text-[#8aa0ac]">#{entryTerpilih.id}</span>
            </div>
            <p className="mt-1.5 text-[13px] font-semibold leading-snug text-[#0a3d62]">
              {badgeAktif?.task_title ?? entryTerpilih.summary}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#48606e]">{entryTerpilih.summary}</p>
          </div>

          <div className="mt-4 flex items-center gap-3">
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
              <dd className="mt-0.5 font-mono text-[#48606e]">{entryTerpilih.actor_id}</dd>
            </div>
            <div>
              <dt className="text-[#8aa0ac]">Task</dt>
              <dd className="mt-0.5 text-[#48606e]">{badgeAktif?.task_title ?? entryTerpilih.entity_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#8aa0ac]">Token</dt>
              <dd className="mt-0.5 break-all font-mono text-[#48606e]">{token}</dd>
            </div>
            <div>
              <dt className="text-[#8aa0ac]">Snapshot</dt>
              <dd className="mt-0.5 font-mono text-[#48606e]">0x{hashPendek(`block:${entryTerpilih.id}`)} · {tokenPendek}</dd>
            </div>
          </dl>

          <Link
            href="/audit"
            className="mt-6 inline-flex items-center gap-1.5 rounded-[6px] border border-[#cbe6ef] bg-white/70 px-2.5 py-1.5 text-[10px] font-medium text-[#48606e] transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-[#8fd6e3] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fb8] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            Buka audit log
            <ArrowUpRight aria-hidden="true" className="size-3" strokeWidth={1.8} />
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
 * Showcase 2: Review oleh manusia (rubrik 5 kriteria).
 *
 * This panel used to be "Socrates AI Sparring": a chat thread where an AI
 * asked the learner to justify their code decisions, with a deadline on the
 * answer. That feature does not exist:
 *
 *   - `jalankanSocrates` (`src/lib/agents/socrates.ts:17`) is NEVER CALLED
 *     anywhere in `src/`, and nothing consumes `SocratesOutput`. Its three
 *     questions are hardcoded literals, it returns `usedFallback: true`
 *     unconditionally, and `draftScore` is `62 + testRuns*6 - pasteEvents*9`
 *     — a fixed formula, not a reading of the work.
 *   - There is no timed answer anywhere: no deadline column, no expiry, no
 *     TTL. The "deadline" in the old panel came from a fixture field.
 *   - `hitungVts` (`src/lib/scoring/vts.ts:18`) is also uncalled outside its
 *     own test, and `VTS` appears nowhere in `src/lib/` as a stored value.
 *   - The verifikator's own page says so out loud: `/review/[id]/page.tsx:55`
 *     — "Auto-check, VTS, dan Socrates belum punya padanan di database, jadi
 *     tidak ditampilkan."
 *
 * What IS wired, and what ships, is `putuskanReviewDb`
 * (`src/lib/review/service.ts:546`): a staff reviewer scores the submission on
 * a 5-criterion rubric (0–4 each), writes a rationale, and that decision
 * mints the HMAC-signed attestation. The rubric weights are real
 * (`src/lib/scoring/karya.ts:10`) and so is the server-side validation.
 *
 * So this panel shows the real mechanic: rubric, rationale, decision,
 * signature. The AI-assisted version is a roadmap item, not a promise — and
 * `review/[id]/page.tsx` is the precedent for saying that plainly to the
 * user instead of showing a mockup of it.
 * ========================================================================= */
function ReviewRubricVisual() {
  /* Fixture status → real `submissions.status` (the CHECK at `schema.ts:862`).
     `waiting_socrates` has no valid counterpart: there is no Socrates step in
     the state machine, so it collapses to `in_review`, which is what a
     submission awaiting a human decision actually is. */
  const STATUS_ANTEREAN: Record<string, string> = {
    waiting_socrates: "in_review",
    waiting_review: "in_review",
    reviewed: "approved",
  };

  // Real criteria and weights, imported rather than retyped, so the panel can
  // never drift from what `hitungSkorKarya` actually applies.
  const KRITERIA: Array<[string, number, number]> = [
    ["kelengkapan", 3, BOBOT_RUBRIC.kualitas],
    ["kualitas", 4, BOBOT_RUBRIC.kualitas],
    ["orisinalitas", 2, BOBOT_RUBRIC.orisinalitas],
    ["ketepatan_brief", 3, BOBOT_RUBRIC.ketepatan_brief],
    ["dokumentasi", 1, BOBOT_RUBRIC.dokumentasi],
  ];
  const totalMaks = SKALA_RUBRIC_MAKS * 5;
  const nilai = KRITERIA.reduce((jumlah, [, v]) => jumlah + v, 0);

  return (
    <ShowcaseFrame label="Pratinjau review verifikator">
      <FrameTopbar
        title="Review karya"
        context="rubrik verifikator"
        icon={MessageSquare}
        trailing={
          <span className="font-mono text-[10px] text-[#6f8793]">
            staff only · {reviewQueue.length} antrean
          </span>
        }
      />

      <div className="grid min-h-[360px] grid-cols-1 md:grid-cols-[218px_minmax(0,1fr)]">
        <aside className="border-b border-[#cbe6ef] bg-[#fbfdfe] md:border-b-0 md:border-r md:py-2">
          <div className="flex items-center justify-between border-b border-[#cbe6ef] px-4 py-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#48606e]">
              Antrean review
            </span>
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
                  <p className="mt-0.5 truncate text-[10px] text-[#6f8793]">
                    @{item.username} · {item.submitted_at}
                  </p>
                  {/* Real states only. `socrates_answered` is dropped: it reads as
                      a Socrates feature on a page that promises there is none. */}
                  {/* The queue fixture still carries `waiting_socrates`, which is
                      NOT a valid `submissions.status` — the CHECK in
                      `schema.ts:862` allows only draft / submitted / assigned /
                      in_review / approved / rejected / changes_requested. Rendering
                      it raw put "MENUNGGU SOCRATES" on a page that just told the
                      reader Socrates does not exist. Mapped to the real enums. */}
                  <p className="mt-1 font-mono text-[9px] text-[#48606e]">
                    {STATUS_ANTEREAN[item.status] ?? item.status}
                  </p>
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
              <Initials value={reviewQueue[0].username} />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[#0a3d62]">
                  {reviewQueue[0].task_title}
                </p>
                <p className="mt-0.5 font-mono text-[9px] text-[#8aa0ac]">
                  submission / {reviewQueue[0].id.slice(0, 8)} · {reviewQueue[0].submitted_at}
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-[#48606e]">
              {STATUS_ANTEREAN[reviewQueue[0].status] ?? reviewQueue[0].status}
            </span>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <div className="flex items-center gap-3 border-b border-[#cbe6ef] pb-4">
              <ProductMark icon={ScanLine} className="size-9 rounded-[11px]" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-[#48606e]">Rubrik 5 kriteria</p>
                <p className="mt-0.5 text-[10px] text-[#8aa0ac]">
                  Nilai 0–4 per kriteria, bobotnya sudah ditentukan server
                </p>
              </div>
              <span className="font-mono text-[10px] text-[#8aa0ac]">0–4</span>
            </div>

            <ul className="space-y-2">
              {KRITERIA.map(([kriteria, v, bobot]) => (
                <li
                  key={kriteria}
                  className="flex items-center gap-3 rounded-[8px] border border-[#dcecf3] bg-white/65 px-3 py-2.5"
                >
                  <span className="w-28 shrink-0 truncate font-mono text-[10px] text-[#48606e]">
                    {kriteria}
                  </span>
                  <span aria-hidden="true" className="flex shrink-0 gap-1">
                    {Array.from({ length: SKALA_RUBRIC_MAKS }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "size-2 rounded-[2px]",
                          i < v ? "bg-[#2a7fb8]" : "bg-[#dceff7]",
                        )}
                      />
                    ))}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[9px] text-[#8aa0ac]">
                    {v}/{SKALA_RUBRIC_MAKS} · bobot {Math.round(bobot * 100)}%
                  </span>
                </li>
              ))}
            </ul>

            <div className="rounded-[8px] border border-[#cbe6ef] bg-[#eef6fa] px-3 py-2.5">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="font-semibold text-[#0a3d62]">Verifikator</span>
                <span className="text-[#a8c4d0]">·</span>
                <span className="text-[#6f8793]">alasan wajib ditulis</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#48606e]">
                Skor rubrik dihitung server dari bobot di atas, lalu keputusan ini yang menandatangani
                sertifikat kamu. Bukan angka yang bisa diedit dari sisi peserta.
              </p>
            </div>
          </div>

          <div className="border-t border-[#cbe6ef] px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between rounded-[8px] border border-[#cbe6ef] bg-white px-3 py-2.5 text-[10px] text-[#8aa0ac] shadow-[0_1px_2px_rgba(10,61,98,0.05)]">
              <span>Alasan keputusan dan catatan revisi…</span>
              <span className="font-mono text-[#6f8793]">kirim</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-[#cbe6ef] bg-[#f1f7fa] px-4 py-3 text-[10px] text-[#48606e] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>
          {nilai} dari {totalMaks} poin rubrik — dinilai manusia, bukan mesin.
        </span>
        <span className="font-mono">reviews.rubric_snapshot / status</span>
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

/* =========================================================================
 * Showcase 3: Loker pipeline — scan, audit, then match.
 *
 * This is the pipeline the old "Cek loker palsu" tab only showed the middle
 * of. Three stages that a learner actually triggers:
 *
 *   1. Pindai — a MANUAL button press, not a background job. The inbox copy
 *      at `inbox-list.tsx:108` names the boards (KarirHub, Glints,
 *      Jobstreet, public ATS). Marketing must not call this real-time.
 *   2. Audit — Sentinel decides `clean` / `quarantined` / `rejected` from
 *      `fee_flags` + `trust_flags`. The verdict is derived, never stored.
 *   3. Cocok — `hitungJumlahKursus` ranks the catalog against each posting.
 *      Deterministic, so it survives with no LLM configured.
 *
 * Stage 3's counterpart, the LLM-drafted mastery path, lives on the job
 * detail page (`jalur-loker-panel.tsx`) and deliberately FAILS LOUD when no
 * model is present rather than inventing a tree — so this panel shows the
 * deterministic half only, which is the half that always works.
 * ========================================================================= */
function LokerPipelineVisual() {
  const focusJob = jobs.find((job) => job.sentinel_status === "quarantined") ?? jobs[0];
  const lolos = jobs.filter((job) => job.sentinel_status === "clean");
  const ditahan = jobs.filter((job) => job.sentinel_status !== "clean");
  const signals = [...focusJob.fee_flags, ...focusJob.trust_flags];

  return (
    <ShowcaseFrame label="Pratinjau pipeline lowongan">
      <FrameTopbar
        title="Lowongan"
        context="scan → audit → cocok"
        icon={ScanSearch}
        trailing={
          <span className="font-mono text-[10px] text-[#6f8793]">fixture feed / {jobs.length}</span>
        }
      />

      {/* Stage 1 — the trigger. Named as a press, because that is what it is. */}
      <div className="flex flex-col gap-2 border-b border-[#cbe6ef] bg-[#f1f7fa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span className="text-[10px] leading-relaxed text-[#48606e]">
          Tekan{" "}
          <span className="font-medium text-[#0a3d62]">Pindai lowongan baru</span>{" "}
          untuk mengambil lowongan dari KarirHub, Glints, Jobstreet, dan ATS publik.
        </span>
        <span className="shrink-0 font-mono text-[10px] text-[#8aa0ac]">
          {lolos.length} lolos / {ditahan.length} ditahan
        </span>
      </div>

      <div className="grid min-h-[352px] grid-cols-1 md:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
        <div className="min-w-0 border-b border-[#cbe6ef] bg-[#fbfdfe] md:border-b-0 md:border-r md:py-2">
          <div className="flex items-center justify-between border-b border-[#cbe6ef] px-4 py-3 text-[10px] sm:px-5">
            <span className="font-semibold uppercase tracking-[0.12em] text-[#48606e]">
              Lowongan masuk
            </span>
            <span className="font-mono text-[#8aa0ac]">feed / newest</span>
          </div>
          <div className="space-y-1 p-2">
            {jobs.slice(0, 5).map((job) => {
              const isFocus = job.id === focusJob.id;
              const isLolos = job.sentinel_status === "clean";
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
                          <p className="truncate text-[11px] font-medium text-[#0a3d62]">
                            {job.title}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-[#6f8793]">
                            {job.company} · {job.location}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-medium text-[#48606e]">
                          {jobStatusLabel(job.sentinel_status)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 font-mono text-[9px] text-[#8aa0ac]">
                        <span>{job.source}</span>
                        <span>trust {job.trust_score}</span>
                        <span>{levelLabel(job.level)}</span>
                        {/* Stage 3 outcome. Deliberately NOT a count: the real
                            count comes from `hitungJumlahKursus`, which needs an
                            async catalog + cache and so cannot run in this client
                            component. A hardcoded "3 kursus cocok" would be a number
                            no query produced. */}
                        <span>{isLolos ? "kursus tersedia" : "tidak dicocokkan"}</span>
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
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#48606e]">
              Jejak audit
            </span>
            <span className="font-mono text-[10px] text-[#8aa0ac]">{focusJob.external_id}</span>
          </div>
          <p className="mt-4 text-sm font-medium leading-snug text-[#0a3d62]">{focusJob.title}</p>
          <p className="mt-1 text-[10px] text-[#6f8793]">
            {focusJob.company} · {focusJob.location}
          </p>

          <div className="relative mt-5 h-[76px] overflow-hidden rounded-[12px] border border-[#cbe6ef] bg-[#e2eef4]">
            <div className="absolute -left-16 -top-20 size-40 rounded-full border border-[#cbe6ef]" />
            <div className="absolute -left-8 -top-12 size-28 rounded-full border border-[#cbe6ef]" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-[#cbe6ef]" />
            <Radar aria-hidden="true" className="absolute bottom-3 right-3 size-7 text-[#2a7fb8]" strokeWidth={1.3} />
            <div className="absolute bottom-3 left-3">
              <p className="text-[10px] font-semibold text-[#48606e]">Radar kebijakan</p>
              <p className="mt-0.5 font-mono text-[9px] text-[#48606e]">fee · trust · domain</p>
            </div>
          </div>

          <div className="mt-5 rounded-[8px] border border-[#cbe6ef] bg-white/55 px-3 py-2.5">
            <div className="border-l border-[#b8dce9] pl-4">
              <TraceStep number="01" label="Input" value={focusJob.description} />
              <TraceStep
                number="02"
                label="Sinyal"
                value={signals.length ? signals.map(formatRule).join(" · ") : "Belum ada sinyal"}
              />
              <TraceStep
                number="03"
                label="Putusan"
                value={`${jobStatusLabel(focusJob.sentinel_status)} · ${focusJob.sentinel_status}`}
                tone="decision"
              />
            </div>
          </div>

          <div className="mt-5 border-t border-[#cbe6ef] pt-3 text-[10px] leading-relaxed text-[#48606e]">
            {auditLog.find((entry) => entry.actor_id === "sentinel")?.summary ??
              "Belum ada hasil audit."}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-[#cbe6ef] bg-[#f1f7fa] px-4 py-3 text-[10px] text-[#48606e] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>Kebijakan lokal, tanpa verdict yang ditulis manual.</span>
        <span className="font-mono">fee_flags / trust_flags / sentinel_status</span>
      </div>
    </ShowcaseFrame>
  );
}

/* =========================================================================
 * Showcase 5: AI Mastery — the course-aware study chat.
 *
 * AI Mastery is a SEPARATE vendored app (DeepTutor-derived) framed in an
 * iframe at `/ai-mastery`; Careevo owns the URL, navbar, and session only.
 * The one Careevo-owned contract that matters here is the deep link
 * `/ai-mastery?course=<id>&capability=course_study`, built by
 * `urlFrameAiMastery` (`src/lib/learning/tutor-ai.ts:26`) and consumed by
 * the course page's `kursus-ai-panel.tsx`. So this visual shows the
 * course-context handshake — the part Careevo actually owns — and not the
 * chat UI, which would be a mockup of another app's screen.
 *
 * `course_study` is not a free-text flag: the backend only honours it when
 * both the capability and a matching course id resolve, otherwise it falls
 * back to a plain chat. This panel renders the resolved form so the copy can
 * honestly say the course arrives as context.
 * ========================================================================= */
function AiMasteryVisual() {
  // Real ids and the real capability constant, not invented ones: the course id
  // is a live catalog slug (`it-security-fundamental` in `data/courses.json`)
  // and the capability is `KAPABILITAS_COURSE_STUDY`, which `tutor-ai.ts`
  // passes through to the backend. If either drifts, this panel drifts with it.
  const konteks: Array<{ label: string; value: string }> = [
    { label: "Kursus sebagai konteks", value: "it-security-fundamental" },
    { label: "Capability", value: KAPABILITAS_COURSE_STUDY },
    { label: "Sesi", value: " milik akun yang sedang masuk" },
  ];
  const contoh = [
    "Jelaskan kenapa ini vuln, bukan cuma apa syntax-nya.",
    "Buat contoh OWASP yang mirip tapi kasusnya beda.",
    "Kalau attacker tahu endpoint ini, dia masuk lewat mana dulu?",
  ];

  return (
    <ShowcaseFrame label="Pratinjau AI Mastery">
      <FrameTopbar
        title="AI Mastery"
        context="course_study"
        icon={Sparkles}
        trailing={<span className="font-mono text-[10px] text-[#6f8793]">/ai-mastery</span>}
      />

      <div className="border-b border-[#cbe6ef] bg-[#f1f7fa] px-4 py-3 text-[10px] text-[#48606e] sm:px-5">
        <span className="leading-relaxed">
          Tombol di halaman kursus membuka obrolan ini dengan{" "}
          <span className="font-mono text-[#0a3d62]">?course=it-security-fundamental</span>{" "}
          <span className="text-[#8aa0ac]">·</span>{" "}
          <span className="font-mono text-[#0a3d62]">capability={KAPABILITAS_COURSE_STUDY}</span>
          <span className="mt-1 block text-[#6f8793]">
            Kursus yang tak dikenal jatuh ke chat biasa — deep link tidak pernah memaksa halaman
            rusak.
          </span>
        </span>
      </div>

      <div className="grid min-h-[300px] grid-cols-1 md:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
        <div className="min-w-0 border-b border-[#cbe6ef] bg-[#fbfdfe] p-4 sm:p-5 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-[#cbe6ef] pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#48606e]">
              Konteks yang dibawa
            </span>
            <span className="font-mono text-[9px] text-[#8aa0ac]">resolved</span>
          </div>

          <ul className="mt-4 space-y-2">
            {konteks.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-2.5 rounded-[8px] border border-transparent bg-white/45 px-2.5 py-2 transition-colors hover:border-[#cbe6ef]"
              >
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 text-[#2a7fb8]"
                  strokeWidth={1.8}
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium leading-snug text-[#0a3d62]">{item.label}</p>
                  <p className="mt-0.5 font-mono text-[10px] leading-relaxed break-words text-[#6f8793]">
                    {item.value}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#eef6fa] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-5 md:my-2 md:mr-2 md:rounded-[10px]">
          <div className="flex items-center justify-between border-b border-[#cbe6ef] pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#48606e]">
              Yang bisa kamu tanyakan
            </span>
            <span className="font-mono text-[9px] text-[#8aa0ac]">3 contoh</span>
          </div>

          <div className="mt-4 space-y-2">
            {contoh.map((prompt) => (
              <div
                key={prompt}
                className="rounded-[8px] border border-[#cbe6ef] bg-white/60 px-3 py-2.5"
              >
                <p className="text-[11px] leading-relaxed text-[#0a3d62]">{prompt}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[8px] border border-[#cbe6ef] bg-white/55 px-3 py-2.5">
            <p className="text-[10px] leading-relaxed text-[#48606e]">
              Modelnya dikonfigurasi sendiri di backend AI Mastery, terpisah dari{" "}
              <span className="font-mono">CAREERVO_LLM_*</span> — jadi chat ini tetap hidup saat
              fitur lain butuh model.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#cbe6ef] bg-[#f1f7fa] px-4 py-3 text-[10px] text-[#48606e] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>Satu-satunya obrolan belajar di Careevo.</span>
        <Link
          href="/ai-mastery"
          className="inline-flex items-center rounded-[6px] border border-[#cbe6ef] bg-white/70 px-2.5 py-1.5 font-medium text-[#48606e] transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-[#8fd6e3] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fb8] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          Buka AI Mastery
        </Link>
      </div>
    </ShowcaseFrame>
  );
}

/* =========================================================================
 * Showcase 6: Bukti ketaatan — the honesty score.
 *
 * What this can honestly claim is narrower than "anti-cheat", and the
 * narrowing is the point. The real system is:
 *
 *   - BROWSER EVENTS (tab switch, fullscreen exit, paste patterns) are
 *     recorded as CONTEXT only. `kejadian-panel.tsx:117` tells the learner
 *     outright they "tidak otomatis menggagalkan penilaian dan tidak
 *     mengurangi reputasimu".
 *   - The score moves ONLY from a human verifier's decision, stored as
 *     `integrity_violations` rows. `AGENTS.md` locks this: if the score read
 *     `learning_events`, turning JavaScript off would RAISE your own score.
 *   - Three violation kinds, weights snapshotted 5 / 10 / 20 at decision
 *     time, capped at 20 per course (`skor.ts:113`).
 *   - Recovery is an UPDATE to `expunged`, never a DELETE, and it fires only
 *     on a verified completion — so an informal finish can't erase a record.
 *
 * There is NO camera code anywhere in `src/` (no `getUserMedia`; the single
 * hit is a comment at `course-session.tsx:481`), and
 * `kejadian-panel.tsx:121` tells learners "Careevo belum mengakses kameramu".
 * `kamera_mulai` is only ever a value a learner picks from a radio group.
 * So this panel says nothing about a camera — a claim about it would
 * contradict what the product tells the user three clicks away.
 *
 * The server-side `wajib_kamera` gate is nonetheless real
 * (`akses.ts:90`, enforced in `learning.ts` and `assessment-service.ts:418`),
 * and its only key IS that self-report button. No seeded course sets the
 * policy, so it is unreachable today — a latent trap, not a live exploit.
 * Do not advertise it, and do not seed a `wajib_kamera` course until the
 * camera emitter that the 2026-09-27 plan promised actually exists.
 * ======================================================================= */
function IntegrityVisual() {
  const teguran = AUDIT_TANPA_AGEN_MATI.filter((entry) => entry.actor_id === "verifier");

  return (
    <ShowcaseFrame label="Pratinjau skor kejujuran">
      <FrameTopbar
        title="Skor kejujuran"
        context="derived · never stored"
        icon={ShieldCheck}
        trailing={
          <span className="font-mono text-[10px] text-[#6f8793]">per course / cap 20</span>
        }
      />

      <div className="grid min-h-[318px] grid-cols-1 md:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
        <div className="min-w-0 border-b border-[#cbe6ef] bg-[#fbfdfe] md:border-b-0 md:border-r md:py-2">
          <div className="flex items-center justify-between border-b border-[#cbe6ef] px-4 py-3 text-[10px] sm:px-5">
            <span className="font-semibold uppercase tracking-[0.12em] text-[#48606e]">
              Yang bisa dan tidak bisa menurunkan skor
            </span>
          </div>

          <div className="space-y-1 p-2">
            <div className="rounded-[8px] border border-[#cbe6ef] bg-white px-3 py-3 sm:px-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#48606e]">
                  Turunkan skor
                </span>
                <span className="font-mono text-[9px] text-[#8aa0ac]">human decision</span>
              </div>
              <ul className="mt-2.5 space-y-1.5">
                {[
                  ["Meninggalkan sesi terverifikasi", "bobot 5"],
                  ["Pola salin-tempel saat asesmen", "bobot 10"],
                  ["Karya tidak berasal dari peserta", "bobot 20"],
                ].map(([label, bobot]) => (
                  <li key={label} className="flex items-start gap-2">
                    <ShieldCheck aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-[#2a7fb8]" strokeWidth={1.7} />
                    <span className="min-w-0 flex-1 text-[11px] leading-snug text-[#0a3d62]">{label}</span>
                    <span className="shrink-0 font-mono text-[9px] text-[#8aa0ac]">{bobot}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[10px] leading-relaxed text-[#6f8793]">
                Maksimal 20 poin per kursus. Mengulang kursus itu memulihkan catatan sebelumnya.
              </p>
            </div>

            <div className="rounded-[8px] border border-transparent bg-white/45 px-3 py-3 sm:px-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f8793]">
                  Dicatat, tapi tidak menurunkan
                </span>
                <span className="font-mono text-[9px] text-[#a8bcc6]">context only</span>
              </div>
              <ul className="mt-2.5 space-y-1.5">
                {["Pindah tab", "Kehilangan fokus", "Keluar layar penuh", "Pola menempel teks panjang"].map(
                  (label) => (
                    <li key={label} className="flex items-start gap-2">
                      <span aria-hidden="true" className="mt-1 size-1.5 shrink-0 rounded-full bg-[#a8bcc6]" />
                      <span className="min-w-0 flex-1 text-[11px] leading-snug text-[#48606e]">{label}</span>
                    </li>
                  ),
                )}
              </ul>
              <p className="mt-2.5 text-[10px] leading-relaxed text-[#6f8793]">
                Sinyal peramban ini bisa dimatikan sendiri, jadi tidak pernah menghukum otomatis.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#eef6fa] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:p-5 md:my-2 md:mr-2 md:rounded-[10px]">
          <div className="flex items-center justify-between border-b border-[#cbe6ef] pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#48606e]">
              Catatan verifier
            </span>
            <span className="font-mono text-[10px] text-[#8aa0ac]">{teguran.length}</span>
          </div>

          <div className="relative mt-5 h-[76px] overflow-hidden rounded-[12px] border border-[#cbe6ef] bg-[#e2eef4]">
            <div className="absolute inset-y-0 left-1/2 w-px bg-[#cbe6ef]" />
            <div className="absolute -bottom-16 left-6 size-32 rounded-full border border-[#cbe6ef]" />
            <div className="absolute -bottom-10 left-14 size-24 rounded-full border border-[#cbe6ef]" />
            <LockKeyhole aria-hidden="true" className="absolute bottom-3 right-3 size-7 text-[#2a7fb8]" strokeWidth={1.3} />
            <div className="absolute bottom-3 left-3">
              <p className="text-[10px] font-semibold text-[#48606e]">Append-only</p>
              <p className="mt-0.5 font-mono text-[9px] text-[#48606e]">expunged ≠ delete</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {teguran.length ? (
              teguran.slice(0, 3).map((entry) => (
                <div key={entry.id} className="rounded-[8px] border border-[#cbe6ef] bg-white/60 px-3 py-2.5">
                  <p className="text-[11px] leading-snug text-[#0a3d62]">{entry.summary}</p>
                  <p className="mt-1 font-mono text-[9px] text-[#8aa0ac]">{entry.action}</p>
                </div>
              ))
            ) : (
              <p className="rounded-[8px] border border-[#cbe6ef] bg-white/60 px-3 py-2.5 text-[11px] leading-relaxed text-[#6f8793]">
                Belum ada catatan verifikasi pada akun ini.
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-[#cbe6ef] pt-3 text-[10px] leading-relaxed text-[#48606e]">
            Skor tidak pernah disimpan: dihitung ulang dari catatan yang aktif, jadi tidak bisa
            diedit dari sisi mana pun.
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-[#cbe6ef] bg-[#f1f7fa] px-4 py-3 text-[10px] text-[#48606e] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>Bukan deteksi otomatis — bukti dikumpulkan, keputusan dibuat manusia.</span>
        <span className="font-mono">integrity_violations / status active</span>
      </div>
    </ShowcaseFrame>
  );
}

/* =========================================================================
 * Showcase 4: Skill gap — the deterministic shortlist.
 *
 * The old title of this tab was "Navigator", a prototype name. It could not
 * stay: `src/lib/learning/dashboard-integritas.test.ts:76` exists to forbid
 * promising Navigator anywhere, because nothing named Navigator is traceable
 * to a row owned by the logged-in account. Marketing copy claiming a product
 * surface no query can return is exactly the failure that test was written
 * for. The name is now the mechanism.
 *
 * What this board shows is the REAL pairing on the job detail page:
 *   - `RekomendasiKursusPanel` — deterministic, ranked from the catalog, so
 *     it survives with no model configured. This is the main board.
 *   - `JalurLokerPanel` — turns one posting's requirements into schedulable
 *     testable points, but is LLM-drafted and fails LOUD when no model is
 *     present rather than inventing a tree. Represented as the footer note,
 *     not as a second column that implies it always renders.
 *
 * Source: local profile, task, and job fixtures.
 * ========================================================================= */
function SkillGapColumn({
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

function SkillGapVisual() {
  const verified = profile.badges;
  const practice = tasks.filter((task) => task.status === "available" || task.status === "review");
  const opportunities = jobs.filter((job) => job.sentinel_status === "clean").slice(0, 3);

  return (
    <ShowcaseFrame label="Pratinjau celah skill">
      <FrameTopbar
        title="Celah skill"
        context="shortlist + jalur"
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
        <SkillGapColumn label="Sudah terbukti" count={verified.length}>
          {verified.map((badge) => (
            <div key={badge.id} className="flex gap-2.5 rounded-[8px] border border-transparent bg-white/45 px-2.5 py-2.5 transition-colors hover:border-[#cbe6ef]">
              <Initials value={badge.task_title} />
              <div className="min-w-0">
                <p className="text-[11px] font-medium leading-snug text-[#0a3d62]">{badge.task_title}</p>
                <p className="mt-1 font-mono text-[9px] text-[#8aa0ac]">{badge.track} · {badge.level} · {badge.score}/100</p>
              </div>
            </div>
          ))}
        </SkillGapColumn>

        <SkillGapColumn label="Latihan berikutnya" count={practice.length}>
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
        </SkillGapColumn>

        <SkillGapColumn label="Peluang terarah" count={opportunities.length}>
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
        </SkillGapColumn>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#cbe6ef] bg-[#f1f7fa] px-4 py-3 text-[10px] text-[#48606e] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>Skor saat ini {profile.score_total}/100 · {verified.length} badge · {practice.length} latihan terbuka</span>
        <Link href="/loker" className="inline-flex items-center rounded-[6px] border border-[#cbe6ef] bg-white/70 px-2.5 py-1.5 font-medium text-[#48606e] transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-[#8fd6e3] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fb8] motion-reduce:transition-none motion-reduce:active:scale-100">
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
    id: "review-verifikator",
    navLabel: "Review oleh manusia",
    headlineBold: "Nilai karyamu keluar dari rubrik, bukan dari tebakan.",
    headlineMuted:
      "Karyamu dinilai verifikator manusia lewat lima kriteria: kelengkapan, kualitas, orisinalitas, ketepatan brief, dan dokumentasi. Skornya dihitung server, dan keputusan itu yang menandatangani sertifikatmu.",
    renderVisual: () => <ReviewRubricVisual />,
  },
  {
    id: "loker-pipeline",
    navLabel: "Lowongan yang cocok",
    headlineBold: "Lowongan dipindai, diaudit, lalu dicocokkan sama kamu.",
    headlineMuted:
      "Tekan satu tombol untuk memindai papan lowongan publik. Setiap lowongan yang masuk diaudit Sentinel lebih dulu, lalu dicocokkan ke profilmu: kursus mana yang menutup celahnya, dan jalur belajar mana yang perlu kamu jalankan.",
    renderVisual: () => <LokerPipelineVisual />,
  },
  {
    id: "skill-gap",
    navLabel: "Celah skill",
    headlineBold: "Buka satu lowongan, langsung tahu celah skillmu di mana.",
    headlineMuted:
      "Syarat lowongan dipecah jadi skill yang bisa diuji. Kursus yang menutup celahnya dipilih dari katalog, lalu hasilnya bisa kamu ubah jadi jalur belajar yang dijadwalkan ulang.",
    renderVisual: () => <SkillGapVisual />,
  },
  {
    id: "ai-mastery",
    navLabel: "Tanya AI Mastery",
    headlineBold: "Tanya materi yang sedang kamu pelajari, bukan topik umum.",
    headlineMuted:
      "Dari halaman kursus, AI Mastery terbuka dengan kursus itu sudah jadi konteks obrolan. Jadi jawabannya datang dari materimu sendiri, dan kamu tahu sedang di modul mana.",
    renderVisual: () => <AiMasteryVisual />,
  },
  {
    id: "skor-kejujuran",
    navLabel: "Skor kejujuran",
    headlineBold: "Nilai kamu bukan cuma hasil akhirnya — tapi caranya.",
    headlineMuted:
      "Pindah tab, keluar layar penuh, dan pola salin-tempel dicatat sebagai konteks, bukan hukuman. Skor kejujuran turun hanya dari keputusan verifikator. Sekali dampaknya paling 20 poin per kursus, dan catatan itu hanya bisa dipulihkan kalau kamu mengulang kursusnya sampai selesai lewat jalur terverifikasi.",
    renderVisual: () => <IntegrityVisual />,
  },
];

/* =========================================================================
 * Problem framing
 * Figures are quoted from named sources; none of them are invented.
 * BPS (Indikator Kesejahteraan Rakyat 2025) · Stanford Digital Economy Lab
 * (Canaries in the Coal Mine, 2026) · Kominfo (2024) · Robert Half (2026).
 *
 * Card 02's 19% is the Stanford revision (up from 15% at the July 2025
 * vintage), measured against same-age peers in less-exposed occupations —
 * not an economy-wide "below trend" figure. The same paper reports the gap
 * attenuating to roughly half once an education control is added, so the
 * card states the comparison rather than implying a settled total.
 *
 * Card 03 uses only the 65% verification figure. Robert Half's survey is
 * about resumes and applications, so the title says "lamaran dan CV" rather
 * than "portofolio dan sertifikat", and the source line carries "AS"
 * because the 2,000+ sample is US hiring managers.
 * ========================================================================= */
interface MasalahSolusiItem {
  id: string;
  nomor: string;
  /* `judul` = front-face headline (the problem). `solusiJudul` = back-face
     headline. These must stay separate fields: the back face once rendered
     `judul`, so the card labelled "Yang Careevo kerjain" led with the
     problem's own headline. */
  judul: string;
  solusiJudul: string;
  masalah: string;
  sumber: string;
  solusi: string;
  /* Ikon bulat + aksen kartu. Satu aksen per kartu, dan semuanya tetap di
     ramp biru-oseanik yang sama (DESIGN.md: jangan lebih dari satu aksen baru
     per permukaan) — `--leaf` tidak dipakai di sini karena DESIGN.md
     mencadangkannya untuk affordance sukses/status. */
  ikon: LucideIcon;
  gambar: string;
  gambarAlt: string;
  permukaan: string;
  ikonGrad: string;
  aksen: string;
}

const MASALAH_SOLUSI: MasalahSolusiItem[] = [
  {
    id: "pengangguran-muda",
    nomor: "01",
    judul: "Sudah lulus, belum keburu kerja.",
    solusiJudul: "Kamu dinilai dari yang kamu kerjakan.",
    masalah:
      "19,44% anak muda 15–24 tahun nggak kerja, nggak sekolah, nggak ikut pelatihan. BPS menyebutnya “potensi tenaga kerja yang hilang”.",
    sumber: "BPS · Indikator Kesejahteraan Rakyat 2025",
    solusi:
      "Latihan diarahkan ke posisi yang benar-benar dibuka, bukan kursus yang berhenti di sertifikat.",
    ikon: GraduationCap,
    gambar: "/images/masalah-solusi/belajar-buku.webp",
    gambarAlt: "Ilustrasi tumpukan buku dan buku terbuka di tepi laut",
    permukaan: "bg-[linear-gradient(165deg,#f4fafe_0%,#e4f1f9_100%)]",
    ikonGrad: "bg-[linear-gradient(140deg,#2a7fb8_0%,#0a3d62_100%)]",
    aksen: "text-[#0a3d62]",
  },
  {
    id: "level-masuk-kena-ai",
    nomor: "02",
    judul: "Level masuk yang paling kena AI.",
    solusiJudul: "Skill kamu ditunjuk dari lowongan yang benar-benar ada.",
    masalah:
      "Usia 22–25 di pekerjaan yang paling terkena AI sekitar 19% lebih sedikit dibanding kelompok seusianya di pekerjaan yang paparan AI-nya lebih rendah. Di Indonesia pasokan lulusan IT melimpah, tapi perusahaan tetap susah dapat talenta yang bisa dibuktikan.",
    sumber: "Stanford Digital Economy Lab · payroll AS 2026 · Kominfo 2024",
    solusi:
      "Materi dan latihan disusun dari celah skill di posisi yang kamu incar, dan lokernya sudah lewat audit Sentinel.",
    ikon: ChartNoAxesColumnIncreasing,
    gambar: "/images/masalah-solusi/analitik-skill.webp",
    gambarAlt: "Ilustrasi laptop berisi grafik dan server di tepi laut",
    permukaan: "bg-[linear-gradient(165deg,#fbfdfe_0%,#e9f4f8_100%)]",
    ikonGrad: "bg-[linear-gradient(140deg,#1b6ca8_0%,#0a3d62_100%)]",
    aksen: "text-[#124e78]",
  },
  {
    id: "bukti-bisa-dibuat-ai",
    nomor: "03",
    judul: "Lamaran dan CV bisa digenerate AI.",
    solusiJudul: "Rekruter bisa cek kemampuanmu dari satu tautan.",
    masalah:
      "65% manajer perekrutan di AS bilang lonjakan lamaran hasil AI bikin skill kandidat makin susah diverifikasi.",
    sumber: "Robert Half · 2.000+ manajer perekrutan AS, 2026",
    solusi:
      "Tiap tugas diuji, dicatat, dan ditandatangani digital. Kamu harus bisa mempertanggungjawabkan hasil kerjamu sendiri, dan rekruter bisa mengeceknya dari satu tautan.",
    ikon: BadgeCheck,
    gambar: "/images/masalah-solusi/bukti-sertifikat.webp",
    gambarAlt: "Ilustrasi sertifikat bertanda tangan dan segel yang sudah diverifikasi",
    permukaan: "bg-[linear-gradient(165deg,#f2f9fc_0%,#e1eef6_100%)]",
    ikonGrad: "bg-[linear-gradient(140deg,#40c9c6_0%,#2a7fb8_100%)]",
    aksen: "text-[#0a3d62]",
  },
];

export function MarketingProblemsSolutions() {
  const [activeItem, setActiveItem] = useState(0);
  const [kartuTerbalik, setKartuTerbalik] = useState<string | null>(null);
  const articleRefs = useRef<(HTMLElement | null)[]>([]);
  const tombolDepan = useRef<Record<string, HTMLButtonElement | null>>({});
  const tombolBelakang = useRef<Record<string, HTMLButtonElement | null>>({});
  const navItemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, ready: false });
  const sectionRef = useRef<HTMLElement>(null);
  useProblemsSolutionsMotion(sectionRef);

  useEffect(() => {
    const updateIndicator = () => {
      const itemEl = navItemRefs.current[activeItem];
      if (itemEl) {
        setIndicatorStyle({
          top: itemEl.offsetTop + 6,
          height: Math.max(0, itemEl.offsetHeight - 12),
          ready: true,
        });
      }
    };
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeItem]);

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

    /**
     * Coalesced, not a bare `scroll` listener. This is the most expensive
     * handler on the page — a `getBoundingClientRect()` per article, in a loop,
     * per event — and under Lenis every one of those reads is a forced reflow
     * because the event lands in the same task as the scroll write. Coalesced,
     * the whole batch costs one layout per frame. See
     * `src/lib/scroll/scroll-frame.ts` for the measurements.
     *
     * `onScrollFrame` also runs it once on subscribe, so the explicit
     * `handleScroll()` this used to call is no longer needed.
     */
    return onScrollFrame(handleScroll);
  }, []);

  const scrollToItem = (index: number) => {
    setActiveItem(index);
    const target = articleRefs.current[index];
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      id="solusi"
      ref={sectionRef}
      className="relative w-full border-b border-[#cbe6ef] bg-white text-[#0a2a3a]"
    >
      <div className="mx-auto max-w-7xl border-x border-[#cbe6ef] bg-white">
        <div className="border-b border-[#cbe6ef] px-6 py-14 sm:px-10 lg:px-14 lg:py-18">
          <p
            data-ps="eyebrow"
            className="mb-6 font-mono text-[10px] uppercase tracking-[0.16em] text-[#48606e]"
          >
            Masalah{" "}
            <span data-ps="slash" className="inline-block">
              /
            </span>{" "}
            Solusi
          </p>

          {/*
            The h2 is deliberately two-tone: a bold problem statement and a muted
            resolution. It used to be one `Reveal`, which animated the argument
            as a single block. Each line is now its own mask so the resolution
            can arrive a beat after the problem it answers.

            `inline-block` + `align-bottom` rather than `block`, because the
            `<br>` is `hidden` below `sm` and there the two lines are meant to
            flow together as one paragraph — `block` would restyle mobile.
          */}
          <h2 className="max-w-4xl text-3xl font-medium leading-tight tracking-[-0.035em] text-[#0a2a3a] sm:text-4xl lg:text-[44px]">
            <span className="text-mask inline-block overflow-hidden align-bottom">
              <span
                data-ps="mask-a"
                className="inline-block align-bottom"
              >
                <span
                  data-ps="line-a"
                  className="inline-block font-semibold"
                >
                  Lowongan makin sempit, pelamar makin susah dibedakan.{" "}
                </span>
              </span>
            </span>
            <br className="hidden sm:inline" />
            <span className="text-mask inline-block overflow-hidden align-bottom">
              <span data-ps="mask-b" className="inline-block align-bottom">
                <span
                  data-ps="line-b"
                  className="inline-block font-normal text-[#8aa0ac]"
                >
                  Careevo bikin kemampuanmu bisa dibuktikan, bukan cuma
                  diklaim.
                </span>
              </span>
            </span>
          </h2>

          <p
            data-ps="lede"
            className="mt-4 max-w-3xl text-base leading-relaxed text-[#48606e] sm:text-lg"
          >
            AI bikin lamaran, sertifikat, dan portofolio bisa jadi dalam
            hitungan menit — sementara perusahaan makin hati-hati merekrut. Satu
            jalur menyambung latihan, kerja nyata, dan bukti yang bisa dicek siapa
            pun.
          </p>

          {/*
            Kartu bisa dibalik: muka depan memuat masalahnya, muka belakang
            memuat yang Careevo kerjain. Tiga hal yang mudah terlewat di sini
            dan sengaja ditangani:

            1. Kedua muka duduk di sel grid yang SAMA (`[grid-area:1/1]`),
               bukan `absolute inset-0`. Dengan absolute, tinggi wadah
               ikut mengecil jadi nol saat isi muka berubah, dan muka yang
               lebih tinggi akan terpotong. Sel bersama membuat tinggi
               wadah = max(depan, belakang) secara otomatis.
            2. Muka yang tersembunyi diberi `inert`, bukan hanya
               `aria-hidden`. `aria-hidden` tidak mengeluarkan subtree dari
               tab order — tanpa `inert`, tombol "Kembali" di muka belakang
               yang terbalik masih bisa di-TAB dan difokuskan tanpa terlihat.
            3. `motion-reduce` mematikan rotasinya, jadi kedua muka hanya
               cross-fade. `backface-visibility` juga dimatikan di mode itu,
               karena tanpa rotasi transformasinya tidak berlaku.
          */}
          <div
            data-ps="card-row"
            className="mt-12 grid grid-cols-1 items-stretch gap-5 md:grid-cols-3 lg:gap-6"
          >
            {MASALAH_SOLUSI.map((item) => {
              const terbalik = kartuTerbalik === item.id;

              return (
                <div key={item.id} data-ps="card" className="h-full">
                  <div className="h-full [perspective:1600px]">
                    {/*
                      `data-ps="tilt"` is the entrance's `rotateY` layer and
                      nothing else. It has to sit *inside* the perspective
                      wrapper — perspective applies to direct children, so
                      rotating the perspective element itself would be seen flat.
                      It also cannot be the flip container below, which owns
                      `rotateY(180deg)` for the flipped state: one element, one
                      transform.
                    */}
                    <div data-ps="tilt" className="h-full">
                    <div
                      className={cn(
                        "grid h-full w-full [transform-style:preserve-3d] [transition:transform_520ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:[transition:none]",
                        terbalik
                          ? "[transform:rotateY(180deg)] motion-reduce:[transform:none]"
                          : "motion-reduce:[transform:none]",
                      )}
                    >
                      <div
                        aria-hidden={terbalik}
                        inert={terbalik}
                        className={cn(
                          "flex flex-col overflow-hidden rounded-[12px] border border-[#bfd9e7] shadow-[0_1px_2px_rgba(10,61,98,0.05),0_12px_28px_-18px_rgba(10,61,98,0.32)] transition-opacity duration-200 [grid-area:1/1] [backface-visibility:hidden] motion-reduce:[backface-visibility:visible]",
                          item.permukaan,
                          terbalik && "opacity-0",
                        )}
                      >
                        <div className="flex items-center gap-3 px-4 pt-4 md:px-5 md:pt-5">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-[0_6px_14px_-6px_rgba(10,61,98,0.55)]",
                              item.ikonGrad,
                            )}
                          >
                            <item.ikon className="size-[18px]" strokeWidth={1.7} />
                          </span>
                          <p className="text-[13px] font-semibold leading-tight tracking-[-0.01em] text-[#0a3d62]">
                            Masalah{" "}
                            <span className="font-mono text-[11px] font-normal text-[#8aa0ac]">
                              {item.nomor}
                            </span>
                          </p>
                        </div>

                        {/*
                          Mobile-first spacing. The three cards stack into one
                          column below `md`, where the section reads as ~1,800px
                          of cards — the front face alone sets each card's
                          height (front 578/654/572 vs back 444/442/484 at
                          390px), and generous `pt-5`/`pt-6`/`mt-5` padding
                          stretched it further. The illustration keeps its full
                          16/10 box and the type keeps its sizes; only the
                          rhythm around them tightens, and every value restores
                          to its original at `md`, so the 3-column desktop
                          layout is unchanged.
                        */}
                        <h3
                          className={cn(
                            "px-4 pt-3.5 text-[26px] font-bold leading-[1.1] tracking-[-0.035em] md:px-5 md:pt-6",
                            item.aksen,
                          )}
                        >
                          {item.judul}
                        </h3>

                        <p className="px-4 pt-1.5 font-mono text-[10px] leading-snug text-[#5d7a89] md:px-5 md:pt-2.5 md:leading-relaxed">
                          {item.sumber}
                        </p>

                        <p className="px-4 pt-3 text-[13px] leading-[1.5] text-[#48606e] md:px-5 md:pt-4 md:leading-relaxed">
                          {item.masalah}
                        </p>

                        <div className="mt-auto px-4 pt-3.5 md:px-5 md:pt-6">
                          <button
                            ref={(el) => {
                              tombolDepan.current[item.id] = el;
                            }}
                            type="button"
                            onClick={() => setKartuTerbalik(item.id)}
                            aria-expanded={terbalik}
                            aria-controls={`solusi-${item.id}`}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-[#bfd9e7] bg-white px-6 text-[15px] font-semibold text-[#0a3d62] shadow-[0_1px_2px_rgba(10,61,98,0.06)] transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-[#2a7fb8] hover:text-[#124e78] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fb8] motion-reduce:transition-none motion-reduce:active:scale-100"
                          >
                            Lihat solusinya
                            <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.8} />
                          </button>
                        </div>

                        {/*
                          Ilustrasi ini di-passthrough, bukan dioptimalkan.
                          Alasannya terukur, bukan selera.

                          `next/image` selalu menyandi ulang lossy: ia decode
                          WebP q92 di `public/`, resize, lalu encode ulang pada
                          `q=75` (default Next 16). Untuk artwork datar seperti
                          ini — bentuk vektor dengan gradien luas — itu
                          generate lossy kedua di atas sumber yang sudah lossy,
                          dan gejalanya persis "mushy, bergaris".

                          Diukur pada `belajar-buku.webp`, slot 640w yang dipakai
                          kartu 371px. PSNR vs sumber; 45+ dB ~= tak kasat mata.

                            q=75 (dulu)  11.2 KB   37.5 dB
                            q=80         13.6 KB   38.8 dB
                            q=85         17.3 KB   40.0 dB
                            q=90         22.7 KB   41.4 dB
                            q=95         33.6 KB   42.8 dB
                            passthrough  29.2 KB   lossless (resample bersih)

                          Menaikkan `quality` tidak menolong: q=95 pun masih
                          42.8 dB dan sudah lebih besar dari file aslinya.
                          Menambah `images.qualities` juga bukan jalan — optimizer
                          menolak q=90 dengan 400, `"q" parameter (quality) of
                          90 is not allowed`.

                          `sizes` ikut dilepas karena `unoptimized` tidak membuat
                          `srcset`, jadi atribut itu tidak akan pernah dibaca.
                          Gambar tetap `lazy` (default `next/image`).

                          Trade-off jujur: kartu 371px di DPR 2 butuh 742 device
                          px, dan sumber 1000px menutup itu (1.35x). Yang hilang
                          hanya penghematan srcset di ponsel (~29 KB vs ~5 KB per
                          gambar) — untuk 3 ilustrasi marketing yang lazy-loaded,
                          itu sepadan. Butuh lebih tajam nanti? Buat ulang
                          `public/images/masalah-solusi/*.webp` pada 2x; jangan
                          menaikkan `quality` optimizer.

                          Bukti: `docs/masalah-solusi-verify/`.
                        */}
                        <div className="relative mt-3.5 aspect-[16/10] w-full overflow-hidden md:mt-5">
                          <Image
                            src={item.gambar}
                            alt={item.gambarAlt}
                            fill
                            unoptimized
                            className="object-cover object-center [mask-image:linear-gradient(to_bottom,transparent_0%,#000_42%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,#000_42%)]"
                          />
                        </div>
                      </div>

                      <div
                        id={`solusi-${item.id}`}
                        inert={!terbalik}
                        className={cn(
                          "flex flex-col overflow-hidden rounded-[12px] border border-[#8fd6e3]/45 bg-[linear-gradient(165deg,#0a3d62_0%,#124e78_58%,#1b6ca8_100%)] text-white shadow-[0_1px_2px_rgba(10,61,98,0.05),0_12px_28px_-18px_rgba(10,61,98,0.32)] transition-opacity duration-200 [grid-area:1/1] [transform:rotateY(180deg)] [backface-visibility:hidden] motion-reduce:[transform:none] motion-reduce:[backface-visibility:visible]",
                          !terbalik && "opacity-0",
                        )}
                      >
                        <div className="flex items-center gap-3 px-5 pt-5">
                          <span
                            aria-hidden="true"
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]"
                          >
                            <Sparkles className="size-[18px]" strokeWidth={1.7} />
                          </span>
                          <p className="text-[13px] font-semibold leading-tight tracking-[-0.01em] text-white">
                            Solusi{" "}
                            <span className="font-mono text-[11px] font-normal text-[#bfe6ef]">
                              {item.nomor}
                            </span>
                          </p>
                        </div>

                        {/*
                          Wajah belakang setinggi wajah depan (wajah depan
                          tambah pita gambar), jadi tanpa ini ada rongga besar
                          di tengah. `flex-1 + justify-center` menaruh isi
                          solution di-optical center, dan tombol tetap
                          menempel di bawah lewat `mt-auto` di blok terakhir.
                        */}
                        <div className="flex flex-1 flex-col justify-center">
                          <p className="px-5 pt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8fd6e3]">
                            Yang Careevo kerjain
                          </p>

                          <p className="px-5 pt-3 text-[19px] font-semibold leading-snug tracking-[-0.02em] text-white">
                            {item.solusiJudul}
                          </p>

                          <p className="px-5 pt-4 text-[14px] leading-relaxed text-[#dcecf3]">
                            {item.solusi}
                          </p>
                        </div>

                        <p className="mt-auto px-5 pt-6 text-[11px] leading-relaxed text-[#bfe6ef]/80">
                          Sumber masalahnya: {item.sumber}
                        </p>

                        <div className="px-5 pb-5 pt-4">
                          <button
                            ref={(el) => {
                              tombolBelakang.current[item.id] = el;
                            }}
                            type="button"
                            onClick={() => {
                              setKartuTerbalik(null);
                              tombolDepan.current[item.id]?.focus();
                            }}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-white/70 bg-white px-6 text-[15px] font-semibold text-[#0a3d62] shadow-[0_1px_2px_rgba(7,42,63,0.18)] transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-white hover:bg-white/90 hover:text-[#124e78] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fd6e3] motion-reduce:transition-none motion-reduce:active:scale-100"
                          >
                            <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.8} />
                            Kembali ke masalah
                          </button>
                        </div>
                      </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            data-ps="quote"
            className="mt-10 flex max-w-3xl flex-col gap-3 border-l border-[#8fd6e3] py-1 pl-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
          >
            <p className="text-xs italic leading-relaxed text-[#48606e] sm:text-sm">
              &ldquo;In a world where AI can generate anything, having basic critical thinking skills may be the most important thing to success. You don&rsquo;t want to fall for things that are fake, and you don&rsquo;t want to get scammed.&rdquo;
              <span className="mt-1 block font-medium not-italic text-[#0a3d62]">— Dario Amodei, CEO Anthropic</span>
            </p>
            <a
              href="https://x.com/vikktorrrre/status/2102446813714293039"
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit shrink-0 border-b border-[#8fd6e3] pb-0.5 text-xs font-medium text-[#124e78] transition-[color,border-color,transform] duration-200 ease-out hover:text-[#124e78] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2a7fb8] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              Lihat di X
            </a>
          </div>

        </div>

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-12">
          <nav
            data-ps="showcase-nav"
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

            <ol className="relative hidden flex-col gap-2 pl-8 pr-4 lg:flex">
              {/* Smooth sliding active indicator line positioned at the section's left border */}
              <span
                aria-hidden="true"
                style={{
                  transform: `translateY(${indicatorStyle.top}px)`,
                  height: `${indicatorStyle.height}px`,
                  opacity: indicatorStyle.ready ? 1 : 0,
                }}
                className="pointer-events-none absolute -left-px top-0 w-[2.5px] rounded-r-full bg-[#0a3d62] transition-[transform,height,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              />

              {SHOWCASE_ITEMS.map((item, index) => {
                const isActive = activeItem === index;
                return (
                  <li
                    key={item.id}
                    ref={(el) => {
                      navItemRefs.current[index] = el;
                    }}
                    data-ps="nav-item"
                  >
                    <button
                      type="button"
                      onClick={() => scrollToItem(index)}
                      className="group relative flex w-full cursor-pointer rounded-[7px] py-2 pl-5 pr-4 text-left text-[15px] font-medium transition-[color,background-color,transform] duration-200 ease-out hover:bg-[#f7fbfd] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7fb8] xl:text-base motion-reduce:transition-none motion-reduce:active:scale-100"
                    >
                      <span
                        className={cn(
                          "transition-[color,transform] duration-200",
                          isActive
                            ? "font-semibold text-[#0a3d62] translate-x-0.5"
                            : "text-[#8aa0ac] group-hover:text-[#48606e]",
                        )}
                      >
                        {item.navLabel}
                      </span>
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
                data-ps="showcase-article"
                ref={(element) => {
                  articleRefs.current[index] = element;
                }}
                className="scroll-mt-24 border-b border-[#cbe6ef] last:border-b-0"
              >
                <div className="px-6 pb-8 pt-12 sm:px-10 lg:px-12 lg:pb-10 lg:pt-16">
                  <h3 className="max-w-3xl text-2xl font-medium leading-snug tracking-[-0.02em] sm:text-3xl">
                    <span
                      data-ps="showcase-bold"
                      className="inline-block font-semibold text-[#0a3d62]"
                    >
                      {item.headlineBold}
                    </span>{" "}
                    <span
                      data-ps="showcase-muted"
                      className="inline-block font-normal text-[#8aa0ac]"
                    >
                      {item.headlineMuted}
                    </span>
                  </h3>
                </div>

                <div className="border-t border-[#cbe6ef]" />

                <div className="flex w-full items-center justify-center overflow-hidden bg-[#e2eef4] p-3 sm:p-6 lg:p-8">
                  <div
                    data-ps="showcase-visual"
                    className="flex w-full max-w-6xl justify-center"
                  >
                    {item.renderVisual()}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
