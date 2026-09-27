/**
 * Implementasi `PortWorkspace` di atas manajer terpisah — **server-only**.
 *
 * Ini pasangan `@/lib/exec/proses-lokal` untuk ruang kerja. Perannya sengaja
 * tipis dengan alasan yang sama: ia **tidak pernah** menjalankan podman dan
 * tidak pernah menyusun argumen kontainer. Ia meneruskan permintaan lewat HTTP
 * ke loopback lalu memetakan jawabannya. Seluruh permukaan audit sandbox milik
 * `manager/soal.mjs`, dan kalau berkas ini mulai menyusun baris perintah
 * sendiri, pertanyaan "apa yang boleh dilakukan kode peserta" tidak lagi bisa
 * dijawab dengan membaca satu berkas.
 *
 * Modul ini membaca `CAREEVO_WORKSPACE_SECRET`, jadi ia hanya boleh diimpor
 * dari server. Komponen klien mengimpor `./port` yang murni.
 *
 * Repo ini **tidak** memakai paket `server-only` (lihat catatan yang sama di
 * `proses-lokal.ts`), jadi batas itu ditandai lewat komentar ini.
 */

import type {
  KeadaanWorkspace,
  MintaWorkspace,
  PortWorkspace,
  StatusWorkspace,
} from "./port";

/** Loopback saja, dan itu bukan sekadar bawaan yang nyaman. */
const HOST_BAWAAN = "127.0.0.1";
const PORT_BAWAAN = "8022";

/**
 * Plafon waktu menunggu manajer, dalam milidetik.
 *
 * Lebih longgar dari runner: `mulai` pertama kali harus **mengunduh image**
 * kalau image-nya belum ada di mesin ini, dan itu bisa menit. Angka ini bukan
 * batas yang dilihat peserta, melainkan berapa lama route Next boleh menunggu
 * tanpa menjawab. Manajer sendiri punya plafon podman yang lebih ketat.
 */
const TIMEOUT_BAWAAN_MS = 150_000;

/**
 * Kosakata status di sisi kawat.
 *
 * Daftar kedua yang harus disimpan sinkron dengan union `StatusWorkspace` di
 * `./port`. Duplikasi itu disengaja dan alasannya sama dengan `KOSAKATA` di
 * `proses-lokal.ts`: yang dibeli adalah kegagalan yang menutup — status baru
 * yang lupa ditambahkan di sini ditolak dan menjadi `galat_manajer`, bukan
 * diteruskan sebagai status asing yang tidak punya judul di
 * `petakanWorkspace` sehingga UI menampilkan kotak kosong.
 */
const KOSAKATA: readonly StatusWorkspace[] = [
  "ok",
  "penuh",
  "terkunci",
  "tidak_sah",
  "galat_manajer",
];

function kosong(nilai: string | undefined): nilai is undefined | "" {
  return nilai === undefined || nilai.trim() === "";
}

/**
 * Hanya alamat loopback yang boleh dipakai.
 *
 * Manajer ini bisa **menjalankan kontainer**. Siapa pun yang bisa menjangkau
 * port-nya bisa membuat ruang kerja atas namanya sendiri, dan `--cap-drop=all`
 * di dalam kontainer tidak menahan itu: yang dilindungi sandbox adalah peserta
 * dari dirinya sendiri, bukan mesin ini dari orang luar.
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
 * Alasan yang sama dengan `batasTungguMs` di `proses-lokal.ts`: `setTimeout`
 * dengan `NaN` atau angka negatif berarti "bunyikan sekarang", jadi satu env
 * yang salah ketik membuat **setiap** permintaan menjadi `galat_manajer`
 * dengan sebab yang tidak terlihat dari mana pun.
 */
function batasTungguMs(nilai: string | undefined): number {
  if (kosong(nilai)) return TIMEOUT_BAWAAN_MS;
  const angka = Number(nilai);
  if (!Number.isFinite(angka) || angka <= 0) return TIMEOUT_BAWAAN_MS;
  return angka;
}

