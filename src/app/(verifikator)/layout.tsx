import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/roles";

export default async function VerifikatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/masuk");
  }
  if (!isStaffRole(session.role)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
