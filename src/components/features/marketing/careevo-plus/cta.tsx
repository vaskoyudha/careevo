import Image from "next/image";
import Link from "next/link";
import { Reveal } from "../primitives";

const PORTRAIT =
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=946&h=704&q=80&fit=crop";

/**
 * Dark closing CTA — "Waktumu ada di pihakmu. Mulai ubah menit menjadi
 * pencapaian." Mirrors the inverted Careevo Plus panel with a portrait.
 */
export function CareevoPlusCta() {
  return (
    <section className="bg-white pt-6 pb-16 lg:pb-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <Reveal variant="scale">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600">
            <div className="grid grid-cols-1 items-center lg:grid-cols-2">
              <div className="px-8 py-12 lg:px-14 lg:py-16">
                <span className="mb-6 inline-flex items-center text-lg font-semibold tracking-tight text-white">
                  Care<span className="text-blue-200">evo</span> Plus
                </span>
                <h2 className="mb-4 text-3xl font-medium tracking-tight text-white lg:text-5xl">
                  Waktumu ada di pihakmu. Mulai ubah menit menjadi pencapaian.
                </h2>
                <p className="mb-8 max-w-lg text-base text-blue-100">
                  Hanya dalam tujuh hari, kamu bisa bergerak dari pelajaran
                  singkat menuju keahlian nyata. Siap membuat hari ini berarti?
                </p>
                <Link
                  href="#paket"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-base font-medium text-blue-700 transition duration-300 ease-in-out hover:bg-blue-50"
                >
                  Lihat paket Plus
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 8h10M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </div>
              <div className="relative h-64 lg:h-full lg:min-h-[420px]">
                <Image
                  className="h-full w-full object-cover"
                  alt="Pelajar Careevo Plus"
                  src={PORTRAIT}
                  width={946}
                  height={704}
                />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
