"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jalankanScanAction, type HasilScanAction } from "@/actions/inbox";
import { filterInbox } from "@/lib/jobs/kueri-inbox";
import {
  daftarKategori,
  daftarKota,
  daftarPerusahaan,
  hitungBarisHariIni,
  kategoriUntukPeran,
  kotaDariLokasi,
  urutkanBaris,
  type NilaiUrutan,
} from "@/lib/jobs/faset-inbox";
import {
  KartuLokerInbox,
  DaftarLokerLayarPenuh,
  verdictBadge,
  type Baris,
  type VerdictLoker,
} from "@/components/features/jobs/cari-lowongan-ui";
import {
  KosongLoker,
  PanelCariLoker,
  RingkasanLoker,
} from "@/components/features/jobs/permukaan-cari-loker";
import { KolomRekomendasiProfil } from "@/components/features/jobs/kartu-rekomendasi-profil";
import { ambilRekomendasiLoker } from "@/lib/jobs/rekomendasi-inbox";
import type { OnboardingProfile } from "@/lib/onboarding/types";
import { PopupDetailLoker } from "@/components/features/jobs/popup-detail-loker";
import { cn } from "@/lib/utils";



const PILIHAN_STATUS = ["Aman", "Perlu ditinjau", "Belum diperiksa", "Ditolak"] as const;

const KOSONG_BELUM_PINDAI =
  "Tekan “Pindai lowongan baru” untuk mengambil lowongan dari papan publik KarirHub, Glints, Jobstreet, dan ATS publik.";
const KOSONG_PESAN_DEFAULT =
  "Coba ubah kata kunci, lokasi, atau kategori pekerjaan untuk menemukan peluang yang lebih banyak.";

