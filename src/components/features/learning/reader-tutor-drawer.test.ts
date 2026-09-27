import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Geometri drawer tutor di `globals.css` — properties that render cannot check.
 *
 * `.reader-drawer` is the only rule that decides the drawer's box at `xl`, and
 * all of it is unlayered: an unlayered rule beats Tailwind's `@layer utilities`
 * regardless of specificity or order. typecheck, lint and vitest are all blind
 * to pixels, so the only guard is the assertions here, which read the file.
 *
 * What is locked:
 *
 * 1. **The sidebar is a full-viewport column.** `fixed` + `top: 0; bottom: 0`
 *    above `xl`. It used to be anchored inside the reading row, which only ever
 *    reached the *underside* of the focus bar, and was inset `1rem` at the top
 *    and `calc(--reader-foot-h + 1rem)` at the bottom — a measured **28px above
 *    and 77px below**, an eleventh of the column spent on empty canvas.
 * 2. **It is painted OVER the focus bar, and the bar does not move.** The bar is
 *    the reader's fixed frame of reference, so it must be byte-identical in both
 *    drawer states. Pinned as: no `transform`, no `left`/`right` offset and no
 *    width change anywhere in the `xl` override for `.reader-bar`, and
 *    `position: sticky` retained.
 * 3. **Neither bar moves, and no width channel exists.** Both `.reader-bar` and
 *    `.reader-foot-bar` are the reader's fixed frame, so neither may shift when
 *    the sidebar opens. Reaching the foot bar from CSS required a custom property
 *    carrying the drawer's width — and that obliges CSS to move every time the
 *    drawer moves, which is unsatisfiable by any formula. The channel is gone;
 *    the foot bar raises its `z-index` at `xl` instead.
 * 4. **The raised foot-bar layer is scoped to `xl`.** Below it the drawer is a
 *    full-screen sheet behind a scrim, and the bar must dim with the page.
 * 5. **`.reader-drawer` never declares `display`.** The closed state is the
 *    `hidden` utility; an unlayered `display` would keep a closed drawer
 *    visible, and because the utility loses too, nothing could close it again.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const CSS = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
/**
 * The same file with comments stripped, for whole-file "must not appear" checks.
 *
 * The notes explaining *why* the width channel was removed quote the very
 * declaration they removed, so a raw `toContain` over `CSS` would flag the
 * explanation as the regression. `rule()` is unaffected — it slices real
 * declarations out of the braces.
 */
const CSS_CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
const XL_MEDIA = "@media (min-width: 1280px)";

/**
 * The `ke`-th (1-based) rule for a selector, sliced by brace matching.
 *
 * A regex cannot do this: a `@media` block contains nested braces, so a pattern
 * spanning a nested rule is cut at the first brace *inside* it — exactly the
 * part under test. The older pattern in this directory
 * (`/\.reader-foot-bar \{[\s\S]*?\n\}/`) only ever worked because no
 * `.reader-foot-bar` rule lived inside an `@media`.
 */
function offsetOf(selector: string, ke: 1 | 2): number {
  let from = 0;
  for (let n = 1; n < ke; n++) {
    const next = CSS.indexOf(selector, from);
    expect(next, `${selector} occurs fewer than ${ke} time(s)`).toBeGreaterThanOrEqual(0);
    from = next + selector.length;
  }
  const start = CSS.indexOf(selector, from);
  expect(start, `${selector} occurrence #${ke} not found`).toBeGreaterThanOrEqual(0);
  return start;
}

function rule(selector: string, ke: 1 | 2): string {
  const start = offsetOf(selector, ke);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}") {
      depth--;
      if (depth === 0) return CSS.slice(start, i + 1);
    }
  }
  throw new Error(`block ${selector} is never closed`);
}

/**
 * Assert a rule lives inside `@media (min-width: 1280px)`, and return it.
 *
 * `lastIndexOf`, not `indexOf`, is the whole point: the file has several
 * `min-width: 1280px` queries, so searching *forward* from a rule lands on a
 * later one and the assertion would silently pass against the wrong block.
 */
