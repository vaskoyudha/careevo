import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MateriRail, type TampilanRail } from "./materi-rail";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { Halaman, Submodul } from "@/types/course";

/**
 * Rail — diuji lewat HTML hasil render.
 *
 * Bentuknya **dua tampilan dalam satu panel**, dan yang dikunci di sini adalah
 * peralihan di antaranya:
 *
 * 1. **Default = modul yang dibuka.** Judul panel adalah nama modul itu, isinya
 *    daftar babnya. Sebelumnya panel selalu memuat seluruh kursus; begitu tiap
 *    modul punya bab, daftar datar berhenti menjawab "saya di bagian mana".
 * 2. **"Semua modul" mengembalikan daftar kursus.** Peta kemajuan tidak boleh
 *    hilang bersama perilaku lama — ia pindah ke pintu ini.
 * 3. **Bab bisa dibentangkan; halamannya punya alamat.** Sub-item halaman
 *    menautkan ke `?halaman=<id>`, dan bab yang memuat halaman aktif terbuka
 *    sejak awal — tanpa itu deep link mendarat di bab tertutup.
 */

const WAKTU = "2026-09-24T00:00:00.000Z";

function halaman(id: string, judul: string, urutan = 1): Halaman {
  return {
    id,
    submodul_id: "sub-1",
    modul_id: "crs-1-m2",
    course_id: "crs-1",
    judul,
    urutan,
    blok: [{ id: `b-${id}`, tipe: "paragraf", segmen: [{ teks: "Satu dua tiga" }] }],
    created_at: WAKTU,
    updated_at: WAKTU,
  };
}

function bab(id: string, judul: string, urutan: number, halamanDaftar: Halaman[]): Submodul {
  return {
    id,
    modul_id: "crs-1-m2",
    course_id: "crs-1",
    judul,
    ringkasan: "",
    urutan,
    halaman: halamanDaftar,
    created_at: WAKTU,
    updated_at: WAKTU,
  };
}

function modul(over: Partial<ModulKursus> & { id: string; judul: string }): ModulKursus {
  return { ringkasan: "ringkasan", durasi_min: 10, url: "https://contoh.test", ...over };
}

/** Modul berbab dengan kuis dan lampiran di tingkat modul. */
const MODUL_BERBAB: ModulKursus = modul({
  id: "crs-1-m2",
  judul: "Mendalami React",
  submodul: [
    bab("sub-a", "Dasar Komponen", 1, [halaman("hal-1", "Pengantar")]),
    bab("sub-b", "State dan Efek", 2, [
      halaman("hal-2", "useState"),
      halaman("hal-3", "useEffect", 2),
    ]),
  ],
  kuis: [
    {
      id: "k-1",
      judul: "Kuis React",
      deskripsi: "Uji pemahaman React.",
      soal: [{ id: "s1", pertanyaan: "Apa itu React?", pilihan: ["Lib", "DB"], jawaban_benar: 0 }],
      nilai_lulus: 70,
      created_at: WAKTU,
      updated_at: WAKTU,
    },
  ],
});

const MODUL_TANPA_BAB: ModulKursus = modul({
  id: "crs-1-m3",
  judul: "Penutup",
});

const KURIKULUM: ModulKursus[] = [
  modul({ id: "crs-1-m1", judul: "Orientasi" }),
  MODUL_BERBAB,
  MODUL_TANPA_BAB,
];

function render(
  over: {
    modulAktif?: string;
    selesai?: string[];
    halamanAktif?: string;
    tampilan?: TampilanRail;
  } = {},
) {
  // `tampilan` dikendalikan panel, bukan rail: di test ini nilainya diteruskan
  // apa adanya, dan default-nya diturunkan dari modul yang aktif — persis yang
  // dilakukan kepala panel.
  const modulAktif = over.modulAktif ?? "crs-1-m1";
  const tampilan =
    over.tampilan ?? (KURIKULUM.some((m) => m.id === modulAktif) ? "modul" : "semua");
  return renderToStaticMarkup(
    createElement(MateriRail, {
      slug: "kursus-uji",
      modul: KURIKULUM,
      modulAktif,
      selesai: over.selesai ?? [],
      halamanAktif: over.halamanAktif,
      tampilan,
      onTampilan: () => {},
    }),
  );
}

