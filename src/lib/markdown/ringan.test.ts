import { describe, expect, it } from "vitest";
import { uraikanInline, uraikanMarkdown } from "./ringan";

/**
 * These tests pin the *data* contract, not any styling. The renderer's security
 * claim reduces to one property: everything a model writes comes back as a
 * typed block or a `teks` span, so there is no code path that could ever hand a
 * raw HTML string to React. The `uraikanInline` cases below (a bare `<script>`,
 * `snake_case`, an unmatched `*`) are the adversarial half of that claim.
 */

describe("uraikanMarkdown", () => {
  it("returns [] for empty or whitespace-only input", () => {
    expect(uraikanMarkdown("")).toEqual([]);
    expect(uraikanMarkdown("   ")).toEqual([]);
    expect(uraikanMarkdown("\n\n")).toEqual([]);
  });

  it("parses headings at levels 1-4", () => {
    const teks = ["# Satu", "## Dua", "### Tiga", "#### Empat"].join("\n\n");
    expect(uraikanMarkdown(teks)).toEqual([
      { jenis: "judul", tingkat: 1, teks: "Satu" },
      { jenis: "judul", tingkat: 2, teks: "Dua" },
      { jenis: "judul", tingkat: 3, teks: "Tiga" },
      { jenis: "judul", tingkat: 4, teks: "Empat" },
    ]);
  });

  it("does not treat five hashes as a heading", () => {
    expect(uraikanMarkdown("##### Lima")).toEqual([
      { jenis: "paragraf", teks: "##### Lima" },
    ]);
  });

  it("keeps interior newlines inside a single paragraph", () => {
    expect(uraikanMarkdown("Baris satu\nBaris dua")).toEqual([
      { jenis: "paragraf", teks: "Baris satu\nBaris dua" },
    ]);
  });

  it("ends a paragraph when a new block starts", () => {
    expect(uraikanMarkdown("Kalimat biasa\n# Judul")).toEqual([
      { jenis: "paragraf", teks: "Kalimat biasa" },
      { jenis: "judul", tingkat: 1, teks: "Judul" },
    ]);
  });

  it("merges consecutive list lines into one block", () => {
    expect(uraikanMarkdown("- alpha\n- beta\n* gamma")).toEqual([
      { jenis: "daftar", terurut: false, awal: 1, item: ["alpha", "beta", "gamma"] },
    ]);
  });

  it("records the first number of an ordered list as `awal`", () => {
    expect(uraikanMarkdown("3. tiga\n4) empat")).toEqual([
      { jenis: "daftar", terurut: true, awal: 3, item: ["tiga", "empat"] },
    ]);
  });

  it("ends a list at a blank line", () => {
    expect(uraikanMarkdown("- satu\n\nparagraf")).toEqual([
      { jenis: "daftar", terurut: false, awal: 1, item: ["satu"] },
      { jenis: "paragraf", teks: "paragraf" },
    ]);
  });

  it("keeps fenced code verbatim and captures its language", () => {
    const teks = ["```ts", "const a = **bukan tebal**;", "```"].join("\n");
    expect(uraikanMarkdown(teks)).toEqual([
      { jenis: "kode", bahasa: "ts", isi: "const a = **bukan tebal**;" },
    ]);
  });

  it("treats a fence with no language as `bahasa: null`", () => {
    expect(uraikanMarkdown("```\nx\n```")).toEqual([
      { jenis: "kode", bahasa: null, isi: "x" },
    ]);
  });

  it("never parses markdown inside a fence", () => {
    const teks = [
      "```",
      "# bukan judul",
      "- bukan daftar",
      "**bukan tebal**",
      "---",
      "```",
    ].join("\n");
    const blok = uraikanMarkdown(teks);
    expect(blok).toHaveLength(1);
    const kode = blok[0];
    if (kode.jenis !== "kode") throw new Error("expected kode");
    // The bold marker survives as literal text in `isi`, proving the fence body
    // is opaque to the block parser.
    expect(kode.isi).toContain("**");
    expect(kode.isi).toContain("# bukan judul");
  });

  it("runs an unterminated fence to the end of the text", () => {
    expect(uraikanMarkdown("```js\nlet x = 1")).toEqual([
      { jenis: "kode", bahasa: "js", isi: "let x = 1" },
    ]);
  });

  it("joins consecutive quote lines with a single space", () => {
    expect(uraikanMarkdown("> satu\n> dua")).toEqual([
      { jenis: "kutipan", teks: "satu dua" },
    ]);
  });

  it("recognises both horizontal rules", () => {
    expect(uraikanMarkdown("---")).toEqual([{ jenis: "pemisah" }]);
    expect(uraikanMarkdown("***")).toEqual([{ jenis: "pemisah" }]);
  });
});

describe("uraikanInline", () => {
  it("parses each delimiter kind", () => {
    expect(uraikanInline("**tebal**")).toEqual([
      { jenis: "tebal", teks: "tebal" },
    ]);
    expect(uraikanInline("*miring*")).toEqual([
      { jenis: "miring", teks: "miring" },
    ]);
    expect(uraikanInline("`kode`")).toEqual([{ jenis: "kode", teks: "kode" }]);
  });

  it("surrounds a span with plain text", () => {
    expect(uraikanInline("lihat **ini** ya")).toEqual([
      { jenis: "teks", teks: "lihat " },
      { jenis: "tebal", teks: "ini" },
      { jenis: "teks", teks: " ya" },
    ]);
  });

  it("leaves an unmatched `*` as literal text", () => {
    expect(uraikanInline("2 * 3 = 6")).toEqual([
      { jenis: "teks", teks: "2 * 3 = 6" },
    ]);
    expect(uraikanInline("bintang *")).toEqual([
      { jenis: "teks", teks: "bintang *" },
    ]);
  });

  it("does not interpret `_` inside a word", () => {
    expect(uraikanInline("snake_case")).toEqual([
      { jenis: "teks", teks: "snake_case" },
    ]);
    // `__tebal__` still works when it is not welded to a word.
    expect(uraikanInline("__tebal__")).toEqual([
      { jenis: "tebal", teks: "tebal" },
    ]);
  });

  it("merges adjacent spans of the same kind", () => {
    expect(uraikanInline("**a****b**")).toEqual([
      { jenis: "tebal", teks: "ab" },
    ]);
  });

  it("never produces an empty span", () => {
    expect(uraikanInline("****")).toEqual([{ jenis: "teks", teks: "****" }]);
    expect(uraikanInline("``")).toEqual([{ jenis: "teks", teks: "``" }]);
  });

  it("keeps a <script> tag as a plain `teks` span", () => {
    const span = uraikanInline("<script>alert(1)</script>");
    expect(span).toEqual([
      { jenis: "teks", teks: "<script>alert(1)</script>" },
    ]);
    // Belt and braces: no kind other than `teks` is produced, so nothing a
    // renderer could mistake for markup ever leaves this function.
    expect(span.every((s) => s.jenis === "teks")).toBe(true);
  });

  it("does not let a delimiter inside a code span escape", () => {
    expect(uraikanInline("`**bukan tebal**`")).toEqual([
      { jenis: "kode", teks: "**bukan tebal**" },
    ]);
  });
});
