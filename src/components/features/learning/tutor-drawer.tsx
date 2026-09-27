"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Drawer tutor AI di sisi kanan reader.
 *
 * Diadaptasi dari "reading companion" DeepTutor
 * (`features/sijago/components/reading/workspace/ReadingWorkspace.tsx`):
 * kolom kanan ter-dock yang bisa di-resize di `xl`, dan **sheet** di atas
 * dokumen dengan scrim di bawahnya. Yang diambil adalah mekanismenya — bukan
 * chat-nya: isi drawer adalah aplikasi AI Mastery lewat rute chromeless
 * `/embed/chat`, jadi tidak ada chat kedua di Careevo.
 *
 * ## Kenapa tidak pernah di-unmount
 *
 * DeepTutor memakai `companionOpen && <ReadingCompanion/>` — ia membongkar
 * panelnya saat ditutup, dan itu benar di sana karena `ChatRuntimeProvider` di
 * atasnya memegang state percakapan. Di sini tidak ada lapisan itu: transkrip
 * dan WebSocket hidup **di dalam** iframe. Melepas iframe memuat ulang dokumen
 * dan memutus giliran yang sedang berjalan. Karena itu drawer selalu dirender
 * dan hanya disembunyikan dengan CSS.
 *
 * ## `boleh: false` tidak memuat iframe
 *
 * Kebijakan `tanpa_ai` harus berarti aplikasi tutor tidak pernah dimuat, bukan
 * hanya disembunyikan. Karena itu `src` tidak diberikan sama sekali saat
 * `boleh` false — frame yang dimuat lalu ditutup tetap sudah memanggil backend.
 */

/**
 * Lebar default drawer.
 *
 * Dinaikkan dari 400px ke 520px: sejak drawer-nya mengapung (bukan lagi
 * ter-dock), lebarnya tidak lagi mengambil ruang dari kolom baca, jadi tidak ada
 * alasan untuk tetap sempit. Isinya juga bukan lagi panel samping yang sempit
 * tapi aplikasi chat AI Mastery utuh — pada 400px composer dan daftar sarananya
 * terasa sesak. `LEBAR_MAKS` naik mengikuti supaya pengguna masih punya ruang
 * melebarkan, dan `maxWidth: 92vw` di bawah tetap menjaganya tidak melewati
 * viewport pada layar 1280px.
 */
const LEBAR_BAWAAN = 520;
const LEBAR_MIN = 320;
const LEBAR_MAKS = 760;
const KUNCI_SIMPAN = "careevo.reader.tutorWidth";

