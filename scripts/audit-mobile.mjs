#!/usr/bin/env node
/**
 * Audit mobile responsive breakage across routes.
 *
 * Loads every public route at phone/tablet widths in headless Chromium and
 * reports, per width:
 *   - horizontal overflow (documentElement.scrollWidth > innerWidth) plus the
 *     widest offending elements, so a break can be traced to a real node
 *   - interactive elements below the 44x44 CSS-px touch target floor
 *   - inputs whose computed font-size is under 16px (iOS Safari zooms on focus)
 *
 * Auth-gated routes are logged in for with a demo account; an unauthenticated
 * request 307s to /masuk, so the audit would otherwise re-measure the login
 * page and report it "clean" for a page it never loaded.
 *
 * Requires `playwright` resolvable from this directory and a dev server on
 * --base. Playwright is not a dependency of this repo (it resolves from a
 * parent directory on this machine), so this script is a local tool rather
 * than a gate -- do not add it to `npm run check`.
 *
 * Usage: node scripts/audit-mobile.mjs [--base http://localhost:3000] [--json]
 */

import { chromium } from "playwright";

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = baseIdx >= 0 ? args[baseIdx + 1] : "http://localhost:3000";
const AS_JSON = args.includes("--json");

const WIDTHS = [
  { w: 320, h: 900, label: "320 (smallest phone)" },
  { w: 375, h: 900, label: "375 (iPhone SE/12 mini)" },
  { w: 414, h: 900, label: "414 (large phone)" },
  { w: 768, h: 1000, label: "768 (tablet)" },
];

const ROUTES = [
  "/",
  "/belajar",
  "/belajar/it-security-fundamental",
  "/belajar/python-automation-scripting/karya",
  "/belajar/mastery",
  "/belajar/buku",
  "/belajar/latihan",
  "/belajar/jalur",
  "/jelajah",
  "/courses",
  "/browse/security",
  "/loker",
  "/loker/93762818",
  "/loker/94261469",
  "/kerja",
  "/bisnis",
  "/business",
  "/career-academy",
  "/career-academy/roles/software-engineer",
  "/careevo-plus",
  "/degrees",
  "/degrees/s1",
  "/professional-certificates/aws-solutions-architect",
  "/specializations/data-science",
  "/performa",
  "/performa/integritas",
  "/p/@budi",
  "/verify/8f3a91c4",
  "/dashboard",
  "/progres",
  "/audit",
  "/review",
  "/masuk",
  "/daftar",
  "/onboarding",
  "/privasi",
  "/syarat",
  "/search",
  "/pengaturan",
  "/profil",
];

/**
 * Learner routes behind a session. Logging in first is the only way to measure
 * them: an unauthenticated request 307s to /masuk, so the audit would just
 * re-measure the login page and report "clean" for a page it never loaded.
 */
const AUTHED = [
  "/dashboard", "/progres", "/belajar", "/audit", "/review", "/profil", "/pengaturan",
  "/belajar/it-security-fundamental", "/belajar/python-automation-scripting/karya",
  "/belajar/mastery", "/belajar/buku", "/belajar/latihan", "/jelajah",
  "/loker/93762818", "/loker/94261469",
  "/performa", "/performa/integritas",
];

const LOGIN = { email: "user@careevo.test", password: "careevo" };

