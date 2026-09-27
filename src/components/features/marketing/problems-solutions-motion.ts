"use client";

/**
 * Motion for the "Masalah / Solusi" header and the three flip cards
 * (`problems-solutions.tsx`).
 *
 * The section already contains its own best idea: the cards flip on a Y axis to
 * show the solution. So the entrance does not invent a new gesture, it *echoes*
 * that one — each card turns to face you as it arrives, which teaches the
 * mechanic before the user has to click it. Everything else follows the copy's
 * own two-beat structure, problem then resolution.
 *
 *   1. Header. "MASALAH / SOLUSI" reveals, the bold problem line masks up, then
 *      the muted resolution line follows a beat later. The h2 is deliberately
 *      two-tone; animating it as one block throws away the argument it is making.
 *   2. Cards. A 3D rotateY entrance with a left/centre/right fan, so the row
 *      reads as three exhibits being presented rather than three boxes fading in.
 *   3. Drift. On scroll the two headline lines separate — the resolution
 *      travels further than the problem, so the answer visibly pulls away from
 *      the question. That is the section's thesis expressed as parallax.
 *
 * One transform owner per element, as everywhere else here: a card's `y`/opacity
 * entrance, its `rotateY`, and nothing else each live on separate elements. Two
 * animations on one element means the later tween overwrites the earlier.
 */

import type * as React from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE, registerGsap, useIsomorphicLayoutEffect } from "@/lib/motion/gsap";

