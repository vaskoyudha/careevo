/**
 * Terjemahan label dari data katalog ke bahasa Indonesia.
 *
 * Data program masih berbahasa Inggris (`startDate: "Starts Sep 24"`,
 * `level: "Beginner level"`). Fungsi di sini memetakan ke kosakata Indonesia
 * yang sudah dipakai halaman lain, bukan mengarang nilai baru: tanggal, level,
 * dan kredensial hanya ditulis ulang, tidak pernah diubah maknanya.
 *
 * **Kenapa penerjemahan ada di sini, bukan di `catalog-data.ts`:** nilai-nilai
 * itu bukan label bebas, mereka kunci pencocokan. `explore-queries.ts`
 * membandingkan `p.type`, `p.category`, dan `p.subcategory` dengan string
 * Inggris yang ditulis literal (`p.category === "Business"`), dan `p.skills`
 * menjadi indeks pencarian lewat `SKILL_INDEX`. Menerjemahkannya di data akan
 * membuat `/browse/*`, `/search`, `/courses?query=`, dan
 * `/career-academy/roles/*` sepi tanpa error — filter yang tidak pernah cocok
 * tidak pernah melempar. Jadi data tetap Inggris, dan hanya yang dirender ke
 * pengguna yang diterjemahkan di sini.
 *
 * Setiap peta mengembalikan nilai aslinya kalau kuncinya tidak dikenal, supaya
 * program baru di registry tidak pernah menampilkan `undefined`.
 */
import type { ProgramDetails } from "@/lib/courses/catalog-data";
import type { Level } from "@/types/domain";

/** Kosakata kredensial yang sama dengan `CourseMeta` di belajar-home.tsx. */
const KREDENSIAL: Record<ProgramDetails["type"], string> = {
  Specialization: "Spesialisasi",
  "Professional Certificate": "Sertifikat Profesional",
};

const LEVEL_PROGRAM: Record<ProgramDetails["level"], string> = {
  "Beginner level": "Pemula",
  "Intermediate level": "Menengah",
  "Advanced level": "Lanjutan",
};

/**
 * `category`/`subcategory` untuk breadcrumb di halaman detail program.
 *
 * Kosakatanya sengaja sama dengan pil "Explore categories" di `belajar-home.tsx`
 * (Bisnis / Ilmu Komputer / Ilmu Data / Teknologi Informasi) supaya satu
 * bidang tidak punya dua nama berbeda depending halaman mana yang menampilkannya.
 */
const KATEGORI: Record<string, string> = {
  Business: "Bisnis",
  "Computer Science": "Ilmu Komputer",
  "Data Science": "Ilmu Data",
  "Information Technology": "Teknologi Informasi",
  "Professional Development": "Pengembangan Profesional",
};

const SUBKATEGORI: Record<string, string> = {
  "Software Development": "Pengembangan Perangkat Lunak",
  "Project Management": "Manajemen Proyek",
  "Data Analysis": "Analisis Data",
  Security: "Keamanan",
  "Machine Learning": "Machine Learning",
  "Applied Learning": "Pembelajaran Terapan",
};

/**
 * `skills` untuk chip "Keterampilan yang kamu dapatkan".
 *
 * Kunci tetap bahasa Inggris karena `p.skills` adalah indeks pencarian
 * (`SKILL_INDEX` di `explore-taxonomy.ts`) dan bahan pencocokan
 * `CATEGORY_MATCHERS`/`ROLE_RULES` di `explore-queries.ts`. Yang diterjemahkan
 * hanya tampilannya. Nama produk dan akronim (`IBM Cognos`, `Pandas & NumPy`,
 * `Linux CLI`) dibiarkan apa adanya.
 */
