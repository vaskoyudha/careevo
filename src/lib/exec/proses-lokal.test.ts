import { afterEach, describe, expect, it, vi } from "vitest";
import type { HasilJalankan } from "./port";
import { ProsesLokal } from "./proses-lokal";

/**
 * Transport menuju runner, diuji dengan `fetch` tiruan.
 *
 * Podman tidak dibutuhkan, dan memang tidak boleh dibutuhkan: yang diuji di
 * sini adalah aturan yang berlaku **sebelum** ada container, yaitu "jangan pernah
 * bicara ke runner tanpa rahasia" dan "jangan pernah bawa detail internal ke
 * peramban". Keduanya mustahil diamati lewat eksekusi sungguhan, karena
 * kegagalan keduanya justru terjadi pada saat tidak ada yang berjalan.
 */

/** Hasil yang sah, seperti yang dikirim runner. */
const HASIL: HasilJalankan = {
  status: "sukses",
  stdout: "Halo, Budi!\n",
  stderr: "",
  exitCode: 0,
  durasiMs: 1500,
};

/**
 * Hasil yang sah **dan bukan** `sukses`.
 *
 * Fixture kedua inilah yang menguji "meneruskan apa adanya" dengan benar.
 * Dengan hanya satu fixture `sukses`, implementasi yang diam-diam menulis ulang
 * status menjadi `sukses` akan tetap hijau di semua test — padahal itu
 * kesalahan paling merusak yang mungkin: program peserta yang gagal dikompilasi
 * diberi tahu programnya berjalan.
 */
const HASIL_GAGAL: HasilJalankan = {
  status: "gagal_kompilasi",
  stdout: "",
  stderr: "main.cpp:1:14: error: expected ';' before '}' token",
  exitCode: 42,
  durasiMs: 1610,
};

/**
 * `Response` tiruan.
 *
 * Sengaja hanya `ok` dan `json()`: itu yang dipakai implementasi. Tiruan yang
 * lengkap akan menoleransi akses properti lain, sehingga test tidak bisa
 * membedakan "implementasi hanya butuh dua hal ini" dari "implementasi
 * membaca sesuatu yang seharusnya tidak boleh ia baca".
 */
function balasan(badan: unknown, ok = true): Response {
  return { ok, json: async () => badan } as Response;
}

type Panggilan = [string, RequestInit | undefined];

interface Tiruan {
  fetch: typeof fetch;
  /** Argumen pemanggilan pertama, untuk diperiksa field per field. */
  panggilan(): Panggilan;
  /** Berapa kali `fetch` benar-benar dipanggil. */
  jumlah(): number;
}

function tiruan(fn: (url: string, opsi?: RequestInit) => Promise<Response>): Tiruan {
  const mock = vi.fn(fn);
  return {
    fetch: mock as unknown as typeof fetch,
    panggilan: () => mock.mock.calls[0] as Panggilan,
    jumlah: () => mock.mock.calls.length,
  };
}

