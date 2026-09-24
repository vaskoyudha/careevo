import type {
  BlokHalaman,
  BlokInput,
  Course,
  CourseStats,
  CreateCourseInput,
  CreateHalamanInput,
  CreateKuisInput,
  CreateMateriInput,
  CreateModulInput,
  Halaman,
  Kuis,
  Materi,
  Modul,
  UpdateCourseInput,
  UpdateHalamanInput,
  UpdateKuisInput,
  UpdateMateriInput,
  UpdateModulInput,
} from "@/types/course";
import { muatCourses, muatKuis, simpanCourses, simpanKuis } from "./storage";
import { judulHalamanOtomatis, normalisasiHalamanLama } from "./halaman";
import { promosiKuisLama } from "./kuis";

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

/**
 * Cache in-memory di atas `storage.ts`.
 *
 * Disk adalah sumber kebenaran; `coursesState` hanyalah salinan agar pembacaan
 * tetap sinkron-cepat. Cache dihidrasi sekali secara lazy pada akses pertama.
 * `resetCourses()` menandai cache sudah terhidrasi supaya test tetap berjalan
 * murni in-memory tanpa menyentuh disk.
 */
let coursesState: Course[] = [...INITIAL_COURSES];

/**
 * Bank soal kuis.
 *
 * Disimpan terpisah dari `coursesState` karena kuis hidup lintas kursus: satu
 * entri di sini bisa dirujuk modul di kursus mana pun. Kosong bukan berarti
 * "tidak ada kuis" bagi kursus yang belum dimigrasikan — materinya yang lama
 * masih memuat soalnya sampai `pastikanTermuat()` mempromosikannya.
 */
let kuisState: Kuis[] = [];

let sudahHidrasi = false;
/**
 * Dimatikan oleh `resetCourses()`. Test berjalan sepenuhnya in-memory — sama
 * seperti sebelum store punya disk — sehingga tidak ada test yang menulis
 * `data/courses.json` milik mesin pengembang.
 */
let pakaiDisk = true;

async function pastikanTermuat(): Promise<void> {
  if (sudahHidrasi) return;
  sudahHidrasi = true;

  const dariDisk = await muatCourses();
  if (dariDisk === null) return;

  // Bank soal dibaca lebih dulu: promosi materi `kuis` di bawah butuh tahu id
  // yang sudah ada supaya tidak menimpa kuis hasil migrasi yang sudah disunting.
  const bankDariDisk = (await muatKuis()) ?? [];

  let bank = bankDariDisk;
  // Dua migrasi malas, satu lintasan:
  // - materi `teks`  → halaman berformat
  // - materi `kuis`  → bank soal + referensi `Modul.kuis`
  // Keduanya idempoten, jadi terpanggil berulang tidak menggandakan apa pun.
  const kursus = dariDisk.map((course) => {
    const denganHalaman = normalisasiHalamanLama(course);
    const hasil = promosiKuisLama(denganHalaman, bank);
    bank = hasil.bank;
    return hasil.course;
  });

  coursesState = kursus;
  kuisState = bank;
}

/** Tulis cache ke disk. No-op dalam mode uji (setelah `resetCourses()`). */
async function simpan(): Promise<void> {
  if (!pakaiDisk) return;
  await simpanCourses(coursesState);
}

/**
 * Tulis kursus **beserta** bank soal.
 *
 * Dipakai mutasi yang menyentuh keduanya sekaligus — memasang atau melepas kuis
 * mengubah `Modul.kuis` dan referensinya, dan menghapus kuis membersihkan
 * referensi di kursus. Menulis hanya salah satunya akan meninggalkan berkas
 * yang saling bertentangan setelah proses mati di antaranya.
 */
async function simpanSemua(): Promise<void> {
  if (!pakaiDisk) return;
  await simpanCourses(coursesState);
  await simpanKuis(kuisState);
}

