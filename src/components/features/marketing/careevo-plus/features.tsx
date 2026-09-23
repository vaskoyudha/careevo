import Image from "next/image";
import { Reveal } from "../primitives";

type Feature = {
  title: string;
  description: string;
  image?: string;
  alt?: string;
  reverse?: boolean;
};

const FEATURES: Feature[] = [
  {
    title: "Ubah belajarmu menjadi bukti",
    description:
      "Dapatkan kredensial dan sertifikat yang bisa kamu tambahkan ke resume dan LinkedIn, yang mencerminkan keahlian yang kamu latih, alat yang kamu pelajari, dan karya yang kamu buat.",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1316&h=600&q=80",
    alt: "Tampilan kredensial dan sertifikat digital dari berbagai program",
  },
  {
    title: "Tahu harus mulai dari mana — maju dalam hitungan menit setiap hari",
    description:
      "Baik kamu pemula atau sedang mengembangkan pengalaman, ikuti jalur terstruktur dengan langkah berikutnya yang jelas agar kamu bisa maju nyata, bahkan dalam sesi singkat.",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1316&h=600&q=80",
    alt: "Ikon alat industri seperti Excel, Python, dan Power BI",
    reverse: true,
  },
  {
    title: "Dari pelajaran pertama hingga karya siap portofolio",
    description:
      "Belajar dengan praktik. Bangun proyek memakai alat yang sama dengan para profesional industri—dan tunjukkan hasil belajarmu kepada perusahaan.",
  },
];

/**
 * Three alternating image/text feature blocks matching the original layout.
 */
export function CareevoPlusFeatures() {
  return (
    <section id="keunggulan" className="bg-white py-6 lg:py-10">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className={`grid grid-cols-1 items-center gap-10 py-10 lg:gap-16 ${feature.image ? "lg:grid-cols-2" : "lg:grid-cols-1"} ${feature.reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
          >
            <Reveal>
              <div>
                <h2 className="mb-4 text-3xl font-medium -tracking-[1.9px] text-gray-900 lg:text-4xl">
                  {feature.title}
                </h2>
                <p className="max-w-lg text-base text-gray-500">
                  {feature.description}
                </p>
              </div>
            </Reveal>
            {feature.image ? (
              <Reveal variant="scale" delay={80}>
                <div className="overflow-hidden rounded-2xl bg-white p-3 shadow-feature-card">
                  <Image
                    className="w-full rounded-xl"
                    alt={feature.alt ?? ""}
                    src={feature.image}
                    width={1316}
                    height={600}
                  />
                </div>
              </Reveal>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
