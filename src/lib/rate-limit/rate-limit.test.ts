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
import { ipTercepat, percayaXRealIpDariEnv, ENV_PERCAYA_X_REAL_IP } from "./identitas";
import {
  checkUpstashEnv,
  createUpstashLimiter,
  PREFIX,
  VAR_MALFORMASI,
} from "./upstash";
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
        { percayaXRealIp: true },
      ),
    ).toBe("9.9.9.9");
  });

  it("tidak pernah membaca x-forwarded-for yang dapat dikendalikan klien", () => {
    // Inti proteksi: bila header yang dapat dipalsukan dipakai, setiap request
    // dapat memakai bucket baru dan rate limiting mati tanpa terlihat.
    expect(ipTercepat(header({ "x-forwarded-for": "6.6.6.6" }))).toBeNull();
    expect(
      ipTercepat(header({ "x-forwarded-for": "6.6.6.6" }), { percayaXRealIp: true }),
    ).toBeNull();
  });

  it("mengabaikan x-real-ip secara default — header itu bukan milik Vercel", () => {
    // Adversarial: pada deployment yang tidak berada di belakang proxy yang
    // menormalkan header ini, klien dapat mengirimnya sendiri dan setiap request
    // akan mendapat bucket baru. Karena itu ia mati kecuali dinyatakan eksplisit.
    expect(ipTercepat(header({ "x-real-ip": "1.1.1.1" }))).toBeNull();
  });

  it("membaca x-real-ip hanya setelah opt-in eksplisit", () => {
    expect(
      ipTercepat(header({ "x-real-ip": "1.1.1.1" }), { percayaXRealIp: true }),
    ).toBe("1.1.1.1");
  });

  it("env CAREEVO_TRUST_REAL_IP_HEADER adalah satu-satunya saklar x-real-ip", () => {
    // Pola opt-in yang sama dengan `CAREEVO_TRUST_PROXY_HEADERS` di
    // `@/lib/http/origin`: positif eksplisit, bukan disimpulkan dari NODE_ENV.
    expect(percayaXRealIpDariEnv({})).toBe(false);
    expect(percayaXRealIpDariEnv({ [ENV_PERCAYA_X_REAL_IP]: "0" })).toBe(false);
    expect(percayaXRealIpDariEnv({ [ENV_PERCAYA_X_REAL_IP]: "false" })).toBe(false);
    expect(percayaXRealIpDariEnv({ [ENV_PERCAYA_X_REAL_IP]: "1" })).toBe(true);
    expect(percayaXRealIpDariEnv({ [ENV_PERCAYA_X_REAL_IP]: "true" })).toBe(true);
    expect(percayaXRealIpDariEnv({ [ENV_PERCAYA_X_REAL_IP]: "TRUE" })).toBe(true);
  });

  it("mematikan x-real-ip pada pemanggilan default (env proses tidak diisi)", () => {
    // Pemanggilan tanpa argumen kedua harus membaca env, dan default repo ini
    // adalah mati. Var di-stub ke `undefined` lebih dulu supaya test tidak
    // bergantung pada shell pengembang yang kebetulan mengekspornya.
    vi.stubEnv(ENV_PERCAYA_X_REAL_IP, undefined);
    try {
      expect(percayaXRealIpDariEnv()).toBe(false);
      // Inilah yang membuat `next.ts` aman tanpa opsi tambahan: jalur produksi
      // tidak membaca header yang bukan milik Vercel.
      expect(ipTercepat(header({ "x-real-ip": "1.1.1.1" }))).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("mengambil entri paling kanan dari daftar", () => {
    expect(
      ipTercepat(header({ "x-vercel-forwarded-for": "1.1.1.1, 2.2.2.2" })),
    ).toBe("2.2.2.2");
    expect(
      ipTercepat(header({ "x-real-ip": "1.1.1.1, 2.2.2.2" }), { percayaXRealIp: true }),
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
    // Nilai buruk ditolak juga pada header opt-in: kepercayaan pada sumbernya
    // tidak berarti bentuknya boleh apa saja.
    expect(
      ipTercepat(header({ "x-real-ip": nilai }), { percayaXRealIp: true }),
    ).toBeNull();
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
    expect(ipTercepat(header({}), { percayaXRealIp: true })).toBeNull();
  });

  it("jatuh ke x-real-ip hanya bila x-vercel-forwarded-for tidak ada, dan setelah opt-in", () => {
    const h = header({ "x-vercel-forwarded-for": "bukan-ip", "x-real-ip": "1.1.1.1" });
    // Header Vercel ada tetapi bentuknya tidak sah → tidak menggugurkan opt-in
    // untuk header kedua; kandidat yang sah berikutnya dipakai.
    expect(ipTercepat(h, { percayaXRealIp: true })).toBe("1.1.1.1");
    // Tanpa opt-in, header Vercel yang tidak sah berhenti di situ.
    expect(ipTercepat(h)).toBeNull();
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

/**
 * Kegagalan **konstruksi** pembatas, tanpa override.
 *
 * Cacat yang diperbaiki: `resolvePembatas(nama)` dulu menjadi nilai default
 * parameter, sehingga ia dievaluasi **sebelum** badan fungsi — dan sebelum
 * `try`. Di produksi, env Upstash yang hilang/malformasi membuat
 * `createUpstashLimiter()` melempar keluar dari `batasiPermintaan()` alih-alih
 * diubah menjadi `gagal`/`lolos` sesuai `failOpen`. Akibatnya kebijakan
 * fail-open ikut menjatuhkan request dengan error tak tertangani, padahal
 * kontraknya adalah meloloskan dengan catatan. Test ini memanggil tanpa argumen
 * ketiga supaya jalur `resolvePembatas()` benar-benar dijalankan.
 */
describe("batasiPermintaan — kegagalan konstruksi pembatas", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    // Produksi tanpa kredensial: konstruksi pasti gagal, dan tidak ada fallback
    // memori yang menyamarkan hasilnya.
    vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("mengubah kegagalan konstruksi menjadi 'gagal' untuk kebijakan fail-closed", async () => {
    const salah = vi.spyOn(console, "error").mockImplementation(() => {});
    const keputusan = await batasiPermintaan("login", { ip: "1.2.3.4" });
    salah.mockRestore();

    // Bukan lemparan: kebijakan fail-closed harus berakhir 503 lewat `gagal`.
    expect(keputusan.tipe).toBe("gagal");
    if (keputusan.tipe !== "gagal") return;
    expect(keputusan.pesan).toContain("login");
    // Pesannya menunjuk penyebab sebenarnya (env Upstash), bukan "koneksi ditolak".
    expect(keputusan.pesan).toMatch(/Upstash/i);
  });

  it("meloloskan dengan catatan log untuk kebijakan fail-open, bukan melempar", async () => {
    const salah = vi.spyOn(console, "error").mockImplementation(() => {});
    const keputusan = await batasiPermintaan("unggahCourse", { ip: "1.2.3.4" });
    const catatan = salah.mock.calls.flat().join(" ");
    salah.mockRestore();

    expect(keputusan.tipe).toBe("lolos");
    expect(catatan).toContain("fail-open");
    expect(catatan).toContain("unggahCourse");
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

  it("menolak boot produksi saat env terisi URL malformasi", () => {
    // Gerbang startup adalah tempat cacat ini dicegah: URL yang salah bentuk
    // membuat `createUpstashLimiter()` gagal pada request pertama, jadi
    // meloloskan boot berarti menerima traffic dengan pembatas yang pasti mati.
    for (const url of ["bukan url", "redis://localhost:6379", "ftp://x.test"]) {
      const upstash = checkUpstashEnv({
        UPSTASH_REDIS_REST_URL: url,
        UPSTASH_REDIS_REST_TOKEN: "token",
      });
      expect(upstash.ok, `${url} seharusnya ditolak`).toBe(false);
      expect(() =>
        assertRateLimitSiapProduksi({
          nodeEnv: "production",
          nextPhase: undefined,
          upstash,
        }),
      ).toThrow(/tidak valid/);
    }
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
    const cek = checkUpstashEnv({});
    // Yang penting bentuk laporannya: kedua variabel disebut, bukan undefined.
    expect(cek.ok).toBe(false);
    expect(cek.missing).toContain("UPSTASH_REDIS_REST_URL");
    expect(cek.missing).toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("menerima env lengkap dengan URL http/https", () => {
    expect(
      checkUpstashEnv({
        UPSTASH_REDIS_REST_URL: "https://contoh.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "token",
      }),
    ).toEqual({ ok: true, missing: [] });
    // http: juga sah (mis. Upstash self-hosted/proxy internal).
    expect(
      checkUpstashEnv({
        UPSTASH_REDIS_REST_URL: "http://127.0.0.1:8080",
        UPSTASH_REDIS_REST_TOKEN: "token",
      }).ok,
    ).toBe(true);
  });

  it.each([
    ["tidak dapat di-parse", "bukan url"],
    ["protokol redis mentah", "redis://localhost:6379"],
    ["skema lain", "ftp://contoh.upstash.io"],
    ["host kosong", "https://"],
    ["relatif tanpa host", "/v1/redis"],
  ])("menolak URL %s meski variabelnya terisi", (_label, url) => {
    // Ini cacat yang diperbaiki: `checkUpstashEnv()` lama hanya mengecek
    // "non-kosong", sehingga `assertRateLimitSiapProduksi()` meloloskan boot
    // dengan URL yang pasti gagal saat request pertama — dan seluruh kebijakan
    // fail-closed baru ketahuan rusak setelah menerima traffic. Gerbang startup
    // justru ada untuk mencegah tepat kegagalan itu.
    const cek = checkUpstashEnv({
      UPSTASH_REDIS_REST_URL: url,
      UPSTASH_REDIS_REST_TOKEN: "token",
    });
    expect(cek.ok).toBe(false);
    expect(cek.missing).toContain(VAR_MALFORMASI.url);
    // Token yang sah tidak ikut dilaporkan — pesannya harus menunjuk URL saja.
    expect(cek.missing).not.toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("memangkas spasi sebelum memvalidasi (nilai env sering terbawa newline)", () => {
    expect(
      checkUpstashEnv({
        UPSTASH_REDIS_REST_URL: "  https://contoh.upstash.io\n",
        UPSTASH_REDIS_REST_TOKEN: " token ",
      }).ok,
    ).toBe(true);
  });

  it("menganggap URL berisi spasi saja sebagai hilang, bukan malformasi", () => {
    const cek = checkUpstashEnv({
      UPSTASH_REDIS_REST_URL: "   ",
      UPSTASH_REDIS_REST_TOKEN: "token",
    });
    expect(cek.missing).toContain("UPSTASH_REDIS_REST_URL");
    expect(cek.missing).not.toContain(VAR_MALFORMASI.url);
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

  it("melempar saat env hanya berisi URL malformasi", () => {
    expect(() =>
      createUpstashLimiter("login", {
        ok: false,
        missing: [VAR_MALFORMASI.url],
      }),
    ).toThrow(/tidak valid/);
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
