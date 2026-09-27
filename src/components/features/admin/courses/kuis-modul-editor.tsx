"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  geserKuisAction,
  lepasKuisAction,
  pasangKuisAction,
  type KuisActionState,
} from "@/actions/kuis";
import { kuisUntukModul, ringkasKuis } from "@/lib/courses/kuis";
import { KuisView } from "@/components/features/learning/kuis-view";
import type { Kuis, Modul } from "@/types/course";

/**
 * Panel kuis sebuah modul: memasang entri dari bank soal dan melepasnya.
 *
 * Menyimpan **id**, bukan salinan soal. Konsekuensi yang penting untuk admin:
 * menyunting soal di bank langsung berlaku di semua modul yang memakainya, dan
 * panel ini tidak perlu ikut diperbarui.
 *
 * Aksi di sini bukan form — id entitasnya diikat lewat pemanggilan langsung,
 * sama seperti tombol naik/turun modul. Setelah tiap mutasi Server Action
 * memanggil `revalidatePath`, jadi daftarnya datang dari RSC payload segar dan
 * tidak ada salinan di state klien.
 */
export function KuisModulEditor({
  courseId,
  modul,
  bank,
}: {
  courseId: string;
  modul: Modul;
  bank: Kuis[];
}) {
  const [pilihTerbuka, setPilihTerbuka] = useState(false);
  const [pratinjauId, setPratinjauId] = useState<string | null>(null);

  const terpasangDiModul = kuisUntukModul(modul, bank);
  const idTerpasang = new Set(terpasangDiModul.map((k) => k.id));
  const belumTerpasang = bank.filter((k) => !idTerpasang.has(k.id));

  return (
    <div className="space-y-3">
      {terpasangDiModul.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
          Modul ini belum punya kuis. Kuis disusun sekali di bank soal, lalu dipasang ke modul mana
          pun — jadi satu kuis bisa dipakai beberapa modul sekaligus.
        </p>
      ) : (
        <ol className="space-y-2">
          {terpasangDiModul.map((k, index) => (
            <li key={k.id} className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-start gap-3 p-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-bold text-gray-500"
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-gray-900">{k.judul}</h4>
                  <p className="mt-0.5 text-xs text-gray-500">{ringkasKuis(k)}</p>
                  <button
                    type="button"
                    onClick={() => setPratinjauId(pratinjauId === k.id ? null : k.id)}
                    aria-expanded={pratinjauId === k.id}
                    className="mt-1 cursor-pointer text-xs font-medium text-[#0056D2]"
                  >
                    {pratinjauId === k.id ? "Sembunyikan pratinjau" : "Pratinjau"}
                  </button>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <UrutkanKuis
                    courseId={courseId}
                    modulId={modul.id}
                    kuisId={k.id}
                    arah="naik"
                    nonaktif={index === 0}
                  />
                  <UrutkanKuis
                    courseId={courseId}
                    modulId={modul.id}
                    kuisId={k.id}
                    arah="turun"
                    nonaktif={index === terpasangDiModul.length - 1}
                  />
                  <LepasKuis courseId={courseId} modulId={modul.id} kuis={k} />
                </div>
              </div>

              {pratinjauId === k.id ? (
                <div className="border-t border-gray-100 p-3">
                  <KuisView kuis={k} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {pilihTerbuka ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-3">
          {belumTerpasang.length === 0 ? (
            <p className="text-sm text-gray-500">
              {bank.length === 0
                ? "Bank soal masih kosong. Susun kuis dulu di halaman Kelola Kuis."
                : "Semua kuis di bank sudah dipasang di modul ini."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {belumTerpasang.map((k) => (
                <li key={k.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{k.judul}</p>
                    <p className="text-xs text-gray-500">{ringkasKuis(k)}</p>
                  </div>
                  <PasangKuis courseId={courseId} modulId={modul.id} kuis={k} />
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setPilihTerbuka(false)}
            className="mt-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPilihTerbuka(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Pasang kuis dari bank soal
        </button>
      )}
    </div>
  );
}

/**
 * Tombol aksi terikat dengan status sibuk dan galat lokal.
 *
 * Dibuat sekali di sini karena tiga tombol di atas (naik, turun, lepas, pasang)
 * punya bentuk yang sama persis: panggil aksi, tampilkan galatnya sebagai
 * `title` bila gagal, nonaktifkan selama berjalan.
 */
function TombolAksi({
  label,
  keterangan,
  aksi,
  className,
  nonaktif = false,
  children,
}: {
  label: string;
  keterangan: string;
  aksi: () => Promise<KuisActionState>;
  className?: string;
  nonaktif?: boolean;
  children: React.ReactNode;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={nonaktif || sibuk}
      title={galat ?? keterangan}
      aria-label={label}
      onClick={() => {
        setGalat(null);
        setSibuk(true);
        void aksi()
          .then((hasil) => {
            if (!hasil.ok) setGalat(hasil.error ?? "Aksi gagal.");
          })
          .finally(() => setSibuk(false));
      }}
      className={cn(
        "cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

function UrutkanKuis({
  courseId,
  modulId,
  kuisId,
  arah,
  nonaktif,
}: {
  courseId: string;
  modulId: string;
  kuisId: string;
  arah: "naik" | "turun";
  nonaktif: boolean;
}) {
  const naik = arah === "naik";
  return (
    <TombolAksi
      label={naik ? "Pindahkan kuis ke atas" : "Pindahkan kuis ke bawah"}
      keterangan={naik ? "Pindah ke atas" : "Pindah ke bawah"}
      nonaktif={nonaktif}
      aksi={() => geserKuisAction(courseId, modulId, kuisId, arah)}
      className="border-gray-300 px-2 text-gray-600 hover:bg-gray-50"
    >
      {naik ? (
        <ChevronUp className="size-3.5" aria-hidden="true" />
      ) : (
        <ChevronDown className="size-3.5" aria-hidden="true" />
      )}
    </TombolAksi>
  );
}

function PasangKuis({
  courseId,
  modulId,
  kuis,
}: {
  courseId: string;
  modulId: string;
  kuis: Kuis;
}) {
  return (
    <TombolAksi
      label={`Pasang kuis ${kuis.judul} ke modul`}
      keterangan="Pasang ke modul"
      aksi={() => pasangKuisAction(courseId, modulId, kuis.id)}
      className="shrink-0 border-gray-300 text-gray-700 hover:bg-gray-50"
    >
      Pasang
    </TombolAksi>
  );
}

/**
 * Lepas kuis dari modul.
 *
 * Ditegaskan lewat konfirmasi karena mudah disalahartikan sebagai menghapus:
 * yang terjadi hanya melepas referensinya, entri di bank tetap ada dan masih
 * dipakai modul lain. Pesannya menyebutkan itu supaya admin tidak mengira
 * soalnya ikut hilang.
 */
function LepasKuis({
  courseId,
  modulId,
  kuis,
}: {
  courseId: string;
  modulId: string;
  kuis: Kuis;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={sibuk}
      title={galat ?? "Lepas dari modul"}
      onClick={() => {
        const pesan = `Lepas kuis "${kuis.judul}" dari modul ini?\n\nEntri di bank soal TIDAK dihapus dan tetap bisa dipasang di modul lain.`;
        if (!window.confirm(pesan)) return;

        setGalat(null);
        setSibuk(true);
        void lepasKuisAction(courseId, modulId, kuis.id)
          .then((hasil) => {
            if (!hasil.ok) setGalat(hasil.error ?? "Gagal melepas kuis.");
          })
          .finally(() => setSibuk(false));
      }}
      className="cursor-pointer rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      <Trash2 className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Lepas kuis {kuis.judul} dari modul</span>
    </button>
  );
}
