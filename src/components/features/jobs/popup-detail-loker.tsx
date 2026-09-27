"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Loader2, Route, X } from "lucide-react";
import {
  buatJalurLokerInboxAction,
  detailLokerInboxAction,
  type DetailInboxState,
  type JalurInboxState,
} from "@/actions/loker-inbox-persiapan";
import { KartuDetailLoker } from "@/components/features/jobs/kartu-detail-loker";
import { ShieldCheck } from "lucide-react";
import type { VerdictLoker } from "@/components/features/jobs/cari-lowongan-ui";

/**
 * Popup detail lowongan hasil pindai, memakai kartu yang sama dengan hero
 * `/loker` (`KartuDetailLoker`).
 *
 * Dibuka dengan mengklik kartu di hasil pencarian atau di daftar lengkap.
 * Tutup dengan Escape, klik di luar, atau tombol tutup.
 *
 * **Deskripsi diambil saat popup dibuka, bukan saat halaman dirender.** Satu
 * baris butuh satu panggilan jaringan; 214 baris tidak boleh melakukan itu
 * semuanya hanya karena seseorang membuka inbox.
 *
 * Yang tidak ditampilkan: `fitScore`, `domainAge`, `pipeline`, `activities`.
 * Semuanya angka fixture `FEATURED_ROLES` yang tidak bisa dihitung untuk baris
 * pindai. Kartu: field-nya kosong — lihat komentar `KartuDetailLoker`.
 */
