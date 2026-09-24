"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createMateriAction,
  deleteMateriAction,
  updateMateriAction,
  type MateriActionState,
} from "@/actions/materi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnggahBerkas } from "./unggah-berkas";
import { PratinjauMateri } from "./pratinjau-materi";
import type { Materi, SoalKuis, TipeMateri } from "@/types/course";

/**
 * Editor materi untuk satu modul.
 *
 * Setiap tipe punya field-nya sendiri, tapi semuanya diletakkan di dalam satu
 * `<form action={formAction}>` dengan `useActionState` — pola yang sama dengan
 * `edit-profile-dialog.tsx`. Form imperatif ala `course-manager.tsx` (merakit
 * `FormData` di `onClick`) sengaja tidak ditiru: akibatnya tombol Enter tidak
 * men-submit.
 *
 * Klien tidak menyimpan salinan daftar materi. Setelah mutasi, Server Action
 * memanggil `revalidatePath` dan Next mengirim ulang RSC payload segar, jadi
 * menyimpan state lokal justru berisiko menyimpang dari yang tersimpan.
 */

const TIPE: Array<{ nilai: TipeMateri; label: string }> = [
  { nilai: "video", label: "Video" },
  { nilai: "pdf", label: "PDF" },
  { nilai: "kuis", label: "Kuis" },
];

const KOSONG: MateriActionState = { ok: false };

