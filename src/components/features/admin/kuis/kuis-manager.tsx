"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createKuisAction,
  deleteKuisAction,
  updateKuisAction,
  type KuisActionState,
} from "@/actions/kuis";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditorSoal } from "@/components/features/admin/courses/editor-soal";
import { KuisView } from "@/components/features/learning/kuis-view";
import { ringkasKuis } from "@/lib/courses/kuis";
import type { Kuis, SoalKuis } from "@/types/course";

/**
 * Bank soal kuis: daftar, tambah, ubah, dan hapus.
 *
 * Berbeda dari editor halaman/materi yang bersarang di dalam modul, bank soal
 * berdiri sendiri — satu kuis bisa dipasang ke banyak modul. Karena itu ada
 * pratinjau per baris: admin perlu melihat soal yang sedang dipakai lintas
 * modul itu apa adanya sebelum menyuntingnya.
 *
 * Setelah setiap mutasi Server Action memanggil `revalidatePath` dan Next
 * mengirim ulang RSC payload segar, jadi daftar tidak disalin ke state klien —
 * satu-satunya state di sini adalah panel mana yang terbuka dan kata kunci
 * pencarian.
 */

const KOSONG: KuisActionState = { ok: false };

export function KuisManager({ daftar }: { daftar: Kuis[] }) {
  const [cari, setCari] = useState("");
  const [suntingId, setSuntingId] = useState<string | null>(null);
  const [pratinjauId, setPratinjauId] = useState<string | null>(null);
  const [tambahTerbuka, setTambahTerbuka] = useState(false);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return daftar;
    return daftar.filter((k) => k.judul.toLowerCase().includes(q));
  }, [daftar, cari]);

  const jumlahSoal = daftar.reduce((total, k) => total + k.soal.length, 0);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Daftar Kuis ({tersaring.length})</h2>
          <p className="card-sub">
            {daftar.length} kuis · {jumlahSoal} soal tersimpan di bank.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-gray-400"
            aria-hidden="true"
          />
          <Input
            value={cari}
            onChange={(event) => setCari(event.target.value)}
            placeholder="Cari judul kuis…"
            aria-label="Cari judul kuis"
            className="pl-9"
          />
        </div>
        {cari ? (
          <button
            type="button"
            onClick={() => setCari("")}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset
          </button>
        ) : null}
      </div>

      {daftar.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
          Bank soal masih kosong. Susun kuis pertama, lalu pasang ke modul lewat halaman
          kurikulum kursus.
        </p>
      ) : tersaring.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
          Tidak ada kuis yang judulnya cocok dengan pencarian.
        </p>
      ) : (
        <ol className="space-y-2">
          {tersaring.map((k) => (
            <li key={k.id} className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">{k.judul}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">{ringkasKuis(k)}</p>
                  {k.deskripsi ? (
                    <p className="mt-1 text-sm text-gray-600">{k.deskripsi}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setPratinjauId(pratinjauId === k.id ? null : k.id)}
                    aria-expanded={pratinjauId === k.id}
                    className="mt-1 cursor-pointer text-xs font-medium text-[#0056D2] hover:underline"
                  >
                    {pratinjauId === k.id ? "Sembunyikan pratinjau" : "Pratinjau soal"}
                  </button>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSuntingId(suntingId === k.id ? null : k.id);
                      setTambahTerbuka(false);
                    }}
                    aria-expanded={suntingId === k.id}
                    className="cursor-pointer rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    {suntingId === k.id ? "Tutup" : "Ubah"}
                  </button>
                  <HapusKuis kuis={k} />
                </div>
              </div>

              {pratinjauId === k.id ? (
                <div className="border-t border-gray-100 p-3">
                  <KuisView kuis={k} />
                </div>
              ) : null}

              {suntingId === k.id ? (
                <div className="border-t border-gray-100 p-3">
                  <FormKuis awal={k} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {tambahTerbuka ? (
        <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-3">
          <FormKuis onSelesai={() => setTambahTerbuka(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setTambahTerbuka(true);
            setSuntingId(null);
          }}
          className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Tambah kuis
        </button>
      )}
    </div>
  );
}

/**
 * Hapus kuis dari bank.
 *
 * Konfirmasinya menyebut bahwa kuis dilepas dari modul yang memakainya: store
 * memang membersihkan referensi itu dalam operasi yang sama, jadi admin perlu
 * tahu dampaknya menyentuh kurikulum, bukan cuma entri di halaman ini.
 */
function HapusKuis({ kuis }: { kuis: Kuis }) {
  const [state, formAction, pending] = useActionState<KuisActionState, FormData>(
    deleteKuisAction,
    KOSONG,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const pesan = `Hapus kuis "${kuis.judul}" dari bank soal?\n\nKuis ini akan dilepas dari semua modul yang memakainya. Tindakan ini tidak bisa dibatalkan.`;
        if (!window.confirm(pesan)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={kuis.id} />
      <button
        type="submit"
        disabled={pending}
        title={state.error ?? "Hapus kuis"}
        className="cursor-pointer rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Hapus kuis {kuis.judul}</span>
      </button>
    </form>
  );
}

/**
 * Form satu kuis: judul, deskripsi, daftar soal, dan nilai lulus.
 *
 * Soal dikirim sebagai satu field JSON — bentuknya bersarang (soal → pilihan →
 * indeks kunci), dan memetakannya ke field datar jauh lebih rapuh. Pola yang
 * sama dipakai editor blok halaman.
 */
function FormKuis({ awal, onSelesai }: { awal?: Kuis; onSelesai?: () => void }) {
  const ubah = Boolean(awal);
  const [soal, setSoal] = useState<SoalKuis[]>(awal?.soal ?? []);

  const [state, formAction, pending] = useActionState<KuisActionState, FormData>(
    ubah ? updateKuisAction : createKuisAction,
    KOSONG,
  );

  // Kunci membedakan form "baru" dari form tiap kuis: tanpa itu React memakai
  // ulang state `useActionState` saat admin berpindah baris, dan pesan hasil
  // kuis sebelumnya ikut terbawa.
  const kunci = awal?.id ?? "baru";

  return (
    <form action={formAction} className="space-y-3" key={kunci}>
      {awal ? <input type="hidden" name="id" value={awal.id} /> : null}
      <input type="hidden" name="soal" value={JSON.stringify(soal)} />

      <div className="space-y-1.5">
        <Label htmlFor={`${kunci}-judul-kuis`}>Judul kuis</Label>
        <Input
          id={`${kunci}-judul-kuis`}
          name="judul"
          defaultValue={awal?.judul ?? ""}
          placeholder="Dasar-Dasar Variabel dan Tipe Data"
          maxLength={120}
          required
        />
        {state.fieldErrors?.judul ? <p className="field-error">{state.fieldErrors.judul}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${kunci}-deskripsi-kuis`}>Deskripsi</Label>
        <Textarea
          id={`${kunci}-deskripsi-kuis`}
          name="deskripsi"
          defaultValue={awal?.deskripsi ?? ""}
          placeholder="Petunjuk singkat sebelum peserta mengerjakan kuis ini."
          maxLength={500}
          rows={2}
        />
        <p className="field-hint">
          Opsional, maksimal 500 karakter. Tampil di atas soal saat peserta membuka kuis.
        </p>
        {state.fieldErrors?.deskripsi ? (
          <p className="field-error">{state.fieldErrors.deskripsi}</p>
        ) : null}
      </div>

      <EditorSoal soal={soal} onChange={setSoal} />
      {state.fieldErrors?.soal ? <p className="field-error">{state.fieldErrors.soal}</p> : null}

      <div className="space-y-1.5 sm:max-w-[12rem]">
        <Label htmlFor={`${kunci}-nilai-lulus`}>Nilai lulus</Label>
        <Input
          id={`${kunci}-nilai-lulus`}
          name="nilai_lulus"
          type="number"
          min={0}
          max={100}
          defaultValue={awal?.nilai_lulus ?? 70}
          required
        />
        <p className="field-hint">Ambang 0–100. Peserta dinyatakan lulus bila nilainya mencapai angka ini.</p>
        {state.fieldErrors?.nilai_lulus ? (
          <p className="field-error">{state.fieldErrors.nilai_lulus}</p>
        ) : null}
      </div>

      {state.message ?? state.error ? (
        <p
          role="alert"
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
          )}
        >
          {state.message ?? state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : ubah ? "Simpan kuis" : "Tambah kuis"}
        </button>
        {onSelesai ? (
          <button
            type="button"
            onClick={onSelesai}
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Batal
          </button>
        ) : null}
      </div>
    </form>
  );
}
