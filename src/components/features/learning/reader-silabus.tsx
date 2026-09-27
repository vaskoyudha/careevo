"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { RiArrowLeftLine, RiLayoutLeft2Line } from "@remixicon/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hitungProgres, irisModulSelesai, type ModulKursus } from "@/lib/courses/kurikulum";
import { MateriRail, type TampilanRail } from "./materi-rail";

/**
 * Silabus reader: pemicu + progres di kiri bar fokus, dan panel setinggi layar.
 *
 * ## Kenapa di bar, bukan di halaman pratinjau kursus
 *
 * Ini permukaan **reader** (`/belajar/[slug]/materi/[modulId]`). Halaman
 * pratinjau (`/belajar/[slug]`) sengaja tidak memakainya: di sana peserta belum
 * masuk ke modul mana pun, jadi bit progres "berapa modul lagi" belum punya
 * subjek. Yang membawa peta kemajuan adalah tempat peserta benar-benar membaca.
 *
 * ## Kenapa state-nya di shell, bukan di sini
 *
 * Panelnya `position: fixed` dan harus menutupi bar fokus sekaligus. Ia
 * dirender lewat `createPortal` ke `<body>` supaya tidak terkurung stacking
 * context bar (`.reader-bar`, `z-index: 30`): sebagai anak bar, `z-index`-nya
 * hanya berlaku di dalam konteks itu dan ia tidak akan pernah bisa menutupi bar
 * yang melahirkannya.
 *
 * Karena portal hidup di luar bar, status buka/tutupnya **tidak bisa** tinggal di
 * sini — `MateriShell` yang merender `ReaderPanelSilabus` dan memberi tombol di
 * bar keadaan itu. Yang dikirim lewat prop hanyalah keadaan dan setter-nya.
 *
 * ## Kenapa tidak ada rail permanen lagi
 *
 * Dulu reader punya kolom rail `lg` **dan** panel "Daftar modul" di bawah `lg`.
 * Sekarang keduanya digantikan satu panel ini: dua daftar modul di satu layar —
 * rail ter-dock plus overlay berisi baris yang sama — persis penyimpangan yang
 * dihindari repo ini. Daftarnya tetap `MateriRail`, jadi tidak ada salinan kedua
 * dari komponennya; yang dihapus hanya rumah keduanya.
 */

/**
 * Bar progres berbentuk segmen, satu bit per modul.
 *
 * Batangnya sengaja **per modul**, bukan satu batang menerus: yang dibaca
 * peserta di bar adalah "berapa modul lagi", dan segmen membuat satu modul
 * selesai terlihat sebagai satu bit yang menyala — bukan sebagai batang yang
 * bergerak sedikit tanpa arti yang jelas.
 *
 * Di atas 12 modul segmennya berhenti menambah dan mulai mengisi secara
 * proporsional (`Math.round(rasio * 12)`), karena 40 bit di lebar 180px menjadi
 * garis 1,5px yang tidak lagi menyampaikan apa pun. Batas itu satu-satunya
 * percabangan di sini, dan ia menjaga arti segmennya utuh di rentang yang wajar.
 */
function ProgressSegmen({
  jumlah,
  selesai,
  className,
}: {
  jumlah: number;
  selesai: number;
  className?: string;
}) {
  if (jumlah <= 0) return null;
  const segmen = Math.min(jumlah, 12);
  const terisi = jumlah <= 12 ? selesai : Math.round((selesai / jumlah) * segmen);

  return (
    <span className={cn("reader-silabus-segmen", className)} aria-hidden="true">
      {Array.from({ length: segmen }, (_, i) => (
        <span key={i} className={cn("reader-silabus-bit", i < terisi && "is-terisi")} />
      ))}
    </span>
  );
}

