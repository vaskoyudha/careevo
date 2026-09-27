/**
 * Seluruh permukaan audit sandbox dalam satu berkas.
 *
 * Pertanyaan "apa yang boleh dilakukan kode peserta" harus bisa dijawab dengan
 * membaca satu berkas ini saja (P7 spec). Karena itu tidak ada flag podman
 * lain di repo mana pun, dan tidak ada jalur bypass di sekitar
 * `bangunArgumenPodman`. Flag yang tersebar tidak bisa diaudit.
 *
 * Setiap flag di bawah punya alasan yang tertulis di tempat flag itu berada,
 * dan setiap alasan itu diuji di `src/lib/exec/sandbox.test.ts`. Menghapus
 * test itu berarti batas keamanan kehilangan penjaganya, bukan kehilangan
 * cakupannya.
 *
 * Angka di sini bukan tebakan. Semuanya diukur di mesin ini pada 2026-09-27
 * dengan `podman run` sungguhan, dan hasilnya ada di spec bagian
 * "Bukti terukur". Angka yang berubah karena hasil pengukuran ada yang
 * terlihat tidak masuk akal, jadi setiap angka yang diukur diberi alasan
 * pengukurannya, bukan hanya nilai angkanya.
 */

/** Image yang berisi g++. Satu image, satu bahasa; image ini 1,41 GB. */
export const IMAGE_KOMPILASI = "docker.io/library/gcc:13";

/**
 * Batas keras. Dipotong di runner, bukan di Next.
 *
 * Batas yang ditegakkan di dalam kontainer (waktu, memori, CPU, dan jumlah
 * proses) ikut ditulis ulang ke peserta lewat
 * `petakanStatus("batas_dilampaui")` di `port.ts`, jadi mengubah angka di sini
 * tanpa mengubah copy itu membuat peserta dapat amplop yang tidak berlaku.
 */
export const BATAS = {
  /** Ditegakkan sebelum podman dipanggil: kode sebesar ini lebih mahal ditolak. */
  baris: 20_000,
  karakter: 200_000,
  stdinKarakter: 8_192,
  keluaranKarakter: 65_536,

  /**
   * Batas waktu yang jadi kontrak, dalam detik. Terukur.
   *
   * Ditegakkan `timeout -s KILL` **di dalam** kontainer, bukan `--timeout`
   * podman. Alasannya hasil pengukuran: ketika podman yang mematikan
   * kontainer, ia mengembalikan 255 dengan stdout dan stderr kosong, karena
   * podman membuang keluaran yang ter-buffer. Akibatnya batas waktu, kehabisan
   * memori, dan fork bom semuanya terlihat sama, dan tidak ada yang bisa
   * dilaporkan kepada peserta. Dengan batas di dalam, yang terbaca adalah kode
   * 137 dan `Killed` — masih tidak menyebut batas mana yang meletus, tapi
   * peristiwanya setidaknya benar.
   */
  timeoutDetik: 10,

  /**
   * Ruang antara batas kontrak dan batas cadangan podman, dalam detik.
   *
   * Cadangan itu untuk hal yang tidak bisa di-*timeout*: podman yang
   * menggantung, image yang sedang mengunduh layer, atau kernel yang sedang
   * sibuk. Tanpa cadangan, satu kontainer macet bisa menahan slot antrean
   * selamanya. Ruangnya longgar supaya cadangan praktis tidak pernah jadi yang
   * mematikan lebih dulu, karena kalau begitu batas kontrak tidak pernah
   * terekam dan 137 tidak akan pernah muncul.
   */
  cadanganDetik: 15,

  memori: "512m",
  proses: 64,
  cpu: "1",

  /** Lebar antrean di runner: berapa eksekusi yang boleh jalan bersamaan. */
  antrean: 3,
};

/**
 * Penanda yang dipakai perintah di dalam kontainer.
 *
 * Angka bulat, bukan pesan teks, karena satu-satunya hal yang bisa diandalkan
 * setelah `sh` selesai adalah kode keluarannya. Penanda 42 membuat
 * `gagal_kompilasi` terdiagnosis tanpa menebak-nebak isi stderr.
 */
