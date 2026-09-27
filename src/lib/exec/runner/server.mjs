/**
 * Layanan eksekusi C++: proses Node terpisah di sekitar `soal.mjs`.
 *
 * Pemisahan ini berlapis dan disengaja. `soal.mjs` menjawab "apa yang boleh
 * dilakukan kode peserta", tidak melakukan I/O sama sekali, dan bisa dibaca
 * serta diuji tanpa podman. Berkas ini menjawab pertanyaan yang berbeda:
 * bagaimana permintaan sampai ke sana: bind, authenticate, antrean, spawn,
 * dan pembersihan.
 *
 * Tidak ada satu pun flag podman yang disebut di bawah; semuanya datang dari
 * `bangunArgumenPodman`. Kalau sebuah flag muncul di sini, permukaan audit
 * P7 sudah bocor dan jawabannya tidak lagi bisa diberikan dengan membaca satu
 * berkas.
 *
 * Pembagian yang sama berlaku untuk pemetaan status. `petakanExitCode` sudah
 * memetakan setiap exit code, dan pemetaan itu sudah diukur di mesin ini. Yang
 * tersisa di sini hanya satu pertanyaan yang hanya bisa dijawab di berkas ini:
 * "apakah podman sempat berjalan sama sekali", bukan "exit code apa yang
 * keluarnya".
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BATAS,
  IMAGE_KOMPILASI,
  bangunArgumenPodman,
  namaBerkas,
  petakanExitCode,
  potongKeluaran,
} from "./soal.mjs";

/**
 * Loopback saja. Tidak pernah `0.0.0.0`.
 *
 * Port yang terjangkau jaringan berarti siapa pun yang bisa mencapainya bisa
 * menjalankan kode di mesin ini, dan `--cap-drop=all` di dalam kontainer tidak
 * menahan itu: yang dilindungi adalah program peserta dari dirinya sendiri,
 * bukan mesin ini dari orang luar (P2 spec).
 */
const HOST = "127.0.0.1";
const PORT = Number(process.env.CAREEVO_RUNNER_PORT ?? 8021);

/**
 * Rahasia bersama, dibandingkan pada setiap permintaan.
 *
 * Kosong berarti menolak semuanya, bukan melayani terbuka. Perbandingan di
 * bawah selalu gagal kalau `RAHASIA` kosong, dan penjaga kedua di `eksekusi`
 * menutup jalan lain kalau suatu saat handler-nya dilewati.
 */
const RAHASIA = process.env.CAREEVO_RUNNER_SECRET ?? "";

/**
 * Plafon penampungan keluaran di memori, bukan batas layanan.
 *
 * Batas yang dilihat peserta tetap `BATAS.keluaranKarakter` dan ditegakkan
 * oleh `potongKeluaran` setelah proses selesai. Plafon ini hanya menahan
 * program yang mencetak tanpa henti: program semacam itu bisa menghasilkan
 * ratusan megabyte dalam 10 detik, dan menyalin semuanya sebelum dipangkas
 * berarti runner ikut kehabisan memori. Delapan kali lipat
 * `BATAS.keluaranKarakter` longgar supaya pemotongan tetap terjadi di
 * `potongKeluaran`, yang memang punya penandanya.
 */
const PLAFON_TAMPUNG = BATAS.keluaranKarakter * 8;

/**
 * Antrean sederhana dengan lebar `BATAS.antrean`.
 *
 * Tanpa ini, sepuluh peserta menekan Jalankan bersamaan berarti sepuluh proses
 * g++ di satu laptop, dan batas 10 detik per program yang sebenarnya benar pun
 * mulai menyala karena mesinnya yang sedang sibuk. Jadi antrean menjaga agar
 * batas waktu itu tetap berarti batas waktu program, bukan antrean.
 */
let berjalan = 0;
const antrean = [];

function jalankanDalamAntrean(tugas) {
  return new Promise((selesai, gagal) => {
    antrean.push({ tugas, selesai, gagal });
    kosongkan();
  });
}

