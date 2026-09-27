import type { Metadata } from "next";
import { getDb } from "@/lib/db/client";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarRow } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ResumeView } from "@/components/features/profile/resume-view";
import { getProfile } from "@/lib/fixtures";
import { ambilResumeByUsername } from "@/lib/resume/store";
import { normalisasiUsername, cariUserByUsername } from "@/lib/auth/identity-repository";
import { listSertifikatUserId } from "@/lib/review/service";
import { skorIntegritasDb } from "@/lib/integritas/service";

export const metadata: Metadata = {
  title: "Profil Publik",
};

export default async function ProfilPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  const profile = getProfile(decoded);
  // A profile saved through the resume editor (file-based) takes precedence;
  // the fixture profile remains for the demo accounts that never edited it.
  const resume = await ambilResumeByUsername(decoded);

  /**
   * Akun database untuk username ini, atau `null`.
   *
   * **Dibaca sebelum penilaian "profil tidak ditemukan", dan ikut ikut dalam
   * penilaian itu.** Ini bukan detail urutan: sebuah akun yang benar — sudah
   * terdaftar, punya skor, punya sertifikat — belum tentu punya profil di
   * `fixtures/profile.json` dan belum tentu pernah menyimpan resume. Kalau
   * `akun` tidak ikut dihitung di sini, early return lebih dulu terjadi dan blok
   * skor/sertifikat **tidak pernah** dirender untuk akun mana pun yang bukan
   * akun demo. `npm run check` dan `build` tetap hijau, karena keduanya tidak
   * merender apa pun.
   */
  const akun = await cariUserUntukProfil(decoded);

  if (!profile && !resume && !akun) {
    return (
      <section className="section" aria-label="Profil tidak ditemukan">
        <div className="container section-inner">
          <EmptyState title={`Profil @${decoded} tidak ditemukan`}>
            Username tidak terdaftar. Profil publik Careevo bersifat read-only dan Zero-PII.
          </EmptyState>
        </div>
      </section>
    );
  }

  const displayName = profile?.display_name || resume?.username || decoded;
  const headline = resume?.headline || "";

  /**
   * Skor kejujuran + sertifikat **asli**, untuk dibaca perekrut.
   *
   * `username` dinormalisasi dengan helper yang sama seperti saat pendaftaran,
   * lalu dipakai mencari `users.username_normalized` — jadi `@Budi` dan `@budi`
   * menemukan akun yang sama, bukan dua orang berbeda.
   *
   * Yang **tidak** terjadi di sini: angka skor dari fixture. Angka itu milik
   * profil fiktif `@budi` di `src/fixtures/profile.json`, dan menampilkannya di
   * halaman yang dibaca perekrut berarti memamerkan angka milik orang lain.
   * Karena itu blok skor di bawah memakai skor integritas nyata, dan blok
   * fixture yang lain dibiarkan apa adanya di luar cakupan perubahan ini.
   *
   * Zero-PII tetap berlaku: skor dan sertifikat bukan data pribadi. Yang
   * ditampilkan persis apa yang sudah ditandatangani dan bisa diverifikasi lewat
   * `/verify/<token>` — tidak ada email, tidak ada alamat.
   *
   * `akun` sudah dibaca di atas (dibutuhkan untuk keputusan "profil tidak
   * ditemukan"); di sini ia hanya dipakai untuk membaca skor dan sertifikat.
   */
  const [skor, sertifikat] = akun
    ? await Promise.all([skorIntegritasDb(akun.id), listSertifikatUserId(akun.id)])
    : [null, []];

  return (
    <section className="section" aria-labelledby="profil-title">
      <div className="container section-inner">
        <p className="section-label">Profil publik</p>
        <div className="card" style={{ marginTop: "0.5rem" }}>
          <div className="card-head">
            <div>
              <h1 className="page-title" id="profil-title" style={{ marginBottom: "0.2rem" }}>
                {displayName}
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                @{profile?.username ?? resume?.username ?? decoded}
                {headline ? ` · ${headline}` : ""}
                {profile ? ` · ${profile.track} · terverifikasi ${profile.verified_at}` : ""}
              </p>
            </div>
            {/*
              Skor yang tampil adalah **skor integritas nyata**, bukan angka dari
              fixture. Angka fixture milik profil fiktif dan tidak pernah dihitung
              dari akun mana pun; memamerkannya di halaman yang dibaca perekrut
              adalah memamerkan angka orang lain. Fallback ke fixture **dihapus**,
              bukan dipertahankan: angka yang benar-benar salah jauh lebih
              berbahaya daripada angka yang tidak tampil. Profil yang hanya ada di
              fixture (tanpa akun) tidak menampilkan blok ini sama sekali.
            */}
            {skor ? (
              <span className="score-hero" title="Skor kejujuran — diturunkan dari catatan integritas yang ditinjau manusia">
                <b>{skor.skor}</b>
                <span>/100</span>
              </span>
            ) : null}
          </div>

          {skor ? (
            <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
              Skor kejujuran, diturunkan dari catatan integritas yang ditinjau
              manusia. Skor penuh bukan jaminan;{kategoriPelanggaranTampil(skor)}{" "}
              Sertifikat di bawah bisa dibuka siapa pun lewat tautan verifikasinya.
            </p>
          ) : null}

          {profile?.scores.map((score) => (
            <BarRow
              key={score.label}
              label={score.label}
              value={score.value}
              max={score.max}
              tone={score.value / score.max >= 0.8 ? "ok" : "warn"}
            />
          ))}

          {resume?.ringkasan ? (
            <p style={{ marginTop: "0.75rem" }}>{resume.ringkasan}</p>
          ) : null}
        </div>

        {/*
          Sertifikat **asli** milik akun ini, hanya yang `active`. Ini yang
          menjawab pertanyaan perekrut yang sebenarnya — "kompetensinya bisa
          dibuktikan?" — karena setiap barisnya punya tautan `/verify/<token>`
          yang tidak butuh login dan ditandatangani HMAC.

          Blok "Badge terverifikasi" di bawahnya (fixture) dibiarkan apa adanya
          supaya daftar tidak berubah dua kali dalam satu perubahan; ia ditandai
          dengan judulnya sendiri dan hanya muncul untuk profil fiktif.
        */}
        {akun ? (
          <section
            className="card"
            style={{ marginTop: "1.25rem" }}
            aria-labelledby="sertifikat-publik-title"
          >
            <div className="card-head">
              <h2 className="card-title" id="sertifikat-publik-title">
                Sertifikat terbit
              </h2>
              <span className="status status-info">read-only</span>
            </div>
            {sertifikat.length === 0 ? (
              <p className="muted">
                Belum ada sertifikat terbit. Sertifikat terbit setelah course
                selesai terverifikasi lalu karya direview verifikator.
              </p>
            ) : (
              <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {sertifikat.map((s) => (
                  <li className="list-app-row" key={s.token}>
                    <a
                      className="row-title"
                      href={`/verify/${s.token}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {s.judul}
                    </a>
                    <span className="row-aside">
                      <span className="mono muted">{s.score}</span>
                      <StatusBadge status="approved" label="HMAC OK" />
                    </span>
                    <span className="row-meta">
                      {s.track} · {s.level} · {s.terbitPada}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {profile ? (
          <div className="grid-2" style={{ marginTop: "1.25rem" }}>
            <section className="card" aria-labelledby="badge-title">
              <div className="card-head">
                <h2 className="card-title" id="badge-title">
                  Badge terverifikasi
                </h2>
              </div>
              <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {profile.badges.map((badge) => (
                  <li className="list-app-row" key={badge.id}>
                    <span className="row-title">{badge.task_title}</span>
                    <span className="row-aside">
                      <span className="mono muted">{badge.score}</span>
                      <StatusBadge status="approved" label="HMAC OK" />
                    </span>
                    <span className="row-meta">
                      {badge.track} · {badge.level} · {badge.issued_at}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card" aria-labelledby="work-title">
              <div className="card-head">
                <h2 className="card-title" id="work-title">
                  Karya
                </h2>
              </div>
              <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {profile.works.map((work) => (
                  <li className="list-app-row" key={work.id}>
                    <a className="row-title" href={work.demo_url} target="_blank" rel="noreferrer">
                      {work.title}
                    </a>
                    <span className="row-aside">
                      <StatusBadge status={work.status} />
                    </span>
                    <span className="row-meta">
                      <a href={work.raw_url} target="_blank" rel="noreferrer">
                        file mentah
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {profile ? (
          <section className="card" style={{ marginTop: "1.25rem" }} aria-labelledby="timeline-title">
            <div className="card-head">
              <h2 className="card-title" id="timeline-title">
                Timeline proses
              </h2>
              <span className="status status-info">read-only</span>
            </div>
            <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {profile.timeline.map((item) => (
                <li className="list-app-row" key={`${item.at}-${item.title}`}>
                  <span className="row-title" style={{ fontSize: "0.92rem" }}>
                    {item.title}
                  </span>
                  <span className="row-aside">
                    <span className="tag">{item.actor}</span>
                  </span>
                  <span className="row-meta">{item.at}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {resume ? (
          <div style={{ marginTop: "1.25rem" }}>
            <ResumeView resume={resume} username={resume.username} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Akun database yang username-nya cocok, atau `null`.
 *
 * Normalisasi memakai helper yang sama seperti saat pendaftaran, jadi URL
 * `@Budi%20Pratama` dan `@budipatama` tidak menjadi dua orang berbeda.
 *
 * Mengembalikan `null` (bukan melempar) penting: profil publik harus tetap
 * terbuka untuk profil yang hanya ada di fixture atau di editor resume. Yang
 * hilang bukan halaman — hanya blok skor dan sertifikat yang butuh akun.
 */
async function cariUserUntukProfil(username: string) {
  return cariUserByUsername(getDb(), normalisasiUsername(username));
}

/**
 * Kalimat pendek yang menjelaskan angka skor ke pembaca profil publik.
 *
 * **Jangan** menuliskan jenis pelanggaran atau jumlah penalti di sini: profil ini
 * dibaca tanpa login, dan rincian per kategori adalah data pribadi. Yang cukup
 * adalah apakah ada catatan yang memotong skor, dan berapa banyak catatannya.
 */
function kategoriPelanggaranTampil(skor: { jumlahAktif: number }): string {
  return skor.jumlahAktif === 0
    ? "tidak ada catatan integritas aktif."
    : `${skor.jumlahAktif} catatan integritas tercatat.`;
}
