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
