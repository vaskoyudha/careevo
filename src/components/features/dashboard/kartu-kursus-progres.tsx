import Link from "next/link";
import { ArrowRight, ChevronRight, School } from "lucide-react";
import type { ProgresKursus } from "@/lib/learning/progres-kursus";

/**
 * Daftar ringkas progres tiap course yang diambil peserta.
 *
 * Satu baris per enrollment, dengan persen dan bar progres tipis. Angkanya
 * berasal dari `listProgresKursus` — sumber yang sama dengan `/progres` dan
 * `/belajar` — jadi ketiga halaman tidak bisa menampilkan persen yang berbeda
 * untuk enrollment yang sama.
 *
 * **Baris 0% tetap ditampilkan.** Course yang sudah diambil tetapi belum dibuka
 * justru yang paling butuh terlihat di dashboard; menyembunyikannya karena
 * "belum ada progres" membuat peserta kehilangan satu-satunya tempat yang
 * memberi tahu bahwa course itu masih menunggu.
 *
 * Daftarnya dijepit `maksBaris` supaya kartu tidak tumbuh tanpa batas di akun
 * dengan banyak enrollment; sisanya lewat tautan "Lihat semua" ke `/progres`
 * yang memang menampilkan seluruh daftar.
 *
 * Warna lencana tiap baris sengaja **satu warna merek**, bukan warna acak per
 * course: warna acak di sini tidak mengkodekan apa pun (tidak ada arti pada
 * hijau vs ungu), jadi ia hanya menambah derau ke daftar yang sedang dibaca
 * sebagai satu kelompok.
 */
export function KartuProgresKursus({
  daftar,
  maksBaris = 5,
}: {
  daftar: ProgresKursus[];
  maksBaris?: number;
}) {
  const tampil = daftar.slice(0, maksBaris);
  const total = daftar.length;
  const tuntas = daftar.filter((k) => k.progres >= 100).length;
  const lebih = total - tampil.length;

  return (
    <section aria-labelledby="judul-progres-dash" className="dash-card min-w-0">
      <div className="dash-card-head">
        <span className="dash-icon" aria-hidden="true">
          <School className="size-4" />
        </span>
        <h2 id="judul-progres-dash" className="dash-title">
          Progres Kursus
        </h2>
        {total > 0 ? (
          <Link
            href="/progres"
            className="dash-head-action inline-flex items-center gap-1 text-[13px] font-semibold text-[#007aff] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#0056d2]"
          >
            Lihat semua
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {total === 0 ? (
        <div>
          <p className="dash-gap-sm text-[12.5px] leading-[1.5] text-gray-600">
            Belum ada course yang kamu ambil. Mulai dari satu course, dan
            progresnya muncul di sini.
          </p>
          <Link
            href="/belajar"
            className="dash-gap-md inline-flex h-9 items-center gap-1.5 rounded-full bg-[#007aff] px-4 text-[13px] font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#0064d2] active:scale-[0.97]"
          >
            Jelajahi course
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          <p className="dash-gap-sm text-[12.5px] text-gray-600">
            Kamu telah menyelesaikan{" "}
            <b className="font-semibold text-gray-800">{tuntas}</b> dari {total}{" "}
            course
          </p>
          {/* `flex-1` supaya daftar ini yang mengambil sisa tinggi tile — ia
              adalah isi yang memang bisa memanjang, sedangkan baris lain tidak.
              `min-h-0` wajib: tanpa itu anak flex menolak mengecil dan
              `overflow-y-auto` tidak pernah aktif. */}
          <ul
            className="dash-gap-xs min-h-0 flex-1 overflow-y-auto"
            aria-labelledby="judul-progres-dash"
          >
            {tampil.map((k) => (
              <li key={k.entri.id} className="dash-row">
                <Link
                  href={`/belajar/${k.entri.slug}`}
                  className="group flex min-w-0 flex-1 items-center gap-3 hover:no-underline"
                >
                  <span className="dash-row-icon" aria-hidden="true">
                    <School className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] font-semibold text-gray-800 transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:text-[#007aff]">
                        {k.entri.title}
                      </span>
                      <span className="shrink-0 text-[12px] font-bold text-gray-500 tabular-nums">
                        {k.progres}%
                      </span>
                    </span>
                    <span
                      role="progressbar"
                      aria-label={`Progres ${k.entri.title} ${k.progres} persen`}
                      aria-valuenow={k.progres}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#e3edf9]"
                    >
                      <span
                        className="block h-full rounded-full bg-[#007aff]"
                        style={{ width: `${k.progres}%` }}
                      />
                    </span>
                  </span>
                </Link>
                <ChevronRight
                  className="size-4 shrink-0 text-gray-300"
                  aria-hidden="true"
                />
              </li>
            ))}
          </ul>
          {lebih > 0 ? (
            <Link
              href="/progres"
              className="dash-gap-sm inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#007aff] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#0056d2]"
            >
              +{lebih} course lainnya
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
}
