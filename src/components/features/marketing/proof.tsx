import { Ban, Check, Fingerprint, Link2, ShieldCheck } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Reveal } from "./primitives";

const POIN = [
  {
    icon: Link2,
    judul: "Tautan publik, tanpa login",
    teks:
      "Siapa pun bisa buka halaman verifikasi lalu melihat apakah sertifikat itu masih berlaku atau sudah dicabut.",
  },
  {
    icon: Fingerprint,
    judul: "Tanda tangan HMAC-SHA256",
    teks:
      "Isi kredensial diurutkan lalu ditandatangani. Ubah satu karakter saja, tanda tangannya langsung tidak cocok.",
  },
  {
    icon: Ban,
    judul: "Bisa dicabut, bukan dicetak sekali",
    teks:
      "Kredensial bukan gambar yang selamanya ada. Begitu dicabut, halaman verifikasinya ikut berubah.",
  },
];

/**
 * Field dan nilai kartu di bawah disamakan dengan halaman verify publik
 * (`verify-result.tsx`) dan `DEMO_ATTESTATION_PAYLOAD` di
 * `src/lib/attestation/token.ts`. Tujuannya satu: yang tampil di sini harus
 * benar-benar bentuk halaman verifikasi, bukan daftar bidang karangan. Nama
 * field sengaja human-readable ("Pemegang", "Tanggal terbit"), bukan kunci
 * skema (`username`, `issued_at`), karena keterangan di bawah kartu menjanjikan
 * pratinjau *halaman*, bukan dump JSON.
 */
const PAYLOAD = [
  ["Pemegang", "@nadia.dev"],
  ["Task", "Rebuild Challenge: Async Pagination"],
  ["Track", "Web Dev"],
  ["Level", "menengah"],
  ["Skor", "87/100"],
  ["Tanggal terbit", "21 September 2026"],
] as const;

export function MarketingProof() {
  return (
    <section id="bukti" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        {/* `grid-cols-1` is load-bearing, not decoration. Without an explicit
            track list the grid falls back to `grid-template-columns: none`, and
            an auto track is sized to the *max-content/min-content* of its items.
            The unbreakable `careevo.id/verify/8f3a91c4` string in the card
            below then pushed the single mobile column to 336px inside a 288px
            content box, so `body { overflow-x: clip }` silently ate 32px of the
            left column at 320px. `grid-cols-1` = `minmax(0, 1fr)`, which clamps
            the min to 0 and stops the blowout. Same reason `lg:grid-cols-2`
            never showed it: that variant is also `minmax(0, 1fr)`. */}
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-[#F9FAFB] px-3 py-1.5 text-xs font-medium text-gray-600">
              <ShieldCheck size={13} strokeWidth={1.75} aria-hidden="true" />
              Bukti, bukan klaim
            </span>
            <h2 className="text-5xl font-medium -tracking-[1.9px] lg:text-6xl">
              Sertifikat yang bisa diuji sendiri
            </h2>
            <p className="mt-5 text-base text-gray-500">
              Kebanyakan sertifikat digital cuma gambar. Sertifikat Careevo
              ditandatangani secara kriptografis dan bisa dicek siapa pun, tanpa
              daftar, tanpa kode.
            </p>

            <ul className="mt-10 space-y-7">
              {POIN.map((p) => (
                <li key={p.judul} className="flex gap-4">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700">
                    <p.icon size={16} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-base font-medium text-gray-900">
                      {p.judul}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-gray-500">
                      {p.teks}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={100}>
            {/* One surface, not a card nested in a card. The old markup padded a
                tinted `#F9FAFB` mat around a white card, which read as two
                stacked elevations; DESIGN.md asks for one ("one elevation layer
                only; use borders and tinted shadows before adding more nested
                surfaces"), so the card carries its own border and shadow and
                nothing sits inside it. */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-feature-card">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
                {/*
                  `min-w-0 truncate` + `shrink-0` is the flexbox pair for a long
                  unbreakable string beside a fixed pill. A flex item's default
                  `min-width: auto` refuses to shrink below its content width, so
                  the URL pushed the pill past a 320px viewport. `min-w-0`
                  re-permits shrinking, `truncate` gives the overflow somewhere
                  to go, and `shrink-0` keeps the pill at full size.
                */}
                <span className="min-w-0 truncate font-mono text-[11px] text-gray-500">
                  careevo.id/verify/8f3a91c4
                </span>
                {/* The shared `Chip` the real verify page renders (`verify-result.tsx`),
                    not a hand-rolled pill: it already carries the leaf-green
                    success treatment DESIGN.md reserves for status, so the
                    preview and the page it previews finally agree on colour. */}
                <Chip ok className="shrink-0">
                  <ShieldCheck size={12} strokeWidth={2} aria-hidden="true" />
                  Terverifikasi
                </Chip>
              </div>

              <dl className="divide-y divide-gray-100">
                {PAYLOAD.map(([kunci, nilai]) => (
                  <div
                    key={kunci}
                    className="flex items-baseline gap-4 px-4 py-3"
                  >
                    {/* gray-500, not gray-400: at 12px on white, gray-400 lands
                        at 2.60:1 and fails WCAG AA. gray-500 measures 4.83:1. */}
                    <dt className="w-28 shrink-0 text-xs text-gray-500">
                      {kunci}
                    </dt>
                    <dd className="min-w-0 text-sm font-medium text-gray-900">
                      {nilai}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-[#F9FAFB] px-4 py-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 text-[11px] font-medium text-gray-500">
                    Signature
                  </span>
                  <span className="proof-sig-hash min-w-0 truncate font-mono text-[11px] text-gray-600">
                    4b7e0c2a9d1f…e83c
                  </span>
                </span>
                <span className="proof-sig-check inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-leaf-dark">
                  <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                  cocok
                </span>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              Pratinjau tampilan halaman verifikasi publik.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
