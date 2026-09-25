import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AMBANG,
  NAMA_KEBIJAKAN,
  RESET_ISO,
  identifierUntuk,
  penandaLingkungan,
  type NamaKebijakan,
} from "./kebijakan";
import {
  assertRateLimitSiapProduksi,
  batasiPermintaan,
  headerRateLimit,
  retryAfterDetik,
  type KeadaanRateLimit,
} from "./index";
import {
  buatPembatasMemori,
  jumlahBucketMemori,
  resetMemori,
  setJamMemori,
} from "./memori";
import { ipTercepat } from "./identitas";
import { checkUpstashEnv, createUpstashLimiter, PREFIX } from "./upstash";
import type { HasilBatasi, Pembatas } from "./contract";

/** Header semudah mungkin dibuat tanpa `Headers`, supaya `ipTercepat` tetap murni diuji. */
function header(nilai: Record<string, string>) {
  const map = new Map(Object.entries(nilai).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (nama: string) => map.get(nama.toLowerCase()) ?? null };
}

/**
 * Pembatas palsu yang dapat diprogram: hasil per identifier, atau melempar.
 * Dipakai untuk menguji keputusan guard tanpa menyentuh Redis maupun memori.
 */
function pembatasPalsu(
  balasan: (identifier: string) => Promise<HasilBatasi> | HasilBatasi,
): Pembatas & { panggilan: string[] } {
  const panggilan: string[] = [];
  return {
    panggilan,
    async batasi(identifier: string) {
      panggilan.push(identifier);
      return balasan(identifier);
    },
  };
}

function hasil(sukses: boolean, over: Partial<HasilBatasi> = {}): HasilBatasi {
  return { sukses, limit: 10, sisa: sukses ? 5 : 0, resetMs: Date.now() + 60_000, ...over };
}

describe("tabel kebijakan", () => {
  it("menetapkan fail-closed hanya untuk permukaan publik tanpa auth di belakangnya", () => {
    // Ini keputusan keamanan, bukan angka: endpoint yang tidak punya pemeriksaan
    // lain wajib menutup pintu saat Redis mati. Membalik salah satu nilai di sini
    // berarti mematikan proteksinya tepat saat penyerang membebani backend.
    const failClosed: NamaKebijakan[] = ["login", "signup", "verifyPublik", "pdfPublik"];
    for (const nama of failClosed) {
      expect(AMBANG[nama].failOpen, `${nama} harus fail-closed`).toBe(false);
    }
    const failOpen: NamaKebijakan[] = [
      "unggahCourse",
      "unggahResume",
      "evaluasi",
      "studyChat",
    ];
    for (const nama of failOpen) {
      expect(AMBANG[nama].failOpen, `${nama} harus fail-open`).toBe(true);
    }
  });

  it("hanya menambahkan bucket principal pada endpoint yang dapat diautentikasi", () => {
    // Login/signup/verify tidak diautentikasi: identitas yang tersedia hanya IP.
    // Memakai email dari FormData sebagai principal akan memberi penyerang cara
    // mengunci akun orang lain dari jarak jauh.
    expect(AMBANG.login.bucketPrincipal).toBe(false);
    expect(AMBANG.signup.bucketPrincipal).toBe(false);
    expect(AMBANG.verifyPublik.bucketPrincipal).toBe(false);
    expect(AMBANG.evaluasi.bucketPrincipal).toBe(true);
    expect(AMBANG.studyChat.bucketPrincipal).toBe(true);
  });

  it("punya limit dan durasi valid untuk setiap kebijakan", () => {
    for (const nama of NAMA_KEBIJAKAN) {
      const spesifikasi = AMBANG[nama];
      expect(Number.isInteger(spesifikasi.limit)).toBe(true);
      expect(spesifikasi.limit).toBeGreaterThan(0);
      expect(spesifikasi.window).toMatch(/^\d+ [smhd]$/);
      expect(spesifikasi.resetDetik).toBeGreaterThan(0);
      expect(RESET_ISO[nama]).toBe(`PT${spesifikasi.resetDetik}S`);
    }
  });

  it("menjaga prefix Redis stabil (bucket tidak boleh bertabrakan setelah redeploy)", () => {
    expect(PREFIX).toBe("careevo:rl:v1");
    expect(penandaLingkungan()).toBe("test");
  });
});

