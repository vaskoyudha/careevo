"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  rekomendasiKursusLokerAction,
  type RekomendasiState,
} from "@/actions/loker-persiapan";
import { ringkasEntri } from "@/components/features/dashboard/jelajah/format";

/**
 * Kursus katalog yang cocok dengan satu lowongan.
 *
 * Daftarnya bukan hasil model's: `rekomendasiKursusUntukLoker` yang memilih,
 * dengan skor deterministic. Model hanya menulis alasan per kursus, dan setiap
 * id yang dikembalikannya diperiksa terhadap shortlist itu. Jadi daftar kursus
 * TETAP tampil tanpa model — yang hilang hanya kalimat alasannya.
 *
 * Berbeda dengan panel A–H di halaman yang sama, yang menampilkan pesan gagal
 * ketika model mati. Di situ angka skornya yang jadi artifak, jadi memang tidak
 * ada yang bisa ditampilkan. Di sini kursusnya yang jadi artifak, dan pilihan
 * deterministik itu benar tanpa model — menampilkan error karena tidak ada
 * alasan akan menyembunyikan rekomendasi yang sah.
 *
 * Pola interaksinya meniru `EvaluasiPanel` di halaman yang sama: tombol +
 * `useTransition`, bukan form, karena ini pembacaan sekali jalan yang tidak
 * menulis apa pun.
 */
export function RekomendasiKursusPanel({ jobId }: { jobId: string }) {
  const [state, setState] = useState<RekomendasiState | null>(null);
  const [pending, startTransition] = useTransition();

  function lihat() {
    startTransition(async () => {
      setState(await rekomendasiKursusLokerAction(jobId));
    });
  }

  if (pending) {
    return (
      <div>
        <p className="muted" aria-live="polite">
          Mencari kursus di katalog yang cocok dengan lowongan ini…
        </p>
        <div className="skeleton" style={{ height: 8, marginTop: "0.75rem" }} />
      </div>
    );
  }

  if (!state) {
    return (
      <div>
        <p className="muted" style={{ marginTop: 0 }}>
          Belum dilihat. Kursus dipilih dari katalog dengan membandingkan tag dan isi lowongan,
          lalu AI menjelaskan kenapa tiap kursus cocok.
        </p>
        <Button type="button" variant="brand" size="sm" onClick={lihat} style={{ marginTop: "0.75rem" }}>
          Rekomendasikan kursus
        </Button>
      </div>
    );
  }

  if (!state.ok) {
    return (
      <div>
        <p className="alert alert-warn" role="status">
          {state.pesan}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={lihat} style={{ marginTop: "0.75rem" }}>
          Coba lagi
        </Button>
      </div>
    );
  }

  return (
    <div>
      {state.kursus.length === 0 ? (
        <p className="muted" style={{ marginTop: 0 }}>
          Tidak ada kursus di katalog yang cocok dengan lowongan ini. Katalog yang belum punya
          materi tentang skill yang diminta lowongan.
        </p>
      ) : (
        <>
          {state.ringkasan ? (
            <p className="caption muted" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
              {state.ringkasan}
            </p>
          ) : null}
          <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {state.kursus.map(({ entry, alasan }) => (
              <li className="list-app-row" key={entry.id} data-kursus-rekomendasi={entry.id}>
                <span className="row-title">
                  <Link href={`/belajar/${entry.slug}`} className="font-semibold">
                    {entry.title}
                  </Link>
                </span>
                <span className="row-meta">{ringkasEntri(entry.provider, entry.duration_min, entry.level)}</span>
                {alasan ? <span className="caption muted">{alasan}</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      <Button type="button" variant="ghost" size="sm" onClick={lihat} style={{ marginTop: "0.75rem" }}>
        Hitung ulang
      </Button>
    </div>
  );
}
