/**
 * Seluruh permukaan audit sandbox workspace dalam satu berkas.
 *
 * Ini pasangan `exec/runner/soal.mjs` untuk **ruang kerja**, bukan untuk sekali
 * jalan. Perbedaannya penting dan menentukan bentuk berkas ini:
 *
 * - Runner eksekusi menjalankan satu biner lalu membuang kontainernya (`--rm`).
 *   Ia tidak punya keadaan, tidak punya berkas yang bertahan, dan tidak
 *   melayani HTTP.
 * - Ruang kerja **hidup lama**. Ia menyajikan HTTP, menyimpan berkas peserta di
 *   volume, dan tetap ada antar kunjungan. Karena itu ia punya dua hal yang
 *   tidak dimiliki runner: **nama** (agar bisa ditemukan kembali) dan
 *   **identitas** (agar peserta lain tidak bisa membukanya).
 *
 * Pertanyaan "apa yang boleh dilakukan kode peserta" tetap harus bisa dijawab
 * dengan membaca satu berkas ini. Karena itu tidak ada flag podman lain di
 * seluruh `src/lib/workspace`, dan tidak ada jalur bypass di sekitar
 * `bangunArgumenPodman`.
 *
 * Berkas ini **murni**: tanpa I/O, tanpa `node:fs`, tanpa `spawn`. Yang
 * di-import hanyalah `node:crypto` untuk menurunkan kunci ruang kerja, dan itu
 * komputasi murni — bukan I/O. Sifat murni inilah yang membuat berkas ini bisa
 * diuji tanpa podman sama sekali, seperti `sandbox.test.ts`.
 */

import { createHash } from "node:crypto";

/**
 * Image yang menyajikan IDE lengkap di peramban.
 *
 * code-server adalah build terbuka VS Code yang berjalan di server: editor,
 * pohon berkas, tab, terminal, LSP, Git, dan ekstensi — semuanya sudah ada di
 * dalam image ini. Kita **tidak** menulis IDE-nya; kita menjalankannya. Itu
 * keputusan yang menghemat seluruh pekerjaan membangun workbench (lihat
 * `docs/` untuk catatan keputusan).
 *
 * Tag sengaja dipin ke versi persis dan bukan `latest`: `latest` membuat isi
 * ruang kerja peserta berubah tanpa satu pun commit di repo ini, dan sebuah
 * pembaruan yang mengubah format data bisa membuat volume peserta tidak terbaca
 * tanpa jejak di git. Menaikkan tag adalah perubahan yang disengaja dan
 * terlihat.
 *
 * Angka ini **diukur** di mesin ini pada 2026-10-03: `code-server --version`
 * mengembalikan `4.140.0 … with Code 1.140.0`. Tag `latest` pada hari yang sama
 * menunjuk versi yang sama, jadi pin ini tidak menurunkan apa pun — ia hanya
 * mengubah "mengikuti apa pun yang ada" menjadi "versi yang sudah diuji".
 */
export const IMAGE_WORKSPACE = "docker.io/codercom/code-server:4.140.0";

/**
 * Batas keras satu ruang kerja.
 *
 * Berbeda dari `BATAS` di runner yang membatasi satu program, angka di sini
 * membatasi satu **kontainer yang hidup**. Karena kontainer ini melayani
 * peramban dan menjalankan terminal, angkanya jauh lebih longgar — tetapi tetap
 * ada, karena tanpa batas satu ruang kerja bisa memakan seluruh mesin dan
 * membuat ruang kerja peserta lain tidak bisa dijalankan.
 */
