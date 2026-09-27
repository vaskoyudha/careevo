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
