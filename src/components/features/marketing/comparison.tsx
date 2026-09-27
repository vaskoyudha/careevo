import { Check, Minus, Scale, X } from "lucide-react";
import { Reveal } from "./primitives";
import {
  KELOMPOK,
  PLATFORM,
  SR,
  type Sel,
  type Status,
} from "./comparison-data";

function Ikon({ status }: { status: Status }) {
  const dasar = "inline-flex size-5 shrink-0 items-center justify-center rounded-full";

  if (status === "ya") {
    return (
      <span className={`${dasar} bg-blue-500 text-white`}>
        <Check size={12} strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }

  if (status === "tidak") {
    return (
      <span className={`${dasar} bg-gray-100 text-gray-400`}>
        <X size={12} strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }

  if (status === "sebagian") {
    return (
      <span className={`${dasar} border-2 border-amber-300 text-amber-600`}>
        <Minus size={12} strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }

  if (status === "na") {
    // Tanpa lingkaran sama sekali. `na` dan `belum` sama-sama berarti
    // "tidak ada", jadi kalau dua-duanya memakai bentuk mirip, kolom Karir.com
    // akan terbaca sebagai "belum ditemukan" - padahal artinya berbeda.
    return (
      <span className="text-gray-300" aria-hidden="true">
        <Minus size={14} strokeWidth={2} />
      </span>
    );
  }

  return (
    <span className={`${dasar} border border-dashed border-gray-400 text-gray-500`}>
      <Minus size={12} strokeWidth={3} aria-hidden="true" />
    </span>
  );
}

function Isi({ nilai, ours }: { nilai: Sel; ours?: boolean }) {
  if (nilai in SR) {
    const status = nilai as Status;
    return (
      <span className="flex justify-center">
        <Ikon status={status} />
        <span className="sr-only">{SR[status]}</span>
      </span>
    );
  }

  return (
    <span
      className={`block text-center text-[13px] leading-snug ${
        ours ? "font-semibold text-gray-900" : "text-gray-500"
      }`}
    >
      {nilai}
    </span>
  );
}

const LEGENDA: Status[] = ["ya", "sebagian", "tidak", "belum", "na"];

export function MarketingComparison() {
  const kolomOurs = "bg-blue-50/70";

  return (
    <section
      id="pbanding"
      className="scroll-mt-24 border-y border-gray-100 bg-[#F9FAFB] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <Reveal>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
              <Scale size={13} strokeWidth={1.75} aria-hidden="true" />
              Perbandingan
            </span>
            <h2 className="text-5xl font-medium -tracking-[1.9px] lg:text-6xl">
              Kenapa Careevo beda
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-4 text-base text-gray-500">
              Yang diadu di sini kemampuan yang memang ada, bukan
              kecepatan atau harga. Tiga platform yang paling sering
              dipertandingkan, dicek dari produk publik mereka.
            </p>
          </Reveal>
        </div>

        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-feature-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <caption className="sr-only">
                  Perbandingan kemampuan Careevo dengan Dicoding, Karir.com,
                  dan Skill Academy
                </caption>

                <thead>
                  <tr className="border-b border-gray-200">
                    <th
                      scope="col"
                      className="sticky left-0 z-20 w-[300px] bg-white px-5 py-4 align-bottom"
                    >
                      <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                        Kemampuan
                      </span>
                    </th>
                    {PLATFORM.map((p) => (
                      <th
                        key={p.key}
                        scope="col"
                        className={`w-[140px] px-4 py-4 align-bottom ${p.ours ? kolomOurs : ""}`}
                      >
                        <span
                          className={`block text-sm font-semibold ${
                            p.ours ? "text-blue-700" : "text-gray-900"
                          }`}
                        >
                          {p.label}
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-gray-500">
                          {p.sub}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>

                {KELOMPOK.map((kelompok) => (
                  <tbody key={kelompok.judul}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={PLATFORM.length + 1}
                        className="sticky left-0 border-y border-gray-100 bg-[#F9FAFB] px-5 py-2.5 text-left"
                      >
                        <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                          {kelompok.judul}
                        </span>
                      </th>
                    </tr>

                    {kelompok.baris.map((baris) => (
                      <tr
                        key={baris.label}
                        className="border-b border-gray-100 last:border-b-0"
                      >
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-white px-5 py-4 align-top font-normal"
                        >
                          <span className="block text-sm font-medium text-gray-900">
                            {baris.label}
                          </span>
                          {baris.note ? (
                            <span className="mt-0.5 block text-xs text-gray-500">
                              {baris.note}
                            </span>
                          ) : null}
                        </th>

                        {PLATFORM.map((p) => (
                          <td
                            key={p.key}
                            className={`px-4 py-4 align-top ${p.ours ? kolomOurs : ""}`}
                          >
                            <Isi nilai={baris[p.key]} ours={p.ours} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-200 px-5 py-4 text-xs text-gray-500">
              {LEGENDA.map((s) => (
                <span key={s} className="flex items-center gap-2">
                  <Ikon status={s} />
                  {SR[s]}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-gray-500">
            Disusun dari halaman publik tiap platform (harga program, fitur
            sertifikat, produk lowongan) yang diperiksa 27 September 2026.
            &quot;Belum ditemukan&quot; berarti tidak ada produk yang sesuai saat
            itu, bukan berarti tidak ada sama sekali. Menemukan yang keliru?
            Bilang ke kami, barisnya kami perbaiki.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
