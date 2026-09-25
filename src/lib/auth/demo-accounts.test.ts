import { describe, expect, it } from "vitest";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  findDemoAccount,
  isDemoEmail,
} from "./demo-accounts";

const PROD = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
const DEV = { NODE_ENV: "development" } as NodeJS.ProcessEnv;

describe("isDemoEmail", () => {
  it("matches a demo email case- and whitespace-insensitively", () => {
    expect(isDemoEmail("  USER@Careevo.Test  ")).toBe(true);
    expect(isDemoEmail("nobody@careevo.test")).toBe(false);
  });
});

describe("findDemoAccount", () => {
  it("returns the account in development", () => {
    const account = findDemoAccount("admin@careevo.test", DEV);
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

  it("still refuses an unknown email in development", () => {
    expect(findDemoAccount("nobody@careevo.test", DEV)).toBeUndefined();
  });
});
