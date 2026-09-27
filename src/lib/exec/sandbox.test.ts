import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Penjaga permukaan audit sandbox (`runner/soal.mjs`).
 *
 * Tiga keputusan bentuk berkas ini, masing-masing karena alasan yang bisa
 * diperiksa:
 *
 * 1. Ekstensi `.ts`, bukan `.test.mjs`. `include` di `vitest.config.mts`
 *    sempit: hanya berkas di dalam `src` yang berakhiran `.test.ts`. Berkas
 *    `.test.mjs` tidak terlihat `npm test` sama sekali, dan test yang tidak
 *    jalan lebih buruk daripada test yang tidak ada, karena ia terlihat lulus.
 * 2. `soal.mjs` **dijalankan di proses Node terpisah**, bukan diimpor dari
 *    `.ts`. Mengimpor `.mjs` dari TypeScript butuh deklarasi tipe yang tidak
 *    ada di repo ini dan `tsc --noEmit` akan menolaknya. Menjalankan
 *    `node --input-type=module` memberi hal yang lebih baik dari deklarasi
 *    tipe: fungsi sungguhan yang dieksekusi. Jadi `petakanExitCode` dan
 *    `bangunArgumenPodman` diuji lewat perilakunya, bukan lewat tebakan
 *    bentuk teksnya. Podman dan g++ tidak dibutuhkan; keduanya fungsi murni.
 * 3. Flag keamanan **tetap** diperiksa sebagai teks juga. Untuk properti
 *    keamanan, "literal flag ini benar-benar ada di berkas audit" adalah
 *    assertion yang tepat, dan ia mengunci P7 spec: kalau flag podman
 *    muncul di berkas lain, pertanyaannya tidak lagi bisa dijawab dengan
 *    membaca satu tempat.
 */

const ALAMAT_SOAL = new URL("./runner/soal.mjs", import.meta.url);
const sumber = readFileSync(ALAMAT_SOAL, "utf8");

interface HasilNyata {
  BATAS: Record<string, number | string>;
  IMAGE_KOMPILASI: string;
  namaCpp: string;
  namaRust: string | null;
  argumenRust: string | null;
  dasar: string[];
  tigaPuluh: string[];
  perintah: string;
  petakan: Record<string, string>;
  potong: string[];
}

/**
 * Skrip yang memuat modul sungguhan lalu melaporkan hasilnya sebagai JSON.
 *
 * `import` dinamis dipakai karena specifier-nya datang dari argv, dan
 * `import ... from <expr>` bukan sintaks yang sah. Top-level await tersedia
 * karena `--input-type=module`.
 */
const SKRIP = `
const m = await import(process.argv[1]);
const p = (exitCode, stdout, stderr) => m.petakanExitCode({ exitCode, stdout, stderr });
const kosong = "";

const petakan = {};
for (const k of [0, 1, 2, 3, 7, 40, 42, 100, 124, 125, 126, 127, 128, 132, 134, 136, 137, 138, 139, 160, 165, 166, 200, 255]) {
  petakan["koso-" + k] = p(k, kosong, kosong);
}
petakan["42-diagnostik"] = p(42, kosong, "main.cpp:1:14: error: expected ';' before '}' token");
for (const isi of [
  "terminate called after throwing an instance of 'int'",
  "a.out: main.cpp:2: int main(): Assertion \`1==2' failed.",
  "timeout: the monitored command dumped core",
  "Killed",
]) {
  petakan["134-dengan-" + isi] = p(134, kosong, isi);
}
petakan["137-dikilled"] = p(137, kosong, "Killed");
petakan["139-core"] = p(139, kosong, "timeout: the monitored command dumped core");
petakan["3-bukan-galat-runner"] = p(3, "hasil\\n", kosong);
petakan["kosong"] = p(null, kosong, kosong);
petakan["kosong-pakai-keluaran"] = p(null, "hasil\\n", kosong);

let namaRust = null;
try { m.namaBerkas("rust"); } catch (galat) { namaRust = String(galat.message); }
let argumenRust = null;
try { m.bangunArgumenPodman({ bahasa: "rust", direktori: "/tmp/spool-uji" }); }
catch (galat) { argumenRust = String(galat.message); }

const dasar = m.bangunArgumenPodman({ bahasa: "cpp", direktori: "/tmp/spool-uji" }).args;
const tigaPuluh = m.bangunArgumenPodman({ bahasa: "cpp", direktori: "/tmp/spool-uji", timeoutDetik: 30 }).args;

process.stdout.write(JSON.stringify({
  BATAS: m.BATAS,
  IMAGE_KOMPILASI: m.IMAGE_KOMPILASI,
  namaCpp: m.namaBerkas("cpp"),
  namaRust,
  argumenRust,
  dasar,
  tigaPuluh,
  perintah: dasar[dasar.length - 1],
  petakan,
  potong: [
    m.potongKeluaran("halo", 10),
    m.potongKeluaran("0123456789ABCDEF", 10),
    m.potongKeluaran("", 5),
  ],
}));
`;

