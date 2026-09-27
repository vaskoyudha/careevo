/**
 * html.ts — the HTML→text helpers the page-parsing adapters share.
 *
 * Breezy and Dealls have no JSON endpoint worth using, so their descriptions
 * come out of server-rendered HTML. One stripper, one entity decoder, so the
 * two adapters cannot drift on what "plain text" means.
 */

const ENTITAS: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "\u2013", mdash: "\u2014", hellip: "\u2026",
  lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201c", rdquo: "\u201d",
};

function dekodeEntitas(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (utuh, kode: string) => {
    if (kode[0] === "#") {
      const hex = kode[1]?.toLowerCase() === "x";
      const n = Number.parseInt(hex ? kode.slice(2) : kode.slice(1), hex ? 16 : 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : utuh;
    }
    return ENTITAS[kode.toLowerCase()] ?? utuh;
  });
}

/** HTML to readable plain text. Block boundaries become newlines, not spaces. */
export function htmlKeTeks(html: string): string {
  if (typeof html !== "string" || !html) return "";
  return dekodeEntitas(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    // The generic tag replace above leaves a space wherever a tag was, which
    // after a block boundary reads as an indented line ("One\n Two"). Collapse
    // that space so the block boundary is a newline and nothing else — the
    // rule the doc comment above promises.
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parse the Next.js `__NEXT_DATA__` payload, or null when absent/invalid. */
export function ambilNextData(html: string): unknown | null {
  const m = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as unknown;
  } catch {
    return null;
  }
}

/** The `og:description` meta content, in either attribute order. */
export function metaOgDescription(html: string): string | null {
  const m =
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i.exec(html) ??
    /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i.exec(html);
  return m ? dekodeEntitas(m[1]).trim() || null : null;
}

/**
 * The balanced `<div id="…">…</div>` block.
 *
 * A non-greedy regex stops at the first `</div>`, which on Breezy cuts the
 * description off after its opening paragraph — measured: 79 chars instead of
 * 1725. Counting tags is the only way to find the real end.
 */
export function potongDivId(html: string, id: string): string | null {
  const penanda = new RegExp(`id=["']${id}["']`, "i").exec(html);
  if (!penanda) return null;
  const mulai = html.lastIndexOf("<div", penanda.index);
  if (mulai < 0) return null;

  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = mulai;
  let kedalaman = 0;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html)) !== null) {
    kedalaman += m[0][1] === "/" ? -1 : 1;
    if (kedalaman === 0) return html.slice(mulai, tag.lastIndex);
  }
  return null;
}

/**
 * Drop the template placeholders Breezy's server-rendered page leaves behind —
 * `%BREADCRUMB_JOB_OPENINGS%`, `%BUTTON_APPLY_TO_POSITION%`. Left in, they read
 * as scam-ish shouting in a fraud audit.
 */
export function bersihkanPlaceholder(teks: string): string {
  return teks.replace(/%[A-Z_]+%/g, " ").replace(/\s{2,}/g, " ").trim();
}
