import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { listRingkasanTutorSessions } from "@/lib/tutor/session-store";
import { TutorShell } from "@/components/features/tutor/tutor-shell";

export const metadata: Metadata = { title: "Tutor" };

/**
 * Entry to the tutor workspace.
 *
 * No `:sessionId` segment here — this is the "pick or start a conversation"
 * screen, matching DeepTutor's `/chat` (rail + list, no transcript) before the
 * first send navigates to `/chat/<id>`. The `(focus)` layout owns the auth and
 * profile gate; the page re-reads the session because the layout only
 * redirects and the shell needs the user's name for the rail.
 */
export default async function TutorIndexPage() {
  const session = await getSession();
  if (!session) return null;

  const sessions = await listRingkasanTutorSessions(session.email);

  return <TutorShell session={session} sessions={sessions} activeSession={null} />;
}
