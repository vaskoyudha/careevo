/**
 * One scroll listener for the whole document, one rAF, one layout.
 *
 * ## The problem this exists to solve
 *
 * Five components listen to `window` `scroll` on the marketing pages — `Chrome`
 * and `LearnerChrome` (the navbar morph), `ScrollSubNav`, `explore-menu`'s
 * panel remeasure, and `problems-solutions`' active-article tracker. Four of
 * them read layout inside the handler: `getBoundingClientRect()` on the navbar
 * and on the sub-bar, and one rect per article in a loop.
 *
 * Under native scrolling that is survivable, because the browser settles the
 * layout before it dispatches `scroll` and the reads hit clean numbers. Lenis
 * does not: it writes the scroll position itself with `rootElement.scrollTo()`
 * inside its own rAF, and the resulting `scroll` event lands in that same task.
 * Every handler's read is then a **read after a write** — a synchronous forced
 * reflow of the whole document, once per handler, per event.
 *
 * Measured on `/` at 1440x900, 40 wheel notches, mean frame time:
 *
 *   | condition                            | mean    | p95   | frames > 32ms |
 *   |--------------------------------------|---------|-------|----------------|
 *   | no Lenis, listeners as they were     | 16.67ms | 16.7  | 0 / 142        |
 *   | Lenis, listeners as they were        | 33.68ms | 66.7  | 101 / 142      |
 *   | Lenis, every scroll listener removed | 18.66ms | 33.3  | 10 / 142       |
 *
 * Lenis itself is close to free; the listeners are the cost, and Lenis is what
 * turns them from free into forced reflows.
 *
 * ## What coalescing actually fixes
 *
 * A `requestAnimationFrame` is not a debounce — the batch still runs on every
 * frame where something scrolled. The saving is that all the reads now happen
 * **in one rAF callback**, so the browser performs a single layout for the whole
 * group, and N handlers' worth of refs collapse to one. That is the difference
 * between "measured N times per frame" and "measured once per frame".
 *
 * ## Why one shared listener
 *
 * Every component subscribing for itself still means every component adding a
 * listener; the coalescing would work but the dispatch cost stays. So the
 * listener is refcounted — first subscriber attaches it, last one detaches it.
 */

type Pelanggan = () => void;

const pelanggan = new Set<Pelanggan>();

/** Live subscribers, so the document listeners exist only while someone needs them. */
let jumlah = 0;

/** Non-zero while a batch is already queued. This is the coalescing. */
let dijadwal = 0;

function jalankan(): void {
  dijadwal = 0;
  /**
   * A copy, not the live Set: a subscriber may unsubscribe or subscribe from
   * inside its own callback (both happen — `ScrollSubNav` tears down when
   * `ScrollSubNav` unmounts mid-scroll), and mutating a Set during iteration
   * either skips the next entry or runs one twice.
   */
  for (const jalan of Array.from(pelanggan)) jalan();
}

function jadwalkan(): void {
  if (dijadwal) return;
  dijadwal = requestAnimationFrame(jalankan);
}

function mulai(): void {
  window.addEventListener("scroll", jadwalkan, { passive: true });
  window.addEventListener("resize", jadwalkan, { passive: true });
}

function berhenti(): void {
  window.removeEventListener("scroll", jadwalkan);
  window.removeEventListener("resize", jadwalkan);
  if (dijadwal) {
    cancelAnimationFrame(dijadwal);
    dijadwal = 0;
  }
}

/**
 * Run `jalan` at most once per animation frame while the document scrolls or
 * resizes. Returns an unsubscribe function suitable as a `useEffect` cleanup.
 *
 * `jalan` is also scheduled once on subscribe, so a page restored mid-scroll or
 * opened on an `#anchor` starts in the right state without every call site
 * having to remember an initial invocation. That is why none of the converted
 * effects call their handler once by hand any more.
 */
export function onScrollFrame(jalan: Pelanggan): () => void {
  pelanggan.add(jalan);
  if (jumlah === 0) mulai();
  jumlah += 1;
  jadwalkan();

  let dilepas = false;
  return () => {
    // Effects can be cleaned up twice under React's StrictMode double-invoke;
    // dropping the refcount twice would detach the shared listener while other
    // subscribers still depend on it.
    if (dilepas) return;
    dilepas = true;
    pelanggan.delete(jalan);
    jumlah -= 1;
    if (jumlah === 0) berhenti();
  };
}
