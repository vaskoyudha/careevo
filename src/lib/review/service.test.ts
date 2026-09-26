import { describe, expect, it } from "vitest";
import { skorDariRubrik, transisiSah, TRANSISI } from "./service";
import type { RubrikReview } from "./service";

describe("transisiSah — state machine submission", () => {
  it("mengizinkan draft → submitted", () => {
    expect(transisiSah("draft", "submitted")).toBe(true);
  });

  it("mengizinkan in_review → approved/rejected/changes_requested", () => {
    expect(transisiSah("in_review", "approved")).toBe(true);
    expect(transisiSah("in_review", "rejected")).toBe(true);
    expect(transisiSah("in_review", "changes_requested")).toBe(true);
  });

  it("mengizinkan changes_requested → submitted (resubmit)", () => {
    expect(transisiSah("changes_requested", "submitted")).toBe(true);
  });

  it("menolak transisi terlarang", () => {
    expect(transisiSah("approved", "rejected")).toBe(false);
    expect(transisiSah("rejected", "approved")).toBe(false);
    expect(transisiSah("submitted", "approved")).toBe(false);
    expect(transisiSah("draft", "approved")).toBe(false);
    expect(transisiSah("in_review", "submitted")).toBe(false);
  });

  it("status approved/rejected terminal (tidak ada tujuan)", () => {
    expect(TRANSISI.approved).toEqual([]);
    expect(TRANSISI.rejected).toEqual([]);
  });
});

describe("skorDariRubrik", () => {
  const penuh: RubrikReview = {
    kelengkapan: 4,
    kualitas: 4,
    orisinalitas: 4,
    ketepatan_brief: 4,
    dokumentasi: 4,
  };

  it("rubrik penuh → 100", () => {
    expect(skorDariRubrik(penuh)).toBe(100);
  });

  it("rubrik nol → 0", () => {
    const nol: RubrikReview = {
      kelengkapan: 0,
      kualitas: 0,
      orisinalitas: 0,
      ketepatan_brief: 0,
      dokumentasi: 0,
    };
    expect(skorDariRubrik(nol)).toBe(0);
  });

  it("nilai di luar rentang dijepit oleh hitungSkorKarya", () => {
    const berlebih: RubrikReview = {
      kelengkapan: 99,
      kualitas: 99,
      orisinalitas: 99,
      ketepatan_brief: 99,
      dokumentasi: 99,
    };
    // Dijepit ke skala maks 4 → skor karya penuh → 100.
    expect(skorDariRubrik(berlebih)).toBe(100);
  });
});
