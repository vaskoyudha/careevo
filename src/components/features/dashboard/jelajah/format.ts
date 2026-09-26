/**
 * Terjemahan label dari data katalog ke bahasa Indonesia.
 *
 * Data program masih berbahasa Inggris (`startDate: "Starts Sep 24"`,
 * `level: "Beginner level"`). Fungsi di sini memetakan ke kosakata Indonesia
 * yang sudah dipakai halaman lain, bukan mengarang nilai baru: tanggal, level,
 * dan kredensial hanya ditulis ulang, tidak pernah diubah maknanya.
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
