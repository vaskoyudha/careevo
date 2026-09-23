import type { Course, CourseStats, CreateCourseInput, UpdateCourseInput } from "@/types/course";

export const INITIAL_COURSES: Course[] = [
  {
    id: "crs-1",
    title: "Fullstack Web Development: Next.js 15 & React 19",
    slug: "fullstack-web-development-nextjs-15-react-19",
    description:
      "Pelajari arsitektur Next.js 15 App Router, Server Actions, React 19 hooks terbaru, dan integrasi Tailwind CSS v4 dari pondasi dasar hingga deployment.",
    provider: "Careevo Academy",
    type: "course",
    track: "web-dev",
    level: "dasar",
    tags: ["Next.js", "React", "TypeScript", "Tailwind"],
    url: "https://nextjs.org/docs",
    duration_min: 180,
    is_free: true,
    price: 0,
    status: "published",
    enrolled_count: 420,
    rating: 4.9,
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-01T08:00:00.000Z",
  },
  {
    id: "crs-2",
    title: "Membangun REST API Modern dengan Node.js",
    slug: "membangun-rest-api-modern-dengan-nodejs",
    description:
      "Panduan komprehensif merancang RESTful API yang aman, modular, dan teruji menggunakan Node.js, Express, validasi Zod, dan token HMAC.",
    provider: "Careevo Academy",
    type: "course",
    track: "web-dev",
    level: "menengah",
    tags: ["Node.js", "Express", "REST API", "Backend"],
    url: "https://nodejs.org/id/learn",
    duration_min: 240,
    is_free: true,
    price: 0,
    status: "published",
    enrolled_count: 285,
    rating: 4.8,
    created_at: "2026-09-03T10:00:00.000Z",
    updated_at: "2026-09-03T10:00:00.000Z",
  },
  {
    id: "crs-3",
    title: "Web Security & OWASP Top 10 Defense",
    slug: "web-security-owasp-top-10-defense",
    description:
      "Pelajari mitigasi kerentanan web standar OWASP: SQL Injection, XSS, CSRF, IDOR, serta implementasi audit keamanan dan input sanitization.",
    provider: "Careevo Academy",
    type: "course",
    track: "cyber-sec",
    level: "lanjut",
    tags: ["Security", "OWASP", "Auth", "Cryptography"],
    url: "https://owasp.org/www-project-top-ten/",
    duration_min: 150,
    is_free: true,
    price: 0,
    status: "published",
    enrolled_count: 198,
    rating: 4.95,
    created_at: "2026-09-05T09:30:00.000Z",
    updated_at: "2026-09-05T09:30:00.000Z",
  },
  {
    id: "crs-4",
    title: "Dasar Analisis Data & Visualisasi Python",
    slug: "dasar-analisis-data-visualisasi-python",
    description:
      "Kuasai manipulasi dataset dengan Pandas, agregasi numerik dengan NumPy, serta visualisasi data interaktif menggunakan Matplotlib dan Seaborn.",
    provider: "Careevo Academy",
    type: "course",
    track: "data",
    level: "dasar",
    tags: ["Python", "Pandas", "Matplotlib", "Data Analytics"],
    url: "https://pandas.pydata.org/docs/",
    duration_min: 160,
    is_free: true,
    price: 0,
    status: "published",
    enrolled_count: 340,
    rating: 4.75,
    created_at: "2026-09-07T14:00:00.000Z",
    updated_at: "2026-09-07T14:00:00.000Z",
  },
  {
    id: "crs-5",
    title: "Machine Learning & AI Prompt Engineering",
    slug: "machine-learning-ai-prompt-engineering",
    description:
      "Eksplorasi teknik LLM prompting terstruktur, evaluasi output model, pipeline RAG sederhana, dan integrasi API AI modern.",
    provider: "Careevo Academy",
    type: "bootcamp",
    track: "data",
    level: "menengah",
    tags: ["AI", "Machine Learning", "Prompting", "LLM"],
    url: "https://learn.deeplearning.ai",
    duration_min: 210,
    is_free: false,
    price: 249000,
    status: "published",
    enrolled_count: 152,
    rating: 4.9,
    created_at: "2026-09-10T11:00:00.000Z",
    updated_at: "2026-09-10T11:00:00.000Z",
  },
  {
    id: "crs-6",
    title: "Game Development 2D dengan Godot Engine",
    slug: "game-development-2d-dengan-godot-engine",
    description:
      "Membangun mekanika gameplay 2D, sistem fisika, tilemaps, state machine karakter, dan audio menggunakan open-source Godot Engine 4.",
    provider: "Careevo Academy",
    type: "course",
    track: "game-dev",
    level: "dasar",
    tags: ["Godot", "GDScript", "GameDev", "2D"],
    url: "https://docs.godotengine.org",
    duration_min: 190,
    is_free: true,
    price: 0,
    status: "published",
    enrolled_count: 175,
    rating: 4.85,
    created_at: "2026-09-12T13:20:00.000Z",
    updated_at: "2026-09-12T13:20:00.000Z",
  },
  {
    id: "crs-7",
    title: "Automated Testing: Vitest & Playwright E2E",
    slug: "automated-testing-vitest-playwright-e2e",
    description:
      "Strategi testing modern: unit testing cepat dengan Vitest, end-to-end browser testing dengan Playwright, dan continuous integration pipeline.",
    provider: "Careevo Academy",
    type: "course",
    track: "web-dev",
    level: "menengah",
    tags: ["Testing", "Vitest", "Playwright", "CI/CD"],
    url: "https://vitest.dev",
    duration_min: 120,
    is_free: true,
    price: 0,
    status: "published",
    enrolled_count: 210,
    rating: 4.88,
    created_at: "2026-09-15T08:15:00.000Z",
    updated_at: "2026-09-15T08:15:00.000Z",
  },
  {
    id: "crs-8",
    title: "Implementasi Arsitektur HMAC Attestation & Zero-Knowledge",
    slug: "implementasi-arsitektur-hmac-attestation-zero-knowledge",
    description:
      "Rancang verifikasi kredensial kriptografis tanpa database terpusat menggunakan signature HMAC-SHA256 kanonikal dan audit log anti-tamper.",
    provider: "Careevo Academy",
    type: "course",
    track: "cyber-sec",
    level: "lanjut",
    tags: ["Cryptography", "HMAC", "Verification", "NextGen Secure"],
    url: "https://careevo.test",
    duration_min: 140,
    is_free: true,
    price: 0,
    status: "draft",
    enrolled_count: 45,
    rating: 5.0,
    created_at: "2026-09-20T16:00:00.000Z",
    updated_at: "2026-09-20T16:00:00.000Z",
  },
];

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// In-process memory store for fast, deterministic runtime execution
let coursesState: Course[] = [...INITIAL_COURSES];

