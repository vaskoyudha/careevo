import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { PeringatanLaporan } from "@/components/features/performa/performa-tabel";
import { bacaPerforma } from "@/lib/performa/store";
import { ringkasIntegritasByOwner } from "@/lib/performa/integritas";
import { listRun } from "@/lib/learning/session";

export const metadata: Metadata = {
  title: "Detail Performa",
};

export default async function PerformaDetailPage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { owner } = await params;
  const [record, runs] = await Promise.all([bacaPerforma(owner), listRun()]);
  if (!record) notFound();

  const daftarSesi =
    ringkasIntegritasByOwner(runs.filter((r) => r.owner === record.owner)).get(record.owner)
      ?.daftar ?? [];

  return (
    <AppShell session={session} current="/performa">
      <PageHead
        eyebrow="Area verifikator"
        title={record.nama}
        lead={record.owner}
        actions={
          <Link className="text-sm underline" href="/performa">
            Kembali ke daftar
          </Link>
        }
      />

      <div className="space-y-4">
        <PeringatanLaporan />

        <section className="card" aria-labelledby="performa-kursus">
          <h2 className="card-title" id="performa-kursus">
            Progres &amp; kuis
          </h2>
          {record.kursus.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada course yang tercatat.</p>
          ) : (
            record.kursus.map((kursus) => (
              <div key={kursus.course_id} className="mt-4">
                <h3 className="text-sm font-semibold">{kursus.judul}</h3>
                <ul className="list-app mt-2">
                  {kursus.selesai.map((s) => (
                    <li className="list-app-row" key={s.modul_id}>
                      <span className="row-title">{s.modul_id}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.sumber} · {s.at}
                      </span>
                    </li>
                  ))}
                  {kursus.kuis.map((q) => (
                    <li className="list-app-row" key={`${q.kuis_id}-${q.at}`}>
                      <span className="row-title">
                        {q.kuis_id} — {q.nilai}/100
                      </span>
                      <span className="text-xs text-muted-foreground">
                        dilaporkan klien · {q.total_soal} soal · {q.at}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <section className="card" aria-labelledby="performa-sesi">
          <h2 className="card-title" id="performa-sesi">
            Riwayat sesi
          </h2>
          {daftarSesi.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada sesi tercatat.</p>
          ) : (
            <ul className="list-app">
              {daftarSesi.map((s) => (
                <li className="list-app-row" key={s.run_id}>
                  <span className="row-title">{s.course_id}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.status} · {s.kejadian} kejadian · {s.celah} celah · {s.mulai_at}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