const MINTA = { bahasa: "cpp" as const, kode: "int main(){}" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ProsesLokal", () => {
  it("mengirimkan rahasia pada header", async () => {
    // Header yang benar adalah satu-satunya hal yang membedakan request
    // terotorisasi dari request anonim. Salah nama header di sini berarti
    // runner menolak semua permintaan dengan 401, dan gejalanya — "layanan
    // tidak tersedia" — tidak pernah menunjuk ke sebabnya.
    const t = tiruan(async () => balasan(HASIL));
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

    await new ProsesLokal(t.fetch).jalankan(MINTA);

    const opsi = t.panggilan()[1];
    const header = opsi?.headers as Record<string, string>;
    expect(header["x-runner-secret"]).toBe("rahasia-uji");
  });

  it("mengirim ke loopback, bukan ke host bebas", async () => {
    // Host dan port bisa disuntik untuk test, tapi alamat **bawaannya** yang
    // diuji di sini: nilai bawaannya adalah nilai produksi, dan kalau kebetulan
    // berubah jadi `0.0.0.0` atau nama host yang bisa dijangkau jaringan,
    // siapa pun yang bisa menjangkau mesin ini bisa menjalankan kode di
    // dalamnya — dan `--cap-drop=all` di dalam kontainer tidak menahan itu
    // (P2 spec).
    const t = tiruan(async () => balasan(HASIL));
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

    await new ProsesLokal(t.fetch).jalankan(MINTA);

    expect(t.panggilan()[0]).toBe("http://127.0.0.1:8021/jalankan");
  });

  it("membaca rahasia saat pemanggilan, bukan saat modul dimuat", async () => {
    // Instans dibuat **sebelum** env diisi. Snapshot di tingkat modul membuat
    // test ini gagal — dan, yang lebih penting, membuat `next dev` gagal
    // diam-diam: env baru tersedia setelah modul server pertama kali dimuat.
    const t = tiruan(async () => balasan(HASIL));
    const proses = new ProsesLokal(t.fetch);
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

    const hasil = await proses.jalankan(MINTA);

    expect(hasil.status).toBe("sukses");
  });

  it("gagal tertutup tanpa rahasia, dan tidak pernah memanggil runner", async () => {
    // Dua hal diuji bersama karena keduanya adalah satu keputusan: tidak ada
    // rahasia berarti **tidak ada request sama sekali**. Yang membuat kasus ini
    // penting adalah `fetch` tiruannya menjawab berhasil kalau dipanggil —
    // jadi test ini hanya bisa hijau kalau pemanggilannya benar-benar tidak
    // terjadi, bukan kalau hasilnya kebetulan sama.
    const t = tiruan(async () => balasan(HASIL));
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "");

    const hasil = await new ProsesLokal(t.fetch).jalankan(MINTA);

    expect(hasil.status).toBe("galat_runner");
    expect(t.jumlah()).toBe(0);
  });

  it("menolak host yang bukan loopback, dan tidak pernah memanggil runner", async () => {
    // Env yang salah konfigurasi tidak boleh mengubah siapa saja yang bisa
    // menjalankan kode. Kalau host bebas diterima, `CAREEVO_RUNNER_HOST`
    // menjadi kendali siapa yang boleh memakai layanan eksekusi — dan nilainya
    // cuma env, tanpa jejak di respons.
    const t = tiruan(async () => balasan(HASIL));
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

    const hasil = await new ProsesLokal(t.fetch, "10.0.0.5", "8021").jalankan(MINTA);

    expect(hasil.status).toBe("galat_runner");
    expect(t.jumlah()).toBe(0);
  });

  it("mengembalikan galat_runner saat runner tidak menjawab", async () => {
    // Yang diperiksa bukan pesannya, melainkan bahwa **ada** pesannya. Runner
    // mati, TIME_WAIT, atau timeout: semuanya satu peristiwa bagi peserta.
    //ECONNREFUSED tidak boleh sampai ke peramban, dan tidak boleh sampai ke
    // log yang dibaca peserta.
    const t = tiruan(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8021");
    });
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

    const hasil = await new ProsesLokal(t.fetch).jalankan(MINTA);

    expect(hasil.status).toBe("galat_runner");
    expect(hasil.stdout).toBe("");
    expect(hasil.stderr).not.toContain("ECONNREFUSED");
  });

  it("meneruskan hasil runner apa adanya, termasuk saat bukan sukses", async () => {
    // Hasil yang sah tidak boleh ditulis ulang. Kalau implementasi memetakan
    // ulang status atau memangkas keluaran, peserta berhenti melihat jawaban
    // programnya sendiri, dan pengukuran batas di dalam kontainer ikut hilang.
    //
    // Dua fixture, bukan satu: dengan hanya `sukses`, penulisan ulang status
    // menjadi `sukses` tidak akan terdeteksi — dan itulah kesalahan yang paling
    // merusak, karena program yang gagal dikompilasi akan dilaporkan berhasil.
    for (const hasilRunner of [HASIL, HASIL_GAGAL]) {
      const t = tiruan(async () => balasan(hasilRunner));
      vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

      const hasil = await new ProsesLokal(t.fetch).jalankan(MINTA);

      expect(hasil, `status ${hasilRunner.status}`).toEqual(hasilRunner);
    }
  });

  it("tidak membiarkan timer menggantung setelah permintaan selesai", async () => {
    // Setiap panggilan menyalakan timer timeout. Kalau `clearTimeout` hilang,
    // tiap request menahan handle-nya sampai 30 detik habis, dan pada `next dev`
    // penumpukan itu tumbuh terus selama server hidup — proses yang terlihat
    // sehat dan makin lambat. Gejalanya tidak muncul di test mana pun
    // kecuali di sini, karena tidak ada yang memeriksa handle.
    vi.useFakeTimers();
    try {
      const t = tiruan(async () => balasan(HASIL));
      vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

      await new ProsesLokal(t.fetch).jalankan(MINTA);

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("membuang field yang tidak dikenal dari badan runner", async () => {
    // Ini kelas kebocoran yang Task 4 temukan di dalam runner: galat internal
    // pernah ikut masuk ke respons 200, dan `errno`, `code`, `syscall`, serta
    // `path` milik Node keluar ke peramban sebagai HTTP 200 yang `ok`. Akses
    // implisit lewat spread akan meneruskannya lagi satu lapis di atas, jadi
    // di sini implementation harus **memilih** field-nya.
    const t = tiruan(async () =>
      balasan({
        ...HASIL,
        errno: -2,
        code: "ENOENT",
        syscall: "open",
        path: "/tmp/careevo-exec-abc123/main.cpp",
      }),
    );
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

    const hasil = await new ProsesLokal(t.fetch).jalankan(MINTA);

    expect(hasil).toEqual(HASIL);
    expect(Object.keys(hasil)).not.toContain("path");
    expect(Object.keys(hasil)).not.toContain("errno");
  });

  it("menolak status yang tidak ada di kosakata", async () => {
    // `StatusJalankan` adalah union tertutup. Status asing tidak punya judul di
    // `petakanStatus`, jadi meneruskannya membuat UI menampilkan kotak kosong —
    // dan pada saat yang sama memberitahu peserta ada jawaban, padahal tidak
    // ada. Jawaban yang tidak dipercaya menjadi `galat_runner`.
    const t = tiruan(async () => balasan({ ...HASIL, status: "waktu_habis" }));
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

    const hasil = await new ProsesLokal(t.fetch).jalankan(MINTA);

    expect(hasil.status).toBe("galat_runner");
  });

  it("menolak badan yang bukan bentuk hasil", async () => {
    // Keadaan runner yang tidak bisa dibedakan dari luar tapi semuanya berarti
    // "tidak ada jawaban program". Semuanya harus berakhir sebagai
    // `galat_runner`, bukan melempar keluar ke route dan jadi 500.
    //
    // Bentuk dengan field bertipe salah ada di sini dengan alasan: pemeriksa
    // field di `hasilDariBadan` adalah lapisan kedua setelah pemeriksaan
    // kosakata status, dan tanpa test untuknya lapisan itu bisa hilang tanpa
    // satu pun test yang berubah warna.
    const bentukSalah: unknown[] = [
      null,
      [],
      "teks",
      42,
      { status: "sukses" },
      { ...HASIL, stdout: 5 },
      { ...HASIL, stderr: null },
      { ...HASIL, exitCode: "0" },
      { ...HASIL, exitCode: Number.NaN },
      { ...HASIL, durasiMs: "1500" },
      { ...HASIL, durasiMs: Number.POSITIVE_INFINITY },
    ];
    for (const badan of bentukSalah) {
      const t = tiruan(async () => balasan(badan));
      vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

      const hasil = await new ProsesLokal(t.fetch).jalankan(MINTA);

      expect(hasil.status, `badan ${JSON.stringify(badan)}`).toBe("galat_runner");
    }
  });

  it("menolak balasan yang bukan JSON", async () => {
    // Halaman HTML dari perantara, atau badan kosong. `json()` yang melempar
    // harus berakhir sebagai `galat_runner`, bukan keluar dari `jalankan`
    // menjadi 500 di route.
    const t = tiruan(async () => {
      throw new SyntaxError("Unexpected token < in JSON at position 0");
    });
    vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

    const hasil = await new ProsesLokal(t.fetch).jalankan(MINTA);

    expect(hasil.status).toBe("galat_runner");
  });

  it("tidak mempercayai badan respons saat runner menolak", async () => {
    // Status HTTP bukan 2xx berarti runner menolak: rahasia salah, badan terlalu
    // besar, atau ada perantara di depannya. Yang penting di sini adalah bahwa
    // penolakan itu diputuskan dari **status**-nya, bukan dari bentuk badannya.
    //
    // Karena itu badan di bawah sengaja dibuat sebagai hasil yang **sah**:
    // kalau disisipkan `gagal_runner` saja karena badannya tidak berbentuk
    // hasil, test ini akan tetap hijau setelah pemeriksaan `ok` dihapus — dan
    // bererti tidak sedang menguji apa pun. Dengan badan yang sah, satu-satunya
    // alasan penolakan adalah statusnya, jadi yang diuji memang `ok`.
    //
    // Bentuk kedua, badan pesan galat runner, ditutup di sini juga karena itu
    // yang sebenarnya dikirim: pesannya ditulis untuk pemanggil dan tidak
    // menambah apa pun bagi peserta.
    for (const [badan, alasan] of [
      [HASIL, "hasil sah pada respons non-2xx"],
      [{ ok: false, error: "Layanan eksekusi sedang tidak tersedia." }, "pesan penolakan runner"],
    ] as const) {
      const t = tiruan(async () => balasan(badan, false));
      vi.stubEnv("CAREEVO_RUNNER_SECRET", "rahasia-uji");

      const hasil = await new ProsesLokal(t.fetch).jalankan(MINTA);

      expect(hasil.status, alasan).toBe("galat_runner");
      expect(hasil.stdout, alasan).toBe("");
      expect(hasil.stderr, alasan).toBe("");
    }
  });
});
