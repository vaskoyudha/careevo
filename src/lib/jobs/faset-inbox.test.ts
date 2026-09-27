import { describe, expect, it } from "vitest";
import {
  daftarKategori,
  daftarKota,
  daftarPerusahaan,
  hitungBarisHariIni,
  KATEGORI_LAINNYA,
  KOTA_LAINNYA,
  KOTA_REMOTE,
  kotaDariLokasi,
  kunciHariIni,
  type BarisFaset,
  kategoriUntukPeran,
  labelUrutan,
  urutkanBaris,
  URUTAN,
} from "@/lib/jobs/faset-inbox";

function baris(over: Partial<BarisFaset> = {}): BarisFaset {
  return {
    url: "https://example.com/job/1",
    company: "Contoh Perusahaan",
    role: "Software Engineer",
    location: "Jakarta",
    ...over,
  };
}

describe("kotaDariLokasi", () => {
  it("menyatukan seluruh varian Jakarta menjadi satu kota", () => {
    // Nilai-nilai ini disalin apa adanya dari data root dev; inilah yang membuat
    // select lokasi bisa dipakai. Tanpa penyatuan ini satu kota memakan 100+ opsi.
    const varian = [
      "Jakarta",
      "Jakarta, ID",
      "South Jakarta, Jakarta",
      "West Jakarta, Jakarta",
      "Central Jakarta, Jakarta",
      "Jakarta Selatan, DKI Jakarta, Indonesia",
      "Kota Jakarta Barat",
      "Daerah Khusus Ibukota Jakarta",
      "Kecamatan Tebet, Daerah Khusus Ibukota Jakarta, Indonesia",
      "South Jakarta City",
    ];
    for (const lokasi of varian) {
      expect(kotaDariLokasi(lokasi), lokasi).toBe("Jakarta");
    }
  });

  it("membaca kota setelah segmen administrative", () => {
    expect(kotaDariLokasi("Kecamatan Kelapa Dua, Tangerang, Banten")).toBe("Tangerang");
    expect(kotaDariLokasi("Kecamatan Mampang Prapatan, South Jakarta")).toBe("Jakarta");
    expect(kotaDariLokasi("West Denpasar, Bali")).toBe("Denpasar");
    expect(kotaDariLokasi("Bekasi Regency")).toBe("Bekasi");
    expect(kotaDariLokasi("Yogyakarta Special Region")).toBe("Yogyakarta");
  });

  it("Remote menang atas kota nominal", () => {
    // "Remote - Jakarta" tetap Remote; kota di dalamnya hanya nominal.
    expect(kotaDariLokasi("Remote")).toBe(KOTA_REMOTE);
    expect(kotaDariLokasi("Remote - Jakarta")).toBe(KOTA_REMOTE);
    expect(kotaDariLokasi("Work From Home")).toBe(KOTA_REMOTE);
  });

  it("menyimpan nama yang tidak dikenal, bukan membuangnya", () => {
    // "Lainnya" berarti "tidak terbaca kota", bukan "tidak ada kota" — jadi
    // bucket ini harus tetap bisa dibedakan dari lokasi kosong.
    expect(kotaDariLokasi("Kepulauan Seribu")).toBe("Kepulauan Seribu");
    expect(kotaDariLokasi("Indonesia")).toBe(KOTA_LAINNYA);
    expect(kotaDariLokasi("Bali")).toBe(KOTA_LAINNYA);
  });

  it("lokasi kosong dan null tidak melempar", () => {
    expect(kotaDariLokasi(undefined)).toBe(KOTA_LAINNYA);
    expect(kotaDariLokasi(null)).toBe(KOTA_LAINNYA);
    expect(kotaDariLokasi("   ")).toBe(KOTA_LAINNYA);
  });
});

