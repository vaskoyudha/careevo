/**
 * Query helper untuk route Explore.
 *
 * Semua halaman listing (/browse, /career-academy, /search, /courses, /degrees)
 * membaca katalog nyata lewat sini, jadi tidak ada halaman yang hanya
 * menampilkan placeholder.
 */

import { PROGRAMS_REGISTRY, type ProgramDetails } from "./catalog-data";
import { PROGRAM_TAXONOMY, SKILL_INDEX } from "./explore-taxonomy";

export type ProgramListItem = {
  slug: string;
  href: string;
  title: string;
  subtitle: string;
  provider: string;
  providerLogo: string;
  bannerGraphic?: string;
  thumbnail?: string;
  type: ProgramDetails["type"];
  category: string;
  subcategory: string;
  level: ProgramDetails["level"];
  durationWeeks: number;
  skills: string[];
  rating: number;
  reviews: string;
  enrolled: string;
};

const slugCache = new Map<string, ProgramDetails>();
const listCache = new Map<string, ProgramListItem[]>();

/** Semua program yang benar-benar ada di registry (tanpa fallback generik). */
export function getAllPrograms(): ProgramDetails[] {
  return Object.values(PROGRAMS_REGISTRY).filter(
    (p) => !p.title.startsWith("Explore comprehensive training"),
  );
}

function toListItem(p: ProgramDetails): ProgramListItem {
  return {
    slug: p.slug,
    href: programHref(p),
    title: p.title,
    subtitle: p.subtitle,
    provider: p.provider,
    providerLogo: p.providerLogo,
    bannerGraphic: p.bannerGraphic,
    thumbnail: p.thumbnail,
    type: p.type,
    category: p.category,
    subcategory: p.subcategory,
    level: p.level,
    durationWeeks: p.durationWeeks,
    skills: p.skills,
    rating: p.rating,
    reviews: p.reviews,
    enrolled: p.enrolled,
  };
}

function cachedList(key: string, build: () => ProgramListItem[]): ProgramListItem[] {
  const hit = listCache.get(key);
  if (hit) return hit;
  const out = build();
  listCache.set(key, out);
  return out;
}

/** URL detail program mengikuti jenisnya, sama seperti Coursera. */
export function programHref(p: ProgramDetails | ProgramListItem): string {
  const isCertificate = p.type === "Professional Certificate";
  return isCertificate
    ? `/professional-certificates/${p.slug}`
    : `/specializations/${p.slug}`;
}

/** Skill hasil taxonomy untuk program (katalog asli + tambahan taksonomi). */
function skillsFor(p: ProgramDetails): string[] {
  const extra = (PROGRAM_TAXONOMY[p.slug] ?? []).flatMap((r) => r.skills ?? []);
  return [...new Set([...p.skills, ...extra])];
}

/* ------------------------------------------------------------------ */
/* /browse/<category>                                                  */
/* ------------------------------------------------------------------ */

const CATEGORY_MATCHERS: Record<string, (p: ProgramDetails) => boolean> = {
  business: (p) => p.category === "Business",
  "data-science": (p) => p.category === "Data Science",
  "information-technology": (p) => p.category === "Information Technology",
  "computer-science": (p) => p.category === "Computer Science",
  // Kategori Coursera yang belum ada isinya. Tetap dibalas, bukan 404,
  // supaya menu Explore tidak pernah mengarahkan ke halaman mati.
  health: (p) => p.skills.some((s) => /health|medical|care/i.test(s)),
  "physical-science-and-engineering": (p) =>
    p.skills.some((s) => /physic|engineer|mechanic|electr/i.test(s)),
  "personal-development": (p) => p.skills.some((s) => /communicat|leadership|productiv/i.test(s)),
  "social-sciences": (p) => p.skills.some((s) => /econom|psycholog|sociolog|market/i.test(s)),
  "language-learning": (p) => p.skills.some((s) => /english|bahasa|linguist/i.test(s)),
  "arts-and-humanities": (p) => p.skills.some((s) => /design|art|music|creativ/i.test(s)),
};

export function getProgramsByCategory(slug: string, topic?: string): ProgramListItem[] {
  return cachedList(`cat:${slug}:${topic ?? ""}`, () => {
    const base = CATEGORY_MATCHERS[slug];
    // Slug yang tidak dikenal = 404 nanti di level route, jadi di sini
    // kembalikan kosong. Jangan sampai jatuh ke "seluruh katalog".
    if (!base) return [];
    const all = getAllPrograms();
    let matched = all.filter(base);
    if (topic) {
      const needle = topic.toLowerCase().replace(/-/g, " ");
      matched = matched.filter(
        (p) =>
          p.skills.some((s) => s.toLowerCase().includes(needle)) ||
          p.title.toLowerCase().includes(needle) ||
          p.subcategory.toLowerCase().includes(needle),
      );
    }
    return matched.map(toListItem);
  });
}