function kosongkan() {
  while (berjalan < BATAS.antrean && antrean.length > 0) {
    const pekerjaan = antrean.shift();
    berjalan += 1;
    pekerjaan
      .tugas()
      // Kegagalan diteruskan sebagai kegagalan, bukan diselesaikan. Kalau
      // `gagal` ditukar dengan `selesai`, objek Error-nya menjadi nilai yang
      // di-resolve dan `{ ...hasil }` di handler menyebarkannya ke klien apa
      // adanya: fields `errno`, `code`, `syscall`, dan `path` milik Node
      // ikut keluar sebagai HTTP 200 `ok: true`, jadi klien tidak punya
      // `status` sama sekali dan justru menerima path internal mesin ini.
      // Diukur di mesin ini pada 2026-09-28 dengan TMPDIR yang tidak ada.
      .then(pekerjaan.selesai, pekerjaan.gagal)
      // `finally` tetap menempel ke rantai di atas, dan itu yang menjaga
      // antrean tetap mengalir: baik berhasil maupun gagal, `berjalan`
      // berkurang dan antrean berikutnya masuk.
      .finally(() => {
        berjalan -= 1;
        kosongkan();
      });
  }
}

function kirim(res, kode, badan) {
  // Klien boleh menutup tab saat kompilasi berjalan. Menulis ke respons yang
  // socket-nya sudah hilang memunculkan galat pada stream, dan karena ada
  // `uncaughtException` di bawah yang memanggil `process.exit(1)`, satu peserta
  // yang menutup tab bisa menjatuhkan runner untuk semua orang.
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(kode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(badan));
}

/**
 * Galat yang pesannya memang hak pemanggil untuk dibaca.
 *
 * Hanya badan yang salah. Galat lain ditulis ke log runner, bukan ke respons.
 */
class GalatBadan extends Error {}

/**
 * Bacalah badan permintaan, dengan plafon di dua lapis.
 *
 * Lapis pertama `content-length`: klien yang jujur dan berukur (fetch, curl)
 * mengirimnya, jadi batasnya bisa ditegakkan sebelum satu byte pun disalin, dan
 * klien tetap menerima status yang benar.
 *
 * Lapis kedua jumlah berjalan, untuk badan chunked yang tidak punya
 * `content-length`. Di sini penolakan tidak memutus stream, melainkan berhenti
 * menyalin lalu tetap menguras sampai `end`, supaya responsnya sampai ke
 * klien. Memutus stream di tengah transfer memang lebih murah bagi runner,
 * tapi ia menghapus satu-satunya jawaban yang bisa dibaca pemanggil, yaitu
 * "kodenya terlalu besar", dan menggantinya dengan reset yang tidak bisa
 * ditafsirkan.
 *
 * Yang tidak dilindungi adalah byte yang sudah terlanjur dikirim. Plafonnya
 * ada untuk menahan buffer, bukan untuk menjadi tembok.
 */
async function bacaBadan(req, maks) {
  const panjang = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(panjang) && panjang > maks) {
    throw new GalatBadan("badan terlalu besar");
  }

  const bagian = [];
  let total = 0;
  let penuh = false;
  for await (const potongan of req) {
    if (penuh) continue;
    total += potongan.length;
    if (total > maks) {
      penuh = true;
    } else {
      bagian.push(potongan);
    }
  }
  if (penuh) throw new GalatBadan("badan terlalu besar");
  return Buffer.concat(bagian).toString("utf8");
}

/**
 * Bagian hasil yang tidak pernah berubah.
 *
 * `exitCode: null` di sini punya arti yang sama seperti di `jalankanPodman`:
 * podman tidak sempat berjalan, atau ia dibunuh dari luar sebelum memberi kode
 * keluar. Bukan "program peserta mengembalikan apa pun".
 */
const kosong = { stdout: "", stderr: "", exitCode: null };

/** Ditolak karena ukuran, sebelum ada kontainer yang dibuat. */
function ditolak() {
  return { status: "ditolak", ...kosong, durasiMs: 0 };
}

