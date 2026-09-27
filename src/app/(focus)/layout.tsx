import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasProfile } from "@/lib/onboarding/store";

/**
 * Gate for focus-mode (challenge) pages — learner-only.
 * Same rule as `(app)`: session required, plus a completed onboarding profile.
 */
export default async function FocusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/masuk");
  }

  if (!(await hasProfile(session.userId, session.email))) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
