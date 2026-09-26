/**
 * Markdown "ringan" (light) — a deliberately tiny, dependency-free parser that
 * turns a tutor's plain-text answer into *data*, never into HTML.
 *
 * ## Why data and not a string
 * The repo has a hard invariant: no raw-HTML injection prop is ever used. A
 * parser that echoed HTML would push the escaping problem onto every caller, and
 * the first caller that forgot would turn a model reply into an XSS vector. So
 * this module emits typed blocks/spans and React's own escaping does the rest: a
 * `<script>` in the answer is just a `{ jenis: "teks", teks: "<script>…" }` span.
 *
 * ## Scope
 * A *subset* of Markdown, not CommonMark. The goal is "small and predictable":
 * when in doubt we prefer to leave a marker as literal text rather than guess at
 * a rich construct. Two deliberate departures from CommonMark are documented
 * inline (`uraikanMarkdown` breaks a paragraph at a new block; `_` emphasis may
 * not sit inside a word).
 */

export type BlokMarkdown =
  | { jenis: "judul"; tingkat: 1 | 2 | 3 | 4; teks: string }
  | { jenis: "paragraf"; teks: string }
  | { jenis: "daftar"; terurut: boolean; awal: number; item: string[] }
  | { jenis: "kode"; bahasa: string | null; isi: string }
  | { jenis: "kutipan"; teks: string }
  | { jenis: "pemisah" };

export type SpanInline =
  | { jenis: "teks"; teks: string }
  | { jenis: "tebal"; teks: string }
  | { jenis: "miring"; teks: string }
  | { jenis: "kode"; teks: string };

/** `# ` … `#### ` — five or more hashes are *not* a heading (see test). */
const POLA_JUDUL = /^(#{1,4})(?!#)\s+(.*)$/;
/** `- `, `* `, `+ ` */
const POLA_DAFTAR = /^[-*+]\s+(.*)$/;
/** `1. `, `2) ` — either punctuation, the number is what matters for `awal`. */
const POLA_DAFTAR_TERURUT = /^(\d+)[.)]\s+(.*)$/;
/** A `_` that we may treat as an emphasis delimiter must not touch a word. */
const KATA = /[A-Za-z0-9_]/;

function garisBawahDiDalamKata(teks: string, i: number): boolean {
  return i >= 0 && i < teks.length && KATA.test(teks[i]);
}

/** True if `baris` (already trimmed) opens a block that cannot live inside a paragraph. */
function mulaiBlokBaru(baris: string): boolean {
  if (baris.startsWith("```")) return true;
  if (baris === "---" || baris === "***") return true;
  if (baris.startsWith(">")) return true;
  if (POLA_JUDUL.test(baris)) return true;
  if (POLA_DAFTAR.test(baris) || POLA_DAFTAR_TERURUT.test(baris)) return true;
  return false;
}

/**
 * Splits `teks` into top-level blocks. Blank lines separate blocks; empty or
 * whitespace-only input yields `[]`.
 */
export function uraikanMarkdown(teks: string): BlokMarkdown[] {
  if (typeof teks !== "string" || teks.trim() === "") return [];

  const baris = teks.split(/\r?\n/);
  const blok: BlokMarkdown[] = [];
  let i = 0;

  while (i < baris.length) {
    const bersih = baris[i].trim();

    // Blank line: pure separator, emits nothing.
    if (bersih === "") {
      i++;
      continue;
    }

    // Fenced code. The body is copied verbatim — never parsed as markdown,
    // which is exactly how a tutor's `**` or `#` inside a snippet stays intact.
    if (bersih.startsWith("```")) {
      const info = bersih.slice(3).trim();
      const isiBaris: string[] = [];
      i++;
      while (i < baris.length && !baris[i].trim().startsWith("```")) {
        isiBaris.push(baris[i]);
        i++;
      }
      // Unterminated fence: the loop above already consumed to end of text.
      if (i < baris.length) i++; // drop the closing fence
      let isi = isiBaris.join("\n");
      if (isi.endsWith("\n")) isi = isi.slice(0, -1);
      blok.push({ jenis: "kode", bahasa: info === "" ? null : info, isi });
      continue;
    }

    // Horizontal rule. Checked before lists so `---` never becomes a bullet.
    if (bersih === "---" || bersih === "***") {
      blok.push({ jenis: "pemisah" });
      i++;
      continue;
    }

    const judul = POLA_JUDUL.exec(bersih);
    if (judul) {
      const tingkat = judul[1].length as 1 | 2 | 3 | 4;
      blok.push({ jenis: "judul", tingkat, teks: judul[2].trim() });
      i++;
      continue;
    }

    // Block quote: consecutive `>` lines collapse into one quoted string.
    if (bersih.startsWith(">")) {
      const potongan: string[] = [];
      while (i < baris.length) {
        const b = baris[i].trim();
        if (!b.startsWith(">")) break;
        potongan.push(b.replace(/^>\s?/, ""));
        i++;
      }
      blok.push({ jenis: "kutipan", teks: potongan.join(" ").trim() });
      continue;
    }

    const tidakTerurut = POLA_DAFTAR.exec(bersih);
    const terurut = POLA_DAFTAR_TERURUT.exec(bersih);
    if (tidakTerurut || terurut) {
      const urut = terurut !== null;
      const awal = terurut ? Number.parseInt(terurut[1], 10) : 1;
      const item: string[] = [];
      // The list ends at a blank line, a non-list line, or a switch of kind
      // (one `daftar` carries a single `terurut` flag, so mixed lists split).
      while (i < baris.length) {
        const b = baris[i].trim();
        if (b === "") break;
        const cocok = urut
          ? POLA_DAFTAR_TERURUT.exec(b)
          : POLA_DAFTAR.exec(b);
        if (!cocok) break;
        item.push((urut ? cocok[2] : cocok[1]).trim());
        i++;
      }
      blok.push({ jenis: "daftar", terurut: urut, awal, item });
      continue;
    }

    // Paragraph: consecutive non-blank lines, interior newlines preserved.
    // Deliberate departure from a literal "swallow until blank line" reading —
    // a line that *opens* another block ends the paragraph, so `teks` directly
    // followed by `# Judul` renders as prose + heading instead of swallowing
    // the marker into the text.
    const potongan: string[] = [];
    while (i < baris.length) {
      const b = baris[i].trim();
      if (b === "") break;
      if (potongan.length > 0 && mulaiBlokBaru(b)) break;
      potongan.push(b);
      i++;
    }
    blok.push({ jenis: "paragraf", teks: potongan.join("\n").trim() });
  }

  return blok;
}

