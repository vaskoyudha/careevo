import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { landingFor } from "@/lib/auth/landing";
import { demoAccountsAllowed } from "@/lib/config/environment";
import AuthSectionTwo from "@/components/ui/auth-section-2";
import { AuthForm } from "@/components/features/auth/auth-form";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/auth/demo-accounts";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke akun Careevo untuk melanjutkan course, submission, dan job seeking.",
};

export default async function MasukPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  // Already signed in? No reason to show the login form again.
  const session = await getSession();
  if (session) redirect(await landingFor(session.role, session.userId, session.email));

  // Demo credentials are shown only on a development machine that opted in
  // with `DEMO_MODE=1`; the accounts are also rejected by `authenticate`
  // everywhere else, so printing the password would only mislead visitors.
  if (!demoAccountsAllowed()) {
    return (
      <AuthSectionTwo title="Masuk ke akun Careevo">
        <AuthForm mode="masuk" />
      </AuthSectionTwo>
    );
  }

  const { email } = await searchParams;
  const prefill = DEMO_ACCOUNTS.some((account) => account.email === email) ? email : undefined;

  return (
    <AuthSectionTwo title="Masuk ke akun Careevo">
      <AuthForm
        mode="masuk"
        defaultEmail={prefill}
        defaultPassword={prefill ? DEMO_PASSWORD : undefined}
      />
      <p className="mt-6 mb-0 text-center text-xs leading-5 text-black/45">
        Akun demo: {DEMO_ACCOUNTS.map((account) => account.email).join(" · ")}, password{" "}
        <span className="font-mono text-black/65">{DEMO_PASSWORD}</span>
      </p>
    </AuthSectionTwo>
  );
}
