"use client";

import { useEffect, useRef, useState } from "react";
import {
  bagiDariGeser,
  bagiDariPapanKetik,
  bacaBagi,
  kePersen,
  BAGI_AWAL,
  MIN_KIRI,
  MIN_KANAN,
} from "@/lib/learning/bagi-lab";
import { setPersistentValue, usePersistentValue } from "@/lib/hooks/use-persistent-state";

/**
 * Pembagi dua kolom lab — bisa diseret dan digerakkan papan ketik.
 *
 * ## Kenapa pembagiannya ditulis di wadah, bukan di kolomnya
 *
 * Nilainya sampai ke browser sebagai `grid-template-columns` di wadah grid
 * (lewat custom property `--lab-bagi` yang ditulis `kode-lab.tsx`). Menulis
 * `flex-basis`/`width` ke masing-masing kolom berarti dua nilai yang bisa tidak
 * sinkron; satu deklarasi di wadah hanya punya satu sumber kebenaran.
 *
 * ## Kenapa `role="separator"` yang bisa difokus, bukan `role="slider"`
 *
 * Ini pemisah antar-panel, bukan kontrol bernilai. Pola ARIA untuk pemisah yang
 * bisa digerakkan adalah `separator` + `aria-valuenow`/`aria-valuemin`/
 * `aria-valuemax`, dan itu yang diumumkan pembaca layar sebagai "pemisah, 50
 * persen". `tabIndex={0}` wajib: tanpa itu satu-satunya cara mengubah lebarnya
 * adalah menyeret, dan pengguna keyboard kehilangan fiturnya.
 *
 * ## Kenapa tidak ada state untuk nilai tersimpan
 *
 * Pembagian yang dipakai **selalu** diturunkan ulang: pilihan lokal menang,
 * kalau belum ada baru nilai tersimpan, kalau itu pun tidak ada baru
 * `BAGI_AWAL`. Tidak ada `setState` sinkronisasi, jadi tidak ada render kedua
 * dan tidak ada nilai yang bisa tertinggal dari `localStorage`.
 */
