/**
 * Bentuk ringkasan yang boleh diisi model untuk transkrip tutor — **murni**.
 *
 * ## Kenapa tidak ada satu pun angka skor di sini
 *
 * `AGENTS.md` mengunci dua hal yang keduanya akan dilanggar oleh skema yang punya
 * skor: skor submission dan skor kejujuran tidak boleh dijumlahkan, dan hanya
 * keputusan manusia yang boleh menurunkan skor. Ringkasan ini adalah **bahan
 * baca untuk verifikator**, bukan penilaian — jadi bentuknya sengaja tidak punya
 * field numerik yang bisa dipakai untuk menggerakkan skor. Kalau suatu saat ada
 * yang menambahkan `skor: 0-100` di sini, `ringkas-tutor.test.ts` akan gagal.
 * `skor: 0-100` di sini, `ringkas-tutor.test.ts` akan gagal.
 *
 * Yang ada hanyalah: apa yang dipelajari, apa yang terasa sulit, dan apa yang
 * **tampak** dipahami — dengan `batas` yang menyebut apa yang tidak bisa diketahui
 * dari transkrip saja.
 */

/** Satu hal yang kelihatan dari transkrip. */
export interface PoinRingkas {
  /** Persoalan/topik yang muncul. Boleh beberapa kalimat. */
  teks: string;
  /**
   * Bukti yang membuat poin ini muncul — kutipan pendek atau rujukan giliran.
   *
   * Wajib ada. Poin tanpa bukti adalah kesimpulan yang tidak bisa ditinjau, dan
   * panel ini dibaca orang yang sedang menilai — mereka harus bisa memeriksa
   * sendiri kenapa model menyebut sesuatu.
   */
  bukti: string;
}

export interface HasilRingkasTutor {
  /** Satu kalimat: apa yang dikerjakan peserta bersama tutor. */
  ringkasan: string;
  /** Apa yang tampak dipahami. Bukan penilaian. */
  dipahami: PoinRingkas[];
  /** Apa yang tampak sulit atau diulang. */
  kesulitan: PoinRingkas[];
  /**
   * Apa yang **tidak** bisa diketahui dari transkrip saja.
   *
   * Wajib non-kosong kalau model tidak punya bukti. Panel menampilkan ini apa
   * adanya: ringkasan yang menutup semua celah terlihat lebih yakin daripada yang
   * sebenarnya, dan itu berbahaya di panel yang dibaca saat menilai.
   */
  batas: string[];
}

/** Skema yang disertakan di prompt. */
export const SKEMA_RINGKASAN = `{
  "ringkasan": "<1 kalimat: apa yang dikerjakan peserta bersama tutor>",
  "dipahami": [{ "teks": "<persoalan/topik>", "bukti": "<kutipan singkat dari percakapan>" }],
  "kesulitan": [{ "teks": "<persoalan/topik>", "bukti": "<kutipan singkat dari percakapan>" }],
  "batas": ["<apa yang tidak bisa diketahui dari transkrip ini>"]
}`;

/**
 * Validasi hasil model.
 *
 * **Lempar hanya kalau bentuknya bukan objek.** Everything else is filtered, not
 * rejected: a well-formed response with no usable points is *success with empty
 * lists*, because the deterministic facts (topik, hitungan pesan) stand on their
 * own whether or not the model contributed — reporting a failure there would
 * imply the summary broke when it did not. Same reasoning as
 * `validasiAlasanKursus`.
 *
 * Poin tanpa `bukti` **dibuang**, bukan diterima dengan bukti kosong: ringkasan
 * tanpa bukti adalah klaim yang tidak bisa ditinjau, dan panel ini ada supaya
 * pemeriksa bisa memverifikasinya.
 */
export function validasiRingkasTutor(raw: unknown): HasilRingkasTutor {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Hasil ringkasan bukan objek");
  }
  const obj = raw as Record<string, unknown>;
  return {
    ringkasan: typeof obj.ringkasan === "string" ? obj.ringkasan.trim() : "",
    dipahami: bacaPoin(obj.dipahami),
    kesulitan: bacaPoin(obj.kesulitan),
    batas: bacaTeks(obj.batas),
  };
}

/** Ambil daftar poin, buang yang tidak punya teks **dan** bukti. */
function bacaPoin(nilai: unknown): PoinRingkas[] {
  if (!Array.isArray(nilai)) return [];
  const hasil: PoinRingkas[] = [];
  for (const row of nilai) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const teks = typeof r.teks === "string" ? r.teks.trim() : "";
    const bukti = typeof r.bukti === "string" ? r.bukti.trim() : "";
    if (!teks || !bukti) continue;
    hasil.push({ teks, bukti });
  }
  return hasil;
}

/** Ambil daftar teks, buang yang kosong. */
function bacaTeks(nilai: unknown): string[] {
  if (!Array.isArray(nilai)) return [];
  return nilai
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x !== "");
}