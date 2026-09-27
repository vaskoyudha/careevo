/**
 * kueri-inbox.ts — filter the scanned inbox by a free-text query.
 *
 * The dashboard's "Cari lowongan" searches the learner's own scanned rows, not
 * the marketing board. The two corpora are different shapes: a board row is a
 * `JobFixture` with `title`/`description`/`location`/`tags`, while an inbox row
 * is an `InboxJob` with `role`/`company`/`location`/`compensation`. So the
 * board's `teksLoker` cannot be reused here — it would read fields the inbox
 * does not have.
 *
 * What IS reused is the query language. `uraiKueri` turns a sentence into the
 * terms worth matching (dropping filler words), and `buatFilterKonten` is the
 * single definition of "does this text match a term". This module only decides
 * *which text* an inbox row exposes to that filter, and that every term must
 * match (AND) — the same rule `JobsBoard` applies, so a search means the same
 * thing on both surfaces.
 */

import type { InboxJob } from "@/lib/career-ops";
import { buatFilterKonten } from "@/lib/jobs/filters";
import { uraiKueri } from "@/lib/jobs/kueri-chat";

/**
 * The text an inbox row is searched over.
 *
 * `role` leads: it is the field a learner means when they type "backend" or
 * "data". `company` and `location` follow because "Amartha" and "Jakarta" are
 * equally natural queries. `compensation` is last — "10 jt" is a real query but
 * the least common of the four.
 *
 * `filter(Boolean)` drops the optional fields an inbox row may lack, so a row
 * with no location still searches cleanly over what it does have.
 */
export function teksInbox(job: InboxJob): string {
  return [job.role, job.company, job.location, job.compensation]
    .filter((bagian): bagian is string => Boolean(bagian))
    .join(" ");
}

/**
 * Filter inbox rows by a free-text query.
 *
 * An empty query returns the rows unchanged — the caller decides what "no
 * query" means (show all, show none), and a filter that special-cased it would
 * be a second definition of that decision.
 *
 * Every term must match (AND). `uraiKueri` already dropped the words that carry
 * no discriminating power, so "lowongan di jakarta" and "jakarta" are the same
 * query here — the filler word cannot drag in an unrelated row.
 */
export function filterInbox(baris: InboxJob[], kueri: string): InboxJob[] {
  const perTerm = uraiKueri(kueri).map((term) => buatFilterKonten({ positive: [term] }));
  if (perTerm.length === 0) return baris;

  return baris.filter((job) => {
    const teks = teksInbox(job);
    return perTerm.every((filter) => filter(teks));
  });
}
