import Link from "next/link";

/**
 * The AI Mastery entry point in the navbar.
 *
 * AI Mastery is hosted *inside* Careevo at `/ai-mastery` (see
 * `src/app/(app)/ai-mastery/page.tsx`): the learner keeps the navbar, the
 * session and the back button, so this is navigation rather than a new tab or a
 * cookie round-trip.
 *
 * This used to be a two-way `ModeToggle` (Careevo's own Indonesian AI-learnings
 * product vs the framed system). The "Indonesia" half is gone: it duplicated the
 * `Belajar` nav item directly to its left, so the pair read as two competing
 * systems rather than one product with an extra mode. What is left is a single
 * link, not a toggle — hence the rename from `ModeToggle`.
 *
 * Built from the repo's existing `chrome-btn` buttons rather than a new widget,
 * so it inherits the navbar's own morph (`.is-top` transparent vs `.is-scrolled`
 * glass pill) with no CSS of its own.
 */
export function AiMasteryLink() {
  return (
    // The visibility lives on a wrapper, not on the link: `.chrome-btn` is an
    // unlayered rule in globals.css and an unlayered declaration outranks
    // Tailwind's layered `hidden`/`xl:inline-flex` utilities, so putting them
    // straight on the button would leave it permanently visible.
    <div className="hidden shrink-0 xl:block">
      <Link
        href="/ai-mastery"
        className="chrome-btn chrome-btn-text chrome-btn-ghost whitespace-nowrap"
      >
        AI Mastery
      </Link>
    </div>
  );
}
