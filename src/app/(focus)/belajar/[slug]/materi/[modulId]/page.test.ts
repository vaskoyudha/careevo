import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Halaman modul reader — gerbang `notFound` dan render pane.
 *
 * Spec §6 test #2: "`modulId` yang tidak ada di kurikulum → `notFound`".
 * Halaman ini tipis (sengaja — shell-nya hidup di `materi/layout.tsx`), tetapi
 * tipis bukan berarti tidak berperilaku: dua `notFound()`-nya adalah satu-satunya
 * yang menolak slug tak dikenal dan id modul yang tidak ada di kurikulum saat ini.
 * Modul yang dihapus admin tidak boleh tampil sebagai halaman hampa.
 *
 * Yang di-mock: `cariEntri`, `modulUntukSumber`, `MateriPane`, dan `next/navigation`
 * `notFound`. Yang **tidak** di-mock: halaman itu sendiri — `renderToStaticMarkup`
 * menjalankan komponen aslinya, sehingga alur "slug → entri → modul → pane" yang
 * benar-benar diuji, bukan bentuknya.
 */

const mocks = vi.hoisted(() => ({
  cariEntri: vi.fn(),
  modulUntukSumber: vi.fn(),
  notFound: vi.fn(() => {
    // `notFound()` asli melempar error spesial Next.js, bukan kembali — tanpa
    // ini halaman akan terus berjalan ke dereference `entri.id`/`modul` yang
    // tidak ada, dan test gagal karena alasan yang salah. Melempar di sini
    // membuat mock berperilaku seperti aslinya: pemanggil berhenti di titik itu.
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/courses/katalog", () => ({ cariEntri: mocks.cariEntri }));
vi.mock("@/lib/courses/modul-resolver", () => ({ modulUntukSumber: mocks.modulUntukSumber }));
vi.mock("@/components/features/learning/materi-pane", () => ({
  // `halamanAwal` ikut dirender sebagai atribut: halaman ini **tidak** memilih
  // halamannya sendiri — ia hanya meneruskan `?halaman=` apa adanya, dan itu
  // satu-satunya hal yang perlu dijaga di sini (pemilihan halaman diuji di
  // `halaman.test.ts` lewat `halamanDipilih`, dan render pane-nya di
  // `materi-pane.test.ts`).
  MateriPane: ({
    modul,
    halamanAwal,
  }: {
    modul: { id: string; judul: string };
    halamanAwal?: string;
  }) =>
    createElement("section", {
      "data-test-modul": modul.id,
      "data-test-judul": modul.judul,
      "data-test-halaman": halamanAwal ?? "",
    }),
}));

const { default: MateriModulPage } = await import("./page");

const ENTRI = {
  id: "crs-1",
  slug: "kursus-uji",
  title: "Kursus Uji",
  url: "https://contoh.test",
  provider: "Careevo Academy",
  type: "course" as const,
  tags: ["react"],
  level: "dasar" as const,
  is_free: true,
  duration_min: 60,
  completed: false,
};

const MODUL = [
  { id: "crs-1-m1", judul: "Orientasi", ringkasan: "r", durasi_min: 10, url: "https://contoh.test" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Render: komponen halaman adalah **async**, dan `renderToStaticMarkup` tidak
 * bisa menunggu suspense — ia akan menggantikan seluruh keluaran dengan
 * indikator loading. Pola yang dipakai di sini adalah memanggil komponennya
 * sebagai fungsi (bukan lewat `createElement`), lalu merender hasilnya yang
 * sudah jadi elemen sinkron. Itu yang dijalankan Next untuk komponen server.
 *
 * `searchParams` dioper terpisah karena halaman membacanya untuk memilih
 * halaman: `{}` berarti "tanpa `?halaman=`".
 */
async function renderPage(
  slug: string,
  modulId: string,
  searchParams: { halaman?: string } = {},
): Promise<string> {
  const elemen = await MateriModulPage({
    params: Promise.resolve({ slug, modulId }),
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(elemen);
}

/** Jalankan halaman; `notFound` melempar, jadi tangkap dan laporkan sebagai 404. */
async function renderPageTerkendali(
  slug: string,
  modulId: string,
  searchParams: { halaman?: string } = {},
): Promise<string> {
  try {
    return await renderPage(slug, modulId, searchParams);
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_NOT_FOUND") return "";
    throw err;
  }
}

describe("MateriModulPage", () => {
  it("merender pane untuk modul yang dikenal", async () => {
    mocks.cariEntri.mockResolvedValue(ENTRI);
    mocks.modulUntukSumber.mockResolvedValue(MODUL);

    const html = await renderPage("kursus-uji", "crs-1-m1");

    expect(mocks.notFound).not.toHaveBeenCalled();
    // Pane menerima modul yang benar — bukan modul pertama kebetulan.
    expect(html).toContain('data-test-modul="crs-1-m1"');
    expect(html).toContain('data-test-judul="Orientasi"');
  });

  it("memanggil notFound saat slug tidak dikenal", async () => {
    mocks.cariEntri.mockResolvedValue(undefined);

    await renderPageTerkendali("tidak-ada", "crs-1-m1");

    expect(mocks.notFound).toHaveBeenCalledTimes(1);
    // Slug yang tidak dikenali tidak boleh sampai membaca modul apa pun.
    expect(mocks.modulUntukSumber).not.toHaveBeenCalled();
  });

  it("memanggil notFound saat modulId tidak ada di kurikulum saat ini", async () => {
    mocks.cariEntri.mockResolvedValue(ENTRI);
    mocks.modulUntukSumber.mockResolvedValue(MODUL);

    await renderPageTerkendali("kursus-uji", "modul-dihapus-admin");

    expect(mocks.notFound).toHaveBeenCalledTimes(1);
    // Id yang tidak cocok dengan modul mana pun bukan berarti "modul pertama".
    // Menghapus assertion ini (mis. mengganti `notFound()` dengan `?? modul[0]`)
    // membuat halaman diam-diam menampilkan modul yang salah.
  });

  it("meneruskan ?halaman= apa adanya ke pane", async () => {
    // Halaman ini **tidak** memvalidasi id halamannya: `halamanDipilih()` di
    // dalam pane yang memutuskan, karena panel silabus memakai fungsi yang sama
    // untuk menyorot barisnya. Kalau halaman ini ikut menyaring, dua tempat
    // mulai menjawab "halaman mana yang tampil" — dan panel bisa menyorot baris
    // yang berbeda dari yang dirender pane, tanpa error di mana pun.
    mocks.cariEntri.mockResolvedValue(ENTRI);
    mocks.modulUntukSumber.mockResolvedValue(MODUL);

    const html = await renderPage("kursus-uji", "crs-1-m1", { halaman: "hal-2" });
    expect(html).toContain('data-test-halaman="hal-2"');
  });

  it("mengoper halaman kosong saat tidak ada ?halaman=", async () => {
    // `undefined` bukan "" — dan yang penting di sini adalah pane menerima
    // ketiadaan itu, bukan halaman pertama yang dipilih di sini: pane yang tahu
    // modulnya, jadi pane yang tahu halaman pertamanya.
    mocks.cariEntri.mockResolvedValue(ENTRI);
    mocks.modulUntukSumber.mockResolvedValue(MODUL);

    const html = await renderPage("kursus-uji", "crs-1-m1");
    expect(html).toContain('data-test-halaman=""');
  });
});
