"use client";

import { useEffect, useRef } from "react";
import { cpp } from "@codemirror/lang-cpp";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
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
    "&.cm-focused": { outline: "none" },
  },
  { dark: true },
);

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

  // Efek pembuatan. Deklarasikan lebih dulu supaya `tampilan.current` sudah
  // terisi ketika efek `editable` di bawah berjalan pada render yang sama.
  useEffect(() => {
    const elemen = wadah.current;
    if (!elemen) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: kode,
        extensions: [
          cpp(),
          TEMA,
          lineNumbers(),
          EditorView.lineWrapping,
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          history(),
          sifatRef.current.of(sifat(editable)),
          EditorView.contentAttributes.of({ "aria-label": label }),
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
    view.dispatch({ effects: sifatRef.current.reconfigure(sifat(editable)) });
  }, [editable]);

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

/** Ekstensi yang berubah antara mode baca dan mode tulis. */
function sifat(editable: boolean) {
  return [EditorState.readOnly.of(!editable), EditorView.editable.of(editable)];
}