const PENANDA_SUMBER = 40;
const PENANDA_KOMPILASI = 42;

/**
 * Kode keluar yang berarti **kita** yang keliru, bukan program peserta.
 *
 * Ini ditulis sebagai tabel, bukan sebagai daftar `if`, supaya pertanyaannya
 * punya satu jawaban yang tertulis: kode mana yang milik podman dan kode mana
 * yang milik program peserta di dalam kontainer. Tanpa tabel itu, kode-kode ini
 * jatuh ke `sukses` hanya karena tidak dipikirkan, dan peserta yang programnya
 * benar-benar berhenti karena layanan berjalan lambat akan diberi tahu
 * "selesai tanpa galat".
 *
 * Kode podman sendiri (dari `podman-run(1)`):
 *
 * | kode | artinya |
 * |---|---|
 * | 125 | podman sendiri gagal: baris perintahnya salah, atau image tidak ada |
 * | 126 | perintah di dalam kontainer tidak bisa dijalankan |
 * | 127 | perintah di dalam kontainer tidak ditemukan |
 * | 255 | podman mati atau dibunuh — di sini, cadangan `--timeout` yang menyala |
 */
const KODE_PODMAN = {
  /** Cadangan `--timeout` yang menyala: kontainer yang macet kita bunuh. */
  cadangan: 255,
  /** Baris perintah podman salah, atau image tidak ada. */
  barisPerintah: 125,
  /** Perintah di dalam kontainer tidak bisa dijalankan. */
  tidakDapatDijalankan: 126,
  /** Perintah di dalam kontainer tidak ditemukan. */
  tidakDitemukan: 127,
};

/**
 * Rentang `128 + N`: kode yang diberikan kernel saat program mati karena sinyal.
 *
 * **Rentang, bukan daftar.** Daftar harus diperpanjang setiap kali ada sinyal
 * yang baru diingat, dan pada hari ada yang tidak diingat, kematian sinyal
 * berikutnya dilaporkan ke peserta sebagai `sukses` — persis kesalahan yang
 * membuat 134 lolos selama ini. Daftar juga tidak bisa diverifikasi: tidak ada
 * yang bisa membuktikan sebuah daftar lengkap tanpa mengetahui seluruh tabel
 * sinyal, sedangkan batas rentang bisa diuji di kedua ujungnya.
 */
const RENTANG_SINYAL = { awal: 128, akhir: 165 };

/**
 * Satu-satunya kode di rentang sinyal yang **bukan** milik program: SIGKILL
 * yang dikirim oleh batas kita, jadi `batas_dilampaui`, bukan `galat_program`.
 */
const SIGKILL_DARI_BATAS = 137;

/**
 * Apakah `exitCode` adalah program yang mati karena sinyal.
 *
 * Diukur pada 2026-09-27: exception C++ yang tidak tertangkap memanggil
 * `std::terminate` yang memanggil `abort` (SIGABRT, 134) — dan itu kode yang
 * **paling sering** keluar dari program peserta yang belum menangani
 * exception. `abort()` dan `assert` yang gagal juga 134. SIGSEGV 139 ada di
 * rentang yang sama, dan tidak lagi perlu barisnya sendiri.
 */
function adalahKodeSinyal(exitCode) {
  return (
    exitCode >= RENTANG_SINYAL.awal &&
    exitCode <= RENTANG_SINYAL.akhir &&
    exitCode !== SIGKILL_DARI_BATAS
  );
}

const BERKAS_BAHASA = { cpp: "main.cpp" };

/**
 * Nama berkas sumber untuk sebuah bahasa.
 *
 * Melempar untuk bahasa tak dikenal, bukan mengembalikan `undefined`:
 * `undefined` akan jadi `/src/undefined` di baris perintah, lalu muncul
 * sebagai `main.cpp:1:10: error: ...` yang membuat peserta mengira programnya
 * yang rusak. Bahasa adalah union tertutup di `@/types/course`, jadi daftar di
 * atas adalah satu-satunya bahasa yang boleh masuk.
 */
