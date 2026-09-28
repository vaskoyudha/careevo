"use client";

/**
 * Motion for the "sembilan agen" section (`guild-agents.tsx`).
 *
 * The composition is a constellation: nine agent cards scattered around one
 * centred claim. The motion used to contradict that — a shared
 * `Reveal` (IntersectionObserver fade-up) plus `.guild-float`, a 7s vertical bob
 * that every card shared, so the "constellation" pulsed as one object. The
 * choreography here follows the picture instead:
 *
 *   1. Entrance. One timeline, fired when the section reaches the viewport. The
 *      cards fly in *from the centre outward*, staggered by their real distance
 *      from it, so the eye tracks outward the way the layout radiates. The
 *      headline reveals by line (the `<br/>` makes it exactly two), because at
 *      64px a line mask reads as editorial where a word-by-word crawl would
 *      just be slow.
 *   2. Ambient. Each card drifts on its own orbit with its own period, so the
 *      set never visibly loops. Replaces the uniform bob.
 *   3. Depth. Per-card scroll parallax, outer cards travelling further.
 *
 * Three wrapper elements per card, because three animations all want to write
 * `transform` and one element can only hold one: `data-ag="card"` owns the
 * scrubbed parallax (and keeps its Tailwind tilt, which GSAP parses and
 * preserves), `data-ag="enter"` owns the entrance, `data-ag="drift"` owns the
 * ambient loop. Collapsing any two of them makes the tween that starts later
 * overwrite the one before it, which reads as the card snapping.
 *
 * `prefers-reduced-motion` gets the markup untouched: no split, no entrance, no
 * drift, no parallax. The cards keep their resting tilt from CSS.
 */

import type * as React from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import {
  EASE,
  TEXT_MASK_CLASS,
  registerGsap,
  useIsomorphicLayoutEffect,
} from "@/lib/motion/gsap";

/** Cards are `hidden` below `lg`; a `display: none` box measures 0x0. */
function isMeasurable(el: HTMLElement) {
  return el.getClientRects().length > 0;
}