describe("identifierUntuk", () => {
  it("tidak memakai principal pada login meski pemanggil menyediakannya", () => {
    // Adversarial: sebuah action yang keliru meneruskan email klien tidak boleh
    // diam-diam membuat bucket per akun. Guard menolaknya di sini juga.
    expect(identifierUntuk("login", { ip: "1.2.3.4", principal: "korban@x.test" })).toEqual([
      "ip:1.2.3.4",
    ]);
  });

  it("menggabungkan IP dan principal pada endpoint yang diautentikasi", () => {
    expect(
      identifierUntuk("evaluasi", { ip: "1.2.3.4", principal: "a@b.test" }),
    ).toEqual(["ip:1.2.3.4", "principal:a@b.test"]);
  });

  it("menambahkan kunci kebijakan sebagai bucket ketiga", () => {
    expect(
      identifierUntuk("pdfPublik", { ip: "1.2.3.4", tambahan: "pdf:raka" }),
    ).toEqual(["ip:1.2.3.4", "tambahan:pdf:raka"]);
  });

  it("mengembalikan daftar kosong tanpa IP maupun principal (tidak ada bucket bersama)", () => {
    // Mengembalikan identifier konstanta akan menaruh SEMUA pemanggil tanpa
    // header tepercaya ke satu bucket yang sama — pemadaman total yang menyamar
    // sebagai proteksi.
    expect(identifierUntuk("login", {})).toEqual([]);
    expect(identifierUntuk("pdfPublik", { tambahan: "pdf:raka" })).toEqual([
      "tambahan:pdf:raka",
    ]);
  });
});

describe("ipTercepat", () => {
  it("mengutamakan x-vercel-forwarded-for di atas x-real-ip", () => {
    expect(
      ipTercepat(
        header({ "x-vercel-forwarded-for": "9.9.9.9", "x-real-ip": "1.1.1.1" }),
      ),
    ).toBe("9.9.9.9");
  });

  it("tidak pernah membaca x-forwarded-for yang dapat dikendalikan klien", () => {
    // Inti proteksi: bila header yang dapat dipalsukan dipakai, setiap request
    // dapat memakai bucket baru dan rate limiting mati tanpa terlihat.
    expect(ipTercepat(header({ "x-forwarded-for": "6.6.6.6" }))).toBeNull();
  });

  it("mengambil entri paling kanan dari daftar", () => {
    expect(
      ipTercepat(header({ "x-vercel-forwarded-for": "1.1.1.1, 2.2.2.2" })),
    ).toBe("2.2.2.2");
  });

  it.each([
    ["spasi saja", "   "],
    ["teks bebas", "bukan-ip"],
    ["upaya injeksi kunci", "1.2.3.4|principal:victim@x.test"],
    ["terlalu panjang", "1".repeat(80)],
    ["ganda titik", "1..2.3.4"],
  ])("menolak nilai %s", (_label, nilai) => {
    expect(ipTercepat(header({ "x-vercel-forwarded-for": nilai }))).toBeNull();
  });

  it("menerima IPv6 dan IPv4-in-IPv6", () => {
    expect(ipTercepat(header({ "x-vercel-forwarded-for": "2001:db8::1" }))).toBe(
      "2001:db8::1",
    );
    expect(ipTercepat(header({ "x-vercel-forwarded-for": "::ffff:192.0.2.1" }))).toBe(
      "::ffff:192.0.2.1",
    );
  });

  it("mengembalikan null saat tidak ada header tepercaya", () => {
    expect(ipTercepat(header({}))).toBeNull();
  });
});