export interface CourseFilter {
  track?: string;
  level?: string;
  status?: string;
  type?: string;
  search?: string;
}

export async function listCourses(filter?: CourseFilter): Promise<Course[]> {
  let result = [...coursesState];

  if (!filter) return result;

  if (filter.track && filter.track !== "semua") {
    result = result.filter((c) => c.track === filter.track);
  }

  if (filter.level && filter.level !== "semua") {
    result = result.filter((c) => c.level === filter.level);
  }

  if (filter.status && filter.status !== "semua") {
    result = result.filter((c) => c.status === filter.status);
  }

  if (filter.type && filter.type !== "semua") {
    result = result.filter((c) => c.type === filter.type);
  }

  if (filter.search && filter.search.trim()) {
    const q = filter.search.toLowerCase().trim();
    result = result.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.provider.toLowerCase().includes(q) ||
        c.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }

  return result;
}

export async function getCourseById(id: string): Promise<Course | undefined> {
  return coursesState.find((c) => c.id === id);
}

export async function getCourseBySlug(slug: string): Promise<Course | undefined> {
  return coursesState.find((c) => c.slug === slug);
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  const now = new Date().toISOString();
  const id = `crs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanSlug = input.slug?.trim() || slugify(input.title);

  // Ensure unique slug
  let uniqueSlug = cleanSlug;
  let counter = 1;
  while (coursesState.some((c) => c.slug === uniqueSlug)) {
    uniqueSlug = `${cleanSlug}-${counter++}`;
  }

  const newCourse: Course = {
    id,
    title: input.title.trim(),
    slug: uniqueSlug,
    description: input.description.trim(),
    provider: input.provider.trim(),
    type: input.type ?? "course",
    track: input.track ?? "web-dev",
    level: input.level ?? "dasar",
    tags: Array.isArray(input.tags) ? input.tags : [],
    url: input.url.trim(),
    duration_min: Number(input.duration_min) || 60,
    is_free: input.is_free ?? true,
    price: input.is_free ? 0 : Number(input.price) || 0,
    status: input.status ?? "published",
    enrolled_count: 0,
    rating: 5.0,
    created_at: now,
    updated_at: now,
  };

  coursesState.unshift(newCourse);
  return newCourse;
}

export async function updateCourse(
  id: string,
  input: UpdateCourseInput,
): Promise<Course | null> {
  const index = coursesState.findIndex((c) => c.id === id);
  if (index === -1) return null;

  const current = coursesState[index];
  const now = new Date().toISOString();

  let nextSlug = current.slug;
  if (input.slug && input.slug.trim()) {
    nextSlug = slugify(input.slug);
  } else if (input.title && input.title !== current.title && !input.slug) {
    nextSlug = slugify(input.title);
  }

  // Ensure unique slug excluding itself
  let uniqueSlug = nextSlug;
  let counter = 1;
  while (coursesState.some((c) => c.slug === uniqueSlug && c.id !== id)) {
    uniqueSlug = `${nextSlug}-${counter++}`;
  }

  const updated: Course = {
    ...current,
    title: input.title !== undefined ? input.title.trim() : current.title,
    slug: uniqueSlug,
    description: input.description !== undefined ? input.description.trim() : current.description,
    provider: input.provider !== undefined ? input.provider.trim() : current.provider,
    type: input.type ?? current.type,
    track: input.track ?? current.track,
    level: input.level ?? current.level,
    tags: input.tags !== undefined ? (Array.isArray(input.tags) ? input.tags : []) : current.tags,
    url: input.url !== undefined ? input.url.trim() : current.url,
    duration_min: input.duration_min !== undefined ? Number(input.duration_min) : current.duration_min,
    is_free: input.is_free !== undefined ? input.is_free : current.is_free,
    price: input.price !== undefined ? Number(input.price) : current.price,
    status: input.status ?? current.status,
    updated_at: now,
  };

  if (updated.is_free) {
    updated.price = 0;
  }

  coursesState[index] = updated;
  return updated;
}

export async function deleteCourse(id: string): Promise<boolean> {
  const index = coursesState.findIndex((c) => c.id === id);
  if (index === -1) return false;
  coursesState.splice(index, 1);
  return true;
}

export async function getCourseStats(): Promise<CourseStats> {
  const total = coursesState.length;
  const published = coursesState.filter((c) => c.status === "published").length;
  const draft = coursesState.filter((c) => c.status === "draft").length;
  const archived = coursesState.filter((c) => c.status === "archived").length;
  const free = coursesState.filter((c) => c.is_free).length;
  const paid = coursesState.filter((c) => !c.is_free).length;

  return { total, published, draft, archived, free, paid };
}

export function resetCourses(): void {
  coursesState = [...INITIAL_COURSES];
}
