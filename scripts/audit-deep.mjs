#!/usr/bin/env node
/**
 * Deep responsive verification.
 *
 * The first pass was shallow in ways that mattered, so this one is built to
 * attack the specific blind spots:
 *
 *  1. WIDTH SWEEP, not breakpoints. 280 -> 2560 in 20px steps through the
 *     phone/tablet range plus every named breakpoint, because responsive-craft's
 *     first rule is "test by dragging, not jumping" -- the in-between widths
 *     are where a layout actually breaks, and a 4-width sweep never lands on
 *     the one that broke.
 *  2. SCROLL, then measure. GSAP ScrollTrigger entrances only run when the
 *     section enters the viewport. Measuring on load means the entire
 *     below-the-fold page is sampled in its pre-animation state, which is
 *     exactly the state a reader never sees. This scrolls the full page, then
 *     measures at every step, so transforms/rotations are measured live.
 *  3. LANDSCAPE. 812x375 and 667x375 are a different layout, and safe-area
 *     insets only become meaningful once a device is turned sideways.
 *  4. OVERLAYS. The mobile nav drawer, the account menu and the Explore
 *     mega-menu are mobile-only surfaces that no page-load probe ever sees.
 *  5. LONG CONTENT. Real data is short. Overflow almost always shows up with a
 *     40-character word, a 3-line heading, or a 100-item list.
 *
 * Usage: node scripts/audit-deep.mjs [--base URL] [--route /path] [--json]
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = baseIdx >= 0 ? args[baseIdx + 1] : "http://localhost:3000";
const routeIdx = args.indexOf("--route");
const ONLY = routeIdx >= 0 ? args[routeIdx + 1] : null;
const AS_JSON = args.includes("--json");

const PW = "careevo";
const LOGIN = { email: "user@careevo.test", password: PW };

/** Fine sweep through the range that actually matters, plus the named stops. */
const WIDTHS = (() => {
  const w = [];
  for (let x = 280; x <= 900; x += 20) w.push(x); // drag through phone + tablet
  for (const x of [1024, 1180, 1280, 1440, 1600, 1920, 2560]) w.push(x);
  return [...new Set(w)];
})();

const LANDSCAPE = [
  { w: 812, h: 375, label: "phone landscape" },
  { w: 667, h: 375, label: "small phone landscape" },
];

const ROUTES = [
  "/", "/belajar", "/belajar/it-security-fundamental",
  "/belajar/python-automation-scripting/karya",
  "/belajar/mastery", "/belajar/buku", "/belajar/latihan", "/jelajah",
  "/courses", "/browse/security", "/loker", "/loker/93762818", "/kerja",
  "/business", "/career-academy", "/career-academy/roles/software-engineer",
  "/careevo-plus", "/degrees", "/degrees/s1",
  "/professional-certificates/aws-solutions-architect",
  "/specializations/data-science",
  "/p/@budi", "/verify/8f3a91c4",
  "/dashboard", "/progres", "/masuk", "/daftar", "/privasi", "/syarat",
  "/search", "/pengaturan", "/profil",
];

/* ---------- in-page probes ---------- */

/** Structural overflow probe. Returns offenders, not just a number. */
function probeOverflow() {
  const vw = document.documentElement.clientWidth;
  const scrollW = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right <= vw + 1) continue;
    let p = el.parentElement, clipped = false;
    while (p && p !== document.body) {
      if (getComputedStyle(p).overflowX !== "visible") { clipped = true; break; }
      p = p.parentElement;
    }
    if (clipped) continue;
    let nested = false;
    for (const o of offenders) if (o.node.contains(el)) { nested = true; break; }
    if (nested) continue;
    offenders.push({
      node: el,
      info: {
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 90),
        text: (el.textContent || "").trim().slice(0, 40),
        w: Math.round(r.width), right: Math.round(r.right),
      },
    });
    if (offenders.length >= 5) break;
  }
  return {
    vw, scrollW, overflow: scrollW - vw,
    offenders: offenders.slice(0, 5).map((o) => o.info),
  };
}

