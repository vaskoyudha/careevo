"use client";

import { useActionState } from "react";
import { catatPelanggaranAction, type PelanggaranState } from "@/actions/integritas";
import { DAFTAR_PELANGGARAN } from "@/lib/integritas/katalog";

/**
 * Form pencatatan pelanggaran integritas — panel verifikator.
 *
 * Ini adalah **satu-satunya** jalan masuk ke `integrity_violations`, dan itu
 * disengaja: skor kejujuran adalah keputusan yang merugikan orang, jadi
 * prosecutor-nya tidak boleh bisa terlihat oleh peramban peserta, dan tidak ada
 * jalur otomatis yang menulis tabel itu.
 *
 * Yang **tidak** ada di form ini, dan itu yang paling penting:
 *
 * - **Tidak ada field penalti.** Bobot disalin dari `KATALOG_PELANGGARAN` di
 *   server. Field "berapa poin" di sini berarti reviewer bisa memilih sendiri
 *   ukurannya, dan angka yang tampil di dashboard peserta tidak lagi berarti
 *   apa-apa.
 * - **Tidak ada pilihan "hapus".** Satu-satunya tindakan yang tersedia adalah
 *   mencatat, dengan alasan yang wajib ditulis supaya keputusan bisa ditinjau
 *   ulang. Pemulihan punya jalurnya sendiri: menyelesaikan ulang course sampai
 *   tuntas, atau keputusan staf yang juga mencatat alasannya.
 *
 * `KATALOG_PELANGGARAN` diimpor ke klien **hanya** untuk mengisi `<select>`;
 * `label`/`detail`-nya adalah teks yang sudah dijaga bebas kata vonis oleh
 * `katalog.test.ts`. Tabelnya sendiri tetap server-only, dan modul ini tidak
 * pernah mengimpornya.
 */

/** Course yang sedang dilihat peserta, untuk mengisi pilihan tanpa mengetik id. */
export interface OpsiCourse {
  courseId: string;
  /** Id course untuk `revalidatePath`; `null` kalau slug-nya tidak diketahui. */
  slug: string | null;
}

const STATE_AWAL: PelanggaranState = { ok: false };

export function FormPelanggaran({
  userId,
  course,
}: {
  userId: string;
  course: OpsiCourse[];
}) {
  const [state, aksi, pending] = useActionState(catatPelanggaranAction, STATE_AWAL);

  // Tanpa course, form tidak bisa dikirim karena pencatatan butuh enrollment
  // milik peserta pada course itu. Menampilkan form yang selalu gagal adalah
  // lebih buruk daripada menjelaskan kenapa form ini tidak muncul.
  if (course.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Peserta ini tidak punya enrollment, jadi belum ada course tempat catatan
        integritas bisa dicatat. Catatan hanya bisa dilampirkan pada course yang
        benar-benar diikuti.
      </p>
    );
  }

  return (
    <form action={aksi} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />

      <div>
        <label className="block text-sm font-medium" htmlFor="course-pelanggaran">
          Course
        </label>
        <select
          id="course-pelanggaran"
          name="courseId"
          required
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {course.map((c) => (
            <option key={c.courseId} value={c.courseId}>
              {c.courseId}
            </option>
          ))}
        </select>
        <input type="hidden" name="slug" value={course[0]?.slug ?? ""} />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="jenis-pelanggaran">
          Jenis catatan
        </label>
        <select
          id="jenis-pelanggaran"
          name="kind"
          required
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {DAFTAR_PELANGGARAN.map((d) => (
            <option key={d.jenis} value={d.jenis}>
              {d.label} ({d.tingkat})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Bobotnya ditentukan server dari jenis ini dan tidak bisa diubah dari
          sini. Yang bisa kamu isi adalah alasan dan buktinya.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="alasan-pelanggaran">
          Alasan yang bisa ditinjau
        </label>
        <textarea
          id="alasan-pelanggaran"
          name="reason"
          required
          minLength={10}
          rows={3}
          placeholder="Apa yang tercatat, dan dari mana. Contoh: 4× paste di atas 200 karakter saat asesmen modul 3."
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Minimal 10 karakter. Alasan ini tersimpan permanen di audit dan ikut
          menentukan besarnya penalti, jadi tulis yang bisa diverifikasi orang lain
          yang tidak melihat layarmu.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00419e] disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : "Catat dan potong skor"}
        </button>
        {state.ok ? (
          <p className="text-sm text-emerald-700" role="status">
            {state.message}
          </p>
        ) : null}
        {state.error ? (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
