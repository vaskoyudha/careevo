#!/usr/bin/env node
// Smoke test: cek status HTTP seluruh route PRD (tanpa supabase, mock session).
// Jumlah route diambil dari array `routes` di bawah — jangan ditulis di komentar,
// karena angka yang ditulis tangan selalu tertinggal saat route ditambah.
// Pakai: node scripts/smoke.mjs [baseUrl]

const base = process.argv[2] ?? "http://localhost:3000";

const routes = [
  "/",
  "/masuk",
  "/daftar",
  "/p/budi",
  "/verify/unknown",
  "/loker",
  "/dashboard",
  "/belajar",
  "/challenge/1",
  "/submission/1",
  "/loker/1",
  "/pengaturan",
  "/review",
  "/review/1",
  "/audit",
  "/careevo-plus",
  "/onboarding",
  "/onboarding/demo",
  "/belajar/fullstack-web-development-nextjs-15-react-19",
  "/belajar/r1",
  // Route staf tanpa sesi akan dijawab redirect ke /masuk, dan redirect
  // dihitung lulus di bawah. Yang dicari di sini bukan isinya, melainkan
  // bahwa halamannya benar-benar bisa dimuat — 500 akibat impor yang salah
  // (mis. modul server-only tertarik ke bundel klien) langsung tertangkap.
  "/admin/courses",
  "/admin/kuis",
];

let failed = 0;

for (const route of routes) {
  try {
    const res = await fetch(base + route, { redirect: "manual" });
    const status = res.status;
    const ok = status >= 200 && status < 400;
    if (!ok) failed += 1;
    console.log(`${ok ? "OK " : "ERR"} ${status} ${route}`);
  } catch (error) {
    failed += 1;
    console.log(`ERR --- ${route} (${error instanceof Error ? error.message : error})`);
  }
}

console.log(`\n${routes.length - failed}/${routes.length} route merespons.`);
process.exit(failed === 0 ? 0 : 1);