function idBaru(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Urutkan berdasarkan `urutan` lalu nomori ulang 1..n.
 *
 * Dipakai saat **membaca**: berkas di disk bisa saja tidak rapi, jadi urutan
 * ditentukan oleh field `urutan`.
 */
function rapikanUrutan(modul: Modul[]): Modul[] {
  return [...modul]
    .sort((a, b) => a.urutan - b.urutan)
    .map((item, index) => ({ ...item, urutan: index + 1 }));
}

/**
 * Nomori ulang 1..n **mengikuti posisi array**, tanpa mengurutkan.
 *
 * Ini yang benar setelah mutasi yang mengubah posisi: sesudah menukar dua
 * elemen, field `urutan` masing-masing masih menyimpan nilai lama. Mengurutkan
 * berdasarkan nilai basi itu justru membatalkan pertukaran — jadi urutan array
 * yang dijadikan sumber, lalu `urutan` disesuaikan.
 */
function nomoriUlang(modul: Modul[]): Modul[] {
  return modul.map((item, index) => ({ ...item, urutan: index + 1 }));
}

export interface CourseFilter {
  track?: string;
  level?: string;
  status?: string;
  type?: string;
  search?: string;
}

export async function listCourses(filter?: CourseFilter): Promise<Course[]> {
  await pastikanTermuat();
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
  await pastikanTermuat();
  return coursesState.find((c) => c.id === id);
}

export async function getCourseBySlug(slug: string): Promise<Course | undefined> {
  await pastikanTermuat();
  return coursesState.find((c) => c.slug === slug);
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  await pastikanTermuat();
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
  await simpan();
  return newCourse;
}

export async function updateCourse(
  id: string,
  input: UpdateCourseInput,
): Promise<Course | null> {
  await pastikanTermuat();
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
    cover_image: input.cover_image !== undefined ? input.cover_image : current.cover_image,
    updated_at: now,
  };

  if (updated.is_free) {
    updated.price = 0;
  }

  coursesState[index] = updated;
  await simpan();
  return updated;
}

export async function deleteCourse(id: string): Promise<boolean> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === id);
  if (index === -1) return false;
  coursesState.splice(index, 1);
  await simpan();
  return true;
}

export async function getCourseStats(): Promise<CourseStats> {
  await pastikanTermuat();
  const total = coursesState.length;
  const published = coursesState.filter((c) => c.status === "published").length;
  const draft = coursesState.filter((c) => c.status === "draft").length;
  const archived = coursesState.filter((c) => c.status === "archived").length;
  const free = coursesState.filter((c) => c.is_free).length;
  const paid = coursesState.filter((c) => !c.is_free).length;

  return { total, published, draft, archived, free, paid };
}

/**
 * Kembalikan store ke seed in-memory **tanpa menyentuh disk**.
 *
 * Dipakai `beforeEach` di test: mematikan penulisan disk untuk sisa proses dan
 * menandai cache sudah terhidrasi, sehingga test tidak memuat maupun menimpa
 * `data/courses.json` milik mesin pengembang.
 */
export function resetCourses(): void {
  coursesState = [...INITIAL_COURSES];
  kuisState = [];
  sudahHidrasi = true;
  pakaiDisk = false;
}

// ---------------------------------------------------------------------------
// Modul
// ---------------------------------------------------------------------------

/** Modul sebuah kursus, sudah terurut. Didahulukan yang benar-benar tersimpan. */
export async function listModul(courseId: string): Promise<Modul[]> {
  const kursus = await getCourseById(courseId);
  if (!kursus?.modul) return [];
  return rapikanUrutan(kursus.modul);
}

export async function getModul(courseId: string, modulId: string): Promise<Modul | undefined> {
  const daftar = await listModul(courseId);
  return daftar.find((m) => m.id === modulId);
}

export async function createModul(courseId: string, input: CreateModulInput): Promise<Modul | null> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const kursus = coursesState[index];
  const sekarang = kursus.modul ?? [];
  const now = new Date().toISOString();
  const modulId = idBaru("mod");

  const modul: Modul = {
    id: modulId,
    course_id: courseId,
    judul: input.judul.trim(),
    ringkasan: input.ringkasan.trim(),
    // Store selalu menaruh modul baru di akhir; urutan eksplisit dari
    // pemanggil diabaikan agar tidak ada celah nomor.
    urutan: sekarang.length + 1,
    durasi_min: Number(input.durasi_min) || 0,
    materi: [],
    // Halaman awal dibuat sekaligus di sini — satu penulisan untuk modul
    // beserta halamannya, bukan satu penulisan per halaman.
    halaman: halamanAwal(courseId, modulId, input.jumlah_halaman ?? 0, now),
    // Modul baru belum memasang kuis apa pun; pemasangannya lewat panel Kuis.
    kuis: [],
    created_at: now,
    updated_at: now,
  };

  coursesState[index] = {
    ...kursus,
    modul: [...sekarang, modul],
    updated_at: now,
  };
  await simpan();
  return modul;
}

