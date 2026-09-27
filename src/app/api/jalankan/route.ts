import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prosesLokal } from "@/lib/exec";
import { originDiizinkan, PESAN_ORIGIN_DITOLAK } from "@/lib/http/origin";
import { batasiRequestMasuk } from "@/lib/rate-limit/next";

/**
 * POST /api/jalankan — menjalankan kode C++ peserta.
 *
 * ## Peran route ini hanya gerbang
 *
 * Ia **tidak pernah** mengompilasi dan tidak pernah menjalankan biner. Sumber
 * diteruskan lewat HTTP ke runner di loopback, dan hasilnya diteruskan apa
 * adanya (P3 spec). Kalau route ini menyusun sendiri baris perintah podman,
 * permukaan audit sandbox bocor ke lapis kedua dan pertanyaan "apa yang boleh
 * dilakukan kode peserta" tidak lagi bisa dijawab dengan membaca satu berkas.
 *
 * ## Empat gerbang, dan urutannya adalah bagian dari desain
 *
 * `originDiizinkan` → `getSession` → `batasiRequestMasuk` → validasi zod. Urutan
 * ini disengaja dan menuruni dari yang paling murah ke yang paling mahal:
 *
 * 1. Penolakan Origin tidak menyentuh database, tidak membaca body, dan tidak
 *    menyentuh jaringan internal.
 * 2. `getSession` satu query. Setelah ini diketahui bahwa peminta adalah
 *    peserta, bukanielles anonim — itu yang membuat gerbang ketiga punya
 *    pengenal untuk dibatasi.
 * 3. Rate limit memakai bucket per IP **dan** per akun, jadi tidak ada container
 *    yang terpakai untuk request yang memang sudahakibat habis haknya.
 * 4. Validasi bentuk. Sampai titik ini tidak ada satu pun resource mahal yang
 *    tersentuh, dan `kode` yang 300 kB sudah ditolak tanpa pernah sampai ke
 *    runner.
 *
 * Kalau urutannya dibalik, satu penyerang tanpa Origin yang benar bisa membuat
 * route membaca body, memvalidasi, baru ditolak — dan pada kebijakan yang
 * `failOpen`, bisa saja lolos seluruhnya.
 *
 * ## Kode HTTP: galat gerbang, atau 200 dengan status semantik
 *
 * HTTP 4xx/5xx berarti **permintaannya** tidak boleh lewat: 403 asal, 401 sesi,
 * 429 rate limit, 400 bentuk. Sebaliknya, kode yang gagal dikompilasi atau
 * program yang crash **tetap 200** dengan `status` semantik di dalam body.
 * Peserta dalam kasus itu sedang tidak mengalami masalah jaringan — ia perlu
 * membaca pesan compiler, dan mengubahnya menjadi galat HTTP akan membuat
 * peramban menampilkan "kesalahan jaringan" di tempat yang seharusnya menampilkan
 * nomor baris yang salah. Satu-satunya placeholder HTTP di sini adalah
 * `galat_runner`: saat itu memang tidak ada jawaban program, dan yang perlu
 * diketahui peserta cuma "layanan sedang tidak tersedia".
 */

/**
 * Route ini tidak boleh pernah dianalisis statis.
 *
 * Segera setelah `dynamic` supaya jelas bahwa yang dianalisis adalah kode,
 * bukan hanya cara kerja. Handler POST memang tidak diprerender, jadi ini
 * belt-and-braces — dicatat agar tidak ada yang menghapus berkasnya
 * berdasarkan keyakinan bahwa `POST` sudah cukup.
 */
export const dynamic = "force-dynamic";

/**
 * Bentuk badan yang sah.
 *
 * `dapatDijalankan` memakai `z.literal(true)`, bukan `z.boolean()`. Perbedaannya
 * bukan kosmetik: `z.boolean()` menerima `false` dan route ini harus mengembalikan
 * 200 dengan `ditolak`, sedangkan yang sebenarnya dibutuhkan adalah blok yang
 * centangnya **tidak menyala** ditolak di lapisan validasi — bukan sekadar
 * disembunyikan di UI. Field ini adalah pernyataan peserta bahwa blok ini memang
 * boleh ia jalankan, dan switch di `blok-editor.tsx` yang mengaturnya berada di
 * server; kalau route ikut mempercayainya, siapa pun bisa mengaturnya dari
 * peramban.
 *
 * Namanya sengaja sama dengan field tersimpan `BlokKode.dapatDijalankan`
 * (`@/types/course`) supaya tidak ada dua nama untuk satu ide — dan supaya klien
 * pada Task 6 cukup meneruskan field itu apa adanya, tanpa perlu peta alias.
 */
