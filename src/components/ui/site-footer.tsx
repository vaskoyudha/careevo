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
    heading: "Track",
    links: [
      { label: "Belajar terukur", href: "#agen" },
      { label: "Badge & attestation", href: "#verifikasi" },
      { label: "Loker diaudit", href: "#masalah" },
      { label: "Integrasi", href: "#integrasi" },
      { label: "API Docs", href: "#api" },
    ],
  },
  {
    heading: "Sumber Daya",
    links: [
      { label: "NextGen Secure", href: "#verifikasi" },
      { label: "Stack teknis", href: "#masalah" },
      { label: "Cara verify", href: "/audit" },
      { label: "Pusat Bantuan", href: "#bantuan" },
      { label: "Komunitas", href: "#komunitas" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Zero-PII", href: "#" },
      { label: "UU PDP consent", href: "#" },
      { label: "HMAC & audit", href: "#" },
      { label: "Kebijakan Privasi", href: "/privasi" },
      { label: "Syarat & Ketentuan", href: "/syarat" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative bg-white pb-8 pt-8">
      {/* Full-width white footer - NO side padding */}
      <div className="relative w-full px-6 sm:px-8 lg:px-12 py-14 border-t-2 border-gray-900/10 overflow-hidden flex-none z-0">
        <div className="flex flex-col lg:flex-row gap-12 max-w-[1400px] mx-auto">
          
          {/* Left side - Logo + Tagline + CTA */}
          <div className="lg:w-4/12">
            {/* Logo/Wordmark */}
            <Link href="/" className="inline-block mb-4" aria-label="Careevo">
              <Image
                src="/careevo-logo.png"
                alt="Careevo"
                width={250}
                height={64}
                priority
                className="h-16 w-auto object-contain transition-transform duration-300 hover:scale-105"
              />
            </Link>
            
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
              <div className="flex gap-2">
                <input
                  type="email"
                  id="newsletter"
                  placeholder="email@contoh.com"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <button className="px-4 py-2 text-sm bg-[#0C3D5F] text-white rounded-lg hover:bg-[#0A304A] transition-colors font-medium">
                  Submit
                </button>
              </div>
            </div>
            
            {/* Social Media Icons */}
            <div className="flex items-center gap-3 mb-4">
              <a href="#" className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-[#0C3D5F] hover:text-white transition-all group">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <a href="#" className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-[#0C3D5F] hover:text-white transition-all group">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3 1.2 2 1.4z"/>
                </svg>
              </a>
              <a href="#" className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-[#0C3D5F] hover:text-white transition-all group">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 11h-6"/>
                  <path d="M18.66 7.34 17.33 8.66a2.5 2.5 0 0 1 .74 1.64l-3.61 3.61a2.5 2.5 0 0 1-1.64.74L9.34 14.66l1.33 1.33a2.5 2.5 0 0 1-.74 1.64l-3.61 3.61a2.5 2.5 0 0 1-1.64.74L2.34 21.66 1 20.33a2.5 2.5 0 0 1 .74-1.64l3.61-3.61a2.5 2.5 0 0 1 1.64-.74L9.34 12.34l-1.33-1.33a2.5 2.5 0 0 1 .74-1.64l3.61-3.61a2.5 2.5 0 0 1 1.64-.74L21.66 2.34 23 3.67a2.5 2.5 0 0 1-.74 1.64l-3.61 3.61a2.5 2.5 0 0 1-1.64.74z"/>
                </svg>
              </a>
              <a href="#" className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-[#0C3D5F] hover:text-white transition-all group">
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
              Contact for demo
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          {/* Right side - Link columns */}
          <div className="lg:w-8/12">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-6">
              {columns.map((column) => (
                <div key={column.heading}>
                  <h4 className="mb-4 font-semibold text-gray-900 text-sm">
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-12 pt-6 gap-4 text-xs text-gray-500 max-w-[1400px] mx-auto border-t border-gray-100">
          <span>
            © 2026 Careevo AI Inc. All rights reserved.
          </span>
          
          {/* Payment Methods */}
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <span className="mr-2">Kami menerima:</span>
            <div className="flex items-center gap-2">
              <div className="w-10 h-6 bg-gray-200 rounded flex items-center justify-center text-xs font-semibold text-gray-600">Visa</div>
              <div className="w-10 h-6 bg-gray-200 rounded flex items-center justify-center text-xs font-semibold text-gray-600">MC</div>
              <div className="w-10 h-6 bg-gray-200 rounded flex items-center justify-center text-xs font-semibold text-gray-600">Amex</div>
              <div className="w-10 h-6 bg-gray-200 rounded flex items-center justify-center text-xs font-semibold text-gray-600">PP</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Cookie Settings</a>
          </div>
        </div>
      </div>
      
      {/* Image strip at very bottom */}
      <div 
        className="absolute inset-x-0 bottom-0 h-12 sm:h-14 lg:h-16 z-10"
        style={{
          backgroundImage: 'url("/images/footer/strip.webp")',
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    </footer>
  );
}
