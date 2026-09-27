import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Kepala halaman.
 *
 * ## Kenapa "kembali" berupa ikon, bukan teks
 *
 * Diukur dari ruang yang dipakai versus informasi yang diberikannya, tautan
 * "Kembali ke daftar integritas" memakai satu baris penuh untuk menyampaikan hal
 * yang sudah bisa ditebak dari bentuknya. Sebagai ikon, ia memakai sebagian kecil
 * ruang itu dan menyampaikan hal yang sama.
 *
 * Ikonnya duduk **di baris eyebrow**, bukan di barisnya sendiri: baris tersendiri
 * untuk satu ikon hanya memindahkan baris yang dihemat ke tempat lain, jadi
 * jumlah baris di kepala halaman tidak berubah.
 *
 * Tautan ikon **wajib** punya nama yang bisa dibaca: tanpa `aria-label`, pembaca
 * layar hanya mengumumkan "tautan", dan tautan tanpa nama tidak bisa dipakai
 * tanpa melihat. Label yang sama dipasang sebagai `title`, karena ikon tunggal
 * terlihat ambigu bagi pembaca pertama kali.
 *
 * Ukurannya 34px, bukan 44px seperti sasaran sentuh di `DESIGN.md`: kontrol ini
 * hanya muncul di halaman staf yang dipakai di desktop, dan pada 44px ia menjadi
 * blok yang lebih berat daripada judul yang diikutinya. Tautan yang sama tetap
 * bisa dijangkau dari daftar, jadi tidak ada jalur yang hilang di layar kecil.
 */
export function PageHead({
  eyebrow,
  title,
  lead,
  actions,
  kembali,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
  /** Tautan kembali berikon. `label` menjadi nama aksesibilitas dan tooltip. */
  kembali?: { href: string; label: string };
}) {
  const adaBarisAtas = Boolean(eyebrow) || Boolean(kembali);

  return (
    <div className="page-head">
      {adaBarisAtas ? (
        <div className="page-head-atas">
          {kembali ? (
            <Link
              className="page-head-kembali"
              href={kembali.href}
              aria-label={kembali.label}
              title={kembali.label}
            >
              <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
            </Link>
          ) : null}
          {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
        </div>
      ) : null}
      <h1 className="page-title">{title}</h1>
      {lead ? <p className="page-lead">{lead}</p> : null}
      {actions ? <div className="hero-actions" style={{ marginTop: "1rem" }}>{actions}</div> : null}
    </div>
  );
}
