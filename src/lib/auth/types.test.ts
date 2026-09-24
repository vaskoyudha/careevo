import { describe, expect, it } from "vitest";
import { normalizeOwner } from "./types";

describe("normalizeOwner", () => {
  it("normalizes account identifiers for owner comparisons", () => {
    expect(normalizeOwner("  RAKA@Careevo.Test  ")).toBe("raka@careevo.test");
  });
});