function xlRule(selector: string): string {
  const at = offsetOf(selector, 2);
  const media = CSS.lastIndexOf(XL_MEDIA, at);
  expect(media, `${selector} is not inside an ${XL_MEDIA} block`).toBeGreaterThanOrEqual(0);
  return rule(selector, 2);
}

/** `z-index` declared by a rule, or `null` when it declares none. */
function zIndexOf(css: string): number | null {
  const found = css.match(/z-index:\s*(-?\d+)/);
  return found ? Number(found[1]) : null;
}

describe(".reader-drawer — a full-viewport column", () => {
  it("spans top edge to bottom edge at xl, with no inset", () => {
    const xl = xlRule(".reader-drawer {");
    // `fixed`, not `absolute` inside the reading row: only the viewport can put
    // the top edge at y=0, because the row starts below the bar.
    expect(xl).toMatch(/position:\s*fixed/);
    expect(xl).toMatch(/top:\s*0;/);
    expect(xl).toMatch(/bottom:\s*0;/);
    expect(xl).toMatch(/right:\s*0;/);
    // The insets are exactly the empty canvas that was reported: 16px above and
    // 16px below, measured as 28px and 77px once the phantom 12px
    // `KejadianPanel` wrapper was counted too.
    expect(xl).not.toContain("--reader-drawer-inset-y");
    // Nor any clearance for the foot bar: that is now spent horizontally, in
    // `right: var(--reader-drawer-w)` on `.reader-foot-bar`.
    expect(xl).not.toContain("--reader-foot-h");
  });

  it("hands its height to top/bottom — `height: auto` is load-bearing", () => {
    // The base rule pins `height: calc(100dvh - 2 * inset)`, and a specified
    // height beats `bottom` on an absolutely positioned box. Drop `height: auto`
    // and the drawer overruns the viewport, putting the chat composer off screen.
    expect(xlRule(".reader-drawer {")).toMatch(/height:\s*auto;/);
  });

  it("covers the focus bar, and the bar keeps the lower layer", () => {
    // The sidebar is painted over the bar (point 2 of the header). This asserts
    // the drawer does not quietly drop *below* it: that arrangement was tried and
    // reverted, because it left a white-on-white seam and the drawer's own
    // 1.25rem radius invisible against the bar.
    const z = zIndexOf(xlRule(".reader-drawer {")) ?? zIndexOf(rule(".reader-drawer {", 1));
    const bar = zIndexOf(rule(".reader-bar {", 1));
    expect(bar, ".reader-bar declares no z-index").not.toBeNull();
    expect(z, ".reader-drawer declares no z-index").not.toBeNull();
    expect(z!).toBeGreaterThan(bar!);
  });

  it("never declares `display`", () => {
    // The closed state is the `hidden` utility on the `<aside>`. An unlayered
    // `display` would keep a closed drawer visible, and since the utility also
    // loses, there would be no way to close it again.
    expect(rule(".reader-drawer {", 1)).not.toMatch(/display:/);
    expect(xlRule(".reader-drawer {")).not.toMatch(/display:/);
  });
});

