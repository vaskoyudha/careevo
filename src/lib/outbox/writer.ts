/**
 * Writer transactional outbox — **server-only**.
 *
 * Inilah satu-satunya jalur sah menulis baris `outbox_events`. Ia sengaja
 * sempit: menerima **transaksi** (bukan koneksi biasa), karena event yang
 * ditulis di luar transaksi perubahan bisnisnya membuka dua kegagalan yang
 * persis ingin dicegah plan §6 — commit bisnis tanpa event, dan event untuk
 * bisnis yang di-rollback.
 *
 * Aturan yang dikunci:
 *
 * - **Parameter pertama wajib `TransaksiDb`, bukan `EksekutorDb`.** Tipe itu
 *   membuat pemanggil tidak bisa "kebetulan" memakai `getDb()` dan menulis
 *   event di luar transaksi: kodenya tidak akan lolos typecheck. Aturan yang
 *   hanya hidup di komentar akan dilanggar; aturan yang hidup di tipe tidak.
 * - **Payload disaring sebelum insert.** `saringPayloadAudit` membuang
 *   token/secret/PII mentah dan menyamarkan email. Menyimpan payload mentah
 *   "lalu meredaksinya nanti" tidak bisa diterima: baris outbox adalah data
 *   yang dikirim ke handler, jadi apa pun yang tersimpan di situ adalah apa
 *   yang akan bocor bila handler salah log.
 * - **`idempotency_key` unik, dan tulis ulang bukan galat.** `ON CONFLICT DO
 *   NOTHING` membuat penulisan event yang sama dua kali (request diulang,
 *   retry, dua worker balapan) menghasilkan `null`, bukan exception. Pemanggil
 *   yang butuh tahu "ini baru" cukup memeriksa hasilnya; pemanggil yang tidak
 *   peduli boleh mengabaikannya. Yang penting: tidak ada event kedua.
 * - **Kunci ditentukan pemanggil, bukan dibangkitkan di sini.** Kunci acak
 *   selalu lolos dari unique dan tidak menjamin apa pun. Bentuk yang benar
 *   mengandung identitas bisnis, mis. `auth.registered:<userId>`.
 *
 * Claim/lease worker ada di modul terpisah, bukan di sini: writer adalah jalur
 * tulis satu arah, dan mencampurnya dengan pembacaan claim membuat batas
 * "siapa yang boleh menulis event" kabur.
 */

import { saringPayloadAudit } from "@/lib/auth/audit";
import { getDb, type TransaksiDb } from "@/lib/db/client";
import { outboxEvents, type OutboxEvent } from "@/lib/db/schema";

/**
 * Peristiwa yang akan ditulis ke `outbox_events`.
 *
 * `payloadRedacted` adalah payload **belum disaring**; writer yang menyaring.
 * Nama field-nya memakai "redacted" sebagai pengingat tujuan, bukan sebagai
 * klaim bahwa pemanggil sudah menyaringnya — menyaring dua kali tidak merusak
 * apa pun, lupa menyaring merusak selamanya.
 */
export interface PeristiwaOutbox {
  /** Nama event, mis. `auth.registered`. Handler worker didaftarkan per nilai ini. */
  type: string;
  /** Jenis agregat pemilik event, mis. `user`. */
  aggregateType: string;
  /** Id agregat sebagai teks (uuid, slug, atau id komposit). */
  aggregateId: string;
  /** Payload yang **akan disaring** writer. */
  payloadRedacted?: Record<string, unknown> | null;
  /** Kunci idempotensi penulisan; wajib unik dan bermakna bisnis. */
  idempotencyKey: string;
  /** Kapan event boleh diproses. Default: waktu insert. Dipakai untuk menunda. */
  availableAt?: Date | null;
  /** Kapan peristiwa terjadi. Default: waktu insert. */
  occurredAt?: Date | null;
}

/** Kegagalan pemakaian API writer — dibedakan dari kegagalan database. */
export class PeristiwaOutboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeristiwaOutboxError";
  }
}

/**
 * Memvalidasi field wajib sebelum menyentuh database.
 *
 * `NOT NULL` tidak menolak string kosong, jadi `type: ""` akan tersimpan sebagai
 * event yang tidak bisa dipetakan handler mana pun — dan baru ketahuan saat
 * worker gagal di produksi. Menolaknya di sini membuat kesalahan itu muncul di
 * test pemanggil.
 */
