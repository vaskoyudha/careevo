"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import { daftarKursusAction } from "@/actions/enrollment";
import { PESAN_POLICY } from "@/lib/courses/kebijakan";
import { useCourseSession } from "./course-session";

/**
 * Gerbang "mulai belajar" — satu dialog yang menjalankan **prasyarat masuk reader**
 * secara berurutan, bukan sekaligus.
 *
 * ## Kenapa dialog, bukan pita di halaman
 *
 * Dulu tiap permukaan menempelkan kartu amber-nya sendiri: pita di silabus, dan
 * satu lagi di kolom baca reader. Dua-duanya meminta hal yang sama di dua tempat,
 * dan yang di reader muncul **setelah** peserta sudah masuk — sudah terlambat
 * untuk jadi gerbang, dan cukup awal untuk mengganggu bacaan.
 *
 * Sekarang prasyaratnya dijaga di titik keputusan yang sebenarnya: tombol
 * "Buka materi". Sebelum peserta melangkah masuk, satu dialog menyebutkan apa
 * yang belum beres dan menyelesaikannya di tempat.
 *
 * ## Kenapa langkahnya berurutan
 *
 * Dua prasyarat ini punya urutan yang tidak bisa ditukar: sesi terverifikasi
 * menandatangani bukti **atas nama satu `learning_run` milik course**, dan run
 * itu hanya boleh dibuat untuk peserta yang sudah terdaftar. Menampilkan
 * "Mulai sesi" kepada orang yang belum mendaftar berarti menawarkan sesuatu yang
 * pasti ditolak server.
 *
 * Karena itu dialognya menampilkan **kedua langkah dengan urutannya**, lalu
 * menandai mana yang sedang dijalankan: peserta melihat sejak awal bahwa ada dua
 * hal yang akan diminta, bukan dikejutkan satu per satu. Setelah langkah pertama
 * berhasil, tombolnya berpindah sendiri ke langkah kedua — tidak ada langkah
 * yang dilewati dan tidak ada urutan yang bisa ditukar.
 *
 * ## Kenapa keputusannya dari konteks, bukan prop
 *
 * "Sudah punya sesi atau belum" dibaca dari `useCourseSession()`, sumber yang
 * sama dengan yang dipakai gerbang kuis dan lampiran di reader. Mengoper
 * keputusan sebagai prop berarti menyalinnya, dan salinan itu bisa basi tepat
 * setelah sesi dimulai di dialog yang sama.
 */
