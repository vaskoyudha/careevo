import { describe, expect, it } from "vitest";
import type { InboxJob } from "@/lib/career-ops";
import { filterInbox, teksInbox } from "@/lib/jobs/kueri-inbox";

function baris(over: Partial<InboxJob> = {}): InboxJob {
  return {
    url: "https://example.com/job/1",
    company: "Amartha",
    role: "Software Engineer Java",
    location: "Jakarta",
    done: false,
    ...over,
  };
}

describe("teksInbox", () => {
  it("menggabungkan role, company, location, dan compensation", () => {
    expect(
      teksInbox(
        baris({ compensation: "Rp10-12 jt", location: "Bandung" }),
      ),
    ).toBe("Software Engineer Java Amartha Bandung Rp10-12 jt");
  });

  it("melewati field opsional yang tidak ada", () => {
    expect(teksInbox(baris({ location: undefined, compensation: undefined }))).toBe(
      "Software Engineer Java Amartha",
    );
  });
});

describe("filterInbox", () => {
  const daftar = [
    baris({ compensation: "Rp10-12 jt" }),
    baris({
      url: "https://example.com/job/2",
      company: "GudangAda",
      role: "Data Analyst",
      location: "Tangerang",
    }),
    baris({
      url: "https://example.com/job/3",
      company: "Julo",
      role: "Backend Engineer Go",
      location: "South Jakarta",
    }),
  ];

  it("kueri kosong mengembalikan semua baris", () => {
    expect(filterInbox(daftar, "")).toHaveLength(3);
    expect(filterInbox(daftar, "   ")).toHaveLength(3);
  });

  it("mencocokkan role", () => {
    const hasil = filterInbox(daftar, "backend");
    expect(hasil).toHaveLength(1);
    expect(hasil[0].company).toBe("Julo");
  });

  it("mencocokkan company", () => {
    const hasil = filterInbox(daftar, "amartha");
    expect(hasil).toHaveLength(1);
    expect(hasil[0].role).toContain("Java");
  });

  it("mencocokkan location", () => {
    const hasil = filterInbox(daftar, "tangerang");
    expect(hasil).toHaveLength(1);
    expect(hasil[0].company).toBe("GudangAda");
  });

  it("mencocokkan compensation", () => {
    const hasil = filterInbox(daftar, "rp10");
    expect(hasil).toHaveLength(1);
    expect(hasil[0].company).toBe("Amartha");
  });

  it("mengabaikan kata pengisi", () => {
    // "lowongan" dan "di" dibuang uraiKueri, jadi ini sama dengan "jakarta".
    expect(filterInbox(daftar, "lowongan di jakarta")).toHaveLength(2);
  });

  it("semua istilah harus cocok (AND)", () => {
    expect(filterInbox(daftar, "jakarta backend")).toHaveLength(1);
    expect(filterInbox(daftar, "jakarta data")).toHaveLength(0);
  });

  it("kueri tanpa istilah yang bertahan mengembalikan semua baris", () => {
    // "di" dan "yang" keduanya kata pengisi — tidak ada istilah tersisa.
    expect(filterInbox(daftar, "di yang")).toHaveLength(3);
  });

  it("tidak pernah melempar pada baris minimal", () => {
    const minimal: InboxJob = {
      url: "https://example.com/job/4",
      company: "X",
      role: "Y",
      done: false,
    };
    expect(() => filterInbox([minimal], "apapun")).not.toThrow();
    expect(filterInbox([minimal], "x")).toHaveLength(1);
  });
});
