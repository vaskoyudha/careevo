import { describe, expect, it } from "vitest";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  findDemoAccount,
  isDemoEmail,
} from "./demo-accounts";

const PROD = { NODE_ENV: "production", DEMO_MODE: "1" } as NodeJS.ProcessEnv;
const DEV_DEMO = { NODE_ENV: "development", DEMO_MODE: "1" } as NodeJS.ProcessEnv;
/** Development, but the machine never opted into demo mode — the default. */
const DEV_PLAIN = { NODE_ENV: "development" } as NodeJS.ProcessEnv;

describe("isDemoEmail", () => {
  it("matches a demo email case- and whitespace-insensitively", () => {
    expect(isDemoEmail("  USER@Careevo.Test  ")).toBe(true);
    expect(isDemoEmail("nobody@careevo.test")).toBe(false);
  });
});

describe("findDemoAccount", () => {
  it("returns the account in development with DEMO_MODE=1", () => {
    const account = findDemoAccount("admin@careevo.test", DEV_DEMO);
    expect(account?.role).toBe("admin");
    expect(account?.password).toBe(DEMO_PASSWORD);
  });

  // The adversarial case: staging/production must not authenticate a demo
  // account even though the credentials are published in the docs and the
  // fixtures. Returning the entry here would let anyone log in as staff.
  it("refuses every demo account in production", () => {
    for (const account of DEMO_ACCOUNTS) {
      expect(findDemoAccount(account.email, PROD)).toBeUndefined();
    }
  });

  // The regression the fail-closed gate fixes: a development box that never set
  // DEMO_MODE used to serve the published password (the old gate was merely
  // `!production`). Plain `npm run dev` must now refuse it too.
  it("refuses every demo account in development without an explicit opt-in", () => {
    for (const account of DEMO_ACCOUNTS) {
      expect(findDemoAccount(account.email, DEV_PLAIN)).toBeUndefined();
    }
  });

  it("still refuses an unknown email in development with DEMO_MODE=1", () => {
    expect(findDemoAccount("nobody@careevo.test", DEV_DEMO)).toBeUndefined();
  });
});
