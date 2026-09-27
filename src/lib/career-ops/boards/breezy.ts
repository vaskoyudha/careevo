/**
 * breezy.ts — the Breezy adapter.
 *
 * Breezy's public board feed (`<tenant>.breezy.hr/json`) is free and carries
 * every posting's title and URL — but no description, and its authenticated API
 * is out of bounds. The posting page IS server-rendered, though: the description
 * sits in `<div id="description">`, and `og:description` carries a summary as a
 * fallback.
 *
 * The container also holds Breezy's own template tokens
 * (`%BREADCRUMB_JOB_OPENINGS%`, `%BUTTON_APPLY_TO_POSITION%`). Left in, they read
 * as shouting in a fraud audit, so they are stripped.
 */

import { bersihkanPlaceholder, htmlKeTeks, metaOgDescription, potongDivId } from "./html";
import { applyUrlOffPlatform, hostDari } from "./url";
import { perusahaanTerkenal, type HasilPapan, type PapanAdapter } from "./types";

const HOST = /^[a-z0-9][a-z0-9-]*\.breezy\.hr$/i;
const BAGIAN_URL = /^https?:\/\/[a-z0-9][a-z0-9-]*\.breezy\.hr\/p\//i;

export const breezy: PapanAdapter = {
  nama: "Breezy",
  cocok: (url) => HOST.test(hostDari(url)),

  async ambilDetail(url, io, konteks): Promise<HasilPapan | null> {
    if (!BAGIAN_URL.test(url)) return null;

    const { html } = await io.fetchHtml(url);
    const blok = potongDivId(html, "description");
    const dariBlok = blok ? htmlKeTeks(blok) : "";
    const deskripsi = bersihkanPlaceholder(dariBlok || metaOgDescription(html) || "");
    if (!deskripsi) return null;

    return {
      bahan: {
        description: deskripsi,
        apply_url: applyUrlOffPlatform(null, url),
        company: konteks.perusahaan,
        employer_known: perusahaanTerkenal(konteks.perusahaan),
      },
    };
  },
};
