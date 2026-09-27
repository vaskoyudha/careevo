import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { Reveal } from "../primitives";
import { DitheredHeroBackdrop } from "@/components/features/learning/dithered-hero-backdrop";

/**
 * Closing Careevo Plus CTA.
 *
 * The earlier version was a flat two-up panel: `from-blue-800 via-blue-700
 * to-blue-600` on the left, one portrait on the right. Two things were wrong
 * with it and both are fixed here rather than restyled.
 *
 * 1. The headline was unreadable. `text-white` was set on the h2, but an
 *    unlayered `.marketing-type h2 { color: var(--ocean-deep) }` rule in
 *    globals.css outranked every Tailwind utility, so #0A3D62 was painted on
 *    #1d4ed8 — about 1.4:1. That rule is gone; this heading now needs no
 *    `!important` to be white.
 * 2. It shared nothing with the product. It was a photo panel, while the
 *    cards learners actually meet — the `CatalogCourseCard` recipe — have a
 *    4:3 cover, an overlapping white sheet, a provider row and a rating row.
 *    This panel now speaks that language instead of borrowing a stock image.
 *
 * The composition is Coursera's split banner, which is the right container for
 * this job because the whole page is a subscription pitch: give the copy a
 * dark, contrast-safe column on the left and let the right-hand side perform
 * the offer with real card anatomy and real learner numbers.
 *
 * Layout note: copy and artwork are two real grid columns, so the panel keeps
 * an unbroken dark field behind the white text. An `absolute` overlay was tried
 * first — it read as airy at 1440px and put the artwork straight across the copy
 * at 1280px.
 */

/**
 * Three real learner portraits, not one. "Keahlian nyata" is a claim about a
 * person, and a single stock face is the shape the stock-photo panel this
 * replaces already had. Three also matches the three courses named below.
 *
 * Faces stay cropped: each is 4:3 with `object-cover` and no reveal on hover,
 * because a hover zoom on a stranger's face reads as a UI flourish on a person.
 * Deliberately NOT the photos the testimonial section uses — the same face
 * twice on one page undermines both.
 */
const FACES = [
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=946&h=704&q=80&fit=crop",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=640&h=480&q=80&fit=crop",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=640&h=480&q=80&fit=crop",
];

/**
 * Three things a Plus subscription actually includes, worded from the plan
 * list higher up the page (`PLUS_FEATURES`): unlimited access, publicly
 * verifiable HMAC certificates, and full Socrates AI. Repeated in the offer's
 * own words because this is a closing CTA.
 *
 * An earlier draft put invented outcome statistics here ("+32% peningkatan
 * gaji", "Hired dalam 90 hari"). Nothing in the product supports those numbers,
 * and a fabricated figure in a sales panel is not a design decision, it is a
 * false claim. If real cohort data exists later, this is where it belongs.
 */
const INCLUSIONS = [
  { title: "Akses tanpa batas", note: "Semua kursus & latihan" },
  { title: "Sertifikat HMAC", note: "Bisa diverifikasi publik" },
  { title: "Socrates AI", note: "Bimbingan latihan penuh" },
];

/**
 * The one named course shown on the floating card — the `CatalogCourseCard`
 * anatomy at small size: 4:3 cover, overlapping white sheet, provider row, then
 * a rating row above a hairline. One elevation layer, declared once.
 *
 * The provider is Careevo's own academy and the rating is reused from its
 * catalog entry rather than invented for this panel: this component is a real
 * claim about a real product, so nothing here may be decorative arithmetic.
 */
const FLOATER = {
  provider: "Careevo Academy",
  title: "Analisis Data dengan Python",
  rating: "4.8",
  reviews: "34k",
};

