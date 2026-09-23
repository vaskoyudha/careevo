import Image from "next/image";
import { cn } from "@/lib/utils";
import { Reveal } from "../primitives";

type Feature = {
  title: string;
  description: string;
  image: string;
  alt: string;
  reverse?: boolean;
};

const FEATURES: Feature[] = [
  {
    title: "Ubah belajarmu menjadi bukti",
    description:
      "Dapatkan kredensial dan sertifikat yang bisa kamu tambahkan ke resume dan LinkedIn, yang mencerminkan keahlian yang kamu latih, alat yang kamu pelajari, dan karya yang kamu buat.",
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1316&h=600&q=80",
    alt: "Ilustrasi kemajuan sebuah course",
  },
  {
    title: "Tahu harus mulai dari mana — maju dalam hitungan menit setiap hari",
    description:
      "Baik kamu pemula atau sedang mengembangkan pengalaman, ikuti jalur terstruktur dengan langkah berikutnya yang jelas agar kamu bisa maju nyata, bahkan dalam sesi singkat.",
    image:
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1316&h=600&q=80",
    alt: "Ilustrasi ikon alat industri yang saling bertumpuk",
    reverse: true,
  },
  {
    title: "Dari pelajaran pertama hingga karya siap portofolio",
    description:
      "Belajar dengan praktik. Bangun proyek memakai alat yang sama dengan para profesional industri—dan tunjukkan hasil belajarmu kepada perusahaan.",
    image:
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1316&h=600&q=80",
    alt: "Ilustrasi proyek portofolio siap kerja",
  },
];

/**
 * Three alternating image/text feature blocks.
 */
export function CareevoPlusFeatures() {
  return (
    <section id="keunggulan" className="bg-white py-6 lg:py-10">
      <div className="mx-auto max-w-7xl space-y-16 px-4 lg:space-y-28 lg:px-6">
        {FEATURES.map((feature) => (
          <Reveal key={feature.title}>
            <div
              className={cn(
                "grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16",
                feature.reverse && "lg:[&>*:first-child]:order-2",
              )}
            >
              <div className="flex flex-col justify-center">
                <h2 className="mb-4 text-3xl font-medium -tracking-[1.9px] text-gray-900 lg:text-5xl">
                  {feature.title}
                </h2>
                <p className="max-w-xl text-base text-gray-500">
                  {feature.description}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-3 shadow-feature-card">
                <Image
                  className="w-full rounded-xl"
                  alt={feature.alt}
                  src={feature.image}
                  width={1316}
                  height={600}
                />
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
