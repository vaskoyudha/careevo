/**
 * Patok parameter Argon2id.
 *
 * `password.ts` mengklaim nilai `Algorithm.Argon2id` + parameter baseline OWASP
 * "dipatok `npm test`", tetapi sebelum berkas ini test itu tidak ada — klaim di
 * komentar tidak menjaganya. Test ini mengubah klaim itu menjadi kegagalan suite
 * bila seseorang:
 *
 * 1. mengganti algoritmanya (Argon2i/Argon2d lebih lemah terhadap kelas
 *    serangan yang berbeda);
 * 2. menurunkan `memoryCost`/`timeCost` (biaya per tebusan password turun);
 * 3. mengubah `parallelism` dari 1.
 *
 * Yang diperiksa adalah **hash yang benar-benar dihasilkan**, bukan konstanta di
 * berkas: `OPSI_ARGON2ID` bisa saja benar sementara nilai yang dipakai `hash()`
 * berbeda. `parseOptions` membaca parameter dari string PHC-nya sendiri,
 * sehingga test ini juga membuktikan hash yang tersimpan di database memuat
 * parameternya (verifikasi tidak bergantung pada konstanta runtime).
 */

import { describe, expect, it } from "vitest";
import { parseOptions } from "@node-rs/argon2";

import {
  ARGON2ID,
  OPSI_ARGON2ID,
  hashPassword,
  hashUmpanWaktu,
  verifyPassword,
} from "./password";

/**
 * Nilai `Algorithm` dari `@node-rs/argon2`, ditulis sebagai angka.
 *
 * Enum-nya *ambient const enum*, jadi `tsc` menolak mengaksesnya sebagai nilai
 * saat `isolatedModules` menyala (TS2748) — alasan yang sama dengan literal `2`
 * di `password.ts`. Angka di sini adalah bagian dari kontrak paket
 * (`Argon2id = 2`, `Argon2i = 1`, `Argon2d = 0`); string PHC yang diperiksa
 * test ini yang membuat kesalahan pemetaan tetap terlihat.
 */
const ALGORITMA = { argon2d: 0, argon2i: 1, argon2id: 2 } as const;

/** Baseline OWASP untuk Argon2id: `m=19456` KiB, `t=2`, `p=1`. */
const OWASP = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

describe("Argon2id — algoritma dan parameter dipatok", () => {
  it("ARGON2ID menunjuk Algorithm.Argon2id, bukan varian lain", () => {
    // Literal `2` di `password.ts` ada karena `Algorithm` adalah *ambient const
    // enum* yang ditolak `tsc` saat `isolatedModules` menyala. Test ini yang
    // membuat nilainya tidak bisa bergeser tanpa ada yang gagal.
    expect(ARGON2ID).toBe(ALGORITMA.argon2id);
    expect(ARGON2ID).not.toBe(ALGORITMA.argon2i);
    expect(ARGON2ID).not.toBe(ALGORITMA.argon2d);
  });

  it("menghasilkan hash PHC dengan penanda $argon2id$", async () => {
    const hash = await hashPassword("rahasia-panjang");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    // Bukan varian lain yang kebetulan lolos pemeriksaan awalan.
    expect(hash).not.toMatch(/^\$argon2i\$/);
    expect(hash).not.toMatch(/^\$argon2d\$/);
  });

  it("memakai parameter yang dipatok OWASP di hash yang dihasilkan", async () => {
    const hash = await hashPassword("rahasia-panjang");
    const opsi = parseOptions(hash);

    expect(opsi.algorithm).toBe(ALGORITMA.argon2id);
    expect(opsi.memoryCost).toBe(OWASP.memoryCost);
    expect(opsi.timeCost).toBe(OWASP.timeCost);
    expect(opsi.parallelism).toBe(OWASP.parallelism);
  });

  it("menuangkan parameter eksplisit ke string PHC, bukan mengandalkan default pustaka", async () => {
    const hash = await hashPassword("rahasia-panjang");

    // Bentuk PHC memuat parameternya sendiri — inilah yang membuat verifikasi
    // hash lama tetap bekerja setelah kebijakan dinaikkan.
    expect(hash).toContain(`m=${OWASP.memoryCost}`);
    expect(hash).toContain(`t=${OWASP.timeCost}`);
    expect(hash).toContain(`p=${OWASP.parallelism}`);
    expect(hash).toContain("v=19");
  });

  it("OPSI_ARGON2ID adalah satu-satunya sumber parameter (tidak ada default tersembunyi)", () => {
    expect(OPSI_ARGON2ID).toMatchObject({
      algorithm: ARGON2ID,
      memoryCost: OWASP.memoryCost,
      timeCost: OWASP.timeCost,
      parallelism: OWASP.parallelism,
    });
  });

  it("tidak pernah menurunkan biaya di bawah baseline: nilai lebih lemah menggagalkan suite", () => {
    // Penjaga terhadap "perbaikan performa" yang menurunkan biaya tanpa review.
    expect(OPSI_ARGON2ID.memoryCost).toBeGreaterThanOrEqual(OWASP.memoryCost);
    expect(OPSI_ARGON2ID.timeCost).toBeGreaterThanOrEqual(OWASP.timeCost);
    expect(OPSI_ARGON2ID.parallelism).toBeGreaterThanOrEqual(OWASP.parallelism);
    expect(OPSI_ARGON2ID.algorithm).toBe(ALGORITMA.argon2id);
  });

  it("dua hash dari password yang sama berbeda (salt acak)", async () => {
    const a = await hashPassword("rahasia-panjang");
    const b = await hashPassword("rahasia-panjang");
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, "rahasia-panjang")).toBe(true);
    expect(await verifyPassword(b, "rahasia-panjang")).toBe(true);
  });

  it("hash umpan waktu juga Argon2id, sehingga biaya kedua jalur login sama", async () => {
    const umpan = await hashUmpanWaktu();
    expect(umpan.startsWith("$argon2id$")).toBe(true);
    expect(parseOptions(umpan).algorithm).toBe(ALGORITMA.argon2id);
    // Tidak boleh cocok dengan password apa pun.
    expect(await verifyPassword(umpan, "rahasia-panjang")).toBe(false);
    // Dibangun sekali per proses: panggilan kedua mengembalikan nilai yang sama.
    expect(await hashUmpanWaktu()).toBe(umpan);
  });
});

describe("verifyPassword — hash cacat bukan galat", () => {
  it("mengembalikan false untuk hash kosong, bukan berbentuk PHC, atau algoritma asing", async () => {
    expect(await verifyPassword("", "rahasia-panjang")).toBe(false);
    expect(await verifyPassword("bukan-hash-phc", "rahasia-panjang")).toBe(false);
    expect(await verifyPassword("$argon2xx$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA", "rahasia-panjang")).toBe(
      false,
    );
    expect(await verifyPassword(await hashPassword("rahasia-panjang"), "")).toBe(false);
  });

  it("menerima hash lama yang parameternya berbeda dari kebijakan sekarang", async () => {
    // Hash dengan parameter lebih lemah (mis. data lama) tetap dapat
    // diverifikasi: verifikasi membaca parameter dari hash, bukan konstanta.
    const { hash: argonHash } = await import("@node-rs/argon2");
    const lama = await argonHash("rahasia-panjang", { memoryCost: 4096, timeCost: 1, parallelism: 1 });
    expect(lama.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(lama, "rahasia-panjang")).toBe(true);
    expect(await verifyPassword(lama, "password-salah")).toBe(false);
  });
});
