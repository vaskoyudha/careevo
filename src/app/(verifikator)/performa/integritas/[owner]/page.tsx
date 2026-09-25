import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { PeringatanIntegritas } from "@/components/features/performa/performa-integritas";
import { bacaPerforma } from "@/lib/performa/store";
import { ringkasIntegritasByOwner } from "@/lib/performa/integritas";
import { barisIntegritas } from "@/lib/performa/ringkasan";
import { listRun } from "@/lib/learning/session";

export const metadata: Metadata = {
  title: "Detail Integritas",
};

export default async function IntegritasDetailPage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { owner: segmen } = await params;
  // Segmen rute arrives URL-encoded (`%40` untuk `@`); tanpa decode, hash berkas
  // tidak pernah cocok untuk email mana pun.
  const owner = decodeURIComponent(segmen);

  const [catatan, runs] = await Promise.all([bacaPerforma(owner), listRun()]);
  // `barisIntegritas` menggabungkan catatan dan run, jadi pemilik yang hanya
  // punya sesi — tanpa satu pun modul selesai — tetap punya baris. Kalau dia
  // tidak ada di salah satu pun, `find` mengembalikan undefined dan 404 benar.
  const baris = barisIntegritas(catatan ? [catatan] : [], ringkasIntegritasByOwner(runs));
  const target = baris.find((b) => b.owner === owner);
  if (!target) notFound();

  const sesi = ringkasIntegritasByOwner(runs.filter((r) => r.owner === owner)).get(owner);

  return (
    <AppShell session={session} current="/performa/integritas">
      <PageHead
        eyebrow="Area verifikator"
        title={`Integritas — ${target.nama}`}
        lead={target.owner}
        actions={
          <Link className="text-sm underline" href="/performa/integritas">
            Kembali ke daftar integritas
          </Link>
        }
      />

      <div className="space-y-4">
        <PeringatanIntegritas />

        <section className="card" aria-labelledby="integritas-ringkas">
          <h2 className="card-title" id="integritas-ringkas">
            Ringkasan
          </h2>
          <ul className="list-app">
            <li className="list-app-row">
              <span className="row-title">Sesi tercatat</span>
              <span className="text-xs text-muted-foreground">{target.sesi}</span>
            </li>
            <li className="list-app-row">
              <span className="row-title">Kejadian / celah</span>
              <span className="text-xs text-muted-foreground">
                {target.kejadian} / {target.celah}
              </span>
            </li>
            <li className="list-app-row">
              <span className="row-title">Sesi kedaluwarsa</span>
              <span className="text-xs text-muted-foreground">{target.kedaluwarsa}</span>
            </li>
            <li className="list-app-row">
              <span className="row-title">Modul lewat sesi terverifikasi</span>
              <span className="text-xs text-muted-foreground">
                {target.terverifikasi} / {target.selesai}
              </span>
            </li>
            <li className="list-app-row">
              <span className="row-title">Kamera</span>
              <span className="text-xs text-muted-foreground">
                tidak ada data — belum ada permintaan akses kamera
              </span>
            </li>
          </ul>
        </section>

        <section className="card" aria-labelledby="integritas-riwayat">
          <h2 className="card-title" id="integritas-riwayat">
            Riwayat sesi
          </h2>
          {sesi && sesi.daftar.length > 0 ? (
            <ul className="list-app">
              {sesi.daftar.map((s) => (
                <li className="list-app-row" key={s.run_id}>
                  <span className="row-title">{s.course_id}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.status} · {s.kejadian} kejadian · {s.celah} celah · {s.mulai_at}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada sesi tercatat.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
