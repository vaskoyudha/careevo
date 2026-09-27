"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { jalankanScanAction, type HasilScanAction } from "@/actions/inbox";
import type { InboxJob } from "@/lib/career-ops";
import type { BarisDiaudit } from "@/lib/career-ops";
import { labelSinyal } from "@/lib/agents/sentinel";
import { filterInbox } from "@/lib/jobs/kueri-inbox";
import {
  ComposerCariLowongan,
  KartuLokerInbox,
  DaftarLokerLayarPenuh,
} from "@/components/features/jobs/cari-lowongan-ui";
import { PopupDetailLoker } from "@/components/features/jobs/popup-detail-loker";

/**
 * InboxList — permukaan pencarian lowongan hasil pindai.
 *
 * Di-ported dari career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: career-ops/web/src/components/inbox/triage-row.tsx (baris + `agoLabel`)
 *          dan inbox-triage.tsx (sort/filter state).
 * https://github.com/career-ops-hq/career-ops
 *
 * Yang dipertahankan dari upstream: bentuk `agoLabel` dan ambangnya persis, satu
 * baris = satu posting, dan `- [ ]` pending vs `- [x]` processed dipisah.
 *
 * Delta yang disengaja:
 *   - Halaman ini tidak menampilkan seluruh daftar. `scan.mjs` bisa menemukan
 *     ratusan lowongan, dan menampilkan semuanya sekaligus adalah daftar
 *     yang tidak bisa dibaca — bukan ringkasan. Yang tampil di sini hanya hasil
 *     pencarian; daftar lengkap ada di balik ikon kisi dalam composer.
 *   - Baris 150 chip perusahaan dihapus. Chip itu satu-satunya saringan yang
 *     pernah ada di sini, dan saringan itu menjawab "Amartha" samaunay dengan
 *     mengetik "Amartha" di composer — tapi butuh 150 klik untuk perusahaan mana
 *     pun yang tidak sedang terlihat. Satu kotak pencarian menjawab keduanya.
 *   - Kartu dan composer bergaya kartu chat AI Mastery; lihat
 *     `cari-lowongan-ui.tsx` untuk peminjaman visualnya.
 *   - `useRouter`/`useSearchParams` → state lokal. Upstream menyimpan terpilih di
 *     URL; di Careevo tidak ada yang perlu dibagikan.
 *   - Tanpa multi-select shortlist dan tanpa tombol Skip. Keduanya menulis ke
 *     `pipeline.md`, dan ini fase read-only.
 *   - Copy UI diterjemahkan ke Indonesia; ini perubahan konten, bukan logika.
 *
 * Read-only: satu-satunya aksi adalah membuka lowongan di situs aslinya. Tidak
 * ada yang pernah dikirim otomatis.
 */

type Baris = InboxJob & { firstSeen?: string } & Partial<BarisDiaudit>;

/**
 * What the learner is told about a posting's trustworthiness.
 *
 * The load-bearing case is the third one. "Belum diperiksa" is NOT a warning
 * about the posting — it is an admission that we did not look, and it must never
 * be rendered as "Aman". A row we could not fetch is exactly the row nobody has
 * checked, so showing a green tick there would be the copy lying about the
 * product's own coverage.
 */
function verdictBadge(
  row: Baris,
): { label: string; cls: string; title: string; status?: "clean" | "quarantined" | "rejected" } | null {
  if (!row.audit) return null;
  if (!row.enriched) {
    return {
      label: "Belum diperiksa",
      cls: "verdict-unverified",
      status: "quarantined",
      title: "Data lowongan ini belum bisa diambil dari papan aslinya, jadi belum diverifikasi.",
    };
  }
  if (row.audit.status === "clean") {
    return {
      label: "Aman",
      cls: "verdict-clean",
      status: "clean",
      title: "Tidak ditemukan pola penipuan pada lowongan ini.",
    };
  }
  if (row.audit.status === "quarantined") {
    const flags = row.audit.flags.map(labelSinyal).join(" · ");
    return {
      label: "Perlu ditinjau",
      cls: "verdict-quarantined",
      status: "quarantined",
      title: flags ? `Sinyal: ${flags}` : "Ada sinyal yang perlu diperiksa lebih lanjut.",
    };
  }
  return {
    label: "Ditolak",
    cls: "verdict-rejected",
    status: "rejected",
    title: `Sinyal: ${row.audit.flags.map(labelSinyal).join(" · ")}`,
  };
}

/**
 * Dua kondisi kosong, dan keduanya soal kueri — bukan soal "belum dipindai".
 * Halaman ini menampilkan hasil pencarian saja, jadi "tidak ada lowongan" tanpa
 * kueri berarti memang belum ada yang dipindai, dan dengan kueri berarti kueri
 * itu tidak cocok dengan apa pun. Tanpa kueri, salinan yang menyalahkan filter
 * akan berbohong: tidak ada filter yang berjalan.
 */
const KOSONG_BELUM_PINDAI =
  "Tekan “Pindai lowongan baru” untuk mengambil lowongan dari papan publik KarirHub, Glints, Jobstreet, dan ATS publik.";
const KOSONG_TANPA_KUERI =
  "Tulis di kotak di atas — peran, perusahaan, atau lokasi. Belum ada yang dipindai, jadi belum ada yang bisa dicari.";
