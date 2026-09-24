"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  ambilResume,
  hapusBerkas,
  simpanBerkas,
  simpanResume,
} from "@/lib/resume/store";
import {
  MAX_ENTRIES,
  buatId,
  validasiBerkas,
  type BerkasUpload,
  type Pendidikan,
  type Resume,
  type RiwayatKerja,
  type RiwayatProyek,
  type Sertifikasi,
  type Slot,
} from "@/lib/resume/types";

export interface ResumeFormState {
  ok: boolean;
  message?: string;
}

const OK = (message: string): ResumeFormState => ({ ok: true, message });
const GAGAL = (message: string): ResumeFormState => ({ ok: false, message });

/** Read the caller's resume or an empty one, after the session check. */
async function resumePemanggil(): Promise<{ owner: string; resume: Resume } | null> {
  const session = await getSession();
  if (!session) return null;
  const resume = await ambilResume(session.email);
  // Keep the public handle in sync with the session so /p/[username] resolves.
  return { owner: session.email, resume: { ...resume, username: resume.username || session.username } };
}

function brs(value: FormDataEntryValue | null, max = 300): string {
  return String(value ?? "").trim().slice(0, max);
}

function segarkan() {
  revalidatePath("/profil");
  revalidatePath("/p/[username]", "page");
}

/**
 * Save the scalar resume fields (headline, about, contact links). List sections
 * have their own actions so one editor's failure cannot clobber another's.
 */
export async function simpanProfilRingkasAction(
  _prev: ResumeFormState,
  formData: FormData,
): Promise<ResumeFormState> {
  const ctx = await resumePemanggil();
  if (!ctx) return GAGAL("Sesi berakhir. Masuk ulang dulu.");

  const username = brs(formData.get("username"), 24).replace(/^@/, "");
  if (username && !/^[a-zA-Z0-9._-]{3,24}$/.test(username)) {
    return GAGAL("Username 3–24 karakter, hanya huruf, angka, titik, strip, atau garis bawah.");
  }

  const next: Resume = {
    ...ctx.resume,
    username: username || ctx.resume.username,
    headline: brs(formData.get("headline"), 140),
    ringkasan: brs(formData.get("ringkasan"), 2000),
    kontak: {
      lokasi: brs(formData.get("lokasi"), 120),
      telepon: brs(formData.get("telepon"), 40),
      linkedin: brs(formData.get("linkedin"), 200),
      github: brs(formData.get("github"), 200),
      situs: brs(formData.get("situs"), 200),
    },
  };

  await simpanResume(next);
  segarkan();
  return OK("Profil ringkas tersimpan.");
}

/** Add or update one work-history entry. */
export async function simpanPengalamanAction(
  _prev: ResumeFormState,
  formData: FormData,
): Promise<ResumeFormState> {
  const ctx = await resumePemanggil();
  if (!ctx) return GAGAL("Sesi berakhir. Masuk ulang dulu.");

  const jabatan = brs(formData.get("jabatan"), 120);
  const perusahaan = brs(formData.get("perusahaan"), 120);
  if (!jabatan || !perusahaan) return GAGAL("Jabatan dan perusahaan wajib diisi.");

  const id = brs(formData.get("id")) || buatId();
  const entry: RiwayatKerja = {
    id,
    jabatan,
    perusahaan,
    periode: brs(formData.get("periode"), 60),
    lokasi: brs(formData.get("lokasi"), 120),
    deskripsi: brs(formData.get("deskripsi"), 1000),
  };

  const list = ctx.resume.pengalaman.filter((item) => item.id !== id);
  list.unshift(entry);
  await simpanResume({ ...ctx.resume, pengalaman: list.slice(0, MAX_ENTRIES) });
  segarkan();
  return OK("Riwayat kerja tersimpan.");
}

export async function hapusPengalamanAction(formData: FormData): Promise<void> {
  const ctx = await resumePemanggil();
  if (!ctx) return;
  const id = brs(formData.get("id"));
  await simpanResume({
    ...ctx.resume,
    pengalaman: ctx.resume.pengalaman.filter((item) => item.id !== id),
  });
  segarkan();
}

/** Add or update one project entry. */
export async function simpanProyekAction(
  _prev: ResumeFormState,
  formData: FormData,
): Promise<ResumeFormState> {
  const ctx = await resumePemanggil();
  if (!ctx) return GAGAL("Sesi berakhir. Masuk ulang dulu.");

  const nama = brs(formData.get("nama"), 140);
  if (!nama) return GAGAL("Nama proyek wajib diisi.");

  const id = brs(formData.get("id")) || buatId();
  const entry: RiwayatProyek = {
    id,
    nama,
    deskripsi: brs(formData.get("deskripsi"), 1000),
    url: brs(formData.get("url"), 300),
    repo: brs(formData.get("repo"), 300),
  };

  const list = ctx.resume.proyek.filter((item) => item.id !== id);
  list.unshift(entry);
  await simpanResume({ ...ctx.resume, proyek: list.slice(0, MAX_ENTRIES) });
  segarkan();
  return OK("Proyek tersimpan.");
}

export async function hapusProyekAction(formData: FormData): Promise<void> {
  const ctx = await resumePemanggil();
  if (!ctx) return;
  const id = brs(formData.get("id"));
  await simpanResume({
    ...ctx.resume,
    proyek: ctx.resume.proyek.filter((item) => item.id !== id),
  });
  segarkan();
}

