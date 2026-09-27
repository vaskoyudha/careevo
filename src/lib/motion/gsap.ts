"use client";

/**
 * One GSAP setup for the whole app.
 *
 * Marketing sections animate independently but must not each carry their own
 * plugin registration, their own `CustomEase` instance, or their own copy of the
 * "layout effect on the client, plain effect on the server" guard — two copies
 * of a rule is two definitions free to drift. Import from here instead.
 *
 * The easing is not a taste call: DESIGN.md "Motion" fixes the default at
 * `cubic-bezier(0.16, 1, 0.3, 1)`. `CustomEase` takes SVG path data rather than
 * a CSS timing function, so that same curve is expressed as a path.
 */

import * as React from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";

/** DESIGN.md "Motion": default easing `cubic-bezier(0.16, 1, 0.3, 1)`. */
export const EASE = "careevoEase";

/**
 * Clip-box fix for text reveal masks, defined once in `globals.css` as
 * `.text-mask`.
 *
 * Every `SplitText` `mask` (and every hand-rolled `overflow: hidden` line
 * wrapper) clips to the line box, which is tighter than the glyph ink at the
 * leadings these headings use — so descenders get shaved. Three sections had
 * their own near-identical copy of the rule at three different values; that is
 * the shape of a rule that drifts.
 */
export const TEXT_MASK_CLASS = "text-mask";

let registered = false;

export function registerGsap() {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  CustomEase.create(EASE, "M0,0 C0.16,1 0.3,1 1,1");
  registered = true;
}

/**
 * `useLayoutEffect` on the client, `useEffect` on the server.
 *
 * The layout variant is the point, not an optimisation: every entrance here
 * applies its start state with a `from()` tween rather than with a CSS hidden
 * class, so the tween has to be created *before* the browser paints or the
 * element flashes at its final position for one frame. In exchange, if JS never
 * runs, the markup renders plainly visible instead of stuck at `opacity: 0` —
 * which is the right failure for a marketing hero.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;