describe("kategoriUntukPeran", () => {
  it("menempatkan judul nyata ke keranjangnya", () => {
    // Semua disalin dari data root dev.
    expect(kategoriUntukPeran("Full Stack Developer")).toBe("Fullstack");
    expect(kategoriUntukPeran("Senior Fullstack Developer")).toBe("Fullstack");
    expect(kategoriUntukPeran("Sr. Full-Stack Software Engineer - Remote")).toBe("Fullstack");
    expect(kategoriUntukPeran("Mobile Developer")).toBe("Mobile & Apps");
    expect(kategoriUntukPeran("Mobile Engineer iOS")).toBe("Mobile & Apps");
    expect(kategoriUntukPeran("Android Developer")).toBe("Mobile & Apps");
    expect(kategoriUntukPeran("Data Analyst")).toBe("Data & Analytics");
    expect(kategoriUntukPeran("Staff Data Analyst")).toBe("Data & Analytics");
    expect(kategoriUntukPeran("DevOps Engineer")).toBe("DevOps & Infrastruktur");
    expect(kategoriUntukPeran("Software Quality Assurance (Manual)")).toBe("QA & Pengujian");
    expect(kategoriUntukPeran("Software QA Engineer")).toBe("QA & Pengujian");
    expect(kategoriUntukPeran("Backend Engineer")).toBe("Backend & API");
    expect(kategoriUntukPeran("Backend Developer")).toBe("Backend & API");
    expect(kategoriUntukPeran("Web Programmer / Application Developer")).toBe("Frontend & Web");
    expect(kategoriUntukPeran("UI / UX Designer (Contract Basis)")).toBe("Product & Desain");
  });

  it("tidak salah baca karena batas kata", () => {
    // Dua jebakan yang bikin select Kategori berbohong: "java" di dalam
    // "javascript", dan "test" di dalam "latest".
    expect(kategoriUntukPeran("Software Engineer Javascript")).not.toBe("Backend & API");
    expect(kategoriUntukPeran("Backend Engineer Latest News")).toBe("Backend & API");
  });

  it("judul yang tak dikenal masuk keranjang umum, bukan hilang", () => {
    expect(kategoriUntukPeran("IT DEVELOPER")).toBe(KATEGORI_LAINNYA);
    expect(kategoriUntukPeran("")).toBe(KATEGORI_LAINNYA);
    expect(kategoriUntukPeran(undefined)).toBe(KATEGORI_LAINNYA);
  });

  it("setiap kategori hanya dihitung sekali", () => {
    // Fullstack diperiksa lebih dulu tepat karena judul fullstack bisa menyebut
    // web maupun backend; menghitung dua kali akan menggandakan barisnya.
    expect(kategoriUntukPeran("Full Stack Web Developer")).toBe("Fullstack");
  });
});

describe("urutkanBaris", () => {
  const data = [
    baris({ url: "a", role: "Backend Engineer", firstSeen: "2026-01-02" }),
    baris({ url: "b", role: "Data Analyst", firstSeen: "2026-03-04" }),
    baris({ url: "c", role: "Android Developer", firstSeen: "2026-02-03" }),
    baris({ url: "d", role: "Cloud Architect" }),
  ];

  it("terbaru lebih dulu dan baris tanpa tanggal selalu di akhir", () => {
    const hasil = urutkanBaris(data, "terbaru").map((b) => b.url);
    expect(hasil).toEqual(["b", "c", "a", "d"]);
  });

  it("terlama lebih dulu, tapi baris tanpa tanggal tetap di akhir", () => {
    // Menempelkan baris tanpa tanggal di depan pada "terlama" akan mengklaim
    // baris itu yang paling lama — klaim yang tidak ada dasarnya.
    const hasil = urutkanBaris(data, "terlama").map((b) => b.url);
    expect(hasil).toEqual(["a", "c", "b", "d"]);
  });

  it("mengurutkan peran A-Z", () => {
    const hasil = urutkanBaris(data, "peran").map((b) => b.role);
    expect(hasil).toEqual([
      "Android Developer",
      "Backend Engineer",
      "Cloud Architect",
      "Data Analyst",
    ]);
  });

  it("tidak mengubah baris yang diberikan", () => {
    const asal = [baris({ url: "x", firstSeen: "2026-01-01" }), baris({ url: "y" })];
    urutkanBaris(asal, "terbaru");
    expect(asal.map((b) => b.url)).toEqual(["x", "y"]);
  });
});

