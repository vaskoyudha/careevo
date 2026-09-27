#!/usr/bin/env node
/**
 * Satu perintah untuk seluruh stack pengembangan — `npm run dev:full`.
 *
 * ## Masalah yang dipecahkan
 *
 * Menjalankan Careevo secara utuh butuh tiga proses yang hidup bersamaan:
 *
 *   :3000  Careevo (`next dev`)
 *   :3790  AI Mastery, menyajikan `features/sijago/.next/standalone`
 *   :8011  FastAPI DeepTutor (agent loop tempat setiap giliran chat berjalan)
 *
 * Sebelumnya ketiganya dinyalakan tangan di tiga terminal, jadi menutup stack
 * berarti mengingat tiga PID (dan `npm run dev` di root memang sengaja tidak
 * menyalakan ketiganya — lihat README "Menjalankan AI Mastery").
 *
 * ## Yang TIDAK dilakukan skrip ini (dan alasannya)
 *
 * - **Tidak menyatukan port.** Ini pemanggil, bukan proxy. Menggabungkan `:3000`
 *   dan `:3790` jadi satu port menuntut `basePath` + rewrite di kedua aplikasi
 *   dan menyentuh kontrak URL aplikasi yang dibingkai; itu pekerjaan tersendiri
 *   dengan risiko tersendiri. Skrip ini menghapus "harus ingat tiga perintah",
 *   bukan "ada tiga proses" — jumlah prosesnya memang tidak bisa dikurangi,
 *   karena `:8011` adalah proses Python yang Next tidak dapat menjadi hostnya.
 *
 * - **Tidak menyalakan `:8011` sendiri.** Proses itu diawasi systemd
 *   (`sijago-backend.service`) dan sengaja tidak dimatikan saat Ctrl-C: ia
 *   berjalan terus lintas sesi, dan mematikannya akan memutus sesi lain yang
 *   memakainya. Bila belum hidup, skrip memulai unit-nya (`systemctl --user
 *   start`) atau memberi tahu perintahnya, bukan menjalankan uvicorn kedua yang
 *   hanya berakhir "address already in use" — lihat `.agents/skills/careevo-sijago/SKILL.md`.
 *
 * - **Tidak membangun ulang `:3790`.** `:3790` menyajikan bundel **prebuilt**;
 *   perubahan sumber di `features/sijago/` tidak terlihat sampai `npm run build`
 *   di sana. Skrip ini memperingatkan bila ada sumber yang lebih baru dari
 *   bundel (`AGENTS.md` mencatat jebakan ini), tapi tidak membangun sendiri:
 *   build itu butuh menit dan bukan yang diminta saat orang mengetik `dev:full`.
 *
 * ## Penghentian
 *
 * Ctrl-C mematikan **hanya proses yang skrip ini lahirkan** (Careevo, `:3790`),
 * lewat process group masing-masing. Proses yang sudah ada sebelumnya — dan
 * seluruh unit systemd — dibiarkan hidup. Aturannya sederhana dan bisa
 * diprediksi: skrip tidak mematikan apa pun yang tidak ia nyalakan.
 *
 * Pakai: npm run dev:full [-- --no-sijago]
 */