const nyata: HasilNyata = JSON.parse(
  execFileSync(
    process.execPath,
    ["--input-type=module", "-e", SKRIP, ALAMAT_SOAL.href],
    { encoding: "utf8", maxBuffer: 1 << 20 },
  ),
) as HasilNyata;

/** Ambil satu argumen podman yang diawali `awalan`. */
function nilai(awalan: string, args: string[]): string | undefined {
  return args.find((argumen) => argumen.startsWith(awalan));
}

/**
 * Flag yang harus muncul sebagai argumen podman terpisah.
 *
 * Pola-polanya sengaja tanpa penanda `g`: `RegExp.test` dengan `g` menyimpan
 * `lastIndex`, jadi test yang memakainya berulang bisa lulus atau gagal
 * tergantung urutan pemanggilan. Versi global dibuat ulang di test anti-vaku.
 *
 * Pola di sini harus cocok dua kali: di teks `soal.mjs` (supaya permukaan
 * audit benar-benar ada di satu berkas, P7 spec) **dan** di argumen yang
 * benar-benar dibangun. Pola yang hanya cocok di satu tempat tidak berguna
 * untuk yang lain.
 */
const FLAG_PODMAN: readonly [alasan: string, pola: RegExp][] = [
  ["tidak pernah memberi jaringan", /--network=none/],
  ["tidak pernah menulis ke filesystem kontainer", /--read-only/],
  ["berjalan sebagai nobody, bukan root", /--user=65534:65534/],
  ["membuang seluruh kapabilitas Linux", /--cap-drop=all/],
  ["menonaktifkan eskalasi hak", /--security-opt=no-new-privileges/],
  ["membatasi jumlah proses", /--pids-limit=/],
  ["membatasi memori", /--memory=/],
  ["membatasi CPU", /--cpus=/],
  ["membatasi waktu dari luar kontainer", /--timeout=/],
  ["membuang kontainer setelah selesai", /--rm\b/],
  ["menyerahkan stdin ke program", /--interactive\b/],
  ["memberi label SELinux pada mount", /\/src:ro,z/],
  ["memblokir eksekusi dari /tmp", /\/tmp:rw,noexec/],
  ["tetap mengizinkan eksekusi di direktori kerja", /\/w:rw,nosuid,nodev/],
];

/**
 * Bagian yang harus ada di teks `soal.mjs`.
 *
 * Isi perintah shell ditulis sebagai template literal, jadi penandanya ada di
 * teks sebagai konstanta, bukan sebagai `exit 40` yang sudah dirakit. Karena
 * itu bentuk yang dicari di sini adalah bentuk sumbernya; bentuk yang sudah
 * dirakit diperiksa di `PERINTAH_TERUKUR`.
 */
const BAGIAN_SUMBER: readonly [alasan: string, pola: RegExp][] = [
  ["batas waktu di dalam kontainer", /timeout -s KILL/],
  ["nilai penanda sumber", /PENANDA_SUMBER = 40/],
  ["nilai penanda kompilasi", /PENANDA_KOMPILASI = 42/],
];

/** Bentuk akhir yang harus ada di perintah yang benar-benar dijalankan. */
const PERINTAH_TERUKUR: readonly [alasan: string, pola: RegExp][] = [
  ["batas waktu dari dalam kontainer", /timeout -s KILL \d+ \.\/a\.out/],
  ["penanda sumber tidak terbaca", /cp [^;]*\|\| exit 40/],
  ["penanda kompilasi ditolak", /g\+\+ [^;]*\|\| exit 42/],
];

const WAJIB: readonly [alasan: string, pola: RegExp][] = [
  ...FLAG_PODMAN,
  ...BAGIAN_SUMBER,
];

