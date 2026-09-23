import Image from "next/image";
import { Reveal } from "./primitives";

const FEATURES: {
  id?: string;
  title: string;
  description: string;
  image: string;
}[] = [
  {
    id: "socrates",
    title: "Bimbingan & evaluasi Sokratik",
    description:
      "Bukan memberi jawaban instan. Socrates menguji logika kode yang kamu tulis, menanyakan alasan trade-off arsitektur, dan melatihmu agar siap saat menghadapi interview teknis.",
    image:
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=900&q=80",
  },
  {
    id: "verifikasi",
    title: "Bukti kompetensi terverifikasi",
    description:
      "Alur penyelesaian tugas dan pengujian dicatat otomatis tanpa kamera pengawas. Hasilkan bukti proses kerja yang bisa langsung dicek dan dipercaya rekruter.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80",
  },
  {
    id: "loker",
    title: "Rekomendasi loker & penutup skill gap",
    description:
      "Temukan lowongan kerja yang sesuai dengan skill dan CV kamu saat ini, bebas dari pungutan liar, lengkap dengan panduan materi untuk menutup skill yang masih kurang.",
    image:
      "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=900&q=80",
  },
];

export function MarketingFeatures() {
  return (
    <section id="fitur" className="bg-white py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <Reveal>
            <h2 className="mb-4 text-4xl font-medium -tracking-[1.9px] text-gray-900 lg:text-6xl">
              Tiga langkah nyata: belajar, buktikan, dan siap kerja
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-base text-gray-500">
              Mulai dari bimbingan logika coding, verifikasi alur kerja tanpa
              kamera pengawas, sampai kurasi lowongan kerja yang relevan.
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
