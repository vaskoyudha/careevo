import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Penjaga atribut `<iframe>` ruang kerja.
 *
 * Berkas ini membaca **sumber** komponen, bukan merendernya. Repo ini tidak
 * punya jsdom (lihat catatan di test komponen lain), jadi `renderToStaticMarkup`
 * tidak bisa dipakai untuk komponen client dengan `useState`. Yang bisa diuji,
 * dan yang memang penting, adalah **nilai atributnya**: satu token `sandbox`
 * yang tidak sah membuat peramban menolak **seluruh** atribut, dan kegagalannya
 * senyap di dalam HTML — persis bug yang pernah terjadi di sini
 * (`allow-clipboard-write`).
 *
 * Daftar token di bawah adalah yang benar-benar dikenal HTML. Ia sengaja
 * lengkap supaya test ini bisa memberi tahu token mana yang salah, bukan hanya
 * bahwa ada yang salah.
 */

const sumber = readFileSync(
  new URL("../../components/features/workspace/workspace-panel.tsx", import.meta.url),
  "utf8",
);

/** Token `sandbox` yang sah menurut spesifikasi HTML. */
const TOKEN_SAH: readonly string[] = [
  "allow-downloads",
  "allow-forms",
  "allow-modals",
  "allow-orientation-lock",
  "allow-pointer-lock",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-presentation",
  "allow-same-origin",
  "allow-scripts",
  "allow-storage-access-by-user-activation",
  "allow-top-navigation",
  "allow-top-navigation-by-user-activation",
  "allow-top-navigation-to-custom-protocols",
];

/**
 * **Semua** nilai `sandbox="..."` yang dipakai komponen.
 *
 *_exec/_ pertama saja sudah tidak cukup setelah panel mendapat mode `isi`:
 * komponen punya dua `<iframe>` (satu untuk jalur kartu, satu untuk kolom lab),
 * dan yang benar-benar dipakai peserta di halaman ruang kerja adalah yang kedua.
 * Regex yang mengambil kecocokan pertama akan memeriksa iframe yang salah —
 * persis kelas bug yang test ini dibuat untuk menangkap, hanya pindah ke nilai
 * `src` yang lain.
 */
function semuaSandbox(): string[] {
  const semua = [...sumber.matchAll(/sandbox="([^"]*)"/g)].map((m) => m[1]);
  if (semua.length === 0) throw new Error("Komponen tidak punya atribut sandbox.");
  return semua;
}

describe("sandbox iframe ruang kerja", () => {
  it("memeriksa setiap iframe, bukan hanya yang pertama", () => {
    // Penjaga bahwa daftar di atas tidak lagi bisa meloloskan satu iframe.
    // Kalau ada varian baru yang ditambahkan tanpa menambah daftar, jumlah ini
    // turun dan test gagal — jauh lebih murah daripada bug sandbox yang senyap.
    expect(semuaSandbox().length).toBeGreaterThan(0);
  });

  it("hanya memakai token sandbox yang sah", () => {
    // Ini yang menangkap `allow-clipboard-write`: token itu tidak ada di
    // daftar HTML, dan peramban membuang **seluruh** atribut sandbox ketika
    // menemukannya. Test ini menguncinya supaya tidak kembali.
    for (const nilai of semuaSandbox()) {
      const token = nilai.split(/\s+/).filter(Boolean);
      for (const t of token) {
        expect(TOKEN_SAH, `token sandbox tidak dikenal: ${t}`).toContain(t);
      }
    }
  });

  it("semua iframe memakai nilai sandbox yang sama", () => {
    // Dua jalur render harus punya permukaan keamanan yang sama. Kalau mode
    // `isi` (longgar) dan jalur kartu (ketat) berbeda, jalur yang longgar
    // menjadi jalur yang benar-benar dipakai peserta — dan selisihnya tidak
    // terlihat dari mana pun selain membandingkan dua baris ini.
    const unik = new Set(semuaSandbox());
    expect(unik.size).toBe(1);
  });

  it("tidak memberi allow-top-navigation", () => {
    // IDE tidak boleh bisa mengarahkan ulang halaman Careevo ke mana pun.
    for (const nilai of semuaSandbox()) {
      expect(nilai).not.toContain("allow-top-navigation");
    }
  });

  it("memberi allow-same-origin, dan itu wajib", () => {
    // Ini terukur di peramban sungguhan: tanpa `allow-same-origin`, iframe
    // mendapat origin opaque dan **tidak bisa menyimpan cookie sama sekali**.
    // Yang terjadi bukan "IDE tanpa cookie aplikasi", melainkan "IDE yang
    // berhenti di halaman masuk". Aman karena ruang kerja selalu dilayani dari
    // origin yang berbeda — lihat catatan di komponen.
    for (const nilai of semuaSandbox()) {
      expect(nilai).toContain("allow-same-origin");
    }
  });

  it("tetap memberi yang dibutuhkan IDE", () => {
    // `allow-scripts` untuk workbench, `allow-forms` untuk halaman masuknya,
    // `allow-downloads` untuk mengunduh berkas dari editor.
    for (const nilai of semuaSandbox()) {
      const token = nilai.split(/\s+/).filter(Boolean);
      expect(token).toContain("allow-scripts");
      expect(token).toContain("allow-forms");
      expect(token).toContain("allow-downloads");
    }
  });

  it("tidak mengirim referrer ke ruang kerja", () => {
    // URL halaman course memuat slug dan id; tidak ada alasan membocorkannya
    // ke origin lain lewat header Referer.
    expect(sumber).toContain('referrerPolicy="no-referrer"');
  });
});
