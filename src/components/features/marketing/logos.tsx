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
    <section className="py-10 lg:py-20">
      <Reveal className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-10 text-base text-gray-700">
            Dipercaya peserta, verifikator, dan tim rekrutmen di seluruh Indonesia
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
