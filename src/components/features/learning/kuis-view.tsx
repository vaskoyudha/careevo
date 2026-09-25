"use client";

import { useId, useState } from "react";
import { simpanNilaiKuisAction } from "@/actions/performa";
import { cn } from "@/lib/utils";
import type { Kuis } from "@/types/course";

/**
 * Renderer kuis untuk sisi learner.
 *
 * Dirender terpisah dari `materi-view.tsx` karena kuis bukan lampiran: ia
 * punya perilaku sendiri (memilih jawaban, menilai, ambang lulus), bukan
 * sekadar menampilkan berkas. Dipakai bersama oleh halaman belajar dan
 * pratinjau admin supaya yang dilihat admin saat menyusun sama persis dengan
 * yang dilihat peserta.
 *
 * Penilaian terjadi di peramban lalu **dikirim ke server sebagai catatan** —
 * bukan sebagai nilai terverifikasi. Kunci jawaban ikut terkirim ke perender,
 * jadi peramban yang menghitung juga bisa memalsukannya; server memvalidasi
 * bentuk angkanya saja. Skor seperti ini **wajib** dilabeli "dilaporkan klien"
 * di mana pun ia ditampilkan, dan kuis tetap alat latihan — bukan ujian yang
 * tahan curang.
 *
 * `catat` sengaja satu objek, bukan dua string terpisah: satu kuis bisa
 * terpasang di beberapa modul sekaligus, jadi catatan skor tidak boleh bisa
 * terkirim dengan moduleId tertinggal. Bentuk satu objek membuat "terlalu lupa
 * modulId" mustahil secara tipe.
 *
 * Absen = pratinjau admin. Admin yang memeriksa kunci jawaban bukan peserta yang
 * mengerjakan kuis, jadi tidak ada yang perlu dicatat.
 */
export function KuisView({
  kuis,
  catat,
  className,
}: {
  kuis: Kuis;
  catat?: { courseId: string; modulId: string };
  className?: string;
}) {
  const [jawaban, setJawaban] = useState<Record<string, number>>({});
  const [nilai, setNilai] = useState<number | null>(null);

  /**
   * Awalan nama radio yang unik per instans.
   *
   * Bukan `kuis.id`: satu kuis bisa dipasang di **beberapa modul** sekaligus —
   * itu justru alasan kuis dipisahkan ke bank soal. Radio hanya bisa satu
   * terpilih per nama, jadi memakai id kuis membuat dua salinan kuis yang sama
   * berbagi grup: menjawab di modul A membatalkan jawaban di modul B, dan
   * jumlah "terjawab" salah di keduanya. `useId` memberi awalan berbeda per
   * instans tanpa membuat markup server dan klien tidak cocok.
   */
  const awalan = useId();
  const soal = kuis.soal;
  const terjawab = soal.filter((s) => jawaban[s.id] !== undefined).length;

  const nilaiSekarang = () => {
    if (soal.length === 0) return 0;
    const benar = soal.filter((s) => jawaban[s.id] === s.jawaban_benar).length;
    return Math.round((benar / soal.length) * 100);
  };

  const ulangi = () => {
    setJawaban({});
    setNilai(null);
  };

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#0056D2] uppercase">
              Kuis
            </span>
            {kuis.judul}
          </p>
          {kuis.deskripsi ? (
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{kuis.deskripsi}</p>
          ) : null}
        </div>
        <p className="shrink-0 text-xs text-gray-500">
          {soal.length} soal · lulus {kuis.nilai_lulus}
        </p>
      </div>

      <ol className="mt-4 space-y-4">
        {soal.map((s, index) => (
          <li key={s.id}>
            <p className="text-sm font-semibold text-gray-900">
              {index + 1}. {s.pertanyaan}
            </p>
            <div className="mt-2 space-y-1.5">
              {s.pilihan.map((pilihan, i) => {
                const dipilih = jawaban[s.id] === i;
                // Setelah dinilai, tandai mana yang benar — umpan balik yang
                // membuat kuis berguna, bukan sekadar angka di akhir.
                const benar = nilai !== null && i === s.jawaban_benar;
                const salah = nilai !== null && dipilih && i !== s.jawaban_benar;
                return (
                  <label
                    key={`${s.id}-${i}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      benar
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : salah
                          ? "border-red-300 bg-red-50 text-red-800"
                          : "border-gray-200 hover:bg-gray-50",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${awalan}-${s.id}`}
                      checked={dipilih}
                      onChange={() => setJawaban((prev) => ({ ...prev, [s.id]: i }))}
                      className="accent-[#0056D2]"
                    />
                    <span className="text-gray-700">{pilihan}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const hasil = nilaiSekarang();
            setNilai(hasil);
            // Fire-and-forget: kegagalan penyimpanan tidak boleh memblokir
            // latihan. Peserta tetap melihat nilainya; yang hilang hanya catatan
            // untuk staf.
            if (!catat) return;
            void simpanNilaiKuisAction({
              courseId: catat.courseId,
              modulId: catat.modulId,
              kuisId: kuis.id,
              nilai: hasil,
              totalSoal: soal.length,
            }).catch(() => undefined);
          }}
          disabled={terjawab < soal.length}
          className="cursor-pointer rounded-full bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00419e] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Periksa jawaban
        </button>
        {nilai !== null ? (
          <button
            type="button"
            onClick={ulangi}
            className="cursor-pointer rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Ulangi
          </button>
        ) : null}
        <span className="text-xs text-gray-500">
          {terjawab} dari {soal.length} soal terjawab
        </span>
      </div>

      {nilai !== null ? (
        <p
          role="status"
          className={cn(
            "mt-3 rounded-lg px-3 py-2 text-sm font-medium",
            nilai >= kuis.nilai_lulus
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-800",
          )}
        >
          Nilaimu {nilai}.{" "}
          {nilai >= kuis.nilai_lulus ? "Lulus!" : `Belum lulus — minimal ${kuis.nilai_lulus}.`}
        </p>
      ) : null}
    </div>
  );
}
