#!/usr/bin/env node
/**
 * Realistic long-content test.
 *
 * `audit-deep.mjs` replaces every text node with a 40-character word, which
 * proves the layout has no `min-w-0` anywhere -- but real pages do not look
 * like that, and chasing it produces fixes that serve nobody. This one
 * substitutes the things a real user can actually make long: a username, a
 * display name, a course title, a job title, a city, a company name. Each is
 * given a plausible length (not a worst case), and only the element that holds
 * that field is touched.
 *
 * The point is to answer a different question: "if a real account has an
 * unusually long name, does the page break?"
 */
import { chromium } from "playwright";

const [, , base = "http://localhost:3000"] = process.argv;
const PW = "careevo";

/** Realistic-but-long values. Lengths match what real platforms actually allow. */
const LONG = {
  username: "budi_santoso_permana_2026",
  displayName: "Budi Santoso Permana Wibowo",
  courseTitle: "Arsitektur Microservices Terapan untuk Tim Produk Digital",
  jobTitle: "Senior Frontend Engineer - Platform & Developer Experience",
  company: "PT Teknologi Nusantara Digital Solusi",
  city: "Jakarta Selatan, DKI Jakarta",
  moduleTitle: "Membangun Sistem Rekomendasi Berbasis Machine Learning",
};

function probe() {
  const vw = document.documentElement.clientWidth;
  const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
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
        cls: (el.className || "").toString().slice(0, 80),
        text: (el.textContent || "").trim().slice(0, 40),
        w: Math.round(r.width), right: Math.round(r.right),
      },
    });
    if (offenders.length >= 4) break;
  }
  return { overflow: scrollW - vw, offenders: offenders.map((o) => o.info) };
}

/** Replace only text whose current value looks like the field we are faking. */
function applyLong(texts) {
  const rules = [
    [/^@?budi$/i, texts.username],
    [/^Budi$/, texts.displayName],
    [/^Perusahaan mau lihat/i, texts.courseTitle],
    [/^Frontend Engineer/i, texts.jobTitle],
    [/^KarirHub$/, texts.company],
    [/^Jakarta$/, texts.city],
    [/^Belajar dasar TypeScript$/i, texts.moduleTitle],
  ];
  let n = 0;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (w.nextNode()) if (w.currentNode.nodeValue.trim()) nodes.push(w.currentNode);
  for (const t of nodes) {
    const v = t.nodeValue.trim();
    for (const [re, val] of rules) {
      if (re.test(v)) { t.nodeValue = val; n++; break; }
    }
  }
  return n;
}

const ROUTES = ["/", "/dashboard", "/progres", "/belajar", "/loker", "/courses",
  "/p/@budi", "/career-academy", "/performa", "/profil"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(base + "/masuk", { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', "user@careevo.test");
await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForLoadState("domcontentloaded").catch(() => {});
await page.waitForTimeout(1500);
const state = await ctx.storageState();
await ctx.close();

let breaks = 0;
for (const route of ROUTES) {
  const row = [];
  for (const w of [320, 375, 768, 1024, 1280]) {
    const c = await browser.newContext({
      viewport: { width: w, height: 900 },
      isMobile: w < 700, hasTouch: true, storageState: state,
    });
    const p = await c.newPage();
    try {
      await p.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (new URL(p.url()).pathname !== route) { await c.close(); continue; }
      await p.waitForTimeout(600);
      const n = await p.evaluate(applyLong, LONG);
      await p.waitForTimeout(250);
      const r = await p.evaluate(probe);
      if (r.overflow > 0) {
        breaks++;
        row.push(`${w}px:+${r.overflow}px`);
        console.log(`\n  ${route} @ ${w}px  +${r.overflow}px  (${n} fields replaced)`);
        for (const o of r.offenders) console.log(`     <${o.tag}> w=${o.w} R=${o.right} .${o.cls} "${o.text}"`);
      }
    } catch { row.push(`${w}px:ERR`); }
    await c.close();
  }
  console.log(`[${row.length ? "BREAK" : " ok  "}] ${route.padEnd(18)} ${row.join(" ") || "clean with realistic long content"}`);
}
console.log(`\nroutes broken by realistic long content: ${breaks}`);
await browser.close();
