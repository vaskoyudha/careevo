# Navbar morph verification

Evidence for the `.chrome` full-width ⇄ floating-pill morph in
`src/app/globals.css`. The complaint was "the animation to expand full width is
not smooth" — which is a perception, not a frame-rate number, so this folder
records what was actually measured, before and after.

## Run it

The repo has no browser test runner (`vitest.config.mts` is `environment: "node"`),
so this is a manual gate driven through the browser tools:

```js
// playwright_run_code_unsafe({ filename: "docs/chrome-morph-verify/probe.mjs" })
// with a dev server on :3000 and the tab on a page that has a `.chrome`
```

`probe.mjs` triggers the morph with an **instant** scroll from 0 to 30px (the
threshold is `scrollY > 24`) and reports three separate things, because
"janky" has three possible causes:

1. **frame pacing** — `requestAnimationFrame` gaps and `longtask` entries
2. **layout work** — CDP `Performance.LayoutCount` / `LayoutDuration` deltas
3. **things that move** — the bar's own height, and the page content below it

> `html` has `scroll-behavior: smooth`, so a plain `window.scrollTo(0, 30)`
> animates and crosses the threshold mid-measurement. The probe passes
> `behavior: "instant"` on purpose.

## What was wrong

| | before | after |
|---|---|---|
| bar height during the morph | 18 distinct values, `66 → 69.19 → 66` | **1** (`66`) |
| content below the bar | 20 distinct positions, **12.8px of travel** | **2** (the 30px scroll, nothing else) |
| `maxFrameGapMs` | 33.4 (one frame dropped) | 16.7 |
| `LayoutDuration` | 3.4ms | 1.9ms |
| pill surface, frame 0 | already at full 0.86 opacity | 0 |

Three separate causes, all in the same 320ms animation:

- **`padding` + `margin-top` differed between the two states.** A sticky bar is in
  normal flow, so both of those re-lay-out *every element below it* on every
  frame. The page visibly slid 12.8px downward while the bar moved — the thing
  that actually reads as "not smooth", at a perfectly steady 60fps.
- **`border-width` was never transitioned** (only `border-color` was), so the
  pill's 1px border appeared in frame one and the bar jumped 2px taller before the
  padding transition had started.
- **`background-image` is not interpolable in this engine** (verified: two
  `linear-gradient`s of the same shape go straight from one value to the other),
  so the frosted surface appeared at full opacity in frame one while its edge and
  shadow were still cross-fading over the full 320ms.

## What changed

`src/app/globals.css`, `.chrome` only — no JSX, no DOM change:

- Padding, `border-width` and `top` moved onto the base `.chrome` rule so the
  bar's **flow box is identical in both states**; the pill's 14px of air is
  `transform: translateY(14px)`, which is composited and moves nothing in flow.
- The pill surface moved to `.chrome:not(.is-winged)::before` and fades in on
  `opacity`, so it arrives as one piece instead of three.
- `backdrop-filter` is a delayed discrete flip (260ms), so the blur is never
  re-taken over a box that is still resizing.

## Frozen frames

`before-000-surface-flash.png` vs `after-000.png` / `after-160.png` /
`after-320.png` — the same three moments of the morph, with every transition
paused via `getAnimations({ subtree: true })`. Note that the pseudo-element's
transition only exists a frame or two *after* the class flip, so the freeze has
to wait for it or the surface animates freely while the geometry holds still.

## Also checked, unchanged

- **AI Mastery bar** (`/ai-mastery`, `is-winged`): both pseudos are still the
  wings (`left: -44px` / `left: 1278px`, radial-gradient, `opacity: 1`), the bar
  keeps its own flat `--wing-fill` and shadow, `--app-chrome-h: 64px`. The
  `:not(.is-winged)` on the surface rule is what keeps this true.
- **`ScrollSubNav`** (`/careevo-plus`): `--chrome-float-bottom` tracks the pill's
  bottom exactly (102px in the top state, 80px floated) because
  `getBoundingClientRect()` includes transforms.
- **Mobile 390px** (`/belajar`): 62px tall in both states, pill 358px wide.
- **Dark-hero bars** (`/loker`, `/kerja`): `is-dark-hero` still flips off at the
  threshold, nav ink goes white → black.
- **Explore mega-menu**: still viewport-anchored and centred (942px wide at
  1440px), hanging 8px below the trigger.

### Known, pre-existing, not from this change

Opening the Explore panel and jumping the scroll in a *single* step leaves the
panel 6.5px high: `measurePanel()` runs on the scroll event, reads the trigger's
mid-morph position, and no further scroll event corrects it. A second scroll
event fixes it. It predates this change — the trigger's bottom was already
travelling during the morph.
