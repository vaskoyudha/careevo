"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { petakanWorkspace, type StatusWorkspace } from "@/lib/workspace/port";

/**
 * Keadaan awal yang di-seed dari server.
 *
 * `hidup` dihitung server saat render, sehingga halaman yang dimuat ulang tidak
 * menampilkan "Siapkan" untuk ruang kerja yang sebenarnya sudah jalan. Tanpa
 * seed ini, peserta yang sedang bekerja lalu me-refresh akan melihat tombol
 * "Siapkan" lagi padahal IDE-nya masih hidup — persis kebingungan yang
 * dihindari `sesiReaderAwal` untuk sesi terverifikasi.
 */
export interface SeedWorkspace {
  hidup: boolean;
  /**
   * Alamat **gerbang** (`/api/workspace/buka?...&tiket=...`), bukan alamat
   * ruang kerja mentah.
   *
   * Halaman server menerbitkan tiket berumur pendek dan menaruhnya di sini.
   * Nama field-nya `buka` dan bukan `url` dengan sengaja: alamat mentah tidak
   * pernah sampai ke klien, karena memuatnya langsung akan melewati tiket dan
   * mengembalikan lubang yang sedang ditutup.
   */
  buka?: string;
}

/** Hasil satu panggilan `/api/workspace`. */
interface BalasanWorkspace {
  ok: boolean;
  status?: StatusWorkspace;
  hidup?: boolean;
  /** Alamat gerbang bertiket; tidak ada bila ruang kerja belum hidup. */
  buka?: string;
  error?: string;
}

/**
 * Panel ruang kerja — IDE di dalam course.
 *
 * ## Yang **tidak** dibangun di sini
 *
 * Editor, pohon berkas, tab, terminal, LSP, dan Git **tidak** ditulis di
 * komponen ini. Semuanya sudah ada di dalam code-server; yang dilakukan
 * komponen ini adalah menyalakan kontainer lalu menampilkan hasilnya di
 * `<iframe>`. Itu keputusan yang menghemat seluruh pekerjaan membangun
 * workbench, dan ia yang membuat komponen ini pendek.
 *
 * ## Kenapa iframe, bukan komponen React
 *
 * code-server adalah **server HTTP tersendiri**, bukan pustaka. Ia tidak bisa
 * di-`import`. Satu-satunya cara menampilkannya adalah membiarkan peramban
 * memuatnya dari alamatnya sendiri — dan itu artinya iframe. Konsekuensinya
 * nyata dan dicatat di sini: ruang kerja berada di origin yang berbeda, jadi ia
 * tidak berbagi cookie maupun state dengan aplikasi ini, dan `sandbox` di bawah
 * menahan apa pun yang bisa dilakukannya terhadap halaman induk.
 */