export function useGuildAgentsMotion(
  section: React.RefObject<HTMLElement | null>,
) {
  useIsomorphicLayoutEffect(() => {
    const root = section.current;
    if (!root) return;

    registerGsap();

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const pick = <T extends HTMLElement>(name: string) =>
        root.querySelector<T>(`[data-ag="${name}"]`);

      const title = pick<HTMLElement>("title");
      if (!title) return;

      const bracketL = pick<HTMLElement>("bracket-l");
      const bracketR = pick<HTMLElement>("bracket-r");
      const body = pick<HTMLElement>("body");
      const actions = pick<HTMLElement>("actions");

      const cards = Array.from(
        root.querySelectorAll<HTMLElement>('[data-ag="card"]'),
      ).filter(isMeasurable);

      // Cards are absolutely positioned, so their resting offsets live in CSS
      // classes and can only be read from layout. Measured once, here, rather
      // than derived from the position strings: those mix `left`/`right` and
      // `top`/`bottom` percentages, and re-deriving them in JS would be a second
      // definition free to drift from the stylesheet.
      const measured = cards
        .map((card) => {
          const enter = card.querySelector<HTMLElement>('[data-ag="enter"]');
          if (!enter || !isMeasurable(enter)) return null;
          const s = root.getBoundingClientRect();
          const r = enter.getBoundingClientRect();
          const x = s.left + s.width / 2 - (r.left + r.width / 2);
          const y = s.top + s.height / 2 - (r.top + r.height / 2);
          return { card, enter, x, y, dist: Math.hypot(x, y) };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .sort((a, b) => a.dist - b.dist);

      // No `autoSplit` on purpose. The headline's line break is a hard `<br/>`,
      // so the line boxes cannot change on resize, and the split only has to
      // survive until the entrance finishes. `autoSplit` would re-split and
      // re-run `onSplit`, appending a second copy of the line tween to a
      // timeline that has already played.
      const split = SplitText.create(title, {
        type: "lines",
        mask: "lines",
        // The heading is real content, so the full sentence goes to
        // `aria-label` and the per-line spans are hidden. Left unsplit it is
        // announced as two disconnected lines.
        aria: "auto",
        onSplit(self) {
          for (const mask of self.masks) {
            mask.classList.add(TEXT_MASK_CLASS);
          }
          return undefined;
        },
      });

      const tl = gsap.timeline({ paused: true });

      tl.from(
        [bracketL, bracketR].filter(Boolean) as HTMLElement[],
        {
          // Outward from the label, not a scale: a scale needs a
          // transform-origin, and the right bracket is a mirrored glyph, so
          // "inner edge" is not the same local side on both. Translation has no
          // such ambiguity.
          x: (i) => (i === 0 ? 14 : -14),
          scale: 0.7,
          autoAlpha: 0,
          duration: 0.5,
          ease: EASE,
        },
        0,
      )
        .from(
          split.lines,
          {
            yPercent: 112,
            duration: 0.9,
            ease: EASE,
            stagger: 0.1,
          },
          0.1,
        )
        .from(
          body,
          { y: 16, autoAlpha: 0, duration: 0.65, ease: EASE },
          0.78,
        )
        .from(
          actions,
          { y: 14, autoAlpha: 0, duration: 0.6, ease: EASE },
          0.9,
        );

      const CARD_START = 0.22;
      const CARD_EACH = 0.075;
      for (const [i, m] of measured.entries()) {
        tl.from(
          m.enter,
          {
            x: m.x,
            y: m.y,
            scale: 0.86,
            autoAlpha: 0,
            duration: 0.95,
            ease: EASE,
          },
          CARD_START + i * CARD_EACH,
        );
      }

      const entranceEnd = Math.max(
        1.8,
        CARD_START + measured.length * CARD_EACH + 0.95,
      );

      // Ambient orbit. Deterministic per index: `Math.random()` during render
      // would differ between server and client and trip a hydration mismatch,
      // and the periods deliberately differ so the nine cards fall out of sync
      // and the set never repeats.
      const drifts = measured.map(({ card }, i) => {
        const drift = card.querySelector<HTMLElement>('[data-ag="drift"]');
        if (!drift) return null;
        const span = 3 + (i % 3);
        return gsap.to(drift, {
          x: (i % 2 === 0 ? 1 : -1) * span,
          y: (i % 3 === 0 ? -1 : 1) * (2.5 + (i % 2) * 1.5),
          rotation: (i % 2 === 0 ? 1 : -1) * 1.1,
          duration: 9 + (i % 4) * 2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: entranceEnd + (i % 3) * 0.4,
        });
      });

      // Fire the entrance when the section comes up, not on mount: the hero
      // above is a full viewport, so a mount-triggered timeline would finish
      // entirely off-screen. 78% keeps it ahead of the fold without demanding a
      // dedicated scroll. `once` so it cannot replay on the way back up.
      ScrollTrigger.create({
        trigger: root,
        start: "top 78%",
        once: true,
        onEnter: () => tl.play(),
      });

      // Depth. Every card rises as the section scrolls past; the further it
      // sits from the centre, the further it travels, which is what separates
      // "a background image moved" from "these are separate objects in a space".
      const sec = root.getBoundingClientRect();
      const halfWidth = sec.width / 2 || 1;
      const parallax = measured.map(({ card }) => {
        const c = card.getBoundingClientRect();
        const offCentre = Math.min(
          1,
          Math.abs(c.left + c.width / 2 - (sec.left + halfWidth)) / halfWidth,
        );
        return { card, amount: -(18 + 30 * offCentre) };
      });

      const scrub = ScrollTrigger.create({
        trigger: root,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        onUpdate: (self) => {
          for (const p of parallax) {
            gsap.set(p.card, { y: p.amount * self.progress });
          }
        },
      });

      return () => {
        split.revert();
        scrub.kill();
        for (const d of drifts) d?.kill();
        tl.kill();
      };
    });

    return () => mm.revert();
  }, [section]);
}