export function TutorDrawer({
  src,
  buka,
  onTutup,
  boleh,
}: {
  /** URL rute embed AI Mastery, sudah dihitung server. */
  src: string;
  buka: boolean;
  onTutup: () => void;
  /** `false` = kebijakan melarang; iframe tidak dimuat sama sekali. */
  boleh: boolean;
}) {
  /**
   * Lebar drawer, disimpan di `localStorage`.
   *
   * Lazy-init dan dibaca hanya di klien: nilai ini tidak pernah masuk markup
   * server, jadi tidak ada ketidakcocokan hidrasi yang perlu dijaga. Di server
   * `window` tidak ada, jadi lebar bawaannya yang dipakai.
   */
  const [lebar, setLebar] = useState(() => {
    if (typeof window === "undefined") return LEBAR_BAWAAN;
    try {
      const tersimpan = Number(window.localStorage.getItem(KUNCI_SIMPAN));
      return Number.isFinite(tersimpan) &&
        tersimpan >= LEBAR_MIN &&
        tersimpan <= LEBAR_MAKS
        ? tersimpan
        : LEBAR_BAWAAN;
    } catch {
      // Penyimpanan yang diblokir cukup kembali ke default; bukan alasan gagal.
      return LEBAR_BAWAAN;
    }
  });
  const mulaiRef = useRef<{ x: number; lebar: number } | null>(null);

  /**
   * Lebar drawer **tidak** dipublikasikan ke CSS.
   *
   * Pernah ada: sebuah efek menulis `--reader-drawer-w` ke `:root` setiap lebar
   * berubah, dan `.reader-foot-bar` memakainya untuk memusatkan diri di kolom
   * baca yang tidak tertutup drawer. Channel itu dihapus bersama slidnya —
   * membuka tutor menggeser pusat bar kaki dari `756` ke `260` pada `1280`.
   *
   * Alasannya bukan sekadar selera. CSS tidak bisa membaca lebar saudaranya, jadi
   * satu-satunya saluran ke `.reader-foot-bar` adalah properti kustom — dan
   * begitu ada properti seperti itu, CSS **wajib** bergerak setiap kali drawer
   * bergerak. Tidak ada rumus yang memenuhi syarat itu tanpa menggeser bar.
   *
   * Yang menggantikannya adalah lapisan: di `xl` bar kaki naik ke `z-index: 45`,
   * di atas drawer, jadi tombolnya tetap terjangkau tanpa berpindah satu piksel
   * pun. Lihat catatan `.reader-foot-bar` di `globals.css`.
   */

  /**
   * `Escape` menutup drawer — pola yang sama dengan mode belajar DeepTutor.
   *
   * Hanya terpasang saat drawer terbuka, dan hanya menutup drawer (bukan
   * menghentikan sesi belajar): peserta yang menekan Escape ingin kembali ke
   * materi, bukan mengakhiri sesinya.
   */
  useEffect(() => {
    if (!buka) return;
    const padaTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    document.addEventListener("keydown", padaTombol);
    return () => document.removeEventListener("keydown", padaTombol);
  }, [buka, onTutup]);

  /**
   * Fase menutup, supaya animasi keluar punya waktu untuk terlihat.
   *
   * Tanpa ini, menekan tombol langsung memasang utility `hidden` dan drawer-nya
   * lenyap tanpa gerak sama sekali — hanya animasi masuk yang terlihat, dan itu
   * justru terbaca seperti panel yang lupa tertutup. Polanya persis milik panel
   * silabus (`reader-silabus.tsx`): `hidden` dilepas lebih dulu, lalu dipasang
   * lagi setelah `animationend`.
   *
   * **Yang tidak berubah: iframe tidak pernah di-unmount.** Fase ini hanya
   * menahan pergantian *kelas*; `<iframe>` tetap ada di pohon React sepanjang
   * animasi, jadi transkrip dan WebSocket tidak tersentuh.
   *
   * Di-reset **saat render**, bukan di dalam effect: `setState` sinkron di effect
   * ditolak lint repo ini (`react-hooks/set-state-in-effect`), alasan yang sama
   * dengan yang sudah dicatat di `materi-shell.tsx` dan `reader-silabus.tsx`.
   */
  const [bukaSebelumnya, setBukaSebelumnya] = useState(buka);
  const [sedangMenutup, setSedangMenutup] = useState(false);
  if (bukaSebelumnya !== buka) {
    setBukaSebelumnya(buka);
    // Dibuka lagi di tengah animasi keluar: fase menutup dibatalkan di sini.
    // Kalau tidak, penandanya tertinggal dan penutupan **berikutnya** dimulai
    // dari keadaan yang salah.
    setSedangMenutup(bukaSebelumnya && !buka);
  }
  const tampil = buka || sedangMenutup;

  /**
   * Jaring pengaman kalau `animationend` tidak pernah datang.
   *
   * `animation-name` yang ditimpa, animasi yang dihentikan elemen induk, atau
   * peramban yang tidak menjalankannya bisa membuat penanda itu tertinggal
   * `true` selamanya: panelnya sudah `translateX(100%)` sehingga tidak terlihat,
   * tapi satu elemen tetap ter-mount. Batasnya sengaja lebih longgar dari durasi
   * animasinya supaya jalur normal selalu menang lebih dulu. Tidak ada jaring
   * khusus reduced-motion: blok global `prefers-reduced-motion` membuat animasi
   * selesai seketika, jadi `animationend` yang sampai lebih dulu.
   */
  useEffect(() => {
    if (!sedangMenutup || buka) return;
    const id = window.setTimeout(() => setSedangMenutup(false), 400);
    return () => window.clearTimeout(id);
  }, [sedangMenutup, buka]);

  /** Gestur resize sedang berjalan — hanya untuk sorotan gagang. */
  const [menyeret, setMenyeret] = useState(false);

  const mulaiResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setMenyeret(true);
    mulaiRef.current = { x: e.clientX, lebar };
    const padaGerak = (ev: PointerEvent) => {
      const mulai = mulaiRef.current;
      if (!mulai) return;
      // Menyeret ke kiri memperlebar drawer: delta dibalik.
      const berikut = mulai.lebar + (mulai.x - ev.clientX);
      setLebar(Math.min(LEBAR_MAKS, Math.max(LEBAR_MIN, Math.round(berikut))));
    };
    const padaLepas = () => {
      window.removeEventListener("pointermove", padaGerak);
      window.removeEventListener("pointerup", padaLepas);
      window.removeEventListener("pointercancel", padaLepas);
      mulaiRef.current = null;
      setMenyeret(false);
      setLebar((sekarang) => {
        try {
          window.localStorage.setItem(KUNCI_SIMPAN, String(sekarang));
        } catch {
          // Gagal menyimpan hanya berarti default lagi lain kali.
        }
        return sekarang;
      });
    };
    window.addEventListener("pointermove", padaGerak);
    window.addEventListener("pointerup", padaLepas);
    // `pointercancel` ikut dipasang: gestur yang dibatalkan sistem — panggilan
    // masuk, gestur telapak — tidak boleh menyisakan gagang yang tetap menyala
    // dan lebar yang terkunci di nilai terakhir.
    window.addEventListener("pointercancel", padaLepas);
  };

  return (
    <>
      {/* Scrim: hanya di bawah `xl`, tempat drawer menjadi sheet di atas
          dokumen. Di `xl` drawer ter-dock, jadi menutup layar justru menghalangi
          membaca — persis kesalahan yang pernah terjadi di DeepTutor, di mana
          scrim tunggal meredupkan dokumen yang sedang dibaca.

          Ia ikut melewati fase menutup. Scrim yang hilang mendadak sementara
          panelnya masih meluncur keluar terbaca seperti kedipan, dan klik di
          atasnya tidak boleh menutup apa pun saat sudah dalam keadaan menutup. */}
      {tampil && boleh ? (
        <div
          onClick={buka ? onTutup : undefined}
          data-menutup={!buka && sedangMenutup ? "" : undefined}
          aria-hidden="true"
          className={cn(
            "reader-drawer-scrim fixed inset-0 z-30 bg-black/30 xl:hidden",
            !buka && "pointer-events-none",
          )}
        />
      ) : null}

      <aside
        id="drawer-tutor"
        aria-label="Tutor AI"
        // Selalu ada di pohon React: saat tertutup ia hanya disembunyikan dengan
        // CSS (`hidden`), sehingga iframe di dalamnya **tidak** dimuat ulang dan
        // WebSocket tidak putus. Ini beda dari `companionOpen && <Panel/>` milik
        // DeepTutor, yang boleh membongkar panelnya karena state-nya ada di
        // provider di atas — di sini state-nya ada di dalam iframe.
        //
        // Di `xl` geometrinya pindah ke `.reader-drawer` di `globals.css` —
        // kolom penuh yang membentang dari tepi atas sampai tepi bawah viewport
        // dan melintas di belakang bar fokus (`z-index` di bawah bar itu,
        // `padding-top` sebesar tinggi bar). Kelas `xl:*` yang dulu
        // membentuknya sudah dibuang, karena deklarasinya yang tak berlapis
        // (unlayered) mengalahkan utility Tailwind, jadi menyisakannya hanya
        // menghasilkan dua sumber kebenaran yang bisa berbeda.
        //
        // Yang penting: jangan menaruh `display` di sana — keadaan tertutup
        // adalah utility `hidden`, dan `display` yang tak berlapis akan membuat
        // drawer tertutup tetap terlihat.
        //
        // `data-buka` / `data-menutup` inilah pintu gerak animasinya, dan
        // penandanya harus ikut berubah ketimbang berada di aturan dasar. Drawer
        // ini tidak pernah di-unmount, jadi animasi yang terpasang di
        // `.reader-drawer` hanya berjalan sekali saat halaman dimuat — ketika
        // elemennya masih `display: none` dan tidak ada yang terlihat. Menyematkan
        // animasi ke perubahan penandalah yang membuatnya diputar setiap kali
        // dibuka.
        data-buka={buka ? "" : undefined}
        data-menutup={!buka && sedangMenutup ? "" : undefined}
        // `animationend` juga menyala untuk animasi anak mana pun, jadi hanya
        // elemen ini sendiri yang dihitung. Di sini penyaringnya lebih penting
        // lagi daripada di panel silabus: `<iframe>` memuat dokumen lain, dan
        // keyframe dari dokumen itu tidak boleh menutup fase yang belum selesai.
        onAnimationEnd={(e) => {
          if (e.target !== e.currentTarget) return;
          if (!buka) setSedangMenutup(false);
        }}
        className={cn(
          "reader-drawer border-gray-200 bg-white",
          tampil
            ? "fixed inset-y-0 right-0 z-40 flex flex-col border-l shadow-xl"
            : "hidden",
        )}
        style={tampil ? { width: `${lebar}px`, maxWidth: "92vw" } : undefined}
      >
        {boleh ? (
          <>
            {/* Gagang resize hanya di layar lebar, tempat drawer benar-benar
                ter-dock. `left-0`, bukan `-left-0.5`: di `xl` drawer memakai
                `overflow: hidden` supaya iframe-nya (persegi) tidak melampaui
                sudut membulat, dan gagang yang menjorok ke luar akan terpotong
                separuh — target yang jadi 2px.

                Garis petunjuknya ada di gagang itu sendiri (`::after`), bukan di
                drawer: selama fase menutup gagangnya tidak menerima pointer,
                sehingga tidak ada gestur yang tertangkap di tengah animasi. */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Ubah lebar tutor"
              aria-disabled={!buka || undefined}
              onPointerDown={buka ? mulaiResize : undefined}
              data-menyeret={menyeret ? "" : undefined}
              className={cn(
                "reader-drawer-grip absolute inset-y-0 left-0 z-10 hidden w-1 cursor-col-resize xl:block",
                !buka && "pointer-events-none",
              )}
            />
            <iframe
              src={src}
              title="Tutor AI"
              // Sama seperti `ai-mastery-frame.tsx`: frame tidak boleh menjangkau
              // dokumen Careevo, dan tidak perlu mengirim referrer.
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              referrerPolicy="no-referrer"
              allow="clipboard-read; clipboard-write"
              // `min-h-0` because the drawer is a padded flex column: a
              // flex item defaults to `min-height: auto`, so without it the frame
              // refuses to shrink into the remaining space and the composer ends
              // up outside the viewport — the same failure class already recorded
              // in `materi-shell.tsx` for `main`.
              className="h-full min-h-0 w-full flex-1 border-0 bg-transparent"
            />
          </>
        ) : (
          <p className="p-4 text-[12.5px] text-gray-500">
            Tutor AI tidak tersedia untuk kursus ini.
          </p>
        )}
      </aside>
    </>
  );
}
