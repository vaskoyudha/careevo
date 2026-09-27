"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { jalankanScanAction, type HasilScanAction } from "@/actions/inbox";
import type { InboxJob } from "@/lib/career-ops";
import type { BarisDiaudit } from "@/lib/career-ops";
import { labelSinyal } from "@/lib/agents/sentinel";

/**
 * InboxList — lowongan yang ditemukan scanner, belum dilacak.
 *
 * Di-ported dari career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: career-ops/web/src/components/inbox/triage-row.tsx (row + `agoLabel`)
 *          dan inbox-triage.tsx (sort/filter state).
 * https://github.com/career-ops-hq/career-ops
 *
 * Yang dipertahankan dari upstream: bentuk `agoLabel` dan ambangnya persis, satu
 * baris = satu posting dengan checkbox-style meta baris, dan `- [ ]` pending vs
 * `- [x]` processed dipisah.
 *
 * Delta yang disengaja:
 *   - `useRouter`/`useSearchParams` → state lokal. Upstream menyimpan terpilih di
 *     URL; di Careevo tidak ada yang perlu dibagikan, dan membacanya akan
 *     membuat komponen ini client-only_boundary yang tidak perlu.
 *   - Tanpa multi-select shortlist dan tanpa tombol Skip. Keduanya menulis ke
 *     `pipeline.md`, dan ini fase read-only.
 *   - Tailwind + komponen shadcn upstream → `globals.css` + `@/components/ui/*`.
 *     Menyalin JSX apa adanya akan membawa design system kedua ke repo.
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
function verdictBadge(row: Baris): { label: string; cls: string; title: string } | null {
  if (!row.audit) return null;
  if (!row.enriched) {
    return {
      label: "Belum diperiksa",
      cls: "verdict-unverified",
      title: "Data lowongan ini belum bisa diambil dari papan aslinya, jadi belum diverifikasi.",
    };
  }
  if (row.audit.status === "clean") {
    return {
      label: "Aman",
      cls: "verdict-clean",
      title: "Tidak ditemukan pola penipuan pada lowongan ini.",
    };
  }
  if (row.audit.status === "quarantined") {
    const flags = row.audit.flags.map(labelSinyal).join(" · ");
    return {
      label: "Perlu ditinjau",
      cls: "verdict-quarantined",
      title: flags ? `Sinyal: ${flags}` : "Ada sinyal yang perlu diperiksa lebih lanjut.",
    };
  }
  return {
    label: "Ditolak",
    cls: "verdict-rejected",
    title: `Sinyal: ${row.audit.flags.map(labelSinyal).join(" · ")}`,
  };
}

/**
 * Versi `agoLabel` dari upstream, dengan label alih bahasa. Ambang 1/7/30 hari
 * milik upstream dan sengaja tidak diubah: "2 minggu lalu" untukposting 10 hari
 * adalah membingungkan.
 */
function agoLabel(umur: number | null): string | null {
  if (umur == null) return null;
  if (umur <= 0) return "hari ini";
  if (umur === 1) return "kemarin";
  if (umur < 7) return `${umur} hari lalu`;
  if (umur < 30) return `${Math.floor(umur / 7)} minggu lalu`;
  return `${Math.floor(umur / 30)} bulan lalu`;
}

function umurHari(iso: string | undefined, sekarang: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((sekarang - t) / 86_400_000);
}

const SEMUA = "Semua";

/**
 * The two empty states. The first one deliberately does NOT say the postings
 * were "dilacak" (tracked): nothing on this page marks a posting as handled —
 * upstream's Skip and shortlist wrote to `pipeline.md`, and both were dropped —
 * so blaming tracking would name a step that does not exist here. A scan that
 * adds nothing means the postings were already on the list, or a filter ate
 * them; the scan diagnostics above say which, and `portals.yml` is where to
 * loosen it.
 */
