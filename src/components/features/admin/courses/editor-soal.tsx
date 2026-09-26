"use client";

import { Input } from "@/components/ui/input";
import type { SoalKuis } from "@/types/course";

/**
 * Editor daftar soal kuis: pertanyaan, pilihan, dan kunci jawaban.
 *
 * Dipakai panel bank soal. Bentuknya terkendali penuh dari state klien dan
 * dikirim sebagai satu field JSON — soal bersarang (soal → pilihan → indeks
 * kunci), dan memetakannya ke field datar jauh lebih rapuh.
 */

export function EditorSoal({
  soal,
  onChange,
}: {
  soal: SoalKuis[];
  onChange: (berikut: SoalKuis[]) => void;
}) {
  const perbarui = (index: number, perubahan: Partial<SoalKuis>) => {
    onChange(soal.map((s, i) => (i === index ? { ...s, ...perubahan } : s)));
  };

  const tambahSoal = () => {
    onChange([
      ...soal,
      {
        // Id soal dipakai React sebagai key dan ikut tersimpan. Diturunkan dari
        // waktu + indeks supaya dua soal yang ditambahkan beruntun tidak
        // bertabrakan.
        id: `s${Date.now().toString(36)}${soal.length}`,
        pertanyaan: "",
        pilihan: ["", ""],
        jawaban_benar: 0,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Soal kuis</p>
        <button
          type="button"
          onClick={tambahSoal}
          className="cursor-pointer rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          Tambah soal
        </button>
      </div>

      {soal.length === 0 ? <p className="field-hint">Minimal satu soal dengan dua pilihan.</p> : null}

      {soal.map((s, index) => (
        <div key={s.id} className="space-y-2 rounded-lg border border-gray-200 p-3">
          <div className="flex gap-2">
            <Input
              value={s.pertanyaan}
              onChange={(event) => perbarui(index, { pertanyaan: event.target.value })}
              placeholder={`Pertanyaan ${index + 1}`}
              aria-label={`Pertanyaan ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => onChange(soal.filter((_, i) => i !== index))}
              className="shrink-0 cursor-pointer rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Hapus
            </button>
          </div>

          {s.pilihan.map((pilihan, i) => (
            <div key={`${s.id}-${i}`} className="flex items-center gap-2">
              <input
                type="radio"
                name={`benar-${s.id}`}
                checked={s.jawaban_benar === i}
                onChange={() => perbarui(index, { jawaban_benar: i })}
                aria-label={`Tandai pilihan ${i + 1} sebagai jawaban benar`}
              />
              <Input
                value={pilihan}
                onChange={(event) =>
                  perbarui(index, {
                    pilihan: s.pilihan.map((p, j) => (j === i ? event.target.value : p)),
                  })
                }
                placeholder={`Pilihan ${i + 1}`}
                aria-label={`Pilihan ${i + 1} untuk soal ${index + 1}`}
              />
              {s.pilihan.length > 2 ? (
                <button
                  type="button"
                  onClick={() =>
                    perbarui(index, {
                      pilihan: s.pilihan.filter((_, j) => j !== i),
                      // Kunci harus tetap menunjuk pilihan yang sama: membuang
                      // pilihan di kiri kunci menggeser indeksnya satu ke kiri.
                      jawaban_benar:
                        s.jawaban_benar >= i
                          ? Math.max(0, s.jawaban_benar - 1)
                          : s.jawaban_benar,
                    })
                  }
                  className="shrink-0 cursor-pointer text-xs font-semibold text-gray-500 hover:text-red-600"
                >
                  Hapus
                </button>
              ) : null}
            </div>
          ))}

          <button
            type="button"
            onClick={() => perbarui(index, { pilihan: [...s.pilihan, ""] })}
            className="cursor-pointer text-xs font-semibold text-[#0056D2]"
          >
            Tambah pilihan
          </button>
        </div>
      ))}
    </div>
  );
}
