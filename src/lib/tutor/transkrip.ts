import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { SesiRingkas } from "@/lib/agents/tutor/fakta";

/**
 * Pembaca transkrip tutor dari `.data/tutor/` — **server-only**.
 *
 * Berkas ini **sengaja tidak** mengimpor `"server-only"`. Modul itu tidak
 * terpecahkan di config Vitest repo ini, jadi impornya membuat seluruh test
 * pembacaan gagal di import — dan sisa perilaku yang paling mudah rusak (file
 * rusak, owner yang berbeda, bentuk tak terduga) menjadi tidak teruji.
 *
 * Penjaga "hanya server" tetap ada, dan lebih keras daripada `server-only`:
 * modul ini mengimpor `node:fs/promises`, yang tidak bisa dibundel untuk browser
 * sama sekali. Komponen klien yang mengimpornya gagal build, bukan gagal diam-diam.
 *
 * ## Data ini milik aplikasi lain
 *
 * Transkrip ditulis oleh **AI Mastery** (aplik DeepTutor di `backend/`), bukan
 * oleh Careevo. Careevo tidak pernah menulis ke sini, dan direktori tersebut
 * tidak dikontrak dengan Careevo seperti tabel database adalah.
 *
 * Karena itu dua hal dijaga:
 *
 * 1. **File yang tidak terbaca dilewati, bukan membuat pembacaan gagal.** kalau
 *    AI Mastery mengubah bentuknya, panel hilang — bukan halaman integritas ikut
 *    500.
 * 2. **Hanya `session.owner` yang dipakai**, dan dicocokkan ke email peserta.
 *    Nama direktori pemilik **tidak** ditebak: Carrie tidak menulis aturan
 *    penamaan itu, jadi menebaknya berarti mengarang derivasi yang bisa salah
 *    diam-diam dan membuat panel selalu kosong.
 */

/** Override direktori data — sama dengan toko file lain. */
function akarData(): string {
  return process.env.CAREERS_DATA_DIR ?? path.join(process.cwd(), ".data");
}

/**
 * Direktori transkrip milik satu pemilik: **`sha256(email)[:32]`**.
 *
 * Aturan ini bukan tebakan. Toko tutor di `.data/tutor/` ditulis oleh Careevo
 * sendiri (plan `docs/superpowers/plans/2026-09-25-deeptutor-tutor-workspace.md`,
 * "Sessions are real and file-backed") dan meniru pola `.data/resume/`. Versi
 * pertama modul ini menebak `path.basename(email)` dan karena itu selalu membaca
 * nol sesi — direktori bernama `17f4281c…`, bukan `user@careevo.test`.
 *
 * `basename` tetap dipasang **setelah** hash. Hash sudah menghasilkan karakter
 * heksadesimal yang aman, jadi penjaga itu secara formal tak perlu — tapi ia
 * mencegah kebocoran path kalau aturan ini pernah berubah, dan biayanya satu
 * pemanggilan.
 */
function direktoriTutor(email: string): string {
  const kunci = createHash("sha256").update(email.trim()).digest("hex").slice(0, 32);
  return path.join(akarData(), "tutor", path.basename(kunci));
}

/**
 * Baca semua sesi milik satu email.
 *
 * Mengembalikan `[]` bila direktori tidak ada — itu "belum pernah memakai
 * tutor", bukan error, dan pemanggil menampilkannya sebagai kondisi kosong.
 *
 * Bentuk salah pada satu file **tidak** menggagalkan file lain: transkrip adalah
 * pelengkap, dan satu berkas rusak tidak boleh menghapus sisa yang masih
 * terbaca.
 */
export async function bacaTranskrip(email: string): Promise<SesiRingkas[]> {
  const dir = direktoriTutor(email);
  const pemilik = email.trim().toLowerCase();

  let namaFile: string[];
  try {
    namaFile = await readdir(dir);
  } catch {
    return [];
  }

  const hasil: SesiRingkas[] = [];
  for (const nama of namaFile) {
    if (!nama.endsWith(".json")) continue;
    const sesi = await bacaSatuFile(path.join(dir, nama), pemilik);
    if (sesi) hasil.push(sesi);
  }
  return hasil;
}

/** Satu file transkrip, atau `null` kalau tidak bisa dipakai. */
async function bacaSatuFile(
  berkas: string,
  pemilik: string,
): Promise<SesiRingkas | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(berkas, "utf8"));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const session = (parsed as { session?: unknown }).session;
  if (typeof session !== "object" || session === null) return null;
  const s = session as Record<string, unknown>;

  // `owner` dibandingkan, bukan dipercaya: direktori yang dipindai bisa memuat
  // sesi milik orang lain, dan ringkasan yang salah orang adalah kebocoran.
  const owner = typeof s.owner === "string" ? s.owner.trim().toLowerCase() : "";
  if (owner !== pemilik) return null;

  const judul = typeof s.title === "string" ? s.title : "";
  const courseId = typeof s.courseId === "string" ? s.courseId : null;
  if (!Array.isArray(s.messages)) {
    return { judul, courseId, messages: [] };
  }

  const messages: SesiRingkas["messages"] = [];
  for (const m of s.messages) {
    if (typeof m !== "object" || m === null) continue;
    const row = m as Record<string, unknown>;
    const role = row.role;
    if (role !== "user" && role !== "assistant") continue;
    const content = typeof row.content === "string" ? row.content : "";
    if (!content.trim()) continue;
    messages.push({ role, content });
  }

  return { judul, courseId, messages };
}