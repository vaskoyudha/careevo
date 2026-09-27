import Link from "next/link";
import { Award, ArrowRight, MoreHorizontal, User } from "lucide-react";
import type { SertifikatRingkas } from "@/lib/review/service";

/**
 * Kartu profil singkat di dashboard.
 *
 * Isinya sengaja tipis: nama, username, dan jalur yang sedang dikejar. Ini
 * **bukan** tempat menaruh bio atau statistik — dashboard di bawah sudah punya
 * lima blok angka, dan menambah satu blok lagi di sini membuat halaman terasa
 * penuh tanpa menambah informasi yang dipakai peserta.
 *
 * Data berasal dari `SessionPrincipal` (dari database) dan `OnboardingProfile`
 * (juga dari database), bukan dari fixture.
 *
 * Target jam mingguan **tidak** diulang di sini: ia sudah tampil di chip band
 * sapaan, dan angka yang sama di dua tempat hanya menambah yang harus dibaca —
 * sekaligus dua tempat yang harus diperbarui bersamaan saat targetnya berubah.
 *
 * Inisial pada avatar **dihitung dari nama yang diberikan**, bukan diambil dari
 * gambar profil: belum ada unggahan avatar di alur onboarding, dan menampilkan
 * gambar bawaan akan membaca sebagai "foto kamu" padahal bukan.
 */