describe(".reader-bar — never moves for the sidebar", () => {
  it("stays sticky and un-offset", () => {
    // The bar is the reader's frame of reference: its brand is the reader's exit,
    // its title and progress say where you are, and `Selesai` completes the
    // module. A first attempt shrank it by `--reader-drawer-w` and pulled it back
    // with a half-drawer `translateX` so its controls would clear the sidebar;
    // that moved all three on every toggle and was reverted.
    const base = rule(".reader-bar {", 1);
    expect(base).toMatch(/position:\s*sticky/);
    expect(base).not.toMatch(/transform/);
    expect(base).not.toMatch(/(^|[\s;])left:/m);
    expect(base).not.toMatch(/(^|[\s;])right:/m);
    // Width is the un-touched expression — no drawer token in it.
    expect(base).toContain("calc(100% - 2 * var(--page-pad) - 2 * var(--wing))");
    expect(base).not.toContain("--reader-drawer-w");
  });

  it("has no xl override at all", () => {
    // The strongest form of "does not move": nothing overrides it at `xl`. A
    // `.reader-bar` rule inside `@media (min-width: 1280px)` is exactly what
    // would reintroduce the slide.
    //
    // Checked against the 1280px block specifically, not "declared exactly once":
    // there *is* a legitimate second `.reader-bar` rule, inside
    // `@media (min-width: 769px)`, that only widens the padding and the corner
    // radius. A blanket count would flag that as the regression it is not.
    const media = CSS.indexOf("@media (min-width: 1280px)");
    const at = CSS.indexOf(".reader-bar {");
    if (media >= 0 && media < at) {
      // A 1280px query before the first rule: check whether any rule after it
      // is still inside that same query.
      const end = CSS.indexOf("\n}", media);
      expect(CSS.slice(media, end === -1 ? undefined : end)).not.toContain(".reader-bar {");
    }
    // Nothing after the base rule either, at any width.
    const semua = [...CSS.matchAll(/\.reader-bar \{/g)].map((m) => m.index!);
    const afterXl = semua.filter((i) => i > at);
    for (const i of afterXl) {
      const before = CSS.lastIndexOf("@media", i);
      expect(CSS.slice(before, i), `.reader-bar is re-declared at offset ${i}`).not.toMatch(
        /@media \(min-width: 1280px\)/,
      );
    }
    // And the bar must not be reading the drawer's width via a token on the shell.
    expect(rule(".reader-shell {", 1)).not.toContain("--reader-drawer-w");
  });
});

describe(".reader-foot-bar — never moves for the sidebar", () => {
  it("is centred on the viewport in both drawer states", () => {
    // The shift came from `right: var(--reader-drawer-w)`, which re-centred the
    // bar in the uncovered column and moved its centre from 756 to 260 at 1280.
    // The bar's own rule must therefore keep the plain centred form…
    const base = rule(".reader-foot-bar {", 1);
    expect(base).toMatch(/left:\s*0;/);
    expect(base).toMatch(/right:\s*0;/);
    expect(base).toMatch(/margin:\s*0 auto/);
    expect(base).not.toContain("--reader-drawer-w");
    // …and there must be no `xl` override of that position at all.
    expect(rule(".reader-shell {", 1)).not.toContain("--reader-drawer-w");
    expect(CSS_CODE).not.toContain("right: var(--reader-drawer-w");
    expect(CSS_CODE).not.toContain("--reader-drawer-w");
  });

  it("rises above the sidebar at xl instead of dodging it", () => {
    // The sidebar is full-height and starts at `100% - drawer width`, so on a
    // narrow desktop the bar's right end is genuinely underneath it — measured
    // 108px at 1280 with the default 520px drawer. A higher layer keeps the
    // buttons reachable without moving a pixel. Pinned against both neighbours:
    // under the drawer and they die, above the syllabus panel and the panel stops
    // covering them.
    const z = zIndexOf(xlRule(".reader-foot-bar {"));
    const drawer = zIndexOf(rule(".reader-drawer {", 1));
    const panel = zIndexOf(rule(".reader-panel {", 1));
    expect(z, "the xl foot bar declares no z-index").not.toBeNull();
    expect(z!).toBeGreaterThan(drawer!);
    expect(z!).toBeLessThan(panel!);
  });

  it("stays under the scrim below xl", () => {
    // Below `xl` the drawer is a full-screen sheet with a scrim at 30, and the bar
    // has to dim with the rest of the page rather than float undimmed above it.
    // The raised layer is scoped to `xl` for exactly this reason.
    expect(zIndexOf(rule(".reader-foot-bar {", 1))).toBe(20);
    expect(rule(".reader-foot-bar {", 1)).toMatch(/z-index:\s*20/);
  });
});

describe("source — no drawer-width channel", () => {
  /**
   * Source with comments stripped.
   *
   * The prose deliberately names `--reader-drawer-w` to explain why the channel
   * was removed, so a raw `toContain` over the file would flag the explanation
   * as the regression. Same helper the sibling tests use for this.
   */
  const drawer = readFileSync(
    path.join(ROOT, "src/components/features/learning/tutor-drawer.tsx"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

  it("publishes nothing to CSS", () => {
    // CSS cannot read a sibling's width, so the only way to reach `.reader-foot-bar`
    // was a custom property on `:root` — and that obliges CSS to move every time
    // the drawer moves. No formula satisfies "the bar never moves" through a
    // width channel; the layering does instead. Removing the property also removes
    // the effect that maintained it.
    expect(drawer).not.toContain("--reader-drawer-w");
    expect(drawer).not.toContain("setProperty");
    expect(drawer).not.toContain("document.documentElement");
  });

  it("keeps its own width in local state, persisted to localStorage", () => {
    // The drawer is still resizable; only the *reporting* of that width to CSS
    // went away. Checked from the source because the value is lazy-initialised
    // in the browser and never reaches server markup.
    expect(drawer).toContain("KUNCI_SIMPAN");
    expect(drawer).toContain("localStorage");
    // `tampil`, not `buka`: the width has to survive the closing animation, or
    // the drawer collapses to its content width while it is still on screen and
    // the exit reads as a jump followed by a slide.
    expect(drawer).toMatch(/style=\{tampil \? \{ width: `\$\{lebar\}px`/);
  });

  it("lets the frame shrink inside the drawer", () => {
    // The drawer is a padded flex column, so the frame gets less room than the
    // box. A flex item defaults to `min-height: auto`, which would refuse to
    // shrink and push the composer past the viewport edge.
    expect(drawer).toContain("min-h-0");
    expect(drawer).toMatch(/className="h-full min-h-0 w-full flex-1/);
  });
});

describe("motion — the drawer animates in and out", () => {
  /**
   * The animation must be attached to a state marker, never to `.reader-drawer`.
   *
   * This element is never unmounted (the iframe inside it holds the chat's
   * transcript and WebSocket), so it is `display: none` at load and stays that
   * way until the tutor is first opened. An `animation` in the base rule runs
   * exactly once — on that invisible first render — and then never again, since
   * no property of the rule ever changes. The result is a drawer that slides in
   * on load into nothing and pops open instantly forever after.
   */
  it("animates from a state marker, not from the base rule", () => {
    expect(rule(".reader-drawer {", 1)).not.toMatch(/animation/);
    expect(xlRule(".reader-drawer {")).not.toMatch(/animation/);
    expect(rule(".reader-drawer[data-buka] {", 1)).toMatch(
      /animation:\s*reader-drawer-masuk/,
    );
    // The exit repeats the **whole** shorthand, not just `animation-name`.
    //
    // This one is not cosmetic. The entrance's shorthand is what supplies
    // `animation-duration: 200ms`, and that rule stops matching the moment
    // `data-buka` comes off — which is exactly when the exit starts. `0s`, the
    // initial value, then applies, and the exit completes in ~9ms instead of
    // 200ms: the drawer vanishes with no motion, which is the very bug the
    // closing phase exists to prevent. Measured, not assumed.
    expect(rule(".reader-drawer[data-menutup] {", 1)).toMatch(
      /animation:\s*reader-drawer-keluar\s+\d+ms/,
    );
    expect(rule(".reader-drawer[data-menutup] {", 1)).not.toMatch(
      /animation-name:\s*reader-drawer-keluar/,
    );
  });

  it("sets the markers from source, and both bars still ignore them", () => {
    // The markers are what the keyframes hang off, so they have to reach the
    // element. `data-buka` is the open state and `data-menutup` is the closing
    // phase; without the second one the drawer is hidden by React before the exit
    // animation can be seen at all.
    const drawer = readFileSync(
      path.join(ROOT, "src/components/features/learning/tutor-drawer.tsx"),
      "utf8",
    );
    expect(drawer).toContain('data-buka={buka ? "" : undefined}');
    expect(drawer).toContain('data-menutup={!buka && sedangMenutup ? "" : undefined}');
    // The closing phase must keep the element on screen, i.e. `hidden` is gated
    // on `tampil` rather than on `buka`.
    expect(drawer).toMatch(/tampil\s*\n?\s*\? "fixed inset-y-0 right-0 z-40/);
    // And it must be released, or the `hidden` class never comes back.
    expect(drawer).toContain("onAnimationEnd");
    expect(drawer).toContain("setSedangMenutup(false)");
  });

  it("uses transform and opacity, never a layout property", () => {
    // `width`/`height`/`left` would relayout the iframe host on every frame for
    // the whole 200ms, and the chat app inside repaints against it. `transform`
    // and `opacity` are composited.
    const masuk = rule("@keyframes reader-drawer-masuk {", 1);
    const keluar = rule("@keyframes reader-drawer-keluar {", 1);
    for (const frames of [masuk, keluar]) {
      expect(frames).toMatch(/transform:\s*translateX\(/);
      expect(frames).not.toMatch(/(^|[\s;])width:/m);
      expect(frames).not.toMatch(/(^|[\s;])(left|right|top|bottom):/m);
      expect(frames).not.toMatch(/animation/);
    }
    // The exit is the exact reverse of the entrance, which is what lets a reopen
    // mid-exit retarget instead of jumping.
    expect(keluar).toMatch(/from\s*\{[^}]*translateX\(0\)/);
    expect(masuk).toMatch(/from\s*\{[^}]*translateX\(100%\)/);
    expect(keluar).toMatch(/to\s*\{[^}]*translateX\(100%\)/);
  });

  it("does not hand-roll reduced-motion handling", () => {
    // The global block near the top of the file already collapses every
    // animation to 0.01ms. `animationend` still fires there, so the closing phase
    // is released and nothing needs a second, divergent code path.
    expect(CSS.slice(0, CSS.indexOf("@keyframes reader-drawer-masuk"))).toMatch(
      /@media \(prefers-reduced-motion: reduce\)/,
    );
    expect(rule("@keyframes reader-drawer-masuk {", 1)).not.toMatch(
      /prefers-reduced-motion/,
    );
    expect(rule("@keyframes reader-drawer-keluar {", 1)).not.toMatch(
      /prefers-reduced-motion/,
    );
  });

  it("gives the resize grip a visible affordance", () => {
    // The grip is 4px and cannot be widened outward: at `xl` the drawer is
    // `overflow: hidden`, so anything past its left edge is clipped. The hint is
    // drawn inside it instead. Without this, the only cue that the drawer is
    // resizable is the cursor shape, which appears once you are already on it.
    expect(rule(".reader-drawer-grip::after {", 1)).toMatch(/opacity:\s*0;/);
    expect(CSS).toMatch(/\.reader-drawer-grip:hover::after[\s\S]{0,200}opacity:\s*1;/);
    // Dragging has its own marker, so the highlight survives leaving the 4px
    // strip — which is what happens the moment the gesture moves at all.
    expect(CSS).toContain(".reader-drawer-grip[data-menyeret]::after");
    // The old utility is gone: a blue background down the full height of the
    // column reads as a stripe, not a handle.
    expect(CSS_CODE).not.toContain("hover:bg-blue-200");
  });
});

describe("shell — no strip above the reading column", () => {
  it("does not render the session strip in the reader", () => {
    // Product owner removed the "Sesi terverifikasi aktif" strip from the
    // reader: it was chrome sitting directly above the reading column with no
    // value to the participant. Checked against the source because the panel
    // hides itself when no session runs, so a clean HTML render would not prove
    // the mount was actually removed for the running case.
    const shell = readFileSync(
      path.join(ROOT, "src/components/features/learning/materi-shell.tsx"),
      "utf8",
    );
    expect(shell).not.toContain("<KejadianPanel");
    // The spacing that used to live on the panel left with it: no always-rendered
    // padded wrapper should take its place above the reading column.
    expect(shell).not.toContain('className="px-3 pt-3 sm:px-5"');
  });
});