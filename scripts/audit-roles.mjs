#!/usr/bin/env node
/**
 * Audit the routes the main sweep cannot reach, logging in as each role that
 * can. `/performa`, `/audit` and `/review` live behind the (verifikator) group;
 * `/onboarding` and `/jelajah` have their own redirect logic.
 *
 * Companion to `audit-mobile.mjs` — see that file for the `playwright` and
 * dev-server prerequisites. Demo accounts are defined in
 * `src/lib/auth/demo-accounts.ts`; this hardcodes the same three emails, so it
 * needs `NODE_ENV=development` + `DEMO_MODE=1` on the server, exactly like
 * `npm run seed:demo`.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PW = "careevo";

const TARGETS = [
  { route: "/jelajah", as: "user@careevo.test" },
  { route: "/onboarding", as: "user@careevo.test" },
  { route: "/performa", as: "verifikator@careevo.test" },
  { route: "/audit", as: "verifikator@careevo.test" },
  { route: "/review", as: "verifikator@careevo.test" },
  { route: "/performa", as: "admin@careevo.test" },
  { route: "/admin/courses", as: "admin@careevo.test" },
  { route: "/admin/kuis", as: "admin@careevo.test" },
];

const WIDTHS = [320, 375, 768];

function probe() {
  const vw = document.documentElement.clientWidth;
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
    let ancestor = false;
    for (const o of offenders) if (o.el.contains(el)) { ancestor = true; break; }
    if (ancestor) continue;
    offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || "").toString().slice(0, 100),
      text: (el.textContent || "").trim().slice(0, 45),
      w: Math.round(r.width), right: Math.round(r.right), el,
    });
  }
  const small = [];
  for (const el of document.querySelectorAll('a[href],button,input,select,textarea,[role="button"]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.tagName === "A" && el.closest("p,li,.prose")) continue;
    if (r.height < 44 || r.width < 44) {
      small.push({ tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().slice(0, 80), w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || el.value || "").trim().slice(0, 35), el });
    }
  }
  const TEXT = /^(text|search|url|email|tel|password|number|date|time|datetime-local|month|week)$/;
  const smallInput = [];
  for (const el of document.querySelectorAll("input,textarea,select")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.tagName === "INPUT" && !TEXT.test(el.getAttribute("type") || "text")) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 16) smallInput.push({ tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().slice(0, 80), fs });
  }
  const d = (o) => ({ tag: o.tag, cls: o.cls, w: o.w, h: o.h, fs: o.fs, right: o.right, text: o.text });
  return {
    vw,
    scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw,
    offenders: offenders.slice(0, 5).map(d),
    small: small.slice(0, 5).map(d),
    smallInput: smallInput.slice(0, 5),
  };
}

const browser = await chromium.launch();
const states = {};
for (const email of [...new Set(TARGETS.map((t) => t.as))]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/masuk", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1500);
  states[email] = await ctx.storageState();
  console.log(`# ${email} -> ${new URL(page.url()).pathname}`);
  await ctx.close();
}
console.log("");

for (const { route, as } of TARGETS) {
  const marks = [];
  let note = null;
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 900 },
      isMobile: w < 700, hasTouch: true,
      storageState: states[as],
    });
    const page = await ctx.newPage();
    const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    const landed = new URL(page.url()).pathname;
    if (landed !== route) { note = `redirect -> ${landed} (${resp.status()})`; await ctx.close(); break; }
    await page.waitForTimeout(500);
    const r = await page.evaluate(probe);
    marks.push({ w, ...r });
    await ctx.close();
  }
  const bad = marks.filter((m) => m.scrollW > 0);
  console.log(`[${note ? "SKIP" : bad.length ? "BREAK" : " ok "}] ${route.padEnd(16)} ${as.split("@")[0].padEnd(11)} ${note || bad.map((b) => `${b.w}px:+${b.scrollW}px`).join(" ") || "clean"}`);
  for (const m of bad) {
    console.log(`      @${m.w}px offenders:`);
    for (const o of m.offenders) console.log(`        <${o.tag}> w=${o.w} R=${o.right} .${o.cls} "${o.text}"`);
  }
  for (const m of marks) {
    if (m.smallInput?.length) console.log(`      @${m.w}px small input: ${m.smallInput.map((s) => `<${s.tag}> ${s.fs}px`).join(" ")}`);
  }
}
await browser.close();