export function KartuProfil({
  nama,
  username,
  minat,
  targetJam,
}: {
  nama: string;
  username: string;
  /** Label minat; array kosong berarti onboarding belum diisi. */
  minat: string[];
  /** Target jam mingguan yang dideklarasikan peserta sendiri. */
  targetJam: number | null;
}) {
  const inisial = nama.trim().charAt(0).toUpperCase() || "?";

  return (
    <section aria-labelledby="judul-profil" className="dash-card min-w-0">
      <div className="dash-card-head">
        <span className="dash-icon" aria-hidden="true">
          <User className="size-4" />
        </span>
        <h2 id="judul-profil" className="dash-title">
          Profilmu
        </h2>
        {/* Dekoratif: belum ada menu di baliknya. Ditampilkan supaya ritme
            header tiga kartu pertama sama — bukan kontrol palsu yang bisa
            diklik, karena itu akan menjadi janji yang tidak ditepati. */}
        <span className="dash-head-action text-gray-400" aria-hidden="true">
          <MoreHorizontal className="size-4" />
        </span>
      </div>

      <div className="dash-gap-sm flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-[#007aff] text-[17px] font-bold text-white"
        >
          {inisial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] leading-tight font-bold text-gray-900">
            {nama}
          </p>
          <p className="truncate text-[12px] text-gray-500">@{username}</p>
        </div>
      </div>

      {minat.length > 0 ? (
        <ul
          className="dash-gap-sm flex flex-wrap gap-1.5"
          aria-label="Minat yang kamu pilih"
        >
          {minat.map((m) => (
            <li key={m} className="dash-chip">
              {m}
            </li>
          ))}
        </ul>
      ) : (
        <p className="dash-gap-sm text-[12.5px] leading-[1.5] text-gray-600">
          Belum ada minat yang dipilih. Isi sekali di onboarding supaya
          rekomendasi dan lowongan yang tampil benar-benar milikmu.
        </p>
      )}

      {targetJam !== null ? (
        <p className="dash-gap-sm text-[12.5px] leading-[1.5] text-gray-600">
          Target belajar {targetJam} jam per minggu. Ini target yang kamu
          tentukan sendiri — bukan syarat kelulusan.
        </p>
      ) : null}

      <Link
        href="/pengaturan"
        className="dash-gap-md inline-flex items-center gap-1 text-[13px] font-semibold text-[#007aff] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#0056d2]"
      >
        Ubah preferensi
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}

/**
 * Kartu daftar sertifikat di dashboard.
 *
 * Yang dirender hanya attestation **`active`**. Kredensial `revoked` bukan
 * sertifikat yang dimiliki peserta, dan tidak pernah muncul di sini — termasuk
 * di profil publik yang dibaca perekrut.
 *
 * Kartunya memakai varian **mint** (`dash-card-mint`), bukan putih: reference
 * menint seluruh permukaan blok ini hijau, dan itu yang membedakannya dari
 * kartu angka di sebelahnya tanpa perlu judul tambahan.
 *
 * Empty state-nya mengarahkan, bukan cuma menyatakan kosong: "belum ada
 * sertifikat" tanpa jalan keluarnya akan membuat blok ini terbaca sebagai
 * kegagalan. Ilustrasinya murni dekorasi (`aria-hidden`), bukan ikon status.
 */
export function KartuSertifikat({ daftar }: { daftar: SertifikatRingkas[] }) {
  return (
    <section
      aria-labelledby="judul-sertifikat-dash"
      className="dash-card dash-card-mint min-w-0"
    >
      <div className="dash-card-head">
        <span className="dash-icon" aria-hidden="true">
          <Award className="size-4" />
        </span>
        <h2 id="judul-sertifikat-dash" className="dash-title">
          Sertifikat
        </h2>
        {daftar.length > 0 ? (
          <span className="dash-head-action rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            {daftar.length}
          </span>
        ) : null}
      </div>

      {daftar.length === 0 ? (
        <div className="relative">
          <p className="dash-gap-sm max-w-[44ch] text-[12.5px] leading-[1.5] text-gray-600">
            Belum ada sertifikat terbit. Sertifikat terbit setelah course kamu
            selesai terverifikasi lalu karya kamu direview verifikator — bukan
            hanya dengan menyelesaikan modul.
          </p>
          <Link
            href="/progres"
            className="dash-gap-md inline-flex h-9 items-center gap-1.5 rounded-full border border-[#bfe0f5] bg-white/80 px-4 text-[13px] font-semibold text-[#007aff] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white active:scale-[0.97]"
          >
            Lihat progres
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        // `flex-1 min-h-0 overflow-y-auto` membuat daftar ini yang menyerap
        // tinggi sisa tile, dan bergulir sendiri kalau sertifikatnya banyak.
        // Tanpa itu, daftar panjang akan tumbuh ke bawah dan menabrak
        // ilustrasi yang dipatok di sudut kanan bawah.
        <ul
          className="dash-gap-sm min-h-0 flex-1 space-y-1.5 overflow-y-auto"
          aria-labelledby="judul-sertifikat-dash"
        >
          {daftar.map((s) => (
            <li key={s.token} className="flex items-baseline justify-between gap-3">
              <Link
                href={`/verify/${s.token}`}
                className="min-w-0 truncate text-[13px] font-semibold text-gray-900 hover:text-[#0056d2] hover:underline"
              >
                {s.judul}
              </Link>
              <span className="shrink-0 text-[11px] text-gray-500">
                {s.track} · {s.level}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Ilustrasi hanya muncul saat daftarnya masih pendek. Ia ada untuk mengisi
          sudut tile yang tinggi, bukan untuk menemani daftar panjang: kalau
          sertifikatnya banyak, ruang itu terpakai isi yang nyata dan gambar
          dekoratif hanya akan beradu dengan baris terakhir. */}
      {daftar.length <= 3 ? <SertifikatIlustrasi /> : null}
    </section>
  );
}

/**
 * Ilustrasi sertifikat.
 *
 * Digambar sebagai SVG sebaris, bukan diambil dari berkas gambar: ukurannya
 * menyesuaikan lebar kartu, warnanya memakai token merek, dan ia tidak menambah
 * satu permintaan jaringan.
 *
 * Diletakkan **absolut di kanan bawah** dan `aria-hidden`, jadi ia mengisi
 * sudut kartu tanpa pernah mendorong daftar sertifikat atau menjadi sesuatu
 * yang harus dibaca. `bottom-4`/`right-4` menyamakan insetnya dengan padding
 * kartu (16px) dan menahan seluruh gambar di dalam `overflow: hidden` — nilai
 * negatif sebelumnya memotong tepi bawah segelnya.
 */
function SertifikatIlustrasi() {
  return (
    <svg
      viewBox="0 0 200 130"
      className="pointer-events-none absolute right-3 bottom-3 hidden h-[128px] w-auto sm:block"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="sertif-sheet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dbeafe" />
        </linearGradient>
        <linearGradient id="sertif-side" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
        <linearGradient id="sertif-seal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      {/* Kartu belakang, digeser untuk memberi kedalaman. */}
      <rect
        x="26"
        y="26"
        width="128"
        height="82"
        rx="10"
        fill="url(#sertif-side)"
        opacity="0.55"
        transform="rotate(-6 90 67)"
      />
      {/* Kartu depan. */}
      <g transform="rotate(6 100 65)">
        <rect x="34" y="18" width="132" height="88" rx="10" fill="url(#sertif-sheet)" />
        <circle cx="58" cy="42" r="9" fill="#dbeafe" />
        <rect x="76" y="34" width="66" height="6" rx="3" fill="#cbd5e1" />
        <rect x="76" y="46" width="48" height="6" rx="3" fill="#dbeafe" />
        <rect x="48" y="66" width="94" height="5" rx="2.5" fill="#dbeafe" />
        <rect x="48" y="78" width="70" height="5" rx="2.5" fill="#e2e8f0" />
        {/* Segel bintang. */}
        <circle cx="134" cy="82" r="20" fill="url(#sertif-seal)" />
        <path
          d="M134 70.5l3.4 6.9 7.6 1.1-5.5 5.4 1.3 7.6-6.8-3.6-6.8 3.6 1.3-7.6-5.5-5.4 7.6-1.1z"
          fill="#ffffff"
        />
        <path d="M126 100l8 6 8-6v16l-8-5.2L126 116z" fill="#60a5fa" />
      </g>
    </svg>
  );
}
