"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";

export function routeSessionId(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

/**
 * The chromeless route (`/embed/chat`) exists so the chat can be framed
 * without the workspace sidebar. It has no `[sessionId]` segment, so the
 * chat-session URL rewrites must not fire there — they would navigate the
 * frame into `(workspace)` and hand it the sidebar it exists to avoid.
 * Matched on a segment boundary so `/embedded-x` stays out.
 */
export function isEmbeddedChatRoute(pathname: string): boolean {
  return pathname === "/embed/chat" || pathname.startsWith("/embed/chat/");
}

export function shouldRevalidateCachedSession(input: {
  routeSessionId: string | null;
  selectedSessionId: string | null;
  hasCachedMessages: boolean;
  isStreaming: boolean;
}): boolean {
  return Boolean(
    input.routeSessionId &&
    input.hasCachedMessages &&
    !input.isStreaming &&
    input.routeSessionId === input.selectedSessionId,
  );
}

export function useChatRouteSession() {
  const params = useParams<{ sessionId?: string }>();
  const router = useRouter();
  const sessionId = useMemo(
    () => routeSessionId(params.sessionId),
    [params.sessionId],
  );
  return { router, sessionId };
}
