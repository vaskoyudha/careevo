import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sumber = readFileSync(
  fileURLToPath(new URL("../../components/features/learning/kode-view.tsx", import.meta.url)),
  "utf8",
);

describe("KodeView sebagai berkas sumber", () => {
  it("memakai CodeMirror dengan tata bahasa C++, bukan textarea", () => {
    // P1 spec: satu highlighter untuk baca dan tulis. Kalau jalur baca memakai
    // highlighter lain, peserta belajar dari kode yang tidak sama dengan yang
    // dia jalankan.
    expect(sumber).toContain('from "@codemirror/view"');
    expect(sumber).toContain('from "@codemirror/lang-cpp"');
    expect(sumber).not.toContain("<textarea");
  });

  it("tidak memakai dangerouslySetInnerHTML", () => {
    expect(sumber).not.toContain("dangerouslySetInnerHTML");
  });

  it("membangun EditorView di dalam useEffect, bukan saat render", () => {
    // CodeMirror mengukur DOM saat dibangun. Membangunnya saat render atau di
    // lingkup modul berarti menjalankannya saat server merender, dan itu
    // menjatuhkan build.
    //
    // Uji ini pernah membandingkan dua `indexOf`, dan itu tidak berguna:
    // `indexOf("useEffect")` yang pertama adalah baris `import`, jadi
    // pembandingannya selalu benar. Yang dikunci di sini adalah bentuknya —
    // konstruksi berada di dalam `useEffect` yang larik dependensinya kosong,
    // jadi ia dibangun sekali saat mount. construction di dalam efek lain yang
    // punya dependensi akan membangun ulang tampilan tiap `kode` berubah.
    expect(sumber).toMatch(/useEffect\(\(\) => \{[\s\S]*?new EditorView\([\s\S]*?\}, \[\]\);/);
  });

  it("wadah kode tidak ikut bergulir; yang bergulir adalah scroller CodeMirror", () => {
    // `scrollDOM` CodeMirror adalah `.cm-scroller`. Kalau `.kode-view` yang
    // diberi `overflow`, `scrollIntoView` menulis ke `scrollTop` yang selalu 0
    // dan kursor tidak pernah terlihat. typecheck, lint, vitest, dan build
    // semuanya buta terhadap ini, jadi sifatnya harus dikunci dari sumber.
    const css = readFileSync(
      fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
      "utf8",
    );
    const blok = css.match(/\.kode-view \{([\s\S]*?)\n\}/);
    expect(blok).not.toBeNull();
    expect(blok![1]).not.toContain("overflow");
    // `min-height` memaksa celah kosong di bawah cuplikan pendek; yang membatasi
    // adalah `max-height` pada scroller.
    expect(blok![1]).not.toContain("min-height");
    expect(css).toMatch(/\.kode-view \.cm-scroller \{[^}]*max-height/);
  });

  it("mewarnai token, bukan hanya memasang gramatika", () => {
    // `cpp()` hanya memberi gramatika dan parser. Tanpa `HighlightStyle` tidak
    // ada satu pun token yang diberi warna, dan blok kode tampil sebagai teks
    // polos di atas permukaan gelap. Uji "memakai tata bahasa C++" di atas
    // tidak menangkap ini: gramatika yang terpasang bukan bukti bahwa ada
    // warna, dan itulah yang membuat cacat ini bisa hijau selama satu task
    // penuh. Yang dipatok di sini adalah jalurnya sampai ke ekstensi.
    expect(sumber).toContain('from "@codemirror/language"');
    expect(sumber).toMatch(/HighlightStyle\.define\(/);
    expect(sumber).toMatch(/syntaxHighlighting\(\s*GAYA_SOROTAN\s*\)/);

    // Palet harus milik repo. `defaultHighlightStyle` membawa set warna asing
    // yang bukan warna repo ini, persis yang dihindari oleh `TEMA`.
    expect(sumber).not.toContain("defaultHighlightStyle");

    // Warna token memakai tag asli dari `@lezer/highlight`, bukan nama tag yang
    // diketik tangan.
    expect(sumber).toContain('from "@lezer/highlight"');
    expect(sumber).toMatch(/\btags\.[a-zA-Z]+/);
  });

  it("menghancurkan tampilan saat unmount", () => {
    // Tanpa destroy, setiap buka halaman menambah satu EditorView yang terus
    // memegang listener.
    expect(sumber).toContain("view.destroy()");
  });

  it("menyertakan label aksesibel pada area edit", () => {
    expect(sumber).toContain("contentAttributes");
    expect(sumber).toContain("aria-label");
  });

  it("membuat area baca bisa diakses keyboard, dan hanya itu", () => {
    // `EditorView.editable.of(false)` menulis `contenteditable="false"` pada
    // `.cm-content` tetapi tidak pernah menulis `tabindex`; satu-satunya
    // `tabIndex` yang ia pasang adalah `scrollDOM.tabIndex = -1`. Hasilnya
    // `div[contenteditable=false]` tanpa `tabindex`: keluar dari urutan tab DAN
    // menolak fokus terprogram. Blok kode yang lebih tinggi dari kotaknya —
    // 5862px isi dalam kotak 432px — jadi hanya bisa digulir dengan tetikus.
    // WCAG 2.1.1.
    //
    // Sifatnya diuji dari sumber karena `env: node` tanpa jsdom: tidak ada DOM
    // di suite ini, dan `typecheck`/lint/build semuanya buta terhadap isi
    // `contentAttributes`. Pola yang sama dipakai test "wadah kode tidak ikut
    // bergulir" di berkas ini.
    expect(sumber).toMatch(/editable \? \{\} : \{ tabindex: "0" \}/);
    // Dan `contentAttributes` harus berada di dalam `sifat`, bukan facet terpisah
    // di luar compartment — kalau tidak, `tabindex` dipasang sekali saat mount
    // dan tidak ikut berubah bersama `editable`.
    const sifat = sumber.match(/function sifat\([\s\S]*?\n\}/);
    expect(sifat).not.toBeNull();
    expect(sifat![0]).toContain("contentAttributes");
  });

  it("tidak membuka mode baca supaya bisa fokus", () => {
    // Kontra dari test di atas. Menambah `tabindex` bukan membuat blok bisa
    // diedit. `editable` dan `readOnly` tetap menentukan perubahan dokumen;
    // kalau salah satu dilonggarkan demi membuat fokus bekerja, peserta bisa
    // mengetik ke blok baca.
    const sifat = sumber.match(/function sifat\([\s\S]*?\n\}/);
    expect(sifat![0]).toContain("EditorState.readOnly.of(!editable)");
    expect(sifat![0]).toContain("EditorView.editable.of(editable)");
    // `editable` tidak boleh di-default-kan ke true di level modul; default
    // komponennya `false` dan itu yang dipakai jalur baca.
    expect(sumber).toMatch(/editable = false/);
  });

  it("memberi cincin fokus yang terlihat di permukaan gelap", () => {
    // Tanpa ini, memperbaiki "tidak terjangkau" hanya menjadi "terjangkau tapi
    // tak terlihat": `&.cm-focused { outline: "none" }` mematikan cincin bawaan
    // CodeMirror, dan baseTheme CodeMirror menulis `outline: none` pada
    // `.cm-content`, jadi tidak ada cincin apa pun yang tersisa. WCAG 2.4.7.
    //
    // Cincinnya `box-shadow` inset pada wadahnya, bukan `outline` pada
    // `.cm-content`: outline di dalam kotak menutupi karakter pertama tiap
    // baris, dan outline pada elemen di dalam `overflow: auto` terpotong tepi
    // scroller. Warna `#7dd3fc` kontrasnya 5.34:1 terhadap `#06202f`.
    const cincin = sumber.match(/"&:has\(\.cm-content\[tabindex\]\):focus-within": \{[\s\S]*?\}/);
    expect(cincin).not.toBeNull();
    expect(cincin![0]).toContain("boxShadow: \"inset 0 0 0 2px #7dd3fc\"");
    // Selektornya harus memuat `tabindex`, supaya atribut yang sama dengan
    // `contentAttributes` yang menjadi satu-satunya penanda mode baca.
    expect(cincin![0]).toContain(".cm-content[tabindex]");
  });

  it("tidak memakai pelengkapan otomatis", () => {
    // Autocomplete adalah non-tujuan spec. Memakainya menambah bobot bundel
    // tanpa diminta, jadi absennya harus terkunci test.
    expect(sumber).not.toContain("@codemirror/autocomplete");
    expect(sumber).not.toContain("autocompletion");
  });

  it("menjalankan lewat server, tidak pernah menjalankan apa pun di peramban", () => {
    // P3 spec. Komponen ini klien; ia tidak boleh punya cara menjalankan
    // program. Yang boleh ada hanyalah `fetch` ke route yang sudah digerbang.
    // Sifat ini mustahil diuji `typecheck`/lint/build: `import("node:child_process")`
    // di komponen klien tetap lolos keduanya dan hanya meledak saat bundling.
    // URL-nya dipatok sebagai literal panggilan, bukan sebagai substring.
    // `toContain("/api/jalankan")` ikut cocok untuk `/api/jalankan-lama` dan
    // untuk route mati apa pun yang namanya berawalan sama — semuanya hijau
    // untuk alamat yang tidak pernah ada.
    expect(sumber).toContain('fetch("/api/jalankan"');
    expect(sumber).toContain('method: "POST"');
    expect(sumber).not.toContain("child_process");
    expect(sumber).not.toContain("podman");
    // Bentuk lain dari yang sama: membuat proses tanpa `child_process` masih
    // mungkin lewat `spawn`/`execSync` yang diimpor dengan nama lain.
    expect(sumber).not.toMatch(/\b(spawn|spawnSync|execFile|execFileSync|execSync)\b/);
  });

  it("mengirim nama field body yang benar, yaitu dapatDijalankan", () => {
    // Nama field di badan adalah `z.literal(true)` di `skemaTubuh` route.
    // Ejaan yang berbeda tidak akan terlihat sebagai galat tipe di mana pun:
    // `JSON.stringify` menerima objek apa pun, dan route menjawab 400 dengan
    // pesan yang tidak menyebut nama fieldnya. Gejalanya "tombol selalu gagal".
    //
    // Karena itu bentuk yang benar dikunci, dan bentuk yang salah dilarang
    // muncul sebagai kunci objek — dokumenasi JSDoc boleh menyebutnya, kode
    // tidak boleh mengirimnya.
    expect(sumber).toMatch(/dapatDijalankan: true/);
    expect(sumber).not.toMatch(/dapatJalankan\s*:/);
  });

  it("menyimpan ruang latihan lewat helper persistent yang sudah ada", () => {
    // P5 spec. Helper repo bukan soal gaya: keduanya berkoordinasi lewat satu
    // `EventTarget` modul, jadi setiap komponen yang memakai kunci sama ikut
    // tahu saat nilainya berubah. Panggilan `localStorage` mentah tidak
    // memberi tahu siapa pun.
    expect(sumber).toContain("usePersistentValue");
    expect(sumber).toContain("setPersistentValue");
    // Bentuk mentah apa pun yang menembus helper tetap dilarang. Polanya yang
    // dikunci, bukan kata "localStorage" secara harfiah, supaya catatan prosa
    // tentang tempat penyimpanan tidak ikut gagal.
    expect(sumber).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear|key)\b/);
    expect(sumber).not.toMatch(/\blocalStorage\s*\[/);
    // Kuncinya di-ruas, supaya tidak pernah bentrok dengan penyimpanan lain
    // yang bukan milik halaman materi.
    expect(sumber).toContain("careevo:kode:");
  });

  it("menyimpan ruang latihan saat mengetik, bukan hanya saat menekan Jalankan", () => {
    // Kalau disimpan hanya di handler tombol, mengedit lalu pindah halaman tanpa
    // menjalankan akan membuang seluruh pekerjaan peserta — dan tidak ada satu
    // test atau typecheck pun yang menangkapnya.
    const listener = sumber.match(/EditorView\.updateListener\.of\([\s\S]*?\}\),/);
    expect(listener).not.toBeNull();
    expect(listener![0]).toContain("setPersistentValue");
  });

  it("menjalankan teks ruang latihan, bukan kode prop", () => {
    // Kalau yang dikirim `kode` prop, peserta mengedit ruang latihan lalu menekan
    // Jalankan, dan program yang jalan bukan yang ada di layarnya. Tidak ada
    // yang di layar yang menunjukkan bedanya.
    expect(sumber).toMatch(/const teks = tersimpan \?\? kodeAwal \?\? kode;/);
    // `||` di titik yang sama berarti editor yang dikosongkan total akan
    // kembali menjalankan kode ahli.
    expect(sumber).not.toMatch(/tersimpan \|\|/);
  });

  it("menampilkan status lewat pemetaan, bukan exit code mentah", () => {
    // P4 spec. Angka exit dari podman tidak selalu berarti satu hal, dan
    // "137" tidak menjelaskan apa pun kepada peserta. Kalau UI membandingkan
    // `exitCode` sendiri, angka itu bocor ke layar.
    expect(sumber).toMatch(/petakanStatus\(/);
    expect(sumber).toContain('from "@/lib/exec/port"');
    // Bukan hanya tidak dibandingkan: nama fieldnya sendiri tidak boleh muncul,
    // karena satu rujukan yang tidak disengaja tidak bisa dipratinjau.
    expect(sumber).not.toContain("exitCode");
  });

  it("menampilkan pesan kompilator apa adanya, dengan nomor barisnya", () => {
    // Untuk `gagal_kompilasi`, `stderr` adalah pesan g++ lengkap, dan nomor
    // barisnya justru sinyalnya. Ringkasnya jadi "kode salah sintaks"
    // menghapus satu-satunya informasi yang berguna.
    //
    // Yang diuji di sini adalah bentuk render-nya: seluruh `stderr` masuk ke
    // `<pre>` yang mempertahankan baris baru, dan tidak ada pemotongan. both
    // diperiksa, sebab salah satu saja bisa lolos.
    expect(sumber).toMatch(/\{hasil\.stderr \? \(/);
    expect(sumber).toMatch(/whitespace-pre-wrap[\s\S]*?\{hasil\.stderr\}/);
    expect(sumber).not.toMatch(/hasil\.stderr\.(slice|substring|substr|trim|replace)\(/);
    // Label terpisah supaya output compiler tidak salah dibaca sebagai output
    // program.
    expect(sumber).toMatch(/dariKompilator: data\.status === "gagal_kompilasi"/);
  });

  it("menjelaskan saat layanannya yang bermasalah, bukan kodenya", () => {
    // `galat_runner` berarti tidak ada jawaban program sama sekali. Kalau pane
    // menulis seperti programnya gagal, peserta akan/debug program yang
    // sebenarnya belum pernah jalan.
    //
    // Jalur yang harus menghasilkan `galat_runner`: jaringan putus (catch) dan
    // balasan 200 tanpa `status`. Keduanya harus lewat `petakanStatus`, bukan
    // kalimat yang diketik sendiri di sini.
    expect(sumber).toMatch(/petakanStatus\("galat_runner"\)/);
    // `detail` itu "Coba lagi sebentar lagi." dan hanya tampil kalau dirender.
    // Tanpa baris ini, `batas_dilampaui` dan `galat_runner` kehilangan satu-
    // satunya petunjuk apa yang harus dilakukan peserta.
    expect(sumber).toMatch(/\{hasil\.detail \? \(/);
  });

  it("menampilkan pesan penolakan gerbang apa adanya", () => {
    // 401 sesi dan 429 rate limit menjawab `{ ok: false, error }` tanpa
    // `status`. Menemapkannya ke `galat_runner` berbohong dengan cara lain:
    // "layanan sedang tidak tersedia" untuk sesi yang habis mengarahkan
    // peserta ke programnya sendiri.
    expect(sumber).toMatch(/if \(!data\.ok\)/);
    expect(sumber).toContain("judul: data.error");
  });

  it("menampilkan tombol hanya untuk dapatJalankan === true", () => {
    // Kontrak fail-closed yang sama dengan `z.literal(true)` di server. Blok
    // yang sakelarnya mati harus tampil TANPA tombol, bukan dengan tombol yang
    // menolak saat diklik: tombol yang menolak masih mengiklankan fitur yang
    // tidak boleh dipakai.
    //
    // `=== true`, bukan kebenaran biasa. Prop-nya opsional, dan `undefined`
    // berarti tidak boleh dijalankan; `{dapatJalankan ? ...}` akan membukanya
    // untuk nilai apa pun yang bukan `false`.
    expect(sumber).toMatch(/dapatJalankan = false/);
    expect(sumber).toMatch(/dapatJalankan\?: boolean/);
    expect(sumber).toMatch(/\{dapatJalankan === true \?/);
    expect(sumber).not.toMatch(/\{\s*dapatJalankan \?/);
  });

  it("memakai warna chrome editor untuk terminal di susunan lab", () => {
    // Permintaan pemilik produk: kolom kanan harus terbaca sebagai **satu
    // terminal**, bukan editor gelap dengan kartu putih menempel di bawahnya.
    //
    // Permukaannya **diturunkan dari `susunan`**, bukan dari prop `tema`
    // tersendiri. Prop terpisah harus diingat di setiap pemanggil, dan yang
    // lupa memasangnya tidak menghasilkan error apa pun — hanya kartu putih
    // yang kembali. Yang dijaga di sini: `gelap` diikat ke `susunan === "lab"`.
    expect(sumber).toMatch(/const gelap = susunan === "lab"/);
    // Pane hasilnya **tidak** menggambar bingkai sendiri di lab: ia hidup di
    // dalam kartu Terminal, dan dua border bertumpuk terbaca sebagai kotak di
    // dalam kotak. Di jalur baca ia tetap kartu berbingkai putih.
    expect(sumber).toMatch(/gelap \? "" : "rounded-lg border border-gray-200 bg-white"/);
    // Teks hasilnya terang di atas latar gelap; `text-gray-800` akan hilang
    // di sana.
    expect(sumber).toContain('gelap ? "text-[#d7eef7]" : "text-gray-800"');
    // Tidak boleh ada prop `tema` yang menggantung tanpa dipasang pemanggil.
    expect(sumber).not.toMatch(/tema\?:/);
    expect(sumber).not.toMatch(/tema = "terang"/);
  });

  it("tidak menampilkan placeholder di area hasil", () => {
    // Permintaan pemilik produk: kotak ajakan "Tekan Jalankan …" dibuang.
    // Sebelum ada hasil, area hasil **kosong** — yang tampil hanya editor dan
    // bilah jalankan.
    //
    // Dijaga dari sumber karena `null` tidak pernah muncul di HTML hasil render:
    // yang bisa diperiksa hanyalah bahwa teks placeholder-nya benar-benar tidak
    // ada lagi di JSX. Kalimatnya dipecah supaya komentar ini sendiri tidak
    // ikut cocok dengan assertion-nya.
    const ajakan = ["untuk melihat keluaran", "program di sini"].join(" ");
    expect(sumber).not.toContain(ajakan);
    expect(sumber).not.toContain("Tekan{\" \"}");
  });

  it("membuat terminal lab bisa dilipat, tertutup saat dibuka", () => {
    // Permintaan pemilik produk: bilah keluaran di lab adalah **terminal yang
    // bisa dilipat**. Tiga perilaku yang dijaga di sini, semuanya properti yang
    // tidak akan gagal di `typecheck`/`lint`/render mana pun:
    //
    //  1. **Tertutup saat halaman dibuka** — sebelum dijalankan tidak ada yang
    //     bisa dibaca di sana.
    //  2. **Membuka sendiri saat `Jalankan`** — `setTerminalBuka(true)` dipanggil
    //     di dalam `jalankan`, sebelum `fetch`.
    //  3. **Bisa dibuka-tutup dari bilah kepalanya** — tombol dengan
    //     `aria-expanded`/`aria-controls`.
    expect(sumber).toMatch(/const \[terminalBuka, setTerminalBuka\] = useState\(false\)/);
    // Isinya disembunyikan lewat `hidden`, bukan dibuang: `aria-controls` yang
    // menunjuk id tidak ada melanggar ARIA.
    expect(sumber).toMatch(/id=\{idTerminal\}\s*\n\s*hidden=\{!terminalBuka\}/);
    // Auto-buka ada di jalur `jalankan`, sebelum permintaan jaringan dikirim.
    const jalankan = sumber.match(/const jalankan = useCallback\(async \(\) => \{[\s\S]*?\}, \[/);
    expect(jalankan, "fungsi jalankan tidak ditemukan").not.toBeNull();
    expect(jalankan![0]).toContain("setTerminalBuka(true)");
    expect(jalankan![0].indexOf("setTerminalBuka(true)")).toBeLessThan(
      jalankan![0].indexOf("await fetch("),
    );
    // Tombol lipatannya mengumumkan keadaannya.
    expect(sumber).toMatch(/aria-expanded=\{terminalBuka\}/);
    expect(sumber).toMatch(/aria-controls=\{idTerminal\}/);
  });

  it("membuat permukaan editor mengisi kolom, bukan setinggi isinya", () => {
    // Koreksi dari versi sebelumnya: "tinggi mengikuti isi kode" membuat kartu
    // hanya ~395px di dalam kolom 865px, jadi **470px ruang kosong** menganga
    // di bawah terminal — terbaca sebagai "ada yang belum termuat". Kolom kanan
    // lab adalah alat kerja; permukaan editornya memenuhi kolomnya seperti IDE.
    //
    // Dijaga dari sumber: properti CSS ini tidak akan gagal di
    // `typecheck`/`lint`/render mana pun — hanya terlihat di layar.
    expect(sumber).toMatch(/flex min-h-0 flex-1 flex-col gap-1\.5/);
    // Kartu editornya juga `flex-1` supaya mengisi kolom.
    expect(sumber).toMatch(
      /className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white\/10 bg-\[#06202f\]/,
    );
    // Tombol Jalankan pindah ke baris tab, bukan bilah terpisah di dasar kartu
    // (yang akan melayang jauh dari kode begitu editornya memenuhi kolom).
    expect(sumber).toMatch(/<header[^>]*>[\s\S]*?onClick=\{jalankan\}[\s\S]*?<\/header>/);
    const css = readFileSync(
      fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
      "utf8",
    );
    // Rantai flex-nya nyata: `.kode-view-lab` kolom flex, `.cm-editor` mengisi
    // sisanya, dan scroller-nya tetap punya lantai kerja.
    const blokLab = css.match(/\.kode-view-lab \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(blokLab).toMatch(/display: flex/);
    expect(blokLab).toMatch(/flex-direction: column/);
    expect(css).toMatch(/\.kode-view-lab \.cm-editor \{[\s\S]*?flex: 1 1 auto/);
    expect(css).toMatch(/\.kode-view-lab \.cm-scroller \{[\s\S]*?min-height: 260px/);
    // Batas atas tetapnya tidak lagi dipatok di sini — yang membatasi sekarang
    // tinggi kartu, yang berasal dari viewport.
    expect(css).not.toMatch(
      /\.kode-view-lab \.cm-scroller \{[\s\S]*?max-height: min\(62vh, 640px\)/,
    );
  });

  it("memberi warna status di <p>-nya sendiri, bukan lewat pewarisan", () => {
    // `globals.css` punya aturan dasar `p { color: var(--text) }`, dan itu
    // **lebih kuat** daripada warna yang diwariskan dari induknya. Judul status
    // yang hanya mengandalkan pewarisan tampil biru tua di atas latar gelap —
    // tidak terbaca — alih-alih merah/hijau. Bug ini tersembunyi selama pane-nya
    // kartu putih; ia baru muncul saat pane-nya jadi bagian terminal gelap.
    expect(sumber).toMatch(
      /<p className=\{cn\("text-xs font-semibold", GAYA_NADA\[hasil\.nada\]\(gelap\)\)\} role="status">/,
    );
  });
});

describe("Panggilan KodeView di dua jalur", () => {
  const halaman = readFileSync(
    fileURLToPath(
      new URL("../../components/features/learning/halaman-view.tsx", import.meta.url),
    ),
    "utf8",
  );
  const editor = readFileSync(
    fileURLToPath(
      new URL("../../components/features/admin/courses/blok-editor.tsx", import.meta.url),
    ),
    "utf8",
  );

  it("jalur peserta memakai blok.id sebagai kunci ruang latihan", () => {
    // Benar di sini: blok yang tampil di materi sudah tersimpan, jadi setiap
    // blok punya id sendiri.
    expect(halaman).toContain("kunci={blok.id}");
  });

  it("jalur admin memakai identitas lokal blok, bukan blok.id", () => {
    // `blok.id` di editor admin selalu `""` untuk blok yang belum disimpan, jadi
    // seluruh blok kode yang belum disimpan akan berbagi satu kunci ruang
    // latihan. Bentrok yang persis sama dengan yang `useKunciBlok` sudah
    // cegah untuk `key` React dan pasangan `htmlFor`/`id`.
    expect(editor).toContain("kunci={identitas}");
    expect(editor).not.toContain("kunci={blok.id}");
  });

  it("kedua jalur meneruskan kodeAwal, stdin, dan sakelar jalankan", () => {
    // Tanpa ini, `kodeAwal` hanya akan selalu `undefined` dan ruang latihan
    // selalu mulai dari kode contoh.
    expect(halaman).toContain("kodeAwal={blok.kodeAwal}");
    expect(halaman).toContain("stdin={blok.stdin}");
    // `=== true` lagi: `dapatDijalankan` di `BlokKode` itu opsional, dan blok
    // yang tidak pernah disentuh ahli tidak punya nilainya.
    expect(halaman).toContain("dapatJalankan={blok.dapatDijalankan === true}");
  });
});

describe("Editor admin bisa mengisi kodeAwal", () => {
  const editor = readFileSync(
    fileURLToPath(
      new URL("../../components/features/admin/courses/blok-editor.tsx", import.meta.url),
    ),
    "utf8",
  );

  it("punya field kodeAwal yang menulis lewat spread yang sama", () => {
    // Tanpa penghasil, `kodeAwal` di tipe dan di skema zod hanya bisa selalu
    // `undefined`, dan tidak ada blok yang bisa punya titik mulai berbeda.
    expect(editor).toContain("kodeAwal: event.target.value");
    expect(editor).toContain("htmlFor={`${identitas}-awal`}");
    expect(editor).toContain("id={`${identitas}-awal`}");
  });

  it("memberi label Bahasa Indonesia dan sejajar dengan tetangganya", () => {
    // Id baru harus memakai awalan `identitas`, bukan `blok.id`: pasangan
    // `htmlFor`/`id` yang menunjuk blok pertama akan membuat setiap label
    // "Masukan" menulis ke textarea blok pertama.
    expect(editor).toMatch(/Kode awal peserta/);
    // Field ini melintasi dua kolom, jadi butuh `sm:col-span-2`; tanpanya ia
    // hanya mengisi satu dari dua kolom yang sisa di baris itu.
    expect(editor).toMatch(/sm:col-span-2/);
  });
});

describe("BlokEditor memberi identitas lokal per blok", () => {
  const editor = readFileSync(
    fileURLToPath(
      new URL("../../components/features/admin/courses/blok-editor.tsx", import.meta.url),
    ),
    "utf8",
  );

  it("tidak lagi meng-key daftar blok dengan blok.id", () => {
    // Blok baru lahir dengan `id: ""` (`blokKosong(tipe, id = "")`), jadi
    // semua blok yang belum disimpan berbagi id kosong: `key` React kembar
    // (React membuang lalu membangun ulang subtree, jadi `EditorView` blok ikut
    // hilang bersama undo history-nya), pasangan `htmlFor`/`id` blok kode
    // semuanya menjadi `-stdin`/`-harapan`, dan `aria-label` bertabrakan.
    expect(editor).not.toContain("key={item.id}");
    expect(editor).toContain("key={kunci.dari(index)}");
  });

  it("tidak memakai blok.id untuk id DOM mana pun di editor", () => {
    // Satu mekanisme, tiga gejala. Kalau hanya `key` yang diperbaiki, dua
    // pasangan `htmlFor`/`id` blok kode tetap menunjuk textarea blok pertama
    // — dan itu harus terlihat di diff ini, bukan di review berikutnya.
    const sisa = editor.match(/`\$\{blok\.id\}/g) ?? [];
    // Tidak boleh ada satu pun id DOM yang masih diturunkan dari `blok.id`.
    // Sisa yang boleh ada hanya sebutan di komentar yang menjelaskan alasannya.
    expect(sisa).toEqual([]);
    expect(editor).toContain("htmlFor={`${identitas}-stdin`}");
    expect(editor).toContain("id={`${identitas}-harapan`}");
    expect(editor).toContain("label={`Kode contoh ${identitas}`}");
  });

  it("menyamakan kunci saat blok ditambah, dihapus, dan ditukar", () => {
    // Kunci harus tetap sejajar posisional dengan `blok`; kalau tidak, satu
    // blok bisa memakai identitas blok tetangganya. `perbarui` memang tidak
    // menyentuh daftar karena mengganti isi tidak mengubah identitas.
    expect(editor).toContain("kunci.tambah()");
    expect(editor).toContain("kunci.hapus(index)");
    expect(editor).toContain("kunci.tukar(index, tujuan)");
  });

  it("tidak menaruh identitas lokal ke dalam data yang disimpan", () => {
    // Identitas hanya hidup di state editor. Field baru di `BlokHalaman` akan
    // ikut ke `blokListSchema`, ke JSON hidden input, dan ke setiap renderer —
    // untuk sesuatu yang tidak dibaca siapa pun di luar editor. Blok yang
    // diserialisasi harus persis blok yang diedit, tanpa satu field tambahan.
    expect(editor).not.toContain("kunciAwal");
    const tape = editor.match(/JSON\.stringify\(/g) ?? [];
    expect(tape).toEqual([]);
  });
});
