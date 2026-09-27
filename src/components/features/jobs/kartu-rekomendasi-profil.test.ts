import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Kontrak: **permukaan kartu "Cocok Untukmu" adalah tile bento, bukan kartu
 * sendiri.**
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
 * Yang tidak bisa dikunci di sini: token `--dash-card-*` dideklarasikan pada
 * `.dashboard-shell`, jadi kartu ini MELETAKKAN variabelnya di dalam `AppShell`.
 * Dipindah keluar dari sana, `var(--dash-card-top)` tidak ter-resolve, seluruh
 * `background-image` jadi tidak valid, dan kartunya kehilangan gradien tanpa
 * error. Itu bukan sebuah tes, melainkan memindahkan komponen.
 *
 * Kontrak kedua di berkas ini: **header panel memakai media yang sama dengan
 * header `/belajar`**, bukan ramp statis yang "meniru" warnanya. Yang dikunci
 * hanya bentuk kodenya — video hero, ground ber-dot, fade batas bawah, dan
 * kontras tinta di atas ground — karena `DitheredHeroBackdrop` menggambar lewat
 * WebGL dan tidak ada gerbang repo yang bisa melihat apa yang benar-benar
 * dirender. Kontras yang dihitung di bawah memakai ground yang paling gelap
 * SEBAGAI batas bawah: video bisa lebih gelap dari ground itu, dan angka
 * ~(5.9–7.7):1 yang diuji di sini tetap menyisakan ruang yang lega.
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
/** Pita header bersama. Resep medianya (ground, dot grid, dither, veil, fade)
 *  tinggal di sini sekarang, jadi tes yang menjaganya harus menunjuk ke sini —
 *  bukan ke konsumennya, yang hanya memanggil komponennya. */
const PITA = tanpaKomentar(join(AKAR, "src/components/ui/pita-header-dither.tsx"));
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