const KOSONG_SUDAH_PINDAI =
  "Pindai lagi tidak menambah apa pun — lowongan yang ditemukan sudah ada di daftar, atau habis karna filter. Longgarkan filter di portals.yml, atau buka lowongan yang ada dan lacak dari situ.";
const KOSONG_BELUM_PINDAI =
  "Tekan “Pindai lowongan baru” untuk mengambil lowongan dari papan publik KarirHub, Glints, Jobstreet, dan ATS publik.";

export function InboxList({ awal, adaRiwayat }: { awal: Baris[]; adaRiwayat: boolean }) {
  const [perusahaan, setPerusahaan] = useState<string>(SEMUA);
  const [hasil, setHasil] = useState<HasilScanAction | null>(null);
  const [pending, mulai] = useTransition();
  const router = useRouter();

  // Satu kali per mount, bukan per render: "hari ini" tidak boleh basi setelah
  // tab terbuka semalaman, tapi juga tidak perlu dihitung ulang tiap ketikan.
  const [sekarang] = useState(() => Date.now());

  const namaPerusahaan = useMemo(
    () =>
      [...new Set(awal.map((r) => r.company).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "id"),
      ),
    [awal],
  );

  const terlihat = useMemo(
    () =>
      awal
        .filter((r) => (perusahaan === SEMUA ? true : r.company === perusahaan))
        // Upstream memisahkan pending dari processed lewat checkbox `- [x]`.
        // Tidak ada aksi di Careevo yang menandai `done` — Skip dan shortlist
        // upstream menulis ke pipeline.md dan keduanya dihapus. Saringan ini
        // tetap perlu karena `pipeline.md` adalah markdown yang bisa diedit
        // tangan: siapa pun yang mencentang `- [x]` di sana berarti "sudah
        // ditangani", dan baris itu bukan lagi antrean yang perlu dilihat.
        .filter((r) => !r.done)
        .sort((a, b) => (b.firstSeen ?? "").localeCompare(a.firstSeen ?? "")),
    [awal, perusahaan],
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
            {terlihat.length} lowongan dari {awal.length} total
          </p>
        </div>
        <Button type="button" variant="ocean" size="sm" disabled={pending} onClick={pindai}>
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

      {namaPerusahaan.length > 1 ? (
        <div className="tag-row">
          {[SEMUA, ...namaPerusahaan].map((c) => (
            <button
              key={c}
              type="button"
              className={`tag ${c === perusahaan ? "is-active" : ""}`}
              aria-pressed={c === perusahaan}
              onClick={() => setPerusahaan(c)}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {terlihat.length === 0 ? (
        <EmptyState title={adaRiwayat ? "Tidak ada lowongan baru" : "Belum pernah dipindai"}>
          {adaRiwayat ? KOSONG_SUDAH_PINDAI : KOSONG_BELUM_PINDAI}
        </EmptyState>
      ) : (
        <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {terlihat.map((r) => {
            const umur = agoLabel(umurHari(r.firstSeen, sekarang));
            const verdict = verdictBadge(r);
            return (
              <li className="list-app-row" key={r.url} data-inbox-row>
                {/* No wrapper element: `.list-app-row` is the grid, and
                    `.row-meta`/`.row-aside` place themselves with
                    `grid-column`. A wrapper <div> here would become the only
                    grid item, the placement would stop applying, and company
                    and role would render glued together on one line. */}
                <span className="row-title">{r.company}</span>
                <span className="row-meta">
                  {r.role}
                  {r.location ? ` · ${r.location}` : ""}
                  {umur ? ` · ${umur}` : ""}
                </span>
                <span className="row-aside">
                  {verdict ? (
                    <span className={`tag ${verdict.cls}`} title={verdict.title}>
                      {verdict.label}
                    </span>
                  ) : null}
                  {r.compensation ? <span className="tag">{r.compensation}</span> : null}
                  <a
                    className="tag"
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Buka lowongan ${r.role} di ${r.company}`}
                  >
                    <ExternalLink className="size-3" />
                    Buka
                  </a>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
