import { Fingerprint, Link2, ShieldCheck, Ban } from "lucide-react";
import { Reveal } from "./primitives";

const POIN = [
  {
    icon: Link2,
    judul: "Tautan publik, tanpa login",
    teks:
      "Siapa pun bisa buka halaman verifikasi lalu melihat apakah sertifikat itu masih berlaku atau sudah dicabut.",
  },
  {
    icon: Fingerprint,
    judul: "Tanda tangan HMAC-SHA256",
    teks:
      "Isi kredensial di-canonicalize lalu ditandatangani. Ubah satu karakter saja, tanda tangannya tidak lagi cocok.",
  },
  {
    icon: Ban,
    judul: "Bisa dicabut, bukan Dicetak sekali",
    teks:
      "Kredensial bukan gambar yang selamanya ada. Bisa dicabut, dan halaman verifikasinya ikut berubah.",
  },
];

/** Pratinjau payload, mirrors `src/lib/attestation/payload.ts`. */
const PAYLOAD = [
  ["kursus", "Backend Fundamentals"],
  ["jalur", "terverifikasi"],
  ["skor_kuis", "92 / 100"],
  ["diterbitkan", "12 Agustus 2026"],
];

export function MarketingProof() {
  return (
    <section id="bukti" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-[#F9FAFB] px-3 py-1.5 text-xs font-medium text-gray-600">
              <ShieldCheck size={13} strokeWidth={1.75} aria-hidden="true" />
              Bukti, bukan klaim
            </span>
            <h2 className="text-5xl font-medium -tracking-[1.9px] lg:text-6xl">
              Sertifikat yang bisa diuji sendiri
            </h2>
            <p className="mt-5 text-base text-gray-500">
              Kebanyakan sertifikat digital cuma gambar. Ours ditandatangani
              secara kriptografis dan bisa dicek siapa pun, tanpa daftar, tanpa
              kode.
            </p>

            <ul className="mt-10 space-y-7">
              {POIN.map((p) => (
                <li key={p.judul} className="flex gap-4">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700">
                    <p.icon size={16} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-base font-medium text-gray-900">
                      {p.judul}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-gray-500">
                      {p.teks}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={100}>
            <div className="rounded-2xl border border-gray-200 bg-[#F9FAFB] p-3">
              <div className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <span className="font-mono text-[11px] text-gray-400">
                    careevo.id/verify/8f3a91c4
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                    <ShieldCheck size={12} strokeWidth={2} aria-hidden="true" />
                    Terverifikasi
                  </span>
                </div>

                <dl className="divide-y divide-gray-100">
                  {PAYLOAD.map(([kunci, nilai]) => (
                    <div key={kunci} className="flex items-baseline gap-4 px-4 py-3">
                      <dt className="w-28 shrink-0 font-mono text-xs text-gray-400">
                        {kunci}
                      </dt>
                      <dd className="text-sm text-gray-800">{nilai}</dd>
                    </div>
                  ))}
                </dl>

                <div className="border-t border-gray-200 px-4 py-3">
                  <p className="font-mono text-[10px] break-all text-gray-400">
                    signature: 4b7e0c2a9d1f...e83c
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              Pratinjau tampilan halaman verifikasi publik.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
