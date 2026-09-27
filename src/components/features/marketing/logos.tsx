import { Reveal } from "./primitives";

const LOGOS = [
  "KarirHub",
  "Nusatech",
  "DataLoop",
  "Sinergi",
  "Karsa Labs",
  "Kampus Merdeka",
];

function LogoRow({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <ul
      aria-hidden={ariaHidden || undefined}
      className="flex animate-infinite-scroll items-center justify-center [&_li]:mx-5"
    >
      {LOGOS.map((name) => (
        <li key={name}>
          <span className="text-xl font-semibold whitespace-nowrap text-gray-400">
            {name}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MarketingLogos() {
  return (
    <section className="relative z-10 -mt-24 pb-10 lg:-mt-28 lg:pb-20">
      {/*
        Negative top margin pulls this partner strip up into the tail of the
        wave artwork in `#agen` (guild-agents.tsx) instead of leaving it on
        flat white below the fade. The wave mask is fully transparent by 100%,
        so the overlap lands in the already-faded part of the image and keeps
        the `text-gray-700` label and logo names at their existing contrast.
        `relative` + `z-10` keep this section above the wallpaper, which sits
        at `-z-10`; the `pb-10 lg:pb-20` restores the bottom rhythm that the
        negative margin would otherwise remove.
      */}
      <Reveal className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-10 text-base text-gray-700">
            Contoh nama mitra yang akan tampil di sini
          </p>
          <div className="inline-flex w-full flex-nowrap overflow-hidden [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_128px,black_calc(100%-200px),transparent_100%)] [mask-image:linear-gradient(to_right,transparent_0,black_128px,black_calc(100%-200px),transparent_100%)]">
            <LogoRow />
            <LogoRow ariaHidden />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
