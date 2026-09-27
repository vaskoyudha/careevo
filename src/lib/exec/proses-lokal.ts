/**
 * Implementasi `PortJalankan` di atas runner terpisah — **server-only**.
 *
 * Modul ini membaca `CAREEVO_RUNNER_SECRET`, jadi ia hanya boleh diimpor dari
 * server (route handler, server action, server component). Komponen klien
 * mengimpor `./port` yang murni, bukan berkas ini — lihat catatan di
 * `src/lib/exec/index.ts` dan `./port`.
 *
 * Repo ini **tidak** memakai paket `server-only`, jadi batas itu ditandai lewat
 * komentar ini, sama seperti `@/lib/rate-limit/index.ts`,
 * `@/lib/learning/session.ts`, dan `@/lib/performa/store.ts`. Menulis
 * `import "server-only"` di sini justru membuat berkas ini mustahil diuji:
 * paket itu tidak ada di `package.json`, dan vitest gagal memuat modul apa pun
 * yang mengimpornya.
 *
 * Peran modul ini sengaja tipis. Ia **tidak** pernah mengompilasi dan tidak
 * pernah menjalankan biner: ia meneruskan sumber lewat HTTP ke loopback lalu
 * memetakan jawabannya. Seluruh permukaan audit sandbox milik
 * `runner/soal.mjs` (P3 spec), dan kalau regu ini mulai menyusun baris
 * perintah sendiri, pertanyaan "apa yang boleh dilakukan kode peserta" tidak
 * lagi bisa dijawab dengan membaca satu berkas.
 */

import type { HasilJalankan, MintaJalankan, PortJalankan, StatusJalankan } from "./port";
import { hasilGagal } from "./port";

/** Loopback saja, dan itu bukan sekadar bawaan yang nyaman. */
const HOST_BAWAAN = "127.0.0.1";
const PORT_BAWAAN = "8021";

/**
 * Plafon waktu menunggu runner, dalam milidetik.
 *
 * Ini **bukan** batas layanan yang dilihat peserta. Batas itu milik `BATAS` di
 * `runner/soal.mjs`: 10 detik di dalam kontainer plus cadangan 15 detik podman.
 * Angka di sini hanya menjawab pertanyaan lain, yaitu berapa lama route Next
 * boleh menunggu tanpa menjawab. Tanpa plafon, request yang menggantung menahan
 * koneksi dan satu slot di server, dan peserta mendapat "sedang tidak
 * tersedia" jauh lebih lambat — yang jauh lebih sulit dijelaskan daripada
 * jawaban yang cepat.
 *
 * Sisa ruangnya sengaja longgar: antrean runner lebarnya tiga eksekusi, jadi
 * request ketiga memang menunggu giliran. Memotong antrean di sini akan
 * melaporkan antrean sebagai kegagalan layanan, padahal itu perilaku yang
 * sudah direncanakan.
 */
const TIMEOUT_BAWAAN_MS = 30_000;

/**
 * Kosakata status di sisi kawat.
 *
 * Daftar kedua yang harus disimpan sinkron dengan union `StatusJalankan` di
 * `./port`. Duplikasi itu disengaja dan kecil: `./port` murni dan tidak boleh
 * mengimpor apa pun, dan menambah konstanta runtime di sana berarti mengubah
 * berkas yang sudah ditinjau dan yang diimpor komponen klien. Yang dibeli
 * duplikasi ini adalah kegagalan yang menutup — kalau suatu hari status baru
 * masuk union tetapi lupa ke sini, jawaban runner **ditolak** dan menjadi
 * `galat_runner`, bukan diteruskan sebagai status asing yang tidak punya judul
 * di `petakanStatus` sehingga UI menampilkan kotak kosong.
 */
const KOSAKATA: readonly StatusJalankan[] = [
  "sukses",
  "gagal_kompilasi",
  "batas_dilampaui",
  "galat_program",
  "ditolak",
  "galat_runner",
];

