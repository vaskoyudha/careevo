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
- 2026-10-02 — the `/loker/inbox` "Cocok Untukmu" panel's header is a **static sky gradient** (`from-[#8FC0F2] via-[#BAE6FD] to-[#DDEEFE]`) with the 3px dot grid as texture, and the body beneath it is a **white sheet with a 16px rounded top that overlaps the header by 16px** (`relative z-10 -mt-4 rounded-t-2xl bg-white`) — the same device DESIGN.md already records for the catalog card, at the smaller offset a 72px strip needs. The white sheet is what makes the rounded top *read*: the gradient shows through both curves, so the top-left/top-right corners are visibly sheets-over-a-band instead of a square block under it. Measured contrast on the gradient's darkest stop (`#8FC0F2`): title `#0a3d62` 5.92:1, subtitle `#1e293b` 7.66:1; the "Ubah" chip is full `bg-white` because brand `#0056D2` is only 3.37:1 on that stop but 6.44:1 on white. The panel's four job cards keep their `.dash-card` bento surface, and the sheet carries the subtitle, the horizontal-snap card strip, and the footer, so `lg` scroll still belongs to the list rather than the sheet.
- 2026-10-03 — the `/belajar/[slug]` "Challenge praktik" card went from **a header band plus a white sheet** to **one container whose background is the whole wallpaper**. The 2026-10-02 entry below stopped at "the image is the wallpaper, filling the band edge to edge" — right about the picture, still wrong about the card: an `aspect-[1774/887]` band on top and a `bg-white` sheet below it were two stacked white surfaces, so the card read as two objects instead of one. Now the single `<Image fill object-cover>` is a **direct child of `<section>`** and covers the card box entirely; `<section>` lost its `bg-white`, and the content sheet lost `-mt-4 rounded-t-2xl bg-white` and is a plain `relative z-10 px-5 pt-8` stack. No white surface is left between the artwork and the copy. `rounded-t-2xl`/`-mt-4` went with it — that device exists to make a rounded top *read* against a band behind it, and once the whole card is wallpaper there is no edge left to expose. `overflow-hidden` + `rounded-2xl` stay on `<section>` so `object-cover` is clipped to the card radius. There is still **no wash and no scrim**; readability is carried by the artwork's own pale field, measured on the rendered card (1086×378, cover scale 0.612, source rows 135–752): title `#0a3d62` 4.91:1 against the *darkest* pixel in its box (mean 10.39:1), heading `gray-900` 9.69:1, brief `gray-600` 5.97:1 — all clear AA with no overlay. The `criteria` block keeps its own `rounded-xl bg-blue-50 ring-1 ring-blue-100`: it is a scoring panel, not a white card, and `text-gray-600` at 11px sits at only ~4.4:1 on that tint.
- 2026-10-02 — the `/belajar/[slug]` "Challenge praktik" card's header is now a **static image, not dithered media**: `public/images/belajar/challenge-praktik-hero.webp` (1774×887, from `ChatGPT Image Sep 30, 2026, 05_57_20 PM.png`) replaces `PitaHeaderDither` on this one card. A card header is not a hero: four layers (ground + dot grid + WebGL-dithered video + veil) for a short title strip bought nothing the artwork itself doesn't already draw (sky, dot grid, glass chart cards), and it tied this card's crop to a video geometry measured for the hero.  A directional white wash was tried and removed: it covered the left ~55% of the image at alpha up to 0.95, which is what made the band read as an empty pale rectangle instead of a wallpaper. Without it, no `text-white` (which would sit at ~1.1:1) and no scrim is needed. The `criteria` list moved into its own `rounded-xl bg-blue-50 ring-1 ring-blue-100` block (matching the level chip's vocabulary) instead of four loose rows, and its eyebrow went `text-gray-500`→`text-gray-600` because #6b7280 drops to 4.01:1 on that tint. **Superseded in part by the 2026-10-03 entry above**: the band ratio, the white sheet, and the overlap device are all gone — the artwork is now the card's full background. **Note:** with both this card and the loker panel off it, `PitaHeaderDither` (`src/components/ui/pita-header-dither.tsx`) now has no render consumers — it is kept as the documented recipe, not deleted unilaterally.
- 2026-10-03 — the `/belajar/[slug]` sidebar's two filled CTAs now take the **brand ramp** instead of their own flat fills: "Lanjutkan belajar" (`detail-kursus.tsx`) drops `bg-gray-900` for the `brand-fill` class (`--brand-grad`, the navbar `Daftar` recipe), and "Tanya tutor AI" (`kursus-ai-panel.tsx`) drops flat `#0056D2` for the same class. Both keep their own radius — `--radius-md` for "Lanjutkan belajar" and a pill for the AI panel's standalone CTA — so only the fill changes, not the shapes DESIGN.md line 66 already split. Border and hover resolve from `--brand-border` / `--brand-border-hover`; no hex is re-spelled.
- 2026-10-03 — the `/careevo-plus` hero was rebuilt around three fixes to the artwork column (`careevo-plus/hero.tsx`). **The "Careevo PLUS" logo badge is gone from the left column**: the page header and the sticky sub-nav both already announce the product, so the badge was a third mark saying the same thing and pushing the headline — the one line that carries the offer — down the column. **The blue ribbon SVG is gone**: it painted a `#93C5FD → #3B82F6` band down the gutter between the price card and the track chips, which is the "blue effect" behind the cards; the white surfaces now sit directly on the dithered ground and carry their own shadows, so nothing decorative needs to be read through. **The price card is larger** (300px wide, 20/24px padding, 36/38px figure against the old 268px/16px/32px) and **three floating inclusion chips were added** — Socrates AI, Sertifikat HMAC, Uji coba 7 hari — each a white card hung off the cluster's edge. The offsets are computed, not decorative: a chip is 48px tall and its `-top-8`/`-bottom-8` reach is 32px against the card's 24px padding, so a chip may cross the card's whole width and still only ever sit on padding, never on a figure. The float is `@lg`-gated (a `@container` on the artwork box, 512px): below that the column stacks and the chips fall in under the track rail as ordinary rows, because a corner-hung card has no corner to hang from and no gutter to hang into once a single column is ~320px. Measured clean 320–2560px with no horizontal overflow.
- 2026-10-03 — the reader syllabus panel's header title (`.reader-panel-judul`) is now **the selected module's name**, not the course name, whenever the panel is narrowed to one module. The sub-module design (`docs/superpowers/specs/2026-10-02-submodul-design.md` §5) already said "judul panel = nama modul", but the implementation had drifted: the head kept writing `kursusJudul` ("Dasar C++") while the module name was rendered as a small uppercase eyebrow inside the rail — so a learner who picked a module still read the course name as the title, and the panel carried **two** titles with the same words. The head (`IsiPanelSilabus`) now owns the title and picks the module name when `tampilan === "modul"`; the course name is demoted to the context line beside the provider (`Dasar C++ · Careevo`, `.reader-panel-penyedia`), because the panel covers the bar that holds its small copy. The course-list view is unchanged (title = course name, provider line = provider alone). `materi-rail.tsx` drops the duplicate eyebrow and now renders its action row only when `aksi` is supplied, so the chapter list starts at the first chapter.
