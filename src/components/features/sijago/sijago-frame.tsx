"use client";

/**
 * Hosts the SiJago application inside a Careevo page.
 *
 * SiJago (Careevo's DeepTutor-derived system) is a separate Next.js app served
 * by a separate FastAPI process: its chat runs over a WebSocket and a
 * tool-calling agent loop, so it cannot be a route inside Careevo's App Router.
 * It is also a different app with its own routing, its own Tailwind config and
 * its own proxy rewrite.
 *
 * So the boundary is drawn at the document level rather than the module level.
 * Framing it means Careevo owns the URL, the navbar, the session and the back
 * button, while SiJago's own bundle runs exactly as it was built — no shim, no
 * rewritten imports, no forked components.
 *
 * The alternative (proxying its routes through Careevo's origin) was rejected:
 * SiJago serves its workspaces at the root (`/chat`, `/whisper`), which would
 * collide with Careevo's own routes, and rewriting the prefix would mean
 * editing its `proxy.ts` — i.e. no longer running its own code.
 */
export function SiJagoFrame({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      // The app manages its own scrolling, viewport height and focus order, so it
      // gets the full remaining height rather than being sized to its content.
      className="h-[calc(100dvh-4rem)] w-full border-0 bg-background"
      // Same-origin isolation: it loads its own assets and talks to its own
      // backend, and must not be able to reach into Careevo's document.
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
      referrerPolicy="no-referrer"
      allow="clipboard-read; clipboard-write"
    />
  );
}