export async function updateModul(
  courseId: string,
  modulId: string,
  input: UpdateModulInput,
): Promise<Modul | null> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const kursus = coursesState[index];
  const daftar = kursus.modul ?? [];
  const posisi = daftar.findIndex((m) => m.id === modulId);
  if (posisi === -1) return null;

  const now = new Date().toISOString();
  const lama = daftar[posisi];
  const diperbarui: Modul = {
    ...lama,
    judul: input.judul !== undefined ? input.judul.trim() : lama.judul,
    ringkasan: input.ringkasan !== undefined ? input.ringkasan.trim() : lama.ringkasan,
    durasi_min: input.durasi_min !== undefined ? Number(input.durasi_min) : lama.durasi_min,
    updated_at: now,
  };

  const berikut = [...daftar];
  berikut[posisi] = diperbarui;
  coursesState[index] = { ...kursus, modul: nomoriUlang(berikut), updated_at: now };
  await simpan();
  return diperbarui;
}

/** Hapus modul beserta seluruh materinya (materi dimiliki modul). */
export async function deleteModul(courseId: string, modulId: string): Promise<boolean> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return false;

  const kursus = coursesState[index];
  const daftar = kursus.modul ?? [];
  if (!daftar.some((m) => m.id === modulId)) return false;

  const now = new Date().toISOString();
  coursesState[index] = {
    ...kursus,
    modul: nomoriUlang(daftar.filter((m) => m.id !== modulId)),
    updated_at: now,
  };
  await simpan();
  return true;
}

/**
 * Pindahkan satu modul naik/turun satu posisi, lalu rapikan ulang nomornya.
 * Mengembalikan daftar terbaru, atau `null` bila kursus/modul tidak ada.
 */
export async function geserModul(
  courseId: string,
  modulId: string,
  arah: "naik" | "turun",
): Promise<Modul[] | null> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const kursus = coursesState[index];
  const daftar = rapikanUrutan(kursus.modul ?? []);
  const posisi = daftar.findIndex((m) => m.id === modulId);
  if (posisi === -1) return null;

  const tujuan = arah === "naik" ? posisi - 1 : posisi + 1;
  if (tujuan < 0 || tujuan >= daftar.length) {
    // Sudah di ujung: bukan error, cukup tidak ada perubahan.
    return daftar;
  }

  [daftar[posisi], daftar[tujuan]] = [daftar[tujuan], daftar[posisi]];
  const now = new Date().toISOString();
  const hasil = nomoriUlang(daftar);
  coursesState[index] = { ...kursus, modul: hasil, updated_at: now };
  await simpan();
  return hasil;
}

// ---------------------------------------------------------------------------
// Materi
// ---------------------------------------------------------------------------

/** Bentuk bersama sebelum `id`/`urutan`/timestamp ditambahkan store. */
function materiBaru(
  modulId: string,
  courseId: string,
  urutan: number,
  input: CreateMateriInput,
  now: string,
): Materi {
  const dasar = {
    id: idBaru("mat"),
    modul_id: modulId,
    course_id: courseId,
    judul: input.judul.trim(),
    urutan,
    created_at: now,
    updated_at: now,
  };

  switch (input.tipe) {
    case "video":
      return { ...dasar, tipe: "video", url: input.url.trim(), durasi_min: Number(input.durasi_min) || 0 };
    case "pdf":
      return {
        ...dasar,
        tipe: "pdf",
        path: input.path.trim(),
        ukuran_bytes: Number(input.ukuran_bytes) || 0,
      };
  }
}