export const ALL_CATEGORY_SLUGS = Object.keys(CATEGORY_MATCHERS);

/* ------------------------------------------------------------------ */
/* /career-academy/roles/<role>                                        */
/* ------------------------------------------------------------------ */

const ROLE_RULES: Record<string, { label: string; skills: string[] }> = {
  "data-analyst": { label: "Data Analyst", skills: ["Data Analysis", "SQL Querying", "Data Visualization"] },
  "project-manager": { label: "Project Manager", skills: ["Project Management", "Agile Methodology", "Risk Management"] },
  "cyber-security-analyst": { label: "Cyber Security Analyst", skills: ["Cybersecurity", "Network Security", "Threat Detection"] },
  "data-scientist": { label: "Data Scientist", skills: ["Machine Learning", "Python", "Statistical Analysis"] },
  "business-intelligence-analyst": { label: "Business Intelligence Analyst", skills: ["Data Dashboards", "SQL", "Reporting"] },
  "digital-marketing-specialist": { label: "Digital Marketing Specialist", skills: ["Marketing", "SEO", "Analytics"] },
  "user-interface-user-experience-ui-ux-designer": { label: "UI / UX Designer", skills: ["UI Design", "UX Research", "Prototyping"] },
  "machine-learning-engineer": { label: "Machine Learning Engineer", skills: ["Machine Learning", "Deep Learning", "Model Deployment"] },
  "social-media-strategist-specialist": { label: "Social Media Specialist", skills: ["Social Media", "Content Strategy", "Community"] },
  "computer-support-specialist": { label: "Computer Support Specialist", skills: ["Technical Support", "Networking", "Troubleshooting"] },
};

export function getRole(slug: string) {
  return ROLE_RULES[slug] ?? null;
}

export function getProgramsByRole(slug: string): ProgramListItem[] {
  const role = getRole(slug);
  if (!role) return [];
  return cachedList(`role:${slug}`, () => {
    const needle = role.skills.map((s) => s.toLowerCase());
    return getAllPrograms()
      .map((p) => {
        const all = skillsFor(p);
        const score = all.reduce(
          (n, s) => n + (needle.some((r) => s.toLowerCase().includes(r)) ? 1 : 0),
          0,
        );
        return { p, all, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => ({ ...toListItem(x.p), skills: x.all }));
  });
}

export const ALL_ROLE_SLUGS = Object.keys(ROLE_RULES);

/* ------------------------------------------------------------------ */
/* /search?productType=...&topic=...                                    */
/* ------------------------------------------------------------------ */

export function getProgramsBySearch(productType?: string, topic?: string): ProgramListItem[] {
  return cachedList(`search:${productType ?? ""}:${topic ?? ""}`, () => {
    let out = getAllPrograms();
    if (productType) {
      const want = productType.toLowerCase();
      out = out.filter((p) => p.type.toLowerCase() === want);
    }
    if (topic) {
      const needle = topic.toLowerCase();
      out = out.filter(
        (p) =>
          p.category.toLowerCase() === needle ||
          p.subcategory.toLowerCase().includes(needle) ||
          p.skills.some((s) => s.toLowerCase().includes(needle)),
      );
    }
    return out.map(toListItem);
  });
}

/* ------------------------------------------------------------------ */
/* /courses?query=<skill>                                              */
/* ------------------------------------------------------------------ */

export function getProgramsByQuery(query?: string): ProgramListItem[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return getAllPrograms().map(toListItem);
  return cachedList(`q:${q}`, () => {
    const all = getAllPrograms();
    // Jalur eksplisit dulu supaya skill yang punya index tapi tidak cocok
    // regex tetap dapat hasil.
    const indexed = SKILL_INDEX[q] ?? [];
    const scored = all.map((p) => {
      const all2 = skillsFor(p);
      let score = 0;
      if (indexed.includes(p.slug)) score += 5;
      if (p.title.toLowerCase().includes(q)) score += 3;
      if (all2.some((s) => s.toLowerCase().includes(q))) score += 2;
      if (p.subcategory.toLowerCase().includes(q)) score += 1;
      if (p.category.toLowerCase().includes(q)) score += 1;
      return { p, all: all2, score };
    });
    const hit = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    if (hit.length) return hit.map((x) => ({ ...toListItem(x.p), skills: x.all }));
    // Tanpa hasil: tetap tampilkan katalog, jangan halaman kosong.
    return all.map(toListItem);
  });
}

/* ------------------------------------------------------------------ */
/* /explore/certification-preparation-courses                           */
/* ------------------------------------------------------------------ */

export function getCertificationPrep(): ProgramListItem[] {
  return cachedList("certprep", () =>
    getAllPrograms()
      .filter((p) => p.skills.some((s) => /certif|exam|compliance|security/i.test(s)))
      .map(toListItem),
  );
}

/** Sinkronkan cache (dipakai test). */
export function __clearExploreCache(): void {
  slugCache.clear();
  listCache.clear();
}
