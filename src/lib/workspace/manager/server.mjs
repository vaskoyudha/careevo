/**
 * Manajer ruang kerja: proses Node terpisah di sekitar `soal.mjs`.
 *
 * Ini pasangan `exec/runner/server.mjs` untuk ruang kerja. Pembagian tugasnya
 * sama dan sengaja: `soal.mjs` menjawab "apa yang boleh dilakukan kode
 * peserta" dan tidak melakukan I/O; berkas ini menjawab "bagaimana permintaan
 * sampai ke sana" — bind, authenticate, spawn, dan pembersihan.
 *
 * Tidak ada satu pun flag podman di bawah ini; semuanya datang dari
 * `bangunArgumenPodman`. Kalau sebuah flag muncul di sini, permukaan audit
 * sudah bocor dan jawabannya tidak lagi bisa diberikan dengan membaca satu
 * berkas.
 *
 * ## Bentuk hidupnya berbeda dari runner, dan itu menentukan seluruh berkas ini
 *
 * Runner eksekusi adalah fungsi: masuk kode, keluar hasil, selesai. Manajer ini
 * memegang **keadaan** — daftar ruang kerja yang hidup, kapan masing-masing
 * terakhir dipakai, dan port host yang podman pilih untuk masing-masing. Karena
 * itu ia punya dua hal yang tidak dimiliki runner:
 *
 * 1. **Peta dalam memori** (`ruangKerja`) yang mengikat kunci → `{ port,
 *    terakhirDipakai }`. Peta ini **bukan sumber kebenaran**; sumber
 *    kebenarannya adalah podman. Peta ini hanya menyimpan hal yang mahal
 *    ditanyakan berulang kali, yaitu port host. Kalau proses ini mati dan
 *    hidup lagi, peta kosong dan ruang kerja yang masih jalan akan dianggap
 *    tidak ada lalu dijalankan ulang — dan `podman run` dengan nama yang sudah
 *    dipakai akan gagal. Itu sebabnya `mulai()` memeriksa podman lebih dulu,
 *    bukan peta.
 * 2. **Penyapu** (`setInterval`) yang mematikan ruang kerja menganggur. Tanpa
 *    itu, setiap tab yang ditutup meninggalkan kontainer 2 GB yang menunggu
 *    selamanya.
 *
 * ## Yang **tidak** dilakukan berkas ini
 *
 * - **Tidak menerbitkan port ke jaringan.** Port selalu di `127.0.0.1`; yang
 *   menghadap peserta adalah reverse proxy. Lihat catatan di `soal.mjs`.
 * - **Tidak menyimpan kata sandi.** Kata sandi diturunkan ulang dari rahasia
 *   bersama setiap kali ruang kerja dijalankan (`kataSandiWorkspace`), jadi
 *   tidak ada tabel kata sandi yang bisa bocor.
 * - **Tidak menghapus volume.** `berhenti()` mematikan kontainer; volume
 *   tempat pekerjaan peserta tinggal. Menghapusnya adalah aksi tersendiri
 *   (`hapus()`), karena satu-satunya hal yang tidak bisa dipulihkan adalah
 *   pekerjaan orang.
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  BATAS_WS,
  IMAGE_WORKSPACE,
  bangunArgumenPodman,
  kunciWorkspace,
  namaWadah,
  sudahMenganggur,
  urlWorkspace,
  wadahSah,
} from "./soal.mjs";

/**
 * Loopback saja, tidak pernah `0.0.0.0`.
 *
 * Port ini bisa **menjalankan kontainer**. Siapa pun yang bisa mencapainya bisa
 * membuat ruang kerja baru atas namanya sendiri. Loopback dan rahasia bersama
 * adalah dua lapis yang menahannya, sama seperti runner.
 */
const HOST = "127.0.0.1";
const PORT = Number(process.env.CAREEVO_WORKSPACE_PORT ?? 8022);

/**
 * Rahasia bersama, dibandingkan pada setiap permintaan.
 *
 * Kosong berarti menolak semuanya, bukan melayani terbuka. Rahasia ini yang
 * menjaga manajer dari proses lokal lain yang bisa menjalankan kontainer —
 * sama seperti runner eksekusi.
 */