/** Cari modul di dalam kursus berikut posisinya, atau `null`. */
function cariModul(
  kursus: Course,
  modulId: string,
): { modul: Modul; posisi: number } | null {
  const posisi = (kursus.modul ?? []).findIndex((m) => m.id === modulId);
  if (posisi === -1) return null;
  return { modul: (kursus.modul ?? [])[posisi], posisi };
}

export async function listMateri(courseId: string, modulId: string): Promise<Materi[]> {
  const modul = await getModul(courseId, modulId);
  if (!modul?.materi) return [];
  return [...modul.materi].sort((a, b) => a.urutan - b.urutan);
}

export async function createMateri(
  courseId: string,
  modulId: string,
  input: CreateMateriInput,
): Promise<Materi | null> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const kursus = coursesState[index];
  const ketemu = cariModul(kursus, modulId);
  if (!ketemu) return null;

  const now = new Date().toISOString();
  const daftar = kursus.modul ?? [];
  const materi = materiBaru(modulId, courseId, (ketemu.modul.materi ?? []).length + 1, input, now);

  const berikut = [...daftar];
  berikut[ketemu.posisi] = {
    ...ketemu.modul,
    materi: [...(ketemu.modul.materi ?? []), materi],
    updated_at: now,
  };
  coursesState[index] = { ...kursus, modul: berikut, updated_at: now };
  await simpan();
  return materi;
}

/** Ganti utuh sebuah materi — termasuk `tipe`-nya. */
export async function updateMateri(
  courseId: string,
  modulId: string,
  materiId: string,
  input: UpdateMateriInput,
): Promise<Materi | null> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const kursus = coursesState[index];
  const ketemu = cariModul(kursus, modulId);
  if (!ketemu) return null;

  const materiLama = ketemu.modul.materi ?? [];
  const posisiMateri = materiLama.findIndex((m) => m.id === materiId);
  if (posisiMateri === -1) return null;

  const now = new Date().toISOString();
  const sebelumnya = materiLama[posisiMateri];
  // Pertahankan id/urutan/timestamp pembuatan; `materiBaru` membuat yang baru.
  const diganti: Materi = {
    ...materiBaru(modulId, courseId, sebelumnya.urutan, input, now),
    id: sebelumnya.id,
    created_at: sebelumnya.created_at,
  };

  const materiBerikut = [...materiLama];
  materiBerikut[posisiMateri] = diganti;

  const daftar = kursus.modul ?? [];
  const berikut = [...daftar];
  berikut[ketemu.posisi] = { ...ketemu.modul, materi: materiBerikut, updated_at: now };
  coursesState[index] = { ...kursus, modul: berikut, updated_at: now };
  await simpan();
  return diganti;
}

export async function deleteMateri(
  courseId: string,
  modulId: string,
  materiId: string,
): Promise<boolean> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return false;

  const kursus = coursesState[index];
  const ketemu = cariModul(kursus, modulId);
  if (!ketemu) return false;

  const materiLama = ketemu.modul.materi ?? [];
  if (!materiLama.some((m) => m.id === materiId)) return false;

  const now = new Date().toISOString();
  const materiBerikut = materiLama
    .filter((m) => m.id !== materiId)
    .map((m, i) => ({ ...m, urutan: i + 1 }));

  const daftar = kursus.modul ?? [];
  const berikut = [...daftar];
  berikut[ketemu.posisi] = { ...ketemu.modul, materi: materiBerikut, updated_at: now };
  coursesState[index] = { ...kursus, modul: berikut, updated_at: now };
  await simpan();
  return true;
}

// ---------------------------------------------------------------------------
// Halaman berformat
// ---------------------------------------------------------------------------
//
// Halaman hidup bersarang di dalam modul (`Modul.halaman`), sama seperti materi:
// menghapus modul otomatis menghapus halamannya. `urutan` selalu dinormalkan
// store, jadi pemanggil tidak pernah menentukan nomor.

/**
 * Beri id pada blok yang belum punya, dan rapikan field tipe.
 *
 * Id diberikan di sini — satu-satunya tempat yang memutuskan bentuk id — supaya
 * blok yang sudah ada mempertahankan id-nya. Itu bukan detail gaya: backlink
 * `#anchor` diturunkan dari judul heading, tapi `petaSection()` memetakannya
 * lewat id blok, jadi mengganti id blok akan memutus kaitan itu.
 */
