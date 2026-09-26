import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTutorSession, listRingkasanTutorSessions } from "@/lib/tutor/session-store";
import { isValidSessionId } from "@/lib/tutor/ids";
import { TutorShell } from "@/components/features/tutor/tutor-shell";

export const metadata: Metadata = { title: "Tutor" };

/**
 * One conversation in the tutor workspace.
 *
 * A session id that is well-formed but absent, or present under a different
 * owner, is a 404 — never a leak of "this id exists but is not yours".
 */
export default async function TutorSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { sessionId } = await params;
  if (!isValidSessionId(sessionId)) notFound();

  const [active, sessions] = await Promise.all([
    getTutorSession(session.email, sessionId),
    listRingkasanTutorSessions(session.email),
  ]);

  if (!active) notFound();

  return <TutorShell session={session} sessions={sessions} activeSession={active} />;
}
