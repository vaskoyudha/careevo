/**
 * Where the SiJago app is served from.
 *
 * SiJago is Careevo's DeepTutor-derived learning system. It is a *separate
 * application* rather than a set of routes inside this one, and that is a host
 * requirement rather than a packaging preference: its chat runs over a
 * WebSocket driven by a tool-calling agent loop in a Python process, which an
 * App Router server action cannot host, and its own routing and Tailwind build
 * are its own. See `features/sijago/README.md`.
 *
 * So there is no "mode" to persist. Which system you are in is answered by the
 * URL, and the navbar is a pair of ordinary in-app links. An earlier version
 * stored the choice in a signed cookie and POSTed to a server action; that added
 * a second source of truth for a fact the URL already carries, and a stale
 * cookie could point a learner at a tree that is not theirs.
 */

/** Where the SiJago app is served. */
export const SIJAGO_WEB_URL =
  process.env.SIJAGO_WEB_URL ?? "http://localhost:3790";
