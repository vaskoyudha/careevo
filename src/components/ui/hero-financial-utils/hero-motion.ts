"use client";

/**
 * Hero entrance + ambient scroll motion for `HeroFinancial`.
 *
 * Why GSAP and not the previous `TimelineAnimation` class-swap: the headline is
 * one <h1> that has to arrive word by word, and only a real timeline can hold
 * the sub-copy, the CTAs and the dashboard frame in sequence *behind* the
 * headline instead of overlapping it. `TimelineAnimation` also had a duplicate
 * `animationNum={6}` (third CTA and the dashboard frame landed together).
 *
 * Two hard rules from DESIGN.md, both encoded below rather than left to taste:
 *   - Easing is `cubic-bezier(0.16, 1, 0.3, 1)` (the same curve as an SVG path,
 *     since `CustomEase` takes path data and not a CSS timing function).
 *   - No bounce or elastic easing, and nothing moves far. Ambient travel is
 *     capped at 40px so the parallax reads as depth, not as a carousel.
 *
 * Degradation is deliberate: the start states are applied by `from()` tweens
 * created in a layout effect, never by CSS. If JS is off or GSAP throws, the
 * hero renders as plain, fully visible markup — a marketing hero must never be
 * invisible because a script did not run.
 */

import * as React from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import {
  EASE,
  TEXT_MASK_CLASS,
  registerGsap,
  useIsomorphicLayoutEffect,
} from "@/lib/motion/gsap";

export function useHeroMotion(targets: {
  section: React.RefObject<HTMLElement | null>;
  headline: React.RefObject<HTMLElement | null>;
  backdrop: React.RefObject<HTMLElement | null>;
  sequence: React.RefObject<(HTMLElement | null)[]>;
}) {
  const { section, headline, backdrop, sequence } = targets;

  useIsomorphicLayoutEffect(() => {
    const root = section.current;
    const title = headline.current;
    if (!root || !title) return;

    registerGsap();

    // `matchMedia` scopes both branches, so the reduced-motion path cannot leak
    // a tween or a ScrollTrigger back into the animated one.
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // DOM order is the intended reading order: eyebrow, sub-copy, the three
      // CTAs, then the dashboard frame. Stated here rather than as a
      // hand-numbered prop per child, which is how the old duplicate crept in.
      const steps = sequence.current.filter(
        (el): el is HTMLElement => el !== null,
      );

      const split = SplitText.create(title, {
        type: "words",
        mask: "words",
        // The h1 is the page's accessible name (the section points
        // `aria-labelledby` at it), so the full sentence moves to `aria-label`
        // and the per-word spans are hidden from assistive tech. Without this
        // the heading is announced as ~18 disconnected words.
        aria: "auto",
        // Re-split on resize/webfont reflow: word masks are measured boxes, so
        // a stale split clips text instead of animating it.
        autoSplit: true,
        onSplit(self) {
          // `mask: "words"` clips to the word's line box, not its glyph ink box,
          // so descenders (the tail of "berpikir,", the bowl of "p") get shaved.
          // The class lives in `globals.css` next to the headline's line-height,
          // and it must be re-applied on every re-split.
          for (const mask of self.masks) {
            mask.classList.add(TEXT_MASK_CLASS);
          }

          return gsap
            .timeline({ defaults: { ease: EASE } })
            .from(self.words, {
              yPercent: 118,
              duration: 0.95,
              stagger: { each: 0.042, from: "start" },
            })
            .from(
              steps,
              {
                y: 18,
                autoAlpha: 0,
                duration: 0.62,
                stagger: 0.075,
              },
              // Wait for the headline to land before the supporting copy moves,
              // so the claim is read before the detail is.
              "-=0.42",
            );
        },
      });

      // Parallax on the *containers*, never on the split words, so a re-split
      // from `autoSplit` cannot invalidate an in-flight scrub.
      const drift = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
      // The headline is the only layer that travels up; the backdrop travels
      // *down* while the page scrolls up, so it recedes. 70px stays clear of
      // the backdrop's `-top-28` overhang, so no white gap opens at the top.
      drift.fromTo(
        title,
        { y: 0 },
        { y: -40, ease: "none", immediateRender: true },
        0,
      );
      if (backdrop.current) {
        drift.fromTo(
          backdrop.current,
          { y: 0 },
          { y: 70, ease: "none", immediateRender: true },
          0,
        );
      }

      return () => {
        split.revert();
        drift.scrollTrigger?.kill();
        drift.kill();
      };
    });

    return () => mm.revert();
  }, [section, headline, backdrop, sequence]);
}