/**
 * Pemicu silabus di kiri bar fokus.
 *
 * Dua elemen, satu kluster: tombol ciut/bentang, lalu judul kursus dengan bar
 * progres di bawahnya — susunan yang sama dengan referensi (ikon menu di paling
 * kiri, nama kursus, lalu bit-bit progres).
 *
 * Di bawah 769px hanya tombolnya yang tersisa (`reader-silabus-info`
 * disembunyikan CSS): bar seluler sudah memuat tautan "Silabus" dan tombol tutor
 * di sebelahnya, dan nama kursus panjang di antara keduanya tidak terbaca.
 * Tombolnya tetap satu-satunya jalan membuka silabus di ponsel, jadi yang
 * dibuang hanya labelnya, bukan pintunya.
 *
 * Progres selalu ditampilkan. Di reader tidak ada "pengunjung yang belum
 * terdaftar": `(focus)/layout.tsx` hanya melewatkan sesi yang sudah punya
 * profil onboarding, dan modulnya sudah dibuka — jadi "0 dari 5" di sini selalu
 * berarti progres peserta sendiri, bukan ketiadaan pendaftaran.
 */
export function ReaderSilabusLeading({
  kursusJudul,
  modul,
  selesai,
  buka,
  onToggle,
  tombolRef,
}: {
  kursusJudul: string;
  modul: ModulKursus[];
  selesai: string[];
  buka: boolean;
  onToggle?: () => void;
  tombolRef?: RefObject<HTMLButtonElement | null>;
}) {
  const selesaiValid = irisModulSelesai(selesai, modul);
  const progres = hitungProgres(selesaiValid.length, modul.length);

  return (
    <div className="reader-silabus">
      {/* Satu kontrol, bukan tiga: ikonnya, judul kursusnya, dan bit progresnya
          berada di **dalam** tombol ini, jadi hover menyorot seluruh kladnya dan
          klik di mana pun membuka panelnya. Sebelumnya hanya chip ikonnya yang
          bisa diklik dan hanya chip itu yang bereaksi saat disentuh — judul dan
          bit progres di sebelahnya terlihat seperti bagian dari kontrol yang
          sama tetapi diam saja, dan itu persis yang membuat kladnya tidak
          terbaca sebagai satu komponen.

          Nama aksesibelnya tetap eksplisit (`aria-label`) dan menyebut
          **tujuannya**, bukan isinya: teks yang terlihat di dalamnya adalah nama
          kursus, sedangkan aksinya adalah "buka silabus". Di bawah 769px nama
          kursusnya disembunyikan CSS, jadi tanpa `aria-label` tombol ini — satu-
          satunya jalan ke peta modul — diumumkan tanpa nama. */}
      <button
        ref={tombolRef}
        type="button"
        data-silabus-toggle=""
        aria-label={buka ? "Tutup silabus kursus" : "Buka silabus kursus"}
        aria-expanded={buka}
        aria-controls="reader-panel-silabus"
        onClick={onToggle}
        className="reader-silabus-tombol"
      >
        <span className="reader-silabus-ikon">
          <RiLayoutLeft2Line size={20} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <span className="reader-silabus-info">
          <span className="reader-silabus-judul" title={kursusJudul}>
            {kursusJudul}
          </span>
          <ProgressSegmen jumlah={modul.length} selesai={selesaiValid.length} />
        </span>
      </button>
      {/* Kalimat progres ini **di luar** tombolnya, dan itu disengaja. Segmennya
          `aria-hidden`, jadi baris inilah satu-satunya kalimat progres yang
          didengar pembaca layar; di dalam tombol ia akan tertelan `aria-label`
          (nama aksesibel menimpa isi), sehingga progresnya hilang dari pembaca
          layar justru saat ia dipindahkan ke sana. */}
      <span className="sr-only">
        Progres kursus {selesaiValid.length} dari {modul.length} modul, {progres} persen
      </span>
    </div>
  );
}