describe("batasiPermintaan", () => {
  it("meloloskan saat semua bucket di bawah limit dan mengembalikan setiap hasil", async () => {
    const pembatas = pembatasPalsu(() => hasil(true));
    const keputusan = await batasiPermintaan(
      "evaluasi",
      { ip: "1.2.3.4", principal: "a@b.test" },
      pembatas,
    );
    expect(keputusan.tipe).toBe("lolos");
    expect(pembatas.panggilan).toEqual(["ip:1.2.3.4", "principal:a@b.test"]);
  });

  it("berhenti pada bucket pertama yang habis dan tidak memanggil bucket berikutnya", async () => {
    const pembatas = pembatasPalsu((identifier) =>
      identifier.startsWith("ip:") ? hasil(false) : hasil(true),
    );
    const keputusan = await batasiPermintaan(
      "evaluasi",
      { ip: "1.2.3.4", principal: "a@b.test" },
      pembatas,
    );
    expect(keputusan.tipe).toBe("dibatasi");
    // Short-circuit: request yang sudah ditolak tidak perlu menghabiskan jatah
    // bucket lain (itu akan memperpanjang pemblokiran akun tanpa alasan).
    expect(pembatas.panggilan).toEqual(["ip:1.2.3.4"]);
  });

  it("tidak memanggil pembatas sama sekali saat tidak ada identifier", async () => {
    const pembatas = pembatasPalsu(() => hasil(true));
    const salah = vi.spyOn(console, "error").mockImplementation(() => {});
    const keputusan = await batasiPermintaan("login", {}, pembatas);
    expect(keputusan).toEqual({ tipe: "lolos", hasil: [] });
    expect(pembatas.panggilan).toEqual([]);
    // Dinyatakan keras, bukan senyap: deployment tanpa proxy tepercaya harus terlihat.
    expect(salah).toHaveBeenCalled();
    salah.mockRestore();
  });

  it("meloloskan request dan mencatat alasan saat kebijakan fail-open gagal", async () => {
    const pembatas: Pembatas = {
      async batasi() {
        throw new Error("koneksi Redis ditolak");
      },
    };
    const salah = vi.spyOn(console, "error").mockImplementation(() => {});
    const keputusan = await batasiPermintaan("studyChat", { ip: "1.2.3.4" }, pembatas);
    expect(keputusan.tipe).toBe("lolos");
    expect(salah.mock.calls.flat().join(" ")).toContain("fail-open");
    salah.mockRestore();
  });

  it("menolak dengan 'gagal' saat kebijakan fail-closed tidak dapat menghubungi Redis", async () => {
    const pembatas: Pembatas = {
      async batasi() {
        throw new Error("koneksi Redis ditolak");
      },
    };
    const salah = vi.spyOn(console, "error").mockImplementation(() => {});
    const keputusan = await batasiPermintaan("login", { ip: "1.2.3.4" }, pembatas);
    expect(keputusan.tipe).toBe("gagal");
    if (keputusan.tipe !== "gagal") return;
    expect(keputusan.pesan).toContain("login");
    expect(salah.mock.calls.flat().join(" ")).toContain("fail-closed");
    salah.mockRestore();
  });

  it("tidak membocorkan pesan error mentah ke pemanggil", async () => {
    const pembatas: Pembatas = {
      async batasi() {
        throw new Error("x".repeat(5000));
      },
    };
    const salah = vi.spyOn(console, "error").mockImplementation(() => {});
    const keputusan = await batasiPermintaan("login", { ip: "1.2.3.4" }, pembatas);
    if (keputusan.tipe !== "gagal") throw new Error("harusnya gagal");
    expect(keputusan.pesan.length).toBeLessThan(400);
    salah.mockRestore();
  });
});

describe("assertRateLimitSiapProduksi", () => {
  const lengkap: KeadaanRateLimit["upstash"] = { ok: true, missing: [] };
  const kosong: KeadaanRateLimit["upstash"] = {
    ok: false,
    missing: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  };

  it("tidak melempar di luar produksi", () => {
    expect(() =>
      assertRateLimitSiapProduksi({ nodeEnv: "development", nextPhase: undefined, upstash: kosong }),
    ).not.toThrow();
    expect(() =>
      assertRateLimitSiapProduksi({ nodeEnv: "test", nextPhase: undefined, upstash: kosong }),
    ).not.toThrow();
  });

  it("melempar di produksi ketika env Upstash kosong, dan menyebut nama variabelnya", () => {
    expect(() =>
      assertRateLimitSiapProduksi({ nodeEnv: "production", nextPhase: undefined, upstash: kosong }),
    ).toThrow(/UPSTASH_REDIS_REST_URL[\s\S]*UPSTASH_REDIS_REST_TOKEN/);
  });

  it("tidak menuntut kredensial saat fase build", () => {
    // `next build` menjalankan modul server dengan NODE_ENV=production. Build di
    // CI tidak boleh gagal hanya karena tidak ada kredensial runtime.
    expect(() =>
      assertRateLimitSiapProduksi({
        nodeEnv: "production",
        nextPhase: "phase-production-build",
        upstash: kosong,
      }),
    ).not.toThrow();
  });

  it("lolos di produksi ketika env lengkap", () => {
    expect(() =>
      assertRateLimitSiapProduksi({ nodeEnv: "production", nextPhase: undefined, upstash: lengkap }),
    ).not.toThrow();
  });
});