/** Apakah nilai env dianggap tidak diisi. */
function kosong(nilai: string | undefined): nilai is undefined | "" {
  return nilai === undefined || nilai.trim() === "";
}

/**
 * Hanya alamat loopback yang boleh dipakai.
 *
 * Runner yang mendengarkan di `0.0.0.0` berarti siapa pun yang bisa menjangkau
 * mesin ini bisa menjalankan kode di dalamnya, dan `--cap-drop=all` di dalam
 * kontainer tidak menahan itu: yang dilindungi sandbox adalah program peserta
 * dari dirinya sendiri, bukan mesin ini dari orang luar (P2 spec).
 */
function loopback(host: string): boolean {
  return (
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]" ||
    host === "0:0:0:0:0:0:0:1"
  );
}

/**
 * Ambil plafon waktu dari env, atau bawaan bila nilainya tidak dipercaya.
 *
 * `setTimeout` dengan `NaN` atau angka negatif berarti "bunyikan sekarang",
 * jadi tanpa penjagaan ini satu env yang salah ketik membuat **setiap**
 * permintaan menjadi `galat_runner` dengan sebab yang tidak terlihat dari mana
 * pun. Yang dipulihkan adalah bawaannya, bukan\e6 diam-diam: layanan boleh
 * lambat, tapi tidak boleh buta.
 */
function batasTungguMs(nilai: string | undefined): number {
  if (kosong(nilai)) return TIMEOUT_BAWAAN_MS;
  const angka = Number(nilai);
  if (!Number.isFinite(angka) || angka <= 0) return TIMEOUT_BAWAAN_MS;
  return angka;
}

/**
 * Bentuk hasil dari badan runner, atau `null` bila tidak bisa dipercaya.
 *
 * Yang dikembalikan hanya **lima field yang dikenal**; field lain pada badan
 * dibuang. Itu bukan kebersihan belaka. Task 4 menemukan kelas kebocoran yang
 * persis seperti ini: galat internal runner pernah masuk ke dalam respons 200,
 * sehingga field `errno`, `code`, `syscall`, dan `path` milik Node ikut keluar
 * ke peramban — peramban menerima path internal mesin ini dari endpoint yang
 * kononnya cuma mengembalikan status. Memilih field secara eksplisit membuat
 * kelas itu mustahil terjadi satu lapis di atas, bukan bergantung pada runner
 * tidak pernah mengirim begini.
 */
function hasilDariBadan(badan: unknown): HasilJalankan | null {
  if (badan === null || typeof badan !== "object" || Array.isArray(badan)) return null;
  const kandidat = badan as Record<string, unknown>;

  const status = kandidat.status;
  if (typeof status !== "string" || !KOSAKATA.includes(status as StatusJalankan)) return null;

  const stdout = kandidat.stdout;
  const stderr = kandidat.stderr;
  if (typeof stdout !== "string" || typeof stderr !== "string") return null;

  const exitCode = kandidat.exitCode;
  if (exitCode !== null && (typeof exitCode !== "number" || !Number.isFinite(exitCode))) {
    return null;
  }

  const durasiMs = kandidat.durasiMs;
  if (typeof durasiMs !== "number" || !Number.isFinite(durasiMs)) return null;

  return {
    status: status as StatusJalankan,
    stdout,
    stderr,
    exitCode: exitCode as number | null,
    durasiMs,
  };
}

export class ProsesLokal implements PortJalankan {
  private readonly bawaan: typeof fetch;
  private readonly host: string;
  private readonly port: string;

  /**
   * `fetch` dan alamatnya disuntikkan, bukan diambil dari global.
   *
   * Dua alasan, dan keduanya soal pengujian: `fetch` global tidak bisa diganti
   * tanpa membajak seluruh proses test, dan alamat yang tertanam di dalam
   * kelas tidak bisa diarahkan ke runner tiruan. Bawaannya tetap nilai
   * produksi.
   */
  constructor(
    bawaan: typeof fetch = fetch,
    host: string = HOST_BAWAAN,
    port: string = PORT_BAWAAN,
  ) {
    this.bawaan = bawaan;
    this.host = host;
    this.port = port;
  }

