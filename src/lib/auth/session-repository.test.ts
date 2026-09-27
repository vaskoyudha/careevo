import { describe, expect, it } from "vitest";
import { TTL_SESI_MS } from "./session-repository";
import { SESSION_MAX_AGE } from "./session";

/**
 * Regression guard for the "asked to log in again while navigating" bug.
 *
 * `TTL_SESI_MS` is consumed twice, and both consumers are silently wrong if the
 * unit is off:
 *
 * - `sessions.expires_at = now + TTL_SESI_MS` — read by
 *   `cariSessionAktifByTokenHash` via `gt(expiresAt, new Date())`;
 * - `SESSION_MAX_AGE = TTL_SESI_MS / 1000` — the cookie's `maxAge` in seconds.
 *
 * The shipped value was `60 * 60 * 8`, i.e. 28_800 **milliseconds**, so sessions
 * expired 28.8 seconds after login. The browser kept sending a cookie that the
 * database had already rejected, `getSession()` returned `null`, and the gated
 * layouts redirected to `/masuk` — intermittently, because a fast navigation
 * still fit inside the 28-second window. Neither `tsc` (both sides are `number`)
 * nor the earlier `npm test` suite (nothing asserted the magnitude) caught it.
 *
 * These assertions are deliberately about the *magnitude* in real units rather
 * than the literal `8 * 60 * 60 * 1000`: refactoring the expression is fine,
 * shipping a value that logs people out after half a minute is not.
 */
describe("TTL_SESI_MS", () => {
  it("is 8 hours expressed in milliseconds", () => {
    expect(TTL_SESI_MS).toBe(8 * 60 * 60 * 1000);
    expect(TTL_SESI_MS / 3_600_000).toBe(8);
  });

  it("is not accidentally expressed in seconds", () => {
    // The exact shape of the bug: `60 * 60 * 8` is 28_800, which is 28.8s once
    // it reaches `expires_at`. Guard the boundary the short-lived value fell
    // under, so a unit mix-up cannot read as "a short session".
    expect(TTL_SESI_MS).toBeGreaterThan(60 * 60 * 1000);
  });
});

describe("SESSION_MAX_AGE", () => {
  it("is the TTL in seconds, so cookie and database expire together", () => {
    expect(SESSION_MAX_AGE).toBe(TTL_SESI_MS / 1000);
  });

  it("gives the cookie an 8-hour lifetime, not 28 seconds", () => {
    expect(SESSION_MAX_AGE).toBe(28_800);
    expect(SESSION_MAX_AGE / 3600).toBe(8);
  });
});