/**
 * Isi panel silabus — kepala (judul, penyedia, progres), daftar modul, dan CTA.
 *
 * Dipisah dari `ReaderPanelSilabus` dan diekspor karena repo ini lingkungan
 * `node` tanpa jsdom: `ReaderPanelSilabus` merender lewat `createPortal` ke
 * `<body>`, dan `document` tidak ada di sana — merendernya langsung akan melempar
 * `ReferenceError`. Memisahkan isinya membuat properti yang paling mudah rusak
 * (id yang dirujuk `aria-controls`, nama dialog, daftar modul, CTA ke modul
 * berikutnya) bisa diperiksa dari HTML hasil render. Pola yang sama dipakai
 * `IsiPanelKejadian` di `kejadian-panel.tsx`.
 */
export function IsiPanelSilabus({
  slug,
  kursusJudul,
  kursusPenyedia,
  modul,
  modulAktif,
  halamanAktif,
  selesai,
  onTutup,
  panelRef,
  nonaktif = false,
  onSelesaiAnimasi,
}: {
  slug: string;
  kursusJudul: string;
  kursusPenyedia: string;
  modul: ModulKursus[];
  modulAktif: string;
  /** Id halaman yang sedang dibaca (`?halaman=`), untuk penanda "kamu di sini". */
  halamanAktif?: string;
  selesai: string[];
  onTutup: () => void;
  panelRef?: RefObject<HTMLElement | null>;
  /**
   * Panelnya masih di DOM tetapi sudah tidak boleh dijangkau (fase menutup).
   *
   * `inert` — bukan `aria-hidden` saja: `aria-hidden` mengeluarkan subtree dari
   * pohon aksesibilitas tetapi **tidak** dari urutan Tab, jadi Tab tetap masuk
   * ke daftar modul yang sedang meluncur keluar. `inert` melakukan keduanya.
   * Itu pengganti jaminan lama "panelnya tidak ada di DOM saat tertutup".
   */
  nonaktif?: boolean;
  /** Animasi keluar selesai — pemanggil melepas panelnya dari DOM. */
  onSelesaiAnimasi?: () => void;
}) {
  const selesaiValid = irisModulSelesai(selesai, modul);
  const progres = hitungProgres(selesaiValid.length, modul.length);
  const berikutnya = modul.find((m) => !selesaiValid.includes(m.id)) ?? modul[0] ?? null;

  /**
   * Tampilan rail yang sedang aktif — **dimiliki kepala panel**, bukan rail.
   *
   * Pintu "Semua modul" hidup di kepala (di atas judul kursus), dan ia satu-satunya
   * kontrol yang mengubah seluruh isi panel. Kalau state-nya tinggal di rail,
   * kepala tidak punya cara tahu tampilan mana yang berlaku, dan tombolnya akan
   * menawarkan kembali ke daftar saat daftar itu memang yang sedang tampil.
   *
   * Dimulai dari modul yang dibuka: "di mana saya" adalah pertanyaan pertama saat
   * panel dibuka. Bila `modulAktif` tidak ada di kurikulum (id basi), yang benar
   * adalah daftar kursus — bukan panel yang mengaku sedang di sebuah modul.
   */
  const [tampilan, setTampilan] = useState<TampilanRail>(
    modul.some((m) => m.id === modulAktif) ? "modul" : "semua",
  );

  /**
   * Modul yang sedang dibuka — **hanya saat panel menyempit ke satu modul**.
   *
   * Judul panel mengikuti nilai ini: saat panel menampilkan satu modul, judulnya
   * adalah nama modul itu (isi di bawahnya memang bab-bab modul, bukan kursus);
   * saat daftar seluruh kursus yang tampil — atau saat `modulAktif` basi — yang
   * benar adalah judul kursus, karena panelnya memang memuat seluruh kursus.
   *
   * Judulnya hidup di **kepala panel**, bukan di rail: rail hanya memuat isinya
   * (daftar bab), jadi satu panel tidak pernah punya dua judul dengan teks yang
   * sama. `aria-label` dialog tetap menyebut kursusnya — identitas panelnya tidak
   * berubah saat ia menyempit.
   */
  const modulDibuka =
    tampilan === "modul" ? (modul.find((m) => m.id === modulAktif) ?? null) : null;

  return (
    <aside
      ref={panelRef}
      id="reader-panel-silabus"
      role="dialog"
      aria-modal="true"
      aria-label={`Silabus ${kursusJudul}`}
      className="reader-panel"
      data-menutup={nonaktif ? "" : undefined}
      inert={nonaktif}
      // `e.target !== e.currentTarget` menyaring `animationend` milik anak:
      // event itu **bubble**, jadi animasi apa pun di dalam panel (indikator
      // memuat, baris yang menyala) akan sampai ke sini dan, tanpa saringan,
      // melepas panelnya jauh sebelum animasi keluarnya selesai. Yang dihitung
      // hanya animasi yang berjalan di `<aside>` ini sendiri.
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) onSelesaiAnimasi?.();
      }}
    >
      <div className="reader-panel-head">
        {/* Baris paling atas: pintu "Semua modul" di kiri, tombol tutup di
            kanan — satu baris, satu garis optik.

            Tombol tutupnya pindah ke sini (dulu sebaris dengan judul kursus)
            karena keduanya adalah **kontrol panel**, bukan bagian dari isi: ia
            menutup panel dan ia mengganti seluruh isinya. Menaruhnya di baris
            yang sama dengan judul membuat judul berbagi baris dengan dua
            maksud sekaligus, dan di panel yang sempit judulnya jadi terpotong
            lebih cepat daripada yang diperlukan.

            `margin-left: auto` pada tombolnya (lihat CSS) yang menahannya di
            kanan, sehingga baris ini tetap benar saat pintu "Semua modul" tidak
            dirender — di tampilan daftar kursus, tombol tutupnya sendirian dan
            harus tetap rata kanan, bukan melompat ke kiri.

            Pintu "Semua modul" hanya ada di tampilan modul: saat daftar kursus
            yang tampil, menawarkan "kembali ke daftar kursus" berarti
            menawarkan halaman yang sedang dibaca. */}
        <div className="reader-panel-atas">
          {tampilan === "modul" ? (
            <button
              type="button"
              onClick={() => setTampilan("semua")}
              className="reader-panel-semua"
            >
              <RiArrowLeftLine className="reader-panel-semua-ikon" aria-hidden="true" />
              Semua modul
            </button>
          ) : null}
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup silabus kursus"
            className="reader-panel-toggle"
          >
            {/* Lucide `X`, not remixicon's `Close`: the remixicon marks are
                fixed-weight fill paths, so their boldness cannot be tuned — this
                one is stroke-based, and `strokeWidth` is what makes it read
                heavy at 26px. `absoluteStrokeWidth` keeps the stroke weight
                honest rather than scaling it with the viewBox. */}
            <X size={26} strokeWidth={3.25} absoluteStrokeWidth aria-hidden="true" />
          </button>
        </div>

        {/* Judul panel mengikuti tampilannya: nama modul saat panel menyempit ke
            satu modul, nama kursus saat seluruh daftar kursus yang tampil.
            Judul kursus tidak hilang — ia turun jadi baris konteks bersama
            penyedianya, sebab panelnya menutupi bar yang memuat salinan kecilnya
            dan peserta tidak boleh kehilangan "kursus mana ini" saat membaca. */}
        <p className="reader-panel-judul">{modulDibuka ? modulDibuka.judul : kursusJudul}</p>
        <p className="reader-panel-penyedia">
          {modulDibuka ? `${kursusJudul} · ${kursusPenyedia}` : kursusPenyedia}
        </p>
        <ProgressSegmen
          jumlah={modul.length}
          selesai={selesaiValid.length}
          className="is-besar"
        />
        <p className="reader-panel-progres">
          {selesaiValid.length} dari {modul.length} modul · {progres}%
        </p>
      </div>

      <div className="reader-panel-body">
        <MateriRail
          slug={slug}
          modul={modul}
          modulAktif={modulAktif}
          halamanAktif={halamanAktif}
          selesai={selesaiValid}
          tampilan={tampilan}
          onTampilan={setTampilan}
          onNavigasi={onTutup}
        />
      </div>

      <div className="reader-panel-foot">
        <Link
          href={berikutnya ? `/belajar/${slug}/materi/${berikutnya.id}` : `/belajar/${slug}`}
          onClick={onTutup}
          className="reader-panel-cta"
        >
          {progres === 100 ? "Ulas modul" : "Lanjutkan belajar"}
        </Link>
      </div>
    </aside>
  );
}