function blokTersimpan(blok: BlokInput[] | undefined): BlokHalaman[] {
  return (blok ?? []).map((item) => ({
    ...item,
    id: item.id?.trim() ? item.id.trim() : idBaru("blk"),
  }));
}

/** Bentuk `Halaman` lengkap dari input pemanggil. */
function halamanBaru(
  courseId: string,
  modulId: string,
  urutan: number,
  input: CreateHalamanInput,
  now: string,
): Halaman {
  return {
    id: idBaru("hal"),
    modul_id: modulId,
    course_id: courseId,
    judul: input.judul.trim(),
    urutan,
    blok: blokTersimpan(input.blok),
    created_at: now,
    updated_at: now,
  };
}

/** Halaman sebuah modul, terurut menaik. */
export async function listHalaman(courseId: string, modulId: string): Promise<Halaman[]> {
  const modul = await getModul(courseId, modulId);
  if (!modul?.halaman) return [];
  return [...modul.halaman].sort((a, b) => a.urutan - b.urutan);
}

export async function getHalaman(
  courseId: string,
  modulId: string,
  halamanId: string,
): Promise<Halaman | undefined> {
  const daftar = await listHalaman(courseId, modulId);
  return daftar.find((h) => h.id === halamanId);
}

export async function createHalaman(
  courseId: string,
  modulId: string,
  input: CreateHalamanInput,
): Promise<Halaman | null> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const kursus = coursesState[index];
  const ketemu = cariModul(kursus, modulId);
  if (!ketemu) return null;

  const now = new Date().toISOString();
  const daftar = kursus.modul ?? [];
  const halaman = halamanBaru(
    courseId,
    modulId,
    (ketemu.modul.halaman ?? []).length + 1,
    input,
    now,
  );

  const berikut = [...daftar];
  berikut[ketemu.posisi] = {
    ...ketemu.modul,
    halaman: [...(ketemu.modul.halaman ?? []), halaman],
    updated_at: now,
  };
  coursesState[index] = { ...kursus, modul: berikut, updated_at: now };
  await simpan();
  return halaman;
}

/** Ganti utuh isi sebuah halaman. Id dan waktu pembuatan dipertahankan. */
export async function updateHalaman(
  courseId: string,
  modulId: string,
  halamanId: string,
  input: UpdateHalamanInput,
): Promise<Halaman | null> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const kursus = coursesState[index];
  const ketemu = cariModul(kursus, modulId);
  if (!ketemu) return null;

  const lama = ketemu.modul.halaman ?? [];
  const posisi = lama.findIndex((h) => h.id === halamanId);
  if (posisi === -1) return null;

  const now = new Date().toISOString();
  const sebelumnya = lama[posisi];
  const diganti: Halaman = {
    ...sebelumnya,
    judul: input.judul.trim(),
    // `undefined` berarti "jangan sentuh isi" — dipakai saat hanya mengubah
    // judul, sehingga blok tidak perlu ikut dikirim bolak-balik.
    blok:
      input.blok === undefined ? sebelumnya.blok : blokTersimpan(input.blok),
    updated_at: now,
  };

  const halamanBerikut = [...lama];
  halamanBerikut[posisi] = diganti;

  const daftar = kursus.modul ?? [];
  const berikut = [...daftar];
  berikut[ketemu.posisi] = { ...ketemu.modul, halaman: halamanBerikut, updated_at: now };
  coursesState[index] = { ...kursus, modul: berikut, updated_at: now };
  await simpan();
  return diganti;
}

