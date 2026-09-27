"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Link2, Link2Off, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  blokKosong,
  daftarSection,
  gabungSegmenSejenis,
  segmenKeTeks,
  tautanSah,
} from "@/lib/courses/blok";
import { UnggahBerkas } from "./unggah-berkas";
import { PemilihTautan } from "./pemilih-tautan";
import type { BlokHalaman, SegmenTeks, TipeBlok, UkuranBlok } from "@/types/course";

/**
 * Editor blok konten berformat.
 *
 * Teks disunting lewat `contentEditable`, lalu **diserialisasi kembali menjadi
 * `SegmenTeks[]`** setiap kali berubah. Ini titik yang paling perlu dijaga:
 * konten berformat tidak bisa disimpan sebagai HTML, karena repo ini tidak
 * punya sanitizer dan HTML dari admin akan menjadi XSS tersimpan. Dengan
 * membaca kembali hanya teks dan penanda yang dikenali (`b`/`strong`, `i`/`em`,
 * `a[href]`), apa pun yang ditempelkan dari luar — `<script>`, atribut
 * `onerror`, gaya sebaris — hilang sebelum pernah menyentuh berkas.
 *
 * Konsekuensinya disadari: menempelkan teks berformat kaya akan kehilangan
 * formatnya, dan itu memang yang diinginkan di sini.
 */

interface BlokEditorProps {
  blok: BlokHalaman[];
  onChange: (blok: BlokHalaman[]) => void;
  courseId: string;
  modulId: string;
  /** Path unggahan memakai id halaman; saat halaman baru belum ada id, pakai modul. */
  subjekUnggah: string;
}

/**
 * `Record<TipeBlok, string>`, bukan `Partial<Record<...>>` — supaya menambah
 * tipe blok baru memaksa labelnya ditulis di sini, bukan diam-diam tampil
 * `undefined` di dropdown.
 */
const LABEL_TIPE: Record<TipeBlok, string> = {
  paragraf: "Paragraf",
  heading: "Judul section",
  daftar: "Daftar",
  kutipan: "Kutipan",
  kode: "Kode",
  gambar: "Gambar",
};

/**
 * Sengaja belum memuat `kode`.
 *
 * Memasukkannya berarti Percaya bisa membuat blok kode, sementara
 * `BlokEditor` belum punya `case "kode"` untuk menyuntingnya — blok yang
 * dibuat tapi tidak bisa disunting adalah data rusak. Labelnya sudah ada di
 * `LABEL_TIPE` karena peta itu wajib exhaustif; yang belum boleh jalan adalah
 * pilihannya. `kode` masuk ke sini di Task 4
 * (`docs/superpowers/plans/2026-09-27-blok-kode-cpp.md`), setelah `KodeView`.
 */
const TIPE_BISA_DITAMBAH: TipeBlok[] = ["paragraf", "heading", "daftar", "kutipan", "gambar"];

