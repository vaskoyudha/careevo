import { describe, expect, it } from "vitest";
import { demoAccountsAllowed, isProductionRuntime } from "./environment";

describe("isProductionRuntime", () => {
  it("is true only for NODE_ENV=production", () => {
    expect(isProductionRuntime({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionRuntime({ NODE_ENV: "development" })).toBe(false);
    expect(isProductionRuntime({ NODE_ENV: "test" })).toBe(false);
    expect(isProductionRuntime({})).toBe(false);
  });
});

describe("demoAccountsAllowed", () => {
  // Demo accounts carry a fixed password published in this repository. The gate
  // is therefore two independent conditions, and every other combination must
  // fail closed. The old `!isProductionRuntime(env)` gate failed open for
  // `test`, `staging`, and an unset `NODE_ENV`; those are the cases pinned here.
  it("allows demo accounts only in development with an explicit DEMO_MODE=1", () => {
    expect(demoAccountsAllowed({ NODE_ENV: "development", DEMO_MODE: "1" })).toBe(true);
  });

  it("refuses a development box that never opted in", () => {
    // The common case: `npm run dev` on a machine with no demo flag. It must not
    // serve the published credentials.
    expect(demoAccountsAllowed({ NODE_ENV: "development" })).toBe(false);
    expect(demoAccountsAllowed({ NODE_ENV: "development", DEMO_MODE: "" })).toBe(false);
    expect(demoAccountsAllowed({ NODE_ENV: "development", DEMO_MODE: "0" })).toBe(false);
    expect(demoAccountsAllowed({ NODE_ENV: "development", DEMO_MODE: "true" })).toBe(false);
    expect(demoAccountsAllowed({ NODE_ENV: "development", DEMO_MODE: "yes" })).toBe(false);
  });

  it("refuses DEMO_MODE=1 outside development", () => {
    for (const NODE_ENV of ["production", "test", "staging", ""]) {
      expect(demoAccountsAllowed({ NODE_ENV, DEMO_MODE: "1" })).toBe(false);
    }
  });

  it("refuses every non-development environment even without a DEMO_MODE value", () => {
    expect(demoAccountsAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(demoAccountsAllowed({ NODE_ENV: "test" })).toBe(false);
    expect(demoAccountsAllowed({ NODE_ENV: "staging" })).toBe(false);
    expect(demoAccountsAllowed({})).toBe(false);
  });
});
