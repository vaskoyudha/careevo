/**
 * Turunan status kotak sertifikat — **`statusSertifikat` saja**, bukan render.
 *
 * Environmen test repo ini `node` (tanpa jsdom, tanpa `.test.tsx`), jadi yang
 * diuji adalah keputusan murni yang menentukan **apakah** kotak menampilkan
 * tautan `/verify/<token>`. Aturan yang paling rawan salah di sini adalah
 * urutan prioritas: `terbit` harus menang atas `terkunci`, kalau tidak
 * credential yang benar-benar sudah terbit tetap tampil terkunci.
 */

import { describe, expect, it } from "vitest";
import { statusSertifikat } from "./sertifikat-panel";

describe("statusSertifikat", () => {
  it("terbit ketika ada token publik, walau yang lain bilang terkunci", () => {
    // Token adalah fakta dari database; `terkunci` cuma turunan completion.
    // Urutan terbalik membuat credential yang sudah terbit masih dikunci.
    expect(statusSertifikat({ terkunci: true, token: "abc123" })).toBe("terbit");
  });

  it("terkunci saat belum ada completion terverifikasi dan belum ada token", () => {
    expect(statusSertifikat({ terkunci: true, token: null })).toBe("terkunci");
  });

  it("siap setelah completion terverifikasi tapi karya belum diputuskan", () => {
    // Status ketiga ini yang mencegah UI menjanjikan sertifikat yang belum
    // terbit: ia hanya mengarahkan ke pengumpulan karya.
    expect(statusSertifikat({ terkunci: false, token: null })).toBe("siap");
  });

  it("string kosong diperlakukan sebagai bukan token", () => {
    // `""` adalah falsy di service, jadi harus tetap di jalur `siap`/`terkunci`
    // dan tidak pernah menghasilkan href `/verify/` yang kosong.
    expect(statusSertifikat({ terkunci: false, token: "" })).toBe("siap");
    expect(statusSertifikat({ terkunci: true, token: "" })).toBe("terkunci");
  });
});