/** Potongan HTML milik satu `<li>`, dipilih dari judulnya. */
function baris(html: string, judul: string): string {
  const bagian = html.split("<li>").find((b) => b.includes(judul));
  expect(bagian, `baris "${judul}" tidak ditemukan`).toBeDefined();
  return bagian!;
}

/** Sumber komponen ini — untuk properti yang tidak muncul di HTML statis. */
function bacaSumber(): string {
  return readFileSync(new URL("./materi-rail.tsx", import.meta.url), "utf8");
}

describe("MateriRail — modul yang dibuka", () => {
  it("menamai nav-nya dengan modul yang dibuka, tanpa mengulang judulnya", () => {
    // Judul panel hidup di **kepala panel** (`IsiPanelSilabus`), bukan di rail:
    // rail hanya memuat isinya (daftar bab), jadi satu panel tidak pernah punya
    // dua judul berteks sama. Yang tersisa di rail adalah nama aksesibel nav-nya,
    // sehingga nama modulnya muncul **sekali**, bukan dua kali sebagai judul kedua.
    const html = render({ modulAktif: "crs-1-m2" });
    expect(html).toContain('nav aria-label="Mendalami React"');
    expect(html.match(/Mendalami React/g) ?? []).toHaveLength(1);
  });

  it("tidak lagi memuat modul lain saat satu modul dibuka", () => {
    // Panel menyempit ke modul yang dibuka; daftar kursus pindah ke pintu
    // "Semua modul".
    const html = render({ modulAktif: "crs-1-m2" });
    expect(html).not.toContain("Orientasi");
    expect(html).not.toContain("Penutup");
  });

  it("menampilkan bab-bab modul yang dibuka", () => {
    const html = render({ modulAktif: "crs-1-m2" });
    expect(html).toContain("Dasar Komponen");
    expect(html).toContain("State dan Efek");
  });

  it("tidak lagi memuat pintu 'Semua modul' — ia pindah ke kepala panel", () => {
    // Kontrol itu mengubah **seluruh** isi panel, jadi tempatnya di kepala (di
    // atas judul kursus), bukan di dalam daftar. Kalau rail juga merendernya,
    // akan ada dua pintu untuk satu tindakan.
    const html = render({ modulAktif: "crs-1-m2" });
    expect(html).not.toContain("Semua modul");
  });

  it("menyembunyikan halaman bab yang tertutup", () => {
    // Akordeon: satu bab terbuka per waktu.
    const html = render({ modulAktif: "crs-1-m2", halamanAktif: "hal-1" });
    expect(html).toContain("Pengantar");
    expect(html).not.toContain("useState");
  });

  it("membuka bab yang memuat halaman aktif sejak awal", () => {
    // Deep link ke sebuah halaman harus mendarat dengan babnya terbuka; tanpa
    // itu halaman yang benar tersembunyi di balik bab yang tertutup.
    const html = render({ modulAktif: "crs-1-m2", halamanAktif: "hal-3" });
    expect(html).toContain("useState");
    expect(html).toContain("useEffect");
    expect(html).not.toContain("Pengantar");
  });

  it("menjadikan baris bab sebagai tombol pembentang, bukan tautan", () => {
    const html = render({ modulAktif: "crs-1-m2" });
    const tombol = html.match(/<button [^>]*aria-controls="rail-bab-sub-a"[^>]*>/)?.[0];
    expect(tombol, "tombol pembentang bab tidak ditemukan").toBeDefined();
    expect(tombol).toContain('aria-expanded="true"');
    // Bab satunya tertutup: tombol dengan `aria-expanded="false"` yang menunjuk
    // panelnya. Urutan atribut tidak diandaikan — yang dikunci hubungannya.
    const tombolTertutup = html.match(/<button [^>]*aria-controls="rail-bab-sub-b"[^>]*>/)?.[0];
    expect(tombolTertutup, "tombol pembentang bab kedua tidak ditemukan").toBeDefined();
    expect(tombolTertutup).toContain('aria-expanded="false"');
  });

  it("menautkan tiap halaman lewat ?halaman= ke modulnya", () => {
    const html = render({ modulAktif: "crs-1-m2", halamanAktif: "hal-3" });
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m2?halaman=hal-2"');
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m2?halaman=hal-3"');
  });

  it("menawarkan pintu masuk 'Buka materi' di dalam modul yang dibuka", () => {
    const html = render({ modulAktif: "crs-1-m2" });
    expect(html).toContain("Buka materi");
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m2"');
  });

  it("menyebut nomor halaman menerus lintas bab dan perkiraan menitnya", () => {
    // Nomor halaman adalah posisi dalam **modul**: bab kedua dimulai dari
    // "Halaman 2", bukan kembali ke "Halaman 1".
    const html = render({ modulAktif: "crs-1-m2", halamanAktif: "hal-3" });
    expect(html).toContain("Halaman 2 · ≈1 mnt");
    expect(html).toContain("Halaman 3 · ≈1 mnt");
  });

  it("menampilkan jumlah halaman tiap bab", () => {
    const html = render({ modulAktif: "crs-1-m2" });
    expect(html).toContain("1 halaman");
    expect(html).toContain("2 halaman");
  });

  it("membentangkan bab dari halaman aktif saat modulnya berganti", () => {
    /**
     * Sejak peserta bisa berpindah modul **dari dalam panel**, akordeon yang
     * dibiarkan menunjuk bab modul lama akan mendaratkan mereka di modul baru
     * dengan tidak ada bab terbuka — panel yang tampak kosong padahal isinya ada.
     *
     * Dikunci dari sumber: penyelarasan ini terjadi saat render (saat `modulAktif`
     * berubah), dan `renderToStaticMarkup` tidak menjalankan render kedua.
     */
    const sumber = bacaSumber();
    expect(sumber).toMatch(/modulSebelumnya !== \(modulDibuka\?\.id \?\? null\)/);
    expect(sumber).toMatch(/setBabDibuka\(babHalamanTerpilih\(modulDibuka, halamanTerpilih\)\)/);
  });

  it("menampilkan kuis di tingkat modul, bukan di dalam bab", () => {
    // Penilaian berhenti di tingkat modul; kuis di dalam bab akan menjanjikan
    // penilaian per bab yang tidak ada.
    const html = render({ modulAktif: "crs-1-m2", halamanAktif: "hal-3" });
    expect(html).toContain("Kuis React");
    expect(html).toContain("Kuis · 1 soal");
  });

  it("menandai satu halaman saja dengan aria-current", () => {
    // Penanda "kamu di sini". Kalau id halaman basi (dihapus admin), yang
    // tersorot adalah halaman **pertama** — jawaban yang sama dengan yang
    // dirender pane, karena keduanya lewat aturan yang sama.
    const html = render({ modulAktif: "crs-1-m2", halamanAktif: "hal-2" });
    expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1);
    expect(html).toMatch(
      /aria-current="page"[^>]*href="\/belajar\/kursus-uji\/materi\/crs-1-m2\?halaman=hal-2"/,
    );
  });

  it("jatuh ke halaman pertama saat ?halaman= basi", () => {
    const html = render({ modulAktif: "crs-1-m2", halamanAktif: "hal-yang-sudah-dihapus" });
    // Halaman pertama modul ini ada di bab **pertama**, jadi bab itulah yang
    // terbuka.
    expect(html).toContain("Pengantar");
    expect(html).toMatch(
      /aria-current="page"[^>]*href="\/belajar\/kursus-uji\/materi\/crs-1-m2\?halaman=hal-1"/,
    );
  });

  it("menandai bab yang memuat halaman aktif", () => {
    const html = render({ modulAktif: "crs-1-m2", halamanAktif: "hal-3" });
    const tombol = html.match(/<button [^>]*aria-controls="rail-bab-sub-b"[^>]*>/)?.[0];
    expect(tombol).toContain('aria-current="true"');
  });

  it("menampilkan daftar halaman datar untuk modul tanpa bab", () => {
    // Modul turunan (dan modul tersimpan yang belum dikelompokkan) tidak
    // berpura-pura punya bab: halamannya tidak ada, jadi yang benar adalah
    // menampilkan apa adanya — di sini kosong — plus pintu ke reader-nya.
    const html = render({ modulAktif: "crs-1-m3" });
    expect(html).toContain("Penutup");
    expect(html).toContain("Buka materi");
  });
});

