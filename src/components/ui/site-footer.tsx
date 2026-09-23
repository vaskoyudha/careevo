import Link from "next/link";
import type { ReactNode } from "react";

type FooterColumn = {
  heading: string;
  links: { label: ReactNode; href: string }[];
};

const columns: FooterColumn[] = [
  {
    heading: "Produk",
    links: [
      { label: "Manifesto", href: "#tentang" },
      { label: "Loop demo", href: "#loop" },
      { label: "Audit log", href: "/audit" },
    ],
  },
  {
    heading: "Track",
    links: [
      { label: "Belajar terukur", href: "#agen" },
      { label: "Badge & attestation", href: "#verifikasi" },
      { label: "Loker diaudit", href: "#masalah" },
    ],
  },
  {
    heading: "Sumber Daya",
    links: [
      { label: "NextGen Secure", href: "#verifikasi" },
      { label: "Stack teknis", href: "#masalah" },
      { label: "Cara verify", href: "/audit" },
    ],
  },
  {
    heading: "Akun",
    links: [
      { label: "Masuk", href: "/masuk" },
      { label: "Daftar", href: "/daftar" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Zero-PII", href: "#" },
      { label: "UU PDP consent", href: "#" },
      { label: "HMAC & audit", href: "#" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          {columns.map((column) => (
            <div key={column.heading}>
              <h4>{column.heading}</h4>
              <ul>
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.href}-${String(link.label)}`}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2026 Careevo. mockup landing proposal (Bab II).</span>
          <span>Attestation HMAC-SHA256 · Trusted Web</span>
        </div>
      </div>
    </footer>
  );
}
