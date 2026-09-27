import Link from "next/link";
import { Award, ArrowRight, User } from "lucide-react";
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
  return (
    <section
      aria-labelledby="judul-profil"
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
    >
      <h2
        id="judul-profil"
        className="flex items-center gap-1.5 text-base font-bold text-gray-900"
      >
        <User className="size-4 text-[#0056D2]" aria-hidden="true" />
        Profilmu
      </h2>

      <p className="mt-2 truncate text-lg font-bold text-gray-900">{nama}</p>
      <p className="truncate text-[13px] text-gray-500">@{username}</p>

      {minat.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-labelledby="judul-profil">
          {minat.map((m) => (
            <li
              key={m}
              className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#0056D2]"
            >
              {m}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-gray-600">
          Belum ada minat yang dipilih. Isi sekali di onboarding supaya
          rekomendasi dan lowongan yang tampil benar-benar milikmu.
        </p>
      )}

      {targetJam !== null ? (
        <p className="mt-3 text-[13px] text-gray-600">
          Target belajar {targetJam} jam per minggu. Ini target yang kamu
          tentukan sendiri — bukan syarat kelulusan.
        </p>
      ) : null}

      <Link
        href="/pengaturan"
        className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#0056D2] hover:underline"
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
 * Empty state-nya mengarahkan, bukan cuma menyatakan kosong: "belum ada
 * sertifikat" tanpa jalan keluarnya akan membuat blok ini terbaca sebagai
 * kegagalan.
 */
export function KartuSertifikat({ daftar }: { daftar: SertifikatRingkas[] }) {
  return (
    <section
      aria-labelledby="judul-sertifikat-dash"
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
    >
      <div className="mb-3 flex items-start justify-between gap-x-4 gap-y-1">
        <h2
          id="judul-sertifikat-dash"
          className="flex items-center gap-1.5 text-base font-bold text-gray-900"
        >
          <Award className="size-4 text-[#0056D2]" aria-hidden="true" />
          Sertifikat
        </h2>
        {daftar.length > 0 ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            {daftar.length}
          </span>
        ) : null}
      </div>

      {daftar.length === 0 ? (
        <div>
          <p className="text-[13px] text-gray-600">
            Belum ada sertifikat terbit. Sertifikat terbit setelah course kamu
            selesai terverifikasi lalu karya kamu direview verifikator — bukan
            hanya dengan menyelesaikan modul.
          </p>
          <Link
            href="/progres"
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#0056D2] hover:underline"
          >
            Lihat progres
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="space-y-2" aria-labelledby="judul-sertifikat-dash">
          {daftar.map((s) => (
            <li key={s.token} className="flex items-baseline justify-between gap-3">
              <Link
                href={`/verify/${s.token}`}
                className="min-w-0 truncate text-[13px] font-semibold text-gray-900 hover:text-[#0056D2] hover:underline"
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
    </section>
  );
}
