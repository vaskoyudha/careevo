import { demoAccountsAllowed, type EnvironmentLike } from "@/lib/config/environment";
import type { DemoAccount } from "./types";

/**
 * Demo accounts used by the marketing prototype.
 *
 * Lives beside `types.ts` (which imports nothing) rather than in `session.ts`
 * so the registration action can use `isDemoEmail` without pulling in
 * `next/headers`, which would make the action untestable outside a Next request
 * context.
 */

export const DEMO_PASSWORD = "careevo";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "user@careevo.test",
    nama: "Raka Pratama",
    username: "raka",
    role: "user",
    password: DEMO_PASSWORD,
  },
  {
    email: "verifikator@careevo.test",
    nama: "Dewi Larasati",
    username: "dewi",
    role: "verifikator",
    password: DEMO_PASSWORD,
  },
  {
    email: "admin@careevo.test",
    nama: "Admin Careevo",
    username: "admin",
    role: "admin",
    password: DEMO_PASSWORD,
  },
];

export function isDemoEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.some((item) => item.email.toLowerCase() === normalized);
}

/**
 * Demo accounts are a local development affordance only.
 *
 * A demo account carries a fixed password and a fixture profile, so anywhere
 * other than a development machine with an explicit opt-in it is a public
 * backdoor rather than a convenience. `demoAccountsAllowed` requires both
 * `NODE_ENV === "development"` **and** `DEMO_MODE === "1"`, so a plain
 * `npm run dev` — and every non-development environment — refuses the demo
 * logins. Returns the entry only when that gate opens; `undefined` otherwise,
 * so callers fail closed. The environment is read per call (not at module load)
 * so tests can stub it without import-order games.
 */
export function findDemoAccount(
  email: string,
  env: EnvironmentLike = process.env,
): DemoAccount | undefined {
  if (!demoAccountsAllowed(env)) return undefined;
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((item) => item.email.toLowerCase() === normalized);
}