/** Add or update one education entry. */
export async function simpanPendidikanAction(
  _prev: ResumeFormState,
  formData: FormData,
): Promise<ResumeFormState> {
  const ctx = await resumePemanggil();
  if (!ctx) return GAGAL("Sesi berakhir. Masuk ulang dulu.");

  const institusi = brs(formData.get("institusi"), 160);
  if (!institusi) return GAGAL("Nama institusi wajib diisi.");

  const id = brs(formData.get("id")) || buatId();
  const entry: Pendidikan = {
    id,
    institusi,
    jurusan: brs(formData.get("jurusan"), 160),
    periode: brs(formData.get("periode"), 60),
  };

  const list = ctx.resume.pendidikan.filter((item) => item.id !== id);
  list.unshift(entry);
  await simpanResume({ ...ctx.resume, pendidikan: list.slice(0, MAX_ENTRIES) });
  segarkan();
  return OK("Pendidikan tersimpan.");
}

export async function hapusPendidikanAction(formData: FormData): Promise<void> {
  const ctx = await resumePemanggil();
  if (!ctx) return;
  const id = brs(formData.get("id"));
  await simpanResume({
    ...ctx.resume,
    pendidikan: ctx.resume.pendidikan.filter((item) => item.id !== id),
  });
  segarkan();
}

/** Replace the skill list from a comma-separated input. */
export async function simpanSkillAction(
  _prev: ResumeFormState,
  formData: FormData,
): Promise<ResumeFormState> {
  const ctx = await resumePemanggil();
  if (!ctx) return GAGAL("Sesi berakhir. Masuk ulang dulu.");

  const skill = brs(formData.get("skill"), 1000)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);

  await simpanResume({ ...ctx.resume, skill });
  segarkan();
  return OK("Skill tersimpan.");
}

/** Add or update one certification. */
export async function simpanSertifikatAction(
  _prev: ResumeFormState,
  formData: FormData,
): Promise<ResumeFormState> {
  const ctx = await resumePemanggil();
  if (!ctx) return GAGAL("Sesi berakhir. Masuk ulang dulu.");

  const nama = brs(formData.get("nama"), 160);
  if (!nama) return GAGAL("Nama sertifikat wajib diisi.");

  const id = brs(formData.get("id")) || buatId();
  const entry: Sertifikasi = {
    id,
    nama,
    penerbit: brs(formData.get("penerbit"), 160),
    url: brs(formData.get("url"), 300),
  };

  const list = ctx.resume.sertifikasi.filter((item) => item.id !== id);
  list.unshift(entry);
  await simpanResume({ ...ctx.resume, sertifikasi: list.slice(0, MAX_ENTRIES) });
  segarkan();
  return OK("Sertifikat tersimpan.");
}

export async function hapusSertifikatAction(formData: FormData): Promise<void> {
  const ctx = await resumePemanggil();
  if (!ctx) return;
  const id = brs(formData.get("id"));
  await simpanResume({
    ...ctx.resume,
    sertifikasi: ctx.resume.sertifikasi.filter((item) => item.id !== id),
  });
  segarkan();
}

/**
 * Handle a CV / portfolio PDF upload.
 *
 * Validation is server-side and authoritative: the browser `accept=".pdf"` is
 * a hint a crafted request ignores. We check both the declared MIME type AND
 * the `%PDF-` magic bytes, because a client controls the former.
 */
export async function unggahBerkasAction(
  _prev: ResumeFormState,
  formData: FormData,
): Promise<ResumeFormState> {
  const ctx = await resumePemanggil();
  if (!ctx) return GAGAL("Sesi berakhir. Masuk ulang dulu.");

  const slot = brs(formData.get("slot")) as Slot;
  if (slot !== "cv" && slot !== "portofolio") return GAGAL("Jenis berkas tidak dikenal.");

  const file = formData.get("file");
  if (!(file instanceof File)) return GAGAL("Pilih file PDF dulu.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const cek = validasiBerkas({ size: file.size, type: file.type, bytes });
  if (!cek.ok) return GAGAL(cek.pesan);

  const meta = await simpanBerkas(ctx.owner, slot, file.name, bytes);
  await simpanResume({
    ...ctx.resume,
    berkas: { ...ctx.resume.berkas, [slot]: meta },
  });
  segarkan();
  return OK(slot === "cv" ? "CV terunggah." : "Portofolio terunggah.");
}

/** Remove an uploaded file (CV or portfolio) and clear its metadata. */
export async function hapusBerkasAction(
  _prev: ResumeFormState,
  formData: FormData,
): Promise<ResumeFormState> {
  const ctx = await resumePemanggil();
  if (!ctx) return GAGAL("Sesi berakhir. Masuk ulang dulu.");

  const slot = brs(formData.get("slot")) as Slot;
  if (slot !== "cv" && slot !== "portofolio") return GAGAL("Jenis berkas tidak dikenal.");

  const ada: BerkasUpload | null = ctx.resume.berkas[slot];
  if (ada) await hapusBerkas(ctx.owner, ada.nama);

  await simpanResume({
    ...ctx.resume,
    berkas: { ...ctx.resume.berkas, [slot]: null },
  });
  segarkan();
  return OK("Berkas dihapus.");
}