/** Hapus satu halaman beserta isinya, lalu nomori ulang sisanya. */
export async function deleteHalaman(
  courseId: string,
  modulId: string,
  halamanId: string,
): Promise<boolean> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return false;

  const kursus = coursesState[index];
  const ketemu = cariModul(kursus, modulId);
  if (!ketemu) return false;

  const lama = ketemu.modul.halaman ?? [];
  if (!lama.some((h) => h.id === halamanId)) return false;

  const now = new Date().toISOString();
  // Nomori ulang mengikuti posisi array — bukan urutan hasil sort, karena
  // array inilah yang menentukan posisi sebenarnya setelah penghapusan.
  const halamanBerikut = lama
    .filter((h) => h.id !== halamanId)
    .map((h, i) => ({ ...h, urutan: i + 1 }));

  const daftar = kursus.modul ?? [];
  const berikut = [...daftar];
  berikut[ketemu.posisi] = { ...ketemu.modul, halaman: halamanBerikut, updated_at: now };
  coursesState[index] = { ...kursus, modul: berikut, updated_at: now };
  await simpan();
  return true;
}

/**
 * Tukar satu halaman dengan tetangganya, lalu nomori ulang.
 *
 * Sumber urutan adalah **posisi array setelah sort**, bukan field `urutan`:
 * berkas dari disk bisa tidak rapi, dan bertukar berdasarkan nilai basi justru
 * membatalkan pertukaran — pelajaran yang sama dengan `geserModul`.
 * Mengembalikan daftar terbaru, atau `null` bila kursus/modul/halaman tak ada.
 */
export async function geserHalaman(
  courseId: string,
  modulId: string,
  halamanId: string,
  arah: "naik" | "turun",
): Promise<Halaman[] | null> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const kursus = coursesState[index];
  const ketemu = cariModul(kursus, modulId);
  if (!ketemu) return null;

  const daftar = [...(ketemu.modul.halaman ?? [])].sort((a, b) => a.urutan - b.urutan);
  const posisi = daftar.findIndex((h) => h.id === halamanId);
  if (posisi === -1) return null;

  const tujuan = arah === "naik" ? posisi - 1 : posisi + 1;
  if (tujuan < 0 || tujuan >= daftar.length) {
    // Sudah di ujung: bukan error, cukup tidak ada perubahan.
    return daftar;
  }

  [daftar[posisi], daftar[tujuan]] = [daftar[tujuan], daftar[posisi]];
  const now = new Date().toISOString();
  const hasil = daftar.map((h, i) => ({ ...h, urutan: i + 1 }));

  const modulBerikut = [...(kursus.modul ?? [])];
  modulBerikut[ketemu.posisi] = { ...ketemu.modul, halaman: hasil, updated_at: now };
  coursesState[index] = { ...kursus, modul: modulBerikut, updated_at: now };
  await simpan();
  return hasil;
}

/** Buat `jumlah` halaman kosong berurutan untuk sebuah modul baru. */
function halamanAwal(
  courseId: string,
  modulId: string,
  jumlah: number,
  now: string,
): Halaman[] {
  const aman = Math.max(0, Math.floor(Number(jumlah) || 0));
  return Array.from({ length: aman }, (_, i) => ({
    id: idBaru("hal"),
    modul_id: modulId,
    course_id: courseId,
    judul: judulHalamanOtomatis(i + 1),
    urutan: i + 1,
    blok: [],
    created_at: now,
    updated_at: now,
  }));
}

// ---------------------------------------------------------------------------
// Bank soal kuis
// ---------------------------------------------------------------------------
//
// Kuis **tidak** bersarang di dalam modul, berbeda dari materi dan halaman.
// Alasannya kebalikan dari alasan bersarangnya mereka: materi dan halaman
// dimiliki satu modul, sedangkan kuis dipakai ulang lintas modul dan kursus.
// Yang disimpan modul hanyalah daftar id (`Modul.kuis`), sehingga memperbaiki
// satu soal langsung berlaku di semua tempat yang memakainya.
//
// Konsekuensi yang harus ditangani: referensi bisa jadi yatim. `deleteKuis()`
// membersihkannya, dan `kuisUntukModul()` di `kuis.ts` mengabaikan id yang
// tidak ketemu sebagai jaring kedua.

/** Kuis terurut judulnya — bank soal dibaca sebagai katalog, bukan urutan pasang. */
export async function listKuis(): Promise<Kuis[]> {
  await pastikanTermuat();
  return [...kuisState].sort((a, b) => a.judul.localeCompare(b.judul, "id"));
}

export async function getKuis(kuisId: string): Promise<Kuis | undefined> {
  await pastikanTermuat();
  return kuisState.find((k) => k.id === kuisId);
}

