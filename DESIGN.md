# Careevo Design

> Source of truth for the shared visual language. Read this before changing Careevo UI.
> Runtime tokens live in `src/app/globals.css`; this file records the decisions those tokens support.

## Aesthetic direction

Calm editorial technology: oceanic blue and aqua, generous whitespace, crisp ink typography, and selective dithered imagery for high-impact learning moments.

## Dials

- DESIGN_VARIANCE: 7 / 10
- MOTION_INTENSITY: 4 / 10
- VISUAL_DENSITY: 5 / 10

## Typography

- Display and body: Inter, loaded through `next/font/google` in `src/app/layout.tsx`.
- Fallback: SF Pro / Segoe UI stack from `--font` in `src/app/globals.css`.
- Display headings use tight tracking and controlled line height; body copy stays at least `1.5` line height.
- Do not add another type family for an isolated component. A project-wide font migration is a separate task.

## Core colors

```css
:root {
  --bg-base: #ecf3f7;
  --bg-soft: #e2eef4;
  --ocean-deep: #0a3d62;
  --ocean: #124e78;
  --ocean-mid: #2a7fb8;
  --text: #0a2a3a;
  --text-secondary: #48606e;
  --leaf-dark: #1f6b40;
  --aqua: #2ec4b6;
}
```

- Primary action: the blue ramp in `--brand-grad` (`src/app/globals.css`). It is the single source for the navbar `Daftar` button, `.grad-btn`, `.btn-primary` and the shadcn `brand` variant — never re-spell the hexes, resolve the token.
- Learner surfaces still carry the flat `#0056D2` primary for inline links, focus rings and badges. That is a deliberate second blue, not a competing CTA: only filled primary **buttons** take the ramp.
- The ramp is the navbar `Daftar` button's original gradient, verbatim: `#3b82f6 → #60a5fa → #bfdbfe`, border `#93c5fd`, shadow `0 1px 2px 0 rgba(0,0,0,0.05)`. The pale `#bfdbfe` tail is the look and is kept deliberately. It is **not** AA-safe for a white label (~1.5:1 at the pale end) — a known, accepted tradeoff, so do not silently re-darken it. If the label ever must pass contrast, fix the *text* (darker label or a text shadow), not the gradient: the gradient is the brand.
- AI Mastery's light themes use the same ramp as `--primary-gradient` (`features/sijago/app/globals.css`), applied only through the `.btn-primary` marker class and only when `:root:not(.dark)`, so Dark and Glass keep their flat `--primary` and the pre-existing purple Glass override.
- Surfaces use cool tinted neutrals, never flat pure black or pure white as large backgrounds.
- Status colors: success green, warning amber, danger coral. `--leaf` green is reserved for success/status affordances (streaks, checkmarks) and must not colour a primary button.
- Do not introduce purple-to-blue gradients or more than one new accent per surface.

## Layout

- Shared maximum width: `1280px` (`--max`), with `24px` desktop page padding.
- Marketing and catalog heroes may be centered when the composition calls for one; application and dashboard layouts default to left-aligned, operational composition.
- Mobile uses one column with at least `16px` side padding.
- Learner catalog pages use `LearnerShell`; dashboard-style pages use `AppShell`.
- `/belajar/mastery`, `/belajar/buku` and `/belajar/latihan` are the focus-workspace exception and own their full-height shell.

## Navigation contract

There are exactly two shared navbars:

- `Chrome` for public and marketing routes.
- `LearnerChrome` through `LearnerShell` for learner routes.

Both use `.chrome`, `.is-top`, and `.is-scrolled` from `src/app/globals.css`, including the 24px scroll threshold and 320ms morph. Do not create a third navbar style. `/belajar` may set `overlayMain` on `LearnerShell` so its image hero sits behind the transparent full-width state, then uses the same floating pill after scrolling.

## Components and surfaces

- Buttons: rounded pill for focused marketing actions, 14px radius for product controls.
- Text-sized navbar buttons carry extra right padding (`0 1.35rem 0 1rem`) because the ramp runs light→dark toward the lower right; a geometrically centred label reads off-centre without it. The `max-width: 560px` block in `globals.css` collapses this to symmetric padding on small screens.
- The navbar actions row owns its own right inset (`.chrome-actions { padding-right }`) so the last button never reads flush against the viewport edge, in either the transparent or the floating-pill state.
- Cards: one elevation layer only; use borders and tinted shadows before adding more nested surfaces.
- Hero media: `DitheredHeroBackdrop` may be used behind readable content; only a subtle bottom boundary fade is allowed to meet the next section. Do not add a full-surface scrim or image opacity overlay. The backdrop must stop for reduced-motion users and while offscreen.
- The same media may head a **card** rather than a hero. `src/components/ui/pita-header-dither.tsx` (`PitaHeaderDither`) is the band: it carries the ground, dot grid, `DitheredHeroBackdrop`, veil and bottom fade, so a card never re-spells them (three hand-copied ramps is how the blue drifts per card). Its media is light, so the content on it must be dark ink (`#0a3d62`), never white.
  - A band like that is **read as the top of a sheet the content sits on**: the white body overlaps it by the sheet's own radius (`relative z-10 -mt-4 rounded-t-2xl bg-white`), the same recipe as the catalog card's `-mt-8`, only smaller because the band is a 72px strip and not a 4:3 thumbnail. `-mt-4` equals the 16px radius so the full curve of both top corners reveals the band behind it; the `bg-white` covers the 16px it takes, and `relative` + `z-10` keeps the band — itself `relative` — from painting over the sheet. Dropping the negative margin, the fill, or the z-index silently flattens the top back to a square white block, and no gate in the repo can see it. Used by the `/loker/inbox` recommendation panel (`kartu-rekomendasi-profil.tsx`).