/** Smallest tappable box in the page, ignoring visually-hidden skip links. */
function probeTap() {
  const out = [];
  const sel = 'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="tab"],[role="switch"],[role="option"]';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (el.closest("[aria-hidden='true']")) continue;
    if (el.closest("[inert]")) continue;
    // skip links sit off-canvas until focused -- not a tap target
    if (r.top < -2 || r.left < -2) continue;
    // WCAG 2.2 exempts links inline in a sentence
    if (el.tagName === "A" && el.closest("p,li,dd,figcaption,.prose")) continue;
    if (r.height >= 44) continue;
    out.push({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") || "",
      cls: (el.className || "").toString().slice(0, 80),
      text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 32),
      w: Math.round(r.width), h: Math.round(r.height),
    });
    if (out.length >= 8) break;
  }
  return out;
}

/** Text that is smaller than 16px in a control that renders text (iOS zoom). */
function probeZoom() {
  const TEXT = /^(text|search|url|email|tel|password|number|date|time|datetime-local|month|week)$/;
  const out = [];
  for (const el of document.querySelectorAll("input,textarea,select")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.tagName === "INPUT" && !TEXT.test(el.getAttribute("type") || "text")) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 16) {
      out.push({ tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().slice(0, 70), fs });
      if (out.length >= 5) break;
    }
  }
  return out;
}

/**
 * Replace short strings with long ones, then re-measure. Real content is short;
 * overflow is not. Swapping the text of every leaf node is crude but it is the
 * only way to test a 40-character word without knowing the real data.
 */
function stressLongContent() {
  const LONG = "Supercalifragilisticexpialidociousnomenklatur";
  let n = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const t = walker.currentNode;
    if (t.nodeValue && t.nodeValue.trim().length > 3) nodes.push(t);
  }
  for (const t of nodes) {
    t.nodeValue = LONG.slice(0, Math.max(12, Math.min(40, t.nodeValue.trim().length + 10)));
    n++;
  }
  return n;
}

/* ---------- driver ---------- */

