import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verdictBadge } from "@/components/features/jobs/cari-lowongan-ui";

/**
 * Kontrak verdict inbox.
 *
 * Alasan tanda-tanda ini ada: `verdictBadge` dulu hanya mengembalikan `status`
 * dan `title`. `title` berisi alasan yang sudah dibaca orang, tapi `onBukaDetail`
 * hanya meneruskan `status`, jadi popup tidak pernah bisa menampilkan kenapa
 * sebuah lowongan ditahan. Karena itu bentuk `VerdictLoker` sekarang memaksa
 * `sinyal` ada, dan test ini menjaga supaya tidak ada yang menghapusnya lagi.
 *
 * Test kedua menjaga hal yang lebih halus: `auditBaris` mengembalikan
 * `quarantined` untuk lowongan yang GAGAL di-enrichment, sama seperti lowongan
 * mencurigakan. Tanpa `terperiksa`, keduanya tercampur dan popup menampilkan
 * "KARANTINA" untuk lowongan yang belum pernah dibaca sama sekali.
 */

type Baris = Parameters<typeof verdictBadge>[0];

function baris(overrides: Partial<Baris>): Baris {
  return {
    url: "https://glints.com/id/lowongan/1",
    role: "Backend Engineer",
    company: "PT Contoh",
    ...overrides,
  } as Baris;
}

const audit = (status: "clean" | "quarantined" | "rejected", flags: string[]) => ({
  status,
  flags,
  fee_flags: [],
  trust_flags: [],
  trust_score: 100,
  trust_level: "high" as const,
});

describe("verdictBadge", () => {
  it("tidak mengembalikan apa pun untuk baris tanpa audit", () => {
    expect(verdictBadge(baris({}))).toBeNull();
  });

  it("menyusun alasan yang terbaca-manusia untuk lowongan ditahan", () => {
    const v = verdictBadge(
      baris({ enriched: true, audit: audit("quarantined", ["link_apk", "panen_data"]) }),
    );

    // Label asli dari `labelSinyal` (`sentinel.ts:168`), bukan id flag mentah.
    expect(v?.sinyal).toEqual(["Link unduhan APK", "Permintaan data pribadi sensitif"]);
    expect(v?.sinyal).not.toContain("link_apk");
    expect(v?.terperiksa).toBe(true);
    expect(v?.label).toBe("Perlu ditinjau");
  });

  it("TIDAK menuduh lowongan yang gagal di-enrichment", () => {
    const v = verdictBadge(
      baris({ enriched: false, audit: audit("quarantined", ["data_tidak_terverifikasi"]) }),
    );

    // Status-nya memang `quarantined` — itu data, bukan bug. Yang wajib
    // terpisah adalah `terperiksa`, supaya UI tidak mengarang tuduhan.
    expect(v?.status).toBe("quarantined");
    expect(v?.terperiksa).toBe(false);
    expect(v?.label).toBe("Belum diperiksa");
  });

  it("lowongan aman tidak punya alasan, tapi tetap terperiksa", () => {
    const v = verdictBadge(baris({ enriched: true, audit: audit("clean", []) }));

    expect(v?.sinyal).toEqual([]);
    expect(v?.terperiksa).toBe(true);
    expect(v?.label).toBe("Aman");
    // `title` dipakai popup saat `sinyal` kosong, jadi harus berupa kalimat.
    expect(v?.title).toBe("Tidak ditemukan pola penipuan pada lowongan ini.");
  });

  it("lowongan ditolak memakai label Ditolak, bukan Perlu ditinjau", () => {
    const v = verdictBadge(
      baris({ enriched: true, audit: audit("rejected", ["transfer_rekening_pribadi"]) }),
    );

    expect(v?.label).toBe("Ditolak");
    expect(v?.status).toBe("rejected");
    expect(v?.sinyal.length).toBeGreaterThan(0);
  });

  it("tidak pernah menampilkan 'Sinyal: ' kosong", () => {
    // `quarantined` tanpa flag tidak terjadi dari `auditLoker`, tapi kalau
    // terjadi, `title` tidak boleh jadi "Sinyal: " dengan isi kosong.
    const v = verdictBadge(baris({ enriched: true, audit: audit("quarantined", []) }));

    expect(v?.title).not.toContain("Sinyal: ");
    expect(v?.title).toBe("Ada sinyal yang perlu diperiksa lebih lanjut.");
  });
});

/**
 * Penjaga wiring jalur-klik.
 *
 * Bug aslinya bukan di `verdictBadge` — itu sudah benar sejak awal. Yang rusak
 * adalah jalur dari kartu ke popup: `onBukaDetail` meneruskan `verdict?.status`
 * saja, jadi `sinyal` (dan `title`) berhenti di kartu. Unit test di atas tidak
 * akan menangkap itu; yang tertangkap hanya bentuk datanya.
 *
 * Repo ini tidak punya jsdom, jadi `it("popup menampilkan sinyal")` mustahil
 * ditulis. Satu-satunya penjaga yang tersedia adalah memeriksa isi prop itu
 * langsung:
 *   - `PopupDetailLoker` harus menerima `verdict` (bukan `status`),
 *   - pemanggilnya harus meneruskan `verdict`, bukan `verdict?.status`,
 *   - dan popup harus benar-benar merender `verdict.sinyal`.
 *
 * Dua yang pertama juga dijaga TypeScript, tapi hanya selama tidak ada yang
 * melonggarkan tipenya — yang ketiga tidak dijaga sama sekali.
 */
describe("wiring jalur-klik verdict", () => {
  const baca = (rel: string) =>
    readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");

  it("popup menerima verdict, bukan status", () => {
    const sumber = baca("src/components/features/jobs/popup-detail-loker.tsx");
    expect(sumber).toMatch(/verdict\?:\s*VerdictLoker\s*\|\s*null/);
    // `status` sebagai prop tunggal adalah bug yang sedang kita perbaiki.
    expect(sumber).not.toMatch(/^\s*status\?:\s*"clean"/m);
  });

  it("popup benar-benar merender daftar sinyal", () => {
    const sumber = baca("src/components/features/jobs/popup-detail-loker.tsx");
    expect(sumber).toMatch(/verdict\.sinyal\.map\(/);
    expect(sumber).toMatch(/verdict\.terperiksa/);
  });

  it("badge popup memakai label verdict, bukan label bawaan StatusBadge", () => {
    // Bug ketiga, ketemu dari screenshot: blok sinyal sudah benar, tapi badge
    // di pojok kiri tetap "KARANTINA" karena `StatusBadge` memetakan
    // `quarantined` → "KARANTINA" dan label itu belum di-override. Teksnya
    // kalimat, jadi assertion DOM biasa tidak akan menangkapnya.
    const popup = baca("src/components/features/jobs/popup-detail-loker.tsx");
    expect(popup).toMatch(/statusLabel:\s*verdict\?\.label/);

    const kartu = baca("src/components/features/jobs/kartu-detail-loker.tsx");
    expect(kartu).toMatch(/label=\{data\.statusLabel\}/);
  });

  it("kedua pemanggil meneruskan verdict utuh", () => {
    for (const rel of [
      "src/components/features/jobs/cari-lowongan-ui.tsx",
      "src/components/features/jobs/kartu-rekomendasi-profil.tsx",
    ]) {
      const sumber = baca(rel);
      // `.status` di sini berarti alasan kembali dibuang di antara kartu dan popup.
      expect(sumber, rel).not.toMatch(/onBukaDetail[^)]*verdict[^)]*\.status/);
    }
  });
});
