import { describe, expect, it } from "vitest";
import { ambilRekomendasiLoker } from "@/lib/jobs/rekomendasi-inbox";
import type { InboxJob } from "@/lib/career-ops";
import type { OnboardingProfile } from "@/lib/onboarding/types";

function mockJob(over: Partial<InboxJob> = {}): InboxJob {
  return {
    url: "https://example.com/job/1",
    company: "PT Digital Nusantara",
    role: "Frontend Engineer React",
    location: "Jakarta",
    done: false,
    ...over,
  };
}

const mockProfile: OnboardingProfile = {
  owner: "user@careevo.test",
  experience: "pemula",
  background: "mahasiswa",
  interests: ["web-dev", "data"],
  goal: "kerja",
  weeklyHours: 15,
  workPreference: "fleksibel",
  completedAt: "2026-09-01T00:00:00.000Z",
  version: 1,
};

describe("ambilRekomendasiLoker", () => {
  it("merekomendasikan loker yang sesuai dengan minat profil", () => {
    const jobs = [
      mockJob({ url: "1", role: "Frontend Engineer React", company: "Company A" }),
      mockJob({ url: "2", role: "Data Analyst SQL", company: "Company B" }),
      mockJob({ url: "3", role: "Unrelated Chef Position", company: "Company C" }),
    ];

    const { rekomendasi, labelMinat } = ambilRekomendasiLoker(jobs, mockProfile, 2);
    expect(rekomendasi).toHaveLength(2);
    expect(rekomendasi[0].job.role).toMatch(/Frontend|Data/);
    expect(rekomendasi[0].persentaseCocok).toBeGreaterThanOrEqual(86);
    expect(labelMinat).toContain("Web Development");
  });

  it("bekerja dengan aman saat profil null", () => {
    const jobs = [
      mockJob({ url: "1", role: "Frontend Developer" }),
      mockJob({ url: "2", role: "Backend Developer" }),
    ];

    const { rekomendasi } = ambilRekomendasiLoker(jobs, null, 2);
    expect(rekomendasi.length).toBeGreaterThan(0);
  });
});