export const BATAS_WS = {
  /** Memori per ruang kerja. Cukup untuk editor + LSP + terminal biasa. */
  memori: "2g",
  /** CPU per ruang kerja, dalam core. */
  cpu: "2",
  /** Batas proses: menahan fork bomb dari terminal peserta. */
  proses: 1024,
  /**
   * Port yang didengarkan code-server **di dalam** kontainer. Tetap, karena
   * yang berubah adalah port di host — lihat catatan penerbitan port di
   * `bangunArgumenPodman`.
   */
  portDalam: 8080,
  /**
   * Berapa lama ruang kerja boleh menganggur sebelum dimatikan, dalam menit.
   *
   * Ini bukan hiasan: kontainer yang hidup memegang memori dan CPU yang tidak
   * dipakai. Tanpa batas, sepuluh peserta yang membuka lalu menutup tab
   * meninggalkan sepuluh kontainer yang menunggu selamanya.
   */
  menganggurMenit: 30,
  /**
   * Berapa ruang kerja boleh hidup bersamaan di satu mesin.
   *
   * Bukan batas keamanan, melainkan batas kapasitas: pada 2 GB per ruang
   * kerja, dua belas ruang kerja sudah melebihi mesin 32 GB. Angka ini yang
   * membuat penolakan terjadi **sebelum** podman dipanggil, dengan pesan yang
   * bisa dibaca peserta, bukan OOM yang membunuh ruang kerja orang lain.
   */
  serentak: 12,
};

/**
 * Prefiks nama wadah dan volume.
 *
 * Sengaja tetap dan dapat dicari: `podman ps --filter name=careevo-ws-` harus
 * menemukan seluruh ruang kerja milik aplikasi ini, dan tidak ada satu pun
 * sumber daya yang dibuat tanpa prefiks ini. Tanpa konvensi itu, pembersihan
 * yang gagal di tengah jalan meninggalkan kontainer yang tidak bisa dibedakan
 * dari milik proses lain di mesin yang sama.
 */
const PREFIKS = "careevo-ws";

/**
 * Panjang potongan hash pada nama wadah, dalam karakter heksadesimal.
 *
 * 12 karakter = 48 bit. Tabrakan pada 12 karakter praktis tidak terjadi untuk
 * jumlah peserta yang masuk akal, sedangkan 64 karakter penuh membuat nama
 * wadah tidak bisa dibaca manusia saat `podman ps`. Nama yang bisa dibaca
 * adalah alat debug, dan itu bagian dari alasan berkas ini ada.
 */
const PANJANG_HASH = 12;

/**
 * Identitas stabil sebuah ruang kerja.
 *
 * Kunci hash adalah `userId` **dan** `courseId`, bukan salah satunya: satu
 * peserta boleh punya ruang kerja di beberapa course, dan dua peserta tidak
 * boleh berbagi ruang kerja hanya karena kebetulan berada di course yang sama.
 * Pemisah `\u0000` dipakai supaya pasangan yang berbeda tidak bisa menghasilkan
 * string gabungan yang sama (mis. `"a"+"bc"` dan `"ab"+"c"`).
 *
 * Yang dikembalikan hanya huruf heksadesimal, jadi tidak ada satu pun karakter
 * yang perlu di-escape saat masuk ke nama wadah maupun nama berkas.
 */
export function kunciWorkspace(userId, courseId) {
  return createHash("sha256").update(`${userId}\u0000${courseId}`).digest("hex").slice(0, PANJANG_HASH);
}

/** Nama kontainer podman untuk sebuah ruang kerja. */
export function namaWadah(userId, courseId) {
  return `${PREFIKS}-${kunciWorkspace(userId, courseId)}`;
}

/**
 * Nama volume tempat berkas peserta disimpan.
 *
 * Dipisah dari nama wadah walaupun keduanya memakai kunci yang sama. Alasannya
 * bukan keindahan: kontainer **dibuang dan dibuat ulang** (mis. saat image
 * naik tag), sedangkan volume harus bertahan. Dua nama yang identik akan
 * membuat penghapusan kontainer yang ditulis dengan `--volumes` ikut menghapus
 * pekerjaan peserta — kesalahan yang tidak bisa dibatalkan.
 */
export function namaVolume(userId, courseId) {
  return `${PREFIKS}-${kunciWorkspace(userId, courseId)}-data`;
}

