import type { Metadata } from "next";
import Link from "next/link";
import {
  VerifyResult,
  type VerifyStatus,
} from "@/components/features/verify/verify-result";
import { RubrikPanel } from "@/components/features/verify/rubrik-panel";
import { IntegritasPanel } from "@/components/features/verify/integritas-panel";
import type { AttestationPayload } from "@/lib/attestation/sign";
import type { VerifyReason } from "@/lib/attestation/verify";
import { dariKanonik } from "@/lib/attestation/payload";
import { verifikasiSignature } from "@/lib/attestation/key";
import { isExpired } from "@/lib/attestation/token";
import { ambilAttestationPublik } from "@/lib/review/repository";
import {
  integritasSertifikatDb,
  type IntegritasSertifikat,
} from "@/lib/integritas/service";

export const metadata: Metadata = {
  title: "Verifikasi Attestation",
  description:
    "Verifikasi publik attestation Careevo berbasis HMAC-SHA256, tanpa login.",
};

// Endpoint verify membaca baris `attestations` per permintaan. Statusnya bisa
// berubah kapan saja (attestation dapat dicabut), jadi halaman ini **tidak**
// boleh dirender statis: hasil yang di-cache akan menampilkan kredensial yang
// sudah dicabut sebagai masih berlaku.
export const dynamic = "force-dynamic";

type Outcome = {
  status: VerifyStatus;
  payload?: AttestationPayload;
  signature?: string;
  reason?: VerifyReason;
  /**
   * Rincian rubrik dari review yang menerbitkan sertifikat ini. `null` bila
   * review-nya tidak terbaca — panel menampilkan total tanpa rincian.
   */
  rubric?: Record<string, number> | null;
  /**
   * Keadaan integritas **pada saat terbit**. `null` bila barisnya tidak
   * ditemukan (mis. token tidak dikenal) — tidak ada yang bisa dilaporkan.
   */
  integritas?: IntegritasSertifikat | null;
};

/**
 * Verifikasi token publik — **database adalah sumber kebenaran**.
 *
 * Fase 3 memindahkan attestation dari stateless ke tabel `attestations`:
 * token tidak lagi membawa kebenarannya sendiri. Urutannya:
 *
 * 1. Baca baris berdasarkan `public_token`. Tidak ada baris → tidak dikenal.
 * 2. Parse `payload_canonical`; bentuk rusak → tidak valid.
 * 3. Verifikasi ulang HMAC dengan `key_version` yang tercatat (bukan versi
 *    aktif saat ini) supaya attestation lama tetap terverifikasi setelah rotasi.
 * 4. `status` dari database yang menentukan: `revoked` menang atas signature
 *    yang masih cocok, `active` berarti valid.
 *
 * Kedaluwarsa diperiksa dari `issued_at` **pada payload kanonik yang tersimpan**,
 * bukan dari token yang dikirim browser: yang diukur adalah umur kredensial
 * yang benar-benar diterbitkan. Pemeriksaan ini hanya berlaku untuk baris
 * `active`; baris `revoked` sudah final dan tidak boleh disamarkan menjadi
 * "kedaluwarsa" oleh aturan umur. Batas 365 hari tetap dipakai karena belum ada
 * kolom kedaluwarsa di tabel — bila penerbitan ulang diperpanjang, aturan itu
 * pindah ke database.
 */
