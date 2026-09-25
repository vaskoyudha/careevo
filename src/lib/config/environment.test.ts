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
  // Demo accounts carry a fixed password, so shipping them to a public
  // deployment would be a backdoor. Only development/demo may serve them.
  it("allows demo accounts outside production", () => {
    expect(demoAccountsAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(demoAccountsAllowed({ NODE_ENV: "test" })).toBe(true);
    expect(demoAccountsAllowed({})).toBe(true);
  });

  it("refuses demo accounts in production", () => {
    expect(demoAccountsAllowed({ NODE_ENV: "production" })).toBe(false);
  });
});