const RAHASIA = process.env.CAREEVO_WORKSPACE_SECRET ?? "";

/**
 * Domain dasar untuk URL ruang kerja, tanpa skema dan tanpa garis miring.
 *
 * Kosong berarti mesin ini tidak punya DNS, dan URL yang dikembalikan adalah
 * loopback berport. Itu bentuk pengembangan; produksi mengisinya dengan
 * domain sungguhan (mis. `ws.careevo.app`) dan bentuk URL-nya berubah jadi
 * subdomain. Dua bentuk itu diuji di `workspace.test.ts`.
 */
const DOMAIN_DASAR = (process.env.CAREEVO_WORKSPACE_DOMAIN ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

/**
 * Berapa lama perintah podman boleh berjalan sebelum dianggap menggantung.
 *
 * `podman run` yang sedang mengunduh layer bisa lama, tetapi bukan tanpa batas:
 * tanpa plafon, satu unduhan yang macet menahan satu permintaan HTTP selamanya
 * dan peserta melihat halaman yang berputar tanpa alasan.
 */
const BATAS_PODMAN_MS = 120_000;

/**
 * Keadaan yang **tidak** boleh hilang saat proses ini hidup: port host per
 * ruang kerja, dan kapan masing-masing terakhir dipakai.
 *
 * Nilainya sengaja tidak pernah ditulis ke disk. Kalau proses ini mati, podman
 * tetap tahu ruang kerja mana yang hidup (`podman ps`), jadi port bisa
 * ditanyakan ulang lewat `podman port`. Menyimpan peta ini ke disk hanya
 * menciptakan sumber kebenaran kedua yang bisa menyimpang dari podman.
 */
const ruangKerja = new Map();

function kirim(res, kode, badan) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(kode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(badan));
}

/**
 * Jalankan perintah dan kembalikan keluarannya.
 *
 * `env` dibersihkan dari variabel yang bisa mengubah perilaku podman tanpa
 * sengaja. `error` (binar tidak ada) dan `close` (selesai) diperlakukan sama
 * seperti di runner: keduanya menutup promise sekali, dan yang kedua tidak
 * menimpa.
 */