export function useProblemsSolutionsMotion(
  section: React.RefObject<HTMLElement | null>,
) {
  useIsomorphicLayoutEffect(() => {
    const root = section.current;
    if (!root) return;

    registerGsap();

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const pick = <T extends HTMLElement>(name: string) =>
        root.querySelector<T>(`[data-ps="${name}"]`);
      const pickAll = <T extends HTMLElement>(name: string) =>
        Array.from(root.querySelectorAll<T>(`[data-ps="${name}"]`));

      const eyebrow = pick("eyebrow");
      const slash = pick("slash");
      const lineA = pick("line-a");
      const lineB = pick("line-b");
      const lede = pick("lede");
      const quote = pick("quote");
      const cardRow = pick("card-row");
      const cards = pickAll("card");
      const tilts = pickAll("tilt");

      // ---- header -------------------------------------------------------
      const header = gsap.timeline({ paused: true });

      if (eyebrow) {
        header.from(eyebrow, { yPercent: 60, autoAlpha: 0, duration: 0.5, ease: EASE }, 0);
      }
      if (slash) {
        // The slash is the section's own subject — it is what separates the
        // problem from the solution, and the cards flip on that axis.
        header.from(
          slash,
          { scale: 0.4, rotation: -35, autoAlpha: 0, duration: 0.45, ease: EASE },
          0.12,
        );
      }
      if (lineA) {
        header.from(lineA, { yPercent: 108, duration: 0.8, ease: EASE }, 0.14);
      }
      if (lineB) {
        // A beat later and slightly longer: the resolution is the point of the
        // section, so it gets the last word rather than arriving alongside the
        // problem it answers.
        header.from(lineB, { yPercent: 108, duration: 0.9, ease: EASE }, 0.32);
      }
      if (lede) {
        header.from(lede, { y: 18, autoAlpha: 0, duration: 0.6, ease: EASE }, 0.56);
      }

      // ---- cards --------------------------------------------------------
      // The row is its own trigger, not part of the header timeline: the cards
      // start below the fold, and a single timeline would have them animate
      // while still off-screen.
      const cardTl = gsap.timeline({ paused: true });
      if (quote) {
        cardTl.from(quote, { y: 18, autoAlpha: 0, duration: 0.6, ease: EASE }, 0.55);
      }
      if (cards.length) {
        // Fan outward from the centre column. The middle card travels furthest
        // down, so the row has a depth order as well as a left/right one.
        //
        // Below `md` the row is a single stacked column, so there is no centre
        // to fan out from and the 30px horizontal offset had nowhere to go: it
        // shoved the card 5px past a 320px viewport for the length of the
        // animation. Collapsing `fanX` to 0 on small screens keeps the vertical
        // cascade — which is what reads on one column — and drops the sideways
        // push entirely.
        const narrow = window.matchMedia("(max-width: 767px)").matches;
        const fanX = narrow ? [0, 0, 0] : [-30, 0, 30];
        const fanY = [28, 36, 28];
        const fanR = [-10, -7, -4];
        cards.forEach((card, i) => {
          cardTl.from(
            card,
            {
              x: fanX[i] ?? 0,
              y: fanY[i] ?? 28,
              autoAlpha: 0,
              duration: 0.75,
              ease: EASE,
            },
            i * 0.11,
          );
        });
        tilts.forEach((tilt, i) => {
          cardTl.from(
            tilt,
            {
              // `tilt` sits inside the `[perspective:1600px]` wrapper, so this
              // rotation is genuinely seen in perspective — rotating the
              // perspective element itself would be orthographic and flat.
              rotateY: fanR[i] ?? -10,
              scale: 0.97,
              duration: 0.9,
              ease: EASE,
            },
            i * 0.11,
          );
        });
      }

      const headerTrigger = ScrollTrigger.create({
        trigger: eyebrow ?? root,
        endTrigger: lede ?? eyebrow,
        start: "top 85%",
        end: "bottom top",
        animation: header,
        toggleActions: "restart reverse restart reverse",
      });
      const cardTrigger = ScrollTrigger.create({
        trigger: cardRow ?? root,
        endTrigger: quote ?? cardRow,
        start: "top 88%",
        end: "bottom top",
        animation: cardTl,
        toggleActions: "restart reverse restart reverse",
      });

      // ---- showcases ----------------------------------------------------
      // Each of the 6 platform showcase articles gets its own entrance as it
      // enters view: the bold headline lands first, the muted sentence settles
      // in, and the software visual frame glides up with subtle expansion.
      // `toggleActions: "restart reverse restart reverse"` re-applies the in
      // animation whenever the article is scrolled out of view and re-entered.
      const showcaseArticles = pickAll("showcase-article");
      const showcaseTls: gsap.core.Timeline[] = [];
      const showcaseTriggers: ScrollTrigger[] = [];

      showcaseArticles.forEach((art) => {
        const bold = art.querySelector<HTMLElement>('[data-ps="showcase-bold"]');
        const muted = art.querySelector<HTMLElement>('[data-ps="showcase-muted"]');
        const visual = art.querySelector<HTMLElement>('[data-ps="showcase-visual"]');

        const tl = gsap.timeline({ paused: true });

        if (bold) {
          tl.from(bold, { y: 22, autoAlpha: 0, duration: 0.65, ease: EASE }, 0);
        }
        if (muted) {
          tl.from(muted, { y: 22, autoAlpha: 0, duration: 0.7, ease: EASE }, 0.08);
        }
        if (visual) {
          tl.from(
            visual,
            { y: 34, scale: 0.985, autoAlpha: 0, duration: 0.85, ease: EASE },
            0.15,
          );
        }

        const trigger = ScrollTrigger.create({
          trigger: art,
          start: "top 78%",
          end: "bottom top",
          animation: tl,
          toggleActions: "restart reverse restart reverse",
        });

        showcaseTls.push(tl);
        showcaseTriggers.push(trigger);
      });

      // Sticky sidebar nav items stagger in when the showcase section arrives
      const navItems = pickAll("nav-item");
      let navTl: gsap.core.Timeline | null = null;
      let navTrigger: ScrollTrigger | null = null;

      if (navItems.length) {
        navTl = gsap.timeline({ paused: true });
        navTl.from(navItems, {
          x: -14,
          autoAlpha: 0,
          duration: 0.5,
          ease: EASE,
          stagger: 0.05,
        });

        navTrigger = ScrollTrigger.create({
          trigger: pick("showcase-nav") ?? showcaseArticles[0] ?? root,
          endTrigger: showcaseArticles[showcaseArticles.length - 1] ?? root,
          start: "top 80%",
          end: "bottom top",
          animation: navTl,
          toggleActions: "restart reverse restart reverse",
        });
      }

      // ---- drift --------------------------------------------------------
      // On the mask, not the line: the mask is what moves as a block, and the
      // line keeps its own `yPercent` for the entrance. Composing `y` and
      // `yPercent` on one element would also be fine, but keeping the two
      // concerns on two elements means a scrub can never race the entrance.
      const driftA = pick("mask-a");
      const driftB = pick("mask-b");
      const driftLede = pick("lede");
      const layers = [
        { el: driftA, amount: -20 },
        { el: driftB, amount: -34 },
        { el: driftLede, amount: -10 },
      ].filter((l): l is { el: HTMLElement; amount: number } => l.el !== null);

      const scrub = ScrollTrigger.create({
        trigger: root,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        onUpdate: (self) => {
          for (const l of layers) {
            gsap.set(l.el, { y: l.amount * self.progress });
          }
        },
      });

      return () => {
        scrub.kill();
        headerTrigger.kill();
        header.kill();
        cardTrigger.kill();
        cardTl.kill();
        showcaseTriggers.forEach((st) => st.kill());
        showcaseTls.forEach((t) => t.kill());
        navTrigger?.kill();
        navTl?.kill();
      };
    });

    return () => mm.revert();
  }, [section]);
}
