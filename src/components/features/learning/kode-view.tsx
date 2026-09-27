"use client";

import { useEffect, useRef } from "react";
import { cpp } from "@codemirror/lang-cpp";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { cn } from "@/lib/utils";
import type { BahasaKode } from "@/types/course";

/**
 * Satu komponen editor kode untuk baca dan tulis.
 *
 * **Kenapa satu komponen, bukan dua** (P1 spec). Kalau jalur baca memakai satu
 * highlighter dan jalur tulis memakai yang lain, keduanya pasti menyimpang, dan
 * peserta belajar dari kode yang tidak sama dengan yang dia jalankan. Sifat
 * `editable` hanya mengubah hak akses; gramatarnya sama.
 *
 * **Kenapa dibangun di dalam `useEffect`.** CodeMirror mengukur DOM saat
 * `EditorView` dibuat. Membangunnya saat render berarti menjalankannya saat
 * server merender, dan itu menjatuhkan build.
 *
 * Berkas ini tidak boleh mengimpor modul server. Ia dipanggil dari
 * `halaman-view.tsx` dan `blok-editor.tsx`, keduanya klien.
 */

/**
 * Tema gelap memakai palet ocean yang sudah ada di repo, bukan paket tema
 * tambahan.
 *
 * Permukaan kode sengaja gelap di dalam halaman yang terang. Kontras itu
 * adalah pemisahan visual antara "ini yang saya baca" dan "ini yang saya
 * jalankan". Warnanya diambil dari `.code-editor` di `globals.css` supaya tidak
 * lahir warna keempat untuk kode.
 */
const TEMA = EditorView.theme(
  {
    "&": { backgroundColor: "#06202f", color: "#d7eef7", fontSize: "13px" },
    ".cm-content": {
      fontFamily: "var(--font-mono)",
      caretColor: "#d7eef7",
      padding: "12px 0",
    },
    ".cm-gutters": { backgroundColor: "#06202f", color: "#5b7f92", border: "none" },
    ".cm-activeLine": { backgroundColor: "#0a2a3a" },
    ".cm-activeLineGutter": { backgroundColor: "#0a2a3a", color: "#d7eef7" },
    ".cm-cursor": { borderLeftColor: "#d7eef7" },
    // Cincin fokus **hanya di mode baca**.
    //
    // `tabindex="0"` pada `.cm-content` (lihat `sifat`) adalah satu-satunya
    // penanda mode baca di CSS, jadi atribut itu pula yang jadi selektor — bukan
    // kelas atau atribut kedua yang bisa melenceng dari `contentAttributes`.
    // `:focus-within`, bukan `&.cm-focused`: yang kedua hanya menyala bila
    // `document.hasFocus()` benar, dan itu bukan syarat yang boleh diandalkan
    // untuk indikator fokus.
    //
    // `box-shadow` inset pada wadahnya, bukan `outline` pada areanya, karena dua
    // hal yang keduanya bisa diukur: baseTheme CodeMirror sudah menulis
    // `outline: none` pada `.cm-content`, jadi outline di sana harus dipaksa dan
    // tetap menggambar di dalam kotak — yang berarti menutupi karakter pertama
    // tiap baris; dan `outline` pada elemen di dalam `overflow: auto` terpotong
    // tepi scroller, sehingga cincinnya tidak lengkap. Cincin inset hanya
    // memakai 2px di area bantalan dan tidak pernah menutupi kode.
    //
    // Warnanya `WARNA.kontrol`, kontras 5.34:1 terhadap `#06202f` — jauh di
    // atas ambang 3:1 untuk indikator fokus non-teks.
    "&:has(.cm-content[tabindex]):focus-within": {
      boxShadow: "inset 0 0 0 2px #7dd3fc",
    },
    // Cincin bawaan CodeMirror pada mode tulis sengaja dimatikan: kursor dan
    // sorotan baris aktif sudah menjadi penanda fokus di sana, dan cincin
    // `1px dotted #212121` hampir tidak terlihat di permukaan gelap ini. Mode
    // baca tidak punya kursor, jadi ia memakai cincin di atas.
    "&.cm-focused": { outline: "none" },
  },
  { dark: true },
);

/**
 * Warna token untuk sorotan sintaks.
 *
 * `cpp()` hanya menyediakan gramatika dan parser. Tanpa `HighlightStyle` tidak
 * ada satu pun token yang diberi warna: kodenya tampil sebagai teks polos
 * meski permukaannya gelap. Gramatika yang terpasang bukan bukti bahwa ada
 * warna.
 *
 * Semua warna diambil dari palet ocean yang sama dengan `TEMA`, jadi permukaan
 * dan isiannya satu keputusan, bukan dua. Angka dalam kurung adalah rasio
 * kontras WCAG terhadap permukaan `#06202f`; semuanya di atas 4.5:1 (AA) untuk
 * teks 13px. Tidak ada warna di `TEMA` yang disesuaikan untuk ini.
 */
