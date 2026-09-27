import { describe, expect, it } from "vitest";
import { sembunyikanGalat } from "./sembunyikan-galat-field";

describe("sembunyikanGalat", () => {
  it("membuang hanya field yang disunting dan mempertahankan yang lain", () => {
    const state = {
      errors: { email: "Email sudah terdaftar", username: "Username sudah dipakai" },
    };

    const hasil = sembunyikanGalat(state, ["errors"], undefined, new Set(["email"]));

    expect(hasil.errors).toEqual({ username: "Username sudah dipakai" });
    // State asli tidak boleh berubah — React membandingkan rujukan state.
    expect(state.errors).toEqual({
      email: "Email sudah terdaftar",
      username: "Username sudah dipakai",
    });
  });

  it("membuang pesan tingkat-form begitu form disunting", () => {
    // Halaman masuk: satu-satunya umpan balik adalah `message`, dan `errors`
    // selalu kosong. Kalau ini tidak ikut hilang, "Email atau password salah"
    // masih menempel saat orang sudah memperbaiki passwordnya.
    const state = { ok: false, message: "Email atau password salah", errors: {} };

    const hasil = sembunyikanGalat(state, ["errors"], ["message"], new Set(["password"]));

    expect(hasil.message).toBeUndefined();
    expect(hasil.ok).toBe(false);
  });

  it("tidak menyentuh apa pun ketika tidak ada field yang disunting", () => {
    const state = { message: "Gagal.", errors: { email: "x" } };

    expect(sembunyikanGalat(state, ["errors"], ["message"], new Set())).toBe(state);
  });

  it("mengembalikan state yang sama kalau field yang disunting tidak punya galat", () => {
    const state = { errors: { email: "Email sudah terdaftar" } };

    expect(sembunyikanGalat(state, ["errors"], undefined, new Set(["password"]))).toBe(state);
  });

  it("memakai peta yang diberikan, bukan setiap key yang berbentuk peta", () => {
    // `values` juga peta string. Menghapus `email` dari sana akan menghapus nilai
    // yang dipakai sebagai `defaultValue`, jadi `values` tidak boleh tersentuh.
    const state = {
      errors: { email: "Email sudah terdaftar" },
      values: { email: "kiral@contoh.test", nama: "Kiral" },
    };

    const hasil = sembunyikanGalat(state, ["errors"], undefined, new Set(["email"]));

    expect(hasil.values).toEqual({ email: "kiral@contoh.test", nama: "Kiral" });
  });

  it("mengembalikan state yang sama kalau tidak ada peta per-field", () => {
    // Tanpa `petaFieldErrors` tidak ada field yang bisa disalahkan; pemanggil
    // yang memutuskan untuk menyembunyikan seluruh hasil.
    const tanpaPeta = { message: "Gagal menyimpan." };

    expect(sembunyikanGalat(tanpaPeta, undefined, undefined, new Set(["email"]))).toBe(
      tanpaPeta,
    );
    // `null` muncul dari state aksi yang belum pernah jalan.
    expect(sembunyikanGalat(null, ["errors"], undefined, new Set(["email"]))).toBeNull();
  });

  it("tetap membuang pesan meski peta per-field tidak ada di state itu", () => {
    // Halaman masuk: `errors` selalu kosong di state-nya, tapi `message` tetap
    // harus hilang saat password disunting.
    const hanyaPesan = { ok: false, message: "Email atau password salah" };

    const hasil = sembunyikanGalat(hanyaPesan, ["errors"], ["message"], new Set(["password"]));

    expect(hasil.message).toBeUndefined();
  });

  it("membuang beberapa field sekaligus", () => {
    const state = {
      fieldErrors: { judul: "minimal 3", ringkasan: "wajib", url: "http saja" },
    };

    const hasil = sembunyikanGalat(
      state,
      ["fieldErrors"],
      undefined,
      new Set(["judul", "url"]),
    );

    expect(hasil.fieldErrors).toEqual({ ringkasan: "wajib" });
  });

  it("membuang pesan yang kosong di tempat, bukan mengarang pesan", () => {
    const kosong = { ok: false, message: "" };

    expect(sembunyikanGalat(kosong, ["errors"], ["message"], new Set(["email"]))).toBe(kosong);
  });
});