  async jalankan(minta: MintaJalankan): Promise<HasilJalankan> {
    // Dibaca **saat pemanggilan**, bukan sekali saat modul dimuat. Env di Next
    // tidak dijamin sudah ada ketika modul server pertama kali dimuat, dan
    // `vi.stubEnv` pada test menulis ke `process.env` setelah impor selesai.
    // Snapshot di tingkat modul membuat keduanya diam-diam salah: di
    // development env-nya bisa belum terpasang, dan di test stubnya diabaikan.
    const rahasia = process.env.CAREEVO_RUNNER_SECRET;

    // Fail-closed, dan **sebelum** fetch apa pun. Tanpa rahasia, permintaan
    // tanpa autentikasi akan sampai ke runner. Yang lebih buruk, mengirim
    // `""` sebagai header persis sama dengan runner yang dikonfigurasi dengan
    // rahasia kosong, jadi "gagal tertutup" pun tidak terjadi.
    if (kosong(rahasia)) return hasilGagal("galat_runner");

    // Env yang salah konfigurasi tidak boleh mengubah siapa saja yang bisa
    // menjalankan kode. Menolak lebih baik daripada meneruskan ke host yang
    // tidak diaudit. Pesan galatnya sengaja tidak menyebut host yang ditolak,
    // karena yang sampai ke peserta hanyalah `petakanStatus("galat_runner")`.
    if (!loopback(this.host)) return hasilGagal("galat_runner");

    const kendali = new AbortController();
    const batasMs = batasTungguMs(process.env.CAREEVO_RUNNER_TIMEOUT_MS);
    const timer = setTimeout(() => kendali.abort(), batasMs);

    try {
      const balasan = await this.bawaan(`http://${this.host}:${this.port}/jalankan`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-runner-secret": rahasia,
        },
        body: JSON.stringify(minta),
        signal: kendali.signal,
        // Panggilan ini menjalankan biner di mesin ini, jadi tidak boleh pernah
        // dilayani dari cache atau deduplikasi: dua klik "Jalankan" adalah dua
        // eksekusi, bukan satu jawaban yang dibagikan.
        cache: "no-store",
      });

      // Status HTTP yang bukan 2xx berarti runner menolak: rahasia salah, badan
      // terlalu besar, atau endpoint-nya berubah. Isi badannya **tidak**
      // diteruskan — pesan runner ditulis untuk pemanggil dan tidak menambah
      // apa pun bagi peserta.
      if (!balasan.ok) return hasilGagal("galat_runner");

      let badan: unknown;
      try {
        badan = await balasan.json();
      } catch {
        // Balasan yang bukan JSON: runner berada pada keadaan yang tidak kita
        // kenal, dan apa pun isinya tidak akan kita teruskan.
        return hasilGagal("galat_runner");
      }

      return hasilDariBadan(badan) ?? hasilGagal("galat_runner");
    } catch {
      // Runner mati, koneksi ditolak, atau timeout yang membuat `abort`
      // menyala. Semuanya satu peristiwa bagi peserta — layanan tidak
      // tersedia — dan sebab sebenarnya (ECONNREFUSED, jalur spool, stack
      // trace) tidak pernah sampai ke peramban. Detail aslinya tetap ada di
      // log runner.
      return hasilGagal("galat_runner");
    } finally {
      // Wajib: tanpa ini setiap permintaan menahan handle timer-nya sampai
      // batas waktu habis, dan `next dev` akan menumpuknya terus.
      clearTimeout(timer);
    }
  }
}

/**
 * Instansi tunggal untuk konsumen server.
 *
 * Dibuat saat modul dimuat, tapi **tidak** membaca rahasia saat itu juga —
 * hanya `jalankan` yang membacanya. Satu instans cukup karena kelasnya tanpa
 * keadaan.
 */
export const prosesLokal = new ProsesLokal();