const WARNA = {
  /** 5.34 — sengaja redup dari teks badan 13.91 supaya komentar mundur. */
  komentar: "#6f97ad",
  /** 10.03 — paling terang, karena ini alur programnya. */
  kontrol: "#7dd3fc",
  /** 7.72 — kata kunci deklarasi, lebih pelan dari kontrol. */
  kunci: "#2EC4B6",
  /** 8.27 — tipe dan namespace: bentuknya, bukan alurnya. */
  tipe: "#40C9C6",
  /** 9.28 — nama fungsi, dipanggil atau dideklarasikan. */
  fungsi: "#93c5fd",
  /** 7.76 — angka, karakter, dan preprosesor: satu keluaran hangat. */
  literal: "#E8A33D",
  /** 12.57 — string memakai palet repo `--sea-foam`, paling dekat ke teks badan. */
  teks: "#BFE6EF",
};

const GAYA_SOROTAN = HighlightStyle.define([
  // Komentar. Gramatika C++ menandai `//` sebagai `lineComment` dan `/* */`
  // sebagai `blockComment`, bukan `comment`, jadi keduanya harus disebut.
  { tag: tags.lineComment, color: WARNA.komentar },
  { tag: tags.blockComment, color: WARNA.komentar },
  { tag: tags.comment, color: WARNA.komentar },

  // Kata kunci. Gramatika C++ tidak pernah menghasilkan `keyword`: ia
  // memetakan kata kuncinya ke `controlKeyword`, `definitionKeyword`,
  // `operatorKeyword`, dan `modifier`. `keyword` tetap disebut sebagai cadangan
  // kalau nanti ada bahasa lain, bukan karena C++ memakainya sekarang.
  { tag: tags.controlKeyword, color: WARNA.kontrol },
  { tag: tags.definitionKeyword, color: WARNA.kunci },
  { tag: tags.operatorKeyword, color: WARNA.kunci },
  { tag: tags.modifier, color: WARNA.kunci },
  { tag: tags.keyword, color: WARNA.kunci },

  // Tipe. `standard(typeName)` adalah rantai modifier dengan `typeName` sebagai
  // induknya, jadi menyebut `typeName` saja sudah menutup `int`, `char`, dan
  // `void` sekaligus. `className` adalah padanan JavaScript dan tidak pernah
  // muncul di C++, tetapi tetap disebut sebagai cadangan untuk bahasa lain.
  { tag: tags.typeName, color: WARNA.tipe },
  { tag: tags.className, color: WARNA.tipe },

  // Fungsi. Modifier `function` dan `definition` berantai dan setiap set yang
  // lebih kecil didaftarkan sebagai induk, sehingga `definition(variableName)`
  // ikut cocok pada `function(definition(variableName))` — deklarasi dan nama
  // yang dipanggil satu warna, bukan dua.
  { tag: tags.function(tags.variableName), color: WARNA.fungsi },
  { tag: tags.function(tags.propertyName), color: WARNA.fungsi },
  { tag: tags.definition(tags.variableName), color: WARNA.fungsi },

  // Namespace, preprosesor, dan makro.
  { tag: tags.namespace, color: WARNA.tipe },
  { tag: tags.processingInstruction, color: WARNA.literal },
  { tag: tags.meta, color: WARNA.literal },
  { tag: tags.special(tags.name), color: WARNA.literal },

  // Literal. Angka, karakter, dan escape satu warna; string memakai palet repo
  // sendiri supaya bedanya nyata, bukan hanya sangat tipis.
  { tag: tags.number, color: WARNA.literal },
  { tag: tags.character, color: WARNA.literal },
  { tag: tags.escape, color: WARNA.literal },
  { tag: tags.string, color: WARNA.teks },
  { tag: tags.special(tags.string), color: WARNA.teks },
]);

// Tanda baca, operator, dan identifier biasa sengaja tidak diberi warna.
// Semuanya mewarisi warna teks badan `TEMA`, yang kontrasnya 13.91:1. Memberi
// warna pada tanda baca hanya menambah warna tanpa menambah informasi, dan
// gramatika menandainya sebagai `paren`/`brace`/`separator`/`*Operator` —
// bukan `punctuation` — jadi aturan `punctuation` pun tidak akan pernah cocok.