describe("permukaan audit ada di satu berkas", () => {
  it("berisi setiap flag keamanan", () => {
    for (const [alasan, pola] of WAJIB) {
      expect(pola.test(sumber), `flag untuk ${alasan} tidak ada di soal.mjs`).toBe(true);
    }
  });

  it("hanya mengekspor empat fungsi dan dua konstanta", () => {
    // P7 spec: seluruh permukaan audit ada di satu berkas, jadi isi
    // ekspornya juga bagian dari yang diaudit. Fungsi kelima di sini berarti
    // ada pembentuk flag atau jalur lain di luar `bangunArgumenPodman`, dan
    // pertanyaannya tidak lagi bisa dijawab dengan membaca satu tempat.
    // Daftar ini persis antarmuka yang dipakai `server.mjs` (Task 4).
    const fungsi = [...sumber.matchAll(/export function (\w+)/g)].map((cocok) => cocok[1]);
    const konstanta = [...sumber.matchAll(/export const (\w+)/g)].map((cocok) => cocok[1]);
    expect(fungsi).toEqual([
      "namaBerkas",
      "bangunArgumenPodman",
      "petakanExitCode",
      "potongKeluaran",
    ]);
    expect(konstanta).toEqual(["IMAGE_KOMPILASI", "BATAS"]);
  });

  it("tidak punya fungsi pembangun flag kedua", () => {
    // Penghitung nama longgar pernah dipakai di sini dan ternyata tidak
    // menangkap apa pun: kata `bangunArgumenPodman` muncul dua kali di berkas
    // yang benar, semuanya di komentar dan di deklarasinya.
    const deklarasi = [...sumber.matchAll(/(?:export )?function (\w*Argumen\w*)/g)];
    expect(deklarasi).toHaveLength(1);
  });

  it("tidak menyimpan status batas lama yang sudah dibatalkan", () => {
    // `port.ts` sudah menggabungkan tiga batas jadi satu `batas_dilampaui`
    // karena dari luar kontainer ketiganya tidak bisa dibedakan. Runner tidak
    // boleh memunculkan kembali nama yang sudah dibatalkan: `petakanStatus`
    // tidak punya kasus untuk mereka, jadi judulnya di UI akan kosong.
    for (const mati of ["waktu_habis", "memori_habis", "proses_habis"]) {
      expect(sumber, `status ${mati} masih ada di soal.mjs`).not.toContain(mati);
    }
  });

  it("berisi mode spool yang wajib dan tidak bisa diuji lewat flag", () => {
    // `mkdtemp` membuat direktori 0700, dan kontainer berjalan sebagai uid
    // 65534 yang tidak bisa melewati direktori 0700 milik uid lain. Mount-nya
    // sendiri berhasil dan sufiks `:z` juga berhasil, tapi permission Unix
    // biasa tetap menolak. Test flag tidak pernah bisa melihat mode
    // filesystem, jadi persyaratannya harus tertulis di berkas ini supaya
    // runner yang memanggilnya tidak lupa.
    expect(sumber).toContain("0755");
    expect(sumber).toContain("0644");
  });
});

describe("test ini benar-benar dijalankan npm test", () => {
  it("cocok dengan pola include di vitest.config.mts", () => {
    // Berkas ini hidup sebagai `.test.ts` persis karena `include` itu sempit.
    // Kalau `include` berubah, test ini harus merah, bukan hilang diam-diam.
    const config = readFileSync(new URL("../../../vitest.config.mts", import.meta.url), "utf8");
    expect(config).toContain('"src/**/*.test.ts"');
    expect(ALAMAT_SOAL.pathname).toMatch(/\/src\/lib\/exec\/runner\/soal\.mjs$/);
  });
});