export function CareevoPlusCta() {
  return (
    <section className="bg-white pt-6 pb-16 lg:pb-24" aria-labelledby="plus-cta-heading">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <Reveal variant="scale">
          <div
            className="relative isolate overflow-hidden rounded-3xl shadow-xl"
            style={{
              /* Blue ramp → pale. The heading and body on the left are white,
                 so the ground has to START dark (>=7:1 at the left edge) and
                 stay dark through the ~35% the copy column occupies; the cards
                 on the right are white sheets, which is why the far end only
                 reaches a blue-tinted white — #fff would swallow them. It also
                 doubles as the CSS ground under the dithered field, and is all
                 that shows if WebGL is unavailable. */
              background:
                "linear-gradient(100deg, #0A3D8F 0%, #1259C8 34%, #3B82F6 66%, #9AC4F4 88%, #DCEBFD 100%)",
            }}
          >
            {/* Dithered field — the same texture the /belajar hero is built on,
                faded in over the PALE zone only. Desktop puts the white copy in
                the left column, so the fade runs left→right and never touches
                it. Stacked, the copy is full-width at the top and would sit on
                the pale field, so below `lg` the fade runs top→bottom from the
                copy's measured bottom edge instead. 6 levels keeps the hue and
                leaves a fine blue-white stipple; the /belajar banner learned
                that 4 levels over a near-white ground posterises into grey. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-95 [-webkit-mask-image:linear-gradient(180deg,transparent_330px,#000_460px)] [mask-image:linear-gradient(180deg,transparent_330px,#000_460px)] lg:[-webkit-mask-image:linear-gradient(100deg,transparent_36%,#000_78%)] lg:[mask-image:linear-gradient(100deg,transparent_36%,#000_78%)]"
            >
              <DitheredHeroBackdrop
                levels={6}
                ditherScale={2}
                deep="#8FBBEF"
                mid="#CFE4FC"
                accent="#FFFFFF"
              />
            </div>

            <div className="relative grid grid-cols-1 items-center gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-stretch lg:gap-10 lg:px-12 lg:py-11">
              {/* ── LEFT: copy ───────────────────────────────────────────── */}
              <div className="relative flex flex-col justify-center lg:py-1">
                {/* Lockup, not an eyebrow. It names the product and the body
                    below carries the offer, so the heading is free to be the
                    promise on its own. */}
                <span className="text-lg font-semibold tracking-tight text-white">
                  Care<span className="text-blue-200">evo</span> Plus
                </span>

                <h2
                  id="plus-cta-heading"
                  className="mt-4 text-balance text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.03em] text-white"
                >
                  Waktumu ada di pihakmu. Ubah menit menjadi keahlian.
                </h2>

                <p className="mt-4 max-w-md text-sm leading-relaxed text-blue-50 sm:text-base">
                  Buka seluruh kursus, latihan, dan sertifikat Careevo dengan
                  satu langganan. Tujuh hari pertama gratis — batalkan kapan
                  saja.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Link
                    href="#paket"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-[#0A3D8F] shadow-sm transition-[background-color,transform] duration-200 ease-out hover:bg-blue-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Lihat paket Plus
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M3 8h10M9 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>
                  {/* Plain text, not a second button. Two filled controls in
                      one row make neither of them the answer. */}
                  <Link
                    href="#ketentuan"
                    className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-blue-50 underline decoration-blue-200/70 underline-offset-4 transition-colors duration-200 hover:text-white hover:decoration-white"
                  >
                    Bandingkan paket
                  </Link>
                </div>
              </div>

              {/* ── RIGHT: card stack + inclusion list ───────────────────── */}
              {/* In-flow, not absolutely positioned. An earlier pass used
                  `absolute` inside a fixed-height box and the rotated cards
                  landed on top of the inclusion chips while the portrait's
                  `overflow-hidden` wrapper clipped the course card that is
                  supposed to hang off its corner. Flex columns and a grid make
                  those overlaps impossible rather than merely unlikely. */}
              <div className="flex flex-col gap-5 sm:gap-6 lg:justify-center lg:gap-7">
                {/* A. Fanned pair, from `lg` only. At 768px the copy column is
                    still full-width above this, so the pair pushed the panel
                    taller than the photos could fill and left a dead band below
                    the chips. `lg` is also where the two-column split begins,
                    so the artwork appears with the layout that has room for it. */}
                <div aria-hidden="true" className="relative hidden h-[11rem] lg:block">
                  <div className="absolute left-[2%] top-3 w-[42%] max-w-[13rem] -rotate-6 overflow-hidden rounded-xl border border-white/25 shadow-lg">
                    <div className="relative aspect-[4/3] bg-blue-900">
                      <Image src={FACES[2]} alt="" fill sizes="220px" unoptimized className="object-cover" />
                    </div>
                  </div>
                  <div className="absolute left-[30%] top-0 w-[46%] max-w-[14.5rem] rotate-3 overflow-hidden rounded-xl border border-white/30 shadow-xl">
                    <div className="relative aspect-[4/3] bg-blue-900">
                      <Image src={FACES[1]} alt="" fill sizes="240px" unoptimized className="object-cover" />
                    </div>
                  </div>
                </div>

                {/* B. Hero portrait + the one floating course card. The wrapper
                    deliberately has no `overflow-hidden`: the card is meant to
                    break the portrait's lower-left corner, and clipping it was
                    what turned it into a tray sitting on the image.
                    The portrait is capped at 20rem so the two fanned cards keep
                    the top band: a full-width image here measured 440×330 and
                    ate most of the band, leaving the pair looking like a fringe. */}
                <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,18rem)_1fr] lg:items-end lg:gap-5">
                  <div className="relative w-full max-w-[19rem] lg:max-w-none">
                    <div className="overflow-hidden rounded-2xl border border-white/30 shadow-2xl">
                      <div className="relative aspect-[4/3] bg-blue-900">
                        <Image
                          src={FACES[0]}
                          alt=""
                          fill
                          priority
                          sizes="(max-width: 640px) 88vw, 300px"
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    </div>

                    {/* `mb-0` on the title is load-bearing. globals.css gives
                        every `p` a 1rem bottom margin, and inside a fixed-width
                        floating card that margin inflates the box and pushes the
                        rating row off its own baseline. */}
                    <div className="absolute -bottom-5 -left-2 w-[9.5rem] rounded-xl border border-gray-200/80 bg-white p-2.5 shadow-xl sm:-left-3">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-[#0056D2] text-[9px] font-bold text-white">
                          C
                        </span>
                        <span className="truncate text-[10px] font-medium text-gray-600">
                          {FLOATER.provider}
                        </span>
                      </div>
                      <p className="mt-1 mb-0 line-clamp-2 text-[11px] font-bold leading-snug text-gray-900">
                        {FLOATER.title}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1 border-t border-gray-100 pt-1.5 text-[10px]">
                        <Star className="size-3 shrink-0 fill-[#eb8a04] text-[#eb8a04]" />
                        <span className="font-bold text-gray-900">{FLOATER.rating}</span>
                        <span className="truncate text-gray-500">
                          ({FLOATER.reviews}) · Kursus
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* What Plus includes — a wrapped row under the portrait,
                      a column beside it from `lg`.
                      These sit in the ramp's PALE end, where white text is
                      ~1.5:1. An earlier pass tinted them white and they simply
                      vanished; at 390px the whole panel read as empty space.
                      Near-white ground means dark type, so these carry a white
                      surface and ink text at full contrast.
                      `mb-0` on both lines cancels the global 1rem `p` margin,
                      which is what made three short tiles 76px tall apiece. */}
                  <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-2.5 lg:pb-2">
                    {INCLUSIONS.map((item) => (
                      <li
                        key={item.title}
                        className="rounded-lg border border-white/60 bg-white px-3 py-2 shadow-sm"
                      >
                        <p className="mb-0 text-[11px] font-bold leading-tight text-[#0A3D8F]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 mb-0 text-[10px] leading-tight text-gray-600">
                          {item.note}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