describe('kartu "Cocok Untukmu" — permukaan', () => {
  it("memakai resep tile bento, bukan gradien sendiri", () => {
    expect(KELAS_KARTU, 'className kartu "Cocok Untukmu" tidak ditemukan').not.toBe("");
    expect(KELAS_KARTU).toContain("dash-card");
  });

  it("memakai media header `/belajar` yang sama, bukan ramp statis azure", () => {
    /* Header menolak `bg-white` polos karena kartu-kartunya sudah bergradien
       biru: header putih + kartu biru + container putih menghasilkan panel yang
       tidak punya hierarki — tidak ada yang jadi kepala.

       Versi sebelumnya menyelesaikan itu dengan ramp azure statis yang
       "meniru identitas" header `/belajar`. Ramp itu keliru, dan tidak ada
       gerbang mana pun yang bisa melihatnya: `typecheck`, `lint`, `vitest`, dan
       `build` semuanya hijau baiklah pita itu warna biru tuang atau video
       dithered yang bergerak.

       Yang dikunci di sini adalah MEDIA-nya, karena tiga lapis bisa hilang
       tanpa satu pun tes lain gagal:

       1. **Bukan ramp statis.** Warna cyan bisa menyamar sebagai identitas
          `/belajar`, padahal header itu tidak punya ramp sama sekali — ia punya
          video. Pita ini harus benar-benar memuat `DitheredHeroBackdrop` dengan
          sumber dan parameter yang sama seperti header hero.
       2. **Ground dan dot grid tidak boleh hilang.** Tanpa WebGL, canvas
          kembali transparan (lihat `dithered-hero-backdrop.tsx`); tanpa ground
          dan dot grid, header jatuh ke polos dan efek bitnya hilang total. Ini
          susunan yang sama dengan `detail-kursus.tsx`.
       3. **Fade batas bawah harus tetap ada.** DESIGN.md mengizinkan satu-satunya
          scrim pada hero media, dan itu fade batas bawah. Hilang, header
          berhenti menyambung ke daftar kartu dan kembali jadi kotak yang ditempel. */
    expect(PITA, "header media tidak ditemukan").toContain(
      "DitheredHeroBackdrop",
    );
    // Pita ini harus benar-benar DIPAKAI oleh konsumennya; kalau tidak, resepnya
    // benar tapi tidak ada di layar.
    expect(REKOMENDASI, "panel loker tidak memakai pita header").toContain(
      "PitaHeaderDither",
    );
    // Sumber yang sama dengan header hero — bukan field procedural default,
    // yang menghasilkan oceanic gelap yang tidak terlihat di `/belajar`.
    expect(PITA).toContain('videoSrc="/videos/hero-sterly.mp4"');
    // Ground + dot grid: fallback dither ketika WebGL tidak tersedia.
    expect(PITA).toMatch(
      /bg-\[size:3px_3px\] \[background-image:radial-gradient/,
    );
    // Fade batas bawah ke daftar kartu.
    expect(PITA).toMatch(/bg-gradient-to-t from-white/);
    // Jendela video harus cukup tinggi dari atas untuk melewati langit pekat:
    // `focusY` di bawah 0.5 berarti pita mulai di paruh langit yang pekat.

    /* Teks jadi tinta gelap, bukan putih. Itu konsekuensi langsung dari media
       yang sekarang terang: putih di atas field pucat ~1.1:1, dan angka yang
       sama sudah tercatat di banner AI `belajar-home.tsx`. Menahan teks putih
       berarti menaruh scrim gelap penuh di atas media, dan itu persis yang
       dilarang DESIGN.md ("Do not add a full-surface scrim or image opacity
       overlay").

       `KELAS_JUDUL` diambil dari markup, karena `text-white` sendirinya tidak
       membuktikan apa pun — ia pernah muncul di header DAN di empat kartu. */
    const judul = REKOMENDASI.match(/<h2 className="([^"]*)"/)?.[1] ?? "";
    expect(judul, 'className judul "Cocok Untukmu" tidak ditemukan').not.toBe("");
    expect(judul).toMatch(/text-\[#0a3d62\]/);
    expect(judul, "judul di atas media terang tidak boleh putih").not.toMatch(
      /text-white/,
    );

    // Subtitle 11.5px: tinta, bukan putih dan bukan alpha dari putih.
    expect(REKOMENDASI).toMatch(
      /text-\[11\.5px\] leading-relaxed text-\[#1e293b\]/,
    );
    expect(REKOMENDASI).not.toMatch(/text-white\/9/);

    /* Biru merek DILETAKKAN di pita header saja, bukan di seluruh berkas.
       Monogram, `group-hover` judul lowongan, dan tautan "Preferensi profil"
       di footer semuanya duduk di atas putih atau kartu pucat, dan di sana
       `#0066ff` justru benar — jadi `not.toMatch` lintas seluruh berkas akan
       menuduh kode yang tidak salah. Yang diuji: dari pita header sampai ke
       daftar kartu, tidak ada biru merek yang beradu dengan medianya. */
    const mulai = REKOMENDASI.indexOf("PitaHeaderDither");
    const akhir = REKOMENDASI.indexOf("snap-x snap-mandatory");
    expect(mulai, "pita header tidak ditemukan").toBeGreaterThan(-1);
    expect(akhir, "daftar kartu tidak ditemukan").toBeGreaterThan(mulai);
    expect(REKOMENDASI.slice(mulai, akhir)).not.toMatch(/#0066ff/);
  });

  it("memotong video jauh dari langit pekat DAN dari kanopi gelap", () => {
    /* Crop video, dikunci pada dua batas sekaligus — dan batas keduanya yang
       membuat tes ini berbeda dari versi sebelumnya.

       Video `/videos/hero-sterly.mp4` 1440x560 punya dua area gelap, bukan
       satu:

         - langit biru pekat di ~72% atas (L rata-rata ~0.41-0.46), dan
         - **kanopi gelap** yang mulai di sekitar baris 505: rata-rata L turun
           dari 0.813 di baris 460 ke 0.334 di baris 540, dan inti gelapnya
           (rata-rata < 0.60) mulai baris 513.

       Versi sebelumnya hanya menguji batas pertama (`focusY >= 0.6`, "jangan
       mulai dari langit") dan karena itu meloloskan crop 1.9/0.85 — jendela
       baris ~476-572, yaitu KANOPI, bukan cakrawala. Terukur: piksel tergelap
       di pita itu L=0.000 di sebagian frame, dan dengan veil 0.44/0.58/0.82
       pun judulnya hanya 4.17:1 di lebar 373px — di bawah AA. Tidak ada gerbang
       repo yang bisa melihatnya.

       Veil TIDAK bisa menolong: ia lapisan putih RATA, jadi ia menaikkan
       seluruh bidang sama rata dan piksel tergelap tetap menentukan kontras.
       Karena itu crop-nya yang harus benar lebih dulu.

       Yang dikunci: jendela yang dihasilkan harus (a) mulai di bawah langit
       pekat dan (b) berhenti sebelum kanopi. Batas (b) diuji lewat tinggi
       jendela pada tinggi pita yang nyata (`h-[72px]` + pin `-top-2`), karena
       `focusY` saja tidak menentukan di mana jendela berakhir.

       Catatan kejujuran soal batas ini: batas geometris di bawah adalah penjaga
       KASAR untuk "jangan menyentuh kanopi". Jaminan yang sebenarnya adalah
       pengukuran piksel langsung di enam geometri band (309-1312px lebar,
       58-115px tinggi) dan empat frame, yang hasilnya ditulis di
       `pita-header-dither.tsx`: judul 6.81:1-7.56:1, subtitle 8.81:1-9.78:1.
       Jendela pada lebar 309px memang berakhir di baris ~474, dan itu lolos
       karena baris-baris itu masih rata-rata > 0.75 dan tertutup fade bawah;
       yang tidak boleh adalah masuk ke INTI kanopi. */
    const crop = PITA.match(/zoom=\{([\d.]+)\}[\s\S]*?focusY=\{([\d.]+)\}/);
    expect(crop, "crop video header tidak ditemukan").not.toBeNull();
    const zoom = Number(crop?.[1]);
    const focusY = Number(crop?.[2]);

    // Sumber video dan tinggi pitanya harus tetap seperti yang diukur.
    const SRC_H = 560;
    const BAND = 72; // `h-[72px]` di pemanggil
    const PIN = 8; // `-top-2`
    const tinggiTerukur = BAND + PIN;

    // Ujung inti kanopi (rata-rata < 0.60 mulai baris 513), dengan sedikit
    // margin supaya penyetelan tidak rapuh.
    const KANOPI = 505;

    for (const lebar of [309, 948, 1120]) {
      const scale = Math.max(lebar / 1440, tinggiTerukur / SRC_H) * zoom;
      const rows = tinggiTerukur / scale;
      const top = (SRC_H * scale - tinggiTerukur) * focusY / scale;
      expect(
        top + rows,
        `jendela ${lebar}px berakhir di baris ${(top + rows).toFixed(0)} — ` +
          `inti kanopi gelap mulai ~${KANOPI}, jadi daun gelap masuk ke pita`,
      ).toBeLessThan(KANOPI);
      expect(
        top,
        `jendela ${lebar}px mulai di baris ${top.toFixed(0)} — masih langit pekat`,
      ).toBeGreaterThan(200);
    }

    expect(
      focusY,
      `focusY=${focusY} memulai jendela terlalu dekat dengan langit pekat`,
    ).toBeGreaterThanOrEqual(0.6);
  });

  it("menutup media dengan veil vertikal, bukan oval atau rata", () => {
    /* "Ada overlay yang terlihat seperti di luar kontainer" adalah VEIL-nya,
       bukan geometrinya. Panel sudah `overflow: hidden` dengan radius 26px dan
       media terukur pas di dalamnya — inset 1px dari border, tanpa yang keluar
       satu piksel pun. Yang "keluar" adalah layer putih yang menumpuk di atas.

       Dua bentuk yang salah, dan keduanya pernah ada di berkas ini:

       1. **Halo radial `bg-[radial-gradient(…)]`**, disalin dari header halaman
          penuh. Elips sepanjang itu tidak pernah habis di dalam kotak, jadi
          transisinya terbaca sebagai OVAL PUTIH di atas gambar — itulah yang
          terlihat seperti overlay. Pola yang dicari di sini `bg-[radial-gradient`
          DAN bukan `radial-gradient` biasa: dot grid 3px pada ground juga memakai
          `radial-gradient`, dan itu wajib ada sebagai fallback dither.
       2. **Veil rata.** Tidak ada blob-nya, tapi separuh bawah pita berisi daun
          di garis cakrawala yang gelap; pada 0.52 daun itu turun ke 4.23:1 untuk
          tinta judul — di bawah AA.

       Yang benar adalah gradien VERTIKAL: tidak ada tepi melengkung yang bisa
       terbaca sebagai oval, dan alphanya naik ke bawah tepat di tempat piksel
       tergelap itu berada. */
    expect(PITA, "pita header tidak ditemukan").not.toBe("");

    // Hanya `bg-[radial-gradient`, bukan `radial-gradient` polos: dot grid 3px
    // pada ground juga memakainya dan itu memang harus ada.
    expect(
      PITA,
      "halo radial di header = oval putih yang menumpuk di atas gambar",
    ).not.toMatch(/bg-\[radial-gradient/);

    // Veil rata tidak menutupi daun gelap di garis cakrawala.
    expect(
      PITA,
      "veil rata tidak menutupi daun gelap di garis cakrawala",
    ).not.toMatch(/absolute inset-0 bg-white\/\d/);

    const veil =
      PITA.match(/bg-\[linear-gradient\(180deg,([^\]]*)\)\]/)?.[1] ?? "";
    expect(veil, "veil vertikal tidak ditemukan").not.toBe("");

    /* Alphanya harus NAIK monoton ke bawah, dan stop paling dasar harus pekat.
       Keduanya angka, bukan selera: stop dasar itulah yang menutup baris
       terbawah pita, dan alphanya yang turun kembali di dasar akan membiarkan
       baris subtitle berdiri di atas piksel tergelap tanpa tambahan
       perlindungan. */
    const alphas = [...veil.matchAll(/rgba\(255,255,255,([\d.]+)\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(alphas.length, "stop veil tidak ditemukan").toBeGreaterThanOrEqual(3);
    expect(
      alphas[alphas.length - 1],
      `alpha dasar veil ${alphas[alphas.length - 1]} tidak menutup baris terbawah pita`,
    ).toBeGreaterThanOrEqual(0.75);
    for (let i = 1; i < alphas.length; i++) {
      expect(
        alphas[i],
        `veil harus naik monoton ke bawah; alpha ${alphas[i - 1]} -> ${alphas[i]}`,
      ).toBeGreaterThan(alphas[i - 1]);
    }
  });

  it("memotong media dengan clip lokal, tidak hanya mengandalkan overflow kontainer", () => {
    /* Pin `-top-2`: media sengaja 8px lebih tinggi dari pita supaya tepi
       atasnya (tempat stipple paling rapat) tidak menempel di sudut membulat
       kontainer. Konsekuensinya 8px itu HARUS benar-benar terpotong.

       `overflow: hidden` pada kontainer ber-radius tidak selalu mengikuti
       `border-radius` — pada sebagian compositor ia memotong pada border-box,
       jadi stipple-nya terlihat menyembul di sudut. `overflow-clip` di pita
       itu sendiri yang menegaskannya secara lokal, dan itulah bedanya dengan
       versi sebelumnya yang hanya menumpuk pada `overflow-hidden` induknya. */
    expect(PITA, "pita tidak memakai clip lokal").toMatch(/overflow-clip/);
    expect(
      PITA,
      "media tidak dipindah turun dari tepi atas pita",
    ).toMatch(/-top-\d/);
    // Kontainernya juga harus tetap memotong: pita ini menempel ke tepi kartu.
    expect(REKOMENDASI).toMatch(/overflow-clip|overflow-hidden/);
  });

  it("menutup pita dengan lembar putih berujung membulat yang menumpuknya", () => {
    /* Header berakhir di udara kalau isi di bawahnya cuma blok putih rata:
       pita biru menyambung ke putih tanpa sendi, dan panelnya kembali jadi
       kotak yang ditempel (kritik yang sama dengan header lama di komentar
       atas). Yang menyambungnya adalah LEMBAR dengan sudut atas membulat yang
       MENUMPUK pita.

       Empat kelasnya satu paket, dan tiap satu bisa hilang tanpa satu pun
       gerbang repo gagal — `typecheck`, `lint`, `vitest`, `build` semuanya
       hijau baiklah sudutnya membulat atau kotak:

         - `rounded-t-2xl` — lengkungnya sendiri (16px, lantai radius
           DESIGN.md);
         - `-mt-4` — tumpangannya. Ini yang membuat lengkungnya TERBACA:
           tanpa negatif margin, radiusnya cuma membulat di atas putih
           kontainer dan tak terlihat. Tumpangan harus >= radius supaya
           lengkung penuhnya menyingkap pita (kalau tidak, tepi lurusnya
           masih menutup sebagian sudut);
         - `bg-white` — menutup bagian pita yang ditumpuk;
         - `relative` + `z-10` — pitanya `relative`, jadi tanpa `z-10` pita
           menimpa lembar dan lembar (beserta subtitle) hilang di baliknya. */
    const lembar =
      (REKOMENDASI.match(/className="[^"]*"/g) ?? []).find((k) =>
        k.includes("rounded-t-2xl"),
      ) ?? "";
    expect(lembar, "lembar putih berujung membulat tidak ditemukan").not.toBe(
      "",
    );

    // Tumpangan: `-mt-N` dengan N (kali 4px) minimal sebesar radius 16px,
    // supaya lengkung penuh menyingkap pita.
    const tumpang = lembar.match(/(?<![\w:-])-mt-(\d+)/)?.[1];
    expect(tumpang, "lembar tidak menumpuk pita").not.toBeUndefined();
    expect(
      Number(tumpang) * 4,
      `-mt-${tumpang} hanya menumpuk ${Number(tumpang) * 4}px, kurang dari radius 16px`,
    ).toBeGreaterThanOrEqual(16);

    expect(lembar, "lembar tidak menutup pita dengan putih").toMatch(
      /\bbg-white\b/,
    );
    // `relative` + `z-10` — tanpa keduanya pita yang juga `relative` menimpa
    // lembar (urutan cat untuk descendant berposisi = urutan dokumen).
    expect(lembar, "lembar tidak diposisikan").toMatch(/(?<![\w:-])relative/);
    expect(lembar, "lembar tidak dinaikkan di atas pita").toMatch(/z-10/);

    // Lembar harus benar-benar ada di markup SEBELUM daftar kartu: kalau tidak,
    // "lembar" ini cuma div dekoratif dan isinya tidak ikut membulat.
    const idxLembar = REKOMENDASI.indexOf("rounded-t-2xl");
    const idxDaftar = REKOMENDASI.indexOf("snap-x snap-mandatory");
    expect(idxLembar, "lembar putih tidak ditemukan").toBeGreaterThan(-1);
    expect(idxDaftar, "daftar kartu tidak ditemukan").toBeGreaterThan(idxLembar);
  });

  it("memakai tinta yang tetap terbaca di atas ground pucat", () => {
    /* Yang sebelumnya diuji lewat ramp gelap (putih di stop TERANGEST >= 4.5:1)
       kini diuji lewat ground terang: tinta di stop ground yang paling gelap.

       Ground ini disembunyikan di belakang video selama WebGL hidup, jadi ia
       hanya yang tampil ketika canvas transparan — tanpa WebGL, atau sebelum
       frame pertama tergambar. Itulah yang membuat tes ini tetap berarti: ground
       adalah batas bawah yang dijamin, sedangkan media bergerak tidak bisa
       dijamin dari kode.

       Gradiennya disalin apa adanya dari `detail-kursus.tsx`, jadi kalau di sini
       ditulis ulang, angka di bawah ikut basi tanpa ada yang memberitahu — dan
       angka itulah yang sedang diuji.

       Untuk batas atas (media video yang benar-benar dirender) tidak ada tes
       yang bisa mengukurnya: canvas WebGL tidak bisa dibaca tanpa
       `preserveDrawingBuffer`, dan tidak ada gate yang menjalankan browser.
       Pengukurannya manual, dan hasilnya ditulis di komentar `pita-header-dither.tsx`:
       dengan crop zoom=2.6/focusY=0.8, piksel tergelap yang TERLIHAT adalah
       L=0.568-0.652 di enam geometri band (309-1312px lebar, 58-115px tinggi),
       yaitu 6.81:1-7.56:1 untuk judul dan 8.81:1-9.78:1 untuk subtitle, stabil
       di empat frame berurutan. */
    const ground = /bg-\[linear-gradient\(170deg,([^\]]*)\)\]/.exec(PITA);
    expect(ground, "ground header tidak ditemukan").not.toBeNull();
    const stops = [...(ground?.[1] ?? "").matchAll(/#([0-9A-Fa-f]{6})/g)].map(
      (m) => m[1],
    );
    expect(stops.length, "stop ground tidak ditemukan").toBeGreaterThanOrEqual(2);

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
        kontras(tinta, palingGelap),
        `${nama} ${tinta} gagal 4.5:1 di stop ground paling gelap #${palingGelap}`,
      ).toBeGreaterThanOrEqual(4.5);
    }

    /* Tautan "Ubah" juga teks 11.5px, tapi ia satu-satunya bagian header yang
       TIDAK boleh mengukur kontrasnya terhadap media. Biru merek `#0056D2`
       hanya 3.37:1 di stop ground paling gelap, jadi sebagai teks telanjang di
       atas media ia gagal 4.5:1 — angka ini dihitung, bukan diperkirakan,
       dan persis kesalahan yang membuat ramp lama menyimpan klaim kontras yang
       tidak pernah diverifikasi. Karena itu tautannya duduk di `bg-white` penuh:
       di sana `#0056D2` 6.0:1, dan bentuknya jadi tombol aksi.

       Yang dikunci: chip putih itu HARUS penuh. `bg-white/80` di atas media
       bergerak tidak bisa dijamin — frame video yang lebih gelap dari ground
       akan menarik kontras turun lagi tanpa satu pun gerbang melihatnya. */
    const tautan = REKOMENDASI.match(/justify-end gap-0\.5 rounded-md[^"]*"/)?.[0] ?? "";
    expect(tautan, 'className tautan "Ubah" tidak ditemukan').not.toBe("");
    const biruTautan = tautan.match(/text-\[#([0-9A-Fa-f]{6})\]/)?.[1];
    expect(biruTautan, "tautan Ubah tidak memakai warna hex").not.toBeUndefined();
    expect(
      kontras(`#${biruTautan}`, "#ffffff"),
      `tautan "Ubah" #${biruTautan} gagal 4.5:1 di atas chip putihnya`,
    ).toBeGreaterThanOrEqual(4.5);
    // Chip putih, bukan putih translusen di atas media bergerak.
    expect(tautan).toMatch(/\bbg-white\b/);
    expect(tautan).not.toMatch(/bg-white\/\d/);
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
