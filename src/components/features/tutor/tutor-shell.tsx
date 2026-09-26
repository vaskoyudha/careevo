"use client";

/**
 * Tutor workspace — Careevo's port of DeepTutor's chat layout.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: web/components/layout/AppShell.tsx
 * Source: web/features/chat/components/ChatWorkspace.tsx
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 * Modified for Careevo: Indonesian copy, no WebSocket streaming (server
 * actions instead), no capability switcher, no attachments, and the right
 * drawer is driven by the signed-cookie path rather than a session backend.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { SessionPayload } from "@/lib/auth/types";
import type { RingkasanTutorSession } from "@/lib/tutor/session-store";
import type { TutorSession } from "@/lib/tutor/types";
import { TutorRail } from "./tutor-rail";
import { TutorColumn } from "./tutor-column";
import { TutorActivity } from "./tutor-activity";
import { cn } from "@/lib/utils";

/**
 * `h-dvh`, not `vh`: iOS Safari's `100vh` includes the retracted address bar,
 * which would push the composer under it. This is the same reasoning as
 * DeepTutor's `AppShell`, and it is why the transcript owns its own scrolling —
 * a page that scrolls as a whole cannot pin a composer to the bottom.
 */
const PANEL_KEY = "dt:tutor:panel";

function subscribeToNothing(): () => void {
  return () => undefined;
}

/** The drawer starts closed on the server, then restores the saved state. */
function getPanelServerSnapshot(): boolean {
  return false;
}

let cachedPanelOpen: boolean | null = null;

function getPanelSnapshot(): boolean {
  if (cachedPanelOpen === null) {
    try {
      cachedPanelOpen = window.localStorage.getItem(PANEL_KEY) === "1";
    } catch {
      // A blocked localStorage (private mode, strict cookie policy) is not a
      // reason to fail the page — the panel simply starts closed.
      cachedPanelOpen = false;
    }
  }
  return cachedPanelOpen;
}

export function TutorShell({
  session,
  sessions,
  activeSession,
}: {
  session: SessionPayload;
  sessions: RingkasanTutorSession[];
  activeSession: TutorSession | null;
}) {
  // The rail is pinned state; the drawer's opening is a *persisted* value, so
  // it is read through `useSyncExternalStore` rather than set in an effect —
  // a setState-in-effect would cascade a second render and trip React 19's
  // lint, and reading localStorage during render would mismatch SSR.
  const [railExpanded, setRailExpanded] = useState(false);
  const [activityOverridden, setActivityOverridden] = useState<boolean | null>(null);
  const storedPanelOpen = useSyncExternalStore(
    subscribeToNothing,
    getPanelSnapshot,
    getPanelServerSnapshot,
  );
  const activityOpen = activityOverridden ?? storedPanelOpen;

  const setActivityOpen = useCallback((next: boolean | ((open: boolean) => boolean)) => {
    setActivityOverridden((current) => {
      const base = current ?? getPanelSnapshot();
      return typeof next === "function" ? next(base) : next;
    });
  }, []);

  // Persist every explicit change. The drawer writes its own preference too, so
  // the two agree whichever side the user toggles from.
  useEffect(() => {
    if (activityOverridden === null || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PANEL_KEY, activityOverridden ? "1" : "0");
      cachedPanelOpen = activityOverridden;
    } catch {
      // Preference is a nicety; failing to store it is not worth breaking the UI.
    }
  }, [activityOverridden]);

  return (
    <div className="relative flex h-dvh overflow-hidden bg-background text-foreground">
      <TutorRail
        session={session}
        sessions={sessions}
        activeSessionId={activeSession?.id ?? null}
        expanded={railExpanded}
        onExpandedChange={setRailExpanded}
      />

      {/* The drawer is absolutely positioned, so without this the centre
          column would sit underneath it. Reserving the drawer's width on wide
          screens pushes the transcript aside rather than covering it (the
          DeepTutor `chat-preview-shell` behaviour); below `lg` the drawer
          overlays instead, because a 340px panel beside a 390px screen would
          leave nothing readable.

          `max-md:pl-[60px]` earns its place for the same reason. The rail also
          goes `absolute` below `md` (a 220px column cannot push a 390px
          screen), which takes it out of the flex row and leaves the centre
          column running underneath it. Without this inset the resting 60px
          rail sat on top of the transcript's first 36px and the composer's
          first 35px at 390px wide — measured, not eyeballed. An *expanded*
          rail needs no inset of its own: it drops a full-screen scrim, so it is
          modal and covering the transcript is the point. */}
      <div
        data-tutor-center="true"
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200",
          "max-md:pl-[60px]",
          activityOpen && "lg:pr-[340px]",
        )}
      >
        <TutorColumn
          activeSession={activeSession}
          activityOpen={activityOpen}
          onToggleActivity={() => setActivityOpen((open) => !open)}
        />
      </div>

      <TutorActivity open={activityOpen} activeSession={activeSession} onClose={() => setActivityOpen(false)} />
    </div>
  );
}
