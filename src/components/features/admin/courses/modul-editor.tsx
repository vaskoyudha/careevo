"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createModulAction,
  deleteModulAction,
  geserModulAction,
  updateModulAction,
  type ModulActionState,
} from "@/actions/modul";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MateriEditor } from "./materi-editor";
import { HalamanEditor } from "./halaman-editor";
import { BATAS_HALAMAN_PER_MODUL } from "@/lib/validation/halaman";
import { MODE_CHECKPOINT_LABEL } from "@/lib/courses/kebijakan";
import type { Modul, ModeCheckpoint } from "@/types/course";

/**
 * Daftar modul sebuah kursus dengan tambah/ubah/hapus dan pengurutan.
 *
 * Pengurutan memakai tombol naik/turun, bukan drag-and-drop: tanpa dependency
 * tambahan, bisa dioperasikan keyboard, dan cocok dengan daftar yang biasanya
 * pendek. Urutan akhir tetap dinormalkan server, jadi UI tidak perlu menebak.
 *
 * Setelah setiap mutasi, halaman dimuat ulang lewat RSC payload dari
 * `revalidatePath` di Server Action — tidak ada salinan daftar di state klien.
 */

const KOSONG: ModulActionState = { ok: false };

export function ModulEditor({
  courseId,
  modul,
}: {
  courseId: string;
  modul: Modul[];
}) {
  const [tambahTerbuka, setTambahTerbuka] = useState(false);
  const [suntingId, setSuntingId] = useState<string | null>(null);
  const [materiId, setMateriId] = useState<string | null>(null);
  const [halamanId, setHalamanId] = useState<string | null>(null);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);

  /** Hanya satu panel terbuka per modul, supaya daftar tidak menumpuk. */
  const buka = (id: string, panel: "sunting" | "materi" | "halaman" | "checkpoint") => {
    setSuntingId(panel === "sunting" && suntingId !== id ? id : null);
    setMateriId(panel === "materi" && materiId !== id ? id : null);
    setHalamanId(panel === "halaman" && halamanId !== id ? id : null);
    setCheckpointId(panel === "checkpoint" && checkpointId !== id ? id : null);
  };

  return (
    <div className="space-y-3">
      {modul.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
          Kursus ini belum punya modul tersimpan, sehingga halaman belajar masih memakai 5 modul
          turunan otomatis. Menambahkan modul pertama akan menggantikannya dengan kurikulum yang
          kamu susun sendiri.
        </div>
      ) : (
        <ol className="space-y-2">
          {modul.map((m, index) => {
            const jumlahMateri = (m.materi ?? []).length;
            const jumlahHalaman = (m.halaman ?? []).length;
            return (
              <li key={m.id} className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-start gap-3 p-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-bold text-gray-500"
                  >
                    {m.urutan}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">{m.judul}</h3>
                    <p className="mt-0.5 text-sm text-gray-600">{m.ringkasan}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>{m.durasi_min} mnt</span>
                      <button
                        type="button"
                        onClick={() => buka(m.id, "halaman")}
                        aria-expanded={halamanId === m.id}
                        className="cursor-pointer font-medium text-[#0056D2] hover:underline"
                      >
                        {halamanId === m.id ? "Tutup halaman" : `Halaman (${jumlahHalaman})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => buka(m.id, "materi")}
                        aria-expanded={materiId === m.id}
                        className="cursor-pointer font-medium text-[#0056D2] hover:underline"
                      >
                        {materiId === m.id ? "Tutup lampiran" : `Lampiran (${jumlahMateri})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => buka(m.id, "checkpoint")}
                        aria-expanded={checkpointId === m.id}
                        className="cursor-pointer font-medium text-[#0056D2] hover:underline"
                      >
                        {checkpointId === m.id ? "Tutup checkpoint" : "Checkpoint"}
                      </button>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <UrutkanModul
                      courseId={courseId}
                      id={m.id}
                      arah="naik"
                      nonaktif={index === 0}
                    />
                    <UrutkanModul
                      courseId={courseId}
                      id={m.id}
                      arah="turun"
                      nonaktif={index === modul.length - 1}
                    />
                    <button
                      type="button"
                      onClick={() => buka(m.id, "sunting")}
                      aria-expanded={suntingId === m.id}
                      className="cursor-pointer rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      {suntingId === m.id ? "Tutup" : "Ubah"}
                    </button>
                    <HapusModul courseId={courseId} modul={m} />
                  </div>
                </div>

                {suntingId === m.id ? (
                  <div className="border-t border-gray-100 p-3">
                    <FormModul courseId={courseId} awal={m} />
                  </div>
                ) : null}

                {halamanId === m.id ? (
                  <div className="border-t border-gray-100 p-3">
                    <HalamanEditor courseId={courseId} modul={m} />
                  </div>
                ) : null}

                {materiId === m.id ? (
                  <div className="border-t border-gray-100 p-3">
                    <MateriEditor courseId={courseId} modulId={m.id} materi={m.materi ?? []} />
                  </div>
                ) : null}

                {checkpointId === m.id ? (
                  <div className="border-t border-gray-100 p-3">
                    <PanelCheckpoint courseId={courseId} modul={m} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {tambahTerbuka ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-3">
          <FormModul courseId={courseId} onSelesai={() => setTambahTerbuka(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setTambahTerbuka(true);
            setSuntingId(null);
            setMateriId(null);
            setHalamanId(null);
          }}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Tambah modul
        </button>
      )}
    </div>
  );
}

/**
 * Tombol naik/turun.
 *
 * Aksi ini bukan form: argumennya diikat lewat `bind`, jadi tidak ada
 * `useActionState` — hasilnya sekadar memicu revalidate di server.
 */
function UrutkanModul({
  courseId,
  id,
  arah,
  nonaktif,
}: {
  courseId: string;
  id: string;
  arah: "naik" | "turun";
  nonaktif: boolean;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={nonaktif || sibuk}
      title={galat ?? (arah === "naik" ? "Pindah ke atas" : "Pindah ke bawah")}
      onClick={() => {
        setGalat(null);
        setSibuk(true);
        void geserModulAction(courseId, id, arah)
          .then((hasil) => {
            if (!hasil.ok) setGalat(hasil.error ?? "Gagal memindahkan modul.");
          })
          .finally(() => setSibuk(false));
      }}
      className="cursor-pointer rounded-lg border border-gray-300 px-2 py-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {arah === "naik" ? (
        <ChevronUp className="size-3.5" aria-hidden="true" />
      ) : (
        <ChevronDown className="size-3.5" aria-hidden="true" />
      )}
      <span className="sr-only">
        {arah === "naik" ? "Pindahkan modul ke atas" : "Pindahkan modul ke bawah"}
      </span>
    </button>
  );
}

function HapusModul({ courseId, modul }: { courseId: string; modul: Modul }) {
  const [state, formAction, pending] = useActionState<ModulActionState, FormData>(
    deleteModulAction,
    KOSONG,
  );
  const jumlahMateri = (modul.materi ?? []).length;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const pesan =
          jumlahMateri > 0
            ? `Hapus modul "${modul.judul}" beserta ${jumlahMateri} materinya?`
            : `Hapus modul "${modul.judul}"?`;
        if (!window.confirm(pesan)) event.preventDefault();
      }}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="id" value={modul.id} />
      <button
        type="submit"
        disabled={pending}
        title={state.error ?? "Hapus modul"}
        className="cursor-pointer rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Hapus modul {modul.judul}</span>
      </button>
    </form>
  );
}

