#!/usr/bin/env node
/**
 * End-to-end check of the anti-cheat Tier 1 signals.
 *
 * The unit tests prove the pure helpers return the right objects. They do NOT
 * prove that a real browser's `paste`/`fullscreenchange`/`keydown` listeners
 * are attached, that the server accepts the new `jenis` values, or that rows
 * land in `learning_events`. That is what this does:
 *
 *   1. log in as the demo learner
 *   2. open a course and press "Mulai sesi terverifikasi"
 *   3. fire each Tier 1 signal the way a browser really would
 *   4. read `learning_events` back out of Postgres
 *
 * Usage: node scripts/e2e-anticheat.mjs [slug]
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const slug = process.argv[2] || "it-security-fundamental";
const BASE = process.env.BASE || "http://localhost:3000";

// Reuse the app's own DATABASE_URL rather than hardcoding a second copy.
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

/** `pg` is not a repo dependency, so query through the psql binary instead. */
function q(sql) {
  const out = execFileSync("psql", [env.DATABASE_URL, "-At", "-F", "\u0001", "-c", sql], {
    encoding: "utf8",
  });
  return out.trim().split("\n").filter(Boolean).map((l) => l.split("\u0001"));
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// --- 1. log in ------------------------------------------------------------
await page.goto(`${BASE}/masuk`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', "user@careevo.test");
await page.fill('input[type="password"]', "careevo");
await page.click('button[type="submit"]');
await page.waitForLoadState("domcontentloaded").catch(() => {});
await page.waitForTimeout(1500);
console.log(`logged in -> ${new URL(page.url()).pathname}`);

// --- 2. open the course and start a session -------------------------------
await page.goto(`${BASE}/belajar/${slug}`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1200);
console.log(`course page -> ${new URL(page.url()).pathname}`);

const startBtn = page.locator('button:has-text("Mulai sesi")').first();
if (!(await startBtn.count())) {
  console.log("NO 'Mulai sesi' BUTTON on this course — cannot exercise the session path.");
  console.log("(the gate only renders for a course whose policy requires a session)");
  await browser.close();
  await db.end();
  process.exit(0);
}
await startBtn.click();
await page.waitForTimeout(2500);
const started = await page.evaluate(() => document.body.innerText.includes("sesi") || true);
void started;

const runId = await page.evaluate(() => {
  // the session component keeps the run id in React state; the only stable
  // way to find it from outside is the event panel, which lists events.
  return null;
});
void runId;

// --- 3. fire the Tier 1 signals for real ----------------------------------
console.log("\nfiring Tier 1 signals...");

// paste_massal: a >200 char paste. `fill` does not fire a paste event, so use
// the clipboard + a real keyboard paste on a focused editable region.
await page.evaluate(async () => {
  const big = "A".repeat(400);
  const dt = new DataTransfer();
  dt.setData("text/plain", big);
  const target = document.querySelector("input, textarea") || document.body;
  target.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(400);

// salin_terlarang: a real copy event carrying a long selection. The threshold
// is the same 200 characters as paste (`AMBANG_PASTE_MINIMAL`), so a copy of an
// empty selection is correctly ignored — the signal is about copying *bulk*
// material, not about pressing Ctrl+C.
await page.evaluate(() => {
  const dt = new DataTransfer();
  dt.setData("text/plain", "B".repeat(400));
  document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(400);

// pintasan_terlarang: ctrl+v
await page.keyboard.down("Control");
await page.keyboard.press("v");
await page.keyboard.up("Control");
await page.waitForTimeout(400);

// keluar_fullscreen: exit fullscreen while not in it
await page.evaluate(() => {
  document.dispatchEvent(new Event("fullscreenchange", { bubbles: true }));
});
await page.waitForTimeout(1200);

// --- 4. read the rows back out of Postgres --------------------------------
const rows = q(
  `select e.kind, coalesce(e.payload_redacted::text,''), e.occurred_at::text
     from learning_events e
     join learning_runs r on r.id = e.learning_run_id
     join users u on u.id = r.user_id
    where u.email_normalized = 'user@careevo.test'
    order by e.occurred_at desc
    limit 25`,
).map(([kind, payload, at]) => ({ kind, payload, at }));

console.log(`\nlearning_events for email=user@careevo.test: ${rows.length} row(s)`);
const byKind = {};
for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
for (const [k, n] of Object.entries(byKind)) console.log(`  ${k}: ${n}`);

const wanted = ["keluar_fullscreen", "paste_massal", "pintasan_terlarang", "salin_terlarang"];
console.log("\nTier 1 signals found:");
for (const w of wanted) {
  const hit = rows.find((r) => r.kind === w);
  console.log(`  ${hit ? "YES" : "NO "}  ${w}${hit ? `  payload=${hit.payload}` : ""}`);
}

await browser.close();
