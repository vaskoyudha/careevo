"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, BookOpenCheck, PlayCircle } from "lucide-react";
import { courseMetaFor, ThumbMedia } from "@/components/ui/catalog-course-card";
import type { ProgresKursus } from "@/lib/learning/progres-kursus";

/**
 * Halaman progres peserta: berapa persen setiap kursus yang sudah diambil.
 *
 * Strukturnya mengikuti model "kelas yang dipelajari": satu bar penyaring di
 * atas, lalu daftar kartu kursus dengan bar progres di bawahnya.
 *
 * **Penyaringnya batang geser, bukan kartu statistik.** Angka jumlah dan
 * keterangan di bawah label sudah dihapus, jadi yang tersisa hanya tiga label —
 * dan tiga petak selebar layar untuk tiga label itu hanya jadi ruang kosong yang
 * tidak bekerja. Satu batang justru lebih tepat: labelnya pas di lebarnya, dan
 * gerak pilnya langsung memberi tahu penyaring mana yang aktif, tanpa perlu
 * membaca teks.
 *
 * **Angkanya tidak pernah karangan.** Persentase, modul selesai, dan total modul
 * berasal dari `listProgresKursus`, yang membacanya dari `module_progress` di
 * database. Tidak ada persentase yang dihitung di peramban.
 *
 * **Penyaring, bukan tab.** Yang berubah bukan panel tapi isi dari satu daftar
 * yang sama, jadi statusnya dinyatakan dengan `aria-pressed` — bukan
 * `aria-selected` — dan tetap bisa dijangkau serta diaktifkan dengan keyboard satu
 * per satu, tanpa daftar panah seperti pada tab. Pil yang meluncur murni
 * dekorasi (`aria-hidden`): statusnya sudah dibawa oleh `aria-pressed`, jadi
 * mengumumkannya dua kali hanya menambah kebisingan pembaca layar.
 */

type Saring = "semua" | "berjalan" | "tuntas";

interface PilihanSaring {
  id: Saring;
  label: string;
}

/**
 * Tiga filter. "Sedang dipelajari" sengaja memasukkan kursus yang belum mulai
 * (0%): peserta membutuhkannya untuk terlihat agar bisa dimulai, dan tidak ada
 * tempat lain yang menunjukkannya. Yang 100% masuk "Selesai".
 */
const PILIHAN: readonly PilihanSaring[] = [
  { id: "semua", label: "Kursus diambil" },
  { id: "berjalan", label: "Sedang dipelajari" },
  { id: "tuntas", label: "Selesai" },
];

function ambil(list: ProgresKursus[], saring: Saring): ProgresKursus[] {
  if (saring === "berjalan") return list.filter((item) => item.progres < 100);
  if (saring === "tuntas") return list.filter((item) => item.progres >= 100);
  return list;
}

/** Indeks pilihan yang sedang aktif — posisi pil di batang. */
function indeksSaring(saring: Saring): number {
  return Math.max(
    0,
    PILIHAN.findIndex((pilihan) => pilihan.id === saring),
  );
}

/**
 * Batang geser tiga posisi.
 *
 * **Pannya dihitung, bukan diukur.** Kolom grid `grid-cols-3` selalu sama
 * lebar dan tidak ada `gap`, jadi satu kolom persis sepertiga dari lebar dalam
 * — `calc((100% - 0.5rem) / 3)` untuk memperhitungkan `p-1` pada track. Karena itu
 * `translateX(100%)` per langkah sudah tepat dan tidak perlu `ResizeObserver`
 * seperti `ScrollSubNav` yang lebar kolomnya benar-benar berubah. Konsekuensinya:
 * pil ikut meninggi kalau sebuah label membungkus ke dua baris, karena
 * tingginya diturunkan dari track, bukan dari tombol yang sedang aktif.
 *
 * **Gradiennya milik repo, bukan tulisan ulang.** `brand-fill` diisi
 * `--brand-grad` — ramp yang sama dengan tombol `Daftar` di navbar dan varian
 * `brand` pada `Button`. Dipakai di sini, bukan `Button` itu sendiri, karena
 * `Button` memberi latar per tombol (itu justru yang membuatnya tidak bisa
 * meluncur) dan `rounded-md` dari basisnya akan berebut dengan `rounded-full`.
 * Menulis `linear-gradient(...)` sendiri di sini berarti cepat atau lambat
 * menyalin dan melenceng dari satu token.
 */