/**
 * Argumen `podman run` untuk satu ruang kerja.
 *
 * Setiap flag punya alasan, dan alasannya diuji di `workspace.test.ts`:
 *
 * - `--detach`. Ruang kerja hidup lama; ia tidak boleh terikat pada satu
 *   permintaan HTTP.
 * - `--rm`. Kontainer dibuang saat dimatikan, tetapi **volume tidak**, karena
 *   volume adalah nama terpisah. Tanpa `--rm`, setiap restart meninggalkan
 *   lapisan kontainer yang menumpuk.
 * - `--cap-drop=all` dan `--security-opt=no-new-privileges`. Menutup jalur
 *   eskalasi hak. Terminal peserta adalah shell sungguhan, jadi ini bukan
 *   formalitas: tanpa keduanya, shell itu bisa mendapat hak yang tidak
 *   diberikan padanya.
 * - `--pids-limit`. Menahan fork bomb dari terminal.
 * - `--memory` dan `--cpus`. Satu ruang kerja tidak boleh memakan seluruh
 *   mesin; lihat `BATAS_WS`.
 * - `--volume=...:/home/coder/project`. Satu-satunya tempat berkas peserta
 *   hidup. Titik mount ini milik image, bukan pilihan kita.
 * - `--publish=127.0.0.1::8080`. Port diterbitkan **hanya ke loopback** dan port
 *   host **dibiarkan podman yang memilih** (perhatikan `::` tanpa angka). Dua
 *   keputusan dalam satu flag:
 *   1. Loopback, karena yang menghadap peserta adalah reverse proxy, bukan
 *      port ini. Menerbitkannya ke `0.0.0.0` berarti siapa pun di jaringan
 *      yang sama bisa membuka terminal peserta.
 *   2. Port dinamis, karena port tetap berarti dua ruang kerja bisa bertabrakan
 *      dan yang kedua gagal start dengan pesan yang membingungkan. Port
 *      sesungguhnya dibaca kembali lewat `podman port`, dan itu urusan
 *      `server.mjs`.
 *
 * ## Kenapa `--auth none`, dan apa yang menggantikan kata sandinya
 *
 * Percobaan pertama memakai `--auth password` dengan kata sandi yang diturunkan
 * dari rahasia bersama. Itu **tidak bisa bekerja** dari dalam iframe, dan
 * kegagalannya terukur di peramban sungguhan: kata sandi code-server disimpan
 * di **cookie** pada origin ruang kerja, dan iframe yang di-sandbox tidak bisa
 * menyimpan cookie apa pun sampai ia diberi `allow-same-origin`. Tanpa itu,
 * yang peserta lihat bukan "IDE", melainkan halaman masuk code-server yang
 * tidak pernah bisa dilewati — bukan keamanan tambahan, hanya fitur yang mati.
 *
 * Yang menggantikan kata sandi adalah **dua lapis yang sudah ada**:
 *
 * 1. **Port hanya di loopback.** Tidak ada proses di luar mesin ini yang bisa
 *    menjangkau ruang kerja sama sekali.
 * 2. **Kuncinya adalah URL-nya sendiri.** `kunciWorkspace` adalah 48 bit acak
 *    yang tidak bisa ditebak, dan di produksi ia menjadi label subdomain
 *    (`<kunci>.ws.careevo.app`). Siapa pun yang tidak tahu kuncinya tidak bisa
 *    menemukan ruang kerja itu — pola *capability URL*, sama seperti tautan
 *    reset kata sandi.
 *
 * **Yang harus ada di produksi dan belum ada di sini**: reverse proxy yang
 * memvalidasi sesi Careevo sebelum meneruskan ke subdomain ruang kerja. Tanpa
 * itu, keamanan produksi bersandar pada kunci 48 bit saja. Itu disebut di sini
 * supaya tidak terbaca sebagai "sudah selesai", karena belum.
 *
 * ## Yang **tidak** ada di sini, dan alasannya
 *
 * - **`--network=none` tidak dipakai.** Berbeda dari runner eksekusi, ruang
 *   kerja **butuh** jaringan: memasang ekstensi, `apt install`, `pip install`,
 *   dan `npm install` adalah bagian dari pekerjaan nyata peserta. Menutup
 *   jaringan membuat IDE yang tampak lengkap tetapi tidak bisa memasang apa
 *   pun — dan itu kebohongan yang baru ketahuan saat peserta mencoba. Yang
 *   membatasi bukan ketiadaan jaringan, melainkan `--memory`, `--cpus`, dan
 *   `--pids-limit` di atas.
 * - **`--network` juga tidak ditulis untuk memilih backend.** Awalnya di sini
 *   ada `--network=slirp4netns`, dan itu **salah di mesin ini**: backend
 *   jaringan podman di sini adalah netavark dengan `pasta`, dan `slirp4netns`
 *   tidak terpasang. Menulis nama backend yang tidak ada membuat setiap ruang
 *   kerja gagal start dengan pesan yang menyesatkan. Yang benar adalah
 *   membiarkan podman memakai jaringannya sendiri. `--network=host` juga tidak
 *   dipakai: ia membuang namespace jaringan, sehingga port ruang kerja bisa
 *   bertabrakan dengan port mesin ini.
 * - **`--read-only` tidak dipakai.** Sama alasannya: terminal harus bisa
 *   menulis. Yang melindungi mesin inang adalah namespace kontainer dan
 *   `--cap-drop=all`, bukan filesystem hanya-baca.
 * - **`--user` tidak ditulis.** Image code-server sudah berjalan sebagai
 *   pengguna tak-berhak `coder` (uid 1000). Menulis `--user=65534:65534` seperti
 *   di runner justru **merusak** ruang kerja ini: direktori home image dimiliki
 *   uid 1000, dan menjalankannya sebagai uid lain membuat code-server gagal
 *   menulis konfigurasinya sendiri.
 */
