import type { NextConfig } from "next";
import { aturanKeamanan } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  // Baseline security headers untuk seluruh path. Isi dan alasan per header
  // (termasuk kenapa CSP belum ada dan kenapa HSTS hanya di production) ada di
  // `src/lib/security/headers.ts`.
  headers: aturanKeamanan,

  // Origin tambahan yang boleh membaca resource dev (HMR, RSC payload).
  //
  // Next 16 memblokir resource dev dari origin yang tidak dikenal, dan
  // blokirnya **diam-diam**: halaman tetap 200 dan ter-render, tetapi HMR dan
  // navigasi lunak tidak pernah tersambung — sehingga perubahan kode tidak
  // pernah muncul di peramban dan gejalanya terbaca sebagai "edit-ku tidak
  // berefek", bukan sebagai galat. `localhost` dan `127.0.0.1` adalah alamat
  // yang sama tetapi **origin yang berbeda**, jadi membuka dev server lewat
  // `127.0.0.1:3000` kena blokir ini.
  //
  // Hanya berpengaruh di development; di production nilainya diabaikan.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  // `x-powered-by: Next.js` tidak menambah kemampuan apa pun bagi pengguna dan
  // hanya membantu pemindaian versi. Docs Next 16: `poweredByHeader: false`.
  poweredByHeader: false,

  // Jaring pengaman, bukan validasi. Server Action yang membawa berkas kecil
  // melewati jalur ini, dan batas bawaan Next hanya 1 MB sehingga unggahan
  // wajar akan gagal dengan galat 413 yang tidak informatif. Batas ukuran
  // sesungguhnya — lengkap dengan pesan yang menyebut ukuran berkas dan
  // maksimumnya — ada di `src/app/api/unggah/route.ts`; nilai di sini harus
  // tetap >= MAKS_UKURAN_BYTE di berkas itu agar keduanya tidak bertentangan.
  //
  // Bersarang di `experimental`: di Next 16.3.5 `serverActions` bukan opsi
  // top-level (dikonfirmasi di config-shared.d.ts dan config-schema.js).
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "d3njjcbhbojbot.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "d2j5ihb19pt1hq.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
      },
      {
        protocol: "https",
        hostname: "d15cw65ipctsrr.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "coursera-course-photos.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "coursera-university-assets.s3.amazonaws.com",
      },
      {
        protocol: "http",
        hostname: "coursera-university-assets.s3.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