import { spawn, execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIJAGO = path.join(ROOT, "features", "sijago");

/** Port dapat ditimpa lewat env supaya skrip tetap berguna di mesin kedua. */
const careevoPort = Number(process.env.CAREERVO_PORT ?? 3000);
const masteryPort = Number(process.env.AI_MASTERY_PORT ?? 3790);
const backendPort = Number(process.env.AI_MASTERY_BACKEND_PORT ?? 8011);

/** `--no-sijago` menyalakan Careevo saja (mis. saat hanya mengerjakan UI utama). */
const jalankanSijago = !process.argv.includes("--no-sijago");

/** Warna hanya bila stdout adalah TTY; log yang di-pipe tetap bersih. */
const warna = process.stdout.isTTY
  ? (k, s) => `\u001b[${k}m${s}\u001b[0m`
  : (_k, s) => s;
const redup = (s) => warna("2", s);
const tebal = (s) => warna("1", s);
const hijau = (s) => warna("32", s);
const kuning = (s) => warna("33", s);
const merah = (s) => warna("31", s);

/** Anak proses yang skrip ini lahirkan — satu-satunya yang boleh ia matikan. */
const anak = [];

// ---------------------------------------------------------------------------
// Pemeriksaan awal
// ---------------------------------------------------------------------------

/**
 * TRUE bila sesuatu sedang LISTEN di `port` pada 127.0.0.1.
 *
 * Dipakai untuk membedakan "port sudah dipakai proses lain" dari "menunggu
 * server saya siap". `ss` dibaca lewat `execFileSync` supaya tidak ada
 * dependency (`net.connect` akan menunggu timeout untuk port yang mati,
 * sedangkan `ss` menjawab seketika).
 */
function adaYangMendengar(port) {
  try {
    const keluaran = execFileSync("ss", ["-ltn"], { encoding: "utf8" });
    return keluaran
      .split("\n")
      .some((b) => new RegExp(`[:.]${port}\\s`).test(b));
  } catch {
    // `ss` tidak ada (non-Linux): probe TCP sesungguhnya, bukan tebakan.
    try {
      execFileSync("bash", ["-c", `exec 3<>/dev/tcp/127.0.0.1/${port}`], {
        timeout: 1500,
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Baca `.env.local` tanpa dependency, mengikuti pola `scripts/e2e-anticheat.mjs`.
 * Hanya dibaca (`??=`), tidak pernah menimpa env yang sudah di-set pemanggil —
 * `npm run dev:full` dengan `PORT=3000` eksplisit harus menang.
 */
function muatEnvLokal() {
  const berkas = path.join(ROOT, ".env.local");
  if (!existsSync(berkas)) return {};
  const env = {};
  for (const baris of readFileSync(berkas, "utf8").split(/\r?\n/)) {
    const cocok = baris.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (cocok && !baris.trimStart().startsWith("#")) {
      env[cocok[1]] ??= cocok[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

/** Kedalaman rekursi terbatas: cukup untuk menemukan berkas, tidak untuk crawl. */
function berkasSumberTerbaru(direktori) {
  const abaikan = new Set(["node_modules", ".next", "dist", "vendor", "contracts"]);
  let terbaru = 0;
  const telusuri = (dir, kedalaman) => {
    if (kedalaman > 6) return;
    let isi;
    try {
      isi = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of isi) {
      if (item.name.startsWith(".") || abaikan.has(item.name)) continue;
      const lengkap = path.join(dir, item.name);
      if (item.isDirectory()) {
        telusuri(lengkap, kedalaman + 1);
      } else if (/\.(ts|tsx|js|jsx|css)$/.test(item.name)) {
        try {
          const m = statSync(lengkap).mtimeMs;
          if (m > terbaru) terbaru = m;
        } catch {
          /* berkas hilang di tengah pembacaan: abaikan */
        }
      }
    }
  };
  telusuri(direktori, 0);
  return terbaru;
}

/** Tunggu sampai `port` mendengar, atau menyerah setelah `batasMs`. */
async function tungguPort(port, batasMs) {
  const mulai = Date.now();
  while (Date.now() - mulai < batasMs) {
    if (adaYangMendengar(port)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * TRUE bila `http://127.0.0.1:port/path` menjawab dengan status HTTP apa pun.
 *
 * Port yang mendengar belum tentu dapat dijangkau: server yang mengikat nama
 * host (bukan `0.0.0.0`) membuat `:3790` terlihat "siap" di `ss` sementara
 * `curl 127.0.0.1:3790` gagal — kegagalan yang persis pernah terjadi di skrip
 * ini. Karena itu kesiapan diuji dengan request sungguhan, bukan dengan daftar
 * port. Status apa pun diterima (401/404 sekalipun): yang dibuktikan adalah
 * ada yang menjawab, bukan isi halamannya.
 */
async function httpSiap(port, jalur = "/") {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${jalur}`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    // Tubuh harus dibuang agar soket tidak menggantung di undici.
    await res.body?.cancel().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Tunggu sampai `port` benar-benar menjawab HTTP, atau menyerah. */
async function tungguHttp(port, batasMs) {
  const mulai = Date.now();
  while (Date.now() - mulai < batasMs) {
    if (await httpSiap(port)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/**
 * Info `next dev` yang sudah berjalan untuk direktori ini, atau null.
 *
 * Next 16 mengunci **direktori**, bukan port: `next dev` kedua di repo yang sama
 * menolak jalan dengan "Another next dev server is already running" walau
 * portnya berbeda (dikonfirmasi di dist/build/lockfile.js). Lock itu ditulis ke
 * `.next/dev/lock` berisi `{pid, port, appUrl}`, jadi keadaannya bisa dibaca
 * alih-alih ditebak — penting supaya `dev:full` melaporkan "sudah jalan di :3000
 * (PID …)", bukan gagal dengan pesan Next yang lalu menurunkan seluruh stack.
 *
 * Lock basi (proses sudah mati) diabaikan: itu sisa crash, bukan server hidup.
 */
function infoDevLock() {
  const berkas = path.join(ROOT, ".next", "dev", "lock");
  if (!existsSync(berkas)) return null;
  let info;
  try {
    info = JSON.parse(readFileSync(berkas, "utf8"));
  } catch {
    return null;
  }
  if (!info?.pid) return null;
  try {
    process.kill(info.pid, 0); // sinyal 0 = cek hidup, tidak mengirim apa pun
  } catch {
    return null; // lock basi
  }
  return info;
}

// ---------------------------------------------------------------------------
// Status awal
// ---------------------------------------------------------------------------

const envLokal = muatEnvLokal();
const databaseUrl =
  process.env.DATABASE_URL ?? envLokal.DATABASE_URL ?? "";

/** Port database dari DATABASE_URL, supaya laporan cocok dengan yang dipakai app. */
function portDatabase(url) {
  try {
    const u = new URL(url);
    return Number(u.port || 5432);
  } catch {
    return 5432;
  }
}

const dbPort = portDatabase(databaseUrl);

console.log(tebal("\n  Careevo dev stack\n"));

// --- PostgreSQL -----------------------------------------------------------
// PostgreSQL bukan opsional: identitas/sesi ada di sana. Diperiksa lebih dulu
// karena kegagalannya muncul sebagai galat login yang membingungkan, bukan
// sebagai "database tidak jalan".
if (adaYangMendengar(dbPort)) {
  console.log(`  ${hijau("✓")} PostgreSQL              ${redup(`:${dbPort}`)}`);
} else {
  console.log(
    `  ${merah("✗")} PostgreSQL ${redup(`:${dbPort}`)} ${merah("tidak mendengar")}`,
  );
  console.log(
    redup(
      "    Jalankan: docker compose up -d postgres   (atau lihat docs/local-db.md)",
    ),
  );
  console.log(
    merah(
      `    Login dan sesi akan gagal sampai database hidup. Lanjut menyalakan sisanya...\n`,
    ),
  );
}

// --- FastAPI :8011 --------------------------------------------------------
// Sengaja TIDAK dijalankan sebagai proses anak: ia unit systemd, berjalan
// lintas sesi, dan tidak boleh ikut mati saat Ctrl-C.
const backendHidup = adaYangMendengar(backendPort);
if (backendHidup) {
  console.log(`  ${hijau("✓")} FastAPI backend         ${redup(`:${backendPort}`)}`);
} else if (process.platform === "linux") {
  // Tanya systemd sebelum menyerah: unit-nya mungkin ada tetapi berhenti.
  let unitAda = false;
  try {
    execFileSync("systemctl", ["--user", "cat", "sijago-backend.service"], {
      stdio: "ignore",
    });
    unitAda = true;
  } catch {
    unitAda = false;
  }
  if (unitAda) {
    process.stdout.write(
      `  ${kuning("…")} FastAPI backend ${redup(`:${backendPort}`)} mati — memulai unit systemd... `,
    );
    try {
      execFileSync("systemctl", ["--user", "start", "sijago-backend.service"], {
        stdio: "ignore",
      });
      const siap = await tungguPort(backendPort, 15000);
      console.log(siap ? hijau("✓") : merah("gagal"));
      if (!siap) {
        console.log(
          redup(
            `    Cek log: journalctl --user -u sijago-backend.service`,
          ),
        );
      }
    } catch {
      console.log(merah("gagal"));
      console.log(
        redup(
          `    Jalankan: systemctl --user start sijago-backend.service`,
        ),
      );
    }
  } else {
    console.log(
      `  ${kuning("!")} FastAPI backend ${redup(`:${backendPort}`)} mati ${redup("(unit systemd tidak ditemukan)")}`,
    );
  }
} else {
  console.log(
    `  ${kuning("!")} FastAPI backend         ${redup(`:${backendPort}`)} mati`,
  );
}

// --- AI Mastery :3790 -----------------------------------------------------
const serverJs = path.join(SIJAGO, ".next", "standalone", "server.js");
const bundelAda = existsSync(serverJs);
if (!bundelAda) {
  console.log(
    `  ${merah("✗")} AI Mastery ${redup(`:${masteryPort}`)} — bundel standalone belum ada`,
  );
  console.log(
    redup(`    Bangun dulu:  cd features/sijago && npm run build`),
  );
  console.log(
    redup(`    (tanpa itu, /ai-mastery akan memuat frame kosong)\n`),
  );
} else {
  // Jebakan yang tercatat di AGENTS.md: `:3790` menyajikan bundel prebuilt, jadi
  // edit di features/sijago/ tidak terlihat sampai build ulang. Deteksi, bukan
  // tebak — bandingkan mtime sumber vs server.js.
  const mtimeBundel = statSync(serverJs).mtimeMs;
  const akarSumber = ["app", "components", "features", "lib", "shared", "hooks"]
    .map((d) => path.join(SIJAGO, d))
    .filter((d) => existsSync(d));
  const mtimeSumber = Math.max(0, ...akarSumber.map(berkasSumberTerbaru));
  if (mtimeSumber > mtimeBundel) {
    console.log(
      `  ${kuning("!")} AI Mastery ${redup(`:${masteryPort}`)} — bundel lebih tua dari sumber`,
    );
    console.log(
      redup(
        `    Edit di features/sijago/ TIDAK akan terlihat sampai:\n` +
          `      cd features/sijago && npm run build\n` +
          `    Skrip ini tetap menyajikan bundel yang ada.`,
      ),
    );
  } else {
    console.log(`  ${hijau("✓")} AI Mastery bundel       ${redup(`:${masteryPort}`)}`);
  }
}

console.log("");

// ---------------------------------------------------------------------------
// Menyalakan
// ---------------------------------------------------------------------------

/**
 * Lahirkan perintah di process group sendiri, catat di `anak`.
 *
 * `detached: true` memberi grup proses tersendiri. Tanpa itu, `next dev` yang
 * men-spawn render worker (dan `start-standalone.sh` yang memakai `exec`)
 * meninggalkan proses yatim saat induknya mati — persis kegagalan yang membuat
 * port tetap terpakai setelah Ctrl-C. Dengan grup, satu `kill(-pid)` meraih
 * seluruh pohon.
 */
function lahirkan(label, perintah, argumen, opsi = {}) {
  const anakProses = spawn(perintah, argumen, {
    cwd: opsi.cwd ?? ROOT,
    env: { ...process.env, ...(opsi.env ?? {}) },
    stdio: ["ignore", "inherit", "inherit"],
    detached: true,
  });
  anakProses.namaLabel = label;
  anak.push(anakProses);
  return anakProses;
}

function matikanAnak(sinyal = "SIGTERM") {
  for (const p of anak) {
    if (p.exitCode !== null || p.signalCode !== null) continue;
    try {
      // Negatif = seluruh process group, bukan hanya proses terdepan.
      process.kill(-p.pid, sinyal);
    } catch {
      // Grup sudah hilang, atau `detached` gagal: coba prosesnya langsung.
      try {
        p.kill(sinyal);
      } catch {
        /* sudah mati */
      }
    }
  }
}

let sudahMatikan = false;
function matikanSemua(kode = 0) {
  if (sudahMatikan) return;
  sudahMatikan = true;
  console.log(redup("\n  Menghentikan proses yang dijalankan skrip ini..."));
  matikanAnak("SIGTERM");
  // Beri kesempatan cleanup (Next menghapus lock file, worker berhenti rapi).
  setTimeout(() => {
    matikanAnak("SIGKILL");
    process.exit(kode);
  }, 2500).unref();
  // Jangan menggantung bila semua anak sudah keluar lebih dulu.
  const cek = setInterval(() => {
    if (anak.every((p) => p.exitCode !== null || p.signalCode !== null)) {
      clearInterval(cek);
      process.exit(kode);
    }
  }, 200);
  cek.unref();
}

process.on("SIGINT", () => matikanSemua(0));
process.on("SIGTERM", () => matikanSemua(0));

// Bila salah satu anak mati sendiri, turunkan seluruh stack: setengah stack
// yang hidup lebih menyesatkan daripada tidak jalan sama sekali.
function awasi(p) {
  p.on("exit", (kode, sinyal) => {
    if (sudahMatikan) return;
    console.log(
      merah(
        `\n  ${p.namaLabel} berhenti (${sinyal ?? `exit ${kode}`}) — menurunkan seluruh stack.`,
      ),
    );
    matikanSemua(kode ?? 1);
  });
}

// --- Careevo :3000 --------------------------------------------------------
// Dua sebab berbeda untuk "sudah jalan", dan keduanya bukan kegagalan:
//   1. portnya didengar sesuatu (dev server ini, atau proses lain)
//   2. portnya bebas TAPI lock direktori Next masih dipegang `next dev` lain
//      (Next 16 mengunci direktori, bukan port — lihat infoDevLock()).
let careevoDiluncurkan = false;
const devLock = infoDevLock();
if (devLock) {
  console.log(
    `  ${kuning("!")} Careevo sudah jalan di ${redup(`:${devLock.port}`)} ${redup(`(PID ${devLock.pid})`)}`,
  );
  if (devLock.port !== careevoPort) {
    console.log(
      redup(
        `    Port diminta :${careevoPort}, tetapi Next mengunci direktori ini —\n` +
          `    dev server kedua di folder yang sama tidak akan jalan.\n` +
          `    Buka yang ada (${devLock.appUrl ?? `http://localhost:${devLock.port}`}), atau hentikan dulu:\n` +
          `      kill ${devLock.pid}`,
      ),
    );
  }
} else if (adaYangMendengar(careevoPort)) {
  console.log(
    `  ${kuning("!")} Careevo ${redup(`:${careevoPort}`)} dipakai proses lain — dilewati.`,
  );
  console.log(
    redup(`    Kalau itu dev server Anda, buka saja http://localhost:${careevoPort}`),
  );
} else {
  console.log(`  ${redup("→")} Careevo                 ${redup(`:${careevoPort}`)}`);
  const careevo = lahirkan("Careevo", "npm", ["run", "dev", "--", "-p", String(careevoPort)]);
  awasi(careevo);
  careevoDiluncurkan = true;
}

/** Port yang benar-benar melayani Careevo — lock bisa menunjuk port lain. */
const careevoPortAktual = devLock?.port ?? careevoPort;

// --- AI Mastery :3790 -----------------------------------------------------
let masteryDiluncurkan = false;
// Dijalankan lewat `start-standalone.sh` milik aplikasi itu, bukan disalin:
// skrip itu memegang dua pengetahuan yang tidak boleh diduplikasi — menyalin
// `public/` + `.next/static` ke dalam standalone (kalau tidak, seluruh aset
// 404 dan halaman tampak kosong), dan menetapkan `DEEPTUTOR_API_BASE_URL`
// secara eksplisit (proses standalone tidak membaca `.env.local`, sehingga
// tanpa itu proxy jatuh ke `:8001` dan setiap giliran chat ditolak).
if (bundelAda && jalankanSijago) {
  if (adaYangMendengar(masteryPort)) {
    console.log(
      `  ${kuning("!")} AI Mastery ${redup(`:${masteryPort}`)} sudah dipakai — dibiarkan apa adanya.`,
    );
    console.log(
      redup(
        `    Restart manual: features/sijago/start-standalone.sh ${masteryPort}`,
      ),
    );
  } else {
    console.log(`  ${redup("→")} AI Mastery              ${redup(`:${masteryPort}`)}`);
    const mastery = lahirkan(
      "AI Mastery",
      "bash",
      [
        path.join(SIJAGO, "start-standalone.sh"),
        String(masteryPort),
        `http://127.0.0.1:${backendPort}`,
      ],
      {
        cwd: SIJAGO,
        // `HOSTNAME` WAJIB di-set eksplisit, walaupun `start-standalone.sh`
        // sudah punya `${HOSTNAME:-0.0.0.0}`. Bash mengekspor `HOSTNAME` ke nama
        // host mesin, jadi default di dalam skrip itu **tidak pernah** terpakai:
        // hasilnya server mengikat `fedora` (nama yang me-resolve ke alamat
        // IPv6), dan `curl 127.0.0.1:<port>` dijawab 000 — server tampak "siap"
        // karena portnya mendengar, tetapi tidak dapat dijangkau lewat
        // localhost/127.0.0.1. `:3790` yang berjalan sekarang punya variabel ini
        // di environ-nya, bukti bahwa nilainya memang harus dipasok pemanggil.
        env: { HOSTNAME: process.env.AI_MASTERY_HOST ?? "0.0.0.0" },
      },
    );
    awasi(mastery);
    masteryDiluncurkan = true;
  }
}

// ---------------------------------------------------------------------------
// Tunggu siap, lalu laporkan
// ---------------------------------------------------------------------------

console.log(redup("\n  Menunggu server siap..."));

// Hanya proses yang skrip ini luncurkan yang ditunggu. Yang sudah jalan
// sebelumnya dipakai apa adanya, dan yang tidak dijalankan ditandai `·`.
const BATAS_MS = 60000;

const careevoSiap = careevoDiluncurkan
  ? await tungguHttp(careevoPortAktual, BATAS_MS).then((v) => {
      if (!v) console.log(merah(`  Careevo tidak menjawab dalam ${BATAS_MS / 1000}s.`));
      return v;
    })
  : await httpSiap(careevoPortAktual);

const masterySiap = masteryDiluncurkan
  ? await tungguHttp(masteryPort, BATAS_MS).then((v) => {
      if (!v) console.log(merah(`  AI Mastery tidak menjawab dalam ${BATAS_MS / 1000}s.`));
      return v;
    })
  : !bundelAda || !jalankanSijago
    ? null // sengaja tidak dijalankan: bukan kegagalan
    : await httpSiap(masteryPort);

console.log("");
const tanda = (siap) =>
  siap === true ? hijau("✓") : siap === null ? redup("·") : merah("✗");
console.log(`  ${tanda(careevoSiap)} Careevo            http://localhost:${careevoPortAktual}`);
console.log(
  `  ${tanda(masterySiap)} AI Mastery         ${
    masterySiap === null ? redup("(tidak dijalankan)") : `http://localhost:${masteryPort}`
  }`,
);
console.log(
  `  ${tanda(backendHidup)} FastAPI backend    http://127.0.0.1:${backendPort} ${redup("(systemd, tidak ikut berhenti)")}`,
);
console.log(
  `  ${tanda(adaYangMendengar(dbPort))} PostgreSQL         :${dbPort}`,
);

// Ajakan membuka hanya bila servernya benar-benar melayani.
const bisaDibuka = careevoSiap === true;
console.log("");
console.log(
  `  ${tebal("Buka:")} ${bisaDibuka ? hijau(`http://localhost:${careevoPortAktual}`) : merah("(belum siap)")}`,
);
if (masterySiap === true) {
  console.log(
    `  ${redup("Halaman /ai-mastery membingkai")} http://localhost:${masteryPort}`,
  );
}
const dimatikan = anak.filter(
  (p) => p.exitCode === null && p.signalCode === null,
).length;
console.log(
  dimatikan > 0
    ? redup("  Ctrl-C untuk berhenti.\n")
    : redup("  Tidak ada proses yang dijalankan skrip ini; Ctrl-C keluar.\n"),
);

// Jaga proses tetap hidup selama anak-anak hidup. Tanpa ini, event loop bisa
// kosong dan skrip keluar sendiri sementara server masih berjalan.
setInterval(() => {}, 1 << 30);
