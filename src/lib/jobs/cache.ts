import { jobs, type JobFixture } from "@/lib/fixtures";

export async function ambilLokerDariCache(): Promise<JobFixture[]> {
  return jobs;
}

export async function ambilLokerTampil(): Promise<JobFixture[]> {
  return jobs.filter((job) => job.sentinel_status !== "rejected");
}

export async function ambilLokerById(id: string): Promise<JobFixture | undefined> {
  return jobs.find((job) => job.id === id);
}