export function namaBerkas(bahasa) {
  const nama = BERKAS_BAHASA[bahasa];
  if (!nama) throw new Error(`Bahasa tidak dikenal: ${bahasa}`);
  return nama;
}

/**
 * Argumen `podman run` untuk satu eksekusi.
 *
 * Setiap flag punya alasan, dan alasannya diuji di `sandbox.test.ts`:
 *
 * - `--rm`. Tanpa itu setiap percobaan meninggalkan lapisan kontainer di
 *   disk, dan image ini 1,41 GB.
 * - `--network=none`. Kode peserta tidak butuh jaringan sama sekali, dan
 *   membuka jaringan berarti program bisa mengetuk port apa pun di loopback
 *   mesin tempat ia berjalan.
 * - `--read-only`. Filesystem kontainer tidak boleh berubah.
 * - `--user=65534:65534`. Nobody. Root di dalam kontainer rootless masih
 *   terisolasi, tapi tidak perlu dipakai. Sengaja literal, bukan dari `BATAS`,
 *   supaya nilainya bisa dicari auditor di teks berkas ini.
 * - `--cap-drop=all` dan `--security-opt=no-new-privileges`. Menutup jalur
 *   eskalasi hak: tanpa keduanya, program bisa mendapat hak yang tidak
 *   diberikan padanya.
 * - `--pids-limit`. Menahan fork bomb. Tanpa itu satu program bisa meledakkan
 *   jumlah proses mesin. Termasuk `fork()` dari program yang *tidak* nakal,
 *   jadi batas ini juga yang menjaga kernel.
 * - `--memory` dan `--cpus`. Menahan program yang rakus. `--memory` membuat
 *   OOM di dalam cgroup yang dibaca sebagai SIGKILL, bukan sebagai OOM killer
 *   di host, jadi program lain di mesin ini tidak ikut terbunuh.
 * - `/tmp` diberi `noexec` supaya tidak ada biner yang dieksekusi dari sana.
 *   Direktori kerja **harus** boleh exec, karena binary hasil kompilasi
 *   dijalankan dari sana. Membalik dua hal ini membuat sandbox tidak berguna:
 *   `noexec` di `/w` mematikan seluruh fitur, dan `/tmp` yang boleh exec
 *   membuka jalan keluar dari tmpfs.
 * - `--volume=...:/src:ro,z`. Mount hanya-baca, dan sufiks `z` wajib di mesin
 *   ini karena SELinux. Tanpa sufiks itu mount ditolak dengan *Permission
 *   denied* bahkan untuk berkas 0644 yang sebenarnya bisa dibaca.
 * - `--interactive`. Tanpa ini stdin podman tidak sampai ke program, dan
 *   program yang membaca masukan (bahan setengah besar pelajaran C++) akan
 *   melihat akhir stream seketika lalu menjalankan cabang yang salah. Tidak ada
 *   konsekuensi keamanan: yang diteruskan hanya masukan yang memang dikirim
 *   runner, dan `--network=none` tetap menutup jalan keluar.
 *
 * ## Kewajiban mode filesystem di luar berkas ini
 *
 * Flag tidak bisa melihat mode filesystem, jadi dua hal ini harus ditegakkan
 * oleh pemanggil (`server.mjs`) dan tidak bisa diuji dari sini:
 *
 * - Direktori spool harus mode **0755**, bukan mode default `mkdtemp` yaitu
 *   0700. Kontainer berjalan sebagai uid 65534, yang tidak bisa melewati
 *   direktori 0700 milik uid lain. Gejalanya menipu: mount-nya berhasil, sufiks
 *   `:z` juga berhasil, dan pesannya tetap `cp: cannot stat '/src/main.cpp':
 *   Permission denied`.
 * - Berkas sumber di dalam spool harus mode **0644**. 0600 juga tidak
 *   terbaca oleh uid 65534.
 */
