import type { AgentName, AgentRun } from "@/types/domain";

export interface AgentRequest {
  agent: AgentName;
  input: unknown;
}

export interface AgentResponse<T> {
  output: T;
  usedFallback: boolean;
  latencyMs: number;
}

export async function runAgent<T>(
  request: AgentRequest,
): Promise<AgentResponse<T>> {
  void request;
  throw new Error("Agent orchestrator belum diimplementasikan");
}

export function toAgentRun(response: AgentResponse<unknown>): Omit<AgentRun, "id" | "created_at"> {
  void response;
  throw new Error("Agent orchestrator belum diimplementasikan");
}
