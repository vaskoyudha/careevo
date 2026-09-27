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

  it("menghancurkan tampilan saat unmount", () => {
    // Tanpa destroy, setiap buka halaman menambah satu EditorView yang terus
    // memegang listener.
    expect(sumber).toContain("view.destroy()");
  });

  it("menyertakan label aksesibel pada area edit", () => {
    expect(sumber).toContain("contentAttributes");
    expect(sumber).toContain("aria-label");
  });

  it("tidak memakai pelengkapan otomatis", () => {
    // Autocomplete adalah non-tujuan spec. Memakainya menambah bobot bundel
    // tanpa diminta, jadi absennya harus terkunci test.
    expect(sumber).not.toContain("@codemirror/autocomplete");
    expect(sumber).not.toContain("autocompletion");
  });
});