/** Satu eksekusi: tulis sumber, jalankan podman, bersihkan. */
async function eksekusi({ bahasa, kode, stdin }) {
  // Penjaga kedua dari `RAHASIA` yang kosong. Handler di bawah sudah menolak
  // lebih dulu, jadi cabang ini tidak bisa dicapai lewat HTTP. Ia ada supaya
  // refactor berikutnya yang memanggil `eksekusi` langsung tidak diam-diam
  // menjalankan kontainer tanpa rahasia.
  if (!RAHASIA) return { status: "galat_runner", ...kosong, durasiMs: 0 };

  // Penolakan ukuran SEBELUM podman dipanggil. Menolak 200 kB harus sepotong
  // milidetik; mengompilasinya memakan satu kontainer penuh dengan g++ yang
  // berjalan, dan peserta yang paste berkas besar akan membayar bukan satu galat
  // tetapi antrean yang macet untuk semua orang.
  if (kode.length > BATAS.karakter || kode.split("\n").length > BATAS.baris) {
    return ditolak();
  }
  const masukan = stdin ?? "";
  if (masukan.length > BATAS.stdinKarakter) return ditolak();

  const dir = await mkdtemp(join(tmpdir(), "careevo-exec-"));
  // Diukur sejak spool, bukan sejak permintaan masuk. Antrean yang menunggu
  // bukan waktu kerja peserta, dan durasiMs yang ikut menghitungnya akan
  // membuat program 300 ms dilaporkan sebagai 8 detik.
  const mulai = Date.now();
  try {
    const berkas = join(dir, namaBerkas(bahasa));
    await writeFile(berkas, kode, "utf8");
    // Urutan di sini adalah penopang seluruh fitur. `mkdtemp` membuat direktori
    // 0700, dan kontainer berjalan sebagai uid 65534 (`nobody`), yang tidak bisa
    // melewati direktori 0700 milik uid lain. Gejalanya sangat menipu: mount-nya
    // berhasil, sufiks `:z` juga berhasil, dan pesannya tetap
    // `cp: cannot stat '/src/main.cpp': Permission denied`. Semua eksekusi gagal
    // dan penyebabnya terlihat seperti masalah SELinux.
    //
    // Berkas ditulis lebih dulu, lalu berkas di-chmod 0644, lalu direktori
    // di-chmod 0755. Urutannya disengaja: mode direktori-lah yang membuka isi
    // spool ke uid lain, jadi berkas harus sudah final sebelum itu terjadi.
    // Kalau urutannya dibalik dan umask mesin ini 077, berkas 0600 akan
    // terekspos ke seluruh uid tepat di detik yang direktori dibuka.
    await chmod(berkas, 0o644);
    await chmod(dir, 0o755);

    const { args } = bangunArgumenPodman({ bahasa, direktori: dir });
    const hasil = await jalankanPodman(args, masukan);
    return {
      // `exitCode: null` berarti podman sendiri tidak sempat jalan: binar podman
      // tidak ada di PATH, atau prosesnya dibunuh dari luar sebelum memberi
      // kode. `petakanExitCode` memetakan angka yang dikeluarkan program, dan
      // `null` bukan angka program. Kalau diteruskan apa adanya ia jatuh ke
      // kasus terakhir dan dilaporkan `sukses`, jadi peserta dengan runner yang
      // salah konfigurasi diberi tahu programnya berjalan. Bentuk null-nya
      // dibuat di `jalankanPodman` di bawah, jadi keputusannya milik berkas ini.
      status: hasil.exitCode === null ? "galat_runner" : petakanExitCode(hasil),
      stdout: potongKeluaran(hasil.stdout),
      stderr: potongKeluaran(hasil.stderr),
      exitCode: hasil.exitCode,
      durasiMs: Date.now() - mulai,
    };
  } finally {
    // Wajib ada di `finally`. Tanpa itu, galat di tengah jalan meninggalkan
    // berkas sumber peserta di disk tanpa batas waktu: kebocoran pekerjaan
    // mereka, dan permukaan serang baru kalau direktori spool suatu saat dipakai
    // ulang. `--rm` membersihkan kontainer, bukan isi host-nya.
    await rm(dir, { recursive: true, force: true });
  }
}

