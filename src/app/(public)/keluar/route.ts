import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth/session";
import { clearProfile } from "@/lib/onboarding/store";

/**
 * GET /keluar — full sign-out.
 *
 * Clears both httpOnly cookies (`ls_session` and `ls_profile`) and bounces to
 * the login page. Being a plain GET means you can just open the URL in a
 * browser tab to reset your state — no form or console needed (the cookies are
 * httpOnly, so client-side JS can't clear them).
 *
 * `?keepProfile=1` keeps the onboarding profile and only drops the session.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const keepProfile = url.searchParams.get("keepProfile") === "1";

  await destroySession();
  if (!keepProfile) {
    await clearProfile();
  }

  redirect("/masuk");
}