function SaringBar({
  saring,
  onPilih,
}: {
  saring: Saring;
  onPilih: (saring: Saring) => void;
}) {
  const indeks = indeksSaring(saring);

  return (
    <div
      role="group"
      aria-label="Saring progres kursus"
      className="relative rounded-full border border-gray-200 bg-white p-1 shadow-xs"
    >
      {/* Pil aktif. `brand-fill` membawa `--brand-grad` + `--brand-shadow` dan
          warna teks putih; `rounded-full` menyamakan bentuknya dengan
          `size="pill"`. `inset-y-1` menghormati `p-1` track. */}
      <span
        aria-hidden="true"
        className="brand-fill pointer-events-none absolute inset-y-1 left-1 z-0 rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{
          // Sepertiga dari bagian dalam track (track dikurangi 2 × 0.25rem `p-1`).
          width: "calc((100% - 0.5rem) / 3)",
          transform: `translateX(${indeks * 100}%)`,
        }}
      />
      <div className="relative z-10 grid grid-cols-3">
        {PILIHAN.map((pilihan) => {
          const aktif = pilihan.id === saring;
          return (
            <button
              key={pilihan.id}
              type="button"
              aria-pressed={aktif}
              onClick={() => onPilih(pilihan.id)}
              className={
                aktif
                  ? // Latarnya datang dari pil yang meluncur, jadi tombol aktif
                    // sendiri cukup transparan. `z-10` pada induk membuat cincin
                    // fokus tetap terlihat di atas pil.
                    "min-w-0 rounded-full px-2 py-2.5 text-[11px] leading-tight font-bold tracking-wider text-white uppercase transition-colors sm:px-4 sm:text-xs"
                  : "min-w-0 rounded-full px-2 py-2.5 text-[11px] leading-tight font-semibold tracking-wider text-gray-500 uppercase transition-colors hover:text-[#0056D2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0056D2] sm:px-4 sm:text-xs"
              }
            >
              {pilihan.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Satu kursus: sampul, judul, dan bar progres. */
function KartuProgres({ item }: { item: ProgresKursus }) {
  const { entri, progres, selesai, total } = item;
  const href = `/belajar/${entri.slug}`;
  const tuntas = progres >= 100;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs transition-shadow duration-200 hover:shadow-md">
      <Link
        href={href}
        aria-label={`Lihat ${entri.title}`}
        className="relative block aspect-[16/9] w-full overflow-hidden bg-gray-100 hover:no-underline"
      >
        <ThumbMedia
          src={courseMetaFor(entri).thumbnail}
          alt={entri.title}
          provider={entri.provider}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-gray-800 shadow-xs backdrop-blur-xs">
          {tuntas ? (
            <Award size={12} strokeWidth={2} aria-hidden="true" />
          ) : (
            <PlayCircle size={12} strokeWidth={2} aria-hidden="true" />
          )}
          {tuntas ? "Selesai" : "Berjalan"}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <span className="text-xs font-semibold text-gray-500 uppercase">
          {entri.provider}
        </span>
        <h3 className="mt-1 line-clamp-2 text-sm font-bold text-gray-900 group-hover:text-[#0056D2]">
          <Link href={href} className="hover:no-underline">
            {entri.title}
          </Link>
        </h3>

        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span className="font-semibold text-gray-900">{progres}% selesai</span>
            <span>
              {selesai}/{total} modul
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`Progres ${entri.title}`}
            aria-valuenow={progres}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"
          >
            <div
              className="h-full rounded-full bg-[#0056D2] transition-all duration-300"
              style={{ width: `${progres}%` }}
            />
          </div>
          {/* 100% berarti "semua modul selesai", BUKAN "sertifikat terbit":
              atestasi hanya ada setelah alur submission → review, dan kartu ini
              tidak tahu apakah itu sudah terjadi. Jadi kalimatnya dijaga jujur —
              "Ulas kursus" juga yang dipakai halaman Jalur Belajar lama untuk
              keadaan yang sama. Tautan tetap ke halaman kursus, bukan ke
              sertifikat yang belum tentu ada. */}
          <p className="mt-3 text-xs font-semibold text-[#0056D2]">
            {tuntas ? "Ulas kursus →" : "Lanjutkan modul berikutnya →"}
          </p>
        </div>
      </div>
    </article>
  );
}

export function ProgresView({ kursus }: { kursus: ProgresKursus[] }) {
  const [saring, setSaring] = useState<Saring>("semua");

  if (kursus.length === 0) {
    return (
      <section className="card" aria-labelledby="progres-kosong">
        <h2 id="progres-kosong" className="card-title">
          Belum ada kursus yang diambil
        </h2>
        <p className="card-sub">
          Begitu kamu mendaftar satu kursus, progres modul dan persentasenya tampil di
          sini.
        </p>
        <Link
          href="/belajar"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-[#0056D2] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#00419e]"
        >
          <BookOpenCheck size={16} strokeWidth={2} aria-hidden="true" className="mr-2" />
          Mulai belajar
        </Link>
      </section>
    );
  }

  const tampil = ambil(kursus, saring);

  return (
    <div className="grid gap-6">
      <SaringBar saring={saring} onPilih={setSaring} />

      {tampil.length === 0 ? (
        <p className="caption muted">
          {saring === "tuntas"
            ? "Belum ada kursus yang tuntas. Lanjutkan modulnya dari daftar di bawah supaya masuk ke sini."
            : "Semua kursus yang kamu ambil sudah tuntas."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tampil.map((item) => (
            <KartuProgres key={item.entri.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
