import Image from "next/image";
import { Reveal } from "./primitives";

const FEATURES: {
  id?: string;
  title: string;
  description: string;
  image: string;
}[] = [
  {
    id: "verifikasi",
    title: "Bukti belajar terverifikasi",
    description:
      "Setiap task yang lulus ditandatangani HMAC-SHA256 dan bisa diverifikasi publik lewat satu tautan.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80",
  },
  {
    title: "Audit loker otomatis",
    description:
      "Sentinel memeriksa pola fee, regex transfer pribadi, dan usia domain sebelum lowongan tampil.",
    image:
      "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=900&q=80",
  },
  {
    title: "Navigator skill gap",
    description:
      "Rekomendasi task diambil dari tren loker, transparan, dan tidak pernah mengubah skor kamu.",
    image:
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=900&q=80",
  },
];

export function MarketingFeatures() {
  return (
    <section id="fitur" className="bg-white py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <Reveal>
            <h2 className="mb-4 text-4xl font-medium -tracking-[1.9px] text-gray-900 lg:text-6xl">
              Semua yang kamu butuhkan untuk membuktikan kompetensi
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-base text-gray-500">
              Proses belajar terekam, hasil ditandatangani, dan tiap lowongan
              melewati audit agen sebelum sampai ke kamu.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} id={feature.id} delay={index * 80}>
              <div className="rounded-2xl bg-white p-3 shadow-feature-card">
                <div>
                  <Image
                    className="w-full rounded-xl"
                    alt={feature.title}
                    src={feature.image}
                    width={900}
                    height={560}
                  />
                </div>
                <div className="p-5">
                  <h3 className="mb-2 text-2xl font-medium text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-500">{feature.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
