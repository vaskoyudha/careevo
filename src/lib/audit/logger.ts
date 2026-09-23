import type { ActorType } from "@/types/domain";

export interface AuditEntry {
  actor_type: ActorType;
  actor_id: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  void entry;
  throw new Error("logAudit belum diimplementasikan (butuh Supabase server client)");
}
