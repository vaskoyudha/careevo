import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function FocusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/masuk");
  }

  return <>{children}</>;
}
