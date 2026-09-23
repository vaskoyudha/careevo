import Link from "next/link";
import { Reveal } from "./primitives";

export function MarketingCta() {
  return (
    <section className="relative bg-white pt-28 pb-10">
      <div className="relative z-30 mx-auto max-w-7xl px-6">
        <Reveal variant="scale" className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-5xl font-medium -tracking-[1.9px] text-gray-900 lg:text-6xl">
            Siap membuktikan kemampuan aslimu?
          </h2>
          <p className="mb-9 text-base text-gray-500">
            Mulai latihan coding terarah, asah kesiapan interview teknis, dan
            temukan lowongan kerja yang sesuai dengan keahlianmu hari ini.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row sm:items-center">
            <Link
              href="/daftar"
              className="grad-btn inline-block h-11 rounded-lg px-4 py-2.5 text-base font-medium transition duration-300 ease-in-out"
            >
              Coba Latihan Gratis
            </Link>
            <Link
              href="/masuk"
              className="inline-block h-11 rounded-lg border border-gray-200 px-4 py-2.5 text-base font-medium text-gray-800 transition duration-300 ease-in-out hover:bg-gray-100"
            >
              Masuk
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
