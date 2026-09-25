/**
 * Environment checks shared by the security containment work.
 *
 * Server-only by convention: these read `process.env`, so they must never be
 * imported from a client component. Keeping them in one module (rather than
 * spelling `process.env.NODE_ENV === "production"` at each call site) means the
 * demo-account guard and any future environment policy cannot drift apart.
 */

/**
 * The slice of the environment these checks read, kept structural so tests can
 * pass a plain object instead of mutating the real `process.env`.
 */
export interface EnvironmentLike {
  NODE_ENV?: string | undefined;
  DEMO_MODE?: string | undefined;
}

/**
 * True when the app runs as a real, publicly reachable deployment.
 *
 * `NODE_ENV` is written into the bundle by Next (see
 * `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`), so
 * this is a build/start-time constant, not a per-request value: a production
 * build cannot be flipped into demo mode at runtime.
 */
export function isProductionRuntime(env: EnvironmentLike = process.env): boolean {
  return env.NODE_ENV === "production";
}

/**
 * Demo accounts (fixed password, fixture profile) are a local convenience with
 * a published credential, so they are gated by **two independent conditions**
 * and fail closed unless both hold:
 *
 * 1. `NODE_ENV` is exactly `"development"`. Checked positively rather than as
 *    `!== "production"`: `"test"`, `"staging"`, an empty value, or any custom
 *    name must all be refused, not merely the one string production uses.
 * 2. `DEMO_MODE` is exactly `"1"` — a positive, explicit opt-in. Absent or any
 *    other value means no demo, so simply running `npm run dev` on a machine
 *    that never set the flag does not expose the published password or accept
 *    those logins.
 *
 * The previous `!isProductionRuntime(env)` gate failed open: anything that was
 * not exactly `production` — including a dev box, a test run, or a
 * misconfigured staging deploy with the wrong `NODE_ENV` — served the demo
 * accounts. Now the default for every environment is "no demo".
 *
 * `DEMO_MODE` must never be set on a publicly reachable deployment; it exists
 * for `npm run dev` and for an isolated demo machine with demo data.
 */
export function demoAccountsAllowed(env: EnvironmentLike = process.env): boolean {
  return env.NODE_ENV === "development" && env.DEMO_MODE === "1";
}
