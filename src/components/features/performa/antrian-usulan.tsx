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
      <p className="performa-kosong">
        Tidak ada usulan otomatis yang menunggu. Usulan muncul setelah sesi
        terverifikasi ditutup dan polanya melewati ambang — dan sampai kamu
        menyetujuinya, skor kejujuran peserta tidak bergerak sama sekali.
      </p>
    );
  }

  return (
    <ul className="usulan-daftar">
      {usulan.map((u) => {
        const definisi =
          KATALOG_PELANGGARAN[u.kind as keyof typeof KATALOG_PELANGGARAN];
        const bukti = buktiJadiPeta(u.evidenceRedacted);
        const jumlah = angkaBukti(bukti, "jumlah_peristiwa");
        const panjang = angkaBukti(bukti, "panjang_terpanjang");
        const jenisKejadian = typeof bukti?.jenis_kejadian === "string" ? bukti.jenis_kejadian : null;

        return (
          <li key={u.id} className="usulan-kartu">
            <div className="usulan-kepala">
              <div className="usulan-judul-wrap">
                <h3 className="usulan-judul">{definisi?.label ?? u.kind}</h3>
                <p className="usulan-alasan">{u.reason}</p>
              </div>
              <span className="usulan-bobot">
                {u.penalty}
                <small>poin</small>
              </span>
            </div>

            {/*
              Bukti apa adanya, bukan ringkasan. Kalau Confirm bisa ditekan tanpa
              membaca bukti, Stage 1 bukan lagi usulan — ia broadband penalti.
              Tiap angka diberi label sendiri supaya tidak perlu diurai dari satu
              kalimat panjang.
            */}
            <dl className="usulan-bukti">
              <div className="usulan-bukti-sel">
                <dt>Jenis sinyal</dt>
                <dd>{jenisKejadian ?? "—"}</dd>
              </div>
              <div className="usulan-bukti-sel">
                <dt>Peristiwa</dt>
                <dd>{jumlah ?? "—"}</dd>
              </div>
              <div className="usulan-bukti-sel">
                <dt>Terpanjang</dt>
                <dd>{panjang !== null ? `${panjang} karakter` : "—"}</dd>
              </div>
              <div className="usulan-bukti-sel">
                <dt>Course</dt>
                <dd>{u.courseId}</dd>
              </div>
            </dl>

            <p className="usulan-foot">
              {BATAS_SINYAL.browser}
              {" · tercatat "}
              {u.createdAt.toISOString().slice(0, 10)}
            </p>

            {/*
              Dua form, dua baris, tidak pernah berdampingan di satu baris:
              memasukkan input teks dan dua tombol ke satu baris membuat
              keputusan yang berbeda tampak seperti satu keputusan.
            */}
            <div className="usulan-aksi">
              <form action={aksiKonfirmasi} className="usulan-form">
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="slug" value={slug ?? ""} />
                <button type="submit" disabled={pendingKonfirmasi} className="usulan-btn-ya">
                  {pendingKonfirmasi ? "Memproses…" : `Konfirmasi · potong ${u.penalty} poin`}
                </button>
                <span className="usulan-hint">Skor akan turun {u.penalty} poin.</span>
              </form>

              <form action={aksiTolak} className="usulan-form">
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
                  className="usulan-input"
                />
                <button type="submit" disabled={pendingTolak} className="usulan-btn-tidak">
                  {pendingTolak ? "Memproses…" : "Tolak"}
                </button>
                <span className="usulan-hint">Skor tidak berubah.</span>
              </form>

              {stateKonfirmasi.ok ? (
                <p className="usulan-pesan is-ok" role="status">
                  {stateKonfirmasi.message}
                </p>
              ) : null}
              {stateKonfirmasi.error ? (
                <p className="usulan-pesan is-galat" role="alert">
                  {stateKonfirmasi.error}
                </p>
              ) : null}
              {stateTolak.ok ? (
                <p className="usulan-pesan is-ok" role="status">
                  {stateTolak.message}
                </p>
              ) : null}
              {stateTolak.error ? (
                <p className="usulan-pesan is-galat" role="alert">
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