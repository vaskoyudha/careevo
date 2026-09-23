#!/usr/bin/env node
// Smoke test: cek status HTTP 15 route PRD (tanpa supabase, mock session).
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
