/**
 * Test unit outbox — **tanpa database** (`npm test`).
 *
 * Yang diuji di sini hanyalah bagian murni: perhitungan backoff, resolusi
 * handler, dan pemetaan galat ke kode. Bagian yang butuh PostgreSQL (claim,
 * lease, idempotensi ledger, dead-letter, replay) ada di
 * `worker.integration.test.ts` dan `replay.integration.test.ts`, dan hanya
 * berjalan lewat `npm run test:db`.
 */

import { describe, expect, it } from "vitest";

import {
  GalatHandlerPermanen,
  TIPE_EVENT,
  cariHandler,
  kodeGalat,
  sinkUntukTipe,
  tipeTerdaftar,
} from "@/lib/outbox/handlers";
import { hitungBackoffMs } from "@/lib/outbox/worker";

describe("hitungBackoffMs — eksponensial, berjitter, berplafon", () => {
  const opsi = { baseMs: 1_000, maxMs: 60_000 };

  it("menggandakan jeda tiap percobaan", () => {
    const tanpa = { ...opsi, acak: () => 0 };
    expect(hitungBackoffMs(1, tanpa)).toBe(1_000);
    expect(hitungBackoffMs(2, tanpa)).toBe(2_000);
    expect(hitungBackoffMs(3, tanpa)).toBe(4_000);
    expect(hitungBackoffMs(4, tanpa)).toBe(8_000);
  });

  it("tidak pernah melewati plafon, sekalipun percobaannya sangat banyak", () => {
    const maks = hitungBackoffMs(40, { ...opsi, acak: () => 1 });
    // Plafon + jitter maksimum 25%: batas atas yang disengaja.
    expect(maks).toBeLessThanOrEqual(75_000);
    expect(hitungBackoffMs(40, { ...opsi, acak: () => 0 })).toBe(60_000);
  });

  it("menambahkan jitter, tidak menguranginya", () => {
    const dasar = hitungBackoffMs(3, { ...opsi, acak: () => 0 });
    const jitter = hitungBackoffMs(3, { ...opsi, acak: () => 1 });
    expect(jitter).toBeGreaterThanOrEqual(dasar);
  });

  it("memperlakukan attempts tak masuk akal sebagai percobaan pertama", () => {
    const tanpa = { ...opsi, acak: () => 0 };
    expect(hitungBackoffMs(0, tanpa)).toBe(1_000);
    expect(hitungBackoffMs(-5, tanpa)).toBe(1_000);
  });
});

describe("registry handler — lookup aman, tanpa no-op diam", () => {
  it("menemukan handler auth.registered", () => {
    expect(cariHandler(TIPE_EVENT.authRegistered)).toBeTypeOf("function");
    expect(tipeTerdaftar()).toContain(TIPE_EVENT.authRegistered);
  });

  it("mengembalikan null untuk tipe tanpa handler, termasuk tipe Fase 3+", () => {
    // Inilah fail-closed: worker menandai tipe ini terminal, bukan sukses diam.
    expect(cariHandler("attestation.issued")).toBeNull();
    expect(cariHandler("file.scan")).toBeNull();
    expect(cariHandler("email.send")).toBeNull();
  });

  it("tidak tertipu rantai prototipe", () => {
    // `in` akan mengembalikan true untuk nama method bawaan; `Object.hasOwn`
    // tidak. Regresi ke `in` akan membuat baris ini gagal.
    expect(cariHandler("toString")).toBeNull();
    expect(cariHandler("constructor")).toBeNull();
    expect(cariHandler("hasOwnProperty")).toBeNull();
    expect(sinkUntukTipe("toString")).toEqual([]);
  });

  it("mendeklarasikan sink audit untuk auth.registered", () => {
    expect(sinkUntukTipe(TIPE_EVENT.authRegistered)).toEqual(["audit"]);
  });
});

describe("kodeGalat — hanya kode, tidak pernah pesan", () => {
  it("meneruskan kode galat permanen", () => {
    expect(kodeGalat(new GalatHandlerPermanen("payload_tidak_valid"))).toBe("payload_tidak_valid");
  });

  it("memetakan galat tak terduga ke kode generik", () => {
    expect(kodeGalat(new Error("apa saja"))).toBe("gagal_sementara");
  });

  it("tidak membocorkan pesan galat tak terduga ke last_error_code", () => {
    const galat = new Error("Key (email)=(budi@contoh.test) already exists");
    expect(kodeGalat(galat)).not.toContain("@");
    expect(kodeGalat(galat)).not.toContain("email");
  });
});
