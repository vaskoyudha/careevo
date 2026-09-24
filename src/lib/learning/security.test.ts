import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pemeriksaan statis: membaca teks sumber, bukan menjalankan action-nya. Tidak
// ada berkas yang ditulis dan tidak ada data yang disentuh — uji ini hanya
// menjaga properti keamanan yang mudah hilang saat kode lain disunting.
const ROOT = path.resolve(__dirname, "../../..");
const BERKAS_LEARNING = path.join(ROOT, "src/actions/learning.ts");

function isiLearning(): string {
  return readFileSync(BERKAS_LEARNING, "utf8");
}

describe("keamanan jalur ujian", () => {
  it("tidak mengirim kunci jawaban dari server actions", () => {
    expect(isiLearning()).not.toContain("jawaban_benar");
  });

  it("setiap server action sesi memeriksa getSession", () => {
    const isi = isiLearning();
    const jumlahGate = (isi.match(/await getSession\(\)/g) ?? []).length;
    expect(jumlahGate).toBeGreaterThanOrEqual(4);
  });

  // Dulu uji ini mematok persis `run.owner !== session.email`, sehingga
  // normalisasi trim/toLowerCase yang wajar saja sudah cukup membuatnya merah
  // tanpa ada kebocoran apa pun. Bentuk di bawah tetap menjaga invariannya —
  // kepemilikan run dibandingkan dengan email sesi, bukan dengan apa pun yang
  // dikirim klien — tanpa mengunci gaya penulisannya.
  it("endpoint kejadian tidak mempercayai owner dari klien", () => {
    const isi = isiLearning();
    expect(isi).toMatch(/run\.owner\s*!==\s*session\.email/);
  });
});
