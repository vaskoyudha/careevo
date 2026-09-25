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
 * Demo accounts (fixed password, fixture profile) must exist only on a
 * development/demo machine. On staging and production the login path must not
 * accept them and no page may advertise their password.
 */
export function demoAccountsAllowed(env: EnvironmentLike = process.env): boolean {
  return !isProductionRuntime(env);
}