describe("argumen podman yang benar-benar dibangun", () => {
  it("menjalankan kontainer sekali pakai di /w", () => {
    // `--rm` itu wajib: tanpa itu setiap percobaan meninggalkan kontainer dan
    // image 1,41 GB di disk.
    expect(nyata.dasar).toContain("--rm");
    expect(nyata.dasar).toContain("--workdir=/w");
    expect(nyata.dasar).toContain(nyata.IMAGE_KOMPILASI);
    expect(nyata.dasar).toContain("sh");
    expect(nyata.dasar).toContain("-c");
  });

  it("meletakkan image setelah semua flag", () => {
    // Podman berhenti membaca opsi begitu image-nya muncul. Flag yang jatuh
    // setelah image bukan flag, dia jadi argumen untuk program, dan flag yang
    // hilang berarti tidak ada batas sama sekali tanpa error yang terlihat.
    const posisiImage = nyata.dasar.indexOf(nyata.IMAGE_KOMPILASI);
    for (const [alasan, pola] of FLAG_PODMAN) {
      const posisi = nyata.dasar.findIndex((argumen) => pola.test(argumen));
      if (posisi >= 0) {
        expect(posisi, `flag untuk ${alasan} muncul setelah image`).toBeLessThan(posisiImage);
      }
    }
  });

  it("memakai nilai batas yang tertulis di BATAS", () => {
    // Angkanya harus satu sumber, supaya tidak bisa berbeda antara yang
    // dijalankan dan yang dijanjikan ke peserta.
    expect(nilai("--pids-limit=", nyata.dasar)).toBe(`--pids-limit=${nyata.BATAS.proses}`);
    expect(nilai("--memory=", nyata.dasar)).toBe(`--memory=${nyata.BATAS.memori}`);
    expect(nilai("--cpus=", nyata.dasar)).toBe(`--cpus=${nyata.BATAS.cpu}`);
  });

  it("menempelkan direktori spool ke /src hanya-baca", () => {
    // Mount hanya-baca: kode peserta tidak boleh menulis berkas di host, dan
    // `--read-only` tidak menutup jalur mount.
    expect(nilai("--volume=", nyata.dasar)).toBe("--volume=/tmp/spool-uji:/src:ro,z");
  });

  it("tidak menulis volume lain selain /src", () => {
    // Satu-satunya bind mount ke host adalah spool. Bind mount kedua
    // berarti kebocoran isi mesin ke dalam program.
    expect(nyata.dasar.filter((argumen) => argumen.startsWith("--volume="))).toHaveLength(1);
  });

  it("membawa setiap flag keamanan ke perintah yang dijalankan", () => {
    // Inilah yang membuat assertion teks tidak bisa ditipu komentar: flag
    // harus benar-benar ada di array yang dikirim ke podman.
    for (const [alasan, pola] of FLAG_PODMAN) {
      const adaDiArgs = nyata.dasar.some((argumen) => pola.test(argumen));
      expect(adaDiArgs, `flag untuk ${alasan} tidak ada di argumen podman`).toBe(true);
    }
  });

  it("tidak menambah flag di luar daftar yang diaudit", () => {
    // `--privileged`, `--network=host`, atau `--pid=host` akan membatalkan
    // seluruh daftar di atas. Daftar ini diuji terhadap teks berkasnya, jadi
    // kemunculannya di mana pun di berkas itu ketahuan.
    for (const terlarang of [/--privileged/, /--network=host/, /--pid=host/, /--userns=host/]) {
      expect(sumber, `ada ${terlarang.source} di soal.mjs`).not.toMatch(terlarang);
    }
  });
});

