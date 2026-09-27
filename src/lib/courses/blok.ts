import type {
  BlokHalaman,
  SegmenTeks,
  TipeBlok,
  UkuranBlok,
} from "@/types/course";

/**
 * Operasi murni atas blok konten berformat.
 *
 * **Berkas ini tidak boleh menyentuh store, `node:fs`, atau apa pun yang
 * server-only.** Renderer halaman adalah komponen klien, dan satu impor yang
 * salah ke modul server akan menjatuhkan build Turbopack produksi dengan
 * "chunking context does not support external modules" — bug yang sudah pernah
 * terjadi di repo ini (lihat AGENTS.md, "Course curriculum").
 */

/** Level heading yang dikenali. 1–3 saja: lebih dalam dari itu jadi daftar, bukan struktur. */
export const LEVEL_HEADING = [1, 2, 3] as const;

export const UKURAN_BLOK: UkuranBlok[] = ["kecil", "normal", "besar", "lead"];

/**
 * Slug jangkar dari judul sebuah section.
 *
 * Sengaja **tidak** memakai `slugify()` milik `store.ts`: berkas itu transitif
 * mengimpor `storage.ts` → `node:fs/promises`, sehingga mengimpornya dari modul
 * klien menarik `node:fs` ke bundel browser. Duplikasi kecil ini adalah harga
 * dari batas modul yang harus dijaga.
 *
 * Aturan hasil: huruf kecil, aksen dilucuti, apa pun di luar `a-z0-9` menjadi
 * `-`, lalu `-` beruntun dirapatkan dan ujungnya dipangkas. Hasil kosong
 * (mis. judul "!!!" atau judul berhuruf non-latin) dikembalikan sebagai
 * "bagian" supaya jangkar tidak pernah berupa string kosong.
 */
export function slugBagian(teks: string): string {
  const dasar = teks
    .normalize("NFD")
    // Buang tanda diakritik hasil dekomposisi NFD.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return dasar || "bagian";
}

/** Panjang maksimum jangkar — cukup panjang untuk judul wajar, cukup pendek untuk URL. */
const MAKS_JANGKAR = 80;

/** Rapatkan teks sebuah baris berformat menjadi teks polos. */
export function segmenKeTeks(segmen: SegmenTeks[] | undefined): string {
  if (!segmen?.length) return "";
  return segmen.map((s) => s.teks).join("").trim();
}

/** Apakah blok ini punya isi yang layak ditampilkan? */
export function blokBerisi(blok: BlokHalaman): boolean {
  switch (blok.tipe) {
    case "paragraf":
    case "kutipan":
      return segmenKeTeks(blok.segmen).length > 0;
    case "heading":
      return segmenKeTeks(blok.segmen).length > 0;
    case "gambar":
      return Boolean(blok.src);
    case "kode":
      return (blok.kode ?? "").trim().length > 0;
    case "daftar":
      return (blok.butir ?? []).some((butir) => segmenKeTeks(butir).length > 0);
  }
}

/** Ringkasan satu baris untuk daftar blok yang terlipat di editor. */
export function ringkasBlok(blok: BlokHalaman, maks = 80): string {
  let teks = "";
  if (blok.tipe === "daftar") {
    teks = (blok.butir ?? []).map((butir) => segmenKeTeks(butir)).filter(Boolean).join(" · ");
  } else if (blok.tipe === "gambar") {
    teks = blok.alt || blok.src || "";
  } else if (blok.tipe === "kode") {
    teks = (blok.kode ?? "").split("\n")[0] ?? "";
  } else {
    teks = segmenKeTeks(blok.segmen);
  }
  if (teks.length <= maks) return teks;
  return `${teks.slice(0, maks - 1).trimEnd()}…`;
}

/** Satu section heading beserta jangkar stabilnya. */
export interface SectionInfo {
  /** `id` blok sumbernya — dipakai editor untuk memetakan balik. */
  blokId: string;
  /** Jangkar yang dipakai `href="#…"`. */
  id: string;
  teks: string;
  level: 1 | 2 | 3;
}

/**
 * Daftar section sebuah halaman, terurut sesuai kemunculan.
 *
 * Ini satu-satunya sumber jangkar: daftar isi peserta, pemilih backlink di
 * editor, dan peta `id` untuk render semua membaca dari sini, sehingga jangkar
 * yang ditawarkan editor tidak mungkin berbeda dari yang benar-benar dirender.
 *
 * Jangkar **diturunkan**, bukan disimpan: judul yang diubah berarti jangkar
 * ikut berubah. Trade-off-nya sadar — jangkar jadi selalu cocok dengan teks
 * yang terlihat, tapi backlink yang menunjuk section yang sudah diganti namanya
 * akan mati dan admin perlu memperbaruinya lewat pemilih backlink.
 */
export function daftarSection(blok: BlokHalaman[]): SectionInfo[] {
  const terpakai = new Map<string, number>();
  const hasil: SectionInfo[] = [];

  for (const item of blok) {
    if (item.tipe !== "heading") continue;
    const teks = segmenKeTeks(item.segmen);
    if (!teks) continue;

    const dasar = slugBagian(teks).slice(0, MAKS_JANGKAR).replace(/-+$/g, "") || "bagian";
    // Judul kembar dalam satu halaman harus punya jangkar berbeda, kalau tidak
    // tautan `#judul` akan selalu melompat ke kemunculan pertama.
    const sudah = terpakai.get(dasar) ?? 0;
    terpakai.set(dasar, sudah + 1);

    hasil.push({
      blokId: item.id,
      id: sudah === 0 ? dasar : `${dasar}-${sudah + 1}`,
      teks,
      level: item.level ?? 2,
    });
  }

  return hasil;
}