/** Log in once and hand back a storageState that later contexts can reuse. */
async function loginState(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/masuk", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.fill('input[type="email"], input[name="email"]', LOGIN.email);
  await page.fill('input[type="password"], input[name="password"]', LOGIN.password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const landed = new URL(page.url()).pathname;
  const state = await ctx.storageState();
  await ctx.close();
  return { state, landed };
}

/** Runs in the page: find overflow offenders and undersized controls. */
function probe() {
  const vw = document.documentElement.clientWidth;

  // --- horizontal overflow offenders -------------------------------------
  const offenders = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const right = r.right;
    if (right <= vw + 1) continue;

    // Skip nodes that are clipped by an ancestor — they cannot cause a
    // page-level scrollbar, so reporting them is pure noise.
    let p = el.parentElement;
    let clipped = false;
    while (p && p !== document.body) {
      const ov = getComputedStyle(p).overflowX;
      if (ov === "hidden" || ov === "clip" || ov === "auto" || ov === "scroll") {
        clipped = true;
        break;
      }
      p = p.parentElement;
    }
    if (clipped) continue;

    // Deepest/most specific only: stop if an ancestor also overflows.
    let hasAncestorOffender = false;
    for (const other of offenders) {
      if (el !== other.el && other.el.contains(el)) {
        hasAncestorOffender = true;
        break;
      }
    }
    if (hasAncestorOffender) continue;

    const key = el.tagName + "." + (el.className || "").toString().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);

    offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || "").toString().slice(0, 110),
      right: Math.round(right),
      width: Math.round(r.width),
      text: (el.textContent || "").trim().slice(0, 45),
      el,
    });
  }

  const overflowPx = Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0
  ) - vw;

  // --- touch targets ------------------------------------------------------
  const small = [];
  const sel =
    'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="link"]';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (el.closest("[aria-hidden='true']")) continue;
    // Inline links inside prose are not tap targets in the 44px sense.
    if (el.tagName === "A" && el.closest("p, li.prose, .prose")) continue;
    if (r.height < 44 || r.width < 44) {
      small.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 90),
        w: Math.round(r.width),
        h: Math.round(r.height),
        text: (el.textContent || el.value || "").trim().slice(0, 40),
        el,
      });
    }
  }

  // --- small input font (iOS zoom) ---------------------------------------
  // Only controls that RENDER TEXT can trigger the iOS viewport zoom. A
  // checkbox/radio/file/button at 12px is reported here otherwise, and fixing
  // it would be cargo-culting a rule that does not apply.
  const TEXT_ENTRY = /^(text|search|url|email|tel|password|number|date|time|datetime-local|month|week)$/;
  const smallInput = [];
  for (const el of document.querySelectorAll("input, textarea, select")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.tagName === "INPUT" && !TEXT_ENTRY.test(el.getAttribute("type") || "text")) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 16) {
      smallInput.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 90),
        fs,
        el,
      });
    }
  }

  const desc = (o) => ({
    tag: o.tag,
    cls: o.cls,
    w: o.w,
    h: o.h,
    fs: o.fs,
    right: o.right,
    width: o.width,
    text: o.text,
  });

  return {
    vw,
    scrollW: overflowPx,
    offenders: offenders.slice(0, 6).map(desc),
    small: small.slice(0, 6).map(desc),
    smallInput: smallInput.slice(0, 6).map(desc),
  };
}