/**
 * Panel silabus setinggi layar.
 *
 * Menutupi seluruh viewport — bar fokus sekaligus — dan mengulang apa yang ada
 * di pemicunya (judul, penyedia, progres) supaya peserta tidak kehilangan
 * konteks begitu panelnya terbuka. Tombol ciutnya berada **di atas** blok
 * progres, sesuai susunan yang diminta: di bar tombol lalu progres, di panel
 * tombol lalu progres lagi, jadi matanya tidak perlu mencari.
 *
 * Perilaku papan ketik mengikuti `mobile-nav-drawer.tsx` — Escape menutup, Tab
 * terjerat di dalam panel, `overflow` bodi dikunci, dan fokus kembali ke tombol
 * pemicu saat panel ditutup. Itu bukan hiasan: tanpa jebakan fokus, Tab dari
 * baris terakhir keluar ke halaman di belakang scrim, yang secara visual tidak
 * terlihat dan membuat pengguna keyboard tersesat.
 *
 * Panelnya **tidak dirender saat tertutup** (`if (!buka) return null`), sama
 * seperti `mobile-nav-drawer.tsx`: tidak ada panel tersembunyi yang bisa
 * dijangkau keyboard, dan tidak ada `document` yang disentuh saat render di
 * server.
 */
export function ReaderPanelSilabus({
  slug,
  kursusJudul,
  kursusPenyedia,
  modul,
  modulAktif,
  halamanAktif,
  selesai,
  buka,
  onTutup,
  tombolRef,
}: {
  slug: string;
  kursusJudul: string;
  kursusPenyedia: string;
  modul: ModulKursus[];
  /** Id modul yang sedang dibuka — satu baris ditandai `aria-current`. */
  modulAktif: string;
  /** Id halaman yang sedang dibaca (`?halaman=`), bila ada. */
  halamanAktif?: string;
  selesai: string[];
  buka: boolean;
  onTutup: () => void;
  /** Tombol pemicu di bar, tempat fokus kembali setelah panel ditutup. */
  tombolRef?: RefObject<HTMLButtonElement | null>;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const tutup = useCallback(() => onTutup(), [onTutup]);

  /**
   * Memulai fase menutup saat `buka` berubah `true` → `false`.
   *
   * Diselesaikan **saat render**, bukan di dalam effect: `setState` sinkron di
   * effect ditolak lint repo ini (`react-hooks/set-state-in-effect`) — alasan
   * yang sudah dicatat di `materi-shell.tsx`. Pola yang dipakai di sana (dan
   * yang direkomendasikan React untuk "menyesuaikan state saat prop berubah")
   * adalah membandingkan dengan nilai render sebelumnya di sini: React akan
   * langsung mengulang render sebelum menyerahkan hasilnya ke DOM, jadi tidak
   * ada frame dengan keadaan setengah jadi.
   *
   * Pemicunya perubahan `buka`, jadi menutup lewat Escape, scrim, tombol X,
   * maupun CTA semuanya melewati jalur yang sama — tidak ada pemanggil yang
   * perlu ingat memanggil animasinya sendiri.
   */
  const [bukaSebelumnya, setBukaSebelumnya] = useState(buka);
  const [sedangMenutup, setSedangMenutup] = useState(false);
  if (bukaSebelumnya !== buka) {
    setBukaSebelumnya(buka);
    // Dibuka kembali di tengah animasi keluar: fase menutupnya dibatalkan di
    // sini. Kalau tidak, penandanya tertinggal `true` dan penutupan
    // **berikutnya** mulai dari keadaan yang salah.
    setSedangMenutup(bukaSebelumnya && !buka);
  }
  const tampil = buka || sedangMenutup;

  /**
   * Jaring pengaman kalau `animationend` tidak pernah datang.
   *
   * Ada tiga jalur yang bisa membuatnya hilang: animasinya dihentikan elemen
   * induk, `animation-name` ditimpa sesuatu, atau peramban yang tidak
   * menjalankannya sama sekali. Tanpa jaring ini, `sedangMenutup` tertinggal
   * `true` selamanya — panelnya tidak terlihat (sudah `translateX(-100%)`) dan
   * tidak bisa di-Tab (`inert`), jadi tidak ada gejala di layar, tetapi satu
   * elemen tetap ter-mount untuk sesi itu. Batasnya sengaja lebih longgar dari
   * durasi animasinya supaya jalur normal selalu menang lebih dulu.
   */
  useEffect(() => {
    if (!sedangMenutup || buka) return;
    const id = window.setTimeout(() => setSedangMenutup(false), 400);
    return () => window.clearTimeout(id);
  }, [sedangMenutup, buka]);

  /** Akhir fase menutup: lepas panelnya dari DOM. */
  const selesaiMenutup = useCallback(() => {
    // `animationend` juga menyala untuk animasi lain di subtree (mis. keyframe
    // ikon). Yang dihitung hanya keluar dari panelnya sendiri, dan `buka` harus
    // sudah false — kalau peserta membuka kembali di tengah animasi keluar,
    // event itu tidak boleh melepas panel yang baru saja muncul lagi.
    if (buka) return;
    setSedangMenutup(false);
  }, [buka]);

  useEffect(() => {
    if (!buka) return;
    // Nilai ref dibaca **di dalam** effect, bukan di cleanup: `tombolRef.current`
    // bisa sudah menunjuk elemen lain (atau `null`) saat cleanup berjalan, dan
    // menyimpan tombolnya di sini membuat fokus kembali ke tombol yang benar-
    // benar membuka panel — sekaligus memenuhi aturan `exhaustive-deps`.
    const tombol = tombolRef?.current;
    const overflowSebelumnya = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        tutup();
        return;
      }
      if (event.key !== "Tab") return;
      const elemen = panelRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!elemen?.length) return;
      const pertama = elemen[0];
      const terakhir = elemen[elemen.length - 1];
      if (event.shiftKey && document.activeElement === pertama) {
        event.preventDefault();
        terakhir.focus();
      } else if (!event.shiftKey && document.activeElement === terakhir) {
        event.preventDefault();
        pertama.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflowSebelumnya;
      document.removeEventListener("keydown", onKeyDown);
      tombol?.focus();
    };
  }, [buka, tutup, tombolRef]);

  if (!tampil) return null;

  return createPortal(
    <>
      {/* Scrimnya ikut memudar. `inert` di sini juga, supaya ia tidak menangkap
          klik selama fase menutup — panel yang meluncur keluar tidak boleh
          meninggalkan lapisan yang masih menutup halaman di belakangnya. */}
      <button
        type="button"
        className="reader-panel-scrim"
        data-menutup={!buka && sedangMenutup ? "" : undefined}
        aria-label="Tutup silabus kursus"
        onClick={tutup}
        inert={!buka && sedangMenutup}
      />
      <IsiPanelSilabus
        slug={slug}
        kursusJudul={kursusJudul}
        kursusPenyedia={kursusPenyedia}
        modul={modul}
        modulAktif={modulAktif}
        halamanAktif={halamanAktif}
        selesai={selesai}
        onTutup={tutup}
        panelRef={panelRef}
        // Selama fase menutup panelnya masih di DOM tetapi sudah tidak boleh
        // dijangkau: `inert` mengeluarkannya dari urutan Tab **dan** dari pohon
        // aksesibilitas sekaligus, jadi tidak ada tombol mati yang bisa
        // di-Tab-kan selama ~200ms animasi keluar.
        nonaktif={!buka && sedangMenutup}
        onSelesaiAnimasi={selesaiMenutup}
      />
    </>,
    document.body,
  );
}