export function bangunArgumenPodman({
  bahasa,
  direktori,
  timeoutDetik = BATAS.timeoutDetik,
}) {
  const berkas = namaBerkas(bahasa);

  // Tiga langkah, dipisah titik koma, dan masing-masing punya `|| exit` sendiri.
  //
  // Pemisahan `;` itu disengaja. Kalau langkahnya dirangkai dengan `&&`, maka
  // `cp` yang gagal tidak pernah sampai ke `exit 40` — g++ yang dipanggil lebih
  // dulu, penandanya tertukar, dan kegagalan membaca berkas yang sebenarnya
  // dilaporkan sebagai galat kompilasi.
  //
  // `timeout -s KILL` mengirim SIGKILL ke seluruh process group, jadi anak
  // dari fork bomb ikut mati bersama induknya, bukan ditinggalkan menggantung
  // sampai batas podman.
  //
  // Kompilasi dilakukan atas berkas hasil salinan dengan nama yang sama
  // persis, supaya nomor baris di diagnostik GCC menunjuk baris yang sama
  // dengan yang peserta lihat di editor-nya. Itu sinyal mengajar yang tidak
  // boleh berubah, dan `/src` sendiri tidak bisa dikompilasi karena mount-nya
  // hanya-baca sedangkan g++ menulis ke direktori kerja.
  const perintah = [
    `cp /src/${berkas} /w/${berkas} || exit ${PENANDA_SUMBER}`,
    `g++ -std=c++20 -O0 -o a.out ${berkas} || exit ${PENANDA_KOMPILASI}`,
    `timeout -s KILL ${timeoutDetik} ./a.out`,
  ].join("; ");

  return {
    args: [
      "run",
      "--rm",
      "--network=none",
      "--read-only",
      "--cap-drop=all",
      "--security-opt=no-new-privileges",
      "--pids-limit=" + String(BATAS.proses),
      "--memory=" + BATAS.memori,
      "--cpus=" + BATAS.cpu,
      "--user=65534:65534",
      "--interactive",
      "--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777",
      "--tmpfs=/w:rw,nosuid,nodev,size=32m,mode=1777",
      "--env=HOME=/tmp",
      "--env=TMPDIR=/tmp",
      "--volume=" + direktori + ":/src:ro,z",
      "--workdir=/w",
      // Cadangan, bukan kontrak. Harus selalu lebih besar dari `timeoutDetik`
      // di dalam kontainer, kalau tidak yang mematikan lebih dulu adalah
      // podman dan batas kontrak tidak pernah terekam.
      "--timeout=" + String(timeoutDetik + BATAS.cadanganDetik),
      IMAGE_KOMPILASI,
      "sh",
      "-c",
      perintah,
    ],
  };
}

