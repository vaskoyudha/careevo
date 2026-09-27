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
import {
  createSubmodulAction,
  deleteSubmodulAction,
  geserSubmodulAction,
  updateSubmodulAction,
  type SubmodulActionState,
} from "@/actions/submodul";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jumlahKata } from "@/lib/courses/halaman";
import { submodulUntukModul } from "@/lib/courses/submodul";
import { BlokEditor } from "./blok-editor";
import { PratinjauHalaman } from "./pratinjau-halaman";
import type { Halaman, Modul, Submodul } from "@/types/course";

/**
 * Daftar bab (sub-modul) sebuah modul, masing-masing dengan halamannya.
 *
 * ## Kenapa bertingkat
 *
 * Halaman tidak lagi menempel langsung di modul: satu modul biasanya berisi
 * beberapa bab, dan tiap bab beberapa halaman. Editor yang mendatarkan keduanya
 * akan menyembunyikan struktur yang justru sedang disusun admin — dan pertanyaan
 * "halaman ini masuk bab mana" tidak bisa dijawab dari daftar datar.
 *
 * Karena itu bentuk di sini **mencerminkan bentuk tersimpannya**: bab adalah
 * kotak, halaman adalah baris di dalamnya. Urutan di dalam bab diatur tombol
 * naik/turun halaman; urutan antar-bab diatur tombol naik/turun bab.
 *
 * ## Satu panel terbuka per tingkat
 *
 * Sama seperti `modul-editor.tsx`: hanya satu form sunting dan satu form tambah
 * yang terbuka, supaya daftar tidak menumpuk menjadi dinding formulir.
 *
 * Setelah setiap mutasi, Server Action memanggil `revalidatePath` dan Next
 * mengirim ulang RSC payload segar, jadi tidak ada salinan daftar di state klien
 * yang bisa menyimpang dari yang tersimpan.
 */

const KOSONG_HALAMAN: HalamanActionState = { ok: false };
const KOSONG_SUBMODUL: SubmodulActionState = { ok: false };