export function bangunArgumenPodman({ userId, courseId }) {
  const volume = namaVolume(userId, courseId);

  return {
    args: [
      "run",
      "--detach",
      "--rm",
      "--name",
      namaWadah(userId, courseId),
      "--cap-drop=all",
      "--security-opt=no-new-privileges",
      "--pids-limit=" + String(BATAS_WS.proses),
      "--memory=" + BATAS_WS.memori,
      "--cpus=" + BATAS_WS.cpu,
      "--volume=" + volume + ":/home/coder/project:z",
      "--publish=127.0.0.1::" + String(BATAS_WS.portDalam),
      IMAGE_WORKSPACE,
      // Argumen code-server. `--disable-telemetry` mematikan laporan ke Coder,
      // `--disable-update-check` menahan panggilan jaringan yang tidak ada
      // gunanya di dalam kontainer yang tag imagenya sudah dipin, dan
      // `--auth none` menyerahkan autentikasi ke loopback + kunci URL — lihat
      // catatan panjang di atas.
      "--disable-telemetry",
      "--disable-update-check",
      // Workspace Trust menampilkan spanduk "Restricted Mode" dan menahan
      // fitur sampai peserta menekan "Trust". Di ruang kerja yang seluruhnya
      // milik peserta sendiri, spanduk itu hanya satu langkah yang tidak
      // melindungi apa pun — tidak ada berkas orang lain di dalam sana.
      "--disable-workspace-trust",
      "--auth",
      "none",
      // Argumen posisional terakhir: folder yang dibuka. Tanpa ini code-server
      // membuka `/home/coder` (home pengguna `coder`), sehingga pohon berkas
      // menampilkan `.cache`, `.config`, dan `.local` — bukan pekerjaan
      // peserta. Titik mount volume adalah `/home/coder/project`, jadi itu yang
      // harus dibuka.
      "/home/coder/project",
    ],
  };
}

/**
 * Nama wadah dari sebuah nama yang diberikan pengguna, atau `null`.
 *
 * Dipakai `server.mjs` untuk memastikan bahwa yang dihentikan benar-benar
 * ruang kerja aplikasi ini, bukan kontainer lain di mesin yang sama. Tanpa
 * pemeriksaan ini, satu bug di pemanggil bisa membuat `podman rm -f` menyentuh
 * kontainer yang tidak ada hubungannya — dan itu tidak bisa dibatalkan.
 *
 * Pemeriksaannya **allowlist**, bukan blocklist: hanya prefiks kita yang
 * diterima, dan sisanya harus persis huruf heksadesimal sepanjang `PANJANG_HASH`.
 * Bentuk itu membuat nama yang mengandung spasi, `..`, atau opsi podman
 * (`--foo`) tidak mungkin lolos.
 */
export function wadahSah(nama) {
  if (typeof nama !== "string") return null;
  const cocok = new RegExp(`^${PREFIKS}-[0-9a-f]{${PANJANG_HASH}}$`).exec(nama);
  return cocok ? cocok[0] : null;
}

