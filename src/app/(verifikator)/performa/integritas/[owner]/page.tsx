import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  Award,
  Camera,
  ChartColumn,
  CirclePlus,
  ClipboardCheck,
  Clock,
  FileCode2,
  History,
  Inbox,
  MessagesSquare,
  ShieldCheck,
} from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { CincinSkor } from "@/components/ui/cincin-skor";
import { DaftarFakta, Fakta, Kartu } from "@/components/ui/kartu";
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

/** Label asal sinyal — kata kunci yang sama dengan `BATAS_SINYAL`. */
const LABEL_ASAL: Record<AsalSinyal, string> = {
  browser: "Peramban",
  kamera: "Kamera",
  luar: "Lockdown browser",
  server: "Server",
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
  const asalMaks = Math.max(1, ...Object.values(perAsal));

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
  const ringkasanTutor = faktaTutor.sesi > 0 ? await ringkasTutor(sesiTutor) : null;

  const nadaSkor: "baik" | "netral" | "perhatian" = !skor
    ? "netral"
    : skor.skor >= 90
      ? "baik"
      : skor.skor >= 70
        ? "netral"
        : "perhatian";

  const nadaCincin = skor
    ? skor.skor >= 90
      ? "leaf"
      : skor.skor >= 70
        ? "ocean"
        : "warn"
    : "ocean";

  return (
    <AppShell session={session} current="/performa/integritas">
      <div className="performa-kepala">
        <PageHead
          eyebrow="Area verifikator"
          title={`Integritas — ${target.nama}`}
          lead={target.owner}
          kembali={{ href: "/performa/integritas", label: "Kembali ke daftar integritas" }}
        />
      </div>

      <div className="performa-grid">
        {/*
          Skor kejujuran dibaca **di sini** juga, dari fungsi yang sama dengan
          dashboard peserta. Dua tampilan angka yang sama dari dua hitungan
          berbeda akan menyimpang diam-diam — dan justru yang dipakai peserta,
          jadi perbedaan sekecil apa pun adalah kebohongan.
        */}
        {skor ? (
          <Kartu
            ikon={ShieldCheck}
            judul="Skor kejujuran"
            id="integritas-skor"
            nada={nadaSkor}
            lead="Diturunkan dari catatan yang diputuskan manusia, bukan dari rekaman otomatis."
          >
            <div className="performa-skor">
              <CincinSkor
                nilai={skor.skor}
                label="Skor kejujuran"
                nada={nadaCincin}
                ukuran="lg"
              />
              <DaftarFakta>
                <Fakta label="Catatan aktif">{skor.jumlahAktif}</Fakta>
                <Fakta label="Course memotong">
                  {skor.perCourse.length === 0 ? (
                    <span className="performa-kosong">tidak ada</span>
                  ) : (
                    <span className="performa-chips">
                      {skor.perCourse.map((r) => (
                        <span className="performa-chip" key={r.courseId}>
                          {r.courseId}
                          <b>−{r.penaltiDiterapkan}</b>
                        </span>
                      ))}
                    </span>
                  )}
                </Fakta>
              </DaftarFakta>
            </div>
          </Kartu>
        ) : null}

        <Kartu
          ikon={Inbox}
          judul="Usulan otomatis"
          id="integritas-usulan"
          nada={usulan.length > 0 ? "perhatian" : "netral"}
          lead={
            <>
              Deteksi otomatis menulis usulan setelah sesi terverifikasi ditutup.
              Selama belum kamu putuskan, skor <strong>tidak bergerak</strong>.
            </>
          }
          aksi={
            <span className={`performa-badge${usulan.length > 0 ? " is-aktif" : ""}`}>
              {usulan.length === 0 ? "Tidak ada" : `${usulan.length} menunggu`}
            </span>
          }
        >
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
        </Kartu>

        <Kartu
          ikon={Award}
          judul="Sertifikat terbit"
          id="performa-sertifikat"
          lead="Kredensial yang sudah terbit, lengkap dengan skor dan tanggalnya. Tautan membuka halaman yang akan dilihat perekrut."
          aksi={
            <span className="performa-badge">{sertifikat.length}</span>
          }
        >
          {sertifikat.length === 0 ? (
            <p className="performa-kosong">
              Belum ada sertifikat aktif. Sertifikat terbit setelah course selesai
              dan karya disetujui.
            </p>
          ) : (
            <ul className="performa-daftar">
              {sertifikat.map((s) => (
                <li className="performa-item" key={s.token}>
                  <div className="performa-item-utama">
                    <span className="performa-item-judul">{s.judul}</span>
                    <span className="performa-item-meta">
                      Skor {s.score}/100 · {s.level} · {s.track} · terbit{" "}
                      {s.terbitPada.slice(0, 10)}
                    </span>
                  </div>
                  <Link className="performa-item-aksi" href={`/verify/${s.token}`}>
                    Buka verifikasi
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
        </Kartu>

        <Kartu
          ikon={MessagesSquare}
          judul="Percakapan dengan tutor"
          id="performa-ringkas-tutor"
          lead={
            <>
              Ringkasan bahasa alami dari percakapan peserta. <strong>Bukan
              penilaian</strong> — tidak memotong skor dan tidak pernah jadi dasar
              keputusan otomatis.
            </>
          }
        >
          <PanelRingkasTutor
            fakta={faktaTutor}
            hasil={ringkasanTutor?.ok ? ringkasanTutor.hasil : null}
            {...(ringkasanTutor && !ringkasanTutor.ok ? { pesanGagal: ringkasanTutor.pesan } : {})}
          />
        </Kartu>

        <Kartu
          ikon={FileCode2}
          judul="Jejak proses ruang kerja"
          id="performa-jejak-proses"
          lead={
            <>
              Kapan dan seberapa sering berkas berubah di ruang kode.{" "}
              <strong>Tidak memotong skor</strong> dan tidak pernah otomatis jadi
              catatan: bahan baca, bukan vonis.
            </>
          }
        >
          {jejakPerCourse.size === 0 ? (
            <p className="performa-kosong">
              Belum ada jejak proses. Jejak diambil saat ruang kerja peserta dibuka.
            </p>
          ) : (
            <div className="performa-tumpuk">
              {[...jejakPerCourse.entries()].map(([courseId, data]) => (
                <div key={courseId}>
                  <h3 className="performa-subjudul">{courseId}</h3>
                  <PanelJejakProses
                    ringkas={data.ringkas}
                    courseId={courseId}
                    jedaTerlama={data.jedaTerlama}
                  />
                </div>
              ))}
            </div>
          )}
        </Kartu>

        <Kartu
          ikon={ClipboardCheck}
          judul="Catatan yang sudah diputuskan"
          id="integritas-catatan"
          lead="Keputusan manusia, bukan rekaman otomatis. Tidak ada satu pun yang otomatis menurunkan skor."
          aksi={<span className="performa-badge">{catatan.length}</span>}
        >
          {catatan.length === 0 ? (
            <p className="performa-kosong">
              Belum ada catatan untuk peserta ini. Skornya masih 100; itu berarti
              tidak ada yang tercatat, bukan berarti sudah diperiksa semua.
            </p>
          ) : (
            <ul className="performa-daftar">
              {catatan.map((c) => {
                const definisi =
                  KATALOG_PELANGGARAN[c.kind as keyof typeof KATALOG_PELANGGARAN];
                const statusLabel =
                  c.status === "expunged"
                    ? `dipulihkan${c.expungedReason ? `: ${c.expungedReason}` : ""}`
                    : c.status === "dismissed"
                      ? "ditolak"
                      : "berlaku";
                return (
                  <li className="performa-item" key={c.id}>
                    <span
                      className={`performa-titik performa-titik-${c.status}`}
                      aria-hidden="true"
                    />
                    <div className="performa-item-utama">
                      <span className="performa-item-judul">
                        {definisi?.label ?? c.kind}
                      </span>
                      <span className="performa-item-alasan">{c.reason}</span>
                      <span className="performa-item-meta">
                        {c.courseId} · {c.penalty} poin · {statusLabel} ·{" "}
                        {c.createdAt.toISOString().slice(0, 10)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Kartu>

        <Kartu
          ikon={ChartColumn}
          judul="Ringkasan sesi"
          id="integritas-ringkas"
          lead="Fakta sesi, bukan penilaian. Angka di bawah dihitung dari rekaman yang sama dengan lini masa."
        >
          <DaftarFakta>
            <Fakta label="Sesi tercatat" ikon={History}>
              {target.sesi}
            </Fakta>
            <Fakta label="Kejadian / celah" ikon={Activity}>
              {target.kejadian} / {target.celah}
            </Fakta>
            <Fakta label="Sesi kedaluwarsa" ikon={Clock}>
              {target.kedaluwarsa}
            </Fakta>
            <Fakta label="Persetujuan kamera" ikon={Camera}>
              {izin.label}
            </Fakta>
            <Fakta label="Sinyal kamera" ikon={Camera}>
              {target.kamera === 0 ? "—" : `${target.kamera} sinyal`}
            </Fakta>
          </DaftarFakta>

          <p className="performa-catatan-kecil">{izin.detail}</p>

          {/*
            Batas asal hanya untuk asal yang benar-benar muncul: empat baris
            batas untuk empat sumber membuat pembaca mengira semuanya aktif, dan
            itu klaim yang tidak benar untuk peserta yang belum pernah menyalakan
            kamera. Batangnya memberi proporsi, angkanya tetap angka.
          */}
          {asalTerpakai.length > 0 ? (
            <div className="performa-asal">
              <h3 className="performa-subjudul">Asal sinyal</h3>
              <ul className="performa-asal-daftar">
                {asalTerpakai.map((asal) => (
                  <li
                    className="performa-asal-baris"
                    key={asal}
                    style={{ "--asal-w": `${(perAsal[asal] / asalMaks) * 100}%` } as CSSProperties}
                  >
                    <span className="performa-asal-label">{LABEL_ASAL[asal]}</span>
                    <span className="performa-asal-track">
                      <span className="performa-asal-fill" />
                    </span>
                    <b className="performa-asal-angka">{perAsal[asal]}</b>
                  </li>
                ))}
              </ul>
              <ul className="performa-batas">
                {asalTerpakai.map((asal) => (
                  <li key={asal}>
                    <b>{LABEL_ASAL[asal]}:</b> {BATAS_SINYAL[asal]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Kartu>

        {userId ? (
          <Kartu
            ikon={CirclePlus}
            judul="Catat catatan baru"
            id="integritas-form"
            lead={
              <>
                Menulis di sini <strong>langsung memotong skor</strong> peserta di
                dashboard. Besaran penalti ditentukan jenis, bukan pilihanmu.
              </>
            }
          >
            <FormPelanggaran userId={userId} course={opsiCourse} />
          </Kartu>
        ) : null}

        <Kartu
          ikon={History}
          judul="Riwayat sesi"
          id="integritas-riwayat"
          lead="Lini masa sinyal mentah per sesi. Belum dinilai siapa pun — ini bahan baca."
          aksi={<span className="performa-badge">{ringkas?.daftar.length ?? 0}</span>}
        >
          {ringkas && ringkas.daftar.length > 0 ? (
            <ul className="performa-sesi">
              {ringkas.daftar.map((s) => {
                const run = sesi.find((r) => r.id === s.run_id);
                const temuan = run ? temuanSesi(run) : [];
                return (
                  <li className="performa-sesi-kartu" key={s.run_id}>
                    <div className="performa-sesi-kepala">
                      <span className="performa-sesi-course">{s.course_id}</span>
                      <span className="performa-sesi-meta">
                        {s.status} ·{" "}
                        {s.durasiMenit === null ? "berjalan" : `${s.durasiMenit} menit`}
                      </span>
                    </div>

                    <ul className="performa-temuan">
                      {temuan.map((t) => (
                        <li key={t.kode} className="performa-temuan-baris">
                          <b>{t.label}</b>
                          <span>{t.detail}</span>
                        </li>
                      ))}
                    </ul>

                    {s.perJenis.length > 0 ? (
                      <ul className="performa-chips">
                        {s.perJenis.map((p) => (
                          <li className="performa-chip" key={p.jenis}>
                            {p.label}
                            <b>{p.jumlah}×</b>
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
                    */}
                    {s.catatan.length > 0 ? (
                      <details className="performa-sinyal" open>
                        <summary>
                          Sinyal mentah ({s.catatan.length}) — belum dinilai siapa pun
                        </summary>
                        <ol className="performa-sinyal-daftar">
                          {s.catatan.map((k, i) => (
                            <li key={`${k.at}-${i}`}>
                              <span className="performa-sinyal-waktu">
                                {k.at.slice(11, 16)}
                              </span>
                              <span className="performa-sinyal-nama">
                                {LABEL_KEJADIAN[k.jenis]}
                              </span>
                              <span className="performa-sinyal-tag">
                                {k.jenis_klasifikasi}
                              </span>
                              <span className="performa-sinyal-asal">
                                {k.asal ? LABEL_ASAL[k.asal] : "tidak diketahui"}
                              </span>
                              {k.detail ? (
                                <span className="performa-sinyal-detail">{k.detail}</span>
                              ) : null}
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
            <p className="performa-kosong">Belum ada sesi tercatat.</p>
          )}
        </Kartu>
      </div>
    </AppShell>
  );
}
