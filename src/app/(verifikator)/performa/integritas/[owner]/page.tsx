import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { PeringatanIntegritas } from "@/components/features/performa/performa-integritas";
import { listEnrollmentStaf, listEventRun } from "@/lib/learning/repository";
import { FormPelanggaran } from "@/components/features/performa/form-pelanggaran";
import { AntrianUsulan } from "@/components/features/performa/antrian-usulan";
import { PanelJejakProses } from "@/components/features/performa/panel-jejak-proses";
import { PanelRingkasTutor } from "@/components/features/performa/panel-ringkas-tutor";
import {
  antrianUsulanDb,
  listSemuaPelanggaran,
  skorIntegritasDb,
} from "@/lib/integritas/service";
import { KATALOG_PELANGGARAN } from "@/lib/integritas/katalog";
import { listSertifikatUserId } from "@/lib/review/service";
import {
  LABEL_KEJADIAN,
  gabungPersetujuan,
  ringkasIntegritasByOwner,
  temuanSesi,
  type RingkasanIntegritas,
} from "@/lib/performa/integritas";
import { barisIntegritas } from "@/lib/performa/ringkasan";
import { BATAS_SINYAL, type AsalSinyal } from "@/lib/learning/sumber-sinyal";
import { listRunStaf } from "@/lib/learning/run-service";
import { sessionRunDariDb } from "@/lib/learning/dashboard";
import { bacaSnapshot } from "@/lib/workspace/jejak-store";
import { hitungJejak, jedaSnapshot } from "@/lib/workspace/proses";
import { bacaTranskrip } from "@/lib/tutor/transkrip";
import { faktaTranskrip } from "@/lib/agents/tutor/fakta";
import { ringkasTutor } from "@/lib/agents/tutor/ringkas";

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

  // Jumlah sinyal per asal, dijumlahkan di seluruh sesi — bukan hanya sesi
  // terbaru. Menjumlahkan per sesi di dalam JSX membuat angka yang sama ditulis
  // ulang per sesi, dan yang dirender cuma sesi pertama: peserta dengan lima
  // sesi akan melihat hitungan yang salah lima kali.
  const perAsal = (Object.keys(BATAS_SINYAL) as AsalSinyal[]).reduce(
    (acc, asal) => {
      acc[asal] = ringkas?.daftar.reduce((n, s) => n + s.perAsal[asal], 0) ?? 0;
      return acc;
    },
    {} as Record<AsalSinyal, number>,
  );
  const asalTerpakai = (Object.keys(perAsal) as AsalSinyal[]).filter((a) => perAsal[a] > 0);

  /**
   * Catatan integritas yang sudah diputuskan, plus skor yang dihasirkan dari
   * sana.
   *
   * `userId` bisa `undefined` bila tidak ada run milik pemilik (halaman sudah
   * `notFound()` di atas kalau begitu, tapi TypeScript tidak mengetahuinya), jadi
   * keduanya dijaga secara terpisah. Membaca `integrity_violations` **hanya**
   * di sini: halaman ini adalah satu-satunya tempat staf melihat dan menulis
   * catatan, dan angka skor di halaman ini berasal dari hitungan yang sama
   * dengan dashboard peserta — bukan hitungan kedua.
   */
  const semuaCatatan = userId ? await listSemuaPelanggaran(userId) : [];
  // Yang di sini **sudah diputuskan**: `active`, `dismissed`, `expunged`.
  // `proposed` dikecualikan karena ia belum keputusan apa pun — barisnya tampil
  // di antrian Usulan di atas, dan menghitungnya di sini akan membuat daftar
  // "keputusan" memuat hal yang belum pernah diputuskan siapa pun.
  const catatan = semuaCatatan.filter((c) => c.status !== "proposed");
  const skor = userId ? await skorIntegritasDb(userId) : null;

  /**
   * Usulan otomatis yang belum diputuskan — antrian Stage 2.
   *
   * Baris `proposed` **tidak** termasuk di atas: `listSemuaPelanggaran` dibaca
   * untuk keputusan yang sudah ada, sedangkan yang di sini justru yang belum.
   * Menggabungkannya akan membuat satu daftar yang mencampur "sudah diputuskan"
   * dengan "menunggu", dan angka jumlah pada `Catatan yang sudah diputuskan`
   * akan memuat usulan mesin yang belum pernah dilihat siapa pun.
   */
  const usulan = userId ? await antrianUsulanDb(userId) : [];

  /**
   * Course yang bisa dipilih di form pencatatan: **hanya** enrollment milik
   * peserta ini. `catatPelanggaranDb` memeriksa kepemilikan enrollment lagi di
   * server, jadi daftar di sini hanya supaya form tidak menawarkan course yang
   * pasti ditolak.
   */
  const opsiCourse = Array.from(
    new Set(
      enrollments
        .filter((b) => b.user.userId === userId)
        .map((b) => b.enrollment.courseId),
    ),
  ).map((courseId) => ({ courseId, slug: null }));

  /**
   * Jejak proses ruang kerja, satu entri per course.
   *
   * Jejak **tidak pernah menurunkan skor**. Ia ditampilkan sebagai fakta
   * pengamatan, di panel tersendiri, supaya tidak tercampur dengan daftar
   * "Catatan yang sudah diputuskan" yang angkanya memang bergerak skor.
   *
   * Kegagalan membaca jejak dilewati, bukan dilempar: file jejak ada di disk
   * terpisah dari database, jadi panel ini tidak boleh menjatuhkan halaman
   * integritas yang isinya sudah benar.
   */
  const jejakPerCourse = new Map<
    string,
    { ringkas: ReturnType<typeof hitungJejak>; jedaTerlama: number | null }
  >();
  if (userId) {
    await Promise.all(
      opsiCourse.map(async ({ courseId }) => {
        try {
          const snapshots = await bacaSnapshot(userId, courseId);
          if (snapshots.length === 0) return;
          const jeda = jedaSnapshot(snapshots);
          jejakPerCourse.set(courseId, {
            ringkas: hitungJejak(snapshots),
            jedaTerlama: jeda.length > 0 ? jeda[0]! : null,
          });
        } catch {
          // Panel menampilkan "belum ada jejak" untuk course ini.
        }
      }),
    );
  }

  /**
   * Transkrip tutor + ringkasannya, untuk **area verifikator saja**.
   *
   * Email diambil dari `target.owner`, bukan dari segmen rute, sehingga
   * panel ini menampilkan sesi milik peserta yang sedang dibuka halaman ini dan
   * bukan milik siapa pun yang kebetulan menulis segmennya.
   *
   * Kegagalan membaca transkrip menghasilkan panel kosong, bukan halaman error:
   * transkrip ditulis aplikasi lain (AI Mastery), jadi bentuknya bukan jaminan
   * dan tidak boleh menjatuhkan laporan integritas.
   */
  /**
 * Sertifikat aktif peserta ini, untuk ditautkan dari laporan.
 *
 * **Arah tautan hanya satu: laporan → sertifikat.** Sertifikatnya yang publik,
 * laporannya yang staf. Menaruh tautan ke laporan di halaman `/verify` akan
 * membuat siapa pun yang memegang token bisa menekan tombol dan mendarat di 307
 * menuju `/masuk` — atau, lebih buruk, kalau gate-nya bergeser, membaca catatan
 * integritas orang lain. Tautan ke depan tidak mungkin membocorkan apa pun.
 *
 * `listSertifikatUserId` memang menerima `userId`: halaman ini sudah dibatasi
 * oleh sesi staf, dan course-nya berasal dari enrollment yang difilter di atas —
 * bukan dari segmen rute.
 */
