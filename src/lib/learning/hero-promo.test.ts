import { describe, expect, it } from "vitest";
import { closestPromoIndex } from "./hero-promo";

describe("closestPromoIndex", () => {
  it("returns the first card while the first card is centered", () => {
    expect(
      closestPromoIndex(0, 600, [
        { left: 0, width: 560 },
        { left: 572, width: 560 },
        { left: 1144, width: 560 },
      ]),
    ).toBe(0);
  });

  it("returns the card nearest the viewport center after horizontal scrolling", () => {
    expect(
      closestPromoIndex(620, 600, [
        { left: 0, width: 560 },
        { left: 572, width: 560 },
        { left: 1144, width: 560 },
      ]),
    ).toBe(1);
  });

  it("clamps to the last card when the carousel is scrolled to its end", () => {
    expect(
      closestPromoIndex(2000, 600, [
        { left: 0, width: 560 },
        { left: 572, width: 560 },
        { left: 1144, width: 560 },
      ]),
    ).toBe(2);
  });
});
