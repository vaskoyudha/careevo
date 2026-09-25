import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { PeringatanPembelajaran } from "@/components/features/performa/performa-belajar";
import { LABEL_SUMBER, bacaPerforma } from "@/lib/performa/store";

export const metadata: Metadata = {
  title: "Detail Belajar",
};

export default async function PerformaDetailPage({
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
  const record = await bacaPerforma(owner);
  if (!record) notFound();

  return (
    <AppShell session={session} current="/performa">
      <PageHead
        eyebrow="Area verifikator"
        title={record.nama}
        lead={record.owner}
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="underline" href="/performa">
              Kembali ke daftar
            </Link>
            {/* Pintu ke laporan lain, bukan datanya: halaman ini sengaja tidak
                memuat satu pun catatan integritas. */}
            <Link className="underline" href={`/performa/integritas/${encodeURIComponent(record.owner)}`}>
              Lihat integritas
            </Link>
          </div>
        }
      />

      <div className="space-y-4">
        <PeringatanPembelajaran />

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
                        selesai {LABEL_SUMBER[s.sumber]} · {s.at}
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
      </div>
    </AppShell>
  );
}
