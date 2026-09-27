import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Kontrak: **permukaan kartu "Cocok Untukmu" adalah tile bento, dan header-nya
 * gradien langit statis yang berujung lembar putih membulat.**
 *
 * Keempat kartu di panel itu memakai `.dash-card` — resep yang sama dengan tile
 * dashboard, jadi gradien, border, radius, dan lift saat hover semuanya berasal
 * dari satu tempat. Ini dikunci sebagai bentuk kode karena tidak ada gerbang mana
 * pun yang bisa melihatnya: `typecheck`, `lint`, `vitest`, dan `build` semuanya
 * hijau baiklah kartu itu bergradien biru atau abu-abu rata.
 *
 * Yang dikuat di sini adalah DUA hal, dan keduanya adalah cara gradien ini
 * hilang tanpa jejak:
 *
 *  1. **Kartu tidak boleh membawa permukaannya sendiri.** `globals.css`
 *     memperingatkan terbuka bahwa token `--dash-card-*` ada justru supaya
 *     setiap permukaan dashboard menyelesaikan SATU gradien, dan
 *     "three hand-copied ramps is how the blue drifts per card". Jadi kelas
 *     `bg-*` / `rounded-*` / `p-*` / `border-*` / `shadow-*` pada kartu itu
 *     bukan sekadar gaya — semuanya bertabrakan dengan resep. Selain tampil
 *     salah, `bg-*` dan `hover:bg-*` bahkan tidak akan terlihat, karena
 *     `background-color` digambar DI BAWAH `background-image` resep.
 *  2. **Resepnya sendiri masih benar.** Kalau `.dash-card` diratakan jadi putih
 *     polos, keempat tile bento DAN keempat kartu ini ikut menjadi kotak putih —
 *     dan satu diff CSS bisa membawanya tanpa satu pun tes gagal di repo.
 *
 * Kontrak kedua di berkas ini: **header panel adalah gradien langit statis**
 * (azure → pale sky → near-white) dengan dot grid halus sebagai tekstur, bukan
 * media dither bergerak. Gradien itu dipakai DI SINI, sengaja: media dither sudah
 * ada di hero `/belajar`, dan header kartu yang duduk di kolom 350-380px tidak
 * perlu memuat empat lapisan WebGL + video. Yang dikunci karena itu bukan hanya
 * "ada gradien", melainkan juga kontras tinta di atas stop TERGELAP-nya —
 * header pernah membawa klaim "4.6:1" yang nyatanya 2.87:1, dan tidak ada gerbang
 * yang bisa melihatnya. Angka di bawah dihitung dari stop gradien yang
 * dideklarasikan di markup, bukan diperkirakan.
 *
 * Kontrak ketiga: **isi panel adalah lembar putih dengan sudut atas membulat
 * yang MENUMPUK header.** Keempat kelasnya (`relative z-10 -mt-4 rounded-t-2xl
 * bg-white`) satu paket, dan masing-masing bisa hilang tanpa satu pun gerbang
 * gagal.
 */

const AKAR = fileURLToPath(new URL("../../../../", import.meta.url));

/** Sumber tanpa komentar: komentar di kedua berkas menjelaskan alasannya, jadi
 *  menguji teks mentah akan gagal justru karena dokumentasinya benar. */
