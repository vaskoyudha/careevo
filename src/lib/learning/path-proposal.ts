import type { EntriKatalog } from "@/lib/courses/katalog";
import { modulKursus } from "@/lib/courses/kurikulum";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { StudyPathProposal } from "./chat-types";

export type StudyPathProposalValidation =
  | {
      readonly valid: true;
      readonly course: EntriKatalog;
      readonly modules: ModulKursus[];
    }
  | {
      readonly valid: false;
      readonly reason: "unknown_course" | "unknown_module" | "empty_path";
    };

export function validateStudyPathProposal(
  proposal: StudyPathProposal,
  catalog: EntriKatalog[],
): StudyPathProposalValidation {
  const course = catalog.find((entry) => entry.id === proposal.courseId);
  if (!course) return { valid: false, reason: "unknown_course" };
  if (proposal.moduleIds.length === 0) return { valid: false, reason: "empty_path" };

  const curriculum = modulKursus(course);
  const proposedIds = new Set(proposal.moduleIds);
  const curriculumIds = new Set(curriculum.map((module) => module.id));

  for (const moduleId of proposedIds) {
    if (!curriculumIds.has(moduleId)) return { valid: false, reason: "unknown_module" };
  }

  return {
    valid: true,
    course,
    modules: curriculum.filter((module) => proposedIds.has(module.id)),
  };
}
