"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  ambilReviewAction,
  buatSubmissionAction,
  kirimSubmissionAction,
  mulaiReviewAction,
  type ReviewState,
} from "@/actions/review";
import { Button } from "@/components/ui/button";

const awal: ReviewState = { ok: false };

/**
 * Form buat karya — sekarang **terikat satu course** (tidak ada dropdown kursus).
 *
 * Project hidup di dalam course (`/belajar/[slug]/karya`), jadi course dan
 * enrollment dikunci dari URL server page sebagai hidden field, bukan dipilih
 * klien. `siap` dipakai untuk menonaktifkan submit saat course belum memenuhi
 * syarat (belum selesai terverifikasi); status itu dihitung server, form tidak
 * menebaknya sendiri.
 */
export function BuatSubmissionForm({
  courseId,
  enrollmentId,
  slug,
  siap,
}: {
  courseId: string;
  enrollmentId: string;
  slug: string;
  siap: boolean;
}) {
  const [state, action, pending] = useActionState(buatSubmissionAction, awal);
  return (
    <form action={action} className="card">
      <h2 className="card-title">Buat karya</h2>
      <p className="card-sub">
        {siap
          ? "Karya untuk course ini. Judul dan deskripsi menjadi bahan penilaian verifikator."
          : "Selesaikan semua modul course ini lewat jalur terverifikasi untuk mengumpulkan karya."}
      </p>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="field"><label htmlFor="judul-submission">Judul karya</label><input id="judul-submission" name="judul" minLength={3} maxLength={160} required /></div>
      <div className="field"><label htmlFor="catatan-submission">Deskripsi karya</label><textarea id="catatan-submission" name="catatan" minLength={10} maxLength={5000} rows={5} /></div>
      <Button type="submit" disabled={pending || !siap}>{pending ? "Menyimpan..." : "Buat draf"}</Button>
      {state.error && <p role="alert" className="alert alert-danger">{state.error}</p>}
      {state.ok && state.submissionId && <p role="status" className="alert alert-ok">Draf dibuat. <Link href={`/belajar/${slug}/karya/${state.submissionId}`}>Lihat draf</Link></p>}
    </form>
  );
}

export function TransisiSubmission({
  submissionId,
  slug,
  jenis,
}: {
  submissionId: string;
  slug?: string;
  jenis: "kirim" | "ambil" | "mulai";
}) {
  const action = jenis === "kirim" ? kirimSubmissionAction : jenis === "ambil" ? ambilReviewAction : mulaiReviewAction;
  const [state, formAction, pending] = useActionState(action, awal);
  const label = jenis === "kirim" ? "Kirim karya" : jenis === "ambil" ? "Ambil review" : "Mulai review";
  return (
    <form action={formAction}>
      <input type="hidden" name="submissionId" value={submissionId} />
      {slug ? <input type="hidden" name="slug" value={slug} /> : null}
      <Button type="submit" disabled={pending || state.ok}>{pending ? "Memproses..." : label}</Button>
      {state.error && <p role="alert" className="alert alert-danger">{state.error}</p>}
      {state.ok && <p role="status" className="alert alert-ok">{state.message}</p>}
    </form>
  );
}
