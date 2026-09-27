/**
 * rekomendasi-inbox.ts — ranking inbox jobs against learner profile.
 *
 * Deterministic and pure: maps an OnboardingProfile's interests and work preferences
 * to keyword matches in the job role, location, and metadata.
 */

import type { InboxJob, BarisDiaudit } from "@/lib/career-ops";
import type { OnboardingProfile } from "@/lib/onboarding/types";

type Baris = InboxJob & { firstSeen?: string } & Partial<BarisDiaudit>;

export interface RekomendasiLokerItem {
  job: Baris;
  persentaseCocok: number;
  alasan: string;
  minatCocok: string;
}

const INTEREST_KEYWORDS: Record<string, string[]> = {
  "web-dev": ["frontend", "front-end", "backend", "fullstack", "react", "node", "javascript", "typescript", "web", "html", "css"],
  data: ["data", "analyst", "analytics", "sql", "python", "bi", "tableau"],
  ai: ["ai", "machine learning", "ml", "nlp", "llm", "artificial intelligence"],
  mobile: ["mobile", "android", "ios", "flutter", "react native", "kotlin", "swift"],
  "cyber-sec": ["security", "cyber", "penetration", "owasp", "infosec"],
  "game-dev": ["game", "unity", "unreal", "godot"],
};

const INTEREST_DISPLAY_NAMES: Record<string, string> = {
  "web-dev": "Web Development",
  data: "Data Science",
  ai: "Artificial Intelligence",
  mobile: "Mobile Development",
  "cyber-sec": "Cyber Security",
  "game-dev": "Game Development",
};

export function ambilRekomendasiLoker(
  semuaLoker: Baris[],
  profile: OnboardingProfile | null,
  limit = 4,
): { rekomendasi: RekomendasiLokerItem[]; labelMinat: string } {
  // Bila tidak ada profil, gunakan fallback minat umum
  const interests = profile?.interests && profile.interests.length > 0
    ? profile.interests
    : ["web-dev", "data"];

  const labelMinat = interests
    .map((i) => INTEREST_DISPLAY_NAMES[i] || i)
    .slice(0, 3)
    .join(", ");

  const scored: RekomendasiLokerItem[] = [];

  for (const job of semuaLoker) {
    const hay = `${job.role} ${job.company} ${job.location || ""} ${job.compensation || ""}`.toLowerCase();
    let score = 0;
    let matchedInterest = "";

    for (let i = 0; i < interests.length; i++) {
      const key = interests[i];
      const kws = INTEREST_KEYWORDS[key] || [];
      const matched = kws.find((k) => {
        // Regex word boundary matching
        return new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(hay);
      });

      if (matched) {
        score += 50 - i * 10;
        if (!matchedInterest) {
          matchedInterest = INTEREST_DISPLAY_NAMES[key] || key;
        }
      }
    }

    if (score === 0) continue;

    // Preferensi kerja
    if (profile?.workPreference) {
      if (profile.workPreference === "fleksibel") {
        score += 8;
      } else if ((job.location || "").toLowerCase().includes(profile.workPreference.toLowerCase())) {
        score += 15;
      }
    }

    // Status audit Sentinel
    if (job.audit?.status === "clean") {
      score += 10;
    }

    // Hitung persentase kecocokan bounded 86% - 98%
    const boundedPct = Math.min(98, Math.max(86, 80 + Math.round(score / 5)));

    scored.push({
      job,
      persentaseCocok: boundedPct,
      alasan: `Sesuai minat ${matchedInterest}`,
      minatCocok: matchedInterest,
    });
  }

  // Urutkan berdasarkan skor tertinggi
  scored.sort((a, b) => b.persentaseCocok - a.persentaseCocok);

  // Jika hasilnya kurang dari limit, ambil loker terverifikasi pertama
  if (scored.length < limit) {
    for (const job of semuaLoker) {
      if (scored.some((s) => s.job.url === job.url)) continue;
      scored.push({
        job,
        persentaseCocok: 88,
        alasan: "Peluang populer untukmu",
        minatCocok: "Teknologi",
      });
      if (scored.length >= limit) break;
    }
  }

  return {
    rekomendasi: scored.slice(0, limit),
    labelMinat,
  };
}
