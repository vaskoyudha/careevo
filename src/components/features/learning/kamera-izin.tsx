"use client";

import { useEffect, useRef, useState } from "react";
import {
  PemantauWajah,
  perluCatatWajahHilang,
  type StatusWajah,
} from "@/lib/learning/kamera-klien";

/**
 * Dialog persetujuan kamera untuk sesi terverifikasi.
 *
 * **Izin adalah dua langkah yang terpisah, dan itu disengaja.** "Mulai sesi"
 * tidak pernah otomatis menyalakan kamera: kamera merekam wajah orang, itu data
 * pribadi, dan persetujuan untuk merekam kegiatan belajar berbeda dari
 * persetujuan untuk merekam wajah.
 *
 * Menolak tidak pernah error dan tidak memblokir belajar — pada course `wajib`
 * biasa, peserta yang menolak kamera tetap menyelesaikan modul lewat jalur
 * `terverifikasi`. Hanya course `wajib_kamera` yang menuntutnya.
 *
 * Yang dikirim ke server hanya **angka** (jumlah wajah, durasi). Video tidak
 * pernah meninggalkan perangkat ini.
 *
 * Pelaporan kejadian lahir dari sini, bukan dari provider sesi, supaya tidak
 * ada jalur kedua yang bisa menyalakan kamera tanpa klik peserta. Persis satu
 * tempat: `lapor` di bawah.
 */
export function KameraIzin({
  on,
  lapor,
}: {
  /** Dipanggil saat status kamera berubah; provider meneruskannya ke mesin akses. */
  on: (aktif: boolean) => void;
  /**
   * Laporkan satu kejadian kamera ke server.
   *
   * Diberikan pemanggil (provider) karena hanya ia yang punya `runId` dan
   * `catatKejadianAction`; komponen ini tidak menyentuh server action langsung.
   * `detail` opsional, sudah berupa angka/teks pendek.
   */
  lapor: (
    jenis: "kamera_mulai" | "kamera_berhenti" | "kamera_gagal" | "wajah_tidak_terdeteksi" | "wajah_kedua",
    detail?: string,
  ) => void;
}) {
  const [status, setStatus] = useState<"mati" | "menyala" | "gagal">("mati");
  const [wajah, setWajah] = useState<StatusWajah>("tidak_ada");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pemantauRef = useRef<PemantauWajah | null>(null);
  /**
   * Kunci kejadian terakhir yang sudah dilaporkan.
   *
   * `PemantauWajah` memanggil balik tiap frame (≈60×/detik). Tanpa kunci,
   * satu kondisi wajah yang sama akan menulis ratusan `learning_events`
   * identik dan tabel riwayat peserta jadi tidak terbaca. Kuncinya memuat
   * **transisi** yang dilaporkan, bukan statusnya: `wajah_kedua` hanya dicatat
   * sekali per kemunculan, dan `tidak_ada` hanya setelah melewati ambang.
   */
  const kunciTerakhir = useRef<string | null>(null);

  useEffect(() => {
    return () => pemantauRef.current?.berhenti();
  }, []);

  async function nyalakan() {
    const video = videoRef.current;
    if (!video) return;
    const pemantau = new PemantauWajah((h) => {
      setWajah(h.status);
      // `wajah_kedua` adalah fakta terukur satu kali per kemunculan; celah
      // "wajah hilang" hanya setelah ambang. Keduanya dibentuk dari status
      // yang sudah disempitkan `statusWajah`, bukan angka mentah model.
      if (h.status === "lebih_dari_satu" && kunciTerakhir.current !== "kedua") {
        kunciTerakhir.current = "kedua";
        lapor("wajah_kedua", "Lebih dari satu wajah terdeteksi pada satu frame.");
        return;
      }
      if (h.status !== "lebih_dari_satu" && kunciTerakhir.current === "kedua") {
        kunciTerakhir.current = null;
      }
      const celah = perluCatatWajahHilang(h.status, h.sejakMs, Date.now());
      if (celah && kunciTerakhir.current !== "hilang") {
        kunciTerakhir.current = "hilang";
        lapor("wajah_tidak_terdeteksi", `Wajah tidak terlihat selama ${celah.durasi_detik} detik.`);
        return;
      }
      if (!celah && kunciTerakhir.current === "hilang" && h.status !== "tidak_ada") {
        kunciTerakhir.current = null;
      }
    });
    pemantauRef.current = pemantau;
    const ok = await pemantau.mulai(video);
    if (!ok) {
      setStatus("gagal");
      on(false);
      lapor("kamera_gagal", "Kamera tidak bisa dinyalakan (izin ditolak atau model gagal dimuat).");
      return;
    }
    setStatus("menyala");
    on(true);
    lapor("kamera_mulai");
  }

  function matikan() {
    pemantauRef.current?.berhenti();
    pemantauRef.current = null;
    kunciTerakhir.current = null;
    setStatus("mati");
    setWajah("tidak_ada");
    on(false);
    lapor("kamera_berhenti", "Kamera dimatikan peserta.");
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-sky-900">Pengawasan kamera</span>
        <span className="text-xs text-sky-800">
          {status === "menyala"
            ? wajah === "satu"
              ? "Wajah terdeteksi."
              : wajah === "lebih_dari_satu"
                ? "Lebih dari satu wajah terdeteksi — ini dicatat sebagai catatan."
                : "Wajah belum terlihat di depan kamera."
            : status === "gagal"
              ? "Kamera tidak bisa dinyalakan. Dicatat sebagai gangguan teknis, bukan tanda kamu menolak."
              : "Kamera dipakai untuk menghitung apakah wajah ada, bukan merekam atau mengenali wajahmu."}
        </span>
        <button
          type="button"
          onClick={() => void nyalakan()}
          disabled={status === "menyala"}
          className="ml-auto cursor-pointer rounded-full bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {status === "menyala" ? "Kamera menyala" : "Nyalakan kamera"}
        </button>
        {status === "menyala" ? (
          <button
            type="button"
            onClick={matikan}
            className="cursor-pointer text-xs font-semibold text-sky-900 underline"
          >
            Matikan
          </button>
        ) : null}
      </div>
      {/* Video hanya untuk pemrosesan lokal. `hidden` mencegah frame tampil,
          dan `aria-hidden` menahannya di luar accessibility tree. */}
      <video ref={videoRef} hidden aria-hidden="true" className="sr-only" />
    </div>
  );
}
