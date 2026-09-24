import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
