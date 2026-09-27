import { Chrome } from "@/components/ui/chrome";
import { SiteFooter } from "@/components/ui/site-footer";
import { getSession } from "@/lib/auth/session";

/**
 * Layout route publik: landing, katalog, `/loker`, `/kerja`, `/masuk`, `/daftar`.
 *
 * `getSession()` di sini — bukan di dalam `Chrome` — supaya navbar tahu harus
 * menampilkan tombol masuk atau menu akun. Ini membuat seluruh grup ini
 * dinamis, yang memang dibutuhkan: `/loker` dan `/kerja` dibaca orang
 * yang sudah masuk, dan tanpa cookie yang dibaca di server, navbar tetap
 * menampilkan "Masuk" kepada orang yang sudah punya sesi aktif. Permintaan
 * tanpa cookie tetap tidak menyentuh database (`bacaTokenSesi` berhenti sebelum
 * query), jadi jalur tamu tidak bertambah biaya.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <>
      <Chrome session={session} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
