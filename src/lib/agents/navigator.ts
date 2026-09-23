import { tasks, type TaskFixture } from "@/lib/fixtures";

export interface NavigatorInput {
  scoreJadwal: number;
  scoreKarya: number;
  scoreValidasi: number;
  completedTaskIds: string[];
  trendingTags: string[];
}

export interface NavigatorRecommendation {
  task_id: string;
  reason: string;
}

export interface NavigatorOutput {
  recommendations: NavigatorRecommendation[];
  usedFallback: boolean;
}

function levelOrder(level: TaskFixture["level"]): number {
  return level === "dasar" ? 0 : level === "menengah" ? 1 : 2;
}

export function jalankanNavigator(input: NavigatorInput): NavigatorOutput {
  const completed = new Set(input.completedTaskIds);

  const openTasks = tasks.filter(
    (task) => !completed.has(task.id) && !task.requires,
  );

  const weakComponent =
    input.scoreJadwal <= input.scoreKarya && input.scoreJadwal <= input.scoreValidasi
      ? "kepatuhan jadwal"
      : input.scoreKarya <= input.scoreValidasi
        ? "kualitas karya"
        : "validasi";

  const recommendations = openTasks
    .slice()
    .sort((a, b) => levelOrder(a.level) - levelOrder(b.level))
    .slice(0, 3)
    .map((task) => ({
      task_id: task.id,
      reason: `Level ${task.level}, estimasi ${task.estimate_min} menit. Prioritaskan untuk menutup gap ${weakComponent}. Tren loker: ${
        input.trendingTags.slice(0, 3).join(", ") || "belum tersedia"
      }.`,
    }));

  return { recommendations, usedFallback: true };
}
