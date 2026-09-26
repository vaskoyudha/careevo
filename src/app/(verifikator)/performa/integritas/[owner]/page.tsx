import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { PeringatanIntegritas } from "@/components/features/performa/performa-integritas";
import { listEnrollmentStaf, listEventRun } from "@/lib/learning/repository";
import {
  LABEL_KEJADIAN,
  gabungPersetujuan,
  ringkasIntegritasByOwner,
  temuanSesi,
  type RingkasanIntegritas,
} from "@/lib/performa/integritas";
import { barisIntegritas } from "@/lib/performa/ringkasan";
import { listRunStaf } from "@/lib/learning/run-service";
import { sessionRunDariDb } from "@/lib/learning/dashboard";

export const metadata: Metadata = {
  title: "Detail Integritas",
};

export default async function IntegritasDetailPage({
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
  const kunci = owner.trim().toLowerCase();

  const [runs, enrollments] = await Promise.all([listRunStaf(), listEnrollmentStaf()]);
  const namaPerUser = new Map(enrollments.map((b) => [b.user.userId, b.user.nama]));
  const emailPerUser = new Map(enrollments.map((b) => [b.user.userId, b.user.email]));

  // Run milik peserta ini: pemiliknya `users.id`, sedangkan segmen rute adalah
  // email — jadi kecocokannya lewat peta email → userId dari `users`.
  const runsPeserta = runs.filter((run) => (emailPerUser.get(run.userId) ?? "") === kunci);
  const sesi = await Promise.all(
    runsPeserta.map(async (run) => sessionRunDariDb(run, await listEventRun(run.id))),
  );

  const userId = runsPeserta[0]?.userId;
  // Owner yang ditampilkan adalah email — sama dengan yang ditautkan laporan
  // daftar, sehingga halaman ini bisa dibuka dari sana. Ringkasan sesi
  // dikelompokkan ulang ke email karena `SessionRun.owner` berisi `users.id`.
  const emailPemilik = (userId && emailPerUser.get(userId)) || owner;
  const namaPemilik = (userId && namaPerUser.get(userId)) || owner;

  const ringkasan = new Map<string, RingkasanIntegritas>();
  for (const [pemilik, isi] of ringkasIntegritasByOwner(sesi)) {
    ringkasan.set(emailPerUser.get(pemilik) ?? pemilik, isi);
  }

  const baris = barisIntegritas(new Map([[emailPemilik, namaPemilik]]), ringkasan);
  const target = baris.find((b) => b.owner === emailPemilik);
  // 404 kalau tidak ada satu pun sesi. Halaman ini melaporkan tentang sesi, jadi
  // pemilik tanpa sesi tidak punya apa yang bisa ditampilkan di sini.
  if (!target) notFound();

  const ringkas = ringkasan.get(emailPemilik);
  const daftarPersetujuan = (ringkas?.daftar ?? []).map((s) => s.persetujuan);
  const izin = gabungPersetujuan(daftarPersetujuan);

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
              <span className="row-title">Persetujuan kamera</span>
              <span className="text-xs text-muted-foreground">
                {izin.label} — {izin.detail}
              </span>
            </li>
          </ul>
        </section>

        <section className="card" aria-labelledby="integritas-riwayat">
          <h2 className="card-title" id="integritas-riwayat">
            Riwayat sesi
          </h2>
          {ringkas && ringkas.daftar.length > 0 ? (
            <ul className="space-y-4">
              {ringkas.daftar.map((s) => {
                const run = sesi.find((r) => r.id === s.run_id);
                const temuan = run ? temuanSesi(run) : [];
                return (
                  <li key={s.run_id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{s.course_id}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.status} ·{" "}
                        {s.durasiMenit === null
                          ? "berjalan"
                          : `${s.durasiMenit} menit`}{" "}
                        · {s.mulai_at}
                      </span>
                    </div>

                    <ul className="mt-2 space-y-1">
                      <li className="text-sm">
                        <span className="font-medium">Persetujuan kamera:</span>{" "}
                        <span className="text-muted-foreground">
                          {s.persetujuan.label} — {s.persetujuan.detail}
                        </span>
                      </li>
                      <li className="text-sm">
                        <span className="font-medium">Ditutup peserta:</span>{" "}
                        <span className="text-muted-foreground">
                          {s.ditutupPeserta
                            ? "ya, sesi ditutup sendiri"
                            : "tidak, berakhir sendiri lewat batas waktu"}
                        </span>
                      </li>
                    </ul>

                    {temuan.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {temuan.map((t) => (
                          <li key={t.kode} className="text-sm">
                            <span className="font-medium">{t.label}</span>{" "}
                            <span className="text-muted-foreground">{t.detail}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {s.perJenis.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {s.perJenis.map((p) => (
                          <li
                            key={p.jenis}
                            className="rounded-full border border-border px-2 py-0.5 text-xs"
                          >
                            {p.label} {p.jumlah}×
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {s.catatan.length > 0 ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          Lihat {s.catatan.length} catatan
                        </summary>
                        <ol className="mt-2 space-y-1">
                          {s.catatan.map((k, i) => (
                            <li key={`${k.at}-${i}`} className="text-xs text-muted-foreground">
                              {k.at} · {LABEL_KEJADIAN[k.jenis]} · {k.jenis_klasifikasi}
                              {k.detail ? ` · ${k.detail}` : ""}
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada sesi tercatat.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