/** Peta `id blok heading` → jangkar. Dipakai renderer untuk memasang `id` elemen. */
export function petaSection(blok: BlokHalaman[]): Map<string, string> {
  return new Map(daftarSection(blok).map((s) => [s.blokId, s.id]));
}

/** Satu tautan masuk ke sebuah section. */
export interface BacklinkMasuk {
  /** Blok yang memuat tautannya — dipakai sebagai kunci daftar. */
  blokId: string;
  /** Teks baris yang memuat tautan, sebagai konteks bagi pembaca. */
  teks: string;
}

/**
 * Kumpulkan tautan masuk per section: `jangkar` → daftar blok yang menunjuknya.
 *
 * Inilah yang membuat backlink sungguhan backlink, bukan sekadar tautan keluar:
 * section bisa menampilkan "ditautkan dari" — daftar bagian lain yang mengacu
 * ke sana. Tanpa ini, sebuah tautan hanya berguna satu arah.
 *
 * **Cakupannya satu halaman.** Jangkar HTML bersifat lokal halaman, dan judul
 * section kembar di halaman berbeda menghasilkan jangkar yang sama, sehingga
 * menyelesaikannya lintas halaman butuh sintaks penunjuk halaman tersendiri.
 * Untuk berpindah halaman, renderer memakai pager Sebelumnya/Berikutnya.
 *
 * Tautan ke jangkar yang tidak ada di halaman ini **diabaikan**: ia mati, dan
 * menampilkannya sebagai backlink akan mengklaim sesuatu yang tidak benar.
 */
export function rangkumBacklink(blok: BlokHalaman[]): Map<string, BacklinkMasuk[]> {
  const jangkarValid = new Set(daftarSection(blok).map((s) => s.id));
  const peta = new Map<string, BacklinkMasuk[]>();

  for (const item of blok) {
    const baris: SegmenTeks[][] =
      item.tipe === "daftar"
        ? (item.butir ?? [])
        : item.tipe === "gambar"
          ? []
          : [item.segmen ?? []];

    for (const segmen of baris) {
      const teksBaris = segmenKeTeks(segmen);
      for (const potongan of segmen) {
        const tautan = potongan.tautan;
        if (!tautan?.startsWith("#")) continue;

        const jangkar = tautan.slice(1);
        if (!jangkarValid.has(jangkar)) continue;

        const daftar = peta.get(jangkar) ?? [];
        // Satu blok dihitung sekali per jangkar, walau ia memuat tautan yang
        // sama dua kali — daftar "ditautkan dari" yang menyebut blok yang sama
        // berulang tidak menambah informasi.
        if (daftar.some((b) => b.blokId === item.id)) continue;

        daftar.push({ blokId: item.id, teks: teksBaris || potongan.teks });
        peta.set(jangkar, daftar);
      }
    }
  }

  return peta;
}

/** Level heading blok, dijamin 1–3. */
export function levelHeading(blok: BlokHalaman): 1 | 2 | 3 {
  return blok.level ?? 2;
}

/** Rapatkan potongan bersebelahan yang penandanya sama. */
export function gabungSegmenSejenis(segmen: SegmenTeks[]): SegmenTeks[] {
  const hasil: SegmenTeks[] = [];
  for (const potongan of segmen) {
    const sebelumnya = hasil[hasil.length - 1];
    if (
      sebelumnya &&
      sebelumnya.tebal === potongan.tebal &&
      sebelumnya.miring === potongan.miring &&
      sebelumnya.tautan === potongan.tautan
    ) {
      sebelumnya.teks += potongan.teks;
      continue;
    }
    hasil.push({ ...potongan });
  }
  return hasil;
}

/**
 * Apakah sebuah `href` boleh disimpan sebagai tautan?
 *
 * Gerbang terakhir sebelum nilai masuk ke `<a href>`. Dipakai editor saat
 * membaca kembali isi `contentEditable` — di situ teks bisa datang dari tempelan
 * luar, jadi bentuk yang tidak dikenal harus dibuang, bukan disimpan mentah.
 */
export function tautanSah(href: string): boolean {
  return /^#[a-z0-9-]{1,80}$/.test(href) || /^https?:\/\//i.test(href);
}

/**
 * Blok kosong baru untuk sebuah tipe.
 *
 * Dipakai editor saat menambah blok. `id` sengaja dibiarkan kosong: store yang
 * memberinya lewat `idBaru("blk")` supaya hanya ada satu tempat yang memutuskan
 * bentuk id, dan blok yang batal disimpan tidak membakar id.
 */
export function blokKosong(tipe: TipeBlok, id = ""): BlokHalaman {
  switch (tipe) {
    case "paragraf":
      return { id, tipe, ukuran: "normal", segmen: [{ teks: "" }] };
    case "heading":
      return { id, tipe, level: 2, segmen: [{ teks: "" }] };
    case "daftar":
      return { id, tipe, butir: [[{ teks: "" }]] };
    case "kutipan":
      return { id, tipe, segmen: [{ teks: "" }] };
    case "kode":
      // `dapatDijalankan` sengaja false: blok baru tidak dapat dieksekusi
      // sampai ahli menyalakannya secara eksplisit.
      return { id, tipe, bahasa: "cpp", kode: "", dapatDijalankan: false };
    case "gambar":
      return { id, tipe, src: "", alt: "" };
  }
}