const skemaTubuh = z.object({
  /**
   * Daftar bahasa milik `@/types/course` (`BahasaKode`), yang runner turunkan ke
   * `namaBerkas` di `runner/soal.mjs`. Tiga tempat itu harus bergerak bersama
   * ketika bahasa kedua ditambahkan; runner sudah menolak bahasa tak dikenal
   * dengan sendirinya, jadi daftar di sini tidak menambah permukaan apa pun.
   */
  bahasa: z.literal("cpp"),
  /**
   * Batas panjang di sini sama dengan `BATAS.karakter` di `runner/soal.mjs`, dan
   * ditegakkan lebih awal dengan sengaja: menolak 200 kB harus sepotong
   * milidetik, sementara mengompilasinya memakan satu kontainer penuh dengan g++
   * yang berjalan — beserta antrean yang macet untuk semua orang.
   */
  kode: z.string().min(1, "Kode program tidak boleh kosong.").max(200_000, "Kode program terlalu panjang."),
  stdin: z.string().max(8_192, "Masukan terlalu panjang.").optional(),
  dapatDijalankan: z.literal(true),
});

/** Bentuk respons gerbang. Satu kontrak, dipakai oleh semua penolakan. */
function galat(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  // Validasi Origin lebih dulu — sebelum body disentuh sama sekali. Route
  // handler tidak mendapat perlindungan CSRF bawaan Next.js (itu hanya untuk
  // Server Action), jadi ia memeriksa sendiri. Ini SATU lapisan di antara
  // beberapa (cookie SameSite=Lax + gerbang sesi di bawah), bukan satu-satunya
  // pertahanan. Kebijakannya fail-closed: Origin yang absen ditolak kecuali
  // `CAREEVO_ALLOW_MISSING_ORIGIN` diisi eksplisit, dan `X-Forwarded-Host`
  // tidak dipercaya kecuali `CAREEVO_TRUST_PROXY_HEADERS` diisi. Lihat
  // `@/lib/http/origin`.
  if (!originDiizinkan(request)) {
    return galat(403, PESAN_ORIGIN_DITOLAK);
  }

  // Peserta yang sedang belajar, bukan staf. Jadi `getSession`, **bukan** gate
  // staf seperti di `/api/unggah`: endpoint ini memang untuk semua peserta
  // yang sudah masuk, dan `punyaRoleStaff` akan menutup justru orang yang
  // seharusnya dilayani.
  const sesi = await getSession();
  if (!sesi) {
    return galat(401, "Sesi tidak ditemukan. Silakan masuk terlebih dahulu.");
  }

  // Bucket per akun selain bucket per IP. Tanpa pengenal sesi, kebijakan
  // `jalankanKode` hanya membatasi per IP, dan seluruh kelas di belakang satu
  // NAT bersama akan saling mengunci — atau satu akun yang berpindah-pindah IP
  // mendapat kuota baru setiap kali. `identifierUntuk` menghitung keduanya dan
  // menolak begitu salah satu habis.
  //
  // `tambahan` dipakai, bukan `principal`, karena itu satu-satunya field yang
  // bisa diisi `batasiRequestMasuk`: helper itu hanya meneruskan `ip` dan
  // `tambahan` ke `batasiPermintaan` (`src/lib/rate-limit/next.ts`). Hasilnya
  // tetap sama — bucket tersendiri per email — dan nilainya diberi prefiks
  // `jalankan:` seperti `unggah:` di `/api/unggah`, supaya kunci bucket tidak
  // pernah bentrok dengan kunci kebijakan lain yang kebetulan memakai email
  // yang sama.
  //
  // `sesi.email` adalah `string` wajib pada `SessionPrincipal`, jadi aman
  // dipakai sebagai pengenal bucket (`src/lib/auth/principal.ts:30`).
  const batas = await batasiRequestMasuk(request, "jalankanKode", {
    tambahan: `jalankan:${sesi.email}`,
  });
  if (batas) return batas;

  // Membaca body baru terjadi di sini, setelah ketiga gerbang murah lolos.
  // `request.json()` melempar untuk body yang bukan JSON, dan body yang bukan
  // JSON adalah 400 — bukan 500, dan bukan galat runner.
  let badan: unknown;
  try {
    badan = await request.json();
  } catch {
    return galat(400, "Badan permintaan harus berupa JSON yang sah.");
  }

  // Pesan zod pertama diteruskan apa adanya, dan itu aman: semua pesannya
  // ditulis di berkas ini, bukan nilai kiriman. `invalid_type` yang
  // bawaan zod hanya menyebut nama field dan tipe yang diharapkan.
  const parsed = skemaTubuh.safeParse(badan);
  if (!parsed.success) {
    return galat(400, parsed.error.issues[0]?.message ?? "Permintaan tidak sah.");
  }

  const hasil = await prosesLokal.jalankan({
    bahasa: parsed.data.bahasa,
    kode: parsed.data.kode,
    stdin: parsed.data.stdin,
  });

  // 200 dengan `status` semantik — termasuk `galat_runner` saat runner mati,
  // kehabisan waktu, atau menjawab dengan bentuk yang tidak dipercaya.
  // `ProsesLokal` sudah memastikan tidak ada satu pun detail internal yang
  // ikut di sini: yang keluar adalah lima field `HasilJalankan`, atau
  // `hasilGagal` yang isinya kosong.
  return Response.json({ ok: true, ...hasil });
}