export function GerbangMulaiCourse({
  buka,
  onTutup,
  courseId,
  judulKursus,
  hrefTujuan,
  terdaftar,
  wajibSesi,
  gratis,
}: {
  buka: boolean;
  onTutup: () => void;
  courseId: string;
  judulKursus: string;
  /** Tujuan reader bila semua prasyarat terpenuhi. */
  hrefTujuan: string;
  terdaftar: boolean;
  /** Course ini menuntut sesi terverifikasi (kebijakan bukan `opsional`). */
  wajibSesi: boolean;
  /** Course gratis — satu-satunya yang bisa didaftari lewat dialog ini. */
  gratis: boolean;
}) {
  const router = useRouter();
  const { bukti, mulai, status, error: errorSesi } = useCourseSession();
  const [sudahDaftar, setSudahDaftar] = useState(terdaftar);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Langkah yang sedang ditampilkan.
   *
   * Diturunkan dari keadaan, bukan disimpan: begitu pendaftaran berhasil,
   * `sudahDaftar` berubah dan langkahnya berpindah sendiri ke sesi — tidak ada
   * `setLangkah` yang bisa tertinggal dari kenyataan.
   */
  const perluDaftar = !sudahDaftar;
  const perluSesi = wajibSesi && !bukti;

  /**
   * Buka dialog = kunci gulir bodi dan pindahkan fokus ke kontrol pertama.
   *
   * `hrefTujuan` sengaja **tidak** ada di daftar dependensi navigasi: effect ini
   * hanya mengurus fokus dan gulir, bukan perpindahan halaman.
   */
  useEffect(() => {
    if (!buka) return;
    const overflowSebelumnya = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onTutup();
        return;
      }
      if (event.key !== "Tab") return;
      const elemen = panelRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href]",
      );
      if (!elemen?.length) return;
      const pertama = elemen[0];
      const terakhir = elemen[elemen.length - 1];
      if (event.shiftKey && document.activeElement === pertama) {
        event.preventDefault();
        terakhir.focus();
      } else if (!event.shiftKey && document.activeElement === terakhir) {
        event.preventDefault();
        pertama.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflowSebelumnya;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [buka, onTutup]);

  // Ditutup → tidak dirender sama sekali. Tidak ada panel tersembunyi yang bisa
  // dijangkau Tab, dan tidak ada `document` yang disentuh saat render server.
  if (!buka) return null;

  const masuk = () => {
    onTutup();
    router.push(hrefTujuan);
  };

  const daftar = () =>
    startTransition(async () => {
      const hasil = await daftarKursusAction(courseId);
      if (hasil.ok) {
        setPesan(null);
        setSudahDaftar(true);
        // Pendaftaran beres dan course ini tidak menuntut sesi: tidak ada
        // langkah tersisa, jadi langsung masuk. Kalau menuntut sesi, dialognhya
        // berpindah sendiri ke langkah itu lewat `perluSesi`.
        if (!wajibSesi) masuk();
        return;
      }
      setPesan(hasil.error ?? "Pendaftaran gagal. Coba lagi.");
    });

  const mulaiSesi = () =>
    startTransition(async () => {
      const berhasil = await mulai();
      if (berhasil) masuk();
    });

  const sibuk = pending || status === "menyiapkan";
  const galat = pesan ?? errorSesi;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Scrim. Tombol, bukan `div` ber-`onClick`: penutup harus bisa dicapai
          keyboard dan diumumkan sebagai kontrol, bukan area mati. */}
      <button
        type="button"
        aria-label="Tutup dialog"
        onClick={onTutup}
        className="absolute inset-0 cursor-default bg-gray-900/45"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-gerbang-mulai"
        className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-[#0056D2]"
          >
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <h2
              id="judul-gerbang-mulai"
              className="text-base font-bold tracking-tight text-gray-900"
            >
              Sebelum mulai belajar
            </h2>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-gray-600">
              {judulKursus}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {perluDaftar ? (
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Langkah 1
              </p>
              <p className="mt-1 text-[13px] font-semibold text-gray-900">
                {gratis ? "Daftar kursus ini" : "Buka akses kursus ini"}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">
                {gratis
                  ? "Kursus ini gratis. Daftar dulu supaya progres dan hasil belajarmu tersimpan atas namamu."
                  : "Kursus premium ini termasuk dalam paket Careevo Plus. Buka aksesnya dulu sebelum masuk ke materi."}
              </p>
            </div>
          ) : null}

          {perluSesi ? (
            <div className={perluDaftar ? "border-t border-gray-100 pt-4" : undefined}>
              <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                {perluDaftar ? "Langkah 2" : "Langkah 1"}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-gray-900">
                Mulai sesi terverifikasi
              </p>
              {/* Pesan kebijakan dipakai apa adanya dari `PESAN_POLICY`, sumber
                  yang sama dengan penolakan server — parafrase di klien akan
                  berbeda ucapan dari penolakan yang benar-benar diterima. */}
              <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">
                {PESAN_POLICY.wajib}
              </p>
            </div>
          ) : null}
        </div>

        {galat ? (
          <p role="alert" className="mt-4 text-[12.5px] leading-relaxed text-red-700">
            {galat}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onTutup}
            className="cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100"
          >
            Nanti saja
          </button>

          {perluDaftar && gratis ? (
            <button
              type="button"
              onClick={daftar}
              disabled={sibuk}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0056D2] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#00419e] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {pending ? "Mendaftar…" : wajibSesi ? "Daftar, lalu lanjut" : "Daftar dan mulai"}
            </button>
          ) : perluDaftar ? (
            /* Course berbayar tidak bisa "didafari" dari sini: `daftarKursusAction`
               selalu menolaknya dengan `butuhPlus`, jadi tombol yang memanggilnya
               hanya akan menampilkan galat. Yang benar adalah mengantar ke
               halaman paket — satu-satunya tempat akses itu benar-benar dibuka. */
            <Link
              href="/careevo-plus#paket"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0056D2] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#00419e] active:scale-[0.97]"
            >
              Lihat paket Plus
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : perluSesi ? (
            <button
              type="button"
              onClick={mulaiSesi}
              disabled={sibuk}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0056D2] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#00419e] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "menyiapkan" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {status === "menyiapkan" ? "Menyiapkan sesi…" : "Mulai sesi terverifikasi"}
            </button>
          ) : (
            <button
              type="button"
              onClick={masuk}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0056D2] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#00419e] active:scale-[0.97]"
            >
              Mulai belajar
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
