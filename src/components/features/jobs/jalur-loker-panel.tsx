"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  buatJalurLokerAction,
  type JalurLokerState,
} from "@/actions/loker-persiapan";

/**
 * Jalur penguasaan yang disusun dari syarat sebuah lowongan.
 *
 * Bedanya dari panel kursus ada di arah kegagalannya, dan itu disengaja. Daftar
 * kursus ditentukan deterministic, jadi tetap benar tanpa model. Jalur ini
 * tidak: poinnya harus dibaca dari deskripsi lowongan, jadi tidak ada model =
 * tidak ada jalur. Panel menampilkan pesan itu apa adanya, bukan pohon tebakan
 * — pohon tebakan akan terlihat seperti rencana yang sudah dipikirkan, dan itu
 * persis yang tidak boleh terjadi di sini.
 *
 * Form + `useActionState` (bukan `useTransition` seperti panel kursus) karena
 * aksi ini MENYIMPAN sesuatu. Dengan form, jalur tetap bisa dibuat tanpa
 * JavaScript, dan `pending` tetap men-disable tombol supaya klik ganda tidak
 * membuat topik ganda (aksi itu sendiri juga mengembalikan topik yang sudah
 * ada, jadi ada dua lapis perlindungan).
 */
export function JalurLokerPanel({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState<JalurLokerState, FormData>(
    buatJalurLokerAction,
    { status: "idle" },
  );

  if (state.status === "success") {
    return (
      <div>
        <p className="alert alert-ok" style={{ marginTop: 0 }}>
          Jalur penguasaan sudah dibuat dari syarat lowongan ini.
        </p>
        <Button asChild size="sm" style={{ marginTop: "0.75rem" }}>
          <Link href={`/belajar/mastery/${state.topicId}`}>Buka jalur penguasaan</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Ubah syarat lowongan ini menjadi poin-poin yang bisa diuji dan dijadwalkan ulang, lalu
        lacak penguasaanmu di Jalur Penguasaan.
      </p>
      <form action={formAction} style={{ marginTop: "0.75rem" }}>
        <input type="hidden" name="jobId" value={jobId} />
        <Button type="submit" variant="brand" size="sm" disabled={pending}>
          {pending ? "Menyusun jalur…" : "Buat jalur penguasaan"}
        </Button>
        {state.status === "error" ? (
          <p className="alert alert-warn" role="status" style={{ marginTop: "0.75rem" }}>
            {state.message}
          </p>
        ) : null}
      </form>
      <p className="caption muted" style={{ marginTop: "0.75rem" }}>
        Butuh model AI. Satu lowongan dibuat satu jalur aktif — klik lagi akan membuka jalur yang
        sudah ada, bukan membuat yang baru.
      </p>
    </div>
  );
}
