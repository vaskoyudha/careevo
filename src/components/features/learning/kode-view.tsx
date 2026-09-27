"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cpp } from "@codemirror/lang-cpp";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { cn } from "@/lib/utils";
import { setPersistentValue, usePersistentValue } from "@/lib/hooks/use-persistent-state";
import { petakanStatus, type NadaJalankan, type StatusJalankan } from "@/lib/exec/port";
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
 * **Kenapa komponen ini yang memegang tombol Jalankan.** Kalau tombolnya
 * diletakkan pada komponen terpisah, ada dua tempat memanggil
 * `POST /api/jalankan` dan dua tempat memetakan status jadi kalimat — dan
 * hanya satu yang akan ikut diperbarui saat kalimatnya berubah.
 * `petakanStatus` sudah ditulis supaya kata-katanya hidup di satu tempat.
 *
 * **Yang tidak boleh bocor ke peramban.** Angka exit mentah tidak pernah
 * dibandingkan maupun ditampilkan di sini. Angka itu detail internal
 * pengisolasi, dan dari luar kontainer satu angka yang sama menandai beberapa
 * peristiwa berbeda — peserta yang membaca "137" akan mengira programnya salah,
 * padahal itu kehabisan waktu. Status semantik sudah membawa artinya; komponen
 * hanya membacanya lewat `petakanStatus`, dan test di
 * `src/lib/learning/kode-view.test.ts` mengunci kata itu agar tidak muncul
 * kembali di sini — termasuk di komentar, supaya berkasnya bebas dari detail
 * yang tidak pernah boleh menyentuh peramban.
 *
 * Berkas ini tidak boleh mengimpor modul server. Ia dipanggil dari
 * `halaman-view.tsx` dan `blok-editor.tsx`, keduanya klien. `@/lib/exec/port`
 * aman diimpor justru karena ia murni: tidak ada `node:*`, tidak ada `fetch`,
 * tidak ada `process`.
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

/**
 * Warna panel sesuai nada status.
 *
 * Kuncinya `NadaJalankan` dari `@/lib/exec/port`, bukan `string`, jadi menambah
 * nada di sana membuat `tsc` gagal di sini dan panelnya tidak pernah punya nada
 * tanpa warna. Warna dipilih dari nada, bukan dari teks status, supaya
 * komponen ini tidak pernah membaca `status` hanya untuk memilih warna.
 *
 * `text-success` mengikuti pola yang sudah dipakai untuk pesan hasil di
 * `mastery-topic-view.tsx`. Nilai hex tidak ditulis tangan di sini karena
 * `--color-success` sudah jadi token tema.
 */
const GAYA_NADA: Record<NadaJalankan, string> = {
  sukses: "text-success",
  galat: "text-red-700",
  info: "text-gray-600",
};

/**
 * Isi pane keluaran setelah status diterjemahkan jadi kalimat.
 *
 * `judul` sudah Bahasa Indonesia, dari `petakanStatus` atau dari pesan
 * penolakan gerbang di route. Pane ini tidak pernah menampilkan `status` mentah
 * maupun angka exit mentah.
 */
interface HasilPane {
  judul: string;
  nada: NadaJalankan;
  detail?: string;
  stdout: string;
  stderr: string;
  /** True kalau `stderr` datang dari g++, bukan dari program. */
  dariKompilator: boolean;
}

/**
 * Bentuk balasan `/api/jalankan`, dipisah berdasarkan `ok`.
 *
 * Penolakan gerbang (403 asal, 401 sesi, 429 rate limit, 400 bentuk) menjawab
 * `{ ok: false, error }` dan tidak punya `status`. Menemapkannya menjadi
 * `galat_runner` akan berbohong dengan cara lain: "layanan sedang tidak
 * tersedia" untuk sesi yang sudah habis membuat peserta mengira masalahnya ada
 * di programnya. Pesan route sudah Bahasa Indonesia dan menyebut penyebabnya.
 */