describe("MateriRail — daftar seluruh modul", () => {
  it("memuat setiap modul saat tidak ada modul yang dikenali", () => {
    // Id modul yang tidak ada di kurikulum (mis. modul dihapus admin) jatuh ke
    // daftar kursus, bukan ke panel kosong.
    const html = render({ modulAktif: "mod-yang-sudah-dihapus" });
    expect(html).toContain("Orientasi");
    expect(html).toContain("Mendalami React");
    expect(html).toContain("Penutup");
    expect(html).toContain("Daftar modul");
  });

  it("tampilan 'semua' tetap bisa diminta meski modul aktifnya dikenal", () => {
    // Panel yang menyimpan tampilannya; rail harus mengikuti prop, bukan
    // menurunkannya sendiri dari modul yang aktif.
    const html = render({ modulAktif: "crs-1-m2", tampilan: "semua" });
    expect(html).toContain("Daftar modul");
    expect(html).toContain("Orientasi");
  });

  it("baris modul TIDAK menutup panel saat ditekan", () => {
    /**
     * Perilaku yang diminta: memilih modul dari daftar ini adalah langkah
     * menelusuri — panelnya harus tetap terbuka untuk memperlihatkan bab modul
     * yang baru dipilih. Menutupnya di situ melewati langkah itu.
     *
     * Diperiksa dari sumber karena `onClick` tidak ikut ke HTML statis:
     * `onNavigasi` adalah callback "tutup panel" milik shell, jadi kehadirannya
     * di baris modul berarti panelnya menutup.
     *
     * Yang dibaca adalah **body** fungsi, bukan seluruh berkas: `onNavigasi`
     * memang masih dipakai di tempat lain (`SubItem`, "Buka materi") — di sana ia
     * benar, sebab keduanya berarti "saya mau membaca".
     */
    const sumber = bacaSumber();
    const mulai = sumber.indexOf("function TampilanSemua");
    expect(mulai, "TampilanSemua tidak ditemukan").toBeGreaterThan(-1);
    // Sampai fungsi **berikutnya** (TampilanModul, yang memang memakai
    // `onNavigasi` untuk sub-item halaman dan "Buka materi").
    const selesai = sumber.indexOf("function TampilanModul", mulai);
    expect(selesai, "batas TampilanSemua tidak ditemukan").toBeGreaterThan(mulai);
    const body = sumber.slice(mulai, selesai);

    expect(body).toContain("onClick={onBukaModul}");
    expect(body).not.toContain("onNavigasi");
  });

  it("menautkan tiap modul ke reader-nya", () => {
    const html = render({ modulAktif: "mod-yang-sudah-dihapus" });
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m2"');
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m3"');
  });

  it("menghitung isi per modul di baris meta", () => {
    const html = render({ modulAktif: "mod-yang-sudah-dihapus" });
    // Modul 2 punya 3 halaman (dua bab) + 1 kuis; modul 1 dan 3 tidak punya isi.
    expect(html).toContain("3 halaman");
    expect(html).toContain("1 kuis");
  });

  it("tetap menampilkan baris meta durasi di setiap baris", () => {
    // Termasuk modul tanpa isi: durasi adalah satu-satunya keterangan yang
    // dimilikinya.
    const html = render({ modulAktif: "mod-yang-sudah-dihapus" });
    expect(baris(html, "Orientasi")).toContain("10 mnt");
    expect(baris(html, "Penutup")).toContain("10 mnt");
  });

  it("menandai modul yang sudah selesai", () => {
    const html = render({ modulAktif: "mod-yang-sudah-dihapus", selesai: ["crs-1-m1"] });
    expect(html).toContain("Selesai");
  });

  it("tetap menandai 'Selesai' pada modul yang tidak punya isi", () => {
    // Centangnya `aria-hidden`, jadi kata ini satu-satunya penanda status bagi
    // pembaca layar.
    const penutup = baris(
      render({ modulAktif: "mod-yang-sudah-dihapus", selesai: ["crs-1-m3"] }),
      "Penutup",
    );
    expect(penutup).toContain("Selesai");
  });
});

