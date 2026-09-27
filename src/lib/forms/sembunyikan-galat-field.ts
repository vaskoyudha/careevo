/**
 * Buang galat yang sudah basi: entry milik field yang disunting, dan pesan
 * tingkat-form yang ikut menggantung.
 *
 * Ini murni supaya bisa diuji tanpa DOM: `useActionState` tidak punya
 * "setState", jadi pemanggil harus menurunkan state yang ditampilkan dari
 * state asli plus daftar field yang sudah diedit — dan daftar itu tidak
 * boleh bocor ke modul klien yang tidak punya environment.
 *
 * Sifat penting: galat field **yang lain** tetap ada. Mengoreksi kolom email
 * tidak menghapus keluhan tentang username — hanya itu yang masih berlaku.
 */

/** Key yang membawa galat per-field, atau pesan tingkat-form, di dalam state. */
export type PetaState = readonly string[];

export function sembunyikanGalat<State>(
  state: State,
  petaFieldErrors: PetaState | undefined,
  pesanForm: PetaState | undefined,
  namaField: ReadonlySet<string>,
): State {
  if (namaField.size === 0 || !petaFieldErrors) return state;

  let hasil: Record<string, unknown> | null = null;
  const tulis = (key: string, nilai: unknown) => {
    hasil ??= { ...(state as Record<string, unknown>) };
    hasil[key] = nilai;
  };

  // Galat per-field: buang hanya field yang disunting.
  for (const key of petaFieldErrors) {
    const asal = (state as Record<string, unknown> | null)?.[key];
    if (!asal || typeof asal !== "object") continue;

    const berikutnya: Record<string, string> = {};
    let berubah = false;
    for (const [kunci, pesan] of Object.entries(asal as Record<string, string>)) {
      if (namaField.has(kunci)) {
        berubah = true;
        continue;
      }
      berikutnya[kunci] = pesan;
    }
    if (berubah) tulis(key, berikutnya);
  }

  // Pesan tingkat-form: satu kesimpulan untuk seluruh form, jadi ikut basi
  // begitu apa pun form itu disunting. "Email atau password salah" tidak pernah
  // menyebut field tertentu — ia menggambarkan seluruh percobaan terakhir.
  for (const key of pesanForm ?? []) {
    const nilai = (state as Record<string, unknown> | null)?.[key];
    if (typeof nilai === "string" && nilai.length > 0) {
      tulis(key, undefined);
    }
  }

  return (hasil ?? state) as State;
}