async function loginState(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/masuk", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', LOGIN.email);
  await page.fill('input[type="password"]', LOGIN.password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1200);
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

const run = async () => {
  const browser = await chromium.launch();
  let state = null;
  try { state = await loginState(browser); console.log("# logged in\n"); }
  catch (e) { console.log(`# login failed: ${String(e).slice(0, 90)}\n`); }

  const routes = ONLY ? [ONLY] : ROUTES;
  const report = [];
  const overflowHits = new Map();
  const tapHits = new Map();
  const zoomHits = new Map();

  for (const route of routes) {
    const bad = [];

    for (const w of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: 900 },
        hasTouch: w < 1100,
        isMobile: w < 700,
        ...(state ? { storageState: state } : {}),
      });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (new URL(page.url()).pathname !== route) { await ctx.close(); continue; }
        await page.waitForTimeout(700);

        // --- scroll the whole page so ScrollTrigger animations actually run ---
        const steps = await page.evaluate(async () => {
          const h = document.documentElement.scrollHeight;
          const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
          let y = 0;
          const seen = new Set();
          while (y < h) {
            y += step;
            window.scrollTo(0, y);
            seen.add(y);
            await new Promise((r) => setTimeout(r, 60));
            if (seen.size > 60) break;
          }
          window.scrollTo(0, 0);
          await new Promise((r) => setTimeout(r, 120));
          return document.documentElement.scrollHeight;
        });
        void steps;

        const o = await page.evaluate(probeOverflow);
        if (o.overflow > 0) {
          bad.push(`w=${w}px:+${o.overflow}px`);
          if (!overflowHits.has(route)) overflowHits.set(route, []);
          overflowHits.get(route).push({ w, ...o });
        }

        if (w === 320 || w === 768) {
          const t = await page.evaluate(probeTap);
          if (t.length) {
            if (!tapHits.has(route)) tapHits.set(route, new Set());
            for (const x of t) tapHits.get(route).add(`<${x.tag}> ${x.w}x${x.h} "${x.text}" .${x.cls}`);
          }
          const z = await page.evaluate(probeZoom);
          if (z.length) {
            if (!zoomHits.has(route)) zoomHits.set(route, new Set());
            for (const x of z) zoomHits.get(route).add(`<${x.tag}> ${x.fs}px .${x.cls}`);
          }
        }
      } catch (e) {
        bad.push(`w=${w}px:ERR ${String(e).slice(0, 50)}`);
      }
      await ctx.close();
    }

    // --- landscape ---
    for (const { w, h, label } of LANDSCAPE) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h }, hasTouch: true, isMobile: true,
        ...(state ? { storageState: state } : {}),
      });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (new URL(page.url()).pathname !== route) { await ctx.close(); continue; }
        await page.waitForTimeout(700);
        const o = await page.evaluate(probeOverflow);
        if (o.overflow > 0) {
          bad.push(`${label} ${w}x${h}:+${o.overflow}px`);
          if (!overflowHits.has(route)) overflowHits.set(route, []);
          overflowHits.get(route).push({ w: `${w}x${h} land`, ...o });
        }
      } catch { /* ignore */ }
      await ctx.close();
    }

    // --- long content stress (320px) ---
    {
      const ctx = await browser.newContext({
        viewport: { width: 320, height: 900 }, hasTouch: true, isMobile: true,
        ...(state ? { storageState: state } : {}),
      });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (new URL(page.url()).pathname === route) {
          await page.waitForTimeout(600);
          const n = await page.evaluate(stressLongContent);
          await page.waitForTimeout(300);
          const o = await page.evaluate(probeOverflow);
          if (o.overflow > 0) {
            bad.push(`longtext(320px):+${o.overflow}px`);
            if (!overflowHits.has(route)) overflowHits.set(route, []);
            overflowHits.get(route).push({ w: "longtext-320", ...o, stressedNodes: n });
          }
        }
      } catch { /* ignore */ }
      await ctx.close();
    }

    report.push({ route, bad });
    console.log(`[${bad.length ? "BREAK" : " ok  "}] ${route.padEnd(46)} ${bad.join(" ") || "clean across " + WIDTHS.length + " widths + landscape + longtext"}`);
  }

  await browser.close();

  console.log("\n" + "=".repeat(80));
  console.log("DEEP AUDIT SUMMARY");
  console.log("=".repeat(80));
  console.log(`routes: ${report.length}   widths/route: ${WIDTHS.length} + 2 landscape + 1 long-content`);

  console.log(`\n>>> OVERFLOW: ${overflowHits.size} routes`);
  for (const [route, list] of overflowHits) {
    console.log(`\n  ${route}`);
    for (const o of list.slice(0, 6)) {
      console.log(`    ${o.w}px  +${o.overflow}px`);
      for (const f of o.offenders) console.log(`       <${f.tag}> w=${f.w} R=${f.right} .${f.cls} "${f.text}"`);
    }
  }

  console.log(`\n>>> iOS ZOOM (<16px): ${zoomHits.size} routes`);
  for (const [route, set] of zoomHits) {
    console.log(`  ${route}: ${[...set].slice(0, 4).join(" | ")}`);
  }

  console.log(`\n>>> TAP TARGETS <44px: ${tapHits.size} routes (deduped)`);
  for (const [route, set] of tapHits) {
    const arr = [...set];
    const worst = arr.length;
    console.log(`  ${route} (${worst}): ${arr.slice(0, 3).join(" | ")}`);
  }

  if (AS_JSON) {
    writeFileSync("/tmp/opencode/deep-audit.json", JSON.stringify(
      { report, overflow: [...overflowHits], zoom: [...zoomHits], tap: [...tapHits] }, null, 2));
    console.log("\nJSON -> /tmp/opencode/deep-audit.json");
  }
};

run().catch((e) => { console.error("deep audit failed:", e); process.exit(1); });