export function HalamanEditor({ courseId, modul }: { courseId: string; modul: Modul }) {
  const bab = submodulUntukModul(modul);
  const [suntingHalamanId, setSuntingHalamanId] = useState<string | null>(null);
  const [suntingBabId, setSuntingBabId] = useState<string | null>(null);
  const [tambahHalamanDiBab, setTambahHalamanDiBab] = useState<string | null>(null);
  const [tambahBabTerbuka, setTambahBabTerbuka] = useState(false);

  const totalHalaman = bab.reduce((total, s) => total + (s.halaman ?? []).length, 0);

  return (
    <div className="space-y-3">
      {bab.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
          Modul ini belum punya bab. Bab mengelompokkan halaman jadi bagian-bagian yang bisa
          dibaca berurutan — mis. &ldquo;Instalasi&rdquo;, &ldquo;Relasi&rdquo;,
          &ldquo;Validasi&rdquo;.
        </p>
      ) : (
        <ol className="space-y-3">
          {bab.map((s, indexBab) => {
            const halaman = [...(s.halaman ?? [])].sort((a, b) => a.urutan - b.urutan);
            return (
              <li key={s.id} className="rounded-xl border border-gray-300 bg-gray-50/60">
                <div className="flex items-start gap-3 p-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-gray-900 text-xs font-bold text-white"
                  >
                    {s.urutan}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">{s.judul}</h4>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {halaman.length} halaman
                      {s.ringkasan ? ` · ${s.ringkasan}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <UrutkanBab
                      courseId={courseId}
                      modulId={modul.id}
                      id={s.id}
                      arah="naik"
                      nonaktif={indexBab === 0}
                    />
                    <UrutkanBab
                      courseId={courseId}
                      modulId={modul.id}
                      id={s.id}
                      arah="turun"
                      nonaktif={indexBab === bab.length - 1}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSuntingBabId(suntingBabId === s.id ? null : s.id);
                        setTambahBabTerbuka(false);
                      }}
                      aria-expanded={suntingBabId === s.id}
                      className="cursor-pointer rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      {suntingBabId === s.id ? "Tutup" : "Ubah bab"}
                    </button>
                    <HapusBab
                      courseId={courseId}
                      modulId={modul.id}
                      bab={s}
                      jumlahHalaman={halaman.length}
                    />
                  </div>
                </div>

                {suntingBabId === s.id ? (
                  <div className="border-t border-gray-200 bg-white p-3">
                    <FormBab courseId={courseId} modulId={modul.id} awal={s} />
                  </div>
                ) : null}

                <div className="border-t border-gray-200 bg-white p-3">
                  {halaman.length === 0 ? (
                    <p className="mb-2 text-xs text-gray-500">
                      Belum ada halaman di bab ini.
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {halaman.map((h, indexHalaman) => (
                        <li key={h.id} className="rounded-lg border border-gray-200">
                          <div className="flex items-start gap-3 p-2.5">
                            <span
                              aria-hidden="true"
                              className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-bold text-gray-500"
                            >
                              {indexHalaman + 1}
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">{h.judul}</p>
                              <p className="mt-0.5 text-xs text-gray-500">
                                {h.blok.length} blok · {jumlahKata({ submodul: [{ ...s, halaman: [h] }] })} kata
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <UrutkanHalaman
                                courseId={courseId}
                                modulId={modul.id}
                                id={h.id}
                                arah="naik"
                                nonaktif={indexHalaman === 0}
                              />
                              <UrutkanHalaman
                                courseId={courseId}
                                modulId={modul.id}
                                id={h.id}
                                arah="turun"
                                nonaktif={indexHalaman === halaman.length - 1}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setSuntingHalamanId(suntingHalamanId === h.id ? null : h.id);
                                  setTambahHalamanDiBab(null);
                                }}
                                aria-expanded={suntingHalamanId === h.id}
                                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                              >
                                {suntingHalamanId === h.id ? "Tutup" : "Tulis"}
                              </button>
                              <HapusHalaman courseId={courseId} modulId={modul.id} halaman={h} />
                            </div>
                          </div>

                          {suntingHalamanId === h.id ? (
                            <div className="border-t border-gray-100 p-3">
                              <FormHalaman
                                courseId={courseId}
                                modul={modul}
                                submodulId={s.id}
                                awal={h}
                              />
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )}

                  {tambahHalamanDiBab === s.id ? (
                    <div className="mt-2 rounded-lg border border-dashed border-gray-300 p-3">
                      <FormHalaman
                        courseId={courseId}
                        modul={modul}
                        submodulId={s.id}
                        onSelesai={() => setTambahHalamanDiBab(null)}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTambahHalamanDiBab(s.id);
                        setSuntingHalamanId(null);
                      }}
                      className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      Tambah halaman
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {tambahBabTerbuka ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-3">
          <FormBab
            courseId={courseId}
            modulId={modul.id}
            onSelesai={() => setTambahBabTerbuka(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setTambahBabTerbuka(true);
            setSuntingBabId(null);
          }}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Tambah bab
        </button>
      )}

      {totalHalaman === 0 && bab.length > 0 ? (
        <p className="text-xs text-gray-500">
          Belum ada halaman sama sekali di modul ini.
        </p>
      ) : null}
    </div>
  );
}

/** Tombol naik/turun bab; bukan form, argumennya diikat lewat pemanggilan langsung. */
function UrutkanBab({
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
      title={galat ?? (arah === "naik" ? "Pindah bab ke atas" : "Pindah bab ke bawah")}
      onClick={() => {
        setGalat(null);
        setSibuk(true);
        void geserSubmodulAction(courseId, modulId, id, arah)
          .then((hasil) => {
            if (!hasil.ok) setGalat(hasil.error ?? "Gagal memindahkan bab.");
          })
          .finally(() => setSibuk(false));
      }}
      className="cursor-pointer rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {arah === "naik" ? (
        <ChevronUp className="size-3.5" aria-hidden="true" />
      ) : (
        <ChevronDown className="size-3.5" aria-hidden="true" />
      )}
      <span className="sr-only">
        {arah === "naik" ? "Pindahkan bab ke atas" : "Pindahkan bab ke bawah"}
      </span>
    </button>
  );
}

/** Tombol naik/turun halaman; bukan form, argumennya diikat lewat pemanggilan langsung. */
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
      className="cursor-pointer rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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

function HapusBab({
  courseId,
  modulId,
  bab,
  jumlahHalaman,
}: {
  courseId: string;
  modulId: string;
  bab: Submodul;
  jumlahHalaman: number;
}) {
  const [state, formAction, pending] = useActionState<SubmodulActionState, FormData>(
    deleteSubmodulAction,
    KOSONG_SUBMODUL,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        // Halaman di dalam bab ikut terhapus, jadi jumlahnya disebut di sini —
        // inilah satu-satunya tempat admin bisa melihat apa yang akan hilang.
        const pesan =
          jumlahHalaman > 0
            ? `Hapus bab "${bab.judul}" beserta ${jumlahHalaman} halamannya?`
            : `Hapus bab "${bab.judul}"?`;
        if (!window.confirm(pesan)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="modul_id" value={modulId} />
      <input type="hidden" name="id" value={bab.id} />
      <input type="hidden" name="jumlah_halaman" value={jumlahHalaman} />
      <button
        type="submit"
        disabled={pending}
        title={state.error ?? "Hapus bab"}
        className="cursor-pointer rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Hapus bab {bab.judul}</span>
      </button>
    </form>
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
    KOSONG_HALAMAN,
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
        className="cursor-pointer rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Hapus halaman {halaman.judul}</span>
      </button>
    </form>
  );
}

/** Form satu bab: judul + ringkasan opsional. */
function FormBab({
  courseId,
  modulId,
  awal,
  onSelesai,
}: {
  courseId: string;
  modulId: string;
  awal?: Submodul;
  onSelesai?: () => void;
}) {
  const ubah = Boolean(awal);
  const [state, formAction, pending] = useActionState<SubmodulActionState, FormData>(
    ubah ? updateSubmodulAction : createSubmodulAction,
    KOSONG_SUBMODUL,
  );

  const kunci = awal?.id ?? "baru";

  return (
    <form action={formAction} className="space-y-3" key={kunci}>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="modul_id" value={modulId} />
      {awal ? <input type="hidden" name="id" value={awal.id} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${kunci}-judul-bab`}>Judul bab</Label>
        <Input
          id={`${kunci}-judul-bab`}
          name="judul"
          defaultValue={awal?.judul ?? ""}
          placeholder="Menghubungkan relasi"
          required
        />
        {state.fieldErrors?.judul ? <p className="field-error">{state.fieldErrors.judul}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${kunci}-ringkasan-bab`}>Ringkasan (opsional)</Label>
        <Input
          id={`${kunci}-ringkasan-bab`}
          name="ringkasan"
          defaultValue={awal?.ringkasan ?? ""}
          placeholder="Satu kalimat tentang isi bab ini"
        />
        {state.fieldErrors?.ringkasan ? (
          <p className="field-error">{state.fieldErrors.ringkasan}</p>
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
          {pending ? "Menyimpan…" : ubah ? "Simpan bab" : "Tambah bab"}
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
  submodulId,
  awal,
  onSelesai,
}: {
  courseId: string;
  modul: Modul;
  /** Bab tempat halaman baru dibuat; pada mode ubah hanya diteruskan ke pratinjau. */
  submodulId: string;
  awal?: Halaman;
  onSelesai?: () => void;
}) {
  const ubah = Boolean(awal);
  const [blok, setBlok] = useState(awal?.blok ?? []);
  const [pratinjau, setPratinjau] = useState(false);

  const [state, formAction, pending] = useActionState<HalamanActionState, FormData>(
    ubah ? updateHalamanAction : createHalamanAction,
    KOSONG_HALAMAN,
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
      <input type="hidden" name="submodul_id" value={submodulId} />
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
          modul={modulPratinjau(courseId, modul.id, submodulId, blok)}
          halaman={halamanKerangka(courseId, modul.id, submodulId, blok)}
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
function halamanKerangka(
  courseId: string,
  modulId: string,
  submodulId: string,
  blok: Halaman["blok"],
): Halaman {
  return {
    id: "pratinjau",
    submodul_id: submodulId,
    modul_id: modulId,
    course_id: courseId,
    judul: "Pratinjau halaman",
    urutan: 1,
    blok,
    created_at: "",
    updated_at: "",
  };
}

/**
 * Modul pratinjau berisi satu bab dengan satu halaman.
 *
 * `PratinjauHalaman` butuh `Pick<Modul, "submodul">` karena pager "halaman
 * berikutnya" diratakan dari bab; halaman tunggal ini disajikan sebagai modul
 * berbab-tunggal supaya bentuknya sama persis dengan yang dilihat peserta.
 */
function modulPratinjau(
  courseId: string,
  modulId: string,
  submodulId: string,
  blok: Halaman["blok"],
): Pick<Modul, "submodul"> {
  return {
    submodul: [
      {
        id: submodulId,
        modul_id: modulId,
        course_id: courseId,
        judul: "Pratinjau",
        ringkasan: "",
        urutan: 1,
        halaman: [halamanKerangka(courseId, modulId, submodulId, blok)],
        created_at: "",
        updated_at: "",
      },
    ],
  };
}