const KOSONG_TIDAK_COCOK =
  "Tidak ada lowongan untuk kueri itu. Coba kata lain, atau buka daftar lengkap lewat ikon kisi.";

export function InboxList({ awal, adaRiwayat }: { awal: Baris[]; adaRiwayat: boolean }) {
  const [kueri, setKueri] = useState("");
  const [daftarTerbuka, setDaftarTerbuka] = useState(false);
  const [detail, setDetail] = useState<{
    url: string;
    status?: "clean" | "quarantined" | "rejected";
  } | null>(null);
  const setDetailUrl = (url: string, status?: "clean" | "quarantined" | "rejected") =>
    setDetail({ url, status });
  const [hasil, setHasil] = useState<HasilScanAction | null>(null);
  const [pending, mulai] = useTransition();
  const router = useRouter();

  // Antrean: pending saja, terbaru dulu. Chip perusahaan tidak lagi menyaring —
  // composer-filter yang 그렇게, dan `filterInbox` membaca company-nya.
  const antrean = useMemo(
    () =>
      awal
        // Upstream memisahkan pending dari processed lewat checkbox `- [x]`.
        // Tidak ada aksi di Careevo yang menandai `done` — Skip dan shortlist
        // upstream menulis ke pipeline.md dan keduanya dihapus. Saringan ini
        // tetap perlu karena `pipeline.md` adalah markdown yang bisa diedit
        // tangan: siapa pun yang mencentang `- [x]` di sana berarti "sudah
        // ditangani", dan baris itu bukan lagi antrean yang perlu dilihat.
        .filter((r) => !r.done)
        .sort((a, b) => (b.firstSeen ?? "").localeCompare(a.firstSeen ?? "")),
    [awal],
  );

  const adaKueri = kueri.trim().length > 0;
  const cocok = useMemo(
    () => (adaKueri ? filterInbox(antrean, kueri) : []),
    [antrean, kueri, adaKueri],
  );

  function pindai() {
    setHasil(null);
    mulai(async () => {
      const r = await jalankanScanAction();
      setHasil(r);
      // Muat ulang supaya baris baru dari pipeline.md masuk. `router.refresh()`
      // mengambil ulang server component dan mempertahankan posisi scroll —
      // `location.reload()` juga memuat ulang, tapi membuang posisi scroll dan
      // mengulang setiap aset, jadi keduanya tidak sama.
      if (r.ok && r.ditambah > 0) router.refresh();
    });
  }

  return (
    <div>
      <div className="card-head" style={{ paddingLeft: 0 }}>
        <div>
          <h2 className="card-title">Lowongan ditemukan</h2>
          <p className="card-sub">
            {adaKueri
              ? `${cocok.length} dari ${antrean.length} lowongan cocok`
              : `${antrean.length} lowongan tersedia`}
          </p>
        </div>
        <Button type="button" variant="brand" size="pill-sm" disabled={pending} onClick={pindai}>
          <RefreshCw className={pending ? "animate-spin" : undefined} />
          {pending ? "Memindai…" : "Pindai lowongan baru"}
        </Button>
      </div>

      {hasil ? (
        <div
          className={hasil.ok ? "alert alert-ok" : "alert alert-warn"}
          role="status"
          style={{ marginTop: "0.75rem" }}
        >
          <p style={{ margin: 0 }}>{hasil.pesan}</p>
          {hasil.diagnosa.length > 0 ? (
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem" }}>
              {hasil.diagnosa.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
          {hasil.boardGagal.length > 0 ? (
            <p className="caption muted" style={{ margin: "0.4rem 0 0" }}>
              Papan yang gagal: {hasil.boardGagal.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: "1rem" }}>
        <ComposerCariLowongan
          kueri={kueri}
          onKueri={setKueri}
          onBukaDaftar={() => setDaftarTerbuka(true)}
          jumlahTersedia={antrean.length}
        />
      </div>

      {!adaKueri ? (
        <div style={{ marginTop: "1rem" }}>
          <EmptyState title={adaRiwayat ? "Cari di antara lowongan" : "Belum pernah dipindai"}>
            {adaRiwayat ? KOSONG_TANPA_KUERI : KOSONG_BELUM_PINDAI}
          </EmptyState>
        </div>
      ) : cocok.length === 0 ? (
        <div style={{ marginTop: "1rem" }}>
          <EmptyState title="Tidak ada yang cocok">{KOSONG_TIDAK_COCOK}</EmptyState>
        </div>
      ) : (
        <>
          <p className="caption muted" style={{ marginTop: "0.9rem" }} aria-live="polite">
            <Search className="size-3" aria-hidden /> {cocok.length} lowongan untuk
            &ldquo;{kueri.trim()}&rdquo;
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "0.75rem",
              marginTop: "0.6rem",
            }}
          >
            {cocok.map((r) => (
              <KartuLokerInbox
                key={r.url}
                job={r}
                verdict={verdictBadge(r)}
                onBukaDetail={setDetailUrl}
              />
            ))}
          </div>
        </>
      )}

      {daftarTerbuka ? (
        <DaftarLokerLayarPenuh
          baris={antrean}
          onTutup={() => setDaftarTerbuka(false)}
          renderVerdict={(job) => verdictBadge(job as Baris)}
          kueriAwal={kueri}
          onBukaDetail={setDetailUrl}
        />
      ) : null}

      {detail ? (
        <PopupDetailLoker
          url={detail.url}
          status={detail.status}
          onTutup={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}