- Forms: visible labels or accessible names, 44px minimum touch targets, and visible focus rings.
- Icons: Lucide/Phosphor-style line icons; no emoji as interface iconography.
- Catalog course card: the single recipe lives in `src/components/ui/catalog-course-card.tsx` (`CatalogCourseCard` + `courseMetaFor`) and is consumed by `/belajar`, `/jelajah`, and `/dashboard` recommendations. Change it there, never per-page.
  - Shell: `rounded-xl border border-gray-200 bg-white shadow-xs hover:shadow-md` — one elevation declaration only, no nested cards.
  - The white body is a **rounded sheet that overlaps the thumbnail**, not a square block under it: `relative z-10 -mt-8 rounded-t-2xl bg-white`. The 16px top radius only reads as rounded because the thumbnail shows through those two corners — dropping the negative margin, the `bg-white`, or the `z-10` (the thumbnail link is `relative`, so it would otherwise paint over the body) silently flattens the top back to square.
  - Anatomy (source: `/belajar`): 4:3 thumbnail with a top-left credential pill; provider row with a `#0056D2` initial fallback when the logo is missing; bold title; rating row; meta line (level · hours); footer with a `bg-blue-50 text-[#0056D2]` pill and a Gratis / Careevo Plus state. 4:3 rather than 16:9 — the wider ratio left the thumbnail too short to read at card size.
  - Provider logos and ratings come only from `courseMetaFor`; do not invent artwork, discounts, ratings, or thumbnails.
  - Radii stay in the 12–16px floor; body text keeps AA contrast; no gradient text, kickers, or nested-card decoration.

## Motion

- Default easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Standard UI transition: 180–220ms.
- Hero backdrop: slow ambient motion only; no bounce or elastic movement.
- Respect `prefers-reduced-motion`; global CSS reduces animation and transition durations.

## Voice

- Indonesian product copy, direct and encouraging.
- Prefer concrete outcomes and active verbs.
- Avoid generic claims such as “seamless”, “unleash”, or “next-generation”.

## Accessibility floor

- WCAG 2.2 AA contrast for body text and controls.
- Keyboard-visible focus states and semantic heading order.
- Touch targets are at least 44×44px on mobile.
- Motion and autoplay media respect reduced-motion preferences.
- Decorative images and canvases are ignored by assistive technology.

## Last updated