export function WorkspacePanel({
  courseId,
  seed,
  isi = false,
}: {
  courseId: string;
  seed: SeedWorkspace;
  /**
   * Isi kolom setinggi penuh, bukan kartu di dalam halaman.
   *
   * Dipakai `RuangKerjaLab`: di sana panel ini **adalah** kolom kanan sebuah
   * grid, jadi tingginya datang dari kolom itu (`h-full`), bukan dari
   * `h-[78vh]` yang menebak tinggi viewport. Di jalur lama (panel di dalam
   * halaman course) `isi` tetap `false` dan tinggi tetap `78vh` supaya
   * iframe-nya punya tinggi yang pasti walau halaman di atasnya menggulir.
   */
  isi?: boolean;
}) {
  const [hidup, setHidup] = useState(seed.hidup);
  const [buka, setBuka] = useState(seed.buka);
  const [pending, setPending] = useState(false);
  const [galat, setGalat] = useState<StatusWorkspace | null>(null);

  /**
   * Satu panggilan ke `/api/workspace`.
   *
   * `aksi` dikirim di badan, bukan di path, karena ketiganya memakai gerbang
   * yang identik — lihat catatan di route. Komponen ini tidak pernah menyusun
   * flag podman maupun nama kontainer; seluruh otorisasi ada di server.
   */
  const panggil = useCallback(
    async (aksi: "mulai" | "berhenti") => {
      setPending(true);
      setGalat(null);
      try {
        const balasan = await fetch("/api/workspace", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ aksi, courseId }),
        });

        // 403/401/429/400 berarti permintaannya tidak boleh lewat. Pesannya
        // ditulis server dan ditampilkan apa adanya — komponen ini tidak
        // mengarang pesan sendiri, supaya copy tidak menyimpang.
        if (!balasan.ok) {
          setGalat("galat_manajer");
          return;
        }

        const data = (await balasan.json()) as BalasanWorkspace;
        if (data.status && data.status !== "ok") {
          setGalat(data.status);
          return;
        }

        setHidup(Boolean(data.hidup));
        setBuka(data.buka);
      } catch {
        // Jaringan mati atau respons bukan JSON. Satu peristiwa bagi peserta:
        // layanan tidak tersedia.
        setGalat("galat_manajer");
      } finally {
        setPending(false);
      }
    },
    [courseId],
  );

  const pesan = galat ? petakanWorkspace(galat) : null;

  // Ruang kerja hidup: tampilkan IDE-nya. Ini jalur utama, dan ia sengaja
  // dibuat paling sederhana — tidak ada tombol, tidak ada keadaan antara.
  if (hidup && buka) {
    // Varian `isi`: panel mengisi tinggi kolomnya, jadi judul dan kalimat
    // penjelasan yang ada di jalur kartu disembunyikan. Bar fokus halaman
    // sudah membawa nama course, dan di dalam lab yang dibaca peserta adalah
    // kode — bukan paragraf tentang ruang kerja.
    if (isi) {
      return (
        <div className="flex h-full min-h-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"
              />
              <h2 className="text-sm font-bold tracking-tight text-gray-900">
                Ruang kerja
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => void panggil("berhenti")}
            >
              {pending ? "Menghentikan…" : "Hentikan"}
            </Button>
          </div>

          <iframe
            title="Ruang kerja kode"
            src={buka}
            className="min-h-0 w-full flex-1 rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(10,61,98,0.04),0_10px_24px_-16px_rgba(10,61,98,0.18)]"
            sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts allow-downloads"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    return (
      <section aria-labelledby="judul-ruang-kerja" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"
            />
            <h2 id="judul-ruang-kerja" className="text-lg font-bold tracking-tight text-gray-900">
              Ruang kerja
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void panggil("berhenti")}
          >
            {pending ? "Menghentikan…" : "Hentikan"}
          </Button>
        </div>

        <p className="text-sm text-gray-600">
          Editor, terminal, dan berkasmu ada di bawah. Berkas tersimpan di ruang kerja ini
          dan tetap ada saat kamu kembali.
        </p>

        {/*
          ## `allow-same-origin` **wajib** ada di sini, dan itu bukan kelonggaran

          Versi pertama komponen ini sengaja tidak memuatnya, dengan alasan
          "iframe tidak boleh menyentuh cookie aplikasi". Alasan itu **salah di
          kasus ini**, dan kegagalannya terukur di peramban sungguhan: iframe
          yang di-sandbox **tanpa** `allow-same-origin` mendapat **origin
          opaque**, sehingga ia tidak bisa menyimpan cookie sama sekali. Yang
          terjadi bukan "IDE tanpa cookie aplikasi", melainkan "IDE yang tidak
          bisa login" — iframe-nya berhenti di halaman masuk code-server dan
          tidak pernah sampai ke workbench.

          Yang membuatnya aman: `src` di sini adalah **route gerbang milik kita
          sendiri** (`/api/workspace/buka`), yang hanya membalas dua hal — 302
          ke origin ruang kerja yang berbeda, atau teks galat polos. Tidak ada
          HTML yang dikendalikan pihak lain yang dimuat di origin aplikasi ini,
          jadi kombinasi `allow-same-origin` + `allow-scripts` tidak memberi
          jalan melepas sandbox. Setelah pengalihan, dokumen yang berjalan
          berasal dari origin ruang kerja yang **berbeda**, dan di sana
          `allow-same-origin` hanya memberi akses ke cookie origin itu sendiri.

          Karena itu invariannya bukan "tanpa allow-same-origin", melainkan
          **"tidak ada HTML pihak ketiga yang dimuat di origin aplikasi"**.
          Invarian itu ditegakkan oleh bentuk `src` (selalu route gerbang kita)
          dan diuji di `workspace-panel.test.ts`.

          Token lain sengaja hanya yang dibutuhkan IDE. Versi pertama juga
          memuat `allow-clipboard-write`, yang **bukan** token sandbox — peramban
          membuang seluruh atribut karena itu, dan yang muncul di konsol adalah
          galat parsing, bukan sandbox yang longgar.
        */}
        <iframe
          title="Ruang kerja kode"
          src={buka}
          className="h-[78vh] min-h-[520px] w-full rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(10,61,98,0.04),0_10px_24px_-16px_rgba(10,61,98,0.18)]"
          sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts allow-downloads"
          referrerPolicy="no-referrer"
        />
      </section>
    );
  }

  // Belum hidup: satu tombol yang menyalakannya, beserta alasannya bila ada.
  //
  // `isi` menaruh kartu ini di tengah kolom setinggi viewport, supaya kosongnya
  // terbaca sebagai "belum ada apa-apa di sini" dan bukan sekadar kartu yang
  // menempel di atas lipatan halaman.
  if (isi) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">
            Ruang kerja belum hidup
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Ruang kerja adalah editor kode lengkap dengan terminal dan penyimpanan berkasmu
            sendiri. Ia dinyalakan saat kamu butuh, dan dimatikan otomatis saat menganggur —
            berkasmu tetap tersimpan.
          </p>

          <div className="mt-5">
            <Button
              variant="ocean"
              size="pill-sm"
              disabled={pending}
              onClick={() => void panggil("mulai")}
            >
              {pending ? "Menyiapkan…" : "Siapkan ruang kerja"}
            </Button>
          </div>

          {pesan ? (
            <p
              role={pesan.nada === "galat" ? "alert" : "status"}
              className={cn(
                "mt-4 rounded-xl border px-4 py-3 text-left text-sm leading-relaxed",
                pesan.nada === "galat"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-gray-200 bg-gray-50 text-gray-700",
              )}
            >
              <span className="font-semibold">{pesan.judul}</span>
              {pesan.detail ? (
                <span className="mt-0.5 block text-gray-600">{pesan.detail}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="judul-ruang-kerja" className="space-y-3">
      <h2 id="judul-ruang-kerja" className="text-lg font-bold tracking-tight text-gray-900">
        Ruang kerja
      </h2>
      <div className="rounded-2xl border border-gray-200 bg-white px-5 py-6 lg:px-6 lg:py-7">
        <p className="max-w-2xl text-sm leading-relaxed text-gray-600">
          Ruang kerja adalah editor kode lengkap dengan terminal dan penyimpanan berkasmu
          sendiri. Ia dinyalakan saat kamu butuh, dan dimatikan otomatis saat menganggur —
          berkasmu tetap tersimpan.
        </p>

        <div className="mt-5">
          <Button
            variant="ocean"
            size="pill-sm"
            disabled={pending}
            onClick={() => void panggil("mulai")}
          >
            {pending ? "Menyiapkan…" : "Siapkan ruang kerja"}
          </Button>
        </div>

        {pesan ? (
          <p
            role={pesan.nada === "galat" ? "alert" : "status"}
            className={cn(
              "mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed",
              pesan.nada === "galat"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-gray-200 bg-gray-50 text-gray-700",
            )}
          >
            <span className="font-semibold">{pesan.judul}</span>
            {pesan.detail ? <span className="mt-0.5 block text-gray-600">{pesan.detail}</span> : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}