function jalankanPodman(args, masukan) {
  return new Promise((selesai) => {
    const anak = spawn("podman", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let ditutup = false;

    anak.stdout.setEncoding("utf8");
    anak.stderr.setEncoding("utf8");
    anak.stdout.on("data", (c) => {
      if (stdout.length < PLAFON_TAMPUNG) stdout += c;
    });
    anak.stderr.on("data", (c) => {
      if (stderr.length < PLAFON_TAMPUNG) stderr += c;
    });

    // Kirim masukan lalu tutup, dalam satu `end()`. `--interactive` di
    // `soal.mjs` yang membuat masukan ini sampai ke program; `end()`-lah yang
    // memberi tahu program bahwa masukan habis, dan program yang membaca sampai
    // akhir stream akan menggantung sampai batas 10 detik menyala kalau `end()`
    // tidak dikirim.
    //
    // `error` ditelan karena program yang tidak membaca masukan menutup stdin
    // lebih dulu, jadi EPIPE di sini hal yang diharapkan, bukan galat.
    anak.stdin.on("error", () => {});
    anak.stdin.end(masukan);

    const tutup = (exitCode) => {
      if (ditutup) return;
      ditutup = true;
      selesai({ stdout, stderr, exitCode });
    };

    // `error` berarti podman tidak bisa dijalankan sama sekali: binar hilang,
    // atau PATH salah. `close` setelahnya tetap boleh datang dan tidak menimpa.
    anak.on("error", (galat) => {
      stderr += String(galat.message);
      tutup(null);
    });
    anak.on("close", (code) => tutup(code));
  });
}

/**
 * Bentukkan permintaan dari badan JSON, atau nyatakan alasan penolakan.
 *
 * `namaBerkas` dipakai sebagai satu-satunya daftar bahasa, bukan literal
 * `"cpp"` yang disalin di sini. Daftar bahasa milik `soal.mjs`; menyalinnya
 * berarti dua sumber kebenaran yang bisa berbeda diam-diam pada hari bahasa
 * kedua ditambahkan. `namaBerkas` juga sudah melempar untuk bahasa tak dikenal,
 * sebab kalau tidak nama berkasnya jadi `undefined` dan muncul di dalam
 * kontainer sebagai `/src/undefined`.
 *
 * Yang dikembalikan hanya tiga field yang dikenal. Field lain pada badan
 * permintaan diabaikan, jadi tidak ada jalan menyuntikkan apa pun ke
 * `eksekusi`.
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
  if (typeof minta.kode !== "string") {
    return { ok: false, alasan: "kode harus berupa teks" };
  }
  // `stdin` non-teks ditolak, bukan diam-diam diperlakukan sebagai masukan
  // kosong. Keduanya membuat program peserta berjalan di cabang yang salah,
  // dan yang salahnya sulit dilacak. Galat 400 lebih jujur.
  if (minta.stdin !== undefined && typeof minta.stdin !== "string") {
    return { ok: false, alasan: "stdin harus berupa teks" };
  }
  try {
    namaBerkas(minta.bahasa);
  } catch {
    return { ok: false, alasan: "bahasa tidak dikenal" };
  }
  return {
    ok: true,
    minta: { bahasa: minta.bahasa, kode: minta.kode, stdin: minta.stdin },
  };
}

const server = createServer((req, res) => {
  // `/sehat` sengaja tanpa pemeriksaan rahasia, supaya orkestrator bisa
  // memeriksa kesehatan tanpa memegang rahasia. Konsekuensinya `/sehat` tidak
  // boleh pernah memberi tahu apakah rahasia sudah diisi, karena ia akan
  // menjadi oracle tanpa autentikasi bagi proses lokal mana pun.
  if (req.method === "GET" && req.url === "/sehat") {
    kirim(res, 200, {
      ok: true,
      image: IMAGE_KOMPILASI,
      // `antrean` = menunggu, `berjalan` = sedang jalan. Keduanya dilaporkan
      // karena itulah satu-satunya cara melihat batas lebar dari luar. Satu
      // angka saja tidak membuktikan apa pun tentang `BATAS.antrean`.
      antrean: antrean.length,
      berjalan,
    });
    return;
  }

  if (req.method !== "POST" || req.url !== "/jalankan") {
    kirim(res, 404, { ok: false, error: "Tidak ditemukan" });
    return;
  }

  // Rahasia dibandingkan SEBELUM badan disentuh. Tanpa ini, proses lokal lain
  // bisa mengendarai runner, dan mem-parse badan yang rusak lebih dulu memberi
  // permukaan kerja gratis di jalur yang seharusnya tertutup (P2 spec).
  //
  // Perbandingan `!==` bukan titik lemahnya. Yang melindungi port ini adalah
  // loopback dan rahasia yang tidak ditebak. `timingSafeEqual` di sini akan
  // jadi teater, karena proses yang bisa mengukur selisih perbandingan juga
  // bisa membaca `CAREEVO_RUNNER_SECRET` dari `/proc`.
  //
  // Pesannya sengaja sama untuk "rahasia belum diisi" dan "rahasia salah".
  // Membedakan keduanya memberi pemanggil tanpa autentikasi jawaban atas
  // pertanyaan yang tidak perlu dijawabinya, yaitu apakah runner ini sudah
  // terkonfigurasi. Yang perlu diketahui pemanggil hanya "layanan tidak
  // tersedia".
  if (!RAHASIA || req.headers["x-runner-secret"] !== RAHASIA) {
    kirim(res, 401, { ok: false, error: "Layanan eksekusi sedang tidak tersedia." });
    return;
  }

  bacaBadan(req, BATAS.karakter * 8 + BATAS.stdinKarakter)
    .then((mentah) => {
      const hasil = terjemahkanMinta(mentah);
      if (!hasil.ok) {
        kirim(res, 400, { ok: false, error: hasil.alasan });
        return null;
      }
      return jalankanDalamAntrean(() => eksekusi(hasil.minta));
    })
    .then((hasil) => {
      if (hasil) kirim(res, 200, { ok: true, ...hasil });
    })
    .catch((galat) => {
      // Detail asli ditulis ke log runner, bukan ke respons. `message` dari
      // galat filesystem memuat path spool internal mesin ini, dan pemanggil
      // tidak berhak atas itu. Yang perlu diketahui pemanggil hanya "ditolak"
      // dan runner masih hidup. Diukur pada 2026-09-28: tanpa baris ini,
      // `ENOENT: ... mkdtemp '/tmp/.../careevo-exec-XXXXXX'` keluar apa adanya.
      //
      // 413 dan bukan 400, karena yang sebenarnya terjadi adalah badan
      // permintaan melebihi yang boleh diterima. 400 di sini akan berarti
      // "permintaanmu tidak valid", dan itu tidak terjadi.
      if (galat instanceof GalatBadan) {
        kirim(res, 413, { ok: false, error: galat.message });
        return;
      }
      // Tanpa baris ini, kegagalan di luar badan, misalnya disk penuh, akan
      // terlihat di klien sebagai "ditolak" tanpa jejak di mana pun.
      process.stderr.write(`permintaan gagal: ${String(galat)}\n`);
      kirim(res, 400, { ok: false, error: "Permintaan tidak dapat diproses." });
    });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`runner C++ mendengarkan di http://${HOST}:${PORT}\n`);
  // Fail-closed diumumkan, bukan diam-diam. Tanpa baris ini, rahasia yang
  // belum diisi hanya terlihat sebagai 401 yang membingungkan selama beberapa
  // menit. Nilainya sendiri tidak pernah ditulis ke mana pun: tidak di log ini,
  // tidak di log galat mana pun, dan tidak di badan respons mana pun.
  if (!RAHASIA) {
    process.stderr.write(
      "CAREEVO_RUNNER_SECRET belum diisi: seluruh permintaan /jalankan ditolak 401\n",
    );
  }
});

/** Galat saat start-up harus terlihat, bukan ditelan diam-diam. */
process.on("uncaughtException", (galat) => {
  process.stderr.write(`galat tak tertangani: ${String(galat)}\n`);
  process.exit(1);
});
