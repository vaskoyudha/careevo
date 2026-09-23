import type { Metadata } from "next";
import Link from "next/link";
import {
  VerifyResult,
  type VerifyStatus,
} from "@/components/features/verify/verify-result";
import type { AttestationPayload } from "@/lib/attestation/sign";
import { verifyPayload, type VerifyReason } from "@/lib/attestation/verify";
import {
  buildToken,
  decodeToken,
  getAttestationSecret,
  isExpired,
  DEMO_ATTESTATION_PAYLOAD,
} from "@/lib/attestation/token";

export const metadata: Metadata = {
  title: "Verifikasi Attestation",
  description:
    "Verifikasi publik attestation Careevo berbasis HMAC-SHA256, tanpa login.",
};

type Outcome = {
  status: VerifyStatus;
  payload?: AttestationPayload;
  signature?: string;
  reason?: VerifyReason;
};

function resolveToken(token: string): Outcome {
  const decoded = decodeToken(token);
  if (!decoded) return { status: "invalid", reason: "malformed" };

  const result = verifyPayload(
    decoded.payload,
    decoded.signature,
    getAttestationSecret(),
  );
  if (!result.valid) {
    return { status: "invalid", reason: result.reason ?? "signature_mismatch" };
  }
  if (isExpired(decoded.payload)) {
    return {
      status: "expired",
      payload: decoded.payload,
      signature: decoded.signature,
    };
  }
  return {
    status: "valid",
    payload: decoded.payload,
    signature: decoded.signature,
  };
}

function tamperOneChar(token: string): string {
  const last = token.slice(-1);
  return token.slice(0, -1) + (last === "A" ? "B" : "A");
}

export default async function VerifyTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const outcome = resolveToken(token);

  const demoToken = buildToken(DEMO_ATTESTATION_PAYLOAD);
  const tamperedToken = tamperOneChar(demoToken);
  const expiredToken = buildToken({
    ...DEMO_ATTESTATION_PAYLOAD,
    issued_at: "2020-01-01T00:00:00.000Z",
  });

  return (
    <section
      className="section verify-section"
      aria-label="Verifikasi attestation"
    >
      <div className="container section-inner">
        <VerifyResult {...outcome} />
        <p className="caption verify-demo">
          Token demo:{" "}
          <Link href={`/verify/${demoToken}`}>valid</Link> {" · "}
          <Link href={`/verify/${tamperedToken}`}>diubah 1 karakter</Link> {" · "}
          <Link href={`/verify/${expiredToken}`}>kedaluwarsa</Link> {" · "}
          <Link href="/verify/token-tidak-dikenal">tidak dikenal</Link>
        </p>
      </div>
    </section>
  );
}