function jalankan(perintah, argumen, { batasMs = BATAS_PODMAN_MS } = {}) {
  return new Promise((selesai) => {
    const anak = spawn(perintah, argumen, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let ditutup = false;

    anak.stdout.setEncoding("utf8");
    anak.stderr.setEncoding("utf8");
    anak.stdout.on("data", (c) => {
      stdout += c;
    });
    anak.stderr.on("data", (c) => {
      stderr += c;
    });

    const timer = setTimeout(() => {
      anak.kill("SIGKILL");
    }, batasMs);

    const tutup = (kode) => {
      if (ditutup) return;
      ditutup = true;
      clearTimeout(timer);
      selesai({ kode, stdout, stderr });
    };

    anak.on("error", (galat) => {
      stderr += String(galat.message);
      tutup(null);
    });
    anak.on("close", (kode) => tutup(kode));
  });
}

/** Apakah sebuah wadah sedang berjalan, menurut podman (bukan menurut peta). */
async function wadahHidup(nama) {
  const { kode, stdout } = await jalankan("podman", [
    "ps",
    "--filter",
    `name=^${nama}$`,
    "--format",
    "{{.Names}}",
  ]);
  if (kode !== 0) return false;
  return stdout.trim() === nama;
}

/**
 * Port host yang podman pilih untuk sebuah wadah.
 *
 * `podman port <nama> 8080/tcp` mengembalikan `127.0.0.1:34567`. Yang diambil
 * hanya angkanya. Bila ada lebih dari satu baris (IPv4 dan IPv6), baris pertama
 * yang dipakai — keduanya menunjuk port yang sama.
 *
 * Mengembalikan `null` bila podman tidak bisa memberi jawaban yang bisa
 * dipercaya; pemanggil memperlakukannya sebagai "ruang kerja tidak siap",
 * bukan sebagai port 0.
 */
async function portWadah(nama) {
  const { kode, stdout } = await jalankan("podman", ["port", nama, `${BATAS_WS.portDalam}/tcp`]);
  if (kode !== 0) return null;
  const baris = stdout.trim().split("\n")[0] ?? "";
  const cocok = /:(\d+)$/.exec(baris);
  if (!cocok) return null;
  const port = Number(cocok[1]);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

/**
 * Berapa ruang kerja yang sedang hidup.
 *
 * Dihitung dari podman, bukan dari peta, karena peta bisa tertinggal setelah
 * proses ini hidup kembali. Angka ini yang menegakkan `BATAS_WS.serentak`.
 */
async function hitungHidup() {
  const { kode, stdout } = await jalankan("podman", [
    "ps",
    "--filter",
    "name=^careevo-ws-",
    "--format",
    "{{.Names}}",
  ]);
  if (kode !== 0) return null;
  return stdout.trim() ? stdout.trim().split("\n").length : 0;
}

/**
 * Mulai — atau temukan kembali — ruang kerja milik satu peserta.
 *
 * Urutannya disengaja, dari yang paling murah ke yang paling mahal:
 *
 * 1. **Sudah hidup?** Ditanyakan ke podman, bukan ke peta. Ini yang membuat
 *    proses yang baru hidup kembali tetap menemukan ruang kerja yang masih
 *    jalan, dan peserta tidak kehilangan pekerjaannya saat manajer di-restart.
 * 2. **Kapasitas.** Ditolak **sebelum** podman dipanggil kalau sudah penuh,
 *    dengan pesan yang bisa dibaca peserta. Kalau tidak, yang terjadi adalah
 *    OOM yang membunuh ruang kerja orang lain — kegagalan yang menimpa orang
 *    yang tidak bersalah.
 * 3. **Jalankan.** `bangunArgumenPodman` menyusun seluruh flag.
 *
 * Mengembalikan `{ ok: true, url, kunci, port }` atau `{ ok: false, alasan }`.
 */
async function mulai({ userId, courseId, host }) {
  if (!RAHASIA) return { ok: false, alasan: "galat_manajer" };

  const nama = namaWadah(userId, courseId);
  const kunci = kunciWorkspace(userId, courseId);

  if (await wadahHidup(nama)) {
    const port = await portWadah(nama);
    if (port === null) return { ok: false, alasan: "galat_manajer" };
    ruangKerja.set(kunci, { port, terakhirDipakai: Date.now() });
    return { ok: true, hidup: true, url: urlWorkspace({ domainDasar: DOMAIN_DASAR, kunci, port, host }), kunci, port };
  }

  const hidup = await hitungHidup();
  if (hidup === null) return { ok: false, alasan: "galat_manajer" };
  if (hidup >= BATAS_WS.serentak) return { ok: false, alasan: "penuh" };

  const { args } = bangunArgumenPodman({ userId, courseId });
  const hasil = await jalankan("podman", args);

  if (hasil.kode !== 0) {
    // Pesan podman ditulis ke log manajer, bukan ke peserta. Isinya memuat
    // path volume dan nama image di mesin ini — detail yang tidak menambah
    // apa pun bagi peserta dan tidak seharusnya keluar dari sini.
    process.stderr.write(`podman run gagal (${nama}): ${hasil.stderr.trim()}\n`);
    return { ok: false, alasan: "galat_manajer" };
  }

  const port = await portWadah(nama);
  if (port === null) {
    // Wadah sudah jalan tetapi portnya tidak terbaca. Dibersihkan di sini
    // supaya tidak meninggalkan wadah yatim yang memakan slot kapasitas.
    await jalankan("podman", ["rm", "-f", nama]);
    return { ok: false, alasan: "galat_manajer" };
  }

  ruangKerja.set(kunci, { port, terakhirDipakai: Date.now() });
  return { ok: true, hidup: true, url: urlWorkspace({ domainDasar: DOMAIN_DASAR, kunci, port, host }), kunci, port };
}

/**
 * Berhenti mematikan satu ruang kerja. Volume **tidak** disentuh.
 *
 * `wadahSah` dipanggil lebih dulu sebagai allowlist: hanya nama berpola kita
 * yang boleh sampai ke `podman rm`. Tanpa itu, satu bug di pemanggil bisa
 * membuat perintah ini menyentuh kontainer yang tidak ada hubungannya, dan itu
 * tidak bisa dibatalkan.
 */
async function berhenti({ userId, courseId }) {
  const nama = namaWadah(userId, courseId);
  if (!wadahSah(nama)) return { ok: false, alasan: "nama_tidak_sah" };

  const hasil = await jalankan("podman", ["rm", "-f", nama]);
  ruangKerja.delete(kunciWorkspace(userId, courseId));

  // `podman rm -f` mengembalikan 0 walaupun wadahnya sudah tidak ada (dengan
  // `-f` ia idempoten), jadi kode bukan 0 berarti kegagalan yang nyata —
  // mis. podman tidak bisa dihubungi. Peserta tetap mendapat `ok: true` untuk
  // kasus "sudah mati", karena hasil yang ia inginkan sudah tercapai.
  if (hasil.kode !== 0 && !/no such container/i.test(hasil.stderr)) {
    process.stderr.write(`podman rm gagal (${nama}): ${hasil.stderr.trim()}\n`);
    return { ok: false, alasan: "galat_manajer" };
  }
  return { ok: true, hidup: false };
}

/**
 * Status satu ruang kerja, tanpa efek samping.
 * Dipakai halaman untuk memutuskan antara "buka" dan "siapkan": kalau ruang
 * kerja sudah hidup, tombolnya adalah tautan; kalau belum, tombolnya adalah
 * aksi yang menyalakannya. Membaca status tidak boleh menyalakan apa pun —
 * satu render halaman yang menyalakan kontainer 2 GB adalah kejutan yang mahal.
 */
async function status({ userId, courseId, host }) {
  const nama = namaWadah(userId, courseId);
  const kunci = kunciWorkspace(userId, courseId);
  if (!(await wadahHidup(nama))) return { ok: true, hidup: false };

  const port = await portWadah(nama);
  if (port === null) return { ok: true, hidup: false };

  const tercatat = ruangKerja.get(kunci);
  ruangKerja.set(kunci, { port, terakhirDipakai: tercatat?.terakhirDipakai ?? Date.now() });
  return {
    ok: true,
    hidup: true,
    url: urlWorkspace({ domainDasar: DOMAIN_DASAR, kunci, port, host }),
  };
}

/**
 * Daftar berkas di ruang kerja peserta, untuk snapshot submission.
 *
 * Dijalankan lewat `podman exec` di dalam kontainer, **bukan** dengan membaca
 * volume dari mesin inang. Alasannya bukan kenyamanan: volume podman berada di
 * penyimpanan rootless yang dimiliki pengguna ini, dan membacanya dari luar
 * berarti runner harus tahu di mana podman menyimpannya — detail internal yang
 * berubah antar versi dan antar konfigurasi. `podman exec` bertanya pada satu
 * sumber kebenaran yang sudah pasti benar.
 *
 * `find` dipakai dengan bentuk keluaran yang sengaja: `-printf '%s\t%p\n'`
 * memberi ukuran dan path dalam satu baris, sehingga pemisahan baris tidak
 * ambigu walaupun nama berkas memuat spasi. Aturan penyaringan dan pemotongan
 * ada di `@/lib/workspace/snapshot` yang murni dan teruji; berkas ini hanya
 * menjalankan perintahnya.
 *
 * Perintahnya **tidak** memakai `-exec` atau shell: argumennya array, jadi
 * tidak ada jalan bagi nama berkas untuk menjadi perintah. Yang menjalankan
 * adalah `find` di dalam kontainer, dan itu pun berjalan sebagai pengguna
 * `coder` yang sama dengan peserta — jadi ia tidak bisa membaca apa pun yang
 * tidak bisa dibaca peserta.
 */
async function berkas({ userId, courseId }) {
  const nama = namaWadah(userId, courseId);
  if (!wadahSah(nama)) return { ok: false, alasan: "tidak_sah" };
  if (!(await wadahHidup(nama))) return { ok: false, alasan: "tidak_hidup" };

  const { kode, stdout, stderr } = await jalankan("podman", [
    "exec",
    "--user",
    "coder",
    nama,
    "find",
    "/home/coder/project",
    "-type",
    "f",
    "-printf",
    "%s\t%P\n",
  ]);

  // `find` mengembalikan 1 bila ada direktori yang tidak bisa dibaca, dan itu
  // **bukan** kegagalan untuk tujuan ini: yang sudah terbaca tetap berguna, dan
  // menolak seluruh daftar karena satu direktori tidak terbaca membuat snapshot
  // hilang sama sekali. Kode lain (125/126/127) berarti wadahnya bermasalah.
  if (kode !== 0 && kode !== 1) {
    process.stderr.write(`find gagal (${nama}, kode ${String(kode)}): ${stderr.trim()}\n`);
    return { ok: false, alasan: "galat_manajer" };
  }

  return { ok: true, mentah: stdout };
}

/**
 * Sapu ruang kerja yang menganggur.
 *
 * Hanya menyentuh wadah yang **kita** luncurkan (prefiks `careevo-ws-`), dan
 * hanya yang catatan waktunya ada di peta ini. Wadah berpola kita yang tidak
 * ada di peta — mis. diluncurkan proses lain, atau sebelum manajer ini hidup —
 * **tidak** dimatikan: umurnya tidak bisa diaudit, dan mematikan pekerjaan
 * orang berdasarkan tebakan lebih buruk daripada membiarkannya.
 *
 * Itu keputusan yang bisa dikritik, jadi dinyatakan di sini: penyapu ini
 * menjamin ruang kerja yang **dibuat lewat manajer ini** tidak menumpuk, bukan
 * bahwa seluruh mesin bersih. Pembersihan menyeluruh adalah aksi operator
 * (`podman ps --filter name=careevo-ws-`), bukan tugas latar belakang yang bisa
 * salah tembak.
 */
async function sapu() {
  const now = Date.now();
  for (const [kunci, catatan] of ruangKerja) {
    if (!sudahMenganggur(new Date(catatan.terakhirDipakai).toISOString(), now)) continue;
    // Nama wadah diturunkan dari kunci: pemetaan balik ini sah karena
    // `namaWadah` memakai kunci yang sama yang disimpan di peta.
    const nama = `careevo-ws-${kunci}`;
    if (!wadahSah(nama)) continue;
    const hasil = await jalankan("podman", ["rm", "-f", nama]);
    if (hasil.kode === 0) {
      ruangKerja.delete(kunci);
      process.stdout.write(`ruang kerja menganggur dimatikan: ${nama}\n`);
    }
  }
}

/**
 * Bentuk permintaan yang sah.
 *
 * Hanya tiga field yang dikenal; sisanya dibuang. `userId` dan `courseId`
 * datang dari route Next yang sudah memverifikasi sesi — manajer ini tidak
 * memverifikasi identitas, ia hanya meneruskan. Batas panjangnya ada supaya
 * nilai yang tidak masuk akal ditolak di sini, bukan menjadi nama wadah yang
 * aneh.
 */
function terjemahkanMinta(mentah) {
  let minta;
  try {
    minta = JSON.parse(mentah);
  } catch {
    return { ok: false, alasan: "badan harus berupa JSON" };
  }
  if (minta === null || typeof minta !== "object") {
    return { ok: false, alasan: "badan harus berupa objek" };
  }
  for (const field of ["userId", "courseId"]) {
    if (typeof minta[field] !== "string" || minta[field].trim().length === 0 || minta[field].length > 200) {
      return { ok: false, alasan: `${field} tidak sah` };
    }
  }
  // `host` opsional: hostname yang dipakai peserta untuk membuka aplikasi ini,
  // supaya URL ruang kerja memakai origin yang sama. Nilainya **tidak**
  // dipercaya di sini — `urlWorkspace` memvalidasinya lewat allowlist dan jatuh
  // ke `127.0.0.1` bila bukan nama loopback yang dikenal. Batas panjangnya
  // hanya menahan badan yang tidak masuk akal.
  if (minta.host !== undefined && (typeof minta.host !== "string" || minta.host.length > 255)) {
    return { ok: false, alasan: "host tidak sah" };
  }
  return { ok: true, minta: { userId: minta.userId, courseId: minta.courseId, host: minta.host } };
}

/** Bacalah badan permintaan dengan plafon, seperti runner. */
async function bacaBadan(req, maks) {
  const panjang = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(panjang) && panjang > maks) throw new Error("badan terlalu besar");

  const bagian = [];
  let total = 0;
  for await (const potongan of req) {
    total += potongan.length;
    if (total > maks) throw new Error("badan terlalu besar");
    bagian.push(potongan);
  }
  return Buffer.concat(bagian).toString("utf8");
}

const server = createServer((req, res) => {
  // `/sehat` tanpa rahasia, sama seperti runner: orkestrator harus bisa
  // memeriksa kesehatan tanpa memegang rahasia. Ia tidak boleh memberi tahu
  // apakah rahasia sudah diisi.
  if (req.method === "GET" && req.url === "/sehat") {
    kirim(res, 200, {
      ok: true,
      image: IMAGE_WORKSPACE,
      hidup: ruangKerja.size,
      domain: DOMAIN_DASAR || null,
    });
    return;
  }

  const rute = req.url ?? "";
  const aksi =
    rute === "/mulai"
      ? mulai
      : rute === "/berhenti"
        ? berhenti
        : rute === "/status"
          ? status
          : rute === "/berkas"
            ? berkas
            : null;

  if (req.method !== "POST" || aksi === null) {
    kirim(res, 404, { ok: false, error: "Tidak ditemukan" });
    return;
  }

  // Rahasia dibandingkan SEBELUM badan disentuh — alasan yang sama dengan
  // runner: mem-parse badan yang rusak lebih dulu memberi permukaan kerja
  // gratis di jalur yang seharusnya tertutup.
  if (!RAHASIA || req.headers["x-workspace-secret"] !== RAHASIA) {
    kirim(res, 401, { ok: false, error: "Layanan ruang kerja sedang tidak tersedia." });
    return;
  }

  bacaBadan(req, 8_192)
    .then(async (mentah) => {
      const hasil = terjemahkanMinta(mentah);
      if (!hasil.ok) {
        kirim(res, 400, { ok: false, error: hasil.alasan });
        return;
      }
      const jawaban = await aksi(hasil.minta);
      kirim(res, 200, jawaban);
    })
    .catch((galat) => {
      // Detail asli ke log, bukan ke respons: pesan filesystem memuat path
      // internal mesin ini.
      process.stderr.write(`permintaan gagal: ${String(galat)}\n`);
      kirim(res, 400, { ok: false, error: "Permintaan tidak dapat diproses." });
    });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`manajer ruang kerja mendengarkan di http://${HOST}:${PORT}\n`);
  if (!RAHASIA) {
    process.stderr.write(
      "CAREEVO_WORKSPACE_SECRET belum diisi: seluruh permintaan ditolak 401\n",
    );
  }
});

/**
 * Penyapu berjalan tiap menit. `unref()` supaya ia tidak menahan proses hidup
 * sendirian — proses tetap hidup karena server yang mendengarkan, bukan karena
 * timer ini, dan menahan proses karena timer adalah kebocoran yang menipu saat
 * shutdown.
 */
const timerSapu = setInterval(() => {
  sapu().catch((galat) => process.stderr.write(`sapu gagal: ${String(galat)}\n`));
}, 60_000);
timerSapu.unref();

process.on("uncaughtException", (galat) => {
  process.stderr.write(`galat tak tertangani: ${String(galat)}\n`);
  process.exit(1);
});

export { mulai, berhenti, status, sapu };