export function KodeView({
  kode,
  editable = false,
  onChange,
  label = "Kode",
  className,
}: {
  kode: string;
  bahasa: BahasaKode;
  editable?: boolean;
  onChange?: (kode: string) => void;
  label?: string;
  className?: string;
}) {
  const wadah = useRef<HTMLDivElement>(null);
  const tampilan = useRef<EditorView | null>(null);
  const sifatRef = useRef(new Compartment());

  // `onChange` lahir ulang setiap render. Menyimpannya di ref membuat efek
  // pembuatan tampilan tidak bergantung padanya, sehingga editor tidak dibangun
  // ulang setiap kali peserta mengetik. Penulisannya lewat efek, bukan langsung
  // saat render: aturan `react-hooks/refs` melarang menyentuh `current` di sana,
  // dan listener membacanya jauh setelah efek ini berjalan — yaitu saat peserta
  // mengetik.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Efek pembuatan. Wajib dideklarasikan sebelum efek `editable` dan `kode`
  // di bawahnya: keduanya membaca `tampilan.current`, dan efek berjalan sesuai
  // urutan deklarasi. Letakkan juga di depan efek sinkron `onChangeRef` itu
  // tidak salah — hanya tidak perlu, sebab pembuatan tidak membaca ref itu.
  useEffect(() => {
    const elemen = wadah.current;
    if (!elemen) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: kode,
        extensions: [
          cpp(),
          // Tanpa ekstensi inilah blok kode tampil sebagai teks polos: gramatika
          // ada, warnanya tidak. Keduanya harus berbonto.
          syntaxHighlighting(GAYA_SOROTAN),
          TEMA,
          lineNumbers(),
          // Dua plugin terpisah, satu untuk tiap kelas. Tanpa keduanya aturan
          // `.cm-activeLine` dan `.cm-activeLineGutter` di `TEMA` tidak pernah
          // cocok, dan sorotan baris aktif adalah satu-satunya penanda yang
          // menautkan mata ke kursor di mode baca.
          highlightActiveLine(),
          highlightActiveLineGutter(),
          EditorView.lineWrapping,
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          history(),
          sifatRef.current.of(sifat(editable, label)),
          EditorView.updateListener.of((perubahan) => {
            if (!perubahan.docChanged) return;
            onChangeRef.current?.(perubahan.state.doc.toString());
          }),
        ],
      }),
      parent: elemen,
    });
    tampilan.current = view;

    return () => {
      view.destroy();
      tampilan.current = null;
    };
    // Sekali saja. `editable` dan `kode` disinkronkan lewat efek terpisah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sifat baca dan tulis bisa berubah tanpa membangun ulang tampilan.
  useEffect(() => {
    const view = tampilan.current;
    if (!view) return;
    view.dispatch({ effects: sifatRef.current.reconfigure(sifat(editable, label)) });
  }, [editable, label]);

  // Dokumen bisa diubah dari luar, misalnya saat kode awal baru dimuat.
  // Perbandingan mencegah efek ini melawan pengetikan peserta.
  useEffect(() => {
    const view = tampilan.current;
    if (!view) return;
    const sekarang = view.state.doc.toString();
    if (sekarang === kode) return;
    view.dispatch({ changes: { from: 0, to: sekarang.length, insert: kode } });
  }, [kode]);

  return <div ref={wadah} className={cn("kode-view", className)} />;
}

/**
 * Ekstensi yang berubah antara mode baca dan mode tulis.
 *
 * **`contentAttributes` ikut mode, bukan hanya `editable`.** Ini inti Fix 1:
 * `EditorView.editable.of(false)` hanya menulis `contenteditable="false"` pada
 * `.cm-content`; ia tidak pernah menulis `tabindex`. Akibatnya sebuah
 * `div[contenteditable=false]` tanpa `tabindex` keluar dari urutan tab dan juga
 * menolak fokus terprogram — padahal `scrollDOM` (`.cm-scroller`) CodeMirror
 * selalu `tabIndex = -1`. Jadi pada mode baca daftar kode yang lebih tinggi dari
 * kotaknya hanya bisa digulir dengan tetikus: 5862px isi di dalam kotak 432px,
 * dan pembaca keyboard tidak bisa melewati layar pertamanya. WCAG 2.1.1.
 *
 * `tabindex` hidup di `sifat`, bukan di `contentAttributes` terpisah, supaya
 * hanya ada satu tempat yang menentukan apa yang boleh dilakukan pada areanya —
 * dan supaya ikut berubah bersama `editable` tanpa harus dibangun ulang.
 *
 * **Mode baca tetap tidak bisa diedit.** Menambah `tabindex` bukan membuka
 * `editable`; `EditorView.editable` dan `EditorState.readOnly` tetap menentukan
 * perubahan dokumen. Mengganti `editable` demi membuat fokus bekerja akan
 * membiarkan peserta mengetik ke blok baca.
 */
function sifat(editable: boolean, label: string) {
  return [
    EditorState.readOnly.of(!editable),
    EditorView.editable.of(editable),
    EditorView.contentAttributes.of({
      "aria-label": label,
      // `contenteditable="true"` membuat area itu fokusabel secara implisit dan
      // `tabindex` di sana justru akan menabrak urutan tab; mode tulis tidak
      // menerimanya.
      ...(editable ? {} : { tabindex: "0" }),
    }),
  ];
}
