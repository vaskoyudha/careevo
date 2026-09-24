"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tombol unggah berkas di atas route handler `/api/unggah`.
 *
 * Memakai `XMLHttpRequest`, bukan `fetch`, karena hanya XHR yang melaporkan
 * progres unggahan — dan progres itulah alasan unggahan tidak lewat Server
 * Action (yang juga dibatasi 1 MB secara default).
 *
 * Gambar diperkecil dulu di klien sebelum dikirim supaya sampul kursus tidak
 * mengirim berkas kamera mentah beberapa megabita.
 */

const MAKS_GAMBAR_SISI = 1280;

async function perkecilGambar(berkas: File): Promise<File> {
  if (!berkas.type.startsWith("image/")) return berkas;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const pembaca = new FileReader();
    pembaca.onload = () => resolve(String(pembaca.result));
    pembaca.onerror = () => reject(new Error("Gagal membaca berkas gambar."));
    pembaca.readAsDataURL(berkas);
  });

  const gambar = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar."));
    img.src = dataUrl;
  });

  const skala = Math.min(1, MAKS_GAMBAR_SISI / Math.max(gambar.width, gambar.height));
  // Sudah cukup kecil: kirim apa adanya agar tidak kehilangan kualitas.
  if (skala === 1) return berkas;

  const kanvas = document.createElement("canvas");
  kanvas.width = Math.max(1, Math.round(gambar.width * skala));
  kanvas.height = Math.max(1, Math.round(gambar.height * skala));
  const ctx = kanvas.getContext("2d");
  if (!ctx) return berkas;
  ctx.drawImage(gambar, 0, 0, kanvas.width, kanvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    kanvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) return berkas;
  return new File([blob], berkas.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export interface HasilUnggah {
  path: string;
  ukuran_bytes: number;
  tipe_mime: string;
}

export function UnggahBerkas({
  courseId,
  subjekId,
  jenis = "dokumen",
  label,
  onSukses,
  className,
}: {
  courseId: string;
  /** Subfolder tujuan — biasanya id materi/modul. */
  subjekId?: string;
  jenis?: "gambar" | "dokumen";
  label?: string;
  onSukses: (hasil: HasilUnggah) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progres, setProgres] = useState<number | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const jalan = (berkas: File) => {
    setGalat(null);
    setProgres(0);

    void (async () => {
      let kirim = berkas;
      try {
        kirim = await perkecilGambar(berkas);
      } catch {
        // Perkecilan gagal bukan alasan membatalkan unggahan.
      }

      const data = new FormData();
      data.append("berkas", kirim);
      data.append("courseId", courseId);
      if (subjekId) data.append("subjekId", subjekId);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/unggah");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgres(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        setProgres(null);
        let jawaban: { ok?: boolean; path?: string; ukuran_bytes?: number; tipe_mime?: string; error?: string } =
          {};
        try {
          jawaban = JSON.parse(xhr.responseText) as typeof jawaban;
        } catch {
          setGalat("Respons server tidak dapat dibaca.");
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300 && jawaban.ok && jawaban.path) {
          onSukses({
            path: jawaban.path,
            ukuran_bytes: jawaban.ukuran_bytes ?? 0,
            tipe_mime: jawaban.tipe_mime ?? kirim.type,
          });
          return;
        }
        setGalat(jawaban.error ?? `Unggahan gagal (HTTP ${xhr.status}).`);
      };

      xhr.onerror = () => {
        setProgres(null);
        setGalat("Koneksi terputus saat mengunggah.");
      };

      xhr.send(data);
    })();
  };

  const sibuk = progres !== null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={sibuk}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sibuk ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : jenis === "gambar" ? (
          <ImagePlus className="size-4" aria-hidden="true" />
        ) : (
          <Upload className="size-4" aria-hidden="true" />
        )}
        {sibuk ? `Mengunggah… ${progres}%` : (label ?? (jenis === "gambar" ? "Unggah gambar" : "Unggah berkas"))}
      </button>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={jenis === "gambar" ? "image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp,application/pdf"}
        aria-label={label ?? "Unggah berkas"}
        onChange={(event) => {
          const berkas = event.target.files?.[0];
          // Reset supaya memilih berkas yang sama dua kali tetap memicu change.
          event.target.value = "";
          if (berkas) jalan(berkas);
        }}
      />

      {sibuk ? (
        <div
          role="progressbar"
          aria-valuenow={progres ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-48 overflow-hidden rounded-full bg-gray-200"
        >
          <div className="h-full bg-[#0056D2] transition-all" style={{ width: `${progres}%` }} />
        </div>
      ) : null}

      {galat ? (
        <p role="alert" className="text-xs text-red-600">
          {galat}
        </p>
      ) : null}
    </div>
  );
}
