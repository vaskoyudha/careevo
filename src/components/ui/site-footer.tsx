"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type FooterColumn = {
  heading: string;
  links: { label: ReactNode; href: string }[];
};

const columns: FooterColumn[] = [
  {
    heading: "Perusahaan",
    links: [
      { label: "Tentang Kami", href: "#tentang" },
      { label: "Karir", href: "#karir" },
      { label: "Kontak", href: "/masuk" },
      { label: "Blog", href: "#blog" },
      { label: "Teknologi", href: "#teknologi" },
    ],
  },
  {
    heading: "Produk",
    links: [
      { label: "Manifesto", href: "#tentang" },
      { label: "Loop demo", href: "#loop" },
      { label: "Audit log", href: "/audit" },
      { label: "Fitur Utama", href: "#fitur" },
      { label: "Harga", href: "#harga" },
    ],
  },
  {
    heading: "Jejak",
    links: [
      { label: "Belajar terukur", href: "#agen" },
      { label: "Lencana & atestasi", href: "#verifikasi" },
      { label: "Loker diaudit", href: "#masalah" },
      { label: "Integrasi", href: "#integrasi" },
      { label: "Dokumentasi API", href: "#api" },
    ],
  },
  {
    heading: "Sumber Daya",
    links: [
      { label: "NextGen Secure", href: "#verifikasi" },
      { label: "Stack teknis", href: "#masalah" },
      { label: "Cara verifikasi", href: "/audit" },
      { label: "Pusat Bantuan", href: "#bantuan" },
      { label: "Komunitas", href: "#komunitas" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Zero-PII", href: "#" },
      { label: "Persetujuan UU PDP", href: "#" },
      { label: "HMAC & audit log", href: "#" },
      { label: "Kebijakan Privasi", href: "/privasi" },
      { label: "Syarat & Ketentuan", href: "/syarat" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-white">
      {/* The wordmark band is its own block at the end (see below), so this
          wrapper only needs ordinary bottom padding. */}
      <div className="relative z-10 w-full border-t border-gray-200 px-6 pt-14 pb-12 sm:px-8 sm:pb-16 lg:px-12">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-12 lg:flex-row">
          
          {/* Left side - Tagline + CTA */}
          <div className="lg:w-4/12">
            {/* Tagline */}
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Jembatan terverifikasi dari course ke pekerjaan pertama. 
              Proses belajar terekam, hasil ditandatangani, loker diaudit.
            </p>
            
            {/* Newsletter Signup */}
            <div className="mb-6">
              <label htmlFor="newsletter" className="block text-xs font-medium text-gray-700 mb-2">
                Berlangganan newsletter
              </label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                {/* `text-base` (16px) is not a style choice: iOS Safari zooms the
                    viewport when a focused input computes under 16px and never
                    zooms back out, so `text-sm` left the page magnified.
                    `min-h-11` lifts the 38px box to the 44px tap floor. */}
                <input
                  type="email"
                  id="newsletter"
                  placeholder="email@contoh.com"
                  className="min-w-0 min-h-11 flex-1 px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <button className="min-h-11 shrink-0 px-4 py-2 text-sm bg-[#0C3D5F] text-white rounded-lg hover:bg-[#0A304A] transition-colors font-medium sm:w-auto">
                  Submit
                </button>
              </div>
            </div>
            
            {/* Social Media Icons */}
            <div className="flex items-center gap-3 mb-4">
              <a href="#" className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-[#0C3D5F] hover:text-white transition-all group">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <a href="#" className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-[#0C3D5F] hover:text-white transition-all group">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3 1.2 2 1.4z"/>
                </svg>
              </a>
              <a href="#" className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-[#0C3D5F] hover:text-white transition-all group">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 11h-6"/>
                  <path d="M18.66 7.34 17.33 8.66a2.5 2.5 0 0 1 .74 1.64l-3.61 3.61a2.5 2.5 0 0 1-1.64.74L9.34 14.66l1.33 1.33a2.5 2.5 0 0 1-.74 1.64l-3.61 3.61a2.5 2.5 0 0 1-1.64.74L2.34 21.66 1 20.33a2.5 2.5 0 0 1 .74-1.64l3.61-3.61a2.5 2.5 0 0 1 1.64-.74L9.34 12.34l-1.33-1.33a2.5 2.5 0 0 1 .74-1.64l3.61-3.61a2.5 2.5 0 0 1 1.64-.74L21.66 2.34 23 3.67a2.5 2.5 0 0 1-.74 1.64l-3.61 3.61a2.5 2.5 0 0 1-1.64.74z"/>
                </svg>
              </a>
              <a href="#" className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-[#0C3D5F] hover:text-white transition-all group">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </a>
              <span className="text-xs text-gray-500 ml-2">Ikuti kami</span>
            </div>
            
            {/* Contact CTA Button */}
            <Link
              href="/masuk"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors"
            >
              Kontak untuk demo
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          {/* Right side - Link columns */}
          <div className="lg:w-8/12">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-6 gap-y-8">
              {columns.map((column) => (
                <div key={column.heading}>
                  <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {column.heading}
                  </h4>
                  <ul className="space-y-3">
                    {column.links.map((link) => (
                      <li key={`${column.heading}-${link.href}-${String(link.label)}`}>
                        <Link
                          href={link.href}
                          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Bottom bar - Copyright & Payment Methods */}
        <div className="mx-auto mt-14 max-w-[1400px] border-t border-gray-200 pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-gray-500">
            <span>
              © 2026 Careevo AI Inc. Seluruh hak cipta dilindungi.
            </span>

            {/* Payment Methods */}
            <div className="flex items-center gap-3">
              <span className="mr-1">Kami menerima:</span>
              <div className="flex items-center gap-2">
                <div className="w-10 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-semibold text-gray-600">Visa</div>
                <div className="w-10 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-semibold text-gray-600">MC</div>
                <div className="w-10 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-semibold text-gray-600">Amex</div>
                <div className="w-10 h-6 bg-gray-100 rounded flex items-center justify-center text-xs font-semibold text-gray-600">PP</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <a href="/privasi" className="hover:text-gray-900 transition-colors">Kebijakan Privasi</a>
              <a href="/syarat" className="hover:text-gray-900 transition-colors">Syarat &amp; Ketentuan</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Pengaturan Cookie</a>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Giant wordmark band — the closing statement of the footer =====

          The logo keeps its own colors on the white surface: no gradient and
          no `brightness-0 invert` filter, so what you see here is the real
          asset rather than a recoloured copy of it.

          Centering: the image is `mx-auto` and its own horizontal padding is
          near-symmetric (measured 6px left / 13px right on a 1400px canvas,
          i.e. the ink sits 0.5% right of true center), so plain auto margins
          are accurate to within a few pixels at any size — no nudge needed.

          `aria-hidden` because the brand is already announced by the navbar
          logo link; this is a decorative repeat, and alt text would announce
          "Careevo" twice. */}
      <div className="flex w-full justify-center overflow-hidden bg-white px-6 pb-10 pt-12 sm:px-8 sm:pb-14 sm:pt-16">
        <Image
          src="/careevo-logo-full.png"
          alt=""
          aria-hidden
          width={1400}
          height={455}
          className="block h-auto w-full max-w-4xl select-none"
        />
      </div>
    </footer>
  );
}