export function MateriEditor({
  courseId,
  modulId,
  materi,
}: {
  courseId: string;
  modulId: string;
  materi: Materi[];
}) {
  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [suntingId, setSuntingId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {materi.length === 0 ? (
        <p className="text-sm text-gray-500">
          Belum ada materi di modul ini. Tambahkan video, teks, PDF, atau kuis.
        </p>
      ) : (
        <ul className="space-y-2">
          {materi.map((m) => (
            <li key={m.id} className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <MateriRingkas materi={m} />
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSuntingId(suntingId === m.id ? null : m.id);
                      setTambahTerbuka(false);
                    }}
                    aria-expanded={suntingId === m.id}
                    className="cursor-pointer rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    {suntingId === m.id ? "Tutup" : "Ubah"}
                  </button>
                  <HapusMateri courseId={courseId} modulId={modulId} materi={m} />
                </div>
              </div>

              {suntingId === m.id ? (
                <div className="border-t border-gray-100 p-3">
                  <FormMateri courseId={courseId} modulId={modulId} awal={m} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {tambahTerbuka ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-3">
          <FormMateri
            courseId={courseId}
            modulId={modulId}
            onSelesai={() => setTambahTerbuka(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setTambahTerbuka(true);
            setSuntingId(null);
          }}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Tambah materi
        </button>
      )}
    </div>
  );
}

/** Ringkasan satu materi: judul + penanda tipe + pratinjau. */
function MateriRingkas({ materi }: { materi: Materi }) {
  const [buka, setBuka] = useState(false);

  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#0056D2] uppercase">
          {materi.tipe}
        </span>
        {materi.judul}
      </p>
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-expanded={buka}
        className="mt-1 flex cursor-pointer items-center gap-1 text-xs font-medium text-[#0056D2] hover:underline"
      >
        {buka ? <ChevronUp className="size-3" aria-hidden="true" /> : <ChevronDown className="size-3" aria-hidden="true" />}
        {buka ? "Sembunyikan pratinjau" : "Pratinjau"}
      </button>
      {buka ? (
        <div className="mt-2">
          <PratinjauMateri materi={materi} />
        </div>
      ) : null}
    </div>
  );
}

function HapusMateri({
  courseId,
  modulId,
  materi,
}: {
  courseId: string;
  modulId: string;
  materi: Materi;
}) {
  const [state, formAction, pending] = useActionState<MateriActionState, FormData>(
    deleteMateriAction,
    KOSONG,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Hapus materi "${materi.judul}"?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="modul_id" value={modulId} />
      <input type="hidden" name="id" value={materi.id} />
      <button
        type="submit"
        disabled={pending}
        title={state.error ?? "Hapus materi"}
        className="cursor-pointer rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Hapus materi {materi.judul}</span>
      </button>
    </form>
  );
}

/**
 * Form materi — dipakai untuk menambah maupun mengubah.
 *
 * `awal` kosong berarti mode tambah. Mengganti tipe pada mode ubah berarti
 * mengganti payload utuh; action sisi server sudah menangani itu.
 */
function FormMateri({
  courseId,
  modulId,
  awal,
  onSelesai,
}: {
  courseId: string;
  modulId: string;
  awal?: Materi;
  onSelesai?: () => void;
}) {
  const ubah = Boolean(awal);
  const [tipe, setTipe] = useState<TipeMateri>(awal?.tipe ?? "video");

  // Field yang hanya bisa diisi lewat unggahan / editor terstruktur.
  const [path, setPath] = useState(awal?.tipe === "pdf" ? awal.path : "");
  const [ukuran, setUkuran] = useState(awal?.tipe === "pdf" ? awal.ukuran_bytes : 0);
  const [soal, setSoal] = useState<SoalKuis[]>(awal?.tipe === "kuis" ? awal.soal : []);

  const [state, formAction, pending] = useActionState<MateriActionState, FormData>(
    ubah ? updateMateriAction : createMateriAction,
    KOSONG,
  );

  return (
    <form
      action={formAction}
      className="space-y-3"
      key={awal?.id ?? "baru"}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="modul_id" value={modulId} />
      {awal ? <input type="hidden" name="id" value={awal.id} /> : null}
      <input type="hidden" name="tipe" value={tipe} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${awal?.id ?? modulId}-tipe`}>Tipe materi</Label>
          <select
            id={`${awal?.id ?? modulId}-tipe`}
            value={tipe}
            onChange={(event) => setTipe(event.target.value as TipeMateri)}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
          >
            {TIPE.map((item) => (
              <option key={item.nilai} value={item.nilai}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${awal?.id ?? modulId}-judul`}>Judul materi</Label>
          <Input
            id={`${awal?.id ?? modulId}-judul`}
            name="judul"
            defaultValue={awal?.judul ?? ""}
            placeholder="Pengantar variabel"
            required
          />
          <FieldError pesan={state.fieldErrors?.judul} />
        </div>
      </div>

      {tipe === "video" ? (
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor={`${awal?.id ?? modulId}-url`}>URL video</Label>
            <Input
              id={`${awal?.id ?? modulId}-url`}
              name="url"
              type="url"
              defaultValue={awal?.tipe === "video" ? awal.url : ""}
              placeholder="https://www.youtube.com/watch?v=…"
              required
            />
            <p className="field-hint">Hanya http/https. YouTube dan Vimeo otomatis di-embed.</p>
            <FieldError pesan={state.fieldErrors?.url} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${awal?.id ?? modulId}-durasi`}>Durasi (menit)</Label>
            <Input
              id={`${awal?.id ?? modulId}-durasi`}
              name="durasi_min"
              type="number"
              min={0}
              defaultValue={awal?.tipe === "video" ? awal.durasi_min : 0}
            />
            <FieldError pesan={state.fieldErrors?.durasi_min} />
          </div>
        </div>
      ) : null}

      {tipe === "pdf" ? (
        <div className="space-y-2">
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="ukuran_bytes" value={ukuran} />
          <UnggahBerkas
            courseId={courseId}
            subjekId={awal?.id}
            jenis="dokumen"
            label="Unggah PDF"
            onSukses={(hasil) => {
              setPath(hasil.path);
              setUkuran(hasil.ukuran_bytes);
            }}
          />
          {path ? (
            <p className="text-xs text-gray-600">
              Berkas: <a href={path} target="_blank" rel="noreferrer" className="text-[#0056D2] hover:underline">{path}</a>
            </p>
          ) : (
            <p className="field-hint">Unggah berkas PDF terlebih dahulu.</p>
          )}
          <FieldError pesan={state.fieldErrors?.path} />
        </div>
      ) : null}

      {tipe === "kuis" ? (
        <div className="space-y-3">
          {/* Daftar soal dikirim sebagai JSON: bentuknya bersarang, dan
              memetakannya ke field datar akan jauh lebih rapuh. */}
          <input type="hidden" name="soal" value={JSON.stringify(soal)} />
          <EditorSoal soal={soal} onChange={setSoal} />
          <div className="space-y-1.5 sm:max-w-[12rem]">
            <Label htmlFor={`${awal?.id ?? modulId}-lulus`}>Nilai lulus</Label>
            <Input
              id={`${awal?.id ?? modulId}-lulus`}
              name="nilai_lulus"
              type="number"
              min={0}
              max={100}
              defaultValue={awal?.tipe === "kuis" ? awal.nilai_lulus : 70}
            />
            <FieldError pesan={state.fieldErrors?.nilai_lulus} />
          </div>
          <FieldError pesan={state.fieldErrors?.soal} />
        </div>
      ) : null}

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
          {pending ? "Menyimpan…" : ubah ? "Simpan perubahan" : "Tambah materi"}
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

function FieldError({ pesan }: { pesan?: string }) {
  if (!pesan) return null;
  return <p className="field-error">{pesan}</p>;
}

/** Editor daftar soal kuis: pertanyaan, pilihan, dan kunci jawaban. */
function EditorSoal({
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
      { id: `s${Date.now().toString(36)}`, pertanyaan: "", pilihan: ["", ""], jawaban_benar: 0 },
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

      {soal.length === 0 ? (
        <p className="field-hint">Minimal satu soal dengan dua pilihan.</p>
      ) : null}

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
                      // Kunci harus tetap menunjuk pilihan yang sama.
                      jawaban_benar: s.jawaban_benar >= i ? Math.max(0, s.jawaban_benar - 1) : s.jawaban_benar,
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
            className="cursor-pointer text-xs font-semibold text-[#0056D2] hover:underline"
          >
            Tambah pilihan
          </button>
        </div>
      ))}
    </div>
  );
}
