import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/roles";
import { hasProfile } from "@/lib/onboarding/store";

/**
 * Gate for logged-in learner/dashboard pages.
 *
 * Two checks: a session is required (redirect to /masuk), and — for learners
 * only — a completed onboarding profile is required (redirect to /onboarding).
 * Staff (`verifikator`/`admin`) are exempt; onboarding personalizes learner
 * recommendations they never see.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/masuk");
  }

  if (!isStaffRole(session.role) && !(await hasProfile(session.email))) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
