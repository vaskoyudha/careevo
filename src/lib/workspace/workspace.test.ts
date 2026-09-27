import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Penjaga permukaan audit ruang kerja (`manager/soal.mjs`).
 *
 * Tiga keputusan bentuk berkas ini mengikuti `sandbox.test.ts` dan alasannya
 * sama:
 *
 * 1. Ekstensi `.ts`, bukan `.test.mjs`. `include` di `vitest.config.mts` sempit:
 *    hanya berkas di dalam `src` yang berakhiran `.test.ts`. Berkas `.test.mjs`
 *    tidak terlihat `npm test` sama sekali.
 * 2. `soal.mjs` **dijalankan di proses Node terpisah**, bukan diimpor dari
 *    `.ts`. Mengimpor `.mjs` dari TypeScript butuh deklarasi tipe yang tidak ada
 *    di repo ini dan `tsc --noEmit` akan menolaknya. Menjalankan
 *    `node --input-type=module` memberi hal yang lebih baik: fungsi sungguhan
 *    yang dieksekusi.
 * 3. Flag keamanan **tetap** diperiksa sebagai teks. Untuk properti keamanan,
 *    "literal flag ini benar-benar ada di berkas audit" adalah assertion yang
 *    tepat, dan ia mengunci aturan bahwa tidak ada flag podman lain di luar
 *    berkas ini.
 *
 * Podman tidak dibutuhkan sama sekali: seluruh fungsi di bawah murni.
 */

const ALAMAT_SOAL = new URL("./manager/soal.mjs", import.meta.url);
const sumber = readFileSync(ALAMAT_SOAL, "utf8");

/**
 * Jalankan potongan kode yang mengimpor `soal.mjs` dan mencetak JSON.
 *
 * Setiap kasus dijalankan di proses sendiri supaya satu kegagalan tidak
 * menutupi yang lain, dan supaya tidak ada keadaan bersama antar kasus.
 */
function jalankan<T>(ekspresi: string): T {
  const keluaran = execFileSync(
    process.execPath,
    ["--input-type=module", "-e", `import * as m from ${JSON.stringify(ALAMAT_SOAL.href)}; console.log(JSON.stringify(${ekspresi}))`],
    { encoding: "utf8" },
  );
  return JSON.parse(keluaran.trim()) as T;
}

interface Argumen {
  args: string[];
}

