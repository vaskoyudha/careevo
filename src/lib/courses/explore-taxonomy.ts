/**
 * Taksonomi Explore untuk Careevo.
 *
 * Struktur URL mengikuti Coursera (yang jadi acuan clone Explore menu):
 *   /career-academy/roles/<role>        ->Explore roles
 *   /browse/<category>                 ->Explore categories
 *   /search?productType=...&topic=...   ->Sertifikat profesional
 *   /degrees/...                       ->Jenjang pendidikan
 *   /courses?query=<skill>             ->Skill yang lagi naik
 *   /explore/certification-preparation-courses
 *
 * Semua label user-facing mengikuti aturan repo: bahasa Indonesia.
 */

export type ItemType = "Specialization" | "Professional Certificate";

export interface ExploreItem {
  label: string;
  href: string;
  /** Skill kunci untuk dipoles ke kartu detail. */
  skills?: string[];
  /** Kategori induk, dipakai untuk pengelompokan di halaman browse. */
  category?: string;
}

export interface ExploreGroup {
  title: string;
  /** true = grup ini punya "View all" sendiri. */
  viewAll?: string;
  items: ExploreItem[];
}

/* ------------------------------------------------------------------ */
/* 1. Explore roles -> /career-academy/roles/<slug>                    */
/* ------------------------------------------------------------------ */

export const ROLES: ExploreItem[] = [
  { label: "Data Analyst", href: "/career-academy/roles/data-analyst" },
  { label: "Project Manager", href: "/career-academy/roles/project-manager" },
  { label: "Cyber Security Analyst", href: "/career-academy/roles/cyber-security-analyst" },
  { label: "Data Scientist", href: "/career-academy/roles/data-scientist" },
  { label: "Business Intelligence Analyst", href: "/career-academy/roles/business-intelligence-analyst" },
  { label: "Digital Marketing Specialist", href: "/career-academy/roles/digital-marketing-specialist" },
  { label: "UI / UX Designer", href: "/career-academy/roles/user-interface-user-experience-ui-ux-designer" },
  { label: "Machine Learning Engineer", href: "/career-academy/roles/machine-learning-engineer" },
  { label: "Social Media Specialist", href: "/career-academy/roles/social-media-strategist-specialist" },
  { label: "Computer Support Specialist", href: "/career-academy/roles/computer-support-specialist" },
];

/* ------------------------------------------------------------------ */
/* 2. Explore categories -> /browse/<slug>                             */
/* ------------------------------------------------------------------ */

/** Kategori yang benar-benar ada isinya di katalog. */
export const CATEGORIES: ExploreItem[] = [
  { label: "Artificial Intelligence", href: "/browse/computer-science?topic=artificial-intelligence" },
  { label: "Business", href: "/browse/business" },
  { label: "Data Science", href: "/browse/data-science" },
  { label: "Information Technology", href: "/browse/information-technology" },
  { label: "Computer Science", href: "/browse/computer-science" },
  { label: "Healthcare", href: "/browse/health" },
  { label: "Physical Science and Engineering", href: "/browse/physical-science-and-engineering" },
  { label: "Personal Development", href: "/browse/personal-development" },
  { label: "Social Sciences", href: "/browse/social-sciences" },
  { label: "Language Learning", href: "/browse/language-learning" },
  { label: "Arts and Humanities", href: "/browse/arts-and-humanities" },
];

/* ------------------------------------------------------------------ */
/* 3. Sertifikat profesional -> /search?productType=...               */
/* ------------------------------------------------------------------ */

export const CERTIFICATES: ExploreItem[] = [
  { label: "Business", href: "/search?productType=Professional+Certificate&topic=Business" },
  { label: "Computer Science", href: "/search?productType=Professional+Certificate&topic=Computer+Science" },
  { label: "Data Science", href: "/search?productType=Professional+Certificate&topic=Data+Science" },
  { label: "Information Technology", href: "/search?productType=Professional+Certificate&topic=Information+Technology" },
];

/* ------------------------------------------------------------------ */
/* 4. Jenjang pendidikan -> /degrees/...                               */
/* ------------------------------------------------------------------ */

export const DEGREES: ExploreItem[] = [
  { label: "Sarjana (S1)", href: "/degrees/bachelors" },
  { label: "Magister (S2)", href: "/degrees/masters" },
  // Slug harus `university-certificates`, mengikuti `LEVELS` di
  // `/degrees/page.tsx`. Sebelumnya `/certificates/learn` — route itu
  // tidak pernah ada, jadi tautan ini 404 dari dalam menu navbar.
  { label: "Sertifikat universitas", href: "/degrees/university-certificates" },
];

/* ------------------------------------------------------------------ */
/* 5. Skill yang lagi naik -> /courses?query=<skill>                  */
/* ------------------------------------------------------------------ */

