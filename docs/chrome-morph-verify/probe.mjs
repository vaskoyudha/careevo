// Objective measurement of the `.chrome` navbar morph.
//
// "Not smooth" has three possible causes, so all three are measured:
//   1. frame pacing  -> rAF gaps + longtask entries
//   2. layout work   -> CDP Performance.LayoutCount / LayoutDuration deltas
//   3. things moving -> the bar's own height, and the page content below it
//
// Run with:
//   playwright_run_code_unsafe({ filename: "docs/chrome-morph-verify/probe.mjs" })
async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const metrics = async () => {
    const { metrics: m } = await cdp.send("Performance.getMetrics");
    const o = {};
    for (const x of m) o[x.name] = x.value;
    return o;
  };

  // Settle at the top of the page first: the morph only happens on a state
  // change, and `scroll-behavior: smooth` would otherwise animate the probe's
  // own scroll and cross the 24px threshold mid-measurement.
  await page.evaluate(async () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 700));
  });
  const hasBar = await page.evaluate(() => !!document.querySelector(".chrome"));
  if (!hasBar) return { error: "no .chrome on this page" };

  const before = await metrics();
  const report = await page.evaluate(async () => {
    const bar = document.querySelector(".chrome");
    const main = bar.nextElementSibling;

    const longs = [];
    let po;
    try {
      po = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) longs.push(+e.duration.toFixed(0));
      });
      po.observe({ entryTypes: ["longtask"] });
    } catch {}

    const frames = [];
    let last = performance.now();
    let running = true;
    const tick = (t) => {
      const b = bar.getBoundingClientRect();
      const m = main ? main.getBoundingClientRect() : { top: 0 };
      frames.push({
        dt: +(t - last).toFixed(1),
        h: +b.height.toFixed(2),
        w: +b.width.toFixed(0),
        barTop: +b.top.toFixed(1),
        mainTop: +m.top.toFixed(1),
      });
      last = t;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    await new Promise((r) => requestAnimationFrame(r));
    window.scrollTo({ top: 30, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 900));
    running = false;
    po?.disconnect();

    const dts = frames.slice(1).map((f) => f.dt);
    const uniq = (k) => frames.map((f) => f[k]).filter((v, i, a) => i === 0 || v !== a[i - 1]);
    const range = (k) => {
      const v = frames.map((f) => f[k]);
      return { min: Math.min(...v), max: Math.max(...v), distinct: new Set(v).size };
    };
    return {
      frames: frames.length,
      maxFrameGapMs: Math.max(...dts),
      framesOver25ms: dts.filter((d) => d > 25).length,
      longTasksMs: longs,
      // A bar whose height changes is a sticky box whose flow footprint
      // changes, so everything below it re-lays-out on every frame.
      barHeight: range("h"),
      width: { min: Math.min(...frames.map((f) => f.w)), max: Math.max(...frames.map((f) => f.w)) },
      widthFrames: uniq("w").length,
      // The page content below the bar must not move at all.
      mainTop: range("mainTop"),
      mainTopTrace: uniq("mainTop"),
      settled: frames[frames.length - 1],
    };
  });
  const after = await metrics();

  return {
    ...report,
    layoutCount: after.LayoutCount - before.LayoutCount,
    layoutMs: +(after.LayoutDuration * 1000).toFixed(1).replace(/000$/, ""),
    layoutMsRaw: +((after.LayoutDuration - before.LayoutDuration) * 1000).toFixed(1),
    recalcStyleCount: after.RecalcStyleCount - before.RecalcStyleCount,
  };
}
