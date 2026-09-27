/**
 * Seed konten untuk kursus inti Careevo (`crs-1`…`crs-8`) — kursus yang
 * sebelumnya hanya punya modul turunan kosong (judul tanpa halaman, tanpa kuis).
 *
 * Berkas ini diisi penuh: setiap modul membawa halaman prosa berformat dan satu
 * kuis yang dinilai server. Kursus `crs-8` sengaja tetap `draft` di katalog,
 * tetapi kontennya tetap disemai supaya siap saat dipublikasikan.
 */

import { h2, h3, kode, li, p, q, type KursusSeed } from "./tipen";

export const KURSUS_INTI_A: KursusSeed[] = [
  {
    slug: "fullstack-web-development-nextjs-15-react-19",
    judul: "Fullstack Web Development: Next.js 15 & React 19",
    deskripsi:
      "Pelajari arsitektur Next.js 15 App Router, Server Actions, React 19 hooks terbaru, dan integrasi Tailwind CSS v4 dari pondasi dasar hingga deployment.",
    tags: ["Next.js", "React", "TypeScript", "Tailwind"],
    level: "dasar",
    track: "web-dev",
    modul: [
      {
        judul: "Pondasi App Router dan Server Component",
        ringkasan:
          "Cara Next.js 15 menyusun rute, kapan sebuah komponen berjalan di server, dan kenapa batas itu menentukan arsitektur aplikasi.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Mengapa App Router mengubah cara berpikir",
            blok: [
              h2("Server lebih dulu, klien seperlunya"),
              p(
                "App Router membalik asumsi lama: komponen React secara bawaan berjalan di server, bukan di peramban. Artinya data bisa diambil langsung tanpa lapisan API, dan JavaScript yang dikirim ke peramban jauh lebih kecil.",
              ),
              p("Dua jenis komponen yang harus kamu bedakan sejak awal:"),
              li(
                "Server Component — bisa `async`, bisa mengakses database, tidak boleh memakai hook seperti `useState`.",
                "Client Component — ditandai `\"use client\"`, boleh memakai hook dan event handler, tidak boleh mengakses rahasia server.",
              ),
              q(
                "Aturan praktisnya: taruh `\"use client\"` sedalam mungkin di pohon komponen, bukan di layout teratas.",
              ),
              h3("Struktur folder adalah rute"),
              p(
                "Di App Router, folder menentukan URL. Sebuah `page.tsx` membuat rute itu bisa dibuka, dan `layout.tsx` membungkus semua halaman di bawahnya tanpa render ulang saat berpindah rute.",
              ),
            ],
          },
          {
            judul: "Mengambil data tanpa API sendiri",
            blok: [
              h2("Server Component boleh async"),
              p(
                "Karena Server Component berjalan di server, kamu bisa `await` langsung di dalam komponen. Tidak perlu `useEffect`, tidak perlu endpoint perantara.",
              ),
              kode({
                kode: `// app/kursus/page.tsx — Server Component
async function ambilKursus() {
  const res = await fetch("https://api.contoh.test/kursus", {
    // Next.js menyimpan hasil ini dan memakainya ulang selama 60 detik.
    next: { revalidate: 60 },
  });
  return res.json() as Promise<{ id: string; judul: string }[]>;
}

export default async function HalamanKursus() {
  const daftar = await ambilKursus();
  return (
    <ul>
      {daftar.map((k) => (
        <li key={k.id}>{k.judul}</li>
      ))}
    </ul>
  );
}`,
                dapatDijalankan: false,
              }),
              p(
                "Perhatikan bahwa kode di atas adalah TypeScript/React, bukan C++. Blok kode ini hanya contoh untuk dibaca — tombol Jalankan sengaja tidak tersedia karena runner platform ini mengompilasi C++.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Pondasi App Router",
          deskripsi: "Memastikan kamu membedakan Server Component dan Client Component.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Komponen React di App Router secara bawaan berjalan di mana?",
              pilihan: ["Peramban klien", "Server", "Service worker", "Edge cache saja"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang WAJIB ada agar sebuah komponen bisa memakai `useState`?",
              pilihan: [
                "Direktif `\"use client\"` di bagian atas berkas",
                "Nama berkas berakhiran `.client.tsx`",
                "Dipanggil dari Server Component",
                "Export default",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa fungsi `layout.tsx` di App Router?",
              pilihan: [
                "Mendefinisikan rute baru",
                "Membungkus halaman di bawahnya tanpa render ulang saat navigasi",
                "Menggantikan `_app.tsx` untuk semua halaman",
                "Mengatur metadata saja",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa Server Component mengirim JavaScript lebih sedikit ke peramban?",
              pilihan: [
                "Karena ia memakai WebAssembly",
                "Karena kodenya dijalankan di server dan hanya hasil render yang dikirim",
                "Karena ia tidak memakai React",
                "Karena peramban meng-cache seluruh halaman",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Server Actions dan Mutasi Data",
        ringkasan:
          "Menulis mutasi yang aman tanpa API manual, serta pola validasi dan otorisasi yang tidak bisa dilewati klien.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Formulir yang berbicara langsung ke server",
            blok: [
              h2("Server Action adalah fungsi server"),
              p(
                "Server Action memungkinkan formulir HTML memanggil fungsi di server tanpa kamu menulis endpoint. Tetap saja ia adalah **endpoint publik**: siapa pun yang tahu namanya bisa memanggilnya. Karena itu validasi dan otorisasi harus ada di dalam fungsinya.",
              ),
              li(
                "Selalu validasi input di dalam action, bukan hanya di klien.",
                "Periksa sesi dan hak akses di dalam action.",
                "Jangan pernah mempercayai nilai yang menentukan kelulusan atau peran dari klien.",
              ),
              q("Formulir yang terlihat aman di layar tetap bisa dipanggil langsung tanpa layar itu."),
            ],
          },
          {
            judul: "Validasi dengan Zod di batas kepercayaan",
            blok: [
              h2("Skema sebagai satu-satunya gerbang"),
              p(
                "Pola yang dipakai Careevo: setiap action memvalidasi payload dengan skema Zod sebelum menyentuh database. Skema yang sama dipakai formulir untuk umpan balik cepat — satu definisi, dua tempat.",
              ),
              kode({
                kode: `// app/actions.ts
"use server";

import { z } from "zod";

const skema = z.object({
  judul: z.string().trim().min(3).max(120),
  durasi: z.coerce.number().int().min(1),
});

export async function simpanKursus(input: unknown) {
  const hasil = skema.safeParse(input);
  if (!hasil.success) return { ok: false, errors: hasil.error.flatten() };
  // Di sini baru menyentuh database — input sudah tervalidasi.
  return { ok: true };
}`,
                dapatDijalankan: false,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Server Actions dan Mutasi",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Mengapa Server Action tetap harus memvalidasi inputnya sendiri?",
              pilihan: [
                "Karena formulir selalu bisa salah ketik",
                "Karena ia adalah endpoint publik yang bisa dipanggil langsung",
                "Karena Zod lebih cepat",
                "Karena TypeScript tidak berjalan di server",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Di mana pemeriksaan sesi dan hak akses harus dilakukan?",
              pilihan: [
                "Hanya di komponen klien",
                "Di dalam action di server",
                "Di CSS",
                "Di middleware saja selalu cukup",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Nilai apa yang TIDAK boleh dipercaya dari klien?",
              pilihan: [
                "Teks pencarian",
                "Nama tampilan",
                "Ambang kelulusan atau peran pengguna",
                "Warna tema",
              ],
              jawaban_benar: 2,
            },
          ],
        },
      },
      {
        judul: "React 19: Hook dan Formulir Modern",
        ringkasan:
          "Hook baru React 19, cara membaca status formulir, dan kapan memakai state optimistis tanpa berbohong ke pengguna.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Hook yang mengurangi kode boilerplate",
            blok: [
              h2("useActionState dan useFormStatus"),
              p(
                "React 19 membawa hook yang menyatukan status pengiriman formulir. `useActionState` menahan hasil action, `useFormStatus` memberi tahu apakah formulir sedang dikirim — tanpa kamu menulis state `loading` manual.",
              ),
              li(
                "`useActionState(action, initialState)` mengembalikan `[state, formAction, isPending]`.",
                "`useFormStatus` hanya bekerja di komponen anak dari `<form>`, bukan di komponen yang merendernya.",
                "State optimistis harus bisa dibatalkan bila server menolak.",
              ),
              q("State optimistis adalah janji, bukan kebenaran — tarik kembali bila server menolak."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: React 19 Hook dan Formulir",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Hook apa yang menahan hasil sebuah Server Action di React 19?",
              pilihan: ["useEffect", "useActionState", "useMemo", "useContext"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Di mana `useFormStatus` boleh dipanggil?",
              pilihan: [
                "Di komponen yang merender `<form>`",
                "Di komponen anak di dalam `<form>`",
                "Di Server Component",
                "Di mana saja",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang harus dilakukan bila server menolak perubahan optimistis?",
              pilihan: [
                "Biarkan tampilan apa adanya",
                "Tarik kembali perubahan dan tampilkan galat",
                "Muat ulang seluruh halaman tanpa pesan",
                "Sembunyikan galat",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Tailwind v4 dan Deployment",
        ringkasan:
          "Konfigurasi CSS-first Tailwind v4, tema sebagai token, dan langkah merilis aplikasi Next.js ke produksi.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Tailwind v4 tanpa file konfigurasi",
            blok: [
              h2("Tema hidup di CSS"),
              p(
                "Tailwind v4 memindahkan konfigurasi ke CSS lewat `@theme`. Tidak ada `tailwind.config.js`; token warna, jarak, dan tipografi didefinisikan sebagai variabel CSS yang langsung dipakai utility.",
              ),
              li(
                "`@import \"tailwindcss\"` menggantikan tiga direktif `@tailwind` lama.",
                "Token di `@theme` menjadi kelas utility sekaligus variabel CSS.",
                "Utamakan mengubah token daripada menulis nilai arbitrer di banyak tempat.",
              ),
            ],
          },
          {
            judul: "Rilis ke produksi",
            blok: [
              h2("Checklist sebelum deploy"),
              p(
                "Build produksi adalah gerbang yang menangkap kesalahan yang tidak terlihat saat `dev`. Jalankan `next build` di CI, bukan hanya `typecheck`.",
              ),
              li(
                "Rahasia hanya di variabel lingkungan server, tidak pernah di klien.",
                "Periksa ulang batas ukuran body Server Action.",
                "Pastikan halaman yang butuh sesi benar-benar mengalihkan pengguna tanpa sesi.",
              ),
              q("Yang belum pernah di-build belum pernah diuji."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Tailwind v4 dan Deployment",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Di mana tema Tailwind v4 didefinisikan?",
              pilihan: [
                "tailwind.config.js",
                "Di CSS lewat `@theme`",
                "Di package.json",
                "Di next.config.ts",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Perintah apa yang menangkap pelanggaran batas klien/server?",
              pilihan: ["typecheck", "lint", "next build", "format"],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Di mana rahasia server boleh berada?",
              pilihan: [
                "Variabel lingkungan server",
                "Bundle klien",
                "Atribut data di HTML",
                "Cookie yang bisa dibaca JavaScript",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },
];
