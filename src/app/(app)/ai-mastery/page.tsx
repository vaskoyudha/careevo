import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LearnerShell } from "@/components/ui/learner-shell";
import { AiMasteryNavbar } from "@/components/ui/ai-mastery-navbar";
import { AiMasteryFrame } from "@/components/features/ai-mastery/ai-mastery-frame";
import { AI_MASTERY_WEB_URL } from "@/lib/mode/store";

/**
 * AI Mastery, hosted inside Careevo.
 *
 * Careevo keeps the URL, the session gate and the frame; the framed app keeps
 * its own navbar, so this page supplies its own too — a dark winged bar rather
 * than the light glass chrome, because the frame below is a full-bleed
 * application. See `ai-mastery-navbar.tsx` and `ai-mastery-frame.tsx`.
 *
 * Renamed from `/sijago`: the product's user-facing name is AI Mastery. The
 * vendored tree keeps its `features/sijago/` path, which is a checkout
 * location rather than a brand.
 */
export const metadata = {
  title: "AI Mastery — Careevo",
  description: "AI Mastery: tutor, buku, membaca, dan latihan.",
};

export default async function AiMasteryPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; capability?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/masuk");

  const { course, capability } = await searchParams;

  // Kontrak deep-link dari halaman kursus (lihat `kursus-ai-panel.tsx`):
  // `/ai-mastery?course=<id>&capability=course_study`. Query ini hanyalah
  // petunjuk untuk aplikasi AI Mastery — nilai asli diteruskan ke dalam frame
  // supaya aplikasi itu sendiri yang memvalidasi kursusnya. Id yang tidak
  // dikenalnya jatuh ke chat biasa, jadi deep-link ini tidak pernah memaksa
  // halaman rusak.
  const frameQuery = new URLSearchParams();
  if (course) frameQuery.set("course", course);
  if (capability) frameQuery.set("capability", capability);
  const src = frameQuery.size
    ? `${AI_MASTERY_WEB_URL}?${frameQuery.toString()}`
    : AI_MASTERY_WEB_URL;

  return (
    <LearnerShell
      session={session}
      showFooter={false}
      shellClassName="ai-mastery-shell"
      chrome={<AiMasteryNavbar session={session} />}
    >
      <AiMasteryFrame src={src} title="AI Mastery" />
    </LearnerShell>
  );
}