describe("perintah di dalam kontainer", () => {
  it("memuat setiap bagian yang terukur", () => {
    // Diperiksa pada perintah yang benar-benar dirakit, bukan pada teks
    // berkasnya, karena di teks bentuknya masih template literal.
    for (const [alasan, pola] of PERINTAH_TERUKUR) {
      expect(pola.test(nyata.perintah), `bagian untuk ${alasan} tidak ada`).toBe(true);
    }
  });

  it("berisi tiga langkah yang dipisahkan titik koma", () => {
    // Tiga langkah: salin, kompilasi, jalankan. Kalau langkah digabung dengan
    // `&&`, penanda exit 40 dan 42 tidak pernah sampai ke luar.
    expect(nyata.perintah.split("; ")).toHaveLength(3);
  });

  it("berhenti dengan penanda sendiri saat sumber tidak terbaca", () => {
    // `|| exit 40` itu wajib: tanpa itu `g++` yang dipanggil lebih dulu dan
    // penandanya tertukar dengan galat kompilasi.
    expect(nyata.perintah).toContain("cp /src/main.cpp /w/main.cpp || exit 40");
  });

  it("berhenti dengan penanda sendiri saat g++ menolak", () => {
    // Penanda 42 yang jadi `gagal_kompilasi`, dan stderr GCC apa adanya yang
    // diteruskan ke peserta.
    expect(nyata.perintah).toContain("g++ -std=c++20 -O0 -o a.out main.cpp || exit 42");
  });

  it("mengompilasi berkas hasil salinan, bukan berkas di /src", () => {
    // Nama berkas yang dilihat GCC harus sama persis dengan yang peserta lihat
    // di editor-nya. Kalau tidak, nomor baris di pesan compiler tidak berguna
    // sebagai sinyal mengajar.
    expect(nyata.perintah).toContain("-o a.out main.cpp");
    expect(nyata.perintah).not.toMatch(/g\+\+[^;]*\/src\//);
  });

  it("membatasi waktu dari dalam kontainer, bukan dari podman", () => {
    // Batas yang bisa diamati. Dengan `--timeout` podman saja, kontainer yang
    // dibunuh mengembalikan 255 dengan stdout dan stderr kosong, jadi batas
    // waktu tidak bisa dibedakan dari kehabisan memori maupun fork bomb.
    expect(nyata.perintah).toContain(`timeout -s KILL ${nyata.BATAS.timeoutDetik} ./a.out`);
  });

  it("membawa nilai batas waktu yang diminta ke kedua tempat", () => {
    // Kalau pemanggil memperpendek atau memperpanjang batas, dua tempatnya
    // harus ikut, karena keduanya menentukan siapa yang lebih dulu mematikan.
    // Semuanya berada di dalam satu argumen, jadi diuji lewat perintah utuh.
    const perintahLain = nyata.tigaPuluh[nyata.tigaPuluh.length - 1];
    expect(perintahLain).toContain("timeout -s KILL 30 ./a.out");
    expect(perintahLain).toContain("exit 40");
    expect(perintahLain).toContain("exit 42");
  });

  it("tidak pernah mengarang perubahan pada penanda", () => {
    // Penanda 40 dan 42 adalah kontrak antara perintah ini dan
    // `petakanExitCode`. Mengubah salah satunya tanpa mengubah yang lain
    // membuat galat kompilasi dilaporkan sebagai program yang selesai.
    expect(nyata.perintah.match(/exit \d+/g)).toEqual(["exit 40", "exit 42"]);
  });

  it("menjalankan biner hasil kompilasi dari /w, bukan /tmp", () => {
    // `/tmp` sengaja noexec. Kalau binary-nya dipindah ke sana, sandbox tidak
    // berguna karena tidak ada biner yang bisa dieksekusi dari sana.
    expect(nyata.perintah).toContain("./a.out");
    expect(nyata.perintah).not.toContain("/tmp/a.out");
  });
});

describe("batas waktu di luar kontainer tetap ada", () => {
  it("memakai nilai bawaan yang terukur", () => {
    // 25 detik, yaitu 10 detik kontrak ditambah 15 detik ruang. Diukur pada
    // 2026-09-27: kompilasi C++ di dalam kontainer sudah memerlukan ~1,5
    // detik, jadi ruang 15 detik tidak pernah habis dalam eksekusi normal.
    expect(nilai("--timeout=", nyata.dasar)).toBe("--timeout=25");
    expect(nyata.BATAS.timeoutDetik).toBe(10);
  });

  it("lebih besar daripada batas di dalam kontainer", () => {
    // Dua batas, dan ini disengaja. Yang di dalam adalah kontrak: ia
    // menghasilkan kode yang bisa dibaca. Yang di luar hanya jaminan bahwa
    // kontainer yang macet tidak menahan slot antrean selamanya. Kalau yang
    // luar lebih kecil, ia yang mematikan lebih dulu dan batas di dalam tidak
    // pernah terekam.
    const dalam = Number(nyata.BATAS.timeoutDetik);
    const luar = Number(String(nilai("--timeout=", nyata.dasar)).replace("--timeout=", ""));
    expect(luar).toBeGreaterThan(dalam);
  });

  it("tetap lebih besar kalau pemanggil mengubah batas dalam", () => {
    const luarLuar = Number(
      String(nilai("--timeout=", nyata.tigaPuluh)).replace("--timeout=", ""),
    );
    expect(luarLuar).toBeGreaterThan(30);
  });
});

describe("petakanExitCode mengikuti angka yang diukur", () => {
  // Tujuh baris di bawah hasil pengukuran nyata pada 2026-09-27, bukan
  // tebakan: `podman run` dengan `timeout -s KILL` di dalam kontainer dan
  // `--timeout=25` sebagai cadangan.
  const TERUKUR: readonly [keluar: number, status: string][] = [
    [0, "sukses"],
    [40, "galat_runner"],
    [42, "gagal_kompilasi"],
    [137, "batas_dilampaui"],
    [139, "galat_program"],
  ];

  it("memetakan setiap kode yang terukur", () => {
    for (const [keluar, status] of TERUKUR) {
      expect(nyata.petakan[`koso-${keluar}`], `kode ${keluar}`).toBe(status);
    }
  });

  it("tidak membiarkan isi stderr mengubah status", () => {
    // 137 adalah batas yang aktif (waktu, memori, atau proses — ketiganya
    // tidak bisa dibedakan), 139 adalah program yang berhenti sendiri.
    expect(nyata.petakan["137-dikilled"]).toBe("batas_dilampaui");
    expect(nyata.petakan["139-core"]).toBe("galat_program");
    expect(nyata.petakan["42-diagnostik"]).toBe("gagal_kompilasi");
  });

  it("memetakan kode pilihan program menjadi sukses, bukan galat runner", () => {
    // Ini yang paling mudah salah dan paling merusak. Program peserta boleh
    // mengembalikan kode apa pun; `return 3` adalah eksekusi yang berhasil.
    // Melaporkan itu sebagai "layanan eksekusi tidak tersedia" mengirim
    // peserta ke tempat yang salah.
    //
    // Perhatikan yang TIDAK ada di daftar ini: 125, 126, 127, dan 255. Empat
    // kode itu bukan pilihan program — semuanya milik podman, dan test
    // berikutnya mengunci keputusan untuk masing-masing. 100 dan 200 ada di
    // sini untuk membuktikan aturan ini bukan sekadar "di bawah 128": kode
    // peserta boleh berada di mana saja, termasuk di atas batas atas rentang
    // sinyal.
    for (const keluar of [1, 2, 3, 7, 100, 124, 200]) {
      expect(nyata.petakan[`koso-${keluar}`], `kode ${keluar}`).toBe("sukses");
    }
    expect(nyata.petakan["3-bukan-galat-runner"]).toBe("sukses");
  });

  it("memetakan kode podman ke batas, bukan ke sukses", () => {
    // Ini pasangan dari test di atas, dan kalau yang ini hilang, program yang
    // menggantung sampai cadangan menyala dilaporkan ke peserta sebagai
    // "selesai tanpa galat". Kebohongan yang sama dengan yang di atas, hanya
    // arahnya berlawanan.
    expect(nyata.petakan["koso-255"]).toBe("batas_dilampaui");
  });

  it("memetakan 125, 126, dan 127 ke galat runner", () => {
    // Ketiganya berarti kita yang salah, bukan program peserta: baris perintah
    // podman salah atau image bermasalah (125), perintah tidak bisa dijalankan
    // (126), atau tidak ditemukan (127). Untuk `sh -c` yang dipakai di sini,
    // ketiganya berarti image rusak.
    //
    // `galat_runner` dan bukan `batas_dilampaui`, karena tidak ada batas yang
    // meletus dan program tidak sempat jalan. Melaporkannya sebagai "program
    // melampaui batas" akan menyalahkan peserta atas kegagalan image yang bukan
    // miliknya.
    for (const keluar of [125, 126, 127]) {
      expect(nyata.petakan[`koso-${keluar}`], `kode ${keluar}`).toBe("galat_runner");
    }
  });

  it("tidak menganggap tidak adanya kode keluar sebagai sukses", () => {
    // `null` bukan kode yang dipilih program, melainkan "podman tidak sempat
    // menghasilkan kode": binar podman hilang, PATH salah, atau prosesnya
    // dibunuh dari luar. Peristiwanya terjadi sebelum program peserta jalan
    // sama sekali, jadi melaporkannya `sukses` berarti peserta diberi tahu
    // "selesai tanpa galat" padahal tidak ada yang pernah dijalankan.
    //
    // Ini bukan `batas_dilampaui` juga: tidak ada batas yang meletus, dan
    // menyalahkan program peserta atas runner yang salah konfigurasi
    // mengarahkan orang ke tempat yang salah.
    //
    // `server.mjs` memetakan bentuk `null` yang ia hasilkan sendiri sebelum
    // memanggil fungsi ini, jadi tanpa kasus di sini pemetaan itu yang benar
    // sementara fungsi diam-diam salah untuk pemanggil berikutnya.
    expect(nyata.petakan["kosong"]).toBe("galat_runner");
    // Keluaran yang kebetulan ada tidak mengubah penilaiannya: program belum
    // sempat jalan, jadi isi keluaran bukan miliknya.
    expect(nyata.petakan["kosong-pakai-keluaran"]).toBe("galat_runner");
  });

  it("memetakan 134 ke galat_program, karena itu exception yang tidak tertangkap", () => {
    // 134 adalah SIGABRT. `std::terminate` memanggil `abort()`, jadi program
    // peserta yang melempar exception tanpa `catch` berakhir di sini. Diukur
    // 2026-09-27 bersama `abort()` dan `assert` yang gagal.
    //
    // Ini yang paling penting: pelajaran exception adalah pelajaran C++
    // pertama yang biasanya gagal ditulis peserta, jadi melaporkan kelas
    // kesalahan ini sebagai "selesai tanpa galat" merusak pelajaran yang
    // sedang dibangun, bukan hanya satu kasus tepi.
    expect(nyata.petakan["koso-134"]).toBe("galat_program");
  });

  it("menjaga rentang sinyal, bukan hanya satu nilai", () => {
    // Kalau pemetaannya `exitCode === 134`, test di atas tetap hijau. Yang
    // menahan penyempitan itu test ini: ia memeriksa nilai di dalam rentang
    // yang bukan 134, dan kedua ujungnya.
    for (const keluar of [128, 132, 136, 139, 160, 165]) {
      expect(nyata.petakan[`koso-${keluar}`], `kode ${keluar}`).toBe("galat_program");
    }
  });

  it("tidak memindahkan 137 ke galat_program, karena itu batas kita", () => {
    // 137 ada DI DALAM rentang sinyal, jadi pengecualiannya harus diuji
    // sendiri. Tanpa ini, kesalahan "137 itu program yang crash" akan lolos
    // karena rentangnya sendiri sudah benar.
    expect(nyata.petakan["koso-137"]).toBe("batas_dilampaui");
  });

  it("tidak menganggap kode di luar rentang sebagai sinyal", () => {
    // 127 adalah milik podman, dan 166 sudah melewati batas atas rentang
    // `128 + N`. Keduanya harus tetap jatuh ke keputusan masing-masing.
    expect(nyata.petakan["koso-127"]).toBe("galat_runner");
    expect(nyata.petakan["koso-166"]).toBe("sukses");
  });

  it("tidak memakai rentang yang menelan kode peserta", () => {
    // Godaan shortcut-nya nyata: "kalau 125 ke atas, itu status kita" —
    // tapi kode 126 sampai 255 semuanya bisa dipilih program peserta sendiri,
    // dan `return 3` yang paling sering terjadi. Test ini menahan ketiga
    // belah batas itu sekaligus: 137 (batas aktif), 255 (cadangan podman),
    // dan 139 (program berhenti sendiri).
    expect(nyata.petakan["koso-137"]).toBe("batas_dilampaui");
    expect(nyata.petakan["koso-255"]).toBe("batas_dilampaui");
    expect(nyata.petakan["koso-139"]).toBe("galat_program");
  });

  it("tidak pernah mengembalikan status di luar kosakata port", () => {
    // `StatusJalankan` di `port.ts` adalah union tertutup. Status yang tidak
    // ada di sana tidak punya judul di `petakanStatus`, jadi UI akan
    // menampilkan kotak kosong.
    const sah = [
      "sukses",
      "gagal_kompilasi",
      "batas_dilampaui",
      "galat_program",
      "ditolak",
      "galat_runner",
    ];
    for (const [label, status] of Object.entries(nyata.petakan)) {
      expect(sah, `status untuk ${label}`).toContain(status);
    }
  });

  it("membedakan galat kompilasi dari program yang berjalan lalu keluar", () => {
    // Yang membedakan bukan isi stderr, melainkan kode 42 dari penanda. GCC
    // yang menolak berarti program belum pernah berjalan sekali pun.
    expect(nyata.petakan["koso-42"]).toBe("gagal_kompilasi");
    expect(nyata.petakan["koso-7"]).toBe("sukses");
  });

  it("tidak pernah membiarkan isi stderr mengubah status", () => {
    // Ini yang membuat pesan 134 sampai ke peserta utuh. Kalau status bisa
    // bergantung pada isi stderr, maka menebak-nebak teks GCC atau
    // GNU timeout bisa menimpa stderr, dan `terminate called after throwing
    // an instance of 'int'` — yang memberi tahu peserta apa yang sebenarnya
    // salah — bisa hilang. Statusnya dihitung dari exit code saja; keluarannya
    // hanya diteruskan.
    const diagnostik = [
      "terminate called after throwing an instance of 'int'",
      "a.out: main.cpp:2: int main(): Assertion `1==2' failed.",
      "timeout: the monitored command dumped core",
      "Killed",
    ];
    for (const isi of diagnostik) {
      expect(
        nyata.petakan["134-dengan-" + isi],
        `isi stderr "${isi}"`,
      ).toBe("galat_program");
    }
  });

  it("membawa kode keluar apa adanya untuk diagnosis", () => {
    // Angka asli tetap ada di `HasilJalankan.exitCode`. Status untuk peserta,
    // angka untuk orang yang menelusuri. Yang diuji di sini statusnya, bukan
    // angkanya: `petakanExitCode` tidak punya jalur yang mengubah atau
    // membulatkan `exitCode`.
    expect(nyata.petakan["koso-7"]).toBe("sukses");
    expect(nyata.petakan["koso-125"]).toBe("galat_runner");
  });
});

describe("namaBerkas", () => {
  it("memberi nama sumber untuk cpp", () => {
    expect(nyata.namaCpp).toBe("main.cpp");
  });

  it("melempar untuk bahasa yang tidak dikenal", () => {
    // Bahasa adalah union tertutup di `@/types/course`. Melempar lebih baik
    // daripada mengembalikan `undefined` yang jadi `/src/undefined` di baris
    // perintah, lalu muncul sebagai pesan kompilasi yang menyesatkan.
    expect(nyata.namaRust).toMatch(/tidak dikenal/i);
  });

  it("mencegah bahasa tak dikenal mencapai podman", () => {
    // `bangunArgumenPodman` memanggil `namaBerkas`, jadi tambahan apa pun
    // setelah pemanggilan itu berarti jalur bypass.
    expect(nyata.argumenRust).toMatch(/tidak dikenal/i);
  });
});

describe("potongKeluaran", () => {
  it("tidak menyentuh keluaran yang sudah di bawah batas", () => {
    expect(nyata.potong[0]).toBe("halo");
  });

  it("memotong dari depan, bukan dari belakang", () => {
    // Pesan compiler dibaca dari baris pertama. Potongan dari belakang akan
    // membuang `main.cpp:1:14: error:` dan membuat `gagal_kompilasi` tanpa
    // sinyal mengajar sama sekali.
    expect(nyata.potong[1].startsWith("0123456789")).toBe(true);
    expect(nyata.potong[1].length).toBeGreaterThan(10);
  });

  it("memberi tahu bahwa keluaran dipotong", () => {
    // Pemotongan diam-diam membuat program yang mencetak banyak sekali
    // terlihat selesai normal.
    expect(nyata.potong[1]).toMatch(/dipotong/);
  });

  it("tidak memotong string kosong", () => {
    expect(nyata.potong[2]).toBe("");
  });
});

describe("BATAS", () => {
  it("sesuai dengan angka yang dijanjikan di port.ts", () => {
    // `petakanStatus("batas_dilampaui")` menyebut 10 detik, 512 MB, dan 64
    // proses. Kalau angka di sini berubah tanpa mengubah copy itu, peserta
    // dapat amplop yang tidak berlaku.
    expect(nyata.BATAS.timeoutDetik).toBe(10);
    expect(nyata.BATAS.memori).toBe("512m");
    expect(nyata.BATAS.proses).toBe(64);
  });

  it("membatasi ukuran masukan sebelum mengompilasi", () => {
    // Batas ini ditegakkan di runner sebelum podman dipanggil, karena kode
    // dua ratus ribu baris lebih mahal ditolak daripada dikirim.
    for (const kunci of ["baris", "karakter", "stdinKarakter", "keluaranKarakter"]) {
      expect(Number(nyata.BATAS[kunci]), `BATAS.${kunci} bukan angka positif`).toBeGreaterThan(0);
    }
    expect(Number(nyata.BATAS.karakter)).toBeGreaterThan(Number(nyata.BATAS.stdinKarakter));
  });
});

describe("test ini tidak bisa kosong", () => {
  it("setiap assertion flag benar-benar peka", () => {
    // Anti-vaku. Kalau predicate-nya tidak bisa gagal, test ini hanya hiasan.
    // Yang dibuktikan di sini: menghapus flag dari berkas membuat predicate
    // menjadi false, jadi assertion-nya benar-benar memeriksa keberadaan
    // flag itu dan bukan sesuatu yang lain.
    for (const [alasan, pola] of WAJIB) {
      expect(pola.test(sumber), `flag untuk ${alasan} tidak ada sejak awal`).toBe(true);
      const tanpa = sumber.replace(new RegExp(pola.source, "g"), "");
      expect(
        new RegExp(pola.source).test(tanpa),
        `predicate untuk ${alasan} tetap hijau setelah flag dihapus — assertion-nya vaku`,
      ).toBe(false);
    }
  });

  it("argumen yang dijalankan benar-benar berasal dari soal.mjs", () => {
    // Penjaga terhadap kelas kegagalan yang paling mahal: test hijau karena
    // membaca berkas yang berbeda dari yang dijalankan runner. Alamat yang
    // diproses Node di atas harus menunjuk `runner/soal.mjs` yang sama dengan
    // yang dibaca di bagian atas berkas ini.
    const isi = nyata.dasar.join(" ");
    expect(nyata.dasar.length).toBeGreaterThan(10);
    expect(isi).toContain(nyata.IMAGE_KOMPILASI);
    expect(nyata.perintah).toContain("main.cpp");
  });
});
