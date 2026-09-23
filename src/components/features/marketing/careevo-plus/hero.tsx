import Image from "next/image";
import Link from "next/link";
import { Reveal } from "../primitives";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1312&h=800&q=80";

/**
 * Careevo Plus hero — two-column layout: copy + price on the left,
 * hero illustration with the "3 bulan penghematan" price card on the right.
 * Mirrors the "Ends soon!" hero on the original coursera.org/courseraplus page.
 */
export function CareevoPlusHero() {
  return (
    <section className="bg-white pt-14 pb-10 lg:pt-20 lg:pb-16">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="mb-3 font-mono text-xs tracking-[0.02em] text-blue-500 uppercase">
              Careevo Plus
            </p>
            <h1 className="mb-5 text-4xl leading-[1.08] font-medium -tracking-[1.9px] text-gray-900 sm:text-5xl lg:text-6xl">
              Berakhir sebentar lagi! Belajar fleksibel dan hemat 40% selama 3
              bulan
            </h1>
            <p className="mb-7 max-w-xl text-base text-gray-500">
              Hari sibuk tidak harus menghambatmu. Ubah menit menjadi lebih
              banyak keahlian lewat 10.000+ program dari Microsoft, Google,
              Meta, Stanford, dan lainnya. Mulai langgananmu dengan hemat dan
              nikmati belajar yang mengikuti rutinitasmu.
            </p>

            <p className="mb-7 flex flex-wrap items-end gap-2">
              <span className="text-lg text-gray-400 line-through">
                IDR 570.000
              </span>
              <span className="text-3xl font-medium text-gray-900">
                IDR 342.000
              </span>
              <span className="text-base text-gray-500">
                /bulan, batalkan kapan saja
              </span>
            </p>

            <div className="mb-5 flex flex-wrap items-center gap-4">
              <Link
                href="#paket"
                className="grad-btn inline-block h-11 rounded-lg px-6 py-2.5 text-base font-medium transition duration-300 ease-in-out"
              >
                Hemat 40% sekarang
              </Link>
              <span className="text-sm text-gray-500">
                atau IDR 3.893.000/tahun untuk Careevo Plus Tahunan
              </span>
            </div>

            <p className="text-xs text-gray-400">
              Penawaran berakhir 23 September 2026, lihat{" "}
              <Link
                href="#ketentuan"
                className="text-blue-600 underline underline-offset-2"
              >
                Ketentuan Penawaran
              </Link>
              .
            </p>
          </Reveal>

          <Reveal variant="scale" delay={120}>
            <div className="relative rounded-2xl bg-white p-3 shadow-feature-card">
              <Image
                className="w-full rounded-xl"
                alt="Ilustrasi tiga sertifikat Careevo yang saling bertumpuk"
                src={HERO_IMAGE}
                width={1312}
                height={800}
                priority
              />
              <div className="absolute bottom-6 left-6 rounded-xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
                <p className="text-sm text-gray-400 line-through">
                  IDR 570.000
                </p>
                <p className="text-lg font-medium text-gray-900">
                  IDR 342.000
                  <span className="text-sm text-gray-500">/bulan</span>
                </p>
                <p className="text-xs text-gray-500">3 bulan penghematan</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
