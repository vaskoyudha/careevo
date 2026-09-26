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

type PilihanKursus = { courseId: string; enrollmentId: string; title: string };

export function BuatSubmissionForm({ pilihan }: { pilihan: PilihanKursus[] }) {
  const [state, action, pending] = useActionState(buatSubmissionAction, awal);
  return (
    <form action={action} className="card">
      <h2 className="card-title">Buat karya</h2>
      <p className="card-sub">Pilih kursus yang telah selesai melalui jalur terverifikasi.</p>
      <div className="field">
        <label htmlFor="kursus-submission">Kursus</label>
        <select id="kursus-submission" name="enrollmentId" required defaultValue="">
          <option value="" disabled>Pilih kursus</option>
          {pilihan.map((item) => <option key={item.enrollmentId} value={item.enrollmentId}>{item.title}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="judul-submission">Judul karya</label><input id="judul-submission" name="judul" minLength={3} maxLength={160} required /></div>
      <div className="field"><label htmlFor="catatan-submission">Deskripsi karya</label><textarea id="catatan-submission" name="catatan" minLength={10} maxLength={5000} rows={5} required /></div>
      <Button type="submit" disabled={pending || pilihan.length === 0}>{pending ? "Menyimpan..." : "Buat draf"}</Button>
      {state.error && <p role="alert" className="alert alert-danger">{state.error}</p>}
      {state.ok && state.submissionId && <p role="status" className="alert alert-ok">Draf dibuat. <Link href={`/submission/${state.submissionId}`}>Lihat draf</Link></p>}
    </form>
  );
}

export function TransisiSubmission({ submissionId, jenis }: { submissionId: string; jenis: "kirim" | "ambil" | "mulai" }) {
  const action = jenis === "kirim" ? kirimSubmissionAction : jenis === "ambil" ? ambilReviewAction : mulaiReviewAction;
  const [state, formAction, pending] = useActionState(action, awal);
  const label = jenis === "kirim" ? "Kirim karya" : jenis === "ambil" ? "Ambil review" : "Mulai review";
  return (
    <form action={formAction}>
      <input type="hidden" name="submissionId" value={submissionId} />
      <Button type="submit" disabled={pending || state.ok}>{pending ? "Memproses..." : label}</Button>
      {state.error && <p role="alert" className="alert alert-danger">{state.error}</p>}
      {state.ok && <p role="status" className="alert alert-ok">{state.message}</p>}
    </form>
  );
}