/**
 * Exit code podman menjadi status semantik untuk `StatusJalankan`.
 *
 * Baris-baris di bawah diukur pada 2026-09-27, bukan ditebak:
 *
 * | kasus | exit | stderr |
 * |---|---|---|
 * | berhasil | 0 | — |
 * | sumber tidak terbaca | 40 | — |
 * | g++ menolak | 42 | diagnostik GCC penuh, dengan nomor baris |
 * | waktu habis | 137 | `Killed` |
 * | memori habis | 137 | `Killed` |
 * | fork bom | 137 | `Killed` |
 * | program crash sendiri (SIGSEGV) | 139 | `timeout: the monitored command dumped core` |
 * | exception tidak tertangkap | 134 | `terminate called after throwing an instance of …` |
 * | `abort()` atau `assert` gagal | 134 | `Aborted`, `Assertion … failed.` |
 * | `return 7` | 7 | — |
 *
 * Empat kesimpulan yang mencerminkan pengukuran di atas, dan yang mudah hilang
 * kalau pemetaan ditulis dari ingatan:
 *
 * 1. **Satu status untuk tiga batas.** Waktu, memori, dan proses semuanya
 *    menghasilkan 137 dan tidak bisa dibedakan dari luar kontainer — kernel
 *    tidak menyatakan batas mana yang meletus. Jadi `batas_dilampaui`, satu
 *    status untuk satu peristiwa yang benar-benar diamati. Memecahnya jadi
 *    tiga nama akan membuat runner menebak salah satu dari tiga, dan
 *    `petakanStatus` di `port.ts` sudah menyimpulkan itu: judulnya menyebut
 *    seluruh batas, bukan satu.
 * 2. **Kode milik program peserta berarti `sukses`, bukan `galat_runner`.**
 *    Program peserta boleh mengembalikan kode apa pun, jadi `return 3` adalah
 *    eksekusi yang berhasil. Melaporkannya sebagai "layanan eksekusi tidak
 *    tersedia" adalah kebohongan yang mengirim peserta ke tempat yang salah.
 * 3. **Kode milik podman dipetakan ke batas atau ke galat runner.** Ini yang
 *    paling mudah lupa: `255` bukan kode pilihan peserta, itu cadangan
 *    `--timeout` kita yang menyala. Kalau dibiarkan jatuh ke `sukses`, program
 *    yang menggantung cukup lama dilaporkan ke peserta sebagai "selesai tanpa
 *    galat" — kebohongan yang sama dengan yang di atas, hanya arahnya berlawanan.
 * 4. **Mati karena sinyal adalah `galat_program`, bukan `sukses`.** Di sini
 *    sebagian besar kode di rentang `128 + N` adalah kode peserta yang
 *    benar-benar menabrak. Yang paling sering adalah 134: exception C++ yang
 *    tidak tertangkap memanggil `std::terminate` yang memanggil `abort`. Dan
 *    pelajaran exception adalah pelajaran C++ pertama yang biasanya gagal
 *    ditulis peserta, jadi kelas kesalahan ini bukan kasus pinggir. Satu
 *    pengecualian harus disebut: **137** itu SIGKILL dari batas kita, jadi
 *    `batas_dilampaui`. Lihat `adalahKodeSinyal`.
 *
 * Jadi pemetaan ini **tidak** lagi berarti "apa pun yang tidak dikenali berarti
 * sukses". Yang berarti sukses adalah kode-kode yang memang bisa dipilih
 * program di dalam kontainer. Kode milik podman dan penanda miliknya
 * ditangani satu per satu di `KODE_PODMAN` dan dua `PENANDA_*`, dan hanya
 * sisanya yang jatuh ke `sukses`.
 *
 * 124 sengaja tidak dikasus khusus. Dengan `timeout -s KILL`, `timeout` sendiri
 * tidak pernah mengembalikan 124 — ia meneruskan SIGKILL, jadi yang muncul
 * 137. Kalau 124 muncul, itu kode pilihan programnya sendiri, dan ikut aturan
 * yang sama: `sukses`.
 *
 * `stdout` dan `stderr` sengaja tidak dipakai di bawah, dan itu bukan
 * kelalaian. Percobaan pertama memetakan status dari isi stderr, dan itu
 * memakai regex seperti `/killed/i` atau `/error:/` — artinya statusnya
 * bergantung pada kalimat yang ditulis GCC atau GNU timeout, yang bisa berubah
 * antar versi. Penanda bilangan di perintah dalam kontainer tidak. Isi
 * keluaran tetap diteruskan ke peserta apa adanya; yang tidak dilakukan hanya
 * menafsirkan ulang teksnya.
 */
