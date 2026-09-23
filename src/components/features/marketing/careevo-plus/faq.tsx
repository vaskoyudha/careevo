"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Reveal } from "../primitives";

const FAQS = [
  {
    q: "Bisakah saya mencoba Careevo Plus dulu, untuk memastikan ini cocok?",
    a: (
      <>
        Bisa! Ada dua opsi, tergantung paket pembayaran yang kamu pilih.
        <br />
        Jika kamu memilih pembayaran bulanan, kamu bisa memanfaatkan uji coba
        gratis 7 hari untuk merasakan belajar dengan Careevo Plus sebelum
        memutuskan membeli. Kami mencatat informasi pembayaran saat kamu
        berlangganan, tetapi kamu tidak akan ditagih sampai masa uji coba 7 hari
        berakhir. Jadi, jika kamu merasa Careevo Plus tidak cocok, cukup
        batalkan selama masa uji coba dan tidak ada biaya.
        <br />
        Jika kamu memilih pembayaran tahunan, kamu memiliki waktu hingga 14 hari
        untuk mengajukan permintaan pengembalian dana jika merasa Careevo Plus
        tidak cocok. Prosesnya sederhana—buka{" "}
        <Link
          href="/masuk"
          className="text-blue-600 underline underline-offset-2"
        >
          halaman Pembelian Saya
        </Link>{" "}
        dalam 14 hari setelah pembayaran dan ajukan permintaan pengembalian
        dana. Tidak ada informasi tambahan yang diperlukan. Perlu dicatat bahwa
        sertifikat yang kamu raih dalam 14 hari pertama akan dicabut jika kamu
        memutuskan untuk mengembalikan dana pada periode tersebut.
        <br />
        Untuk informasi tambahan, lihat{" "}
        <Link
          href="/masuk"
          className="text-blue-600 underline underline-offset-2"
        >
          kebijakan pengembalian dana
        </Link>{" "}
        lengkap kami.
      </>
    ),
  },
  {
    q: "Apa saja yang termasuk dalam Careevo Plus?",
    a: (
      <>
        Dengan langganan Careevo Plus, kamu mendapat akses tanpa batas ke lebih
        dari 10.000 course, proyek, spesialisasi, dan program sertifikat
        profesional di berbagai bidang, termasuk data science, bisnis, ilmu
        komputer, kesehatan, pengembangan diri, humaniora, dan lainnya.
        Sebagian besar course di Careevo termasuk. Beberapa course,
        spesialisasi, dan program sertifikat profesional dikecualikan.
        Careevo Plus juga tidak mencakup gelar atau program sertifikat lanjutan.
        Untuk memastikan suatu penawaran termasuk, cari lencana
        Careevo Plus, atau periksa{" "}
        <Link
          href="/masuk"
          className="text-blue-600 underline underline-offset-2"
        >
          daftar konten yang termasuk
        </Link>
        .
      </>
    ),
  },
  {
    q: "Apakah saya akan menghemat uang dengan Careevo Plus?",
    a: "Ya. Jika kamu mengambil lebih dari 1 course secara rutin, kamu bisa menghemat hingga 30% setiap bulan. Semakin banyak kamu belajar, semakin banyak kamu hemat.",
  },
  {
    q: "Berapa lama saya bisa mengakses course setelah berlangganan?",
    a: "Selama langganan Careevo Plus aktif, kamu bisa mengakses seluruh konten yang termasuk kapan saja dan dari perangkat apa pun—tanpa batas jumlah course yang bisa kamu ambil. Kamu hanya dibatasi oleh seberapa cepat kamu belajar.",
  },
  {
    q: "Apakah sertifikat yang saya raih bisa dibagikan ke LinkedIn?",
    a: (
      <>
        Tentu. Setiap sertifikat yang kamu selesaikan bisa ditambahkan langsung
        ke profil LinkedIn dan resume-mu. Sertifikat mencerminkan keahlian yang
        kamu latih, alat yang kamu pelajari, dan proyek yang kamu buat, sehingga
        bisa jadi bukti nyata bagi perusahaan. Lihat{" "}
        <Link
          href="/masuk"
          className="text-blue-600 underline underline-offset-2"
        >
          panduan sertifikat
        </Link>{" "}
        untuk langkah-langkahnya.
      </>
    ),
  },
  {
    q: "Bagaimana cara membatalkan langganan saya?",
    a: "Kamu bisa membatalkan kapan saja lewat pengaturan akun tanpa biaya tambahan. Setelah dibatalkan, akses ke konten Careevo Plus tetap berlaku hingga akhir periode penagihan yang sedang berjalan, dan kamu tidak akan ditagih lagi setelahnya.",
  },
  {
    q: "Apakah Careevo Plus tersedia untuk tim atau perusahaan?",
    a: (
      <>
        Ya. Lewat paket Careevo for Teams, kamu bisa meningkatkan keahlian
        hingga 125 karyawan per akun, lengkap dengan analitik, laporan
        benchmark khusus, dan opsi pembayaran fleksibel seperti tagihan
        kuartalan dan invoice. Pelajari lebih lanjut di{" "}
        <Link
          href="/masuk"
          className="text-blue-600 underline underline-offset-2"
        >
          halaman Careevo for Teams
        </Link>
        .
      </>
    ),
  },
  {
    q: "Perangkat dan bahasa apa yang didukung?",
    a: "Careevo Plus bisa diakses lewat browser desktop maupun aplikasi mobile, jadi kamu bisa belajar di sela-sela kesibukan. Banyak program tersedia dengan subtitle dan terjemahan dalam berbagai bahasa, sehingga kamu bisa belajar dengan cara yang paling nyaman untukmu.",
  },
];

const VISIBLE_COUNT = 3;

/**
 * "Frequently asked questions" accordion.
 * Shows the first 3 questions and expands to all 8, like the original page.
 */
export function CareevoPlusFaq() {
  const [open, setOpen] = useState<number | null>(0);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? FAQS : FAQS.slice(0, VISIBLE_COUNT);

  return (
    <section id="faq" className="bg-white py-14 lg:py-20">
      <div className="mx-auto max-w-4xl px-4 lg:px-6">
        <Reveal>
          <h2 className="mb-10 text-center text-3xl font-medium -tracking-[1.9px] text-gray-900 lg:text-5xl">
            Pertanyaan yang sering diajukan
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <div>
            {visible.map((item, index) => {
              const isOpen = open === index;
              return (
                <div key={item.q} className="border-b border-gray-200 py-6">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between text-left"
                  >
                    <h3 className="text-lg font-medium -tracking-[0.18px] text-gray-900 lg:text-xl">
                      {item.q}
                    </h3>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "ml-4 shrink-0 text-2xl leading-none text-gray-950 transition-transform duration-300",
                        isOpen && "rotate-45",
                      )}
                    >
                      +
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="mt-4 space-y-2 text-base text-gray-500">
                      {item.a}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Reveal>

        {!showAll ? (
          <Reveal delay={120}>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-8 cursor-pointer text-base font-medium text-blue-600 transition-opacity hover:opacity-75"
            >
              Tampilkan semua {FAQS.length} pertanyaan yang sering diajukan
            </button>
          </Reveal>
        ) : null}

        <Reveal delay={160}>
          <p className="mt-8 text-xs text-gray-400">
            1 -{" "}
            <Link
              href="/daftar"
              className="text-blue-600 underline underline-offset-2"
            >
              Sumber: Laporan Hasil Pelajar 2025
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
