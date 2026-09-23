import type { Metadata } from "next";
import AuthSectionTwo from "@/components/ui/auth-section-2";
import { AuthForm } from "@/components/features/auth/auth-form";

export const metadata: Metadata = {
  title: "Daftar",
  description: "Buat akun Careevo: proses belajar terekam, badge HMAC, dan loker teraudit.",
};

export default function DaftarPage() {
  return (
    <AuthSectionTwo title="Buat akun Careevo">
      <AuthForm mode="daftar" />
    </AuthSectionTwo>
  );
}