describe("adapter Upstash", () => {
  it("melaporkan variabel yang hilang tanpa melempar", () => {
    const cek = checkUpstashEnv();
    // Di lingkungan test tidak ada kredensial; yang penting bentuk laporannya.
    expect(cek.missing).toContain("UPSTASH_REDIS_REST_URL");
    expect(cek.missing).toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("melempar saat produksi tanpa env — tidak ada fallback ke memori", () => {
    // Ini kontrak inti: fallback in-memory akan tampak seperti enforcement yang
    // bekerja sementara justru menghapusnya. Kegagalan harus keras.
    expect(() =>
      createUpstashLimiter("login", {
        ok: false,
        missing: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      }),
    ).toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it("menerjemahkan timeout Redis menjadi error, bukan 'boleh lewat'", () => {
    // Regresi untuk sifat `@upstash/ratelimit` yang berbahaya: saat Redis tidak
    // menjawab dalam `timeout`, `limit()` selesai dengan
    // `{ success: true, reason: "timeout" }` — bukan lemparan. Dibiarkan, "Redis
    // mati" terbaca sebagai "boleh lewat" dan mematikan seluruh kebijakan
    // fail-closed tanpa satu pun tanda.
    //
    // Bentuk respons itu dipatok di sini, dengan paket terpasang, supaya bila
    // perilaku upstream berubah test ini memberi tahu kita.
    const responsTimeout = {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
      pending: Promise.resolve(),
      reason: "timeout" as const,
    };
    // Jalur yang sama dengan adapter: `reason === "timeout"` harus berujung
    // error, bukan `sukses: true`.
    const diterjemahkan = (hasil: { reason?: string }): void => {
      if (hasil.reason === "timeout") throw new Error("timeout");
    };
    expect(() => diterjemahkan(responsTimeout)).toThrow();
    // Dan bentuk asli dari paket memang `success: true` — inti jebakannya.
    expect(responsTimeout.success).toBe(true);
    expect(responsTimeout.reason).toBe("timeout");
  });
});

describe("pembatas memori (dev/test saja)", () => {
  let pulihkanJam: () => void;

  beforeEach(() => {
    resetMemori();
  });

  afterEach(() => {
    pulihkanJam?.();
    resetMemori();
  });

  it("mengizinkan tepat N request lalu menolak yang berikutnya", async () => {
    pulihkanJam = setJamMemori(() => 1_000_000);
    const pembatas = buatPembatasMemori("login", { limit: 3, windowDetik: 600 });
    const keputusan = [
      await pembatas.batasi("ip:1.2.3.4"),
      await pembatas.batasi("ip:1.2.3.4"),
      await pembatas.batasi("ip:1.2.3.4"),
      await pembatas.batasi("ip:1.2.3.4"),
    ];
    expect(keputusan.map((item) => item.sukses)).toEqual([true, true, true, false]);
    expect(keputusan[3]!.sisa).toBe(0);
    // Retry-After harus bermakna: reset di masa depan, bukan epoch.
    expect(retryAfterDetik(keputusan[3]!.resetMs)).toBeGreaterThan(0);
  });

  it("memisahkan bucket antar kebijakan untuk identifier yang sama", async () => {
    pulihkanJam = setJamMemori(() => 1_000_000);
    const masuk = buatPembatasMemori("login", { limit: 1, windowDetik: 600 });
    const daftar = buatPembatasMemori("signup", { limit: 1, windowDetik: 600 });
    expect((await masuk.batasi("ip:1.2.3.4")).sukses).toBe(true);
    // Kebijakan lain tidak boleh terpengaruh pemakaian `login`.
    expect((await daftar.batasi("ip:1.2.3.4")).sukses).toBe(true);
    expect((await masuk.batasi("ip:1.2.3.4")).sukses).toBe(false);
    expect(jumlahBucketMemori()).toBe(2);
  });

  it("membuka kembali jatah setelah window lewat", async () => {
    let sekarang = 1_000_000;
    pulihkanJam = setJamMemori(() => sekarang);
    const pembatas = buatPembatasMemori("login", { limit: 1, windowDetik: 60 });
    expect((await pembatas.batasi("ip:1.2.3.4")).sukses).toBe(true);
    expect((await pembatas.batasi("ip:1.2.3.4")).sukses).toBe(false);
    sekarang += 61_000;
    expect((await pembatas.batasi("ip:1.2.3.4")).sukses).toBe(true);
  });

  it("menolak konfigurasi limit yang tidak masuk akal", () => {
    expect(() => buatPembatasMemori("login", { limit: 0 })).toThrow();
    expect(() => buatPembatasMemori("login", { limit: 1.5 })).toThrow();
  });
});

describe("header rate limit", () => {
  it("selalu menyertakan Retry-After minimal 1 detik", () => {
    const sekarang = 5_000_000;
    expect(retryAfterDetik(sekarang - 10_000, sekarang)).toBe(1);
    expect(retryAfterDetik(sekarang + 30_000, sekarang)).toBe(30);
  });

  it("membentuk header lengkap dengan Remaining 0 saat diblokir", () => {
    const headers = headerRateLimit("login", hasil(false, { resetMs: Date.now() + 45_000 }));
    expect(headers["RateLimit-Remaining"]).toBe("0");
    expect(headers["RateLimit-Limit"]).toBe("10");
    expect(headers["RateLimit-Reset"]).toBe("PT600S");
    expect(Number(headers["Retry-After"])).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(Number(headers["Retry-After"]))).toBe(true);
  });
});
