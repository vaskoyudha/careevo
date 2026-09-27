import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { landingFor } from "@/lib/auth/landing";
import AuthSectionTwo from "@/components/ui/auth-section-2";
import { AuthForm } from "@/components/features/auth/auth-form";

export const metadata: Metadata = {
  title: "Daftar",
  description: "Buat akun Careevo: proses belajar terekam, badge HMAC, dan loker teraudit.",
};

export default async function DaftarPage() {
  // Already signed in? Sending a second registration form is a dead end — go
  // where this account belongs (onboarding if they still need it).
  const session = await getSession();
  if (session) redirect(await landingFor(session.role, session.userId, session.email));

  return (
    <AuthSectionTwo title="Buat akun Careevo">
      <AuthForm mode="daftar" />
    </AuthSectionTwo>
  );
}