export function PembagiLab({
  kunci,
  bagi,
  onBagi,
}: {
  /** Kunci `localStorage`; satu per halaman lab. */
  kunci: string;
  /** Fraksi 0–1 yang berlaku saat ini. */
  bagi: number;
  onBagi: (bagi: number) => void;
}) {
  const [menyeret, setMenyeret] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  /**
   * Wadah grid: induk langsung pembagi ini, tempat `--lab-bagi` dibaca.
   *
   * Dibaca saat dipakai (bukan disimpan di ref sejak mount): pembagi ini baru
   * punya induk setelah React memasangnya, dan `parentElement` sudah menunjuk
   * elemen yang benar saat pointer benar-benar dipakai.
   */
  const wadah = () => ref.current?.parentElement ?? null;

  /**
   * Publikasikan lantai lebar kolom ke wadah.
   *
   * Angkanya hidup di `bagi-lab.ts` (dipakai juga oleh penjepit seret dan
   * papan ketik), dan CSS hanya membacanya lewat custom property. Menyalin
   * `280px`/`340px` ke `globals.css` berarti dua tempat yang harus diingat
   * bersama setiap kali minimumnya diubah — dan kalau keduanya berbeda,
   * penjepit dan `min-width` akan bertengkar: garisnya berhenti di satu titik di
   * layar, sedangkan nilai yang diumumkan pembaca layar menyebut titik lain.
   */
  useEffect(() => {
    const w = wadah();
    if (!w) return;
    w.style.setProperty("--lab-min-kiri", `${MIN_KIRI}px`);
    w.style.setProperty("--lab-min-kanan", `${MIN_KANAN}px`);
  }, []);

  const mulaiSeret = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return; // klik kanan tidak memulai seret
    event.preventDefault();
    const w = wadah();
    if (!w) return;
    ref.current?.setPointerCapture(event.pointerId);
    setMenyeret(true);

    /**
     * Nilai terakhir selama seret, disimpan di variabel closure ini.
     *
     * `onBagi` (setter state di induk) belum tentu sudah menurunkan render
     * berikutnya saat pointer dilepas, jadi membaca `bagi` dari prop akan
     * menulis nilai yang tertinggal satu peristiwa ke `localStorage`. Variabel
     * ini mencatat apa yang benar-benar terakhir dikirim, dan itulah yang
     * disimpan.
     */
    let terakhir = bagi;

    const geser = (e: PointerEvent) => {
      const kotak = w.getBoundingClientRect();
      terakhir = bagiDariGeser({ x: e.clientX - kotak.left, lebarWadah: kotak.width });
      onBagi(terakhir);
    };
    const lepas = () => {
      setMenyeret(false);
      setPersistentValue(kunci, String(terakhir));
      ref.current?.releasePointerCapture?.(event.pointerId);
      window.removeEventListener("pointermove", geser);
      window.removeEventListener("pointerup", lepas);
      window.removeEventListener("pointercancel", lepas);
      document.body.classList.remove("lab-menyeret");
    };

    window.addEventListener("pointermove", geser);
    window.addEventListener("pointerup", lepas);
    window.addEventListener("pointercancel", lepas);
    // Kursor dikunci dan seleksi teks dimatikan selama seret: tanpa itu,
    // menyeret melintasi kolom kiri ikut menyorot prosanya dan kursor berkedip
    // balik jadi panah begitu pointer keluar dari garis pembagi.
    document.body.classList.add("lab-menyeret");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const w = wadah();
    if (!w) return;
    const tombol = event.key;
    if (tombol !== "ArrowLeft" && tombol !== "ArrowRight" && tombol !== "Home" && tombol !== "End") {
      return;
    }
    const hasil = bagiDariPapanKetik({
      bagi,
      tombol,
      lebarWadah: w.getBoundingClientRect().width,
    });
    if (hasil === null) return;
    event.preventDefault();
    onBagi(hasil);
    setPersistentValue(kunci, String(hasil));
  };

  const persen = kePersen(bagi);

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label="Ubah lebar materi dan editor"
      aria-valuenow={persen}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`Materi ${persen} persen, editor ${100 - persen} persen`}
      tabIndex={0}
      data-menyeret={menyeret ? "true" : undefined}
      onPointerDown={mulaiSeret}
      onKeyDown={onKeyDown}
      onDoubleClick={() => {
        // Jalan keluar cepat tanpa menyeret presisi.
        onBagi(BAGI_AWAL);
        setPersistentValue(kunci, String(BAGI_AWAL));
      }}
      title="Seret untuk mengubah lebar, klik dua kali untuk kembali seimbang."
      className="lab-pembagi"
    >
      <span aria-hidden="true" className="lab-pembagi-grip" />
    </div>
  );
}

/**
 * Proporsi pembagi untuk satu halaman lab.
 *
 * Kuncinya memuat id halaman: pembagian yang dipilih untuk latihan panjang tidak
 * selalu yang diinginkan di halaman lain, dan satu kunci global membuat satu
 * pilihan menimpa semua halaman.
 *
 * Pilihan lokal (`pilihan`) menang atas nilai tersimpan supaya seretan terasa
 * langsung — menunggu `localStorage` dan event `change`-nya akan membuat garis
 * pembagi tertinggal satu peristiwa di belakang pointer. Nilai tersimpan dibaca
 * sebagai nilai awal, dan itu juga yang membuat pilihan bertahan setelah muat
 * ulang.
 */
export function useBagiLab(halamanId: string) {
  const kunci = `careevo.lab.bagi.${halamanId}`;
  const mentah = usePersistentValue(kunci);
  const [pilihan, setPilihan] = useState<number | null>(null);

  const bagi = pilihan ?? bacaBagi(mentah) ?? BAGI_AWAL;
  return { kunci, bagi, setBagi: setPilihan };
}