/**
 * Bentuk keadaan dari badan manajer, atau `null` bila tidak bisa dipercaya.
 *
 * Yang dikembalikan hanya **field yang dikenal**; field lain dibuang. Itu
 * bukan kebersihan belaka — kelas kebocoran yang sama dengan yang ditemukan di
 * runner (galat internal masuk ke respons 200) dicegah satu lapis di atas,
 * bukan dengan berharap manajer tidak pernah mengirim begini.
 */
function keadaanDariBadan(badan: unknown): KeadaanWorkspace | null {
  if (badan === null || typeof badan !== "object" || Array.isArray(badan)) return null;
  const kandidat = badan as Record<string, unknown>;

  // Bentuk balasan manajer: `{ ok, hidup, url?, alasan? }`.
  if (kandidat.ok !== true) return null;

  const hidup = kandidat.hidup === true;
  const url = kandidat.url;

  // `url` yang ada tetapi bukan teks adalah badan yang tidak bisa dipercaya.
  // `url` yang tidak ada adalah keadaan yang sah: ruang kerja mati tidak punya
  // URL, dan `status()` mengembalikannya begitu.
  if (url !== undefined && typeof url !== "string") return null;

  return {
    status: "ok",
    hidup,
    ...(typeof url === "string" && url.length > 0 ? { url } : {}),
  };
}

/** Balasan penolakan manajer: `{ ok: false, alasan }`. */
function statusDariPenolakan(badan: unknown): StatusWorkspace | null {
  if (badan === null || typeof badan !== "object" || Array.isArray(badan)) return null;
  const kandidat = badan as Record<string, unknown>;
  if (kandidat.ok !== false) return null;

  const alasan = kandidat.alasan;
  if (typeof alasan !== "string") return null;
  return KOSAKATA.includes(alasan as StatusWorkspace) ? (alasan as StatusWorkspace) : null;
}

export class ProsesManajer implements PortWorkspace {
  private readonly bawaan: typeof fetch;
  private readonly host: string;
  private readonly port: string;