/**
 * Concatenates two adjacent spans that share a `jenis`. Written as an explicit
 * switch instead of a spread so the discriminated union stays type-safe.
 */
function gabungSpan(a: SpanInline, b: SpanInline): SpanInline {
  const isi = a.teks + b.teks;
  switch (a.jenis) {
    case "teks":
      return { jenis: "teks", teks: isi };
    case "tebal":
      return { jenis: "tebal", teks: isi };
    case "miring":
      return { jenis: "miring", teks: isi };
    case "kode":
      return { jenis: "kode", teks: isi };
  }
}

/**
 * Finds a `_`/`__` that may *close* an emphasis run: the character after the run
 * must not be a word character, otherwise `snake_case` would light up half its
 * own name. Returns -1 when no such delimiter exists.
 */
function cariPenutupGarisBawah(
  teks: string,
  mulai: number,
  lebar: number
): number {
  const penanda = "_".repeat(lebar);
  let j = mulai;
  while (j < teks.length) {
    const k = teks.indexOf(penanda, j);
    if (k < 0) return -1;
    const sesudah = k + lebar;
    if (sesudah >= teks.length || !KATA.test(teks[sesudah])) return k;
    j = k + 1;
  }
  return -1;
}

/**
 * Splits a single line (or paragraph) into inline spans.
 *
 * Greedy, left-to-right, single pass. Precedence is `` `code` ``, `**tebal**`,
 * `*miring*`, `__tebal__`, `_miring_`. Unmatched delimiters stay literal, empty
 * spans are dropped, and adjacent spans of the same kind are merged — so
 * `**a****b**` is one `tebal "ab"`, never two touching ones.
 */
export function uraikanInline(teks: string): SpanInline[] {
  const span: SpanInline[] = [];
  let buf = "";
  let i = 0;

  const dorong = (s: SpanInline) => {
    if (s.teks === "") return;
    const iAkhir = span.length - 1;
    const akhir = span[iAkhir];
    if (akhir && akhir.jenis === s.jenis) {
      span[iAkhir] = gabungSpan(akhir, s);
      return;
    }
    span.push(s);
  };

  const siram = () => {
    if (buf !== "") {
      dorong({ jenis: "teks", teks: buf });
      buf = "";
    }
  };

  while (i < teks.length) {
    const c = teks[i];

    if (c === "`") {
      // No nesting and no escaping inside: the first closing backtick wins.
      const tutup = teks.indexOf("`", i + 1);
      if (tutup > i + 1) {
        siram();
        dorong({ jenis: "kode", teks: teks.slice(i + 1, tutup) });
        i = tutup + 1;
        continue;
      }
    } else if (c === "*" && teks[i + 1] === "*") {
      const tutup = teks.indexOf("**", i + 2);
      if (tutup > i + 2) {
        siram();
        dorong({ jenis: "tebal", teks: teks.slice(i + 2, tutup) });
        i = tutup + 2;
        continue;
      }
    } else if (c === "*") {
      const tutup = teks.indexOf("*", i + 1);
      if (tutup > i + 1) {
        siram();
        dorong({ jenis: "miring", teks: teks.slice(i + 1, tutup) });
        i = tutup + 1;
        continue;
      }
    } else if (c === "_" && !garisBawahDiDalamKata(teks, i - 1)) {
      if (teks[i + 1] === "_") {
        const tutup = cariPenutupGarisBawah(teks, i + 2, 2);
        if (tutup > i + 2) {
          siram();
          dorong({ jenis: "tebal", teks: teks.slice(i + 2, tutup) });
          i = tutup + 2;
          continue;
        }
      } else {
        const tutup = cariPenutupGarisBawah(teks, i + 1, 1);
        if (tutup > i + 1) {
          siram();
          dorong({ jenis: "miring", teks: teks.slice(i + 1, tutup) });
          i = tutup + 1;
          continue;
        }
      }
    }

    // Anything unmatched — a lone `*`, a bare backtick, a `<script>` — is plain
    // text. There is no other branch, which is the whole point.
    buf += c;
    i++;
  }

  siram();
  return span;
}
