import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Kontrak: **pemicu scan harus selalu bisa dijangkau.**
 *
 * `jalankanScanAction` (`src/actions/inbox.ts`) punya tepat satu pemanggil di
 * seluruh aplikasi — tombol di `inbox-list.tsx`. Tidak ada cron, tidak ada
 * penjadwal, dan tidak ada scan saat halaman dimuat: kalau tombolnya tidak
 * terender, tidak ada satu pun cara memasukkan lowongan baru, dan inbox berhenti
 * bertambah selamanya.
 *
 * Itu bukan hipotesis. Tombolnya pernah diletakkan **di dalam** cabang
 * empty-state:
 *
 *     {kosong ? (!adaRiwayat && antrean.length === 0 ? <tombol/> : ...) : ...}
 *
 * sehingga ia hanya muncul saat inbox kosong **dan** belum pernah ada riwayat
 * scan. Begitu satu scan berhasil (18 baris di `scan-runs.tsv`, 877 baris di
 * `pipeline.md` di data root dev), `adaRiwayat` menjadi `true`, tombolnya hilang,
 * dan fitur itu mati tanpa satu pun error — `typecheck`, `lint`, `vitest`, dan
 * `build` semuanya hijau, karena yang salah adalah *kapan* sebuah elemen
 * dirender, bukan apakah ia ada.
 *
 * Karena tidak ada jsdom di repo ini (lingkungan test `node`, lihat AGENTS.md),
 * pola yang dipakai sama dengan `src/app/chrome-offset.test.ts`: baca sumbernya
 * dan kunci strukturnya. Yang diperiksa adalah bentuk kode, bukan data yang
 * kebetulan sedang ada di disk.
 */

const AKAR = fileURLToPath(new URL("../../../../", import.meta.url));
const BERKAS = join(AKAR, "src/components/features/jobs/inbox-list.tsx");

/** Sumber tanpa komentar: komentar di berkas ini menjelaskan bug-nya, jadi
 *  menguji teks mentah akan gagal justru karena dokumentasinya benar. */
function tanpaKomentar(berkas: string): string {
  return readFileSync(berkas, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const SUMBER = tanpaKomentar(BERKAS);

/**
 * Isi elemen `<KepalaCariLoker … />` — dari tag pembukanya sampai penutupnya.
 *
 * Yang diuji bukan "apakah komponennya dipanggil" (itu tetap benar kalau
 * tombolnya dilepas, `<KepalaCariLoker />`), melainkan **apakah tombolnya ada
 * di dalam `aksi`** — sebab hanya `aksi` yang membuatnya terender tanpa syarat.
 *
 * Penutupnya dicari sebagai baris `/>` yang berdiri sendiri, bukan `/>` pertama:
 * di dalam header ada anak yang self-closing (`<RefreshCw … />`), jadi
 * `indexOf("/>")` berhenti terlalu awal dan memotong tombolnya dari irisan —
 * persis kegagalan yang membuat tes ini sempat hijau pada kode yang salah.
 */
function isiHeader(sumber: string): string {
  const mulai = sumber.indexOf("<KepalaCariLoker");
  if (mulai === -1) return "";
  const sisa = sumber.slice(mulai);
  // `<KepalaCariLoker />` tanpa properti: tidak ada `aksi`, jadi kosong.
  if (/^<KepalaCariLoker\s*\/>/.test(sisa)) return "";
  const akhir = sisa.search(/\n\s*\/>/);
  return akhir === -1 ? sisa : sisa.slice(0, akhir);
}

describe("pemicu scan di inbox loker", () => {
  it("menaruh tombol pindai di dalam `aksi` header, bukan di cabang hasil", () => {
    const header = isiHeader(SUMBER);
    expect(header).toContain("onClick={pindai}");
    expect(header).toContain("Pindai lowongan baru");

    // Header harus berada SEBELUM cabang hasil: kalau ia dipindah ke dalam
    // cabang mana pun, tombolnya kembali bersyarat.
    const kepala = SUMBER.indexOf("<KepalaCariLoker");
    const cabangKosong = SUMBER.indexOf("{kosong ?");
    expect(kepala).toBeGreaterThan(-1);
    expect(cabangKosong).toBeGreaterThan(-1);
    expect(kepala).toBeLessThan(cabangKosong);
  });

  it("mengikat satu tombol ke `jalankanScanAction`, dan tombol itu milik header", () => {
    // Satu aksi, satu tombol. Kalau jumlahnya lebih dari satu, header dan
    // empty-state sama-sama memicunya — dua tombol untuk satu aksi adalah
    // tombol yang cepat atau lambat berbeda perilaku.
    const pemakaian = SUMBER.match(/onClick=\{pindai\}/g) ?? [];
    expect(pemakaian).toHaveLength(1);
    expect(isiHeader(SUMBER)).toContain("onClick={pindai}");
  });

  it("tidak menyembunyikan tombol pindai di dalam cabang empty-state", () => {
    // Cabang empty-state tidak boleh lagi memuat aksi pindai; kalau ia kembali
    // ke sana, tombolnya bersyarat lagi dan bug aslinya kembali.
    const cabangKosong = SUMBER.indexOf("{kosong ?");
    const sesudah = SUMBER.slice(cabangKosong);
    expect(sesudah).not.toContain("onClick={pindai}");
    expect(sesudah).not.toContain("Pindai lowongan baru");
  });

  it("memakai hari lokal untuk label 'baru hari ini', bukan potongan UTC", () => {
    // Kelas bug kedua di halaman yang sama: `toISOString().slice(0, 10)` adalah
    // hari UTC, sedangkan mesin menstempel `first_seen` dengan hari lokal.
    const halaman = tanpaKomentar(
      join(AKAR, "src/app/(app)/loker/inbox/page.tsx"),
    );
    expect(halaman).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/);
    expect(halaman).toContain("kunciHariIni");
  });
});