export function PopupDetailLoker({
  url,
  verdict,
  onTutup,
}: {
  url: string;
  /**
   * Verdict lengkap dari baris yang diklik, bukan hanya `status`.
   *
   * Dulu popup menerima `status` dan menampilkan `<StatusBadge>`, yaitu satu
   * kata: AMAN / KARANTINA / DITOLAK. Jadi popup tidak pernah bisa bilang
   * KENAPA sebuah lowongan ditahan — dan itu satu-satunya alasan orang membuka
   * detail. Alasan itu sudah ada di kartu (`verdict.title`) lalu dibuang di
   * `onBukaDetail`, jadi sekarang ikut dibawa.
   */
  verdict?: VerdictLoker | null;
  onTutup: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<DetailInboxState | null>(null);
  const [jalur, setJalur] = useState<JalurInboxState>({ status: "idle" });
  const [pending, mulai] = useTransition();
  const [pendingJalur, mulaiJalur] = useTransition();
  const router = useRouter();

  async function buatJalur() {
    mulaiJalur(async () => {
      const hasil = await buatJalurLokerInboxAction(url);
      setJalur(hasil);
      if (hasil.status === "success") router.refresh();
    });
  }

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  useEffect(() => {
    mulai(async () => setState(await detailLokerInboxAction(url)));
    // Hanya `url` yang memicu: baris lain berarti popup lain.
  }, [url]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Detail lowongan"
      onCancel={(e) => {
        e.preventDefault();
        onTutup();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onTutup();
      }}
      className="m-auto max-h-[min(88dvh,940px)] w-[min(1120px,calc(100vw-2rem))] max-w-none overflow-y-auto overflow-x-hidden rounded-2xl border border-neutral-300 bg-white p-0 shadow-[0_24px_64px_color-mix(in_srgb,var(--foreground)_28%,transparent)] backdrop:bg-[color-mix(in_srgb,var(--foreground)_45%,transparent)] backdrop:backdrop-blur-sm"
    >
      <div className="relative">
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup detail lowongan"
          className="absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900"
        >
          <X className="size-4" aria-hidden />
        </button>

        {pending ? (
          <p className="flex items-center justify-center gap-2 px-6 py-24 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Mengambil detail lowongan…
          </p>
        ) : !state ? null : !state.ok ? (
          <p className="px-6 py-24 text-center text-sm text-[var(--destructive)]">
            {state.pesan}
          </p>
        ) : (
          <>
            <KartuDetailLoker
              data={{
                role: state.role,
                company: state.company,
                location: state.location,
                salary: state.compensation,
                source: state.source,
                // `state.status` dihitung ulang di server saat popup dibuka, jadi
                // itulah yang menang untuk WARNA. Tapi `state.status` kembali
                // membawa `quarantined` untuk lowongan yang gagal di-enrichment
                // — dan label badge ikut bawaan, sehingga UI menampilkan
                // "KARANTINA" pada lowongan yang belum pernah dibaca siapa pun.
                // Karena itu label di-override dari `verdict`, satu-satunya pihak
                // yang tahu `terperiksa`.
                status: state.status ?? verdict?.status,
                statusLabel: verdict?.label,
                description: state.description,
                tags: state.tags,
                externalApplyUrl: state.url,
              }}
            />

            {/* Hasil audit Sentinel: bukan cuma kata "KARANTINA", tapi sinyal
                yang menjadi sebabnya. Tanpa blok ini popup menjawab pertanyaan
                yang tidak ditanyakan siapa pun — "aman" — dan diam tentang
                pertanyaan yang jelas ditanyakan: kenapa ini ditahan? */}
            {verdict ? (
              <section
                aria-label="Hasil audit Sentinel"
                className="border-b border-neutral-200 bg-white px-6 py-5 sm:px-7"
              >
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <ShieldCheck className="size-4" aria-hidden />
                  Hasil audit Sentinel
                </h3>

                {verdict.sinyal.length > 0 ? (
                  <ul className="mt-2.5 space-y-1.5">
                    {verdict.sinyal.map((s) => (
                      <li
                        key={s}
                        className="flex items-start gap-2 text-sm leading-relaxed text-neutral-700"
                      >
                        <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-neutral-400" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                    {verdict.title}
                  </p>
                )}

                {!verdict.terperiksa ? (
                  <p className="mt-2.5 text-[11px] leading-relaxed text-neutral-500">
                    Bukan lowongan yang mencurigakan. Lowongan ini belum sempat
                    dibaca dari papan aslinya, jadi belum ada yang dinilai aman
                    maupun mencurigakan.
                  </p>
                ) : null}
              </section>
            ) : null}

            {/* Persiapan: kursus, alasan dari model, dan jalur penguasaan.
                Sumber tunggal untuk rekomendasi di inbox; per-kartu hanya
                menampilkan lencana jumlahnya. */}
            <div className="border-t border-neutral-200 bg-neutral-50/60 px-6 py-5 sm:px-7">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Persiapan
              </h3>

              {state.ringkasan ? (
                <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                  {state.ringkasan}
                </p>
              ) : null}

              {state.kursus.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500">
                  Belum ada kursus di katalog yang cocok untuk lowongan ini. Katalog
                  belajar masih kecil, jadi ini belum tentu berarti lowongannya tidak
                  menuntut apa pun.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                  {state.kursus.map(({ entry, alasan }) => (
                    <li key={entry.id}>
                      <Link
                        href={`/belajar/${entry.slug}`}
                        className="group flex h-full items-start gap-2 rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-[#388AF3]/50"
                      >
                        <BookOpen
                          className="mt-0.5 size-4 shrink-0 text-[#0056D2]"
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-neutral-900 group-hover:text-[#0056D2]">
                            {entry.title}
                          </span>
                          {alasan ? (
                            <span className="mt-1 block text-[11px] leading-relaxed text-neutral-600">
                              {alasan}
                            </span>
                          ) : entry.tags.length > 0 ? (
                            <span className="mt-0.5 block text-[11px] text-neutral-500">
                              {entry.tags.join(" · ")}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-3 text-[11px] text-neutral-500">{state.catatan}</p>

              {/* Jalur penguasaan. Menjaga `rejected` dihitung ulang di server,
                  jadi tombol ini tidak muncul untuk lowongan yang ditolak dan
                  aksi-nya menolak apa pun yang dikirim klien. */}
              <div className="mt-4 border-t border-neutral-200 pt-4">
                {jalur.status === "error" ? (
                  <p className="text-sm text-[var(--destructive)]">{jalur.message}</p>
                ) : state.bisaJalur ? (
                  <button
                    type="button"
                    onClick={buatJalur}
                    disabled={pendingJalur}
                    className="chrome-btn chrome-btn-brand !h-9 !px-4 !text-xs gap-1.5 disabled:opacity-60"
                  >
                    {pendingJalur ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Route className="size-3.5" aria-hidden />
                    )}
                    <span>{pendingJalur ? "Menyusun jalur..." : "Susun jalur penguasaan"}</span>
                  </button>
                ) : (
                  <p className="text-[11px] text-neutral-500">
                    {state.alasanJalur ??
                      "Jalur penguasaan untuk lowongan ini sudah ada."}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
