import { katalogBelajar, type EntriKatalog } from "@/lib/courses/katalog";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { modulKursus, type ModulKursus } from "@/lib/courses/kurikulum";
import { getProfile } from "@/lib/onboarding/store";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import type { StudyChatMessage } from "@/lib/learning/chat-types";
import type { StudyPromptInput } from "@/lib/agents/study-chat/schema";

/**
 * The learner's path, as the tutor prompt sees it — **server-only**.
 *
 * The tutor has two surfaces: the inline `StudyChat` card on `/belajar/jalur`
 * and the `/belajar/tutor` workspace, and both anchor the agent to the same
 * thing — this learner's profile, current course and current module. That anchor
 * used to be written out twice, once per server action, and two copies of a
 * rule drift silently: nothing fails when they differ, the tutor just quietly
 * stops knowing what the learner is doing. So it is written once, here.
 *
 * Server-only by construction. `getProfile` reads `next/headers` and
 * `katalogBelajar` reaches the `data/courses.json` store, so this module must
 * never be imported by a client component. There is no `server-only` package in
 * this repo to enforce that, which is why the constraint is documented rather
 * than asserted — the same arrangement `src/lib/courses/modul-resolver.ts`
 * documents, and the build is what catches a violation.
 */

export type PathContext = {
  readonly profile: StudyPromptInput["profile"];
  readonly catalog: EntriKatalog[];
  readonly course: EntriKatalog | null;
  readonly currentModule: ModulKursus | null;
};

/**
 * Resolve a learner's current course and module, or `null` for a profile that
 * is not complete enough to chat. The agent is given nothing it did not earn.
 */
export async function loadPathContext(owner: string): Promise<PathContext | null> {
  const profile = await getProfile(owner);
  if (!profile) return null;

  const catalog = await katalogBelajar();
  const enrollments = await listPendaftaran(owner);
  const path = bangunJalurPersonalisasi({ profile, catalog, enrollments });
  const course = path.course
    ? catalog.find((entry) => entry.id === path.course?.id) ?? null
    : null;
  const currentModuleId =
    path.nextAction?.moduleId ?? path.modules.find((item) => item.status === "current")?.id;
  // Deliberate exception to "never call `modulKursus()` from an action" (see
  // `modul-resolver.ts`): `currentModuleId` was produced by
  // `bangunJalurPersonalisasi`, which builds its path from `modulKursus(course)`
  // as well, so both sides speak the DERIVED ids `<courseId>-m1`..`-m5`. Resolving
  // through `modulUntukSumber` here would answer with STORED modules — different
  // ids once an admin has edited a course — and the lookup would silently miss.
  // That is a new divergence, the exact class the resolver split exists to
  // prevent. Migrating `personalized-path.ts` to the resolver is separate, larger
  // work: it moves module ids, and the ids in real `ls_enroll` cookies with them.
  const currentModule = course && currentModuleId
    ? modulKursus(course).find((item) => item.id === currentModuleId) ?? null
    : null;

  return {
    profile: {
      experience: profile.experience,
      interests: [...profile.interests],
      goal: profile.goal,
      weeklyHours: profile.weeklyHours,
    },
    catalog,
    course,
    currentModule,
  };
}

/**
 * Turn a path context plus a transcript into the agent's prompt.
 *
 * The transcript arrives as `messages` rather than as a store snapshot so each
 * surface can hand over the one it actually holds: the cookie card's
 * `StudyChatMessage[]` as-is, the workspace's own list once mapped onto the
 * shared shape. The module and course are included only when the path produced
 * them, so a course-less learner is never given invented course context.
 */
export function promptInputFor(
  context: PathContext,
  messages: readonly StudyChatMessage[],
): StudyPromptInput {
  return {
    profile: context.profile,
    ...(context.course
      ? {
          course: {
            id: context.course.id,
            slug: context.course.slug,
            title: context.course.title,
            tags: [...context.course.tags],
            level: context.course.level,
          },
        }
      : {}),
    ...(context.currentModule
      ? { module: { id: context.currentModule.id, title: context.currentModule.judul } }
      : {}),
    messages,
  };
}
