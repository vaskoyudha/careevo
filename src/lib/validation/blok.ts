import { z } from "zod";
import { skemaUrlHttp } from "./url";

/**
 * Skema blok konten berformat.
 *
 * Union bertipe (bukan satu objek dengan banyak field opsional) dengan alasan
 * yang sama seperti `materiSchema`: tiap tipe blok punya field wajibnya sendiri,
 * dan menambah tipe baru memaksa setiap cabang diperbarui alih-alih diam-diam
 * lolos dengan field yang tidak relevan.
 *
 * `z.object` membuang kunci yang tidak dikenal, jadi payload kiriman tidak bisa
 * menyelipkan field di luar kontrak ini ke dalam berkas yang tersimpan.
 */

/** Batas panjang satu potongan teks. Cukup lapang untuk satu baris, bukan untuk satu bab. */
const MAKS_TEKS_SEGMEN = 5000;

/** Batas jumlah blok per halaman dan butir per daftar — menjaga body aksi tetap wajar. */
const MAKS_BLOK_PER_HALAMAN = 200;
const MAKS_BUTIR_PER_DAFTAR = 100;
const MAKS_SEGMEN_PER_BARIS = 50;

/**
 * Bentuk tautan yang diizinkan.
 *
 * Dua bentuk, dua alasan:
 *
 * - `#jangkar` — backlink ke section di halaman yang sama atau halaman lain di
 *   modul yang sama. Diregex ketat karena nilai ini masuk ke atribut `href`;
 *   menerima sembarang string berarti menerima `#` diikuti apa pun, termasuk
 *   yang nanti disalahtafsirkan renderer.
 * - `http(s)://…` — lewat `skemaUrlHttp`, yang menolak `javascript:` (zod v4
 *   `z.url()` menerimanya — lihat catatan di `url.ts`).
 *
 * Bentuk lain (mis. `mailto:`, path relatif `/foo`) sengaja ditolak: belum ada
 * kebutuhan nyatanya di materi belajar, dan tiap bentuk tambahan adalah
 * permukaan yang harus dipikirkan renderer.
 */
export const skemaTautan = z
  .string()
  .trim()
  .min(1, "Tautan tidak boleh kosong")
  .max(2048, "Tautan terlalu panjang")
  .refine(
    (nilai) => /^#[a-z0-9-]{1,80}$/.test(nilai) || skemaUrlHttp.safeParse(nilai).success,
    { message: "Tautan harus berupa backlink (#nama-section) atau URL http/https" },
  );

const segmenSchema = z.object({
  teks: z.string().max(MAKS_TEKS_SEGMEN, "Potongan teks terlalu panjang"),
  tebal: z.boolean().optional(),
  miring: z.boolean().optional(),
  tautan: skemaTautan.optional(),
});

export const TIPE_BLOK = ["paragraf", "heading", "daftar", "kutipan", "gambar"] as const;

/**
 * `id` blok boleh kosong saat dikirim form.
 *
 * Store yang memberinya lewat `idBaru("blk")` — sama seperti id modul/materi.
 * Menerima id dari klien untuk blok baru akan membuat klien bisa menumbuk id
 * blok lain, dan mengubah id blok yang sudah ada berarti memutus tautan
 * `#anchor` yang menunjuknya.
 */
/**
 * `id` blok boleh kosong saat dikirim form.
 *
 * `.default("")` dipakai supaya hasil parse selalu punya `id: string` — store
 * yang mengisinya lewat `idBaru("blk")`. Menerima id dari klien untuk blok baru
 * akan membuat klien bisa menumbuk id blok lain, dan mengubah id blok yang
 * sudah ada berarti memutus kaitan jangkar backlink.
 */
const idSchema = z.string().trim().max(120).default("");

/** Level heading sebagai literal, bukan `number` — supaya hasil parse tetap `1 | 2 | 3`. */
const levelSchema = z
  .coerce
  .number()
  .pipe(z.union([z.literal(1), z.literal(2), z.literal(3)]))
  .optional();

export const blokSchema = z.discriminatedUnion("tipe", [
  z.object({
    id: idSchema,
    tipe: z.literal("paragraf"),
    // Literal langsung, bukan cast `string[]`: cast akan membuat hasil parse
    // bertipe `string` dan memaksa pemeran tipe di setiap pemanggil.
    ukuran: z.enum(["kecil", "normal", "besar", "lead"]).optional(),
    segmen: z
      .array(segmenSchema)
      .max(MAKS_SEGMEN_PER_BARIS, "Terlalu banyak potongan teks dalam satu paragraf"),
  }),
  z.object({
    id: idSchema,
    tipe: z.literal("heading"),
    level: levelSchema,
    segmen: z
      .array(segmenSchema)
      .max(MAKS_SEGMEN_PER_BARIS, "Terlalu banyak potongan teks dalam satu heading")
      // Heading kosong tidak menghasilkan jangkar apa pun, jadi ia selalu jadi
      // baris hampa di daftar isi dan sasaran backlink yang tidak bisa dituju.
      .refine((segmen) => segmen.some((s) => s.teks.trim().length > 0), {
        message: "Judul section tidak boleh kosong",
      }),
  }),
  z.object({
    id: idSchema,
    tipe: z.literal("daftar"),
    butir: z
      .array(z.array(segmenSchema).max(MAKS_SEGMEN_PER_BARIS))
      .max(MAKS_BUTIR_PER_DAFTAR, "Terlalu banyak butir dalam satu daftar"),
  }),
  z.object({
    id: idSchema,
    tipe: z.literal("kutipan"),
    segmen: z.array(segmenSchema).max(MAKS_SEGMEN_PER_BARIS),
  }),
  z.object({
    id: idSchema,
    tipe: z.literal("gambar"),
    // Sama seperti `path` pada materi PDF: nilai ini masuk ke `<img src>`, jadi
    // dibatasi ke folder unggahan kita sendiri. Route unggah hanya memvalidasi
    // berkas yang benar-benar diunggah, bukan nilai yang dikirim ulang ke sini.
    src: z
      .string()
      .trim()
      .min(1, "Gambar belum dipilih")
      .max(500, "Path gambar maksimal 500 karakter")
      .refine((nilai) => nilai.startsWith("/uploads/") && !nilai.includes(".."), {
        message: "Path gambar harus berada di /uploads/",
      }),
    alt: z.string().trim().max(300, "Teks alternatif maksimal 300 karakter").optional(),
  }),
]);

/** Batas jumlah blok satu halaman — diekspor supaya pesan UI bisa menyebut angka yang sama. */
export const BATAS_BLOK = MAKS_BLOK_PER_HALAMAN;

export const blokListSchema = z
  .array(blokSchema)
  .max(MAKS_BLOK_PER_HALAMAN, `Maksimal ${MAKS_BLOK_PER_HALAMAN} blok per halaman`);

export type BlokFormData = z.infer<typeof blokSchema>;
export type SegmenFormData = z.infer<typeof segmenSchema>;
