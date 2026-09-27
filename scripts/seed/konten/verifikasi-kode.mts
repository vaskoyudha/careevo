/**
 * Verifikasi blok kode yang bisa dijalankan di `data/courses.json`.
 *
 * Pakai: `npx tsx scripts/seed/konten/verifikasi-kode.mts`
 *
 * Menjalankan setiap blok `kode` dengan `dapatDijalankan: true` lewat runner
 * sungguhan (`:8021`) dan membandingkan `stdout` dengan `outputHarapan`.
 *
 * Kenapa ini ada: `outputHarapan` yang dikira-kira dari membaca kode adalah
 * janji yang belum diuji. Kalau satu contoh gagal dikompilasi atau keluarannya
 * beda, pengajarannya jadi "tombol Jalankan tidak bisa dipercaya". Karena itu
 * setiap blok yang punya tombol harus lulus di sini.
 *
 * Rahasia runner dibaca dari `CAREEVO_RUNNER_SECRET` (env proses) atau dari
 * `/tmp/runner.env` bila ada.
 */

import { readFileSync } from "node:fs";

const BASE = process.env.CAREEVO_RUNNER_URL ?? "http://127.0.0.1:8021";

function rahasia(): string {
  const dariEnv = process.env.CAREEVO_RUNNER_SECRET;
  if (dariEnv && dariEnv.trim()) return dariEnv.trim();
  try {
    const baris = readFileSync("/tmp/runner.env", "utf8").trim();
    const cocok = baris.match(/^CAREEVO_RUNNER_SECRET=(.*)$/);
    if (cocok) return cocok[1];
  } catch {
    // jatuh ke pesan di bawah
  }
  throw new Error("CAREEVO_RUNNER_SECRET tidak ditemukan (env atau /tmp/runner.env).");
}

interface BlokKode {
  kode: string;
  stdin?: string;
  outputHarapan?: string;
  dapatDijalankan?: boolean;
}

interface Lokasi {
  slug: string;
  modul: string;
  halaman: string;
  blok: BlokKode;
}

async function main() {
  const kode = rahasia();
  const courses = JSON.parse(readFileSync("data/courses.json", "utf8")) as Array<{
    slug: string;
    modul?: Array<{
      judul: string;
      /**
       * `halaman` pindah ke dalam `submodul` sejak tingkat sub-modul ada
       * (`Modul.halaman` **dihapus**, lihat `types/course.ts`). Field lama tetap
       * dibaca di sini hanya supaya berkas kursus yang belum dinormalisasi tidak
       * diam-diam kehilangan bloknya — bukan sebagai jalan kedua yang setara.
       */
      halaman?: Array<{ judul: string; blok: Array<{ tipe: string } & BlokKode> }>;
      submodul?: Array<{
        judul?: string;
        halaman?: Array<{ judul: string; blok: Array<{ tipe: string } & BlokKode> }>;
      }>;
    }>;
  }>;

  const daftar: Lokasi[] = [];
  for (const c of courses) {
    for (const m of c.modul ?? []) {
      // Urutan lapis mengikuti skema sekarang: halaman milik sub-modul, dan
      // `m.halaman` hanya jalur kompatibilitas untuk berkas lama.
      const lapisHalaman = [
        ...(m.submodul ?? []).flatMap((s) => s.halaman ?? []),
        ...(m.halaman ?? []),
      ];
      for (const h of lapisHalaman) {
        for (const b of h.blok ?? []) {
          if (b.tipe === "kode" && b.dapatDijalankan === true) {
            daftar.push({ slug: c.slug, modul: m.judul, halaman: h.judul, blok: b });
          }
        }
      }
    }
  }

  console.log(`${daftar.length} blok kode bisa dijalankan.\n`);
  let gagal = 0;

  for (const item of daftar) {
    let hasil: { status?: string; stdout?: string; stderr?: string };
    try {
      const res = await fetch(`${BASE}/jalankan`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-runner-secret": kode },
        body: JSON.stringify({ bahasa: "cpp", kode: item.blok.kode, stdin: item.blok.stdin ?? "" }),
      });
      hasil = (await res.json()) as typeof hasil;
    } catch (err) {
      console.log(`ERR ${item.slug} / ${item.halaman} — runner tidak terjangkau: ${String(err)}`);
      gagal += 1;
      continue;
    }

    const harap = item.blok.outputHarapan ?? "";
    const dapat = hasil.stdout ?? "";
    const cocok = hasil.status === "sukses" && dapat === harap;
    if (!cocok) {
      gagal += 1;
      console.log(`ERR ${item.slug} / ${item.halaman}`);
      console.log(`    status=${hasil.status} exit=${JSON.stringify(hasil.stderr)?.slice(0, 200)}`);
      console.log(`    harap=${JSON.stringify(harap)}`);
      console.log(`    dapat=${JSON.stringify(dapat)}`);
    } else {
      console.log(`OK  ${item.slug} / ${item.halaman}`);
    }
  }

  console.log(`\n${daftar.length - gagal}/${daftar.length} blok lulus.`);
  process.exit(gagal === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
