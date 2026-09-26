import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LearnerShell } from "@/components/ui/learner-shell";
import { SiJagoFrame } from "@/components/features/sijago/sijago-frame";
import { SIJAGO_WEB_URL } from "@/lib/mode/store";

/**
 * SiJago, hosted inside Careevo.
 *
 * Careevo keeps the URL, the navbar and the session gate; the frame loads the
 * app from its own origin. Deliberate — see `siJago-frame.tsx` for why the
 * boundary is a document rather than a module, and
 * `features/sijago/README.md` for how the app is vendored and run.
 */
export const metadata = {
  title: "SiJago — Careevo",
  description: "SiJago: tutor, buku, membaca, dan latihan.",
};

export default async function SiJagoPage() {
  const session = await getSession();
  if (!session) redirect("/masuk");

  return (
    <LearnerShell session={session}>
      <SiJagoFrame src={SIJAGO_WEB_URL} title="SiJago" />
    </LearnerShell>
  );
}