function tanpaKomentar(berkas: string): string {
  return readFileSync(berkas, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const REKOMENDASI = tanpaKomentar(
  join(AKAR, "src/components/features/jobs/kartu-rekomendasi-profil.tsx"),
);
const CSS = tanpaKomentar(join(AKAR, "src/app/globals.css"));

/** `className` milik kartu. Hanya yang pertama di dalam `<button`: `onClick`
 *  memuat panah `=>`, jadi pola yang berhenti di `>` tidak bisa diandalkan. */
const KELAS_KARTU = REKOMENDASI.match(/<button[\s\S]*?className="([^"]*)"/)?.[1] ?? "";

/** Luminansi relatif WCAG. Dipakai untuk menguji kontras nyata, bukan menebak
 *  angka lalu menulisnya di komentar — header pernah membawa klaim "4.6:1"
 *  yang nyatanya 2.87:1, dan tidak ada gerbang yang bisa melihatnya. */
function lum(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const channel = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
}

/** Rasio kontras WCAG antara dua warna hex, 1–21. */
function kontras(a: string, b: string): number {
  const [tinggi, rendah] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (tinggi + 0.05) / (rendah + 0.05);
}

/** Semua stop hex dari gradien header, urut seperti di markup. */
const GRADIEN_HEADER =
  /bg-gradient-to-b from-\[#([0-9A-Fa-f]{6})\] via-\[#([0-9A-Fa-f]{6})\] to-\[#([0-9A-Fa-f]{6})\]/;

describe('kartu "Cocok Untukmu" — permukaan', () => {
  it("memakai resep tile bento, bukan gradien sendiri", () => {
    expect(KELAS_KARTU, 'className kartu "Cocok Untukmu" tidak ditemukan').not.toBe("");
    expect(KELAS_KARTU).toContain("dash-card");
  });

  it("memakai gradien langit statis sebagai header, bukan media dither", () => {
    /* Header menolak `bg-white` polos karena kartu-kartunya sudah bergradien
       biru: header putih + kartu biru + container putih menghasilkan panel yang
       tidak punya hierarki — tidak ada yang jadi kepala.

       Yang dipakai untuk itu adalah **gradien langit statis**, bukan media
       dither. Media dither sudah menjadi identitas hero `/belajar`; memuatnya
       lagi di sini berarti empat lapisan tambahan (canvas WebGL + video `mp4` +
       veil + fade) untuk sebuah kolom 350-380px, dan mengikat header kartu ini
       pada crop yang diukur untuk tinggi band hero — kalau crop itu disetel
       ulang, panel ini ikut rusak tanpa sebab yang terlihat.

       Yang dikunci di sini karena itu adalah gradiennya sendiri, plus tekstur
       dot grid yang membuatnya tidak terbaca sebagai blok warna rata. */
    const gradien = REKOMENDASI.match(GRADIEN_HEADER);
    expect(gradien, "gradien langit di header tidak ditemukan").not.toBeNull();

    // Tekstur halus: dot grid 3px. Hilang, header jatuh jadi blok warna rata.
    expect(REKOMENDASI, "dot grid header tidak ditemukan").toMatch(
      /bg-\[size:3px_3px\] \[background-image:radial-gradient/,
    );

    // Header harus benar-benar terpotong di tepi kontainer beradius, dan
    // tingginya pasti (`h-[72px]`) supaya tidak ikut menggelembung mengikuti
    // isinya. `shrink-0` mencegahnya diperas di kolom flex.
    expect(REKOMENDASI).toMatch(/h-\[72px\][^"]*shrink-0|shrink-0[^"]*h-\[72px\]/);
    expect(REKOMENDASI).toMatch(/overflow-clip|overflow-hidden/);

    // Tidak boleh ada media dither tersisa di berkas ini: satu impor
    // `PitaHeaderDither`/`DitheredHeroBackdrop` yang tertinggal mengembalikan
    // empat lapisan yang justru dibuang di sini.
    expect(
      REKOMENDASI,
      "media dither kembali ke header panel loker",
    ).not.toMatch(/PitaHeaderDither|DitheredHeroBackdrop/);

    /* Teks jadi tinta gelap, bukan putih: putih di atas field pucat hanya
       ~1.1:1 — angka yang sudah tercatat di banner AI `belajar-home.tsx`.
       Menahan teks putih berarti menaruh scrim gelap penuh di atas gradien, dan
       itu dilarang DESIGN.md ("Do not add a full-surface scrim or image opacity
       overlay").

       `judul` diambil dari markup, bukan dari `not.toMatch(/text-white/)`
       lintas berkas: `text-white` pernah muncul di header DAN di empat kartu. */
    const judul = REKOMENDASI.match(/<h2 className="([^"]*)"/)?.[1] ?? "";
    expect(judul, 'className judul "Cocok Untukmu" tidak ditemukan').not.toBe("");
    expect(judul).toMatch(/text-\[#0a3d62\]/);
    expect(judul, "judul di atas gradien terang tidak boleh putih").not.toMatch(
      /text-white/,
    );

    // Subtitle 11.5px: tinta, bukan putih dan bukan alpha dari putih.
    expect(REKOMENDASI).toMatch(
      /text-\[11\.5px\] leading-relaxed text-\[#1e293b\]/,
    );
    expect(REKOMENDASI).not.toMatch(/text-white\/9/);
  });

  it("menutup header dengan lembar putih berujung membulat yang menumpuknya", () => {
    /* Header berakhir di udara kalau isi di bawahnya cuma blok putih rata:
       gradien biru menyambung ke putih tanpa sendi, dan panelnya kembali jadi
       kotak yang ditempel. Yang menyambungnya adalah LEMBAR dengan sudut atas
       membulat yang MENUMPUK header.

       Ini bentuk yang sama dengan `CatalogCourseCard`
       (`relative z-10 -mt-8 rounded-t-2xl bg-white`, DESIGN.md "Components and
       surfaces"), dengan tumpangan lebih kecil karena media di sini header 72px,
       bukan thumbnail 4:3.

       Empat kelasnya satu paket, dan tiap satu bisa hilang tanpa satu pun
       gerbang repo gagal — `typecheck`, `lint`, `vitest`, `build` semuanya
       hijau baiklah sudutnya membulat atau kotak:

         - `rounded-t-2xl` — lengkungnya sendiri (16px, lantai radius
           DESIGN.md);
         - `-mt-4` — tumpangannya. Ini yang membuat lengkungnya TERBACA:
           tanpa negatif margin, radiusnya cuma membulat di atas putih
           kontainer dan tak terlihat. Tumpangan harus >= radius supaya
           lengkung penuhnya menyingkap header (kalau tidak, tepi lurusnya
           masih menutup sebagian sudut);
         - `bg-white` — menutup bagian header yang ditumpuk;
         - `relative` + `z-10` — header di atasnya `relative`, jadi tanpa
           `z-10` header menimpa lembar dan lembar (beserta subtitle) hilang di
           baliknya. */
    const lembar =
      (REKOMENDASI.match(/className="[^"]*"/g) ?? []).find((k) =>
        k.includes("rounded-t-2xl"),
      ) ?? "";
    expect(lembar, "lembar putih berujung membulat tidak ditemukan").not.toBe(
      "",
    );

    // Tumpangan: `-mt-N` dengan N (kali 4px) minimal sebesar radius 16px,
    // supaya lengkung penuh menyingkap header.
    const tumpang = lembar.match(/(?<![\w:-])-mt-(\d+)/)?.[1];
    expect(tumpang, "lembar tidak menumpuk header").not.toBeUndefined();
    expect(
      Number(tumpang) * 4,
      `-mt-${tumpang} hanya menumpuk ${Number(tumpang) * 4}px, kurang dari radius 16px`,
    ).toBeGreaterThanOrEqual(16);

    expect(lembar, "lembar tidak menutup header dengan putih").toMatch(
      /\bbg-white\b/,
    );
    // `relative` + `z-10` — tanpa keduanya header yang juga `relative` menimpa
    // lembar (urutan cat untuk descendant berposisi = urutan dokumen).
    expect(lembar, "lembar tidak diposisikan").toMatch(/(?<![\w:-])relative/);
    expect(lembar, "lembar tidak dinaikkan di atas header").toMatch(/z-10/);

    // Lembar harus benar-benar ada di markup SEBELUM daftar kartu, dan daftar
    // sesudah header: kalau tidak, "lembar" ini cuma div dekoratif dan isinya
    // tidak ikut membulat.
    const idxHeader = REKOMENDASI.indexOf("h-[72px]");
    const idxLembar = REKOMENDASI.indexOf("rounded-t-2xl");
    const idxDaftar = REKOMENDASI.indexOf("snap-x snap-mandatory");
    expect(idxHeader, "header tidak ditemukan").toBeGreaterThan(-1);
    expect(idxLembar, "lembar putih tidak ditemukan").toBeGreaterThan(idxHeader);
    expect(idxDaftar, "daftar kartu tidak ditemukan").toBeGreaterThan(idxLembar);
  });

  it("memakai tinta yang tetap terbaca di atas stop gradien paling gelap", () => {
    /* Kontras dihitung terhadap stop TERGELAP gradien, bukan stop rata-rata:
       stop itulah yang menentukan, dan sebuah gradien "terang" yang salah
       memilih ujungnya bisa menaruh judul di bawah AA tanpa satu pun gerbang
       repo gagal.

       Stop tergelap ada di ATAS (`from-…`), jadi di situlah judul duduk — dan
       angka di bawah dihitung dari hex yang benar-benar ada di markup. Kalau
       ramp-nya diganti dengan yang lebih pekat, tes ini ikut gagal bukannya
       diam-diam meloloskan header yang tidak terbaca. */
    const gradien = REKOMENDASI.match(GRADIEN_HEADER);
    expect(gradien, "gradien langit di header tidak ditemukan").not.toBeNull();
    const stops = [gradien?.[1], gradien?.[2], gradien?.[3]].filter(
      (s): s is string => Boolean(s),
    );
    expect(stops.length, "stop gradien header tidak lengkap").toBe(3);

    const palingGelap = stops.reduce((a, b) => (lum(b) < lum(a) ? b : a));
    /* Judul `#0a3d62` dan subtitle `#1e293b`: keduanya di bawah 18.66px, jadi
       keduanya wajib 4.5:1 terhadap stop yang paling gelap. Subtitle adalah yang
       lebih terang, jadi justru ia yang menentukan — mengujinya juga menjaga
       `#1e293b` tidak dinaikkan ke abu-abu tengah yang lolos sebagai "warna
       aman" padahal kontrasnya hilang. */
    for (const [nama, tinta] of [
      ["judul", "#0a3d62"],
      ["subtitle", "#1e293b"],
    ] as const) {
      expect(
        kontras(tinta, `#${palingGelap}`),
        `${nama} ${tinta} gagal 4.5:1 di stop gradien paling gelap #${palingGelap}`,
      ).toBeGreaterThanOrEqual(4.5);
    }

    /* Tautan "Ubah" juga teks 11.5px, tapi ia satu-satunya bagian header yang
       TIDAK boleh mengukur kontrasnya terhadap gradien. Biru merek `#0056D2`
       hanya 3.37:1 di stop paling gelap (`#8FC0F2`) — angka ini dihitung, bukan
       diperkirakan, dan persis kesalahan yang pernah membuat header menyimpan
       klaim kontras yang tidak pernah diverifikasi. Karena itu tautannya duduk
       di `bg-white` PENUH: di sana `#0056D2` 6.4:1, dan bentuknya jadi tombol
       aksi.

       Chip putih itu HARUS penuh. `bg-white/80` di atas gradien tidak menolong
       kalau stop-nya digelapkan — kontras turun lagi tanpa satu pun gerbang
       melihatnya. Yang dikunci: putih solid, bukan putih translusen. */
    const tautan =
      (REKOMENDASI.match(/className="[^"]*"/g) ?? []).find((k) =>
        k.includes("justify-end gap-0.5 rounded-md"),
      ) ?? "";
    expect(tautan, 'className tautan "Ubah" tidak ditemukan').not.toBe("");
    const biruTautan = tautan.match(/text-\[#([0-9A-Fa-f]{6})\]/)?.[1];
    expect(biruTautan, "tautan Ubah tidak memakai warna hex").not.toBeUndefined();
    expect(
      kontras(`#${biruTautan}`, "#ffffff"),
      `tautan "Ubah" #${biruTautan} gagal 4.5:1 di atas chip putihnya`,
    ).toBeGreaterThanOrEqual(4.5);
    // Chip putih, bukan putih translusen di atas gradien.
    expect(tautan).toMatch(/(?<![\w:-])bg-white(?!\/\d)/);
    expect(tautan, "chip tautan Ubah harus putih penuh").not.toMatch(
      /bg-white\/\d/,
    );
  });

  it("tidak membawa permukaan sendiri yang akan kalah atau menutupi resep", () => {
    // Hanya yang dimiliki `.dash-card`. `text-left`, `group`, `w-*`, `snap-*`,
    // dan `cursor-*` sengaja tidak masuk daftar: tidak ada di resep dan tidak
    // menabrakkannya.
    const tabrakan =
      KELAS_KARTU.match(
        /(?<![\w:-])(bg-\S+|rounded-\S+|p-\d\S*|border\S*|shadow\S*|transition\S*|flex|relative)\b/g,
      ) ?? [];
    expect(
      tabrakan,
      "kartu membawa kelas yang juga dimiliki .dash-card; kelas itu kalah oleh selektor terlingkup, atau (untuk bg-*) tidak terlihat di bawah background-image",
    ).toEqual([]);
  });
});

describe("resep .dash-card", () => {
  it("masih melukis gradien dari token, bukan putih polos", () => {
    const resep = CSS.match(/\.dashboard-shell \.dash-card \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(resep, "aturan .dashboard-shell .dash-card tidak ditemukan").not.toBe("");
    expect(resep).toMatch(/background-image:\s*linear-gradient\(/);
    // Gradiennya harus berasal dari token. Kalau warnanya ditulis ulang literal
    // di sini, kartu "Cocok Untukmu" dan tile bento bisa mulai melenceng —
    // persis yang dicegah oleh komentar token.
    expect(resep).toMatch(/var\(--dash-card-top\)/);
    expect(resep).toMatch(/var\(--dash-card-bottom\)/);
  });

  it("lift bayangan saat hover tetap milik resep", () => {
    // Tanpa ini, hover kartu ini jadi diam — dan tidak ada yang mengukur
    // "diam" sebagai bug.
    const hover = CSS.match(/\.dashboard-shell \.dash-card:hover \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(hover, "aturan .dash-card:hover tidak ditemukan").not.toBe("");
    expect(hover).toMatch(/box-shadow:/);
  });

  it("tokennya dideklarasikan pada .dashboard-shell, bukan global", () => {
    // Kalau token pindah ke `:root`, kartu ini masih bisa kehilangan gradien
    // hanya dengan dipindah keluar dari `AppShell` — dan itu perubahan yang
    // tidak terlihat di diff mana pun.
    const blok = CSS.match(/\.dashboard-shell \{[\s\S]*?\n\}/g) ?? [];
    expect(blok.length, "blok .dashboard-shell tidak ditemukan").toBeGreaterThan(0);
    const pemilikToken = blok.filter((b) => b.includes("--dash-card-top:"));
    expect(
      pemilikToken,
      "--dash-card-* tidak dideklarasikan di dalam .dashboard-shell",
    ).toHaveLength(1);
  });
});