- 2026-09-25 — documented the centered `/belajar` hero, dithered learning-media direction, and learner-shell rules.
- 2026-09-26 — recorded the shared catalog-course-card recipe; `/jelajah` and `/dashboard` now adopt the `/belajar` card + container language via `CatalogCourseCard`.
- 2026-10-01 — restructured the learner dashboard into the reference's card grid: a greeting band with the weekly-hours target, a Sen–Min day-dot strip on the streak card, a tier chip on the score card, a course thumbnail on "Lanjutkan belajar", and a per-course progress list. Cards moved from `rounded-xl` to `rounded-2xl`. Every figure stays server-computed (`ringkasKehadiran`, `mingguAktif`, `hitungSkorIntegritas`, `listProgresKursus`); the day strip and the tier are derived on the server, never in the browser.
- 2026-10-02 — gave the dashboard its own card skin, measured off `docs/design-references`-style reference at 1586×992. Each card is a near-white sheet falling to pale sky blue (`#fdfdfe → #e3effc`) with a blue-tinted 1px border and one shadow; the certificate card is the mint variant. Tokens (`--dash-card-*`) and the `.dash-card` / `.dash-card-head` / `.dash-icon` / `.dash-gap-*` / `.dash-figure` classes live in `globals.css` under "DASHBOARD CARD SKIN", scoped to `.dashboard-shell`, so no component re-spells a gradient. Density was the point: `dash-gap-*` names the 4/8/12px gaps the reference actually uses (the row had grown to 349px against the reference's 256px by giving every sibling `mt-4`); inner padding is 16px on all four sides and the figure is 28px/1.1. Card hover lifts the shadow only, 150ms on the strong `--ease-out-strong` curve, and stops entirely under reduced motion.
- 2026-10-02 — the dashboard is now a **bento mosaic**, not a uniform 3-up (`globals.css` "DASHBOARD BENTO GRID"). At `xl` it is a 6-column `grid-template-areas`: a row of three equal stat tiles, then a certificate tile beside a tall "Progres Kursus" tile, then "Lanjutkan Belajar" **full-width** as the closing call to action (it carries the thumbnail, the progress bar and the primary CTA, so it reads as the page's main action once nothing sits beside it). Below `xl` it degrades to 2 columns (640px+) and 1 column. **Areas are named, never `nth-child`** — placing tiles by JSX order means reordering the page silently swaps two cards' sizes instead of failing — and the **DOM order matches the `xl` visual order** so shrinking the window never swaps two cards, and screen readers read them in the order they appear. Lower breakpoints use `align-items: start` so a short tile is not stretched to a tall neighbour's height; at `xl` tiles stretch, because filling a named cell is the point of the mosaic. Each card sits in a `.dash-sel-<nama>` wrapper (`display: grid`), so it fills its area without any card needing an `h-full` prop, and `dashboard-integritas.test.ts` locks each card to its named slot.
- 2026-10-02 — the greeting band (`.dash-hero`) is **plain white**, not a blue-sky wash. The layered gradient made it read as a decorated banner and pulled the eye away from the learner's own numbers in the tiles below. It keeps the card family's border and shadow tokens, so band and tiles are visibly the same kind of surface with only the fill differing; its inner "Progres Anda hari ini" chip moved to `bg-blue-50/70` so it still separates against white.
- 2026-10-02 — the greeting band gained a **profile avatar on its far left** (`.dash-hero-avatar`, 56px, initial from the learner's name). The band is where the learner is already looking, and it was the one surface showing no sign of who they are. Tinted rather than solid brand blue on purpose: the `Profilmu` tile directly below already wears a solid avatar for the same person, and two differently-styled avatars of one learner on one screen read as two accounts.
- 2026-10-02 — the "Dipilih untukmu" course recommendations are now wrapped in one **blue tray** (`.dash-reco-kursus`, `globals.css` under "DASHBOARD RECOMMENDATION TRAY") so the four cards read as a single curated group instead of four loose cards on the white panel. The tray reuses the pale-sky fall of the dashboard card skin (one shade deeper than the panel) rather than adding a fifth blue; the cards themselves stay opaque white (`.dash-reco-card` cancels the fill) so each still lifts off the blue and the tray gradient only shows in the gutters around the set. The section heading gained a `GraduationCap` icon and a count badge, matching the "Loker" heading's icon+count language.
- 2026-10-02 — the `/belajar` "Hasil karier" social-proof panel (`CareerOutcomePanel`) is now a **photographic surface**: `public/images/belajar/hasil-karier-hero.webp` (1715×917) replaces the pale gradient, the two blurred glows and the dot grid, and the panel's hand-drawn SVG progress ring is **removed** — the artwork is itself a `91%` ring, so keeping both put two rings ~4% apart on one screen. The composition is a function of the artwork's own banding: because the drawn figure is redundant with the headline but the artwork's ring reads as chrome (like the LEARN/GROW/CAREER chips), the source is used whole below `lg` as a proportional block (top 76%, faded into white at its cut edge — a hard cut through a cyan arc reads as a fault) and, from `lg` up, as a full-bleed backdrop pushed to `object-[72%_50%]` so the baked-in figure tucks under the pale right-hand sky and only the ring shows beside the copy. A left-to-right white wash (0.9 → 0) holds the copy over the pale left half the artwork already had; measured, that half's brightest pixel is pure white and the navy bar labels still clear 7.5:1 on `#ddf0fd`. The panel's CTA is now `LandingBtnLink` (`.grad-btn` → `--brand-grad`), the same recipe as the navbar `Daftar`, rather than a flat `#0056D2` pill — the last filled CTA in the panel not taking the ramp. The `lg` two-column template survives with one child: the artwork occupies the right column, the first track still holds the copy off the ring, and below `lg` a 34rem cap does the same job.
- 2026-10-02 — the `/loker/inbox` "Cocok Untukmu" panel is now the **house band + overlapping sheet**, not a hand-rolled azure ramp. Its header is `PitaHeaderDither` (the same `DitheredHeroBackdrop`/crop/veil/fade recipe as the `/belajar` hero, so the blue can't drift from it), and the body beneath is a white sheet with a 16px rounded top that overlaps the band by 16px (`relative z-10 -mt-4 rounded-t-2xl bg-white`) — the same device DESIGN.md already records for the catalog card, at the smaller offset a 72px strip needs. The white sheet is what makes the rounded top *read*: the band shows through both curves. The panel's four job cards keep their `.dash-card` bento surface, and the sheet carries the subtitle, the horizontal-snap card strip, and the footer, so `lg` scroll still belongs to the list rather than the sheet.