function periksaPeristiwa(peristiwa: PeristiwaOutbox): void {
  const wajib: Array<[keyof PeristiwaOutbox, string]> = [
    ["type", "type"],
    ["aggregateType", "aggregateType"],
    ["aggregateId", "aggregateId"],
    ["idempotencyKey", "idempotencyKey"],
  ];
  for (const [field, nama] of wajib) {
    const nilai = peristiwa[field];
    if (typeof nilai !== "string" || nilai.trim().length === 0) {
      throw new PeristiwaOutboxError(
        `Peristiwa outbox membutuhkan ${nama} yang tidak kosong (diterima: ${JSON.stringify(nilai)}).`,
      );
    }
  }
}

/**
 * Menulis satu event outbox di dalam transaksi `tx`.
 *
 * Mengembalikan baris yang ditulis, atau `null` bila `idempotency_key`-nya
 * sudah ada — bukan melempar, karena penulisan ulang yang idempoten adalah
 * perilaku yang diharapkan, bukan kesalahan.
 *
 * Pemanggil **tidak boleh** membuka transaksi sendiri di sini: bentuknya adalah
 * `denganTransaksi(tx => { ...mutasi bisnis...; await tulisOutbox(tx, ...) })`
 * atau lewat `jalankanDenganOutbox`.
 */
export async function tulisOutbox(
  tx: TransaksiDb,
  peristiwa: PeristiwaOutbox,
): Promise<OutboxEvent | null> {
  periksaPeristiwa(peristiwa);

  const [baris] = await tx
    .insert(outboxEvents)
    .values({
      type: peristiwa.type,
      aggregateType: peristiwa.aggregateType,
      aggregateId: peristiwa.aggregateId,
      payloadRedacted: saringPayloadAudit(peristiwa.payloadRedacted),
      idempotencyKey: peristiwa.idempotencyKey,
      // Kolom waktu ber-default `now()`; hanya ditimpa bila pemanggil memang
      // menjadwalkan atau memberi waktu eksplisit.
      ...(peristiwa.occurredAt ? { occurredAt: peristiwa.occurredAt } : {}),
      ...(peristiwa.availableAt ? { availableAt: peristiwa.availableAt } : {}),
    })
    .onConflictDoNothing({ target: outboxEvents.idempotencyKey })
    .returning();

  return baris ?? null;
}

/**
 * Sumber peristiwa untuk `jalankanDenganOutbox`.
 *
 * Bentuk fungsi dipakai ketika `aggregateId` baru diketahui dari hasil mutasi
 * — pola paling umum untuk event `*.created`. Tanpa bentuk itu, pemanggil harus
 * menebak id sebelum barisnya ada, dan satu-satunya cara adalah menulis event
 * di dalam `fn` (yang membuat urutannya tidak lagi dijamin helper ini).
 */
export type SumberPeristiwa<T> =
  | PeristiwaOutbox
  | PeristiwaOutbox[]
  | ((hasil: T) => PeristiwaOutbox | PeristiwaOutbox[]);

/**
 * Menjalankan `fn` (mutasi bisnis) lalu menulis satu atau beberapa event di
 * dalam **satu transaksi**. Melempar dari `fn` membatalkan bisnis dan
 * event-nya sekaligus.
 *
 * Event ditulis **sesudah** `fn`, supaya `aggregateId` bisa berasal dari hasil
 * mutasi (mis. id baris yang baru dibuat) — lewat bentuk fungsi
 * `SumberPeristiwa`. Urutan itu tidak mengurangi atomicity: keduanya commit
 * bersama, dan transaksi yang gagal tidak meninggalkan salah satunya. Yang
 * dijamin urutannya adalah arah lain — "commit bisnis selalu punya event" —
 * karena event tidak mungkin hilang setelah `fn` sukses tanpa menggagalkan
 * seluruh transaksi.
 *
 * Untuk pemanggil yang sudah memegang transaksi sendiri (mis. `daftarPengguna`
 * yang membungkus registrasi + grant role), pakai `tulisOutbox(tx, ...)`
 * langsung; helper ini hanya pembungkus `getDb().transaction` untuk pemanggil
 * yang belum punya transaksi.
 */
export async function jalankanDenganOutbox<T>(
  fn: (tx: TransaksiDb) => Promise<T>,
  peristiwa: SumberPeristiwa<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    const hasil = await fn(tx);
    const dipilih = typeof peristiwa === "function" ? peristiwa(hasil) : peristiwa;
    const daftar = Array.isArray(dipilih) ? dipilih : [dipilih];
    for (const p of daftar) {
      await tulisOutbox(tx, p);
    }
    return hasil;
  });
}