async function resolveToken(token: string): Promise<Outcome> {
  const baris = await ambilAttestationPublik(token);
  if (!baris) return { status: "invalid", reason: "malformed" };

  const { attestation } = baris;
  const payload = dariKanonik(attestation.payloadCanonical);
  if (!payload) return { status: "invalid", reason: "malformed" };

  const signatureCocok = verifikasiSignature(
    attestation.payloadCanonical,
    attestation.signature,
    attestation.keyVersion,
  );
  if (!signatureCocok) {
    return { status: "invalid", reason: "signature_mismatch" };
  }

  // Rincian hanya dihitung setelah signature terbukti: halaman ini bisa dibuka
  // siapa pun dengan token apa pun, dan token palsu tidak perlu memicu dua
  // pembacaan database tambahan.
  //
  // `issued_at` diambil dari payload kanonik yang tersimpan, bukan dari
  // `attestation.issuedAt` kolom: yang mengikat makna "saat terbit" adalah
  // payload yang ditandatangani, dan kolom bisa saja berbeda bila baris pernah
  // ditulis ulang.
  const saatTerbit = new Date(payload.issued_at);
  const integritas = Number.isFinite(saatTerbit.getTime())
    ? await integritasSertifikatDb(baris.subject.userId, saatTerbit, payload.task_id)
    : null;

  // Signature cocok, jadi payload boleh ditampilkan pada kedua status di bawah.
  // Yang membedakan hanya keputusan penerbit, bukan keaslian tanda tangannya.
  if (attestation.status === "revoked") {
    return {
      status: "revoked",
      payload,
      signature: attestation.signature,
      rubric: baris.rubric,
      integritas,
    };
  }

  if (isExpired(payload)) {
    return {
      status: "expired",
      payload,
      signature: attestation.signature,
      rubric: baris.rubric,
      integritas,
    };
  }

  return {
    status: "valid",
    payload,
    signature: attestation.signature,
    rubric: baris.rubric,
    integritas,
  };
}

export default async function VerifyTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const outcome = await resolveToken(token);

  // Panel rincian hanya bermakna saat payload benar-benar tampil. Status
  // `invalid` tidak punya payload, jadi tidak ada yang bisa dirinci — dan
  // menampilkan panel kosong di bawah pesan "TIDAK VALID" hanya membingungkan.
  const tampilRincian = Boolean(outcome.payload) && outcome.status !== "invalid";

  return (
    <section
      className="section verify-section"
      aria-label="Verifikasi attestation"
    >
      <div className="container section-inner">
        <VerifyResult
          {...outcome}
          // Tombol rincian hanya muncul kalau panelnya memang dirender, dan
          // mengarah ke `id` di halaman yang sama — jadi ia bekerja tanpa
          // JavaScript dan tidak pernah menggulir ke tempat kosong.
          {...(tampilRincian ? { rincianHref: "#verify-rubrik" } : {})}
        />

        {tampilRincian && outcome.payload ? (
          <>
            <nav className="verify-jump" aria-label="Bagian sertifikat">
              <a className="verify-jump-link" href="#verify-rubrik">
                Penilaian
              </a>
              {outcome.integritas ? (
                <a className="verify-jump-link" href="#verify-integritas">
                  Integritas
                </a>
              ) : null}
            </nav>

            <div className="verify-panels">
              <RubrikPanel rubric={outcome.rubric ?? null} total={outcome.payload.score} />
              {outcome.integritas ? (
                <IntegritasPanel integritas={outcome.integritas} />
              ) : null}
              {/*
                Arah tautan hanya satu, dan ini **_bukan_ arah itu.

                Sertifikat ini publik; laporan performa dan catatan integritas butuh
                sesi staf. Menaruh tautan ke sana di sini berarti setiap pembaca
                sertifikat — termasuk Perekrut yang tidak punya akun — mendapat
                pintu ke halaman yang isinya tidak boleh dia lihat. Jadi halaman ini
                menampilkan **id course** sebagai teks, supaya staf bisa mencocokkan
                manual, dan tautan yang dapat diklik hanya ke arah sebaliknya: dari
                laporan staf ke halaman ini.

                `payload.task_id` bukan rahasia: ia sudah tercetak di baris "Task"
                di atas, dan course id bukan data pribadi.
              */}
              <p className="verify-panel-foot verify-idcourse">
                Id course: <span className="font-mono">{outcome.payload.task_id}</span>.
                Laporan performa dan catatan integritas peserta ini hanya bisa
                dibuka oleh tim verifikator.
              </p>
            </div>
          </>
        ) : null}

        <p className="caption verify-demo">
          Uji tautan yang tidak terdaftar:{" "}
          <Link href="/verify/token-tidak-dikenal">token tidak dikenal</Link>
        </p>
      </div>
    </section>
  );
}
