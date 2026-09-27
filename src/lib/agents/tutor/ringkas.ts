import { getLlm } from "@/lib/llm/port";
import { parseJsonMaybeFenced } from "@/lib/llm/json";
import { klasifikasiGagal, type JenisGagal } from "@/lib/llm/gagal";

import { bangunPromptRingkas } from "./prompt";
import { validasiRingkasTutor, type HasilRingkasTutor } from "./skema";
import { faktaTranskrip, type SesiRingkas } from "./fakta";

export { validasiRingkasTutor } from "./skema";
export type { HasilRingkasTutor, PoinRingkas } from "./skema";
export type { FaktaTranskrip, SesiRingkas } from "./fakta";

/**
 * Ringkasan percakapan tutor untuk panel verifikator.
 *
 * Jalur ini tidak bisa diuji oleh `npm run check`: ia butuh model dan transkrip
 * nyata. Yang bisa diuji tanpa keduanya dipisah ke `fakta.ts` dan `skema.ts` —
 * keduanya murni, dan keduanya bagian yang sebenarnya sering salah.
 *
 * Tidak ada skor di sini: ringkasan tidak punya angka yang bisa menggerakkan
 * nilai apa pun. Yang dikembalikan adalah teks untuk dibaca manusia, sesuai
 * batas yang dikunci `AGENTS.md`.
 */

export type HasilRingkasAtauGagal =
  | { ok: true; hasil: HasilRingkasTutor }
  | { ok: false; alasan: JenisGagal; pesan: string; detail?: string };

/**
 * Ringkas transkrip menjadi bahan baca untuk verifikator. Tidak pernah melempar.
 *
 * Transkrip kosong mengembalikan sukses dengan ringkasan kosong, bukan kegagalan:
 * tidak ada yang perlu diringkas, dan pemanggil menampilkan "belum ada
 * percakapan" di kedua kasus.
 */
export async function ringkasTutor(
  sesi: readonly SesiRingkas[],
): Promise<HasilRingkasAtauGagal> {
  const fakta = faktaTranskrip(sesi);
  if (fakta.sesi === 0) {
    return { ok: true, hasil: { ringkasan: "", dipahami: [], kesulitan: [], batas: [] } };
  }

  const llm = getLlm();
  if (!llm.available) {
    return {
      ok: false,
      alasan: "tanpa_kunci",
      pesan:
        "Ringkasan tidak ditampilkan karena belum ada model AI yang dikonfigurasi. " +
        "Fakta interaksi di bawah tetap akurat tanpa model.",
    };
  }

  const hasil = await llm.generate(bangunPromptRingkas(fakta, sesi), {
    json: true,
    temperature: 0.4,
    maxTokens: 2048,
  });
  if (!hasil.ok) return { ok: false, ...klasifikasiGagal(hasil) };

  const parsed = parseJsonMaybeFenced(hasil.text);
  if (parsed === null) {
    return { ok: false, alasan: "hasil_tidak_valid", pesan: "Balasan model bukan JSON." };
  }

  try {
    return { ok: true, hasil: validasiRingkasTutor(parsed) };
  } catch (err) {
    return {
      ok: false,
      alasan: "hasil_tidak_valid",
      pesan: err instanceof Error ? err.message : "Hasil model tidak sesuai skema.",
    };
  }
}