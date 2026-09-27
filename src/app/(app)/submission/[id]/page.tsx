import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ambilKaryaPrincipal } from "@/lib/review/service";
import { cariEntriById } from "@/lib/courses/katalog";

/**
 * Rute lama `/submission/[id]` — detail submission kini di dalam course
 * (`/belajar/[slug]/karya/[id]`). Redirect ke rumah barunya bila submission
 * milik principal dan terikat course; selain itu ke `/progres`.
 */
export default async function SubmissionDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) redirect("/progres");

  const { id } = await params;
  const submission = await ambilKaryaPrincipal(session, id);
  if (!submission?.courseId) redirect("/progres");

  const entri = await cariEntriById(submission.courseId);
  redirect(entri ? `/belajar/${entri.slug}/karya/${submission.id}` : "/progres");
}