/** Bentuk `Kuis` lengkap dari input pemanggil. Id dan timestamp diisi store. */
function kuisBaru(input: CreateKuisInput, now: string): Kuis {
  return {
    id: idBaru("kuis"),
    judul: input.judul.trim(),
    deskripsi: (input.deskripsi ?? "").trim(),
    soal: input.soal,
    nilai_lulus: Number(input.nilai_lulus ?? 70) || 0,
    created_at: now,
    updated_at: now,
  };
}

export async function createKuis(input: CreateKuisInput): Promise<Kuis> {
  await pastikanTermuat();
  const now = new Date().toISOString();
  const kuis = kuisBaru(input, now);
  kuisState = [...kuisState, kuis];
  await simpanSemua();
  return kuis;
}

/**
 * Perbarui kuis di bank.
 *
 * `undefined` berarti "jangan sentuh field ini", bukan "kosongkan" — sama
 * seperti `updateHalaman` memperlakukan `blok`. Dengan begitu UI bisa mengirim
 * hanya field yang benar-benar berubah tanpa menghapus sisanya.
 *
 * Perubahan **tidak** disalin ke modul mana pun: yang disimpan modul adalah id,
 * jadi semua pemakai otomatis melihat versi terbaru. Itulah alasan kuis
 * dipisahkan dari materi.
 */
export async function updateKuis(
  kuisId: string,
  input: UpdateKuisInput,
): Promise<Kuis | null> {
  await pastikanTermuat();
  const posisi = kuisState.findIndex((k) => k.id === kuisId);
  if (posisi === -1) return null;

  const sebelumnya = kuisState[posisi];
  const now = new Date().toISOString();
  const diganti: Kuis = {
    ...sebelumnya,
    judul: input.judul !== undefined ? input.judul.trim() : sebelumnya.judul,
    deskripsi: input.deskripsi !== undefined ? input.deskripsi.trim() : sebelumnya.deskripsi,
    soal: input.soal !== undefined ? input.soal : sebelumnya.soal,
    nilai_lulus:
      input.nilai_lulus !== undefined ? Number(input.nilai_lulus) || 0 : sebelumnya.nilai_lulus,
    updated_at: now,
  };

  kuisState = kuisState.map((k, i) => (i === posisi ? diganti : k));
  await simpanSemua();
  return diganti;
}

/**
 * Hapus kuis dari bank **beserta seluruh referensinya**.
 *
 * Pemakaian di modul dibersihkan dalam operasi yang sama, bukan diserahkan ke
 * pemanggil: referensi yatim akan membuat daftar pasang menampilkan entri yang
 * tidak bisa dibuka, dan membersihkannya di sini adalah satu-satunya tempat
 * yang tahu semua modul mana saja yang memakainya.
 *
 * Mengembalikan jumlah modul yang referensinya dibersihkan (0 bila kuisnya
 * memang tidak terpasang di mana pun), atau `null` bila kuisnya tidak ada.
 */
export async function deleteKuis(kuisId: string): Promise<number | null> {
  await pastikanTermuat();
  if (!kuisState.some((k) => k.id === kuisId)) return null;

  const now = new Date().toISOString();
  // Menghitung **modul**, bukan kursus: pesan ke admin menyebut "dilepas dari N
  // modul", dan satu kursus bisa memuat beberapa modul yang memakai kuis sama.
  // Menghitung kursus akan melaporkan angka yang lebih kecil dari kenyataan.
  let dibersihkan = 0;

  coursesState = coursesState.map((kursus) => {
    const daftar = kursus.modul ?? [];
    if (!daftar.some((m) => (m.kuis ?? []).includes(kuisId))) return kursus;

    const modul: Modul[] = daftar.map((m) => {
      if (!(m.kuis ?? []).includes(kuisId)) return m;
      dibersihkan += 1;
      return { ...m, kuis: (m.kuis ?? []).filter((id) => id !== kuisId), updated_at: now };
    });

    return { ...kursus, modul, updated_at: now };
  });

  kuisState = kuisState.filter((k) => k.id !== kuisId);
  await simpanSemua();
  return dibersihkan;
}

