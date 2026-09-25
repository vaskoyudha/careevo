/**
 * Helper audit — **server-only**.
 *
 * `audit_events` adalah tabel append-only: barisnya tidak pernah dihapus, jadi
 * kesalahan yang ditulis ke sini bersifat permanen. Karena itu penyaringan
 * (`payload_redacted`) dilakukan **sebelum insert**, bukan sesudah, dan nama
 * kolomnya sengaja memuat kata "redacted" sebagai pengingat.
 *
 * Aturan yang dikunci:
 *
 * - **Kunci terlarang dibuang, bukan dikosongkan.** Token, secret, password,
 *   hash, cookie, dan header Authorization tidak boleh punya kesempatan masuk;
 *   nilai hash token undangan sekalipun tidak disimpan di audit — nilainya ada
 *   di `staff_invitations.token_hash` bila memang dibutuhkan.
 * - **PII mentah disamarkan, bukan disimpan.** Email adalah identifier yang
 *   dibutuhkan audit trail ("siapa yang diundang"), tetapi alamat penuh adalah
 *   PII. Yang ditulis adalah bentuk tersamarkan (`b***@contoh.test`) sehingga
 *   baris audit tetap bisa dibaca tanpa menyimpan alamat asli.
 * - **Jaring pengaman nilai.** Sebuah string yang panjangnya ≥ 32 karakter dan
 *   berkarakter opaque (tanpa spasi) diperlakukan sebagai token dan disamarkan,
 *   sekalipun namanya tidak terduga. UUID dikecualikan — id entitas justru
 *   memang perlu terbaca.
 * - **Penyaringan rekursif.** Payload bersarang juga disaring; tanpa itu, satu
 *   objek `{ meta: { token: ... } }` akan lolos begitu saja.
 */

import { auditEvents } from "@/lib/db/schema";
import type { TransaksiDb } from "@/lib/db/client";

/**
 * Nama kunci yang isinya **tidak boleh** masuk audit. Dicocokkan sebagai
 * substring dari nama kunci yang sudah di-lowercase, supaya varian umum
 * (`tokenHash`, `token_hash`, `accessToken`, `passwordHash`) tertangkap tanpa
 * daftar yang tak berujung.
 */
export const KUNCI_TERLARANG: readonly string[] = [
  "token",
  "secret",
  "password",
  "passwd",
  "hash",
  "cookie",
  "authorization",
  "bearer",
  "credential",
  "kredensial",
  "otp",
  "api_key",
  "apikey",
];

/** Nama kunci yang nilainya PII — disamarkan, bukan disimpan apa adanya. */
const KUNCI_EMAIL: readonly string[] = ["email", "surel"];

/** Bentuk UUID: id entitas, bukan token. Dikecualikan dari penyamaran nilai. */
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** String opaque panjang: kemungkinan besar token yang lolos dari penamaan. */
const POLA_TOKEN_OPAQUE = /^[A-Za-z0-9_-]{32,}$/;

/**
 * Menyamarkan alamat email: huruf pertama local-part dipertahankan, sisanya
 * diganti `***`, domain utuh (domain bukan rahasia dan justru membantu
 * membedakan konteks).
 */
export function samarkanEmail(email: string): string {
  const bersih = email.trim();
  const at = bersih.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = bersih.slice(0, at);
  const domain = bersih.slice(at + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}

function nilaiTersamar(nilai: string): string {
  if (POLA_UUID.test(nilai)) return nilai;
  if (nilai.length >= 32 && POLA_TOKEN_OPAQUE.test(nilai)) return "[disamarkan]";
  return nilai;
}

function saringNilai(nama: string, nilai: unknown): unknown {
  if (nilai === null || nilai === undefined) return nilai;

  if (typeof nilai === "string") {
    if (KUNCI_EMAIL.some((k) => nama.includes(k))) return samarkanEmail(nilai);
    return nilaiTersamar(nilai);
  }

  if (typeof nilai === "number" || typeof nilai === "boolean") return nilai;

  if (Array.isArray(nilai)) {
    return nilai.map((item) => saringNilai(nama, item));
  }

  if (typeof nilai === "object") {
    return saringPayloadAudit(nilai as Record<string, unknown>);
  }

  // Fungsi/simbol: tidak bisa diserialisasi ke jsonb.
  return undefined;
}

/**
 * Menyaring payload audit. Fungsi murni — bisa diuji tanpa database.
 *
 * Kunci terlarang dibuang sepenuhnya (bukan diisi `"[disamarkan]"`): kunci
 * seperti itu sendiri sudah memberi tahu bahwa ada rahasia di jalur itu, dan
 * pemanggil yang menaruhnya adalah bug yang sebaiknya terlihat saat test, bukan
 * tersembunyi di baris audit.
 */
export function saringPayloadAudit(
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!payload) return {};

  const hasil: Record<string, unknown> = {};
  for (const [nama, nilai] of Object.entries(payload)) {
    if (KUNCI_TERLARANG.some((k) => nama.toLowerCase().includes(k))) continue;
    const tersaring = saringNilai(nama.toLowerCase(), nilai);
    if (tersaring !== undefined) hasil[nama] = tersaring;
  }
  return hasil;
}

export interface PeristiwaAudit {
  /** Pelaku (`users.id`), atau `null` untuk peristiwa sistem. */
  actorUserId: string | null;
  /** Nama aksi, mis. `staff_invitation.created`. */
  action: string;
  /** Jenis entitas yang diaudit, mis. `staff_invitation`. */
  entityType: string;
  /** Id entitas sebagai teks — tidak selalu uuid (lihat schema). */
  entityId: string;
  /** Payload yang **akan disaring** oleh helper ini sebelum ditulis. */
  payloadRedacted?: Record<string, unknown> | null;
  /** Id request korelasi, bila tersedia. */
  requestId?: string | null;
}

/**
 * Menulis satu baris `audit_events` lewat koneksi/transaksi yang diberikan.
 *
 * Koneksi diteruskan sebagai argumen supaya audit berada di transaksi yang
 * sama dengan mutasinya: rollback mutasi harus ikut membatalkan auditnya, dan
 * audit yang tidak pernah ditulis tidak boleh tampak seperti bukti.
 */
export async function catatAudit(tx: TransaksiDb, peristiwa: PeristiwaAudit): Promise<void> {
  await tx.insert(auditEvents).values({
    actorUserId: peristiwa.actorUserId,
    action: peristiwa.action,
    entityType: peristiwa.entityType,
    entityId: peristiwa.entityId,
    payloadRedacted: saringPayloadAudit(peristiwa.payloadRedacted),
    requestId: peristiwa.requestId ?? null,
  });
}