const sertifikat = userId ? await listSertifikatUserId(userId) : [];

  const sesiTutor = await bacaTranskrip(target.owner);
  const faktaTutor = faktaTranskrip(sesiTutor);
  // Ringkasan hanya meminta model kalau ada yang bisa diringkas. Tanpa
  // transkrip, memanggil model berarti membuang panggilan berbayar untuk
  // menjelaskan tidak ada apa-apa.
  const ringkasanTutor =
    faktaTutor.sesi > 0 ? await ringkasTutor(sesiTutor) : null;

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

        {/*
          Skor kejujuran dibaca **di sini** juga, dari fungsi yang sama dengan
          dashboard peserta. Dua tampilan angka yang sama dari dua hitungan
          berbeda akan menyimpang diam-diam — dan justru两者 yang dipakai
          peserta, jadi perbedaan sekecil apa pun adalah kebohongan.
        */}
        {skor ? (
          <section className="card" aria-labelledby="integritas-skor">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="card-title" id="integritas-skor">
                Skor kejujuran
              </h2>
              <span className="text-2xl font-bold tabular-nums">
                {skor.skor}
                <span className="text-sm font-normal text-muted-foreground">/100</span>
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {skor.jumlahAktif} catatan aktif ·{" "}
              {skor.perCourse.length > 0
                ? skor.perCourse
                    .map((r) => `${r.courseId} −${r.penaltiDiterapkan}`)
                    .join(", ")
                : "tidak ada course yang memotong skor"}
            </p>
          </section>
        ) : null}

        <section className="card" aria-labelledby="integritas-usulan">
          <h2 className="card-title" id="integritas-usulan">
            Usulan otomatis — belum ada yang diputuskan
          </h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Deteksi otomatis menulis usulan setelah sesi terverifikasi ditutup.
            Usulan ini{" "}
            <strong>belum memotong skor</strong> — skornya masih seperti sekarang
            sampai kamu menyetujuinya. Menolak tidak mengubah skor.
          </p>
          {userId ? (
            <AntrianUsulan
              usulan={usulan.map((u) => ({
                id: u.id,
                courseId: u.courseId,
                kind: u.kind,
                penalty: u.penalty,
                reason: u.reason,
                createdAt: u.createdAt,
                evidenceRedacted: u.evidenceRedacted,
                slug: opsiCourse.find((c) => c.courseId === u.courseId)?.slug ?? null,
              }))}
              slug={opsiCourse[0]?.slug ?? null}
            />
          ) : null}
        </section>

        <section className="card" aria-labelledby="performa-sertifikat">
          <h2 className="card-title" id="performa-sertifikat">
            Sertifikat terbit
          </h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Kredensial yang sudah terbit untuk peserta ini, lengkap dengan skor dan
            tanggalnya. Tautan membuka halaman verifikasi publik — halaman yang
            akan dilihat perekrut.
          </p>
          {sertifikat.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada sertifikat aktif. Sertifikat terbit setelah course selesai
              dan karya disetujui.
            </p>
          ) : (
            <ul className="list-app">
              {sertifikat.map((s) => (
                <li className="list-app-row" key={s.token}>
                  <div className="min-w-0">
                    <span className="row-title">{s.judul}</span>
                    <span className="row-meta">
                      Skor {s.score}/100 · {s.level} · {s.track}
                    </span>
                    <span className="row-meta">
                      Terbit {s.terbitPada.slice(0, 10)}
                    </span>
                  </div>
                  <Link
                    href={`/verify/${s.token}`}
                    className="shrink-0 text-sm underline"
                  >
                    Buka halaman verifikasi
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {/*
            Tidak ada tautan dari sertifikat ke halaman ini. Sertifikatnya publik
            dan halaman ini butuh sesi staf, jadi arah sebaliknya hanya
            menghasilkan pintu yang tidak bisa dibuka — atau kebocoran kalau
            gate-nya pernah bergeser.
          */}
        </section>

        <section className="card" aria-labelledby="performa-ringkas-tutor">
          <h2 className="card-title" id="performa-ringkas-tutor">
            Percakapan dengan tutor
          </h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Ringkasan bahasa alami dari percakapan peserta dengan tutor AI.
            <strong> Bukan penilaian</strong> — tidak memotong skor, dan tidak
            pernah jadi dasar keputusan otomatis. Yang tetap berlaku adalah rubrik
            dan catatan yang kamu putuskan sendiri.
          </p>
          <PanelRingkasTutor
            fakta={faktaTutor}
            hasil={ringkasanTutor?.ok ? ringkasanTutor.hasil : null}
            {...(ringkasanTutor && !ringkasanTutor.ok ? { pesanGagal: ringkasanTutor.pesan } : {})}
          />
        </section>

        <section className="card" aria-labelledby="performa-jejak-proses">
          <h2 className="card-title" id="performa-jejak-proses">
            Jejak proses ruang kerja
          </h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Kapan dan seberapa sering berkas berubah di ruang kode.{" "}
            <strong>Jejak ini tidak memotong skor</strong> dan tidak pernah
            otomatis jadi catatan: ia bahan baca, bukan vonis.
          </p>
          {jejakPerCourse.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada jejak proses. Jejak diambil saat ruang kerja peserta dibuka.
            </p>
          ) : (
            <div className="space-y-5">
              {[...jejakPerCourse.entries()].map(([courseId, data]) => (
                <div key={courseId}>
                  <h3 className="text-sm font-semibold">{courseId}</h3>
                  <PanelJejakProses
                    ringkas={data.ringkas}
                    courseId={courseId}
                    jedaTerlama={data.jedaTerlama}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="integritas-catatan">
          <h2 className="card-title" id="integritas-catatan">
            Catatan yang sudah diputuskan
          </h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Yang tampil di sini adalah keputusan manusia, bukan rekaman
            otomatis. Catatan mentah di bawah tetap konteks — tidak ada satu pun
            yang otomatis menurunkan skor.
          </p>
          {catatan.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada catatan untuk peserta ini. Skornya masih 100; itu berarti
              tidak ada yang tercatat, bukan berarti sudah diperiksa semua.
            </p>
          ) : (
            <ul className="list-app">
              {catatan.map((c) => {
                const definisi = KATALOG_PELANGGARAN[c.kind as keyof typeof KATALOG_PELANGGARAN];
                return (
                  <li className="list-app-row" key={c.id}>
                    <div className="min-w-0">
                      <span className="row-title">
                        {definisi?.label ?? c.kind}
                      </span>
                      <span className="row-meta">{c.reason}</span>
                      <span className="row-meta">
                        {c.courseId} · {c.penalty} poin ·{" "}
                        {c.status === "expunged"
                          ? `dipulihkan${c.expungedReason ? `: ${c.expungedReason}` : ""}`
                          : c.status === "dismissed"
                            ? "ditolak"
                            : "berlaku"}{" "}
                        · {c.createdAt.toISOString().slice(0, 10)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {userId ? (
          <section className="card" aria-labelledby="integritas-form">
            <h2 className="card-title" id="integritas-form">
              Catat catatan baru
            </h2>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">
              Menulis di sini akan langsung memotong skor kejujuran peserta di
              dashboard. Besaran penalti ditentukan jenis, bukan pilihanmu.
            </p>
            <FormPelanggaran userId={userId} course={opsiCourse} />
          </section>
        ) : null}

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
            <li className="list-app-row">
              <span className="row-title">Asal sinyal</span>
              <span className="text-xs text-muted-foreground">
                {asalTerpakai.length === 0
                  ? "—"
                  : asalTerpakai.map((asal) => `${perAsal[asal]} ${asal}`).join(" · ")}
              </span>
            </li>
          </ul>
          {/*
            Batas asal hanya untuk asal yang benar-benar muncul: empat baris
            batas untuk empat sumber membuat pembaca mengira semuanya aktif, dan
            itu klaim yang tidak benar untuk peserta yang belum pernah menyalakan
            kamera.
          */}
          {asalTerpakai.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {asalTerpakai.map((asal) => (
                <li key={asal}>
                  <span className="font-medium">{asal}:</span> {BATAS_SINYAL[asal]}
                </li>
              ))}
            </ul>
          ) : null}
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

                    {/*
                      Sinyal mentah sesi ini — **terbuka secara default**.

                      Sebelumnya daftar ini terlipat di balik `details`, jadi
                      laporan hanya memperlihatkan jumlah ("Keluar tab 3×") dan
                      bukti paling rinci justru butuh satu klik untuk dilihat.
                      Laporan integritas ada untuk ditelusuri; menyembunyikan
                      lini masanya membuat kesimpulan tampak tanpa dasar.

                      Labelnya "sinyal", bukan "catatan": yang di sini adalah
                      rekaman mentah peramban/kamera, sedangkan "catatan" di
                      bagian lain berarti keputusan yang sudah ditulis manusia.
                      Menyebut keduanya dengan kata yang sama membuat pembaca
                      mengira sinyal sudah pernah dinilai seseorang.
                    */}
                    {s.catatan.length > 0 ? (
                      <details className="mt-2" open>
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          Sinyal mentah sesi ini ({s.catatan.length}) — belum
                          dinilai siapa pun
                        </summary>
                        <ol className="mt-2 space-y-1">
                          {s.catatan.map((k, i) => (
                            <li key={`${k.at}-${i}`} className="text-xs text-muted-foreground">
                              {k.at} · {LABEL_KEJADIAN[k.jenis]} · {k.jenis_klasifikasi} ·{" "}
                              {k.asal ?? "tidak diketahui"}
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
