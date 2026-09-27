#!/usr/bin/env node
/**
 * Verifikasi bahwa SELURUH kursus di `/belajar` bisa dibuka dan dikerjakan.
 *
 * Pakai: `node scripts/seed/konten/verifikasi-katalog.mjs [baseUrl]`
 *
 * Yang diperiksa per kursus (published):
 *  1. Halaman detail bisa dibuka (200, bukan 404/500).
 *  2. Kurikulum benar-benar berisi — minimal satu modul punya "Buka materi"
 *     (halaman/kuis), bukan sekadar tautan eksternal.
 *  3. Jumlah modul yang dirender masuk akal (>= 1).
 *
 * Sesi didapat dari `scripts/seed/konten/sesi-verifikasi.mts` (akun demo).
 */

import { execFileSync } from "node:child_process";

const base = process.argv[2] ?? "http://localhost:3000";

function cookie() {
  const out = execFileSync("npx", ["tsx", "scripts/seed/konten/sesi-verifikasi.mts"], {
    encoding: "utf8",
  });
  const cocok = out.match(/ls_session=\S+/);
  if (!cocok) throw new Error(`Cookie tidak ditemukan di keluaran: ${out.slice(0, 200)}`);
  return cocok[0];
}

/** Ambil daftar slug published dari data/courses.json. */
async function slugPublished() {
  const { readFileSync } = await import("node:fs");
  const data = JSON.parse(readFileSync("data/courses.json", "utf8"));
  return data.filter((c) => c.status === "published").map((c) => c.slug);
}

const sesi = cookie();
const slugs = await slugPublished();
let gagal = 0;

console.log(`Verifikasi ${slugs.length} kursus published @ ${base}\n`);

for (const slug of slugs) {
  const url = `${base}/belajar/${slug}`;
  let status = 0;
  let body = "";
  try {
    const res = await fetch(url, { headers: { cookie: sesi }, redirect: "manual" });
    status = res.status;
    body = await res.text();
  } catch (err) {
    console.log(`ERR ${slug} — fetch gagal: ${String(err)}`);
    gagal += 1;
    continue;
  }

  const bukaMateri = (body.match(/>Buka materi</g) ?? []).length;
  const kuis = (body.match(/>Kuis</g) ?? []).length;
  const eksternal = (body.match(/Buka materi ↗/g) ?? []).length;
  const punyaKurikulum = body.includes("Kurikulum");
  const terkunci = body.includes("Project course");

  const masalah = [];
  if (status !== 200) masalah.push(`status ${status}`);
  if (!punyaKurikulum) masalah.push("tanpa Kurikulum");
  if (bukaMateri === 0) masalah.push("tidak ada modul berisi");
  if (!terkunci) masalah.push("tanpa panel Project");

  const ok = masalah.length === 0;
  if (!ok) gagal += 1;
  console.log(
    `${ok ? "OK " : "ERR"} ${String(status)} ${slug.padEnd(54)} modul-berisi=${bukaMateri} kuis=${kuis} eksternal=${eksternal}${ok ? "" : `  <-- ${masalah.join("; ")}`}`,
  );
}

console.log(`\n${slugs.length - gagal}/${slugs.length} kursus bisa dibuka & berisi.`);
process.exit(gagal === 0 ? 0 : 1);