export const TRENDING_SKILLS: ExploreItem[] = [
  { label: "Python", href: "/courses?query=python" },
  { label: "Artificial Intelligence", href: "/courses?query=artificial+intelligence" },
  { label: "Excel", href: "/courses?query=excel" },
  { label: "Machine Learning", href: "/courses?query=machine+learning" },
  { label: "SQL", href: "/courses?query=sql" },
  { label: "Project Management", href: "/courses?query=project+management" },
  { label: "Power BI", href: "/courses?query=power+bi" },
  { label: "Marketing", href: "/courses?query=marketing" },
];

/** Dipakai untuk "Persiapan ujian sertifikasi" di kolom 4. */
export const CERTIFICATION_PREP_VIEW_ALL = "/explore/certification-preparation-courses";

/** Pengantar di panel Explore. */
export const EXPLORE_FALLBACKS = {
  browseAll: "/browse",
  viewAllRoles: "/career-academy",
  /**
   * BELUM BOLEH dipakai sebagai ajakan di UI.
   *
   * `ProgramDetails` tidak punya field harga sama sekali, jadi "gratis"
   * tidak bisa dijawab dari katalog. `getProgramsByQuery("free")` tidak
   * cocok dengan apa pun lalu jatuh ke fallback "tampilkan seluruh
   * katalog" (lihat `explore-queries.ts`) — jadi tautan ini akan
   * menampilkan keenam program seolah-olah gratis, termasuk yang
   * berbayar. Itu janji yang tidak bisa ditepati, jadi menu Explore
   * tidak memakainya. Hapus begitu `price` masuk ke registry.
   */
  freeCourses: "/courses?query=free",
} as const;

export const EXPLORE_GROUPS: ExploreGroup[] = [
  { title: "Explore roles", viewAll: EXPLORE_FALLBACKS.viewAllRoles, items: ROLES },
  { title: "Explore categories", viewAll: EXPLORE_FALLBACKS.browseAll, items: CATEGORIES },
  { title: "Earn a Professional Certificate", viewAll: "/search?productType=Professional+Certificate", items: CERTIFICATES },
  { title: "Earn an online degree", viewAll: "/degrees", items: DEGREES },
  { title: "Explore trending skills", items: TRENDING_SKILLS },
  { title: "Prepare for a certification exam", viewAll: CERTIFICATION_PREP_VIEW_ALL, items: [] },
];

/* ------------------------------------------------------------------ */
/* Pencarian program dari katalog nyata                                */
/* ------------------------------------------------------------------ */

export interface TaxonomyRule {
  /** Cocok kalau nama program mengandung salah satu kata ini. */
  match: RegExp;
  category?: string;
  skills?: string[];
}

/**
 * Setiap program di katalog dipetakan ke kategori + skill supaya halaman
 * /browse dan /career-academy benar-benar punya isi, bukan cuma placeholder.
 */
export const PROGRAM_TAXONOMY: Record<string, TaxonomyRule[]> = {
  "complete-claude-code-claude-cowork-masterclass": [
    { match: /claude|agent|workflow|automation/i, category: "Computer Science", skills: ["Generative AI", "Agentic Workflows", "Software Engineering"] },
    { match: /office|excel|presentation|productivity/i, category: "Business", skills: ["Financial Modeling", "Data Visualization", "Email Automation"] },
  ],
  "google-project-management": [
    { match: /project|scrum|agile|backlog/i, category: "Business", skills: ["Project Planning", "Agile Methodology", "Risk Management"] },
  ],
  "google-data-analytics": [
    { match: /data|sql|spreadsheet|visual/i, category: "Data Science", skills: ["Data Cleaning", "SQL Querying", "Data Visualization"] },
  ],
  "google-cybersecurity": [
    { match: /cyber|security|threat|network|packet/i, category: "Information Technology", skills: ["Network Security", "Threat Detection", "Linux CLI"] },
  ],
  "ibm-data-analyst": [
    { match: /data|sql|analyst|predictive/i, category: "Data Science", skills: ["SQL Querying", "Python Data Analysis", "Data Dashboards"] },
  ],
  "machine-learning-introduction": [
    { match: /machine|learning|model|neural|recommender/i, category: "Data Science", skills: ["Machine Learning", "Model Evaluation", "Neural Networks"] },
  ],
};

/** Skill yang punya program di katalog (dipakai halaman /courses?query=). */
export const SKILL_INDEX: Record<string, string[]> = {
  python: ["google-data-analytics", "ibm-data-analyst", "machine-learning-introduction"],
  "artificial intelligence": ["complete-claude-code-claude-cowork-masterclass", "machine-learning-introduction"],
  excel: ["google-project-management", "google-data-analytics", "ibm-data-analyst"],
  "machine learning": ["machine-learning-introduction", "ibm-data-analyst"],
  sql: ["google-data-analytics", "ibm-data-analyst", "google-cybersecurity"],
  "project management": ["google-project-management", "complete-claude-code-claude-cowork-masterclass"],
  "power bi": ["google-data-analytics", "ibm-data-analyst"],
  marketing: ["google-project-management"],
  free: [],
};
