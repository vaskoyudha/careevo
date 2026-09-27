import { SKEMA_RINGKASAN } from "./skema";
import type { FaktaTranskrip, SesiRingkas } from "./fakta";
import { transkripUntukPrompt } from "./fakta";

/**
 * Prompt untuk meringkas percakapan tutor — **murni**, tanpa I/O.
 *
 * ## Tiga aturan yang ditulis ke dalam prompt, bukan hanya ke kode
 *
 * 1. **Setiap poin wajib punya bukti kutipan.** Poin tanpa bukti tidak bisa
 *    ditinjau verifikator, jadi `validasiRingkasTutor` membuangnya. Menyatakan
 *    aturan ini di prompt jauh lebih murah daripada membuang separuh hasil.
 * 2. **`batas` wajib diisi.** Ringkasan yang menutup semua celah terlihat lebih
 *    yakin daripada yang sebenarnya, dan panel ini dibaca saat seseorang menilai.
 * 3. **Dilarang menilai.** Model diminta menyebut apa yang *tampak*, bukan
 *    seberapa baik peserta. Model tidak pernah punya akses ke rekaman di luar
 *    transkrip ini, jadi penilaian dari model adalah tebakan yang terdengar
 *    seperti temuan.
 */

/**
 * Instruksi sistem, berbahasa Indonesia seperti seluruh copy produk.
 */
const INSTRUKSI = `Kamu membantu seorang verifikator membaca rekaman percakapan antara seorang peserta kursus dan tutor AI.

Kamu hanya melihat transkrip. Kamu tidak melihat rekaman kamera, tidak melihat
kode yang ditulis peserta, dan tidak melihat nilai kuis. Jangan menyimpulkan
apa pun di luar transkrip.

Aturan:
- Setiap poin yang kamu tulis HARUS disertai kutipan singkat dari transkrip sebagai bukti. Poin tanpa bukti tidak akan ditampilkan.
- Tulis "tampak dipahami" dan "tampak sulit". Jangan menilai seberapa baik peserta; kamu tidak punya dasar untuk itu.
- Isi "batas" dengan apa yang sebenarnya tidak bisa kamu ketahui dari transkrip ini. Jangan dikosongkan.
- Balas hanya JSON dengan bentuk ini, tanpa teks lain:

${SKEMA_RINGKASAN}`;

/**
 * Susun prompt lengkap.
 *
 * Fakta deterministik ikut dikirimkan **dan** ditulis perintahnya: model cenderung
 * menyimpulkan ulang angka yang sudah dihitung, dan angka yang salah di panel
 * yang sedang dipakai menilai lebih berbahaya daripada ringkasan yang kosong.
 */
export function bangunPromptRingkas(
  fakta: FaktaTranskrip,
  sesi: readonly SesiRingkas[],
): string {
  const faktaBaris = [
    `- Sesi dengan percakapan: ${fakta.sesi}`,
    `- Pesan peserta: ${fakta.pesanPeserta}, pesan tutor: ${fakta.pesanTutor}`,
    `- Topik yang ditanyakan: ${
      fakta.topik.length === 0
        ? "(tidak ada judul sesi)"
        : fakta.topik.map((t) => `"${t.judul}" (${t.sesi}×)`).join(", ")
    }`,
    `- Topik yang ditanyakan lebih dari sekali: ${fakta.topikDiulang}`,
  ].join("\n");

  return [
    INSTRUKSI,
    "",
    "## Fakta yang sudah dihitung",
    "Gunakan angka ini apa adanya. Jangan menghitung ulang.",
    faktaBaris,
    "",
    "## Transkrip",
    transkripUntukPrompt(sesi),
  ].join("\n");
}