  /**
   * `fetch` dan alamatnya disuntikkan, bukan diambil dari global — alasan yang
   * sama dengan `ProsesLokal`: `fetch` global tidak bisa diganti tanpa membajak
   * seluruh proses test, dan alamat yang tertanam di dalam kelas tidak bisa
   * diarahkan ke manajer tiruan.
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

  mulai(minta: MintaWorkspace): Promise<KeadaanWorkspace> {
    return this.panggil("/mulai", minta);
  }

  status(minta: MintaWorkspace): Promise<KeadaanWorkspace> {
    return this.panggil("/status", minta);
  }

  berhenti(minta: MintaWorkspace): Promise<KeadaanWorkspace> {
    return this.panggil("/berhenti", minta);
  }

  /**
   * Daftar berkas, atau `null`.
   *
   * Jalur ini **tidak** memakai `panggil` karena bentuk balasannya berbeda:
   * `panggil` memetakan `KeadaanWorkspace`, sedangkan di sini yang dibawa
   * adalah teks `find`. Menyatukannya akan menuntut `panggil` mengembalikan
   * union yang setiap pemanggilnya harus bedakan — dan pemanggil `mulai`
   * tidak pernah peduli pada daftar berkas.
   */
  async daftarBerkas(minta: MintaWorkspace): Promise<string | null> {
    const rahasia = process.env.CAREEVO_WORKSPACE_SECRET;
    if (kosong(rahasia)) return null;
    if (!loopback(this.host)) return null;

    const kendali = new AbortController();
    const timer = setTimeout(
      () => kendali.abort(),
      batasTungguMs(process.env.CAREEVO_WORKSPACE_TIMEOUT_MS),
    );

    try {
      const balasan = await this.bawaan(`http://${this.host}:${this.port}/berkas`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-workspace-secret": rahasia },
        body: JSON.stringify(minta),
        signal: kendali.signal,
        cache: "no-store",
      });
      if (!balasan.ok) return null;

      const badan: unknown = await balasan.json().catch(() => null);
      if (badan === null || typeof badan !== "object" || Array.isArray(badan)) return null;
      const kandidat = badan as Record<string, unknown>;
      if (kandidat.ok !== true) return null;
      // Hanya `mentah` yang dibaca; field lain pada badan dibuang — alasan yang
      // sama dengan `hasilDariBadan`: field yang tidak dikenal bisa membawa
      // detail internal mesin ini.
      return typeof kandidat.mentah === "string" ? kandidat.mentah : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Satu jalur untuk ketiga aksi.
   *
   * Ketiganya berbicara ke bentuk yang sama — rahasia yang sama, badan yang
   * sama, pemetaan balasan yang sama — jadi memisahkannya menjadi tiga salinan
   * berarti tiga tempat yang bisa menyimpang. Yang membedakan hanya path.
   */
  private async panggil(path: string, minta: MintaWorkspace): Promise<KeadaanWorkspace> {
    // Dibaca **saat pemanggilan**, bukan sekali saat modul dimuat. Env di Next
    // tidak dijamin sudah ada ketika modul server pertama kali dimuat, dan
    // `vi.stubEnv` pada test menulis ke `process.env` setelah impor selesai.
    const rahasia = process.env.CAREEVO_WORKSPACE_SECRET;

    // Fail-closed, dan **sebelum** fetch apa pun. Tanpa rahasia, permintaan
    // tanpa autentikasi akan sampai ke manajer — dan manajer itu bisa
    // menjalankan kontainer di mesin ini.
    if (kosong(rahasia)) return { status: "galat_manajer", hidup: false };

    // Env yang salah konfigurasi tidak boleh mengubah siapa saja yang bisa
    // menjalankan kontainer. Pesan galatnya tidak menyebut host yang ditolak,
    // karena yang sampai ke peserta hanyalah `petakanWorkspace`.
    if (!loopback(this.host)) return { status: "galat_manajer", hidup: false };

    const kendali = new AbortController();
    const batasMs = batasTungguMs(process.env.CAREEVO_WORKSPACE_TIMEOUT_MS);
    const timer = setTimeout(() => kendali.abort(), batasMs);

    try {
      const balasan = await this.bawaan(`http://${this.host}:${this.port}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workspace-secret": rahasia,
        },
        body: JSON.stringify(minta),
        signal: kendali.signal,
        // Permintaan ini bisa menyalakan kontainer. Ia tidak boleh pernah
        // dilayani dari cache atau deduplikasi: dua klik "Siapkan" adalah dua
        // permintaan, bukan satu jawaban yang dibagikan.
        cache: "no-store",
      });

      // 401 berarti rahasia salah, dan itu keadaan konfigurasi — bukan keadaan
      // peserta. Dipetakan ke `galat_manajer` supaya peserta tidak diberi tahu
      // apa pun tentang konfigurasi server.
      if (!balasan.ok) return { status: "galat_manajer", hidup: false };

      let badan: unknown;
      try {
        badan = await balasan.json();
      } catch {
        return { status: "galat_manajer", hidup: false };
      }

      const sukses = keadaanDariBadan(badan);
      if (sukses) return sukses;

      const ditolak = statusDariPenolakan(badan);
      if (ditolak) return { status: ditolak, hidup: false };

      return { status: "galat_manajer", hidup: false };
    } catch {
      // Manajer mati, koneksi ditolak, atau timeout yang membuat `abort`
      // menyala. Semuanya satu peristiwa bagi peserta — layanan tidak
      // tersedia — dan sebab sebenarnya tidak pernah sampai ke peramban.
      return { status: "galat_manajer", hidup: false };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Instansi tunggal untuk konsumen server.
 *
 * Dibuat saat modul dimuat, tapi **tidak** membaca rahasia saat itu juga —
 * hanya `panggil` yang membacanya. Satu instans cukup karena kelasnya tanpa
 * keadaan.
 */
export const prosesManajer = new ProsesManajer();
