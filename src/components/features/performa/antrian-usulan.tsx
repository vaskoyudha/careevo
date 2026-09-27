"use client";

import { useActionState } from "react";
import {
  konfirmasiUsulanAction,
  tolakUsulanAction,
  type PelanggaranState,
} from "@/actions/integritas";
import { KATALOG_PELANGGARAN } from "@/lib/integritas/katalog";
import { BATAS_SINYAL } from "@/lib/learning/sumber-sinyal";

/**
 * Antrian usulan otomatis — **Stage 2**, panel verifikator.
 *
 * ## Yang dikunci di sini
 *
 * **Hanya manusia yang bisa memotong skor.** Deteksi otomatis hanya menulis baris
 * `proposed`; tombol di bawah inilah satu-satunya jalan yang mengubahnya jadi
 * `active`, dan `active` adalah satu-satunya status yang memotong skor. Kalau
 * Confirm bisa ditekan tanpa membaca bukti, Stage 1 bukan lagi usulan — ia
 * broadband penalti.
 *
 * Karena itu tiap baris menampilkan **buktiMentah** apa adanya: jumlah peristiwa
 * dan peristiwanya, tanpa diringkas jadi "terdeteksi mencurigakan". Verifikator
 * menolak righteous begitu saja kalau tidak bisa melihat apa yang sebenarnya
 * tercatat.
 *
 * **Dua arah, keduanya wajib.** Confirm tanpa alasan yang bisa ditinjau menghasilkan
 * catatan yang tidak bisa diaudit; Reject tanpa alasan berarti staf berikutnya
 * melihat usulan yang sama muncul lagi tanpa tahu pernah ditolak.
 *
 * Bobot yang ditampilkan adalah bobot **usulan** (snapshot saat Stage 1). Kalau
 * katalog berubah sebelum Confirm, bobot yang berlaku tetap yang tampil di sini —
 * supaya angka yang dibaca staf sama dengan angka yang memotong skor.
 */

/** Bentuk yang dikirim server. Field-nya sudah disaring `saringPayloadAudit`. */
export interface BarisUsulan {
  id: string;
  courseId: string;
  /** `kind` dari baris database, bukan istilah katalog `jenis`. */
  kind: string;
  penalty: number;
  reason: string;
  createdAt: Date;
  /**
   * `jsonb` jadi bertipe `unknown` di Drizzle, dan itu jujur: bentuknya bukan
   * jaminan. Dinyipit di bawah, bukan di-cast di halaman server.
   */
  evidenceRedacted: unknown;
  /** Id course untuk `revalidatePath`; `null` kalau slug-nya tidak diketahui. */
  slug: string | null;
}

const STATE_AWAL: PelanggaranState = { ok: false };

/** Bukti jadi peta atau `null`; bentuk lain diperlakukan sebagai "tidak ada bukti". */
function buktiJadiPeta(bukti: unknown): Record<string, unknown> | null {
  if (typeof bukti !== "object" || bukti === null || Array.isArray(bukti)) return null;
  return bukti as Record<string, unknown>;
}

/** Ambil angka dari bukti, kalau ada. Tidak pernah melempar. */
function angkaBukti(bukti: Record<string, unknown> | null, kunci: string): number | null {
  const nilai = bukti?.[kunci];
  return typeof nilai === "number" && Number.isFinite(nilai) ? nilai : null;
}

export function AntrianUsulan({ usulan, slug }: { usulan: BarisUsulan[]; slug: string | null }) {
  const [stateKonfirmasi, aksiKonfirmasi, pendingKonfirmasi] = useActionState(
    konfirmasiUsulanAction,
    STATE_AWAL,
  );
  const [stateTolak, aksiTolak, pendingTolak] = useActionState(tolakUsulanAction, STATE_AWAL);

  if (usulan.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tidak ada usulan otomatis yang menunggu. Usulan muncul setelah sesi
        terverifikasi ditutup dan polanya melewati ambang — dan sampai kamu
        menyetujuinya, skor kejujuran peserta tidak bergerak sama sekali.
      </p>
    );
  }

  return (
    <ul className="list-app">
      {usulan.map((u) => {
        const definisi =
          KATALOG_PELANGGARAN[u.kind as keyof typeof KATALOG_PELANGGARAN];
        const bukti = buktiJadiPeta(u.evidenceRedacted);
        const jumlah = angkaBukti(bukti, "jumlah_peristiwa");
        const panjang = angkaBukti(bukti, "panjang_terpanjang");
        const jenisKejadian = typeof bukti?.jenis_kejadian === "string" ? bukti.jenis_kejadian : null;

        return (
          <li key={u.id} className="list-app-row">
            <div className="min-w-0">
              <span className="row-title">{definisi?.label ?? u.kind}</span>
              <span className="row-meta">{u.reason}</span>
              <span className="row-meta">
                {u.courseId} · {u.penalty} poin · {u.createdAt.toISOString().slice(0, 10)}
              </span>

              {/* Bukti apa adanya, bukan ringkasan. */}
              <span className="row-meta">
                {jenisKejadian ? `Sinyal: ${jenisKejadian}` : null}
                {jumlah !== null ? ` · ${jumlah} peristiwa` : null}
                {panjang !== null ? ` · terpanjang ${panjang} karakter` : null}
              </span>

              {/*
                Batas asal sinyal. "Keluar tab 3×" (dilaporkan peramban) dan
                "wajah kedua 3×" (turunan model) bukan klaim yang setara — teksnya
                sudah dikunci `BATAS_SINYAL` dan `sumber-sinyal.test.ts`, jadi di sini
                hanya dirujuk, tidak ditulis ulang.
              */}
              <span className="row-meta">{BATAS_SINYAL.browser}</span>
            </div>

            <div className="mt-3 space-y-3">
              <form action={aksiKonfirmasi} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="slug" value={slug ?? ""} />
                <button
                  type="submit"
                  disabled={pendingKonfirmasi}
                  className="rounded-full bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00419e] disabled:opacity-60"
                >
                  {pendingKonfirmasi ? "Memproses…" : `Konfirmasi · potong ${u.penalty} poin`}
                </button>
                <span className="text-xs text-muted-foreground">
                  Setuju dengan yang tercatat? Skor akan turun {u.penalty} poin.
                </span>
              </form>

              <form action={aksiTolak} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="slug" value={slug ?? ""} />
                <input
                  type="text"
                  name="alasan"
                  required
                  minLength={10}
                  maxLength={2000}
                  placeholder="Alasan menolak (minimal 10 karakter)"
                  aria-label={`Alasan menolak usulan ${definisi?.label ?? u.kind}`}
                  className="min-w-[16rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={pendingTolak}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {pendingTolak ? "Memproses…" : "Tolak"}
                </button>
                <span className="text-xs text-muted-foreground">
                  Tidak setuju? skor tidak berubah.
                </span>
              </form>

              {stateKonfirmasi.ok ? (
                <p className="text-sm text-emerald-700" role="status">
                  {stateKonfirmasi.message}
                </p>
              ) : null}
              {stateKonfirmasi.error ? (
                <p className="text-sm text-red-700" role="alert">
                  {stateKonfirmasi.error}
                </p>
              ) : null}
              {stateTolak.ok ? (
                <p className="text-sm text-emerald-700" role="status">
                  {stateTolak.message}
                </p>
              ) : null}
              {stateTolak.error ? (
                <p className="text-sm text-red-700" role="alert">
                  {stateTolak.error}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}