describe("kunciWorkspace", () => {
  it("stabil untuk pasangan yang sama", () => {
    const a = jalankan<string>(`m.kunciWorkspace("u1","c1")`);
    const b = jalankan<string>(`m.kunciWorkspace("u1","c1")`);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it("berbeda untuk user berbeda di course yang sama", () => {
    const a = jalankan<string>(`m.kunciWorkspace("u1","c1")`);
    const b = jalankan<string>(`m.kunciWorkspace("u2","c1")`);
    expect(a).not.toBe(b);
  });

  it("berbeda untuk course berbeda bagi user yang sama", () => {
    const a = jalankan<string>(`m.kunciWorkspace("u1","c1")`);
    const b = jalankan<string>(`m.kunciWorkspace("u1","c2")`);
    expect(a).not.toBe(b);
  });

  it("tidak bisa ditabrakkan dengan menggeser batas antar-field", () => {
    // Ini alasan pemisah `\u0000` ada. Tanpa pemisah, `("a","bc")` dan
    // `("ab","c")` menghasilkan string gabungan yang sama. Dengan pemisah,
    // keduanya berbeda. Test ini mengunci pemisah itu: menghapusnya membuat
    // dua peserta berbagi satu ruang kerja.
    const a = jalankan<string>(`m.kunciWorkspace("a","bc")`);
    const b = jalankan<string>(`m.kunciWorkspace("ab","c")`);
    expect(a).not.toBe(b);
  });

  it("hanya berisi huruf heksadesimal, jadi aman jadi nama wadah", () => {
    const kunci = jalankan<string>(`m.kunciWorkspace("user dengan spasi/../x","course --flag")`);
    expect(kunci).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("namaWadah dan namaVolume", () => {
  it("memakai prefiks yang bisa dicari", () => {
    const wadah = jalankan<string>(`m.namaWadah("u1","c1")`);
    const volume = jalankan<string>(`m.namaVolume("u1","c1")`);
    expect(wadah).toMatch(/^careevo-ws-[0-9a-f]{12}$/);
    expect(volume).toMatch(/^careevo-ws-[0-9a-f]{12}-data$/);
  });

  it("nama wadah dan volume berbeda", () => {
    // Kalau keduanya sama, `podman rm -f` pada wadah bisa ikut menghapus volume
    // pekerjaan peserta. Test ini mengunci pemisahan itu.
    const wadah = jalankan<string>(`m.namaWadah("u1","c1")`);
    const volume = jalankan<string>(`m.namaVolume("u1","c1")`);
    expect(wadah).not.toBe(volume);
  });
});

describe("kataSandiWorkspace dihapus — dan kenapa itu benar", () => {
  it("soal.mjs tidak mengekspor kataSandiWorkspace lagi", () => {
    // Fungsi itu ada di versi pertama dan **tidak bisa bekerja**: kata sandi
    // code-server disimpan di cookie pada origin ruang kerja, dan iframe yang
    // di-sandbox tidak bisa menyimpan cookie apa pun sampai ia diberi
    // `allow-same-origin`. Yang peserta lihat bukan IDE, melainkan halaman
    // masuk yang tidak pernah bisa dilewati.
    //
    // Test ini mengunci penghapusannya. Kalau seseorang menambahkan kembali
    // autentikasi kata sandi, ia harus lebih dulu menjelaskan bagaimana cookie
    // itu tersimpan dari dalam iframe.
    const ada = jalankan<boolean>(`typeof m.kataSandiWorkspace === "function"`);
    expect(ada).toBe(false);
  });

  it("tidak ada rahasia yang bocor ke argumen kontainer", () => {
    // Kata sandi pernah dikirim lewat `--env=PASSWORD=`. Karena autentikasi
    // kini diserahkan ke loopback + kunci URL, tidak boleh ada env rahasia
    // sama sekali di baris perintah — nilai env terlihat oleh siapa pun yang
    // bisa menjalankan `podman inspect` di mesin ini.
    const { args } = jalankan<Argumen>(`m.bangunArgumenPodman({ userId: "u1", courseId: "c1" })`);
    expect(args.some((a) => a.startsWith("--env="))).toBe(false);
  });
});

describe("bangunArgumenPodman", () => {
  const { args } = jalankan<Argumen>(`m.bangunArgumenPodman({ userId: "u1", courseId: "c1" })`);

  it("selalu mendetach dan selalu membuang wadah", () => {
    expect(args).toContain("--detach");
    expect(args).toContain("--rm");
  });

  it("menutup eskalasi hak", () => {
    expect(args).toContain("--cap-drop=all");
    expect(args).toContain("--security-opt=no-new-privileges");
  });

  it("membatasi memori, cpu, dan proses", () => {
    expect(args.some((a) => a.startsWith("--memory="))).toBe(true);
    expect(args.some((a) => a.startsWith("--cpus="))).toBe(true);
    expect(args.some((a) => a.startsWith("--pids-limit="))).toBe(true);
  });

  it("menerbitkan port hanya ke loopback, dan membiarkan podman memilih portnya", () => {
    // `127.0.0.1::8080` — alamat eksplisit, port host kosong. Dua sifat itu
    // dikunci bersamaan: menerbitkan ke `0.0.0.0` membuka terminal peserta ke
    // jaringan, dan port host tetap membuat dua ruang kerja bertabrakan.
    const terbit = args.filter((a) => a.startsWith("--publish="));
    expect(terbit).toHaveLength(1);
    expect(terbit[0]).toMatch(/^--publish=127\.0\.0\.1::\d+$/);
  });

  it("tidak memakai --network=none, karena ruang kerja butuh jaringan", () => {
    // Berbeda dari runner eksekusi. Menutup jaringan membuat IDE yang tampak
    // lengkap tetapi tidak bisa `apt install` apa pun.
    expect(args.some((a) => a === "--network=none")).toBe(false);
  });

  it("tidak memakai --read-only, karena terminal harus bisa menulis", () => {
    expect(args).not.toContain("--read-only");
  });

  it("tidak menimpa --user, karena image sudah berjalan sebagai coder", () => {
    expect(args.some((a) => a.startsWith("--user"))).toBe(false);
  });

  it("me-mount volume pekerjaan peserta di titik mount image", () => {
    const mount = args.find((a) => a.startsWith("--volume="));
    expect(mount).toBeDefined();
    expect(mount).toMatch(/^--volume=careevo-ws-[0-9a-f]{12}-data:\/home\/coder\/project/);
  });

  it("tidak menaruh rahasia apa pun di baris perintah kontainer", () => {
    // Kata sandi pernah dikirim lewat `--env=PASSWORD=`. Autentikasi kini
    // diserahkan ke loopback + kunci URL, jadi tidak boleh ada env rahasia:
    // nilai env terlihat oleh siapa pun yang bisa `podman inspect` di mesin ini.
    expect(args.some((a) => a.startsWith("--env="))).toBe(false);
  });

  it("menyebut image yang dipin versinya, bukan latest", () => {
    // Dicari, bukan diambil dari posisi tetap: posisi image bergeser setiap
    // kali argumen code-server ditambah, dan test yang menghitung mundur dari
    // ujung akan menuduh argumen baru sebagai image yang salah.
    const image = args.find((a) => a.startsWith("docker.io/"));
    expect(image).toBeDefined();
    expect(image).toMatch(/^docker\.io\/codercom\/code-server:\d+\.\d+\.\d+$/);
    expect(image).not.toMatch(/latest/);
  });

  it("menaruh argumen code-server setelah nama image", () => {
    // Flag code-server sebelum nama image akan ditolak podman sebagai opsi
    // yang tidak dikenal. Urutannya bagian dari kontrak, bukan gaya.
    const indeksImage = args.findIndex((a) => a.startsWith("docker.io/"));
    expect(indeksImage).toBeGreaterThan(-1);
    const sesudah = args.slice(indeksImage + 1);
    expect(sesudah).toContain("--disable-telemetry");
    expect(sesudah).toContain("--auth");
  });

  it("memakai --auth none, karena kata sandi tidak bisa bekerja dari iframe", () => {
    // Kata sandi code-server disimpan di cookie pada origin ruang kerja, dan
    // iframe yang di-sandbox tidak bisa menyimpan cookie. Autentikasi
    // diserahkan ke loopback + kunci URL; lihat catatan di `soal.mjs`.
    const indeksImage = args.findIndex((a) => a.startsWith("docker.io/"));
    const sesudah = args.slice(indeksImage + 1);
    const indeksAuth = sesudah.indexOf("--auth");
    expect(indeksAuth).toBeGreaterThan(-1);
    expect(sesudah[indeksAuth + 1]).toBe("none");
  });

  it("membuka folder project, bukan home pengguna coder", () => {
    // Tanpa argumen posisional, code-server membuka `/home/coder` dan pohon
    // berkas menampilkan `.cache`, `.config`, `.local` — bukan pekerjaan
    // peserta. Argumen posisional harus menjadi yang **terakhir**; menaruhnya
    // sebelum sebuah flag membuat flag itu diperlakukan sebagai path.
    expect(args[args.length - 1]).toBe("/home/coder/project");
  });

  it("mematikan Workspace Trust", () => {
    // Spanduk "Restricted Mode" menahan fitur sampai peserta menekan "Trust".
    // Di ruang kerja yang seluruhnya miliknya sendiri, itu satu langkah yang
    // tidak melindungi apa pun.
    expect(args).toContain("--disable-workspace-trust");
  });

  it("hanya berkas audit ini yang menyebut flag podman", () => {
    // P7 spec: "apa yang boleh dilakukan kode peserta" harus bisa dijawab
    // dengan membaca satu berkas. Kalau `--cap-drop` atau `--pids-limit`
    // muncul di berkas lain, jawabannya tidak lagi bisa diberikan.
    const server = readFileSync(new URL("./manager/server.mjs", import.meta.url), "utf8");
    for (const flag of ["--cap-drop", "--pids-limit", "--memory=", "--cpus=", "--security-opt"]) {
      expect(server).not.toContain(flag);
    }
  });
});

describe("wadahSah", () => {
  it("menerima nama berpola kita", () => {
    const nama = jalankan<string>(`m.wadahSah("careevo-ws-bde21b789d5c")`);
    expect(nama).toBe("careevo-ws-bde21b789d5c");
  });

  it("menolak nama yang bukan milik kita", () => {
    for (const buruk of [
      "postgres",
      "careevo-ws-",
      "careevo-ws-ZZZZZZZZZZZZ",
      "careevo-ws-bde21b789d5c-extra",
      "other-careevo-ws-bde21b789d5c",
    ]) {
      const hasil = jalankan<string | null>(`m.wadahSah(${JSON.stringify(buruk)})`);
      expect(hasil).toBeNull();
    }
  });

  it("menolak nilai yang bukan teks", () => {
    expect(jalankan<string | null>(`m.wadahSah(null)`)).toBeNull();
    expect(jalankan<string | null>(`m.wadahSah(42)`)).toBeNull();
  });
});

describe("sudahMenganggur", () => {
  const SEKARANG = Date.parse("2026-10-03T12:00:00Z");

  it("belum lewat bila baru dipakai", () => {
    const baru = new Date(SEKARANG - 60_000).toISOString();
    expect(jalankan<boolean>(`m.sudahMenganggur(${JSON.stringify(baru)}, ${SEKARANG})`)).toBe(false);
  });

  it("sudah lewat bila melewati batas", () => {
    const lama = new Date(SEKARANG - 31 * 60_000).toISOString();
    expect(jalankan<boolean>(`m.sudahMenganggur(${JSON.stringify(lama)}, ${SEKARANG})`)).toBe(true);
  });

  it("stempel yang tidak bisa dibaca dianggap sudah lewat", () => {
    // Gagal-tertutup: ruang kerja yang umurnya tidak bisa diaudit tidak boleh
    // dianggap masih dipakai, karena itu satu-satunya cara kontainer tak
    // dikenal hidup selamanya.
    expect(jalankan<boolean>(`m.sudahMenganggur("bukan tanggal", ${SEKARANG})`)).toBe(true);
    expect(jalankan<boolean>(`m.sudahMenganggur(undefined, ${SEKARANG})`)).toBe(true);
  });
});

describe("urlWorkspace", () => {
  it("memakai subdomain bila domain dasar diisi", () => {
    const url = jalankan<string>(
      `m.urlWorkspace({ domainDasar: "ws.careevo.test", kunci: "abc123", port: 40957 })`,
    );
    expect(url).toBe("https://abc123.ws.careevo.test");
  });

  it("memakai localhost bila peserta membuka aplikasi lewat localhost", () => {
    // Origin yang sama dengan halaman yang membukanya. Tanpa ini, peserta yang
    // membuka `localhost:3000` mendapat IDE di `127.0.0.1:<port>` — origin yang
    // berbeda, jadi keadaan IDE-nya (berkas terbuka, tata letak) tersimpan di
    // ember yang berbeda.
    const url = jalankan<string>(
      `m.urlWorkspace({ domainDasar: "", kunci: "abc123", port: 40957, host: "localhost" })`,
    );
    expect(url).toBe("http://localhost:40957");
  });

  it("membuang port dari host yang dikirim", () => {
    const url = jalankan<string>(
      `m.urlWorkspace({ domainDasar: "", kunci: "abc123", port: 40957, host: "localhost:3000" })`,
    );
    expect(url).toBe("http://localhost:40957");
  });

  it("jatuh ke 127.0.0.1 bila host tidak diisi", () => {
    const url = jalankan<string>(`m.urlWorkspace({ domainDasar: "", kunci: "abc123", port: 40957 })`);
    expect(url).toBe("http://127.0.0.1:40957");
  });

  it("jatuh ke 127.0.0.1 untuk host yang tidak dikenal", () => {
    // Ini penjagaan yang penting: `Host` datang dari klien, jadi nilai apa pun
    // bisa masuk. URL yang menunjuk mesin lain adalah satu langkah dari open
    // redirect.
    for (const jahat of [
      "evil.example.com",
      "192.168.1.13",
      "0.0.0.0",
      "localhost.evil.com",
      "127.0.0.1.evil.com",
      "::1",
      "localhost@evil.com",
      "user:pass@evil.com",
    ]) {
      const url = jalankan<string>(
        `m.urlWorkspace({ domainDasar: "", kunci: "abc123", port: 40957, host: ${JSON.stringify(jahat)} })`,
      );
      expect(url, `host ${jahat} harus jatuh ke 127.0.0.1`).toBe("http://127.0.0.1:40957");
    }
  });

  it("namaHostSah adalah allowlist, bukan blocklist", () => {
    expect(jalankan<string>(`m.namaHostSah("localhost")`)).toBe("localhost");
    expect(jalankan<string>(`m.namaHostSah("LOCALHOST")`)).toBe("localhost");
    expect(jalankan<string>(`m.namaHostSah("127.0.0.1")`)).toBe("127.0.0.1");
    expect(jalankan<string>(`m.namaHostSah("apa-saja.com")`)).toBe("127.0.0.1");
    expect(jalankan<string>(`m.namaHostSah(undefined)`)).toBe("127.0.0.1");
    expect(jalankan<string>(`m.namaHostSah(42)`)).toBe("127.0.0.1");
  });
});

describe("permukaan audit", () => {
  it("BATAS_WS punya seluruh angka yang dipakai", () => {
    const batas = jalankan<Record<string, number | string>>(`m.BATAS_WS`);
    expect(batas.memori).toBe("2g");
    expect(batas.cpu).toBe("2");
    expect(typeof batas.proses).toBe("number");
    expect(batas.portDalam).toBe(8080);
    expect(typeof batas.menganggurMenit).toBe("number");
    expect(typeof batas.serentak).toBe("number");
  });

  it("soal.mjs tidak melakukan I/O", () => {
    // Berkas ini murni: tanpa `node:fs`, tanpa `node:child_process`, tanpa
    // `spawn`. Sifat itu yang membuatnya bisa diuji tanpa podman, dan yang
    // membuat "apa yang boleh dilakukan kode peserta" bisa dibaca tanpa
    // menjalankan apa pun.
    //
    // Yang diperiksa adalah **pernyataan impor**, bukan kemunculan teks:
    // berkas ini menyebut `node:fs` di komentar justru untuk menjelaskan bahwa
    // ia tidak memakainya, dan memeriksa teks biasa akan menuduh komentar itu.
    const impor = [...sumber.matchAll(/^\s*import\s.*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
    expect(impor).toEqual(["node:crypto"]);
    expect(sumber).not.toMatch(/\bspawn\s*\(/);
  });
});