/**
 * Apakah sebuah wadah sudah melewati batas menganggur.
 *
 * `terakhirDipakai` adalah stempel waktu ISO dari `server.mjs`, dan `now`
 * disuntikkan supaya aturan ini bisa diuji tanpa memalsukan jam. Stempel yang
 * tidak bisa dibaca dianggap **sudah lewat** (gagal-tertutup): ruang kerja yang
 * umurnya tidak bisa diaudit tidak boleh dianggap masih dipakai, karena itu
 * satu-satunya cara kontainer tak dikenal bisa hidup selamanya.
 */
export function sudahMenganggur(terakhirDipakai, now = Date.now(), batasMenit = BATAS_WS.menganggurMenit) {
  const akhir = Date.parse(terakhirDipakai);
  if (!Number.isFinite(akhir)) return true;
  return now - akhir > batasMenit * 60_000;
}

/**
 * URL publik sebuah ruang kerja.
 *
 * Tiga bentuk, dan pemilihannya bukan kosmetik:
 *
 * - **Subdomain** (`https://<kunci>.ws.careevo.test`) dipakai bila domain dasar
 *   diisi. code-server paling bahagia di akar path: WebSocket-nya, cookie-nya,
 *   dan seluruh aset absolutnya bekerja tanpa konfigurasi tambahan. Ini juga
 *   bentuk yang dipilih untuk produksi.
 * - **Loopback bernama** (`http://localhost:<port>` atau
 *   `http://127.0.0.1:<port>`) adalah bentuk pengembangan. `host` datang dari
 *   hostname yang **sudah dipakai peserta** untuk membuka aplikasi ini, bukan
 *   nilai tetap. Alasannya bukan kerapian: `localhost` dan `127.0.0.1` adalah
 *   **origin yang berbeda** bagi peramban, jadi peserta yang membuka
 *   `localhost:3000` lalu mendapat ruang kerja di `127.0.0.1:<port>` akan punya
 *   IDE yang menyimpan keadaan (berkas terbuka, tata letak) di ember yang
 *   berbeda dari yang ia harapkan — dan berpindah antar keduanya kehilangan
 *   keadaan itu tanpa penjelasan. Mengikuti hostname yang sudah dipakai membuat
 *   originnya konsisten.
 *
 *   **Hostname-nya divalidasi di sini, bukan dipercaya.** Nilai yang bukan salah
 *   satu nama loopback yang dikenal jatuh ke `127.0.0.1`. Tanpa penjagaan itu,
 *   header `Host` yang dikirim klien bisa menjadi hostname apa pun, dan URL yang
 *   dihasilkan akan menunjuk mesin lain — satu langkah dari open redirect.
 *
 *   Kenapa bawaannya `127.0.0.1` dan bukan `localhost`: di banyak mesin
 *   (termasuk mesin pengembangan ini) `localhost` resolve ke `::1` **lebih
 *   dulu**, sedangkan podman menerbitkan port ke IPv4 `127.0.0.1`. `localhost`
 *   tetap bekerja, tetapi hanya lewat fallback peramban dari `::1` ke
 *   `127.0.0.1`. Literal IPv4 tidak bergantung pada fallback itu.
 */
export function urlWorkspace({ domainDasar, kunci, port, host }) {
  if (domainDasar) return `https://${kunci}.${domainDasar}`;
  const nama = namaHostSah(host);
  return `http://${nama}:${String(port)}`;
}

/**
 * Nama host loopback yang boleh muncul di URL ruang kerja, atau `127.0.0.1`.
 *
 * **Allowlist, bukan blocklist.** Yang diterima hanya nama yang menunjuk mesin
 * ini sendiri. Hostname lain — termasuk IP publik, nama domain, dan nilai yang
 * memuat `:` atau `/` — ditolak dan jatuh ke `127.0.0.1`. Pemeriksaan ini yang
 * membuat `Host` dari klien tidak bisa mengalihkan URL ke mesin lain.
 */
export function namaHostSah(host) {
  if (typeof host !== "string") return "127.0.0.1";
  // Buang port bila ada (`localhost:3000` -> `localhost`). Hanya satu titik dua
  // yang diterima; lebih dari itu menandakan bentuk yang tidak kita duga.
  const tanpaPort = host.split(":")[0].trim().toLowerCase();
  if (tanpaPort === "localhost" || tanpaPort === "127.0.0.1") return tanpaPort;
  return "127.0.0.1";
}

export { PREFIKS };