type BalasanJalankan =
  | { ok: true; status?: StatusJalankan; stdout?: string; stderr?: string }
  | { ok: false; error: string };

/**
 * Susunan panel editor.
 *
 * `inline` adalah bentuk lamanya: editor, tombol Jalankan, dan pane hasil
 * bertumpuk dalam satu kolom sempit. `lab` memisahkannya supaya tata letak lab
 * (`kode-lab.tsx`) bisa menaruh editor di atas dan hasil di bawah, di kolomnya
 * sendiri. Yang **tidak** berubah antara keduanya: editor, teks yang dijalankan,
 * dan seluruh pemetaan status — semua itu tetap hidup di komponen ini, karena
 * dua tempat yang menjalankan kode berarti dua tempat yang menerjemahkan status,
 * dan hanya satu yang akan ikut diperbarui saat kalimatnya berubah.
 */
export type SusunanKode = "inline" | "lab";

export function KodeView({
  kode,
  bahasa,
  kunci,
  kodeAwal,
  stdin,
  dapatJalankan = false,
  editable = false,
  onChange,
  label = "Kode",
  susunan = "inline",
  className,
}: {
  kode: string;
  bahasa: BahasaKode;
  /**
   * Identitas stabil untuk ruang latihan peserta.
   *
   * Di jalur peserta ini `blok.id`, karena blok yang tampil sudah tersimpan dan
   * sudah punya id. Di editor admin harus memakai identitas lokal blok
   * (`kunci.dari(index)`), bukan `blok.id`: blok yang belum disimpan punya
   * `id: ""`, sehingga seluruh blok kode yang belum disimpan akan berbagi satu
   * kunci ruang latihan. Itu kelas bentrok yang sama persis dengan yang
   * `useKunciBlok` ada untuk cegah.
   */
  kunci: string;
  /**
   * Titik mulai peserta di ruang latihan. Absen berarti sama dengan `kode`.
   *
   * Opsional karena itu pun kontraknya: tidak diisi berarti "mulai dari kode
   * yang sama seperti yang ditulis ahli", dan itulah kasus yang paling sering.
   */
  kodeAwal?: string;
  /** Masukan latihan yang dikirim ke program. */
  stdin?: string;
  /**
   * Hanya `true` yang menampilkan tombol Jalankan.
   *
   * Absen berarti `false`, jadi blok yang sakelarnya tidak menyala tampil
   * **tanpa tombol sama sekali**, bukan dengan tombol yang menolak saat diklik.
   * Gerbang yang sama ditegakkan server: skema badannya di `/api/jalankan`
   * memakai `z.literal(true)`, jadi permintaan yang salah tetap 400 walaupun
   * dikirim langsung dari konsol peramban.
   */
  dapatJalankan?: boolean;
  editable?: boolean;
  onChange?: (kode: string) => void;
  label?: string;
  /**
   * Susunan panel: `inline` (bawaan) menumpuk editor, tombol, dan hasil dalam
   * satu kolom; `lab` memisahkan editor dan hasil menjadi dua blok terpisah yang
   * ditempatkan `kode-lab.tsx`. Logika jalannya tetap di sini di kedua mode.
   */
  susunan?: SusunanKode;
  className?: string;
}) {
  const wadah = useRef<HTMLDivElement>(null);
  const tampilan = useRef<EditorView | null>(null);
  const sifatRef = useRef(new Compartment());

  /**
   * Ruang latihan peserta: tempat mencoba, **bukan bukti**.
   *
   * Isinya bertahan di `localStorage` supaya mengedit tidak hilang saat pindah
   * halaman. Itu seluruh janjinya. Ruang ini sengaja tidak punya jalan ke
   * `submissions`, ke `attestations`, atau ke apa pun yang dibaca verifikator.
   * Kalau suatu hari ada yang ingin menaikkan teks ini menjadi karya atau
   * kredensial, itu keputusan tersendiri dengan bukti sendiri. Jangan memulainya
   * dengan menyambungkan berkas ini ke sana, dan jangan menganggap isinya sudah
   * terverifikasi hanya karena bisa dijalankan.
   *
   * Aksesnya lewat `usePersistentValue`/`setPersistentValue` yang sudah ada di
   * `@/lib/hooks/use-persistent-state`, bukan panggilan `localStorage` mentah.
   * Alasannya bukan gaya: kedua helper itu memberi tahu lewat satu `EventTarget`
   * modul, jadi setiap komponen yang memakai kunci sama ikut tahu saat
   * nilainya berubah.
   */
  const kunciRuangLatihan = `careevo:kode:${kunci}`;
  const tersimpan = usePersistentValue(kunciRuangLatihan);
  const [menjalankan, setMenjalankan] = useState(false);
  const [hasil, setHasil] = useState<HasilPane | null>(null);

  /**
   * Teks yang dijalankan adalah teks ruang latihan, bukan `kode` prop.
   *
   * Urutannya `tersimpan` dulu, baru `kodeAwal`, lalu `kode`. Yang menentukan
   * adalah `??` dan bukan `||`: dengan `||`, mengosongkan editor sepenuhnya akan
   * mengembalikan teks ke kode ahli, dan tombol Jalankan akan menjalankan
   * program yang tidak ada di layar.
   */
  const teks = tersimpan ?? kodeAwal ?? kode;

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

  // Kunci ruang latihan juga dibaca lewat ref, dengan alasan yang sama: nilainya
  // ikut berubah kalau bloknya berpindah (`kunci.dari(index)` pada editor admin
  // ikut bergerak saat blok ditukar), dan listener yang menutup kunci lamanya
  // akan menulis hasil ruang latihan ke blok yang salah.
  const kunciLatihanRef = useRef(kunciRuangLatihan);
  useEffect(() => {
    kunciLatihanRef.current = kunciRuangLatihan;
  }, [kunciRuangLatihan]);

  // Efek pembuatan. Wajib dideklarasikan sebelum efek `editable` dan `kode`
  // di bawahnya: keduanya membaca `tampilan.current`, dan efek berjalan sesuai
  // urutan deklarasi. Letakkan juga di depan efek sinkron `onChangeRef` itu
  // tidak salah — hanya tidak perlu, sebab pembuatan tidak membaca ref itu.
  useEffect(() => {
    const elemen = wadah.current;
    if (!elemen) return;

    const view = new EditorView({
      state: EditorState.create({
        // `teks`, bukan `kode`: kalau peserta sudah punya ruang latihan, editor
        // harus dibuka pada teks itu. Membuka pada `kode` lalu menjalankan
        // `teks` berarti peserta membaca satu program dan menjalankan program
        // lain, dan tidak ada apa pun di layar yang menunjukkan bedanya.
        doc: teks,
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
            const berikut = perubahan.state.doc.toString();
            // Disimpan di sini, bukan hanya saat tombol ditekan. Kalau disimpan
            // saat menjalankan saja, mengedit lalu pindah halaman tanpa
            // menjalankan akan membuang seluruh pekerjaan peserta.
            setPersistentValue(kunciLatihanRef.current, berikut);
            onChangeRef.current?.(berikut);
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

  // Dokumen bisa diubah dari luar, misalnya saat ruang latihan baru dimuat
  // setelah hidrasi, atau saat kode blok berubah di editor admin.
  //
  // Bandingkan dengan `teks`, bukan `kode`: `teks` adalah dokumen yang benar,
  // sedangkan `kode` bisa berupa cuplikan awal yang memang harus diganti oleh
  // ruang latihan peserta. Perbandingan yang mencegah efek ini melawan
  // pengetikan peserta tetap ada, hanya sasarannya yang pindah.
  useEffect(() => {
    const view = tampilan.current;
    if (!view) return;
    const sekarang = view.state.doc.toString();
    if (sekarang === teks) return;
    view.dispatch({ changes: { from: 0, to: sekarang.length, insert: teks } });
  }, [teks]);

  /**
   * Kirim ke server dan tampilkan hasilnya.
   *
   * **Tidak ada yang dijalankan di sini.** Komponen ini tidak pernah memanggil
   * proses apa pun; ia hanya mengirim teks dan membaca jawaban.
   * `@/lib/exec/port` tetap murni supaya berkas ini boleh diimpor dari klien.
   *
   * Field `dapatDijalankan` dikirim apa adanya. Namanya **berbeda** dari prop
   * `dapatJalankan`, dan itu bukan salah ketik: nama field di badan adalah
   * `z.literal(true)` di `skemaTubuh`, jadi menuliskan bentuk lain membuat
   * setiap permintaan ditolak 400.
   */
  const jalankan = useCallback(async () => {
    setMenjalankan(true);
    setHasil(null);
    try {
      const balasan = await fetch("/api/jalankan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bahasa, kode: teks, stdin, dapatDijalankan: true }),
      });
      const data = (await balasan.json()) as BalasanJalankan;
      if (!data.ok) {
        // Penolakan gerbang: sebabnya sudah dijelaskan route, jadi tampilkan
        // pesan itu. Mengubahnya jadi `galat_runner` akan mengarahkan peserta
        // ke programnya sendiri, padahal programnya belum pernah dijalankan.
        setHasil({ judul: data.error, nada: "galat", stdout: "", stderr: "", dariKompilator: false });
        return;
      }
      // `petakanStatus` sudah jadi satu-satunya sumber kalimatnya. Kalau
      // `status` tidak ada di balasan 200, itu masalah runner dan bukan salah
      // program peserta, jadi `galat_runner` yang tepat di sini.
      const peta = petakanStatus(data.status ?? "galat_runner");
      setHasil({
        judul: peta.judul,
        nada: peta.nada,
        detail: peta.detail,
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
        dariKompilator: data.status === "gagal_kompilasi",
      });
    } catch {
      // Jaringan putus, badan bukan JSON, atau server tidak menjawab. Semua itu
      // satu hal bagi peserta: belum ada jawaban program, dan programnya belum
      // tentu salah.
      const peta = petakanStatus("galat_runner");
      setHasil({ judul: peta.judul, nada: peta.nada, detail: peta.detail, stdout: "", stderr: "", dariKompilator: false });
    } finally {
      setMenjalankan(false);
    }
  }, [bahasa, teks, stdin]);

  /**
   * Tombol Jalankan dan baris keterangannya.
   *
   * Gerbangnya `=== true`, bukan kebenaran biasa: prop-nya opsional dan
   * `undefined` berarti tidak boleh dijalankan, jadi nilai apa pun yang bukan
   * `true` harus berarti tidak ada tombol sama sekali. Ini meniru
   * `z.literal(true)` di server, jadi sakelar yang mati tidak bisa dilewati
   * hanya dengan mengirim nilai lain dari peramban.
   *
   * Markup-nya satu variabel, tetapi **gerbangnya tetap ditulis di tempat
   * render** (`{dapatJalankan === true ? … : null}`): uji sumber
   * `kode-view.test.ts` mengunci bentuk itu sebagai jaminan fail-closed, dan
   * memindahkannya ke ekspresi `? :` di variabel akan membuat jaminan yang sama
   * tak lagi terlihat oleh uji tersebut.
   */
  const isiTombolJalankan = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={jalankan}
        disabled={menjalankan}
        className="cursor-pointer rounded-lg bg-[#0056D2] px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {menjalankan ? "Menjalankan…" : "Jalankan"}
      </button>
      <span className="text-[11px] text-gray-500">
        Kompilasi dan dijalankan di server, di kontainer terpisah.
      </span>
    </div>
  );

  /**
   * Pane hasil — satu definisi untuk kedua susunan.
   *
   * Di `lab` ia duduk di bawah editor (baris bawah kolom kanan); di `inline` ia
   * duduk tepat di bawah tombolnya. Isi dan kata-katanya **wajib** sama: dua
   * salinan render akan menyimpang tanpa error, dan yang paling mudah
   * menyimpang justru pesan kompilator — satu-satunya bagian yang punya nomor
   * baris.
   */
  const paneHasil = hasil ? (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/*
        `role="status"` ada di blok **judul saja**, bukan di pane seluruhnya.
        Karena itu `detail` ikut terbaca sebagai bagian dari pengumuman yang
        sama tanpa harus dua kali. Pesan compiler sengaja tidak ikut: ia
        bisa puluhan baris, dan membacakan seluruhnya sekaligus lebih buruk
        daripada membiarkan peserta navigasi ke `<pre>`-nya sendiri.
      */}
      <div className={cn("border-b border-gray-100 px-3 py-1.5", GAYA_NADA[hasil.nada])}>
        <p className="text-xs font-semibold" role="status">
          {hasil.judul}
        </p>
        {hasil.detail ? (
          <p className="mt-0.5 text-[11px] text-gray-500">{hasil.detail}</p>
        ) : null}
      </div>

      {/*
        stderr ditampilkan apa adanya, tanpa dipotong dan tanpa diringkas.
        Untuk `gagal_kompilasi` ini adalah pesan g++ lengkap dengan nomor
        baris, dan itu justru sinyalnya: nomor baris itulah yang
        menunjukkan ke mana peserta harus melihat. Ringkasnya jadi satu
        kalimat "kode salah sintaks" menghapus satu-satunya informasi yang
        berguna. `whitespace-pre-wrap` menjaga baris baru dari compiler,
        `overflow-x-auto` menjaga baris panjang tetap bisa dibaca.
      */}
      {hasil.stderr ? (
        <div
          className={cn(
            "px-3 py-2",
            // Garis pemisah hanya di antara dua isi. Tanpa syarat ini, blok
            // terakhir selalu menggantung garis di bawahnya meski tidak ada
            // apa pun lagi setelahnya.
            hasil.stdout ? "border-b border-gray-100" : "",
          )}
        >
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            {hasil.dariKompilator ? "Pesan dari kompilator" : "Pesan dari program"}
          </p>
          <pre className="overflow-x-auto font-mono text-[12px] whitespace-pre-wrap text-gray-800">
            {hasil.stderr}
          </pre>
        </div>
      ) : null}

      {hasil.stdout ? (
        <div className="px-3 py-2">
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            Keluaran program
          </p>
          <pre className="overflow-x-auto font-mono text-[12px] whitespace-pre-wrap text-gray-800">
            {hasil.stdout}
          </pre>
        </div>
      ) : null}
    </div>
  ) : null;

  /**
   * Susunan `lab`: satu kolom dengan **editor di atas** (mengisi ruang) dan
   * **hasil di bawah**. Keduanya tetap milik komponen ini — `kode-lab.tsx`
   * hanya menyusun kolom kanan, dan tidak pernah menyentuh `teks` maupun
   * `jalankan`. Itu yang menjaga satu-satunya jalur eksekusi tetap di sini.
   */
  if (susunan === "lab") {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <div>
          <div ref={wadah} className="kode-view kode-view-lab" />
          {dapatJalankan === true ? <div className="pt-2">{isiTombolJalankan}</div> : null}
        </div>
        <div className="min-w-0">
          {paneHasil ?? (
            <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-[12.5px] leading-relaxed text-gray-500">
              Tekan <strong className="font-semibold text-gray-700">Jalankan</strong> untuk melihat
              keluaran program di sini.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div ref={wadah} className="kode-view" />
      {dapatJalankan === true ? isiTombolJalankan : null}
      {paneHasil}
    </div>
  );
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