/**
 * Pasang kuis ke sebuah modul, di urutan terakhir.
 *
 * Idempoten: memasang kuis yang sudah terpasang tidak menggandakan
 * referensinya, dan mengembalikan modul apa adanya. Tombol "pasang" yang
 * terklik dua kali (mis. karena koneksi lambat) tidak boleh menghasilkan dua
 * entri yang sama.
 */
export async function pasangKuis(
  courseId: string,
  modulId: string,
  kuisId: string,
): Promise<Modul | null> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const kursus = coursesState[index];
  const ketemu = cariModul(kursus, modulId);
  if (!ketemu) return null;

  // Kuis harus ada di bank dulu: referensi ke id yang tidak ada tidak bisa
  // ditampilkan maupun dinilai, jadi lebih baik ditolak di sini.
  if (!kuisState.some((k) => k.id === kuisId)) return null;
  if ((ketemu.modul.kuis ?? []).includes(kuisId)) return ketemu.modul;

  const now = new Date().toISOString();
  const diperbarui: Modul = {
    ...ketemu.modul,
    kuis: [...(ketemu.modul.kuis ?? []), kuisId],
    updated_at: now,
  };

  const daftar = [...(kursus.modul ?? [])];
  daftar[ketemu.posisi] = diperbarui;
  coursesState[index] = { ...kursus, modul: daftar, updated_at: now };
  await simpanSemua();
  return diperbarui;
}

/**
 * Lepas kuis dari sebuah modul.
 *
 * Hanya melepas referensinya — entri di bank tetap ada, karena kuis yang sama
 * mungkin masih dipakai modul lain. Menghapusnya dari bank adalah tindakan
 * terpisah yang disengaja.
 */
export async function lepasKuis(
  courseId: string,
  modulId: string,
  kuisId: string,
): Promise<Modul | null> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const kursus = coursesState[index];
  const ketemu = cariModul(kursus, modulId);
  if (!ketemu) return null;
  if (!(ketemu.modul.kuis ?? []).includes(kuisId)) return ketemu.modul;

  const now = new Date().toISOString();
  const diperbarui: Modul = {
    ...ketemu.modul,
    kuis: (ketemu.modul.kuis ?? []).filter((id) => id !== kuisId),
    updated_at: now,
  };

  const daftar = [...(kursus.modul ?? [])];
  daftar[ketemu.posisi] = diperbarui;
  coursesState[index] = { ...kursus, modul: daftar, updated_at: now };
  await simpanSemua();
  return diperbarui;
}

/**
 * Pindahkan kuis yang terpasang di modul satu posisi naik/turun.
 *
 * Mengembalikan daftar id terbaru, atau `null` bila modul/kuisnya tidak
 * ketemu. Sumber urutannya adalah posisi array — pelajaran yang sama dengan
 * `geserModul`/`geserHalaman`: bertukar berdasarkan nilai yang mungkin basi
 * justru membatalkan pertukaran.
 */
export async function geserKuis(
  courseId: string,
  modulId: string,
  kuisId: string,
  arah: "naik" | "turun",
): Promise<string[] | null> {
  await pastikanTermuat();
  const index = coursesState.findIndex((c) => c.id === courseId);
  if (index === -1) return null;

  const kursus = coursesState[index];
  const ketemu = cariModul(kursus, modulId);
  if (!ketemu) return null;

  const daftar = [...(ketemu.modul.kuis ?? [])];
  const posisi = daftar.findIndex((id) => id === kuisId);
  if (posisi === -1) return null;

  const tujuan = arah === "naik" ? posisi - 1 : posisi + 1;
  if (tujuan < 0 || tujuan >= daftar.length) {
    // Sudah di ujung: bukan error, cukup tidak ada perubahan.
    return daftar;
  }

  [daftar[posisi], daftar[tujuan]] = [daftar[tujuan], daftar[posisi]];

  const now = new Date().toISOString();
  const daftarModul = [...(kursus.modul ?? [])];
  daftarModul[ketemu.posisi] = { ...ketemu.modul, kuis: daftar, updated_at: now };
  coursesState[index] = { ...kursus, modul: daftarModul, updated_at: now };
  await simpanSemua();
  return daftar;
}
