/**
 * kueri-chat.ts — turn a chat sentence into the terms the board filters on.
 *
 * The board's own filter is `buatFilterKonten`, whose `positive` list is OR-ed
 * (upstream career-ops semantics, see `filters.ts`). That is right for a coarse
 * screen over a long description, and wrong for a chat box, for two measured
 * reasons against the real fixtures:
 *
 *   - "lowongan remote" matched the Bandung scam posting, because its own
 *     description opens with the word "Lowongan". OR means one filler word is
 *     enough to drag in an unrelated result.
 *   - "jakarta" missed the two Jakarta postings, because the content filter was
 *     handed `title + description` only and neither mentions the city — it is in
 *     `location`.
 *
 * So this module does the two things the ported filter deliberately does not: it
 * drops the words that carry no discriminating power, and it reports the terms
 * separately so the caller can require ALL of them. The filtering itself is still
 * `buatFilterKonten` — one rule, called once per term. This adds no second
 * definition of "does this posting match".
 */

/**
 * Words that carry no discriminating power in a job query.
 *
 * Deliberately excludes anything a posting could be *about*: "remote",
 * "jakarta", "backend" and "react" are all load-bearing and must survive. Only
 * function words, question words, and the two nouns people prepend to any search
 * ("lowongan", "kerja") are dropped. "lowongan" is the important one — it is the
 * word that made the OR behaviour visible above.
 */
const KATA_BUANG: ReadonlySet<string> = new Set([
  // Indonesian function + question words
  "yang", "dan", "atau", "di", "ke", "dari", "untuk", "dengan", "pada", "itu",
  "ini", "ada", "saya", "aku", "kamu", "kami", "nya", "saja", "juga", "atau",
  "bisa", "boleh", "mau", "ingin", "mencari", "cari", "cari_lowongan", "tolong",
  "dong", "tolong", "ya", "kah", "pun", "agar", "supaya", "buat", "dalam",
  // The two nouns every job query is wrapped in.
  "lowongan", "pekerjaan", "kerja", "job", "jobs", "role", "roles", "posisi",
  // English function + question words
  "the", "a", "an", "for", "with", "in", "on", "of", "to", "and", "or", "me",
  "my", "we", "our", "please", "want", "need", "looking", "any", "some", "at",
  "is", "are", "be",
]);

/** Two characters, so "js" in "Node.js" survives; one character never discriminates. */
const PANJANG_MIN = 2;

/**
 * Split a query into the terms worth filtering on.
 *
 * AND semantics live in the caller, not here: this returns the list, and the
 * board requires every term. Splitting on non-alphanumerics is what makes
 * "React/Node" and "Rp6-8" behave — the punctuation is not part of any term.
 */
export function uraiKueri(kueri: string): string[] {
  if (typeof kueri !== "string") return [];

  const seen = new Set<string>();
  for (const raw of kueri.toLowerCase().split(/[^a-z0-9+]+/)) {
    const term = raw.trim();
    if (term.length < PANJANG_MIN) continue;
    if (KATA_BUANG.has(term)) continue;
    seen.add(term);
  }
  return [...seen];
}

/**
 * The text a term is matched against.
 *
 * `location` and `tags` are included because both carry signal the description
 * omits: a posting is titled "Junior Frontend Developer" with the city only in
 * `location`, and a skill appears in `tags` with no mention in the prose. The
 * ported filter calls itself a coarse screen, so widening its input is within
 * what it was written for.
 */
export function teksLoker(job: {
  title: string;
  description: string;
  location: string;
  tags: string[];
}): string {
  return `${job.title} ${job.description} ${job.location} ${job.tags.join(" ")}`;
}
