export type Role = "user" | "verifikator" | "admin";

export type Track = "web-dev" | "data" | "game-dev" | "cyber-sec";

export type Level = "dasar" | "menengah" | "lanjut";

export type SubmissionStatus =
  | "autocheck_running"
  | "waiting_socrates"
  | "waiting_review"
  | "approved"
  | "revision"
  | "rejected";

export type BadgeStatus = "active" | "revoked";

export type SentinelStatus = "clean" | "quarantined" | "rejected";

export type ApplicationStatus = "applied" | "reviewed" | "interview" | "outcome";

export type ActorType = "user" | "verifikator" | "admin" | "agent" | "system";

export type AgentName = "navigator" | "socrates" | "sentinel";

export type ReviewDecision = "approved" | "revision" | "rejected";

export interface Profile {
  id: string;
  role: Role;
  username: string;
  display_name: string;
  bio: string | null;
  score_total: number;
  score_jadwal: number;
  score_karya: number;
  score_validasi: number;
}

export interface Schedule {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  weekly_target_hours: number;
}

/**
 * Digantikan oleh `LearningRun` (`learning_runs`), yang tidak punya kolom
 * durasi — jangan membangun lapisan absensi di atas tipe ini.
 */
export interface Checkin {
  id: string;
  user_id: string;
  schedule_id: string | null;
  checkin_at: string;
  checkout_at: string | null;
  duration_min: number | null;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  provider: string;
  type: "video" | "artikel" | "course";
  tags: string[];
  level: Level;
  is_free: boolean;
}

export interface Task {
  id: string;
  title: string;
  track: Track;
  level: Level;
  brief: string;
  starter_repo_url: string | null;
}

export interface Submission {
  id: string;
  user_id: string;
  task_id: string;
  version: number;
  files: string[];
  snapshot_log: SnapshotEntry[];
  prompt_log: PromptEntry[];
  paste_events: PasteEvent[];
  status: SubmissionStatus;
  created_at: string;
}

export interface SnapshotEntry {
  at: string;
  hash: string;
  size: number;
}

export interface PromptEntry {
  at: string;
  tool: string;
  purpose: string;
}

export interface PasteEvent {
  at: string;
  length: number;
}

export interface Report {
  id: string;
  submission_id: string;
  timeline: TimelineEntry[];
  signals: Record<string, unknown>;
  autocheck: AutocheckResult | null;
  vts: number | null;
}

export interface TimelineEntry {
  at: string;
  actor_type: ActorType;
  actor_id: string;
  action: string;
  summary: string;
}

export interface AutocheckResult {
  tests_passed: number;
  tests_total: number;
  lighthouse_score: number | null;
  errors: string[];
}

export interface Review {
  id: string;
  submission_id: string;
  reviewer_id: string;
  rubric: Record<string, number>;
  total: number;
  decision: ReviewDecision;
  reason: string;
  created_at: string;
}

export interface SocratesDefense {
  id: string;
  submission_id: string;
  questions: string[];
  answers: string[] | null;
  draft_score: number | null;
  answered_at: string | null;
}

export interface Badge {
  id: string;
  user_id: string;
  task_id: string;
  track: Track;
  level: Level;
  score: number;
  issued_at: string;
  status: BadgeStatus;
}

export interface Attestation {
  id: string;
  badge_id: string;
  token: string;
  payload: Record<string, unknown>;
  signature: string;
  issued_at: string;
  revoked_at: string | null;
}

export interface AgentRun {
  id: string;
  agent: AgentName;
  input_summary: string;
  output_summary: string;
  used_fallback: boolean;
  latency_ms: number;
  created_at: string;
}

export interface JobCache {
  id: string;
  external_id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  tags: string[];
  fee_flags: string[];
  sentinel_status: SentinelStatus;
  raw: Record<string, unknown>;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  fit_score: number;
  fit_reasons: string[];
  status: ApplicationStatus;
  outcome: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_type: ActorType;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  prev_hash: string | null;
  entry_hash: string;
  created_at: string;
}
