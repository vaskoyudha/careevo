import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { punyaRoleStaff } from "@/lib/auth/authorization";

export default async function VerifikatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/masuk");
  }
  // `roles` dari principal database, bukan field kompatibilitas `role`: layout
  // ini gerbang navigasi, dan memakainya bersama `gateStaff()` berarti
  // aturan staffnya satu definisi, bukan dua.
  if (!session.userId || !punyaRoleStaff(session.roles ?? [])) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