function FormModul({
  courseId,
  awal,
  onSelesai,
}: {
  courseId: string;
  awal?: Modul;
  onSelesai?: () => void;
}) {
  const ubah = Boolean(awal);
  const [state, formAction, pending] = useActionState<ModulActionState, FormData>(
    ubah ? updateModulAction : createModulAction,
    KOSONG,
  );
  const kunci = awal?.id ?? "baru";

  return (
    <form action={formAction} className="space-y-3" key={kunci}>
      <input type="hidden" name="course_id" value={courseId} />
      {awal ? <input type="hidden" name="id" value={awal.id} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${kunci}-judul`}>Judul modul</Label>
        <Input
          id={`${kunci}-judul`}
          name="judul"
          defaultValue={awal?.judul ?? ""}
          placeholder="Orientasi dan peta konsep"
          required
        />
        {state.fieldErrors?.judul ? <p className="field-error">{state.fieldErrors.judul}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`${kunci}-ringkasan`}>Ringkasan</Label>
          <Input
            id={`${kunci}-ringkasan`}
            name="ringkasan"
            defaultValue={awal?.ringkasan ?? ""}
            placeholder="Apa yang dipelajari di modul ini"
            required
          />
          {state.fieldErrors?.ringkasan ? (
            <p className="field-error">{state.fieldErrors.ringkasan}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${kunci}-durasi`}>Durasi (menit)</Label>
          <Input
            id={`${kunci}-durasi`}
            name="durasi_min"
            type="number"
            min={1}
            defaultValue={awal?.durasi_min ?? 30}
            required
          />
          {state.fieldErrors?.durasi_min ? (
            <p className="field-error">{state.fieldErrors.durasi_min}</p>
          ) : null}
        </div>
      </div>

      {/*
        Jumlah halaman hanya ada saat MEMBUAT modul.
        Saat menyunting, menambah halaman akan menyisipkan halaman kosong ke
        daftar yang mungkin sudah ditulis, tanpa posisi yang jelas — jadi
        penambahan halaman dikerjakan lewat tombol di editor halaman.
      */}
      {!ubah ? (
        <div className="space-y-1.5 sm:max-w-[12rem]">
          <Label htmlFor={`${kunci}-jumlah-halaman`}>Jumlah halaman</Label>
          <Input
            id={`${kunci}-jumlah-halaman`}
            name="jumlah_halaman"
            type="number"
            min={0}
            max={BATAS_HALAMAN_PER_MODUL}
            defaultValue={1}
          />
          <p className="field-hint">
            Halaman kosong dibuat langsung di modul ini. Isinya ditulis setelah modul tersimpan.
            Isi 0 bila modul ini hanya berisi lampiran.
          </p>
          {state.fieldErrors?.jumlah_halaman ? (
            <p className="field-error">{state.fieldErrors.jumlah_halaman}</p>
          ) : null}
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
          {pending ? "Menyimpan…" : ubah ? "Simpan perubahan" : "Tambah modul"}
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

const MODE_OPSI: ModeCheckpoint[] = ["materi", "kuis", "proyek"];

/**
 * Panel checkpoint satu modul.
 *
 * Aturannya: mode `materi` selesai lewat penandaan manual, sedangkan `kuis`
 * dan `proyek` menautkan lampiran/tugas yang sudah ada lewat `ref`.
 *
 * `ref` sengaja bukan `<select>` wajib: saat mode `kuis`, pilihan diisi dari
 * lampiran kuis milik modul ini, tetapi admin tetap boleh menyimpan tanpa
 * memilih (mis. menautkan nanti) — validasi ketersediaan materi bergantung isi
 * modul dan tidak bisa diputuskan skema.
 */
function PanelCheckpoint({ courseId, modul }: { courseId: string; modul: Modul }) {
  const [state, formAction, pending] = useActionState<ModulActionState, FormData>(
    updateModulAction,
    KOSONG,
  );
  const checkpoint = modul.checkpoint;
  const [mode, setMode] = useState<ModeCheckpoint>(checkpoint?.mode ?? "materi");
  const opsiKuis = (modul.materi ?? []).filter((m) => m.tipe === "kuis");

  return (
    <form action={formAction} className="space-y-3" key={modul.id}>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="id" value={modul.id} />
      {/* Judul/ringkasan/durasi wajib ada di skema; dikirim apa adanya agar
          penyimpanan checkpoint tidak diam-diam mengubah field lain. */}
      <input type="hidden" name="judul" value={modul.judul} />
      <input type="hidden" name="ringkasan" value={modul.ringkasan} />
      <input type="hidden" name="durasi_min" value={modul.durasi_min} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${modul.id}-checkpoint-mode`}>Mode checkpoint</Label>
          <select
            id={`${modul.id}-checkpoint-mode`}
            name="checkpoint_mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as ModeCheckpoint)}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
          >
            {MODE_OPSI.map((nilai) => (
              <option key={nilai} value={nilai}>
                {MODE_CHECKPOINT_LABEL[nilai]}
              </option>
            ))}
          </select>
          <p className="field-hint">
            {mode === "materi"
              ? "Peserta menandai modul selesai setelah membaca materinya."
              : "Peserta menyelesaikan lewat lampiran/tugas yang ditautkan, bukan penandaan manual."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${modul.id}-checkpoint-batas`}>Batas waktu (menit)</Label>
          <Input
            id={`${modul.id}-checkpoint-batas`}
            name="checkpoint_batas_waktu"
            type="number"
            min={1}
            max={600}
            defaultValue={checkpoint?.batas_waktu_menit ?? 30}
          />
          <FieldError pesan={state.fieldErrors?.checkpoint} />
        </div>
      </div>

      {mode === "kuis" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${modul.id}-checkpoint-ref`}>Kuis yang ditautkan</Label>
          {opsiKuis.length === 0 ? (
            <p className="field-hint">
              Modul ini belum punya lampiran kuis. Tambahkan materi bertipe kuis di panel Lampiran.
            </p>
          ) : (
            <select
              id={`${modul.id}-checkpoint-ref`}
              name="checkpoint_ref"
              defaultValue={checkpoint?.ref ?? ""}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            >
              <option value="">— tanpa tautan —</option>
              {opsiKuis.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.judul}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      {mode === "proyek" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${modul.id}-checkpoint-ref`}>ID tugas (challenge)</Label>
          <Input
            id={`${modul.id}-checkpoint-ref`}
            name="checkpoint_ref"
            defaultValue={checkpoint?.ref ?? ""}
            placeholder="ch-1"
          />
          <p className="field-hint">
            Id tugas dari daftar challenge. Kosongkan bila belum ada yang ditautkan.
          </p>
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

      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : "Simpan checkpoint"}
      </button>
    </form>
  );
}

function FieldError({ pesan }: { pesan?: string }) {
  if (!pesan) return null;
  return <p className="field-error">{pesan}</p>;
}
