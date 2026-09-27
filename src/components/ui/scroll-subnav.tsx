"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Sub-header that slides in once the page's own header has scrolled away.
 *
 * The mechanism `/careevo-plus` established: a bar that is absent at the top of
 * the page (so the hero reads as one clean header) and drops in as a sticky
 * reminder of what you are looking at plus the one action worth keeping in
 * reach. Extracted here so `/careevo-plus` and the course detail page share one
 * implementation instead of growing two slightly different bars.
 *
 * ## Why it hangs *below* the navbar instead of over it
 *
 * `.chrome` is `position: sticky` with `z-index: 60`; this bar is `fixed` at
 * `z-index: 55`, so a bar pinned at `top: 0` is painted *underneath* the
 * floating pill and its content is invisible — the pill is opaque enough to
 * cover the whole measure. The offset is therefore **measured** from the live
 * bar, not hardcoded: the pill's height is content-driven (66px once floated on
 * desktop, 122px at 390px wide where it wraps to two rows, and it grows again
 * if a nav item wraps). `.dashboard-shell` solves the same problem with a
 * constant (`--dashboard-chrome-h`); this needs a runtime value because the bar
 * morphs.
 *
 * Two custom properties are published on `:root` while the component is
 * mounted, so in-flow anchors can clear both bars (see `.subnav-scroll-mt`):
 *
 * - `--chrome-float-bottom` — measured bottom edge of the floated navbar.
 * - `--subnav-h` — this bar's own height, `0` while it is hidden.
 */

const SEL_BAR_NAV = ".chrome";

/** Bottom edge used before the navbar has been measured (first paint). */
const CADANGAN_BAR_NAV = 78;

export function ScrollSubNav({
  children,
  /** Scroll offset that reveals the bar, when no `trigger` is given. */
  ambang = 360,
  /**
   * Element whose exit from the viewport reveals the bar. Preferred over
   * `ambang` when the header's height is content-driven (a long course title
   * wraps and pushes the reveal point down), which it is on `/belajar/[slug]`.
   */
  trigger,
}: {
  children: ReactNode;
  ambang?: number;
  trigger?: React.RefObject<HTMLElement | null>;
}) {
  const [tampil, setTampil] = useState(false);
  const [offsetAtas, setOffsetAtas] = useState(CADANGAN_BAR_NAV);
  const diri = useRef<HTMLDivElement>(null);

  /**
   * Recompute the navbar's bottom edge. Written only when it actually moved
   * (rounded to a pixel) so a scroll listener can call this every frame without
   * re-rendering React on each one.
   */
  const ukurBar = useCallback(() => {
    const bar = document.querySelector<HTMLElement>(SEL_BAR_NAV);
    // No navbar on this page (a bare story/route): pin to the top edge.
    const bawah = bar ? Math.round(bar.getBoundingClientRect().bottom) : 0;
    setOffsetAtas((sebelumnya) => (Math.abs(sebelumnya - bawah) > 0.5 ? bawah : sebelumnya));
  }, []);

  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(SEL_BAR_NAV);

    const onScroll = () => {
      ukurBar();
      setTampil(
        trigger
          ? (trigger.current?.getBoundingClientRect().bottom ?? 0) <= 0
          : window.scrollY > ambang,
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // The navbar morphs (`.is-top` → `.is-scrolled`) and its content reflows
    // when a font finishes loading or the search field collapses, so its height
    // is not stable across the page's life. Observe it instead of guessing a
    // breakpoint constant. `observe()` also delivers one measurement right
    // away, which is what fills `offsetAtas` in — the fallback covers the gap.
    const observer = new ResizeObserver(ukurBar);
    if (bar) observer.observe(bar);
    if (diri.current) observer.observe(diri.current);

    // Initial scroll position, read after paint rather than during the effect:
    // a page that is *restored* mid-scroll (or opened on an `#anchor`) would
    // otherwise show the bar in the wrong state until the first scroll event.
    const awal = requestAnimationFrame(onScroll);

    return () => {
      cancelAnimationFrame(awal);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      observer.disconnect();
    };
  }, [ambang, trigger, ukurBar]);

  /**
   * Publish the two offsets for in-flow anchors. Cleared on unmount so a page
   * that drops the sub-header does not leave a stale offset behind.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--chrome-float-bottom", `${offsetAtas}px`);
    root.style.setProperty("--subnav-h", `${tampil ? (diri.current?.offsetHeight ?? 0) : 0}px`);
    return () => {
      root.style.removeProperty("--chrome-float-bottom");
      root.style.removeProperty("--subnav-h");
    };
  }, [offsetAtas, tampil]);

  return (
    <div
      ref={diri}
      // Always mounted on purpose. The Plus version returned `null` until
      // scrolled, which meant its `transition-all duration-300` animated
      // nothing — the element appeared already in its final state. Staying
      // mounted lets one CSS transition carry both directions.
      aria-hidden={!tampil}
      {...(tampil ? {} : { inert: true })}
      className={`subnav ${tampil ? "is-visible" : ""}`}
      style={{ top: offsetAtas }}
    >
      <div className="subnav-inner">{children}</div>
    </div>
  );
}