const KETERAMPILAN: Record<string, string> = {
  "Agile Methodology": "Metodologi Agile",
  "Applied Problem Solving": "Pemecahan Masalah Terapan",
  "Budgeting & Procurement": "Anggaran & Pengadaan",
  "Business Modeling": "Pemodelan Bisnis",
  "Data Analysis": "Analisis Data",
  "Data Cleaning": "Pembersihan Data",
  "Data Dashboards": "Dasbor Data",
  "Data Ethics": "Etika Data",
  "Data Visualization": "Visualisasi Data",
  "Decision Trees": "Pohon Keputusan",
  "Email Automation": "Otomatisasi Email",
  "Financial Modeling": "Pemodelan Keuangan",
  "Generative AI Agents": "Agen AI Generatif",
  "Industry Best Practices": "Praktik Terbaik Industri",
  "Model Evaluation": "Evaluasi Model",
  "Network Security": "Keamanan Jaringan",
  "Neural Networks": "Jaringan Syaraf Tiruan",
  "Packet Analysis": "Analisis Paket",
  Presentations: "Presentasi",
  "Project Planning": "Perencanaan Proyek",
  "Python Data Analysis": "Analisis Data dengan Python",
  "Python Scripting": "Skrip Python",
  "R Programming": "Pemrograman R",
  "Recommender Systems": "Sistem Rekomendasi",
  "Research Reports": "Laporan Penelitian",
  "Risk Management": "Manajemen Risiko",
  "SIEM Incident Response": "Respons Insiden SIEM",
  "SQL Querying": "Query SQL",
  "Scrum Ceremonies": "Serenam Scrum",
  "Software Engineering": "Rekayasa Perangkat Lunak",
  "Spreadsheet Modeling": "Pemodelan Spreadsheet",
  "Stakeholder Communication": "Komunikasi Pemangku Kepentingan",
  "Statistical Analysis": "Analisis Statistik",
  "Supervised Learning": "Pembelajaran Terawasi",
  "Tableau Dashboards": "Dasbor Tableau",
  "Threat Detection": "Deteksi Ancaman",
  "Unsupervised Learning": "Pembelajaran Tidak Terawasi",
  "Work Breakdown Structures": "Struktur Rinci Kerja",
  "Workflow Automation": "Otomatisasi Alur Kerja",
};

const LEVEL_KATALOG: Record<Level, string> = {
  dasar: "Dasar",
  menengah: "Menengah",
  lanjut: "Lanjut",
};

const BULAN: Record<string, string> = {
  jan: "Jan",
  feb: "Feb",
  mar: "Mar",
  apr: "Apr",
  may: "Mei",
  jun: "Jun",
  jul: "Jul",
  aug: "Agu",
  sep: "Sep",
  oct: "Okt",
  nov: "Nov",
  dec: "Des",
};

export function kredensialProgram(type: ProgramDetails["type"]): string {
  return KREDENSIAL[type] ?? type;
}

export function levelProgram(level: ProgramDetails["level"]): string {
  return LEVEL_PROGRAM[level] ?? level;
}

export function kategoriProgram(category: string): string {
  return KATEGORI[category] ?? category;
}

export function subkategoriProgram(subcategory: string): string {
  return SUBKATEGORI[subcategory] ?? subcategory;
}

/** Terjemahkan chip keterampilan; kunci yang tak dikenal tampil apa adanya. */
export function keterampilanProgram(skills: string[]): string[] {
  return skills.map((skill) => KETERAMPILAN[skill] ?? skill);
}

export function levelKatalog(level: Level): string {
  return LEVEL_KATALOG[level] ?? level;
}

/**
 * `"Starts Sep 24"` → `"Mulai 24 Sep"`, `"Starts Today"` → `"Mulai hari ini"`.
 *
 * Enam dari tujuh program di registry memakai `Starts Today`, jadi bentuk ini
 * harus diterjemahkan — kalau tidak, UI berbahasa Indonesia menampilkan
 * "Mulai Today". Nilai yang tidak dikenali dikembalikan apa adanya dengan
 * awalan "Mulai" supaya teks tetap terbaca dan tidak pernah `undefined`.
 */
export function mulaiProgram(startDate: string): string {
  const bersih = startDate.trim().replace(/^starts\s+/i, "");
  if (bersih.toLowerCase() === "today") return "Mulai hari ini";

  const bagian = bersih.split(/\s+/);
  const awal = bagian[0];
  const angka = bagian[1];
  if (awal && angka) {
    const bulan = BULAN[awal.slice(0, 3).toLowerCase()];
    if (bulan) return `Mulai ${angka} ${bulan}`;
  }
  return `Mulai ${bersih}`;
}

/** Ringkasan satu baris dari entri katalog — semua fieldnya data nyata. */
export function ringkasEntri(provider: string, durationMin: number, level: Level): string {
  return `${provider} · ${durationMin} menit · ${levelKatalog(level)}`;
}
