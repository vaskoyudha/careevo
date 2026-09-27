/**
 * monogram.ts — the two-letter mark on a job card.
 *
 * Pure and separate from the component on purpose: the vitest config only
 * includes `*.test.ts` under `src` in a `node` environment, so an initials
 * helper written inside the card's `.tsx` would be unreachable by any test.
 * Anything that decides what a learner reads belongs here instead.
 */

/**
 * Words that carry the company's legal form, not its identity.
 *
 * "PT Nusantara Digital" should read N-D, not P-T. These are stripped before the
 * initials are taken, so the mark identifies the business rather than its
 * paperwork.
 */
const BENTUK_HUKUM: ReadonlySet<string> = new Set([
  "pt", "cv", "tbk", "ud", "persada", "perusahaan", "co", "corp", "gmbh", "inc", "llc", "bpf",
]);

/** How many significant words contribute a letter. Two reads as a mark, not a word. */
const JUMLAH_HURUF = 2;

/**
 * Initials for a company name, uppercased.
 *
 * One rule, in order:
 *
 *   1. Drop legal-form words ("PT", "CV"…). If that leaves nothing, keep them all
 *      — better a mark from the paperwork than a blank tile.
 *   2. One word left: show it whole when it is already 2 characters or fewer
 *      ("PT" → "PT"), otherwise just its initial ("Gojek" → "G").
 *   3. Otherwise take the first letter of each word, up to two, SKIPPING a
 *      repeated initial. "Koperasi Karya Digital" must not read "KK", which shows
 *      the same letter twice and drops the one word that tells it apart. A mark
 *      exists to be distinguishable at a glance, so "KD" is the answer.
 *
 * Step 3 can still yield a single letter, when every word shares its opening
 * ("Seniman Semangat" → "S"). That is fine — one honest letter beats padding a
 * mark with a second character nobody chose.
 */
export function monogram(nama: string): string {
  if (typeof nama !== "string") return "?";

  const words = nama
    .split(/[\s.]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  if (words.length === 0) return "?";

  const berarti = words.filter((w) => !BENTUK_HUKUM.has(w.toLowerCase()));
  const sumber = berarti.length > 0 ? berarti : words;

  if (sumber.length === 1) {
    const only = sumber[0];
    return only.length <= JUMLAH_HURUF ? only.toUpperCase() : only[0].toUpperCase();
  }

  const huruf: string[] = [];
  for (const word of sumber) {
    const awal = word[0].toUpperCase();
    if (huruf.includes(awal)) continue;
    huruf.push(awal);
    if (huruf.length === JUMLAH_HURUF) break;
  }

  return huruf.join("");
}