export function InboxList({
  awal,
  adaRiwayat,
  jumlahKursusPerUrl,
  hariIni,
  profile = null,
}: {
  awal: Baris[];
  adaRiwayat: boolean;
  jumlahKursusPerUrl?: Map<string, number>;
  hariIni: string;
  profile?: OnboardingProfile | null;
}) {
  const [draft, setDraft] = useState("");
  const [kueri, setKueri] = useState("");
  const [kota, setKota] = useState("");
  const [kategori, setKategori] = useState("");
  const [perusahaan, setPerusahaan] = useState("");
  const [status, setStatus] = useState("");
  const [urutan, setUrutan] = useState<NilaiUrutan>("terbaru");
  const [daftarTerbuka, setDaftarTerbuka] = useState(false);
  // Verdict penuh (bukan hanya `status`) yang disimpan, karena popup detail
  // butuh `sinyal` untuk menjelaskan kenapa sebuah lowongan ditahan.
  const [detail, setDetail] = useState<{ url: string; verdict?: VerdictLoker | null } | null>(null);
  const setDetailUrl = (url: string, verdict?: VerdictLoker | null) =>
    setDetail({ url, verdict });
  const [hasil, setHasil] = useState<HasilScanAction | null>(null);
  const [pending, mulai] = useTransition();
  const router = useRouter();
  const refKueri = useRef<HTMLInputElement>(null);

  // Antrean: pending saja
  const antrean = useMemo(() => awal.filter((r) => !r.done), [awal]);

  const { rekomendasi, labelMinat } = useMemo(
    () => ambilRekomendasiLoker(antrean, profile, 4),
    [antrean, profile],
  );

  const tersaring = useMemo(() => {
    let hasil = antrean;
    if (kueri.trim()) hasil = filterInbox(hasil, kueri);
    if (kota) hasil = hasil.filter((r) => kotaDariLokasi(r.location) === kota);
    if (kategori) hasil = hasil.filter((r) => kategoriUntukPeran(r.role) === kategori);
    if (perusahaan) hasil = hasil.filter((r) => (r.company ?? "").trim() === perusahaan);
    if (status) hasil = hasil.filter((r) => verdictBadge(r)?.label === status);
    return urutkanBaris(hasil, urutan);
  }, [antrean, kueri, kota, kategori, perusahaan, status, urutan]);

  const kosong = tersaring.length === 0;

  const pilihanKota = useMemo(() => daftarKota(antrean), [antrean]);
  const pilihanKategori = useMemo(() => daftarKategori(antrean), [antrean]);
  const pilihanPerusahaan = useMemo(() => daftarPerusahaan(antrean), [antrean]);
  const jumlahPerusahaan = pilihanPerusahaan.length;
  const baruHariIni = useMemo(() => hitungBarisHariIni(antrean, hariIni), [antrean, hariIni]);

  function terapkan() {
    setKueri(draft);
  }

  function fokusPencarian() {
    refKueri.current?.focus();
    refKueri.current?.select();
  }

  function pindai() {
    setHasil(null);
    mulai(async () => {
      const r = await jalankanScanAction();
      setHasil(r);
      if (r.ok && r.ditambah > 0) router.refresh();
    });
  }

  return (
    <div className="relative flex-1 flex flex-col w-full min-h-0">
      {/* Background Decorative Soft Sky-Blue Waves matching the design */}
      <svg
        className="pointer-events-none absolute -top-8 -right-8 w-[580px] max-w-none text-[#e0f0fe]/70 -z-10 select-none hidden lg:block"
        viewBox="0 0 580 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M60 0C190 70 380 140 580 320V0H60Z"
          fill="currentColor"
        />
        <path
          d="M0 0C150 90 350 200 540 380H580V0H0Z"
          fill="currentColor"
          fillOpacity="0.5"
        />
      </svg>

      <svg
        className="pointer-events-none absolute bottom-0 -left-12 w-[620px] max-w-none text-[#e0f0fe]/60 -z-10 select-none hidden md:block"
        viewBox="0 0 620 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 100C160 60 360 120 620 300H0V100Z"
          fill="currentColor"
        />
      </svg>

      {hasil ? (
        <div className={cn("mb-4", hasil.ok ? "alert alert-ok" : "alert alert-warn")} role="status">
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

      <div className="loker-wide-layout w-full flex-1 flex flex-col lg:flex-row items-stretch gap-3.5 min-h-0">
        {/* Kolom Kiri: Kartu Rekomendasi Loker Berdasarkan Profil */}
        <KolomRekomendasiProfil
          items={rekomendasi}
          labelMinat={labelMinat}
          onBukaDetail={setDetailUrl}
        />

        {/* Kolom Kanan: Saringan, Ringkasan, dan Hasil Pencarian */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-3 h-full lg:min-h-0 lg:overflow-y-auto">
          <PanelCariLoker
            draft={draft}
            onDraft={setDraft}
            onCari={terapkan}
            kota={kota}
            onKota={(nextKota) => {
              setKota(nextKota);
            }}
            kategori={kategori}
            onKategori={(nextKat) => {
              setKategori(nextKat);
            }}
            perusahaan={perusahaan}
            onPerusahaan={(nextPerusahaan) => {
              setPerusahaan(nextPerusahaan);
            }}
            status={status}
            onStatus={setStatus}
            urutan={urutan}
            onUrutan={setUrutan}
            pilihanStatus={PILIHAN_STATUS}
            pilihanKota={pilihanKota}
            pilihanKategori={pilihanKategori}
            pilihanPerusahaan={pilihanPerusahaan}
            total={antrean.length}
            onBukaDaftar={() => setDaftarTerbuka(true)}
            refKueri={refKueri}
          />

          <RingkasanLoker
            total={antrean.length}
            baruHariIni={baruHariIni}
            jumlahPerusahaan={jumlahPerusahaan}
            className="mt-0"
          />

          {/* 
            Daftar lowongan dirender sejak muat pertama: seluruh baris hasil
            pemindaian langsung tampil tanpa perlu mengetik kueri dulu.
            Kartu empty-state hanya muncul saat memang belum ada lowongan
            atau saat filter tidak menemukan apa pun.
          */}
          {kosong ? (
            !adaRiwayat && antrean.length === 0 ? (
              <KosongLoker
                judul="Belum pernah dipindai"
                className="flex-1 flex flex-col items-center justify-center m-0 mt-0 py-8"
                aksi={
                  <Button
                    type="button"
                    variant="brand"
                    size="pill"
                    disabled={pending}
                    onClick={pindai}
                    className="gap-2 shadow-sm font-semibold text-sm"
                  >
                    <RefreshCw className={cn("size-4", pending && "animate-spin")} />
                    {pending ? "Memindai…" : "Pindai lowongan baru"}
                  </Button>
                }
              >
                {KOSONG_BELUM_PINDAI}
              </KosongLoker>
            ) : (
              <KosongLoker
                judul="Belum ada lowongan yang sesuai"
                className="flex-1 flex flex-col items-center justify-center m-0 mt-0 py-8"
                aksi={
                  <Button
                    type="button"
                    variant="brand"
                    size="pill"
                    onClick={fokusPencarian}
                    className="gap-2 shadow-sm font-semibold text-sm"
                  >
                    <Search aria-hidden className="size-4" />
                    <span>Cari lowongan</span>
                  </Button>
                }
              >
                {KOSONG_PESAN_DEFAULT}
              </KosongLoker>
            )
          ) : (
            <section className="flex-1 lg:min-h-0 flex flex-col rounded-[var(--radius-dock)] border border-slate-200/90 bg-white p-5 shadow-sm m-0 mt-0">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <p className="text-sm font-medium text-slate-600" aria-live="polite">
                  Menampilkan <strong className="text-slate-900">{tersaring.length}</strong> dari{" "}
                  {antrean.length} lowongan
                  {kueri.trim() ? (
                    <>
                      {" "}
                      untuk &ldquo;<span className="text-[#0066ff] font-semibold">{kueri.trim()}</span>&rdquo;
                    </>
                  ) : null}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setDraft("");
                    setKueri("");
                    setKota("");
                    setKategori("");
                    setPerusahaan("");
                    setStatus("");
                  }}
                  className="text-xs text-slate-500 hover:text-red-600"
                >
                  Reset filter
                </Button>
              </div>
              {/* Once the grid is a scroll container (lg), its implicit rows default
                  to `auto` and collapse to the cards' border height — the cards'
                  content is inside an `overflow: hidden` article, so it contributes
                  nothing to the row's automatic size. `auto-rows-max` sizes each row
                  to the card's real content instead. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex-1 lg:min-h-0 lg:auto-rows-max lg:overflow-y-auto">
                {tersaring.map((r) => (
                  <KartuLokerInbox
                    key={r.url}
                    job={r}
                    verdict={verdictBadge(r)}
                    onBukaDetail={setDetailUrl}
                    jumlahKursus={jumlahKursusPerUrl?.get(r.url)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {daftarTerbuka ? (
        <DaftarLokerLayarPenuh
          baris={antrean}
          onTutup={() => setDaftarTerbuka(false)}
          renderVerdict={(job) => verdictBadge(job as Baris)}
          kueriAwal={kueri}
          onBukaDetail={setDetailUrl}
          jumlahKursusPerUrl={jumlahKursusPerUrl}
        />
      ) : null}

      {detail ? (
        <PopupDetailLoker
          url={detail.url}
          verdict={detail.verdict}
          onTutup={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}
