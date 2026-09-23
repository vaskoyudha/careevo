import jobsRaw from "@/fixtures/jobs.json";
import resourcesRaw from "@/fixtures/resources.json";
import tasksRaw from "@/fixtures/tasks.json";
import reviewQueueRaw from "@/fixtures/review-queue.json";
import profileRaw from "@/fixtures/profile.json";
import submissionRaw from "@/fixtures/submission.json";
import auditLogRaw from "@/fixtures/audit-log.json";
import type { Level, SentinelStatus, SubmissionStatus } from "@/types/domain";
import type { TrustLevel } from "@/lib/jobs/trust";
import { ingestLoker, normalisasiLokerMentah } from "@/lib/jobs/ingestor";

/**
 * The raw fixture shape, exactly as it appears in `jobs.json`. Sentinel fields
 * are NOT stored here — they are derived (see `JobFixture`).
 */
export interface JobSeed {
  id: string;
  external_id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  work_type: string;
  level: Level;
  tags: string[];
  salary_range: string | null;
  posted_at: string;
  description: string;
  domain_age_days?: number;
  apply_url?: string | null;
  company_email?: string | null;
}

/**
 * A job as the app consumes it: the seed plus the Sentinel verdict.
 *
 * `sentinel_status` / `fee_flags` / trust fields are COMPUTED by `auditLoker`,
 * never hand-written into the fixture. Hand-writing them meant the JSON could
 * claim `clean` while its own description contained a fee demand — the audit was
 * decorative. Deriving them makes the verdict reproducible and testable: change
 * a rule, and every posting re-audits.
 */
export interface JobFixture extends JobSeed {
  sentinel_status: SentinelStatus;
  /** Every Sentinel signal — fee demands plus identity and trust flags. */
  flags: string[];
  /** Demand signals only: the "no-fee" axis. */
  fee_flags: string[];
  trust_score: number;
  trust_flags: string[];
  trust_level: TrustLevel;
}

export interface ResourceFixture {
  id: string;
  title: string;
  url: string;
  provider: string;
  type: "video" | "artikel" | "course";
  tags: string[];
  level: Level;
  is_free: boolean;
  duration_min: number;
  completed: boolean;
}

export interface TaskFixture {
  id: string;
  title: string;
  track: string;
  level: Level;
  brief: string;
  criteria: string[];
  constraints: string[];
  estimate_min: number;
  status: "passed" | "review" | "available" | "locked";
  score: number | null;
  requires?: string;
}

export interface ReviewQueueItem {
  id: string;
  username: string;
  task_title: string;
  track: string;
  level: Level;
  submitted_at: string;
  vts_score: number;
  socrates_answered: boolean;
  status: SubmissionStatus;
}

export interface SubmissionFixture {
  id: string;
  task_id: string;
  task_title: string;
  track: string;
  status: SubmissionStatus;
  submitted_at: string;
  autocheck: {
    tests: Array<{ name: string; passed: boolean; duration_ms: number; error?: string }>;
    lighthouse: {
      performance: number;
      accessibility: number;
      best_practices: number;
      seo: number;
    };
  };
  vts: {
    score: number;
    components: Array<{ label: string; value: number; max: number }>;
  };
  socrates: {
    questions: string[];
    answered: boolean;
    answered_at: string;
    deadline: string;
    draft_score: number;
  };
  timeline: Array<{
    at: string;
    actor_type: string;
    actor_id: string;
    action: string;
    summary: string;
  }>;
  rubric: Array<{ criterion: string; score: number; max: number; note: string }>;
  decision: { status: SubmissionStatus; total: number; reason: string };
}

export interface AuditLogFixture {
  id: string;
  at: string;
  actor_type: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  summary: string;
  metadata: Record<string, unknown>;
}

export interface ProfileFixture {
  username: string;
  display_name: string;
  track: string;
  verified_at: string;
  score_total: number;
  scores: Array<{ label: string; value: number; max: number }>;
  badges: Array<{
    id: string;
    task_title: string;
    track: string;
    level: string;
    issued_at: string;
    score: number;
  }>;
  works: Array<{
    id: string;
    title: string;
    demo_url: string;
    raw_url: string;
    status: string;
  }>;
  timeline: Array<{ at: string; title: string; actor: string }>;
}

const jobSeeds = jobsRaw as unknown as JobSeed[];

/** Run each seed through the ingest → Sentinel audit to produce the consumable job. */
export function auditJob(seed: JobSeed): JobFixture {
  const audit = ingestLoker(normalisasiLokerMentah(seed));

  return {
    ...seed,
    sentinel_status: audit.status,
    flags: audit.flags,
    fee_flags: audit.fee_flags,
    trust_score: audit.trust_score,
    trust_flags: audit.trust_flags,
    trust_level: audit.trust_level,
  };
}

export const jobs: JobFixture[] = jobSeeds.map(auditJob);

export const resources = resourcesRaw as unknown as ResourceFixture[];
export const tasks = tasksRaw as unknown as TaskFixture[];
export const reviewQueue = reviewQueueRaw as unknown as ReviewQueueItem[];
export const profile = profileRaw as unknown as ProfileFixture;
export const submission = submissionRaw as unknown as SubmissionFixture;
export const auditLog = auditLogRaw as unknown as AuditLogFixture[];

export function getProfile(username: string): ProfileFixture | undefined {
  const normalized = username.replace(/^@/, "").toLowerCase();
  return profile.username.toLowerCase() === normalized ? profile : undefined;
}

/**
 * Raw lookup by id — returns a job regardless of its Sentinel verdict.
 * Prefer `getVisibleJob` for anything user-facing; a `rejected` posting must not
 * be reachable by URL just because the list view hides it.
 */
export function getJob(id: string): JobFixture | undefined {
  return jobs.find((job) => job.id === id);
}

/**
 * Lookup that respects the visibility rule: `rejected` postings are not
 * reachable, so a direct `/loker/9` returns 404 instead of rendering a scam
 * posting with an apply flow.
 */
export function getVisibleJob(id: string): JobFixture | undefined {
  const job = getJob(id);
  return job && job.sentinel_status !== "rejected" ? job : undefined;
}

export function getTask(id: string): TaskFixture | undefined {
  return tasks.find((task) => task.id === id);
}

export function visibleJobs(): JobFixture[] {
  return jobs.filter((job) => job.sentinel_status !== "rejected");
}

export function cleanJobs(): JobFixture[] {
  return jobs.filter((job) => job.sentinel_status === "clean");
}
