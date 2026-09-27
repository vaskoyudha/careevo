"use client";

/**
 * Motion for the "Tiga langkah nyata" section (`features.tsx`).
 *
 * The section's own premise is a **sequence**: 01 → 02 → 03. It was animated as
 * three independent `Reveal` fade-ups 80ms apart, which is the generic answer
 * and throws away the only thing the numbering means. The choreography here
 * follows the premise instead:
 *
 *   1. Header. The pill, then the headline revealed word by word — so
 *      "belajar," / "buktikan," / "dan siap kerja" land in reading order and the
 *      headline enacts the three steps it announces — then the lede and CTAs.
 *   2. Cards. They land as a sequence, each step badge popping in a beat after
 *      its own card.
 *   3. Connectors. A hairline with an arrowhead *draws itself* across each gap
 *      between cards. This is the move that makes three boxes read as one
 *      process: it is the only element in the section that points somewhere.
 *   4. Depth. The wallpaper drifts and grows very slowly as you scroll past, so
 *      the sky behaves like sky rather than like a JPEG.
 *
 * One transform owner per element: a card's entrance owns `y`/`scale`, the
 * connector's line owns `scaleX`, the connector's arrow owns `x`. The connector
 * container itself carries only margins — no transform — precisely so nothing
 * else has to fight it for one.
 *
 * `prefers-reduced-motion` gets the markup untouched: no split, no entrance,
 * no connectors drawn, no parallax.
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

export function useFeaturesMotion(
  section: React.RefObject<HTMLElement | null>,
) {
  useIsomorphicLayoutEffect(() => {
    const root = section.current;
    if (!root) return;

    registerGsap();

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const pick = <T extends HTMLElement>(name: string) =>
        root.querySelector<T>(`[data-fe="${name}"]`);
      const pickAll = <T extends HTMLElement>(name: string) =>
        Array.from(root.querySelectorAll<T>(`[data-fe="${name}"]`));

      const pill = pick("pill");
      const title = pick("title");
      const lede = pick("lede");
      const cta = pick("cta");
      const cards = pickAll("card");
      const badges = pickAll("badge");
      const railLines = pickAll("rail-line");
      const railArrows = pickAll("rail-arrow");
      const sky = pick("sky");

      // ---- header -------------------------------------------------------
      // No `autoSplit`. Word masks are boxes measured per word, so they survive
      // a resize that re-wraps the line (unlike line masks, which guild's
      // headline needs). And a re-split here would re-run `onSplit` and append
      // a second copy of every tween to a timeline that has already played.
      let split: SplitText | null = null;
      if (title) {
        split = SplitText.create(title, {
          type: "words",
          mask: "words",
          // The h2 is the section's heading, so the full sentence moves to
          // `aria-label` and the per-word spans are hidden. Left unsplit it is
          // announced as ~10 disconnected words.
          aria: "auto",
          onSplit(self) {
            for (const mask of self.masks) {
              mask.classList.add(TEXT_MASK_CLASS);
            }
            return undefined;
          },
        });
      }

      const header = gsap.timeline({ paused: true });

      if (pill) {
        header.from(pill, { y: 12, autoAlpha: 0, duration: 0.5, ease: EASE }, 0);
      }
      if (split) {
        header.from(
          split.words,
          {
            yPercent: 112,
            duration: 0.72,
            ease: EASE,
            stagger: 0.042,
          },
          0.1,
        );
      }
      if (lede) {
        header.from(lede, { y: 16, autoAlpha: 0, duration: 0.6, ease: EASE }, 0.56);
      }
      if (cta) {
        header.from(
          cta,
          { y: 14, autoAlpha: 0, duration: 0.6, ease: EASE },
          0.66,
        );
      }

      // ---- sequence -----------------------------------------------------
      // Its own trigger: the cards start a screen below the header, so one
      // timeline would have them animate while still off-screen.
      const seq = gsap.timeline({ paused: true });
      const CARD_EACH = 0.14;
      const CARD_DUR = 0.8;

      if (cards.length) {
        seq.from(
          cards,
          {
            y: 34,
            scale: 0.975,
            autoAlpha: 0,
            duration: CARD_DUR,
            ease: EASE,
            stagger: CARD_EACH,
          },
          0,
        );
      }
      if (badges.length) {
        // The step number arrives a beat after the card that carries it, so the
        // eye reads 01, 02, 03 as three events instead of three decorations.
        seq.from(
          badges,
          {
            scale: 0.4,
            autoAlpha: 0,
            duration: 0.45,
            ease: EASE,
            stagger: CARD_EACH,
          },
          0.3,
        );
      }
      // The line grows from `origin-left` (a Tailwind class, not a tween var,
      // so nothing else has to set a transform-origin on it): it is drawn *from*
      // the card that has landed *toward* the one that has not. Its left end
      // sits behind the first card, so the first ~30% of the tween is hidden and
      // the stroke appears to emerge from the card edge. `fromTo` renders its
      // start state on creation, which is what keeps the connectors invisible
      // while the cards are still off-screen.
      railLines.forEach((line, i) => {
        seq.fromTo(
          line,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 0.5,
            ease: EASE,
          },
          0.45 + i * CARD_EACH * 2,
        );
      });
      railArrows.forEach((arrow, i) => {
        seq.from(
          arrow,
          { x: -6, autoAlpha: 0, duration: 0.4, ease: EASE },
          0.75 + i * CARD_EACH * 2,
        );
      });

      const headerTrigger = ScrollTrigger.create({
        trigger: pill ?? root,
        endTrigger: cta ?? pill,
        start: "top 85%",
        end: "bottom top",
        animation: header,
        toggleActions: "restart reverse restart reverse",
      });
      const seqTrigger = ScrollTrigger.create({
        trigger: cards[0] ?? root,
        endTrigger: cards[cards.length - 1] ?? root,
        start: "top 88%",
        end: "bottom top",
        animation: seq,
        toggleActions: "restart reverse restart reverse",
      });

      // ---- wallpaper ----------------------------------------------------
      // Scale only ever grows: the image is `object-cover` on an
      // `overflow-hidden` section, so shrinking it would expose its edges. The
      // drift stays under the 3.5% overhang a 1.07 scale buys, so the top and
      // bottom never open a gap either.
      const skyTween = sky
        ? gsap.fromTo(
            sky,
            { scale: 1, yPercent: 0 },
            {
              scale: 1.07,
              yPercent: -2,
              ease: "none",
              immediateRender: true,
              scrollTrigger: {
                trigger: root,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          )
        : null;

      return () => {
        split?.revert();
        skyTween?.scrollTrigger?.kill();
        skyTween?.kill();
        headerTrigger.kill();
        header.kill();
        seqTrigger.kill();
        seq.kill();
      };
    });

    return () => mm.revert();
  }, [section]);
}