export function BlokEditor({
  blok,
  onChange,
  courseId,
  modulId,
  subjekUnggah,
}: BlokEditorProps) {
  const [tambahTipe, setTambahTipe] = useState<TipeBlok>("paragraf");

  const perbarui = (index: number, berikut: BlokHalaman) => {
    onChange(blok.map((b, i) => (i === index ? berikut : b)));
  };

  const pindah = (index: number, arah: -1 | 1) => {
    const tujuan = index + arah;
    if (tujuan < 0 || tujuan >= blok.length) return;
    const berikut = [...blok];
    [berikut[index], berikut[tujuan]] = [berikut[tujuan], berikut[index]];
    onChange(berikut);
  };

  return (
    <div className="space-y-3">
      {blok.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
          Halaman ini masih kosong. Tambahkan blok pertama di bawah.
        </p>
      ) : null}

      {blok.map((item, index) => (
        <div key={item.id} className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gray-600 uppercase">
              {LABEL_TIPE[item.tipe]}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-gray-400">
              {segmenKeTeks(item.segmen) || (item.tipe === "gambar" ? item.alt : "")}
            </span>
            <button
              type="button"
              onClick={() => pindah(index, -1)}
              disabled={index === 0}
              title="Pindah ke atas"
              className="cursor-pointer rounded-md border border-gray-300 p-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronUp className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Pindahkan blok ke atas</span>
            </button>
            <button
              type="button"
              onClick={() => pindah(index, 1)}
              disabled={index === blok.length - 1}
              title="Pindah ke bawah"
              className="cursor-pointer rounded-md border border-gray-300 p-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronDown className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Pindahkan blok ke bawah</span>
            </button>
            <button
              type="button"
              onClick={() => onChange(blok.filter((_, i) => i !== index))}
              title="Hapus blok"
              className="cursor-pointer rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Hapus blok</span>
            </button>
          </div>

          <div className="p-3">
            <IsiBlok
              blok={item}
              onChange={(berikut) => perbarui(index, berikut)}
              courseId={courseId}
              modulId={modulId}
              subjekUnggah={subjekUnggah}
              semuaBlok={blok}
            />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-300 p-3">
        <select
          value={tambahTipe}
          onChange={(event) => setTambahTipe(event.target.value as TipeBlok)}
          aria-label="Tipe blok baru"
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
        >
          {TIPE_BISA_DITAMBAH.map((tipe) => (
            <option key={tipe} value={tipe}>
              {LABEL_TIPE[tipe]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onChange([...blok, blokKosong(tambahTipe)])}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Tambah blok
        </button>
      </div>
    </div>
  );
}

/** Isi satu blok — bentuknya berbeda per tipe. */
function IsiBlok({
  blok,
  onChange,
  courseId,
  modulId,
  subjekUnggah,
  semuaBlok,
}: {
  blok: BlokHalaman;
  onChange: (berikut: BlokHalaman) => void;
  courseId: string;
  modulId: string;
  subjekUnggah: string;
  semuaBlok: BlokHalaman[];
}) {
  switch (blok.tipe) {
    case "paragraf":
    case "kutipan":
      return (
        <div className="space-y-2">
          {blok.tipe === "paragraf" ? (
            <div className="flex items-center gap-2">
              <Label htmlFor={`${blok.id}-ukuran`} className="text-xs">
                Ukuran
              </Label>
              <select
                id={`${blok.id}-ukuran`}
                value={blok.ukuran ?? "normal"}
                onChange={(event) =>
                  onChange({ ...blok, ukuran: event.target.value as UkuranBlok })
                }
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
              >
                <option value="kecil">Kecil</option>
                <option value="normal">Normal</option>
                <option value="besar">Besar</option>
                <option value="lead">Lead (besar sekali)</option>
              </select>
            </div>
          ) : null}
          <BarisEditor
            id={`blok-${blok.id}`}
            segmen={blok.segmen ?? []}
            onChange={(segmen) => onChange({ ...blok, segmen })}
            placeholder={blok.tipe === "kutipan" ? "Tulis kutipan…" : "Tulis paragraf…"}
            semuaBlok={semuaBlok}
          />
        </div>
      );

    case "heading":
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor={`${blok.id}-level`} className="text-xs">
              Level
            </Label>
            <select
              id={`${blok.id}-level`}
              value={blok.level ?? 2}
              onChange={(event) =>
                onChange({ ...blok, level: Number(event.target.value) as 1 | 2 | 3 })
              }
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
            >
              <option value={1}>1 — judul section</option>
              <option value={2}>2 — sub-section</option>
              <option value={3}>3 — sub-sub</option>
            </select>
            <span className="text-xs text-gray-400">
              Menjadi jangkar backlink: #{segmenKeTeks(blok.segmen) ? "…" : ""}
            </span>
          </div>
          <BarisEditor
            id={`blok-${blok.id}`}
            segmen={blok.segmen ?? []}
            onChange={(segmen) => onChange({ ...blok, segmen })}
            placeholder="Judul bagian"
            semuaBlok={semuaBlok}
          />
        </div>
      );

    case "daftar":
      return (
        <div className="space-y-2">
          {(blok.butir ?? []).map((butir, index) => (
            <div key={`${blok.id}-${index}`} className="flex items-start gap-2">
              <span className="mt-2 text-xs text-gray-400">•</span>
              <div className="min-w-0 flex-1">
                <BarisEditor
                  id={`blok-${blok.id}-${index}`}
                  segmen={butir}
                  onChange={(segmen) =>
                    onChange({
                      ...blok,
                      butir: (blok.butir ?? []).map((b, i) => (i === index ? segmen : b)),
                    })
                  }
                  placeholder={`Butir ${index + 1}`}
                  semuaBlok={semuaBlok}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...blok,
                    butir: (blok.butir ?? []).filter((_, i) => i !== index),
                  })
                }
                className="mt-1.5 shrink-0 cursor-pointer text-xs font-semibold text-gray-400 hover:text-red-600"
              >
                Hapus
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...blok, butir: [...(blok.butir ?? []), [{ teks: "" }]] })}
            className="cursor-pointer text-xs font-semibold text-[#0056D2]"
          >
            Tambah butir
          </button>
        </div>
      );

    case "gambar":
      return (
        <div className="space-y-2">
          <UnggahBerkas
            courseId={courseId}
            subjekId={subjekUnggah}
            jenis="gambar"
            label="Unggah gambar"
            onSukses={(hasil) => onChange({ ...blok, src: hasil.path })}
          />
          {blok.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blok.src}
              alt={blok.alt ?? ""}
              className="max-h-52 rounded-lg border border-gray-200"
            />
          ) : (
            <p className="field-hint">Belum ada gambar.</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${blok.id}-alt`} className="text-xs">
              Teks alternatif
            </Label>
            <Input
              id={`${blok.id}-alt`}
              value={blok.alt ?? ""}
              onChange={(event) => onChange({ ...blok, alt: event.target.value })}
              placeholder="Deskripsi gambar untuk pembaca layar"
            />
          </div>
          <p className="field-hint">
            Unggahan tersimpan di modul {modulId}. Simpan halaman agar berkasnya terpakai.
          </p>
        </div>
      );
  }
}

/**
 * Satu baris teks berformat.
 *
 * `contentEditable` dipakai supaya penanda format terlihat saat mengetik —
 * memakai `Textarea` plus markup akan membuat admin menebak hasilnya. Isi
 * DOM dibaca kembali menjadi `SegmenTeks[]` pada setiap `input`.
 *
 * `dangerouslySetInnerHTML` **tidak dipakai**; isi awal dipasang lewat
 * `useEffect` yang membangun elemen DOM secara manual (`document.createTextNode`,
 * `document.createElement`). Dengan begitu tidak ada string HTML yang perlu
 * diurai — sekaligus menutup jalan masuk HTML mentah.
 */
function BarisEditor({
  id,
  segmen,
  onChange,
  placeholder,
  semuaBlok,
}: {
  id: string;
  segmen: SegmenTeks[];
  onChange: (segmen: SegmenTeks[]) => void;
  placeholder: string;
  semuaBlok: BlokHalaman[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pemilihBuka, setPemilihBuka] = useState(false);

  // Hanya pasang isi ulang saat identitas barisnya berganti. Memasangnya di
  // setiap render akan memindahkan kursor ke awal setiap kali mengetik.
  const terpasang = useRef<string | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (terpasang.current === id) return;
    terpasang.current = id;
    ref.current.replaceChildren(...nodeDariSegmen(segmen));
    // `segmen` sengaja tidak masuk dependency: efek ini hanya untuk pemasangan
    // awal. Perubahan setelahnya datang dari dalam DOM itu sendiri.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const terapkanFormat = (perintah: "bold" | "italic") => {
    ref.current?.focus();
    document.execCommand(perintah);
    if (ref.current) onChange(bacaSegmen(ref.current));
  };

  const terapkanTautan = (tautan: string | null) => {
    setPemilihBuka(false);
    const elemen = ref.current;
    if (!elemen) return;

    const pilihan = window.getSelection();
    const rentang = pilihan?.rangeCount ? pilihan.getRangeAt(0) : null;

    if (!tautan) {
      // Lepas tautan dikerjakan pada DOM, bukan pada state: mengubah state saja
      // akan digantikan kembali oleh `onInput`/`onBlur` yang membaca DOM, sehingga
      // tombolnya tampak tidak bekerja.
      for (const anchor of Array.from(elemen.querySelectorAll("a"))) {
        anchor.replaceWith(...Array.from(anchor.childNodes));
      }
      onChange(bacaSegmen(elemen));
      return;
    }

    if (rentang && !rentang.collapsed && elemen.contains(rentang.commonAncestorContainer)) {
      // Terapkan ke teks yang sedang dipilih saja — inilah cara membuat
      // backlink pada bagian tertentu, bukan seluruh baris.
      elemen.focus();
      document.execCommand("createLink", false, tautan);
      onChange(bacaSegmen(elemen));
      return;
    }

    // Tanpa pilihan: tawarkan menautkan butir terakhir yang tidak punya tautan.
    const target = [...segmen].reverse().find((s) => !s.tautan);
    if (!target) {
      onChange([...segmen, { teks: "tautan", tautan }]);
      return;
    }
    onChange(segmen.map((s) => (s === target ? { ...s, tautan } : s)));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <TombolFormat onClick={() => terapkanFormat("bold")} label="Tebal" teks="B" tebal />
        <TombolFormat onClick={() => terapkanFormat("italic")} label="Miring" teks="I" miring />
        <button
          type="button"
          onClick={() => setPemilihBuka((v) => !v)}
          title="Backlink / tautan"
          aria-expanded={pemilihBuka}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <Link2 className="size-3.5" aria-hidden="true" />
          Tautan
        </button>
        <button
          type="button"
          onClick={() => terapkanTautan(null)}
          title="Lepas tautan"
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <Link2Off className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {pemilihBuka ? (
        <PemilihTautan
          bagian={daftarSection(semuaBlok)}
          onPilih={terapkanTautan}
          onBatal={() => setPemilihBuka(false)}
        />
      ) : null}

      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-multiline="false"
        aria-label={`Isi ${id}`}
        contentEditable
        suppressContentEditableWarning
        onInput={() => ref.current && onChange(bacaSegmen(ref.current))}
        onBlur={() => ref.current && onChange(bacaSegmen(ref.current))}
        data-placeholder={placeholder}
        className={cn(
          "min-h-9 rounded-lg border border-input bg-transparent px-3 py-2 text-sm",
          "focus:border-gray-400 focus:outline-none",
          "empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]",
        )}
      />
    </div>
  );
}

function TombolFormat({
  onClick,
  label,
  teks,
  tebal,
  miring,
}: {
  onClick: () => void;
  label: string;
  teks: string;
  tebal?: boolean;
  miring?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={label}
      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-gray-300 text-xs text-gray-600 hover:bg-gray-50"
    >
      <span className={cn(tebal && "font-bold", miring && "italic")}>{teks}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

/** Bangun node DOM dari segmen — tanpa string HTML, jadi tidak ada yang diurai. */
function nodeDariSegmen(segmen: SegmenTeks[]): Node[] {
  const simpul: Node[] = [];
  for (const potongan of segmen) {
    if (!potongan.teks) continue;
    let node: Node = document.createTextNode(potongan.teks);

    if (potongan.tebal) {
      const b = document.createElement("strong");
      b.appendChild(node);
      node = b;
    }
    if (potongan.miring) {
      const i = document.createElement("em");
      i.appendChild(node);
      node = i;
    }
    if (potongan.tautan) {
      const a = document.createElement("a");
      a.setAttribute("href", potongan.tautan);
      a.appendChild(node);
      node = a;
    }
    simpul.push(node);
  }
  return simpul;
}

/**
 * Baca kembali isi DOM menjadi `SegmenTeks[]`.
 *
 * Hanya teks dan tiga penanda yang dikenali yang diambil; semua elemen dan
 * atribut lain diabaikan tanpa terkecuali. Inilah yang membuat menempelkan
 * konten dari luar tidak bisa menyelundupkan HTML ke berkas tersimpan.
 */
export function bacaSegmen(akar: HTMLElement): SegmenTeks[] {
  const hasil: SegmenTeks[] = [];

  const telusuri = (node: Node, warisan: Omit<SegmenTeks, "teks">) => {
    for (const anak of Array.from(node.childNodes)) {
      if (anak.nodeType === Node.TEXT_NODE) {
        const teks = anak.textContent ?? "";
        if (teks) hasil.push({ teks, ...warisan });
        continue;
      }
      if (anak.nodeType !== Node.ELEMENT_NODE) continue;

      const elemen = anak as HTMLElement;
      const tag = elemen.tagName.toLowerCase();
      if (tag === "br") {
        hasil.push({ teks: "\n", ...warisan });
        continue;
      }

      const berikut: Omit<SegmenTeks, "teks"> = { ...warisan };
      if (tag === "b" || tag === "strong") berikut.tebal = true;
      if (tag === "i" || tag === "em") berikut.miring = true;
      if (tag === "a") {
        const href = elemen.getAttribute("href") ?? "";
        // Hanya bentuk yang sah yang dipertahankan; sisanya dibuang bersama
        // elemennya, sehingga `<a href="javascript:…">` tidak pernah tersimpan.
        if (tautanSah(href)) berikut.tautan = href;
      }

      if (tag === "div" || tag === "p") {
        // Blok baru menjadi teks biasa; editor ini satu baris per blok.
        if (hasil.length) hasil.push({ teks: "\n", ...warisan });
      }

      telusuri(elemen, berikut);
    }
  };

  telusuri(akar, {});
  return gabungSegmenSejenis(hasil);
}