export function petakanExitCode({ exitCode, stdout, stderr }) {
  if (exitCode === 0) return "sukses";
  // Sumber tidak terbaca dari dalam kontainer. Mount-nya salah mode, atau
  // spool-nya hilang. Dua-duanya urusan runner, bukan peserta.
  if (exitCode === PENANDA_SUMBER) return "galat_runner";
  // Penanda dari perintah di atas. g++ yang menolak, program belum jalan.
  if (exitCode === PENANDA_KOMPILASI) return "gagal_kompilasi";
  // Aturan umum lebih dulu: program yang mati karena sinyal, yaitu seluruh
  // rentang `128 + N` kecuali satu anggota. Di dalamnya 139 (SIGSEGV) yang
  // dulu punya barisnya sendiri, dan 134 (SIGABRT) dari exception yang tidak
  // tertangkap, `abort()`, atau `assert` yang gagal.
  //
  // Urutannya disengaja. Anggota yang dikecualikan harus ditolak oleh
  // `adalahKodeSinyal` **sebelum** statusnya dihitung di baris berikutnya.
  // Kalau pemeriksaan 137 diletakkan lebih dulu, pengecualian di dalam
  // `adalahKodeSinyal` tidak akan pernah dibaca — dan kode yang tidak pernah
  // dibaca tidak bisa diuji. `sandbox.test.ts` mengunci kedua arah.
  if (adalahKodeSinyal(exitCode)) return "galat_program";
  // 137, yaitu 128 + 9, SIGKILL. Satu-satunya kode di rentang sinyal yang
  // dikirim oleh batas kita sendiri: sumbernya bisa kehabisan waktu, kehabisan
  // memori, atau kehabisan proses, dan stderr hanya mengonfirmasi bahwa proses
  // dibunuh tanpa menyatakan apa yang membunuhnya.
  if (exitCode === SIGKILL_DARI_BATAS) return "batas_dilampaui";
  // Cadangan `--timeout` podman yang menyala: kontainer yang macet kita bunuh
  // sendiri. Batas yang aktif, jadi `batas_dilampaui` — bukan `sukses`, dan
  // bukan `galat_runner`, karena pelakunya memang batas dan bukan kelesetan.
  //
  // Penting: kode 255 ini **bukan** kode pilihan program peserta. Kalau
  // dibiarkan jatuh ke `sukses`, program yang menggantung sampai cadangan
  // menyala akan dilaporkan sebagai "selesai tanpa galat".
  if (exitCode === KODE_PODMAN.cadangan) return "batas_dilampaui";
  // 125/126/127 semuanya berarti kita yang salah: baris perintah podman salah
  // atau image bermasalah (125), perintah di dalam kontainer tidak bisa
  // dijalankan (126), atau tidak ditemukan sama sekali (127). Untuk
  // `sh -c` yang dipakai di sini, ketiganya berarti image rusak — `sh` selalu
  // ada dan selalu bisa dijalankan di image yang benar.
  //
  // Kenapa `galat_runner` dan bukan `batas_dilampaui`: tidak ada batas yang
  // meletus, dan program tidak sempat jalan. Melaporkan ini sebagai "program
  // dihentikan karena melampaui batas" akan menyalahkan program peserta atas
  // kegagalan image yang bukan miliknya.
  if (
    exitCode === KODE_PODMAN.barisPerintah ||
    exitCode === KODE_PODMAN.tidakDapatDijalankan ||
    exitCode === KODE_PODMAN.tidakDitemukan
  ) {
    return "galat_runner";
  }
  // Sisanya adalah kode yang memang bisa dipilih program di dalam kontainer:
  // program berjalan, selesai, dan mengembalikan kodenya sendiri, jadi
  // `sukses`. `return 3` adalah eksekusi yang berhasil, dan stdout-nya
  // adalah jawabannya.
  //
  // Catatan: ini **bukan** "apa pun yang tidak dikenali berarti sukses". Kode
  // podman dan penanda miliknya sudah ditangani di atas. Yang jatuh ke sini
  // adalah kode peserta, dan hanya itu. `petakanStatus("sukses")` tidak
  // menampilkan angka exit, dan `HasilJalankan.exitCode` tetap memegangnya
  // untuk diagnosis.
  return "sukses";
}

/**
 * Potong keluaran ke batas, dengan penanda bahwa pemotongan terjadi.
 *
 * Dipotong dari depan, dan ini menentukan kualitas `gagal_kompilasi`:
 * diagnostik GCC dibaca dari baris pertama (`main.cpp:3:11: error: ...`), jadi
 * potongan dari belakang akan membuangnya dan mengubah status yang paling
 * berguna menjadi pesan tanpa isi.
 *
 * Pemotongan juga bukan penyuntingan. Yang dipangkas hanya panjangnya; isi
 * yang tampil tetap apa adanya, dan penandanya ditambahkan, bukan mengganti
 * teks mana pun. Batas 64 KiB cukup lega untuk diagnostik GCC, jadi pada
 * praktiknya fungsi ini tidak melakukan apa-apa untuk galat kompilasi.
 */
export function potongKeluaran(teks, maks = BATAS.keluaranKarakter) {
  if (teks.length <= maks) return teks;
  return teks.slice(0, maks) + "\n… keluaran dipotong pada batas layanan";
}
