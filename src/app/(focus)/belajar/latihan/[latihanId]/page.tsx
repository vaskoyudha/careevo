import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getLatihan } from "@/lib/latihan/store";
import { isValidSessionId } from "@/lib/tutor/ids";
import { LatihanView } from "@/components/features/latihan/latihan-view";

export const metadata: Metadata = { title: "Latihan Soal" };

/**
 * One quiz.
 *
 * A well-formed id belonging to somebody else is a **404**, never a 403: a 403
 * would confirm the id exists, which is the same leak the file store goes out
 * of its way to prevent.
 */
export default async function LatihanPage({
  params,
}: {
  params: Promise<{ latihanId: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { latihanId } = await params;
  if (!isValidSessionId(latihanId)) notFound();

  const bundle = await getLatihan(session.email, latihanId);
  if (!bundle) notFound();

  return (
    <LatihanView
      latihan={bundle.latihan}
      soal={bundle.soal}
      percobaanAwal={bundle.percobaan}
    />
  );
}