describe("MateriRail — bentuk ciut", () => {
  it("tetap memuat semua modul di bentuk ciut", () => {
    /**
     * Bentuk ciut bukan daftar lain: ia daftar yang **sama**, hanya tanpa baris
     * meta dan tanpa pembentangan. Di 104px tidak ada ruang untuk sub-item, jadi
     * modulnya tetap dibuka lewat tautannya sendiri.
     */
    const html = renderToStaticMarkup(
      createElement(MateriRail, {
        slug: "kursus-uji",
        modul: KURIKULUM,
        modulAktif: "crs-1-m2",
        selesai: [],
        ringkas: true,
        tampilan: "modul",
        onTampilan: () => {},
      }),
    );
    expect(html).toContain("Orientasi");
    expect(html).toContain("Mendalami React");
    expect(html).toContain("Penutup");
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m2"');
    expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1);
    // Meta yang dibuang: di 104px ia jadi dua baris 10px yang tidak terbaca.
    expect(html).not.toContain("3 halaman");
    expect(html).not.toContain(" mnt");
    // Nama penuh modul tetap terjangkau lewat tooltip.
    expect(html).toContain('title="2. Mendalami React"');
    // Nama nav-nya tetap ada meski judul panelnya tidak muat.
    expect(html).toContain('aria-label="Daftar modul"');
  });

  it("menjaga status selesai terbaca saat judulnya terpotong", () => {
    const html = renderToStaticMarkup(
      createElement(MateriRail, {
        slug: "kursus-uji",
        modul: KURIKULUM,
        modulAktif: "crs-1-m1",
        selesai: ["crs-1-m1"],
        ringkas: true,
        tampilan: "modul",
        onTampilan: () => {},
      }),
    );
    expect(html).toContain("Selesai");
  });
});

describe("MateriRail — kontrak navigasi", () => {
  it("memanggil onNavigasi saat tautan di dalam rail ditekan", () => {
    /**
     * Panel silabus menutupi seluruh layar, dan berpindah halaman masih berada
     * di pathname yang sama — jadi penutupan otomatis milik shell tidak menyala
     * dan panelnya akan menutupi halaman yang baru saja dipilih.
     *
     * Diperiksa dari **sumber**, bukan render: `onClick` tidak ikut ke HTML
     * statis, dan `renderToStaticMarkup` tidak menjalankan event.
     */
    const sumber = readFileSync(new URL("./materi-rail.tsx", import.meta.url), "utf8");
    // Semua tautan yang bisa ditekan dari panel: halaman, kuis/lampiran, dan
    // pintu masuk modulnya.
    expect(sumber).toMatch(/onClick=\{onNavigasi\}/);
  });
});
