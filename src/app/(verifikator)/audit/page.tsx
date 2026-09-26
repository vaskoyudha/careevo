import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { getDb } from "@/lib/db/client";
import { auditEvents } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Audit Log",
};

/** Batas baris yang ditampilkan. Tabel ini append-only dan tumbuh terus. */
const BATAS_BARIS = 200;

/**
 * Waktu audit berupa `timestamptz`.
 *
 * Dirender dengan `timeZone: "UTC"` mengikuti `submission/[id]/page.tsx`: tanpa
 * itu, server yang berada di zona lain akan menampilkan waktu yang berbeda dari
 * yang tertulis di kolom, dan baris audit harus bisa direproduksi apa adanya.
 */
function formatWaktu(nilai: Date): string {
  const tanggal = new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(tanggal);
}

/** Payload sudah disaring `saringPayloadAudit` sebelum insert, jadi tidak ada rahasia di sini. */
function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return "—";
  const teks = JSON.stringify(payload);
  return teks === undefined || teks === "{}" ? "—" : teks;
}

export default async function AuditPage() {
  // Role gate comes from `(verifikator)/layout.tsx`; repeated here so moving the
  // page cannot silently expose the audit trail to any signed-in user.
  const session = await getSession();
  if (!session?.userId) return null;

  const baris = await getDb()
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.id))
    .limit(BATAS_BARIS);

  return (
    <AppShell session={session} current="/audit">
      <PageHead
        eyebrow="Area verifikator"
        title="Audit Log"
        lead="Catatan peristiwa dari tabel audit_events, terbaru lebih dahulu. Payload sudah disaring sebelum ditulis, jadi tidak ada token atau PII mentah di sini."
      />
      <div className="grid-app">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="table-app">
              <thead>
                <tr>
                  <th scope="col">Waktu</th>
                  <th scope="col">Aktor</th>
                  <th scope="col">Aksi</th>
                  <th scope="col">Entitas</th>
                  <th scope="col">Payload</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((entri) => (
                  <tr key={entri.id}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {formatWaktu(entri.createdAt)}
                    </td>
                    <td className="mono" style={{ fontSize: "0.78rem" }}>
                      {entri.actorUserId ?? "sistem"}
                    </td>
                    <td className="mono" style={{ fontSize: "0.78rem" }}>
                      {entri.action}
                    </td>
                    <td>
                      {entri.entityType}
                      <div className="muted" style={{ fontSize: "0.78rem" }}>
                        {entri.entityId}
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: "0.74rem" }}>
                      {formatPayload(entri.payloadRedacted)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {baris.length === 0 ? <p className="muted p-4">Belum ada catatan audit.</p> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
