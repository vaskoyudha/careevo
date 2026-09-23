import Image from "next/image";
import { Reveal } from "../primitives";

const TESTIMONIALS = [
  {
    name: "Abigail P.",
    quote:
      "Saya punya pekerjaan penuh waktu dan 3 anak. Saya butuh fleksibilitas yang ditawarkan Careevo Plus untuk mencapai target saya. Langganan Careevo Plus memotivasi saya untuk terus belajar.",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&q=80&fit=crop&crop=faces",
  },
  {
    name: "Shi Jie F.",
    quote:
      "Careevo Plus membuat saya tetap termotivasi untuk belajar. Di setiap course, saya mendapatkan lebih banyak nilai dari langganan saya. Saya bisa mengakses hampir semua hal dengan Careevo Plus!",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&h=128&q=80&fit=crop&crop=faces",
  },
  {
    name: "Inés K.",
    quote:
      "Saya sangat menghargai fleksibilitas yang saya dapat dengan Careevo Plus. Saya bisa mencoba course apa pun dan beralih ke yang lain tanpa biaya tambahan. Ini memotivasi saya untuk belajar lebih banyak!",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=128&h=128&q=80&fit=crop&crop=faces",
  },
];

/**
 * "Is Careevo Plus worth it? Hear from subscribers" testimonials.
 */
export function CareevoPlusTestimonials() {
  return (
    <section id="testimoni" className="bg-white py-14 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <Reveal>
          <h2 className="mx-auto mb-12 max-w-3xl text-center text-3xl font-medium -tracking-[1.9px] text-gray-900 lg:text-5xl">
            Apakah Careevo Plus sepadan? Dengar dari para pelanggan
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((item, index) => (
            <Reveal key={item.name} delay={index * 80}>
              <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6">
                <Image
                  className="mb-5 size-16 rounded-full object-cover"
                  alt=""
                  src={item.avatar}
                  width={64}
                  height={64}
                />
                <h3 className="mb-3 text-xl font-medium text-gray-900">
                  {item.name}
                </h3>
                <p className="text-base text-gray-500">{item.quote}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
