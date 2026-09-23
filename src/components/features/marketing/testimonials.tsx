import Image from "next/image";
import { Reveal, Stars } from "./primitives";

const AV = {
  one: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&q=80&fit=crop&crop=faces",
  two: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&q=80&fit=crop&crop=faces",
  three:
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&q=80&fit=crop&crop=faces",
  four: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&q=80&fit=crop&crop=faces",
  five: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&q=80&fit=crop&crop=faces",
};

const SMALL = [
  {
    quote:
      "Attestation-nya bikin rekruter percaya. Saya kirim satu tautan verifikasi dan proses seleksi jadi lebih cepat.",
    name: "Erin Philips",
    role: "Frontend Developer, DataLoop",
    avatar: AV.two,
  },
  {
    quote:
      "Review rubriknya jelas. Saya menilai tanpa perlu mereka ulang bukti, semua sudah terekam rapi.",
    name: "Bagas Nugroho",
    role: "Verifikator, KarirHub",
    avatar: AV.three,
  },
  {
    quote:
      "Zero-PII dan nir-biometrik jadi alasan kampus kami berani pakai. Privasi mahasiswa tetap aman.",
    name: "Sari Wulandari",
    role: "Koordinator Karier, Kampus Merdeka",
    avatar: AV.four,
  },
];

export function MarketingTestimonials() {
  return (
    <section id="testimoni" className="py-10 lg:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <Reveal>
            <h2 className="mb-4 text-5xl font-medium -tracking-[1.9px] text-gray-900 lg:text-6xl">
              Dipercaya peserta dan verifikator
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-base text-gray-500">
              Mereka memakai Careevo untuk merekam proses, menjaga mutu
              verifikasi, dan mempercepat pertemuan dengan peluang kerja.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-12 gap-5 rounded-2xl bg-white p-5">
          <Reveal className="col-span-12 lg:col-span-6">
            <div className="h-full rounded-xl border border-gray-100 bg-white p-6">
              <div className="flex flex-col gap-6 sm:flex-row">
                <div className="flex-1">
                  <Image
                    className="h-72 w-full rounded-lg object-cover"
                    alt=""
                    src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80"
                    width={800}
                    height={600}
                  />
                </div>
                <div className="flex w-5/12 flex-col justify-between">
                  <div>
                    <Stars />
                    <p className="text-base text-gray-700">
                      Proses belajarnya terekam dari jadwal sampai submission.
                      Rasanya seperti punya portofolio yang menilai diri sendiri
                      dengan jujur.
                    </p>
                  </div>
                  <div className="mt-6">
                    <h4 className="text-lg font-medium text-gray-900">
                      Rina Kartika
                    </h4>
                    <span className="text-sm text-gray-500">
                      Peserta, Web Development
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="col-span-12 lg:col-span-6" delay={80}>
            <div className="flex h-full flex-col justify-between rounded-xl bg-white p-6">
              <div>
                <Stars />
                <p className="text-base text-gray-700">
                  Badge terverifikasi mengubah cara kami menyaring kandidat.
                  Buktinya bisa dibuka, bukan sekadar klaim di CV.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <Image
                  className="size-11 rounded-lg object-cover"
                  alt=""
                  src={AV.five}
                  width={44}
                  height={44}
                />
                <div>
                  <h4 className="text-lg font-medium text-gray-900">
                    Andi Pratama
                  </h4>
                  <span className="text-sm text-gray-500">
                    Tech Recruiter, Nusatech
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          {SMALL.map((item, index) => (
            <Reveal
              key={item.name}
              className="col-span-12 md:col-span-4"
              delay={index * 80}
            >
              <div className="flex h-full flex-col justify-between rounded-xl border border-gray-100 bg-white p-6">
                <div>
                  <Stars />
                  <p className="text-base text-gray-700">{item.quote}</p>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <Image
                    className="size-11 rounded-lg object-cover"
                    alt=""
                    src={item.avatar}
                    width={44}
                    height={44}
                  />
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">
                      {item.name}
                    </h4>
                    <span className="text-sm text-gray-500">{item.role}</span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
