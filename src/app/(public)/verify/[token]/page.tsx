import type { Metadata } from "next";
import Link from "next/link";
import {
  VerifyResult,
  type VerifyStatus,
} from "@/components/features/verify/verify-result";
import type { AttestationPayload } from "@/lib/attestation/sign";
import type { VerifyReason } from "@/lib/attestation/verify";
import { dariKanonik } from "@/lib/attestation/payload";
import { verifikasiSignature } from "@/lib/attestation/key";
import { isExpired } from "@/lib/attestation/token";
import { ambilAttestationPublik } from "@/lib/review/repository";

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

  // Signature cocok, jadi payload boleh ditampilkan pada kedua status di bawah.
  // Yang membedakan hanya keputusan penerbit, bukan keaslian tanda tangannya.
  if (attestation.status === "revoked") {
    return {
      status: "revoked",
      payload,
      signature: attestation.signature,
    };
  }

  if (isExpired(payload)) {
    return {
      status: "expired",
      payload,
      signature: attestation.signature,
    };
  }

  return {
    status: "valid",
    payload,
    signature: attestation.signature,
  };
}

export default async function VerifyTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const outcome = await resolveToken(token);

  return (
    <section
      className="section verify-section"
      aria-label="Verifikasi attestation"
    >
      <div className="container section-inner">
        <VerifyResult {...outcome} />
        <p className="caption verify-demo">
          Uji tautan yang tidak terdaftar:{" "}
          <Link href="/verify/token-tidak-dikenal">token tidak dikenal</Link>
        </p>
      </div>
    </section>
  );
}
