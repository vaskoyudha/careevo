"use client";

import { useActionState, useCallback, useState } from "react";
import { sembunyikanGalat, type PetaState } from "@/lib/forms/sembunyikan-galat-field";

/** Default predicate: every result may be dropped on edit. */
const bolehSemua = () => true;

/** Nama field pada event, untuk mencocokkan galat dengan field yang disunting. */
type EventDenganTarget = { target: EventTarget | null };

export interface OpsiSembunyiGalat<State> {
  /**
   * Key di state yang memetakan `namaField -> pesan galat` — misalnya
   * `["errors"]` di auth atau `["fieldErrors"]` di editor admin.
   *
   * Ada = per-field: menyunting satu field menghapus **hanya** galat field itu.
   * Galat kolom lain tetap tampil karena masih berlaku.
   *
   * Tidak ada = form ini hanya punya satu pesan tingkat-form, jadi tidak ada
   * field yang bisa disalahkan; mengedit apa pun membuat pesan itu basi.
   */
  petaFieldErrors?: PetaState;
  /**
   * Key pesan tingkat-form (`["message"]`) yang ikut hilang begitu form disunting.
   *
   * Halaman masuk butuh ini: `errors`-nya selalu kosong, jadi satu-satunya
   * umpan balik adalah `message`, dan tanpa ini "Email atau password salah"
   * tetap menempel selagi password belum dikirim ulang.
   */
  pesanForm?: PetaState;
  /**
   * Hasil yang tetap perlu bertahan meski form disunting — misalnya sukses yang
   * menjadwalkan dialog ditutup. Default: semua hasil boleh disembunyikan.
   */
  bolehDisembunyikan?: (state: State) => boolean;
}

/**
 * `useActionState` yang melepas galat basi begitu form disunting.
 *
 * `useActionState` menahan hasil Server Action sampai submit berikutnya, jadi
 * "Email sudah terdaftar" tetap menempel padahal yang diketik orang sudah bukan
 * email itu lagi. Pesan itu klaim tentang nilai **yang dikirim**; begitu nilainya
 * berubah, klaimnya tidak berlaku — dan menampilkannya berarti berbohong soal
 * field yang sedang dilihat orang.
 *
 * `onChange` dipasang pada `<form>`: event perubahan dari isinya menggelembung
 * ke form, jadi satu handler cukup untuk semua field dan nama field diambil dari
 * `event.target.name` — tidak ada daftar field yang harus dijaga manual per form.
 * Form yang kontrolnya tombol tidak emit `change`; pakailah `onClick` di sana.
 *
 * Hasil baru dari server selalu menimpa penyembunyian, jadi kegagalan berikutnya
 * tetap menampilkan pesannya sendiri. Penyembunyian dilepas saat render (dibandingkan
 * terhadap hasil sebelumnya, bukan di dalam effect) supaya pesan baru tidak
 * berkedip satu frame telat.
 */
export function useResettableActionState<State, Payload = FormData>(
  action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
  initialState: Awaited<State>,
  opsi: OpsiSembunyiGalat<Awaited<State>> = {},
) {
  const [state, formAction, pending] = useActionState<State, Payload>(
    action,
    initialState,
  );
  const [sembunyiSemua, setSembunyiSemua] = useState(false);
  const [fieldDisunting, setFieldDisunting] = useState<ReadonlySet<string>>(() => new Set());
  const [prevState, setPrevState] = useState(state);

  if (prevState !== state) {
    setPrevState(state);
    if (sembunyiSemua) setSembunyiSemua(false);
    if (fieldDisunting.size > 0) setFieldDisunting(new Set());
  }

  const { petaFieldErrors, pesanForm, bolehDisembunyikan = bolehSemua } = opsi;

  const onChange = useCallback(
    (event: EventDenganTarget) => {
      const nama = (event.target as { name?: string } | null)?.name;

      if (petaFieldErrors) {
        // Kontrol tanpa nama tidak bisa dikaitkan ke satu field. Membuang
        // semuanya justru mengembalikan galat kolom lain yang masih berlaku.
        if (!nama) return;
        setFieldDisunting((prev) => (prev.has(nama) ? prev : new Set(prev).add(nama)));
        return;
      }

      if (bolehDisembunyikan(state)) setSembunyiSemua(true);
    },
    [state, petaFieldErrors, bolehDisembunyikan],
  );

  const tampil = sembunyiSemua
    ? initialState
    : sembunyikanGalat(state, petaFieldErrors, pesanForm, fieldDisunting);

  return [tampil, formAction, pending, onChange] as const;
}
