import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const interDisplay = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter-display",
});

export const metadata: Metadata = {
  title: {
    default: "Careevo · Learn. Verify. Earn.",
    template: "%s · Careevo",
  },
  description:
    "Jembatan dari course ke pekerjaan pertama: proses belajar terekam, badge HMAC, dan loker teraudit, tanpa biometrik. Kamera dirancang hanya aktif di dalam sesi terverifikasi yang kamu setujui, dan belum berjalan di aplikasi ini.",
  applicationName: "Careevo",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#ECF3F7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={interDisplay.variable}>
      <body>{children}</body>
    </html>
  );
}
