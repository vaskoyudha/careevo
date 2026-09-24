"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SectionInfo } from "@/lib/courses/blok";

/**
 * Pemilih tautan untuk editor blok.
 *
 * Dua sumber tujuan, sengaja dipisah tegas:
 *
 * - **Backlink** — daftar section yang benar-benar ada di halaman ini, diambil
 *   dari `daftarSection()` yang sama dengan yang dipakai renderer. Karena
 *   jangkar dan daftar ini berasal dari satu fungsi, tujuan yang ditawarkan di
 *   sini tidak mungkin berbeda dari `id` yang benar-benar dipasang renderer.
 *   Admin memilih, bukan mengetik — menghafal jangkar adalah sumber tautan mati.
 * - **Tautan luar** — URL http/https biasa.
 *
 * Karena cakupan backlink satu halaman (jangkar HTML memang lokal halaman),
 * daftar ini hanya memuat section halaman yang sedang disunting.
 */
export function PemilihTautan({
  bagian,
  onPilih,
  onBatal,
}: {
  bagian: SectionInfo[];
  onPilih: (tautan: string | null) => void;
  onBatal: () => void;
}) {
  const [luar, setLuar] = useState("");
  const [galat, setGalat] = useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-[#f5f7fa] p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Sisipkan tautan</p>
        <button
          type="button"
          onClick={onBatal}
          className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          Tutup
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
          Backlink ke bagian halaman ini
        </p>
        {bagian.length === 0 ? (
          <p className="text-xs text-gray-500">
            Belum ada judul section di halaman ini. Tambahkan blok “Judul section” lebih dulu —
            judul itulah yang menjadi tujuan backlink.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {bagian.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPilih(`#${s.id}`)}
                  className="cursor-pointer rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-[#0056D2] hover:bg-blue-50"
                >
                  {s.level === 1 ? "" : s.level === 2 ? "· " : "·· "}
                  {s.teks}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5 border-t border-gray-200 pt-2">
        <Label htmlFor="tautan-luar" className="text-[11px] tracking-wider text-gray-500 uppercase">
          Atau tautan luar
        </Label>
        <div className="flex gap-2">
          <Input
            id="tautan-luar"
            value={luar}
            onChange={(event) => {
              setLuar(event.target.value);
              setGalat(null);
            }}
            placeholder="https://example.com"
            className="h-8 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              // Sama seperti validasi server: `javascript:` dan bentuk lain
              // ditolak di sini juga, supaya kesalahan ketahuan sebelum simpan.
              if (!/^https?:\/\//i.test(luar.trim())) {
                setGalat("URL harus diawali http:// atau https://");
                return;
              }
              onPilih(luar.trim());
              setLuar("");
            }}
            className="shrink-0 cursor-pointer rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
          >
            Sisipkan
          </button>
        </div>
        {galat ? <p className="field-error">{galat}</p> : null}
      </div>
    </div>
  );
}