const run = async () => {
  const browser = await chromium.launch();

  // Auth first: one login, reused for every context.
  let storageState = null;
  let loginNote = "no auth";
  try {
    const { state, landed } = await loginState(browser);
    storageState = state;
    const cookies = (state.cookies || []).map((c) => c.name);
    loginNote = `login landed on ${landed} (cookies: ${cookies.join(",") || "none"})`;
    console.log(`# auth: ${loginNote}\n`);
  } catch (e) {
    console.log(`# auth: FAILED — ${String(e).slice(0, 120)}\n`);
  }

  const results = [];

  for (const route of ROUTES) {
    const needsAuth = AUTHED.includes(route);
    const perWidth = [];
    let skipped = null;

    for (const { w, h, label } of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        deviceScaleFactor: 1,
        isMobile: w < 700,
        // Touch at EVERY width, not just phones. A tablet held in a hand is
        // `pointer: coarse` at 768px, so auditing 768px as a mouse device would
        // skip exactly the touch rules this sweep exists to check.
        hasTouch: true,
        ...(needsAuth && storageState ? { storageState } : {}),
      });
      const page = await ctx.newPage();
      try {
        const resp = await page.goto(BASE + route, {
          waitUntil: "domcontentloaded",
          timeout: 25000,
        });
        const status = resp ? resp.status() : 0;
        const landed = new URL(page.url()).pathname;

        if (status === 307 || (status >= 300 && status < 400) || landed !== route) {
          skipped = `auth-gated → ${landed} (${status})`;
          await ctx.close();
          break;
        }
        await page.waitForTimeout(450);
        const r = await page.evaluate(probe);
        perWidth.push({ width: w, label, ...r });
      } catch (e) {
        perWidth.push({ width: w, label, error: String(e).slice(0, 120) });
      }
      await ctx.close();
    }

    results.push({ route, skipped, widths: perWidth });
    const bad = perWidth.filter((x) => x.scrollW > 0);
    const mark = skipped ? "SKIP" : bad.length ? "BREAK" : " ok ";
    console.log(
      `[${mark}] ${route.padEnd(14)} ${
        skipped
          ? skipped
          : bad.map((b) => `${b.width}px:+${b.scrollW}px`).join("  ") || "clean"
      }`
    );
  }

  await browser.close();

  // --- report -------------------------------------------------------------
  const breaks = results
    .filter((r) => r.widths.some((w) => w.scrollW > 0))
    .sort((a, b) => {
      const am = Math.max(...a.widths.map((w) => w.scrollW || 0));
      const bm = Math.max(...b.widths.map((w) => w.scrollW || 0));
      return bm - am;
    });

  console.log("\n" + "=".repeat(78));
  console.log("MOBILE AUDIT SUMMARY");
  console.log("=".repeat(78));
  console.log(`routes tested : ${results.length}`);
  console.log(`with overflow : ${breaks.length}`);

  if (!breaks.length) {
    console.log("\nNo horizontal overflow detected. Nice.");
  }

  for (const r of breaks) {
    for (const w of r.widths.filter((x) => x.scrollW > 0)) {
      console.log(`\n--- ${r.route} @ ${w.width}px — overflows by ${w.scrollW}px`);
      for (const o of w.offenders) {
        console.log(
          `      <${o.tag}> w=${o.width} right=${o.right}  "${o.text}"\n        .${o.cls}`
        );
      }
    }
  }

  const touchIssues = results
    .filter((r) => r.widths.some((w) => w.small && w.small.length))
    .map((r) => ({ route: r.route, w: r.widths.find((x) => x.small && x.small.length) }))
    .filter((x) => x.w);
  if (touchIssues.length) {
    console.log(`\n\nTOUCH TARGETS < 44px (at first failing width): ${touchIssues.length} routes`);
    for (const t of touchIssues) {
      console.log(`  ${t.route} @${t.w.width}px: ` +
        t.w.small.map((s) => `<${s.tag}> ${s.w}x${s.h} "${s.text}"`).join(" | "));
    }
  }

  const zoomIssues = results
    .filter((r) => r.widths.some((w) => w.smallInput && w.smallInput.length))
    .map((r) => ({ route: r.route, w: r.widths.find((x) => x.smallInput && x.smallInput.length) }))
    .filter((x) => x.w);
  if (zoomIssues.length) {
    console.log(`\n\nINPUT FONT-SIZE < 16px (iOS zoom-on-focus): ${zoomIssues.length} routes`);
    for (const t of zoomIssues) {
      console.log(`  ${t.route} @${t.w.width}px: ` +
        t.w.smallInput.map((s) => `<${s.tag}> ${s.fs}px .${s.cls}`).join(" | "));
    }
  }

  if (AS_JSON) {
    const fs = await import("node:fs");
    fs.writeFileSync("/tmp/opencode/mobile-audit.json", JSON.stringify(results, null, 2));
    console.log("\n\nJSON written to /tmp/opencode/mobile-audit.json");
  }
};

run().catch((e) => {
  console.error("audit failed:", e);
  process.exit(1);
});
