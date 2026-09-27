"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createHalamanAction,
  deleteHalamanAction,
  geserHalamanAction,
  updateHalamanAction,
  type HalamanActionState,
} from "@/actions/halaman";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jumlahKata } from "@/lib/courses/halaman";
import { BlokEditor } from "./blok-editor";
import { PratinjauHalaman } from "./pratinjau-halaman";
import type { Halaman, Modul } from "@/types/course";

/**
 * Daftar halaman berformat sebuah modul.
 *
 * Halaman disusun dan diurutkan dengan tombol naik/turun, sama seperti modul —
 * bukan drag-and-drop, agar konsisten dengan editor di atasnya dan bisa
 * dioperasikan keyboard.
 *
 * Setelah setiap mutasi, Server Action memanggil `revalidatePath` dan Next
 * mengirim ulang RSC payload segar, jadi tidak ada salinan daftar halaman di
 * state klien yang bisa menyimpang dari yang tersimpan.
 */

const KOSONG: HalamanActionState = { ok: false };

export function HalamanEditor({
  courseId,
  modul,
}: {
  courseId: string;
  modul: Modul;
}) {
  const halaman = [...(modul.halaman ?? [])].sort((a, b) => a.urutan - b.urutan);
  const [suntingId, setSuntingId] = useState<string | null>(null);
  const [tambahTerbuka, setTambahTerbuka] = useState(false);

  return (
    <div className="space-y-3">
      {halaman.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
          Modul ini belum punya halaman. Halaman dipakai untuk menulis materi berformat — tebal,
          judul, ukuran huruf, dan backlink antar bagian.
        </p>
      ) : (
        <ol className="space-y-2">
          {halaman.map((h, index) => {
            const kata = jumlahKata({ halaman: [h] });
            return (
              <li key={h.id} className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-start gap-3 p-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-bold text-gray-500"
                  >
                    {h.urutan}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">{h.judul}</h4>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {h.blok.length} blok · {kata} kata
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <UrutkanHalaman
                      courseId={courseId}
                      modulId={modul.id}
                      id={h.id}
                      arah="naik"
                      nonaktif={index === 0}
                    />
                    <UrutkanHalaman
                      courseId={courseId}
                      modulId={modul.id}
                      id={h.id}
                      arah="turun"
                      nonaktif={index === halaman.length - 1}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSuntingId(suntingId === h.id ? null : h.id);
                        setTambahTerbuka(false);
                      }}
                      aria-expanded={suntingId === h.id}
                      className="cursor-pointer rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      {suntingId === h.id ? "Tutup" : "Tulis"}
                    </button>
                    <HapusHalaman courseId={courseId} modulId={modul.id} halaman={h} />
                  </div>
                </div>

                {suntingId === h.id ? (
                  <div className="border-t border-gray-100 p-3">
                    <FormHalaman courseId={courseId} modul={modul} awal={h} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {tambahTerbuka ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-3">
          <FormHalaman courseId={courseId} modul={modul} onSelesai={() => setTambahTerbuka(false)} />
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
          Tambah halaman
        </button>
      )}
    </div>
  );
}

/** Tombol naik/turun; bukan form, argumennya diikat lewat pemanggilan langsung. */
function UrutkanHalaman({
  courseId,
  modulId,
  id,
  arah,
  nonaktif,
}: {
  courseId: string;
  modulId: string;
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
        void geserHalamanAction(courseId, modulId, id, arah)
          .then((hasil) => {
            if (!hasil.ok) setGalat(hasil.error ?? "Gagal memindahkan halaman.");
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
        {arah === "naik" ? "Pindahkan halaman ke atas" : "Pindahkan halaman ke bawah"}
      </span>
    </button>
  );
}

function HapusHalaman({
  courseId,
  modulId,
  halaman,
}: {
  courseId: string;
  modulId: string;
  halaman: Halaman;
}) {
  const [state, formAction, pending] = useActionState<HalamanActionState, FormData>(
    deleteHalamanAction,
    KOSONG,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Hapus halaman "${halaman.judul}" beserta ${halaman.blok.length} bloknya?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="modul_id" value={modulId} />
      <input type="hidden" name="id" value={halaman.id} />
      <button
        type="submit"
        disabled={pending}
        title={state.error ?? "Hapus halaman"}
        className="cursor-pointer rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Hapus halaman {halaman.judul}</span>
      </button>
    </form>
  );
}

/**
 * Form satu halaman: judul, editor blok, dan pratinjau.
 *
 * Blok dikirim sebagai satu field JSON — bentuknya bersarang (butir → segmen →
 * penanda), dan memetakannya ke field datar jauh lebih rapuh. Pola yang sama
 * dipakai daftar soal pada editor kuis (`editor-soal.tsx`).
 *
 * Pada mode ubah, blok yang tidak disentuh pun ikut dikirim apa adanya. Server
 * menyimpannya kembali tanpa perubahan berarti, dan itu disengaja: mencoba
 * mendeteksi "tidak berubah" akan menuntut perbandingan dalam, sementara
 * mengirim ulang nilai yang sama tidak merusak apa pun.
 */
function FormHalaman({
  courseId,
  modul,
  awal,
  onSelesai,
}: {
  courseId: string;
  modul: Modul;
  awal?: Halaman;
  onSelesai?: () => void;
}) {
  const ubah = Boolean(awal);
  const [blok, setBlok] = useState(awal?.blok ?? []);
  const [pratinjau, setPratinjau] = useState(false);

  const [state, formAction, pending] = useActionState<HalamanActionState, FormData>(
    ubah ? updateHalamanAction : createHalamanAction,
    KOSONG,
  );

  const kunci = awal?.id ?? "baru";
  // Path unggahan memakai id halaman bila sudah ada; halaman baru belum punya id
  // (store yang memberikannya saat simpan), jadi berkasnya sementara ditaruh
  // pada modulnya lebih dulu supaya tidak ada folder bernama "baru".
  const subjekUnggah = awal?.id ?? modul.id;

  return (
    <form action={formAction} className="space-y-3" key={kunci}>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="modul_id" value={modul.id} />
      {awal ? <input type="hidden" name="id" value={awal.id} /> : null}
      <input type="hidden" name="blok" value={JSON.stringify(blok)} />

      <div className="space-y-1.5">
        <Label htmlFor={`${kunci}-judul-halaman`}>Judul halaman</Label>
        <Input
          id={`${kunci}-judul-halaman`}
          name="judul"
          defaultValue={awal?.judul ?? ""}
          placeholder="Menyiapkan lingkungan kerja"
          required
        />
        {state.fieldErrors?.judul ? <p className="field-error">{state.fieldErrors.judul}</p> : null}
      </div>

      <BlokEditor
        blok={blok}
        onChange={setBlok}
        courseId={courseId}
        modulId={modul.id}
        subjekUnggah={subjekUnggah}
      />

      {state.fieldErrors?.blok ? <p className="field-error">{state.fieldErrors.blok}</p> : null}

      <button
        type="button"
        onClick={() => setPratinjau((v) => !v)}
        aria-expanded={pratinjau}
        className="cursor-pointer text-xs font-semibold text-[#0056D2]"
      >
        {pratinjau ? "Sembunyikan pratinjau" : "Pratinjau seperti peserta melihatnya"}
      </button>

      {pratinjau ? (
        <PratinjauHalaman
          modul={{ ...modul, halaman: [halamanKerangka(courseId, modul.id, blok)] }}
          halaman={halamanKerangka(courseId, modul.id, blok)}
        />
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
          {pending ? "Menyimpan…" : ubah ? "Simpan halaman" : "Tambah halaman"}
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

/**
 * Kerangka halaman untuk pratinjau sebelum disimpan.
 *
 * Id-nya sengaja kosong — pratinjau tidak boleh menyamar sebagai halaman yang
 * sudah punya identitas, dan backlink di dalamnya hanya berlaku selama
 * pratinjau terbuka.
 */
function halamanKerangka(courseId: string, modulId: string, blok: Halaman["blok"]): Halaman {
  return {
    id: "pratinjau",
    modul_id: modulId,
    course_id: courseId,
    judul: "Pratinjau halaman",
    urutan: 1,
    blok,
    created_at: "",
    updated_at: "",
  };
}
