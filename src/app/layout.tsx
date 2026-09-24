import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Careevo · Learn. Verify. Earn.",
    template: "%s · Careevo",
  },
  description:
    "Jembatan dari course ke pekerjaan pertama: proses belajar terekam, badge HMAC, dan loker teraudit, tanpa biometrik. Kamera dirancang hanya aktif di dalam sesi terverifikasi yang kamu setujui, dan belum berjalan di aplikasi ini.",
  applicationName: "Careevo",
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
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
