"use client";

/**
 * Hosts the AI Mastery application inside a Careevo page.
 *
 * AI Mastery (Careevo's DeepTutor-derived system, vendored at
 * `features/sijago/`) is a separate Next.js app served by a separate FastAPI
 * process: its chat runs over a WebSocket and a tool-calling agent loop, so it
 * cannot be a route inside Careevo's App Router. It is also a different app with
 * its own routing, its own Tailwind config and its own proxy rewrite.
 *
 * So the boundary is drawn at the document level rather than the module level.
 * Framing it means Careevo owns the URL, the navbar, the session and the back
 * button, while the framed app's own bundle runs exactly as it was built — no
 * shim, no rewritten imports, no forked components.
 *
 * The alternative (proxying its routes through Careevo's origin) was rejected:
 * the framed app serves its workspaces at the root (`/chat`, `/whisper`), which
 * would collide with Careevo's own routes, and rewriting the prefix would mean
 * editing its `proxy.ts` — i.e. no longer running its own code.
 */
export function AiMasteryFrame({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      // The app manages its own scrolling, viewport height and focus order, so it
      // gets the full remaining height rather than being sized to its content.
      // `--app-chrome-h` is published by `.ai-mastery-shell` and must track the
      // navbar's real height: the bar wraps to two rows below 769px, and a
      // hard-coded 4rem there pushes the frame's top under the bar.
      className="h-[calc(100dvh-var(--app-chrome-h,4rem))] w-full border-0 bg-background"
      // Same-origin isolation: it loads its own assets and talks to its own
      // backend, and must not be able to reach into Careevo's document.
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
      referrerPolicy="no-referrer"
      allow="clipboard-read; clipboard-write"
    />
  );
}