describe("daftar facets", () => {
  it("kota unik dan terurut", () => {
    const kota = daftarKota([
      baris({ location: "Jakarta" }),
      baris({ location: "South Jakarta, Jakarta" }),
      baris({ location: "Surabaya, East Java" }),
    ]);
    expect(kota).toEqual(["Jakarta", "Surabaya"]);
  });

  it("kategori hanya menawarkan yang benar-benar ada", () => {
    // Select yang hard-coded akan menampilkan "DevOps & Infrastruktur" pada
    // korpus tanpa satu pun posting DevOps, dan kliknya mengembalikan nol.
    const kategori = daftarKategori([
      baris({ role: "Data Analyst" }),
      baris({ role: "Backend Engineer" }),
      baris({ role: "IT DEVELOPER" }),
    ]);
    expect(kategori).toEqual(["Backend & API", "Data & Analytics", KATEGORI_LAINNYA]);
  });

  it("perusahaan unik, terurut, dan tanpa duplikat", () => {
    // Dua baris dari employer yang sama adalah satu perusahaan, bukan dua: kalau
    // tidak, select perusahaan akan menawarkan nama yang sama berkali-kali.
    const perusahaan = daftarPerusahaan([
      baris({ company: "Kredivo Group" }),
      baris({ company: "GudangAda" }),
      baris({ company: "Kredivo Group" }),
      baris({ company: "  Amartha  " }),
    ]);
    expect(perusahaan).toEqual(["Amartha", "GudangAda", "Kredivo Group"]);
  });

  it("perusahaan kosong tidak menjadi opsi filter", () => {
    // Baris tanpa nama perusahaan tidak boleh menghasilkan opsi "" — opsi itu
    // akan tampak seperti "semua perusahaan" tapi sebenarnya menyaring ke nol.
    const perusahaan = daftarPerusahaan([
      baris({ company: "" }),
      baris({ company: "   " }),
      baris({ company: "Julo" }),
    ]);
    expect(perusahaan).toEqual(["Julo"]);
  });
});

describe("hitungBarisHariIni", () => {
  it("hanya menghitung tanggal yang persis sama", () => {
    const barisHariIni = [
      baris({ url: "a", firstSeen: "2026-09-28" }),
      baris({ url: "b", firstSeen: "2026-09-28" }),
      baris({ url: "c", firstSeen: "2026-09-27" }),
      baris({ url: "d" }),
    ];
    expect(hitungBarisHariIni(barisHariIni, "2026-09-28")).toBe(2);
  });
});

describe("kunciHariIni", () => {
  /**
   * Inilah bug yang pernah dikirim: halaman memakai
   * `new Date().toISOString().slice(0, 10)` — hari **UTC** — sedangkan mesin
   * career-ops menstempel `first_seen` dengan hari **lokal** host
   * (`engine/lib/local-today.mjs`). Pada 00:40 WIB keduanya berbeda satu hari,
   * jadi "Lowongan baru hari ini" membaca nol selama ~7 jam pertama setiap hari
   * WIB.
   *
   * 2026-09-30T17:40:00Z adalah 2026-10-01 00:40 WIB — instan yang nyata
   * memicu bug ini. Yang diuji adalah *sifat*-nya (hari lokal ≠ hari UTC pada
   * rentang itu), bukan angka yang kebetulan.
   */
  const DINI_HARI_WIB = new Date("2026-09-30T17:40:00.000Z");

  it("memakai hari lokal, bukan hari UTC, untuk dini hari WIB", () => {
    expect(DINI_HARI_WIB.toISOString().slice(0, 10)).toBe("2026-09-30");
    expect(kunciHariIni(DINI_HARI_WIB)).toBe("2026-10-01");
  });

  it("sepakat dengan hari UTC saat tengah hari, jadi ini bukan offset yang salah", () => {
    const tengahHari = new Date("2026-10-01T05:00:00.000Z"); // 12:00 WIB
    expect(kunciHariIni(tengahHari)).toBe(tengahHari.toISOString().slice(0, 10));
  });

  it("menghitung baris yang distempel mesin pada hari lokal yang sama", () => {
    // Stempel mesin `localToday()` di 00:40 WIB adalah 2026-10-01, dan itulah
    // yang harus dibaca halaman — bukan 2026-09-30 milik UTC.
    const barisMesin = [baris({ url: "a", firstSeen: "2026-10-01" })];
    expect(hitungBarisHariIni(barisMesin, kunciHariIni(DINI_HARI_WIB))).toBe(1);
    expect(hitungBarisHariIni(barisMesin, DINI_HARI_WIB.toISOString().slice(0, 10))).toBe(0);
  });
});

describe("labelUrutan", () => {
  it("selalu punya label untuk setiap nilai yang select offered", () => {
    for (const { nilai } of URUTAN) {
      expect(labelUrutan(nilai)).not.toBe("");
    }
  });
});
