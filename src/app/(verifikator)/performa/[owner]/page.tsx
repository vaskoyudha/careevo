import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { PeringatanPembelajaran } from "@/components/features/performa/performa-belajar";
import { LABEL_JALUR } from "@/lib/performa/jalur-selesai";
import {
  listAttemptSemua,
  listEnrollmentStaf,
  listProgresSemua,
} from "@/lib/learning/repository";
import { detailPembelajaranDariDb } from "@/lib/learning/dashboard";
import { petaKameraMulaiPemilik } from "@/lib/learning/run-service";
import { BATAS_SINYAL } from "@/lib/learning/sumber-sinyal";

export const metadata: Metadata = {
  title: "Detail Belajar",
};

export default async function PerformaDetailPage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const session = await getSession();
  if (!session?.userId) return null;

  const { owner: segmen } = await params;
  // Segmen rute arrives URL-encoded (`%40` untuk `@`); tanpa decode, email
  // pemilik tidak pernah cocok untuk alamat mana pun.
  const owner = decodeURIComponent(segmen);

  const [semua, progress, attempts] = await Promise.all([
    listEnrollmentStaf(),
    listProgresSemua(),
    listAttemptSemua(),
  ]);
  // Segmen rute kini **email** pemilik (`users.email_normalized`), bukan hash
  // berkas lagi. Perbandingannya dinormalkan supaya `ADMIN@…` dan `admin@…`
  // menunjuk peserta yang sama.
  const enrollments = semua.filter(
    (baris) => baris.user.email.trim().toLowerCase() === owner.trim().toLowerCase(),
  );

  // Peta kamera dihitung lewat aksesor sempit, bukan di halaman ini: halaman
  // laporan belajar dijaga agar tidak pernah membaca baris run maupun apa pun
  // yang tercatat pada baris itu (lihat `security.test.ts`).
  // `EnrollmentStaf` sudah membawa `user.userId`, jadi pemilik diambil langsung
  // dari enrollment yang tadi sudah difilter email — tidak perlu mencocokkan
  // email dengan run.
  const petaKamera =
    enrollments.length > 0 ? await petaKameraMulaiPemilik(enrollments[0].user.userId) : new Map<string, boolean>();

  const record = detailPembelajaranDariDb({
    enrollments,
    progress,
    attempts,
    kameraMulai: petaKamera,
  });
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
        {/* Batas asal sinyal ikut tampil di sini karena label jalur di bawah
            menyebut kamera, dan label itu dibaca dari `kamera_mulai` — yang
            dilaporkan peramban peserta, bukan diturunkan model di perangkatnya.
            Karena yang jadi dasar label adalah laporan peserta, **kedua** asal
            itu punya batasnya sendiri di spec P3/§"Batas yang harus tertulis di
            UI" (butir 1 dan 2), jadi keduanya ditulis di sini: menampilkan satu
            saja membiarkan pembaca menyimpulkan asal yang tidak diketahui.
            Baris `informal` tidak memakai peta kamera sama sekali —
            `jalurDariBukti` berhenti lebih dulu untuk completion yang tidak
            eksak `terverifikasi` — jadi tidak ada yang perlu dibatasi untuknya.

            Teksnya bukan kalimat baru: `BATAS_SINYAL` sudah mengunci satu
            batas per asal, dan `sumber-sinyal.test.ts` menjaganya. */}
        <p className="mt-2 text-xs text-muted-foreground">{BATAS_SINYAL.kamera}</p>
        <p className="mt-1 text-xs text-muted-foreground">{BATAS_SINYAL.browser}</p>

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
                        selesai {LABEL_JALUR[s.jalur]} · {s.at}
                      </span>
                    </li>
                  ))}
                  {kursus.kuis.map((q) => (
                    <li className="list-app-row" key={q.attempt_id}>
                      <span className="row-title">
                        {q.kuis_id} — {q.nilai === null ? "belum dinilai" : `${q.nilai}/100`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        dinilai server · {q.at}
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
