/**
 * Seed konten untuk entri fixture `r7`–`r12` — dulu "fixture resource" tanpa
 * modul, sekarang diberi modul tersimpan (halaman berformat + kuis) supaya
 * setiap entri bisa dibuka dan dikerjakan di `/belajar`.
 *
 * Setiap kursus membawa `id` eksplisit (sama dengan kolom id fixture) sehingga
 * `katalogBelajar` membuang entri fixture itu lewat dedup by id dan
 * `getCourseById` menemukan modul tersimpannya.
 *
 * Catatan blok kode: runner platform ini hanya mengompilasi C++. Topik JS/TS/
 * PHP/HTML/YAML di sini ditulis sebagai blok kode **tanpa** `dapatDijalankan`
 * (hanya dibaca). `r11` bertopik algoritma sehingga contohnya memakai C++,
 * tetapi tetap tanpa tombol Jalankan.
 */

import { h2, h3, kode, li, p, q, type KursusSeed } from "./tipen";

export const KURSUS_MATERI_B: KursusSeed[] = [
  // -------------------------------------------------------------------------
  // r7 — Membangun REST API dengan Node.js
  // -------------------------------------------------------------------------
  {
    id: "r7",
    slug: "r7",
    judul: "Membangun REST API dengan Node.js",
    deskripsi:
      "Pelajari cara membangun REST API dengan Node.js dan Express, mulai dari semantik HTTP dan perancangan rute sumber daya, middleware, hingga validasi input dan penanganan galat yang konsisten.",
    tags: ["Node.js", "API"],
    level: "menengah",
    track: "web-dev",
    provider: "Node.js",
    modul: [
      {
        judul: "Dasar HTTP dan Perancangan Rute REST",
        ringkasan:
          "Membaca pertukaran HTTP sebagai kontrak, lalu menerjemahkan sumber daya menjadi rute yang konsisten di Express.",
        durasi_min: 90,
        halaman: [
          {
            judul: "Anatomi permintaan dan respons HTTP",
            blok: [
              h2("Permintaan terdiri dari metode, jalur, dan header"),
              p(
                "Setiap panggilan ke REST API adalah pertukaran pesan HTTP. Klien mengirim metode, jalur, header, dan kadang body; server menjawab dengan kode status, header, dan body. Memahami bagian mana yang mengubah keadaan server adalah dasar seluruh desain API.",
              ),
              p("Metode yang paling sering dipakai, dan arti semantiknya:"),
              li(
                "GET — mengambil data, tidak boleh mengubah keadaan server.",
                "POST — membuat sumber daya baru; bukan idempoten.",
                "PUT — mengganti seluruh representasi sumber daya; idempoten.",
                "PATCH — mengubah sebagian field saja.",
                "DELETE — menghapus sumber daya; idempoten.",
              ),
              h3("Kode status adalah kontrak"),
              p(
                "Klien mengambil keputusan dari kode status, bukan dari teks pesan. Mengembalikan 200 untuk setiap kejadian memaksa klien membaca body untuk tahu apa yang sebenarnya terjadi.",
              ),
              li(
                "2xx berhasil: 200 OK, 201 Created (sertakan header Location), 204 No Content untuk operasi tanpa isi.",
                "4xx kesalahan klien: 400 sintaks buruk, 401 belum terautentikasi, 403 tidak berwenang, 404 tidak ditemukan, 409 konflik, 422 entitas tidak dapat diproses.",
                "5xx kesalahan server: 500 galat tak terduga yang bukan salah klien.",
              ),
              q(
                "Jangan membalas 200 dengan isi { \"error\": true } — itu menghapus satu-satunya informasi yang dibutuhkan klien untuk bereaksi.",
              ),
            ],
          },
          {
            judul: "Merancang rute dan sumber daya",
            blok: [
              h2("Sumber daya adalah kata benda"),
              p(
                "REST memodelkan API sebagai kumpulan sumber daya, bukan kumpulan aksi. Karena itu jalur sebaiknya berupa kata benda, dan perilaku dibawa oleh metode HTTP.",
              ),
              li(
                "/kursus dan /kursus/:id untuk daftar dan satu item.",
                "Hindari kata kerja di jalur: /kursus/123/arsipkan lebih baik ditulis sebagai POST /kursus/123/arsip.",
                "Parameter kueri untuk penyaringan dan penomoran: /kursus?level=dasar&page=2.",
                "Gunakan huruf kecil dan tanda hubung: /materi-belajar, bukan /MateriBelajar.",
              ),
              h3("Menulis rute dengan Express"),
              p(
                "Express mencocokkan jalur ke fungsi handler. Parameter dinamis diambil lewat req.params, kueri lewat req.query, dan body JSON lewat req.body setelah middleware express.json() terpasang.",
              ),
              kode({
                kode: `const express = require("express");
const app = express();

app.use(express.json());

// Kata benda jamak untuk koleksi dan satu item.
app.get("/kursus", (req, res) => {
  const { level } = req.query; // filter opsional
  res.json({ data: daftarKursus(level) });
});

app.get("/kursus/:id", (req, res) => {
  const kursus = cariKursus(req.params.id);
  if (!kursus) {
    return res.status(404).json({ error: "Kursus tidak ditemukan" });
  }
  res.json({ data: kursus });
});

app.listen(3000, () => console.log("API berjalan di port 3000"));`,
                dapatDijalankan: false,
              }),
              p(
                "Blok kode di atas adalah JavaScript, bukan C++. Ia hanya contoh untuk dibaca — tombol Jalankan sengaja tidak tersedia karena runner platform ini mengompilasi C++.",
              ),
              q(
                "Konsistensi lebih penting daripada kesempurnaan: pilih satu gaya penamaan dan pakai di seluruh API.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Dasar HTTP dan Rute REST",
          deskripsi: "Memastikan kamu memahami semantik metode dan kode status HTTP.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Metode HTTP mana yang idempoten dan mengganti seluruh representasi sumber daya?",
              pilihan: ["POST", "PUT", "PATCH", "CONNECT"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kode status paling tepat saat sumber daya baru berhasil dibuat?",
              pilihan: ["200 OK", "201 Created", "204 No Content", "302 Found"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kode status yang berarti klien belum terautentikasi?",
              pilihan: ["400", "401", "403", "404"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Bagaimana cara yang benar menandai kegagalan pada REST API?",
              pilihan: [
                "Balas 200 dengan body { error: true }",
                "Balas kode status 4xx/5xx yang sesuai",
                "Balas 200 dengan body kosong",
                "Balas 302 ke halaman galat",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Middleware, Validasi, dan Penanganan Galat",
        ringkasan:
          "Menyusun rantai middleware, memvalidasi input di batas kepercayaan, dan memusatkan penanganan galat.",
        durasi_min: 90,
        halaman: [
          {
            judul: "Middleware sebagai rantai pemrosesan",
            blok: [
              h2("Urutan menentukan perilaku"),
              p(
                "Middleware adalah fungsi dengan tanda tangan (req, res, next). Express menjalankannya berurutan sesuai urutan pendaftaran, dan setiap middleware memutuskan apakah rantai dilanjutkan.",
              ),
              li(
                "express.json() harus didaftarkan sebelum rute yang membaca req.body.",
                "Middleware dapat menghentikan rantai dengan res.send() tanpa memanggil next().",
                "next(err) melompat langsung ke penangan galat, melewati middleware biasa.",
                "Middleware yang dipasang setelah rute tidak akan dijalankan untuk rute itu.",
              ),
              h3("Membaca body, parameter, dan kueri"),
              kode({
                kode: `// Middleware pencatat waktu sederhana.
app.use((req, res, next) => {
  const mulai = Date.now();
  res.on("finish", () => {
    console.log(req.method, req.originalUrl, res.statusCode, Date.now() - mulai + "ms");
  });
  next();
});

app.post("/kursus", async (req, res, next) => {
  try {
    const kursus = await simpanKursus(req.body);
    res.status(201).location("/kursus/" + kursus.id).json({ data: kursus });
  } catch (err) {
    next(err); // serahkan ke penangan galat
  }
});`,
                dapatDijalankan: false,
              }),
              p(
                "Handler async yang melempar galat harus menangkapnya lalu memanggil next(err); Express 5 meneruskan promise yang ditolak ke penangan galat secara otomatis, tetapi try/catch tetap jelas dan portabel.",
              ),
            ],
          },
          {
            judul: "Validasi input dan galat terstruktur",
            blok: [
              h2("Validasi di batas kepercayaan"),
              p(
                "Input dari klien tidak pernah boleh dipercaya. Validasi adalah gerbang tunggal antara data mentah dan basis data; tanpa itu, satu field aneh bisa merusak data atau membuka celah.",
              ),
              li(
                "Periksa tipe, panjang, dan rentang nilai sebelum menyentuh basis data.",
                "Kembalikan 422 dengan daftar field yang salah, bukan pesan umum \"input tidak valid\".",
                "Jangan pernah memasukkan input mentah ke kueri SQL atau perintah shell.",
              ),
              h3("Satu penangan galat di ujung rantai"),
              p(
                "Penangan galat Express dikenali dari jumlah argumennya: empat, yaitu (err, req, res, next). Selama tidak ada penangan seperti ini, galat akan bocor sebagai halaman HTML default yang mengungkap jejak tumpukan.",
              ),
              kode({
                kode: `app.use((err, req, res, next) => {
  if (err.name === "ValidationError") {
    return res.status(422).json({
      error: "Validasi gagal",
      detail: err.detail,
    });
  }
  console.error(err);
  res.status(500).json({ error: "Kesalahan internal server" });
});`,
                dapatDijalankan: false,
              }),
              p(
                "Jangan kirim err.message mentah ke klien di produksi. Pesan internal sering memuat nama tabel, jalur berkas, atau detail infrastruktur yang tidak perlu diketahui penyerang.",
              ),
              q("Galat yang bocor ke klien adalah peta jalan bagi penyerang."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Middleware dan Penanganan Galat",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Berapa jumlah argumen yang menandai middleware penangan galat di Express?",
              pilihan: ["Dua", "Tiga", "Empat", "Lima"],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Kapan express.json() harus didaftarkan?",
              pilihan: [
                "Setelah semua rute",
                "Sebelum rute yang membaca req.body",
                "Di dalam setiap controller",
                "Di berkas terpisah dan tidak pernah dipanggil",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan:
                "Kode status paling tepat saat body JSON valid secara sintaks tetapi gagal aturan validasi?",
              pilihan: ["400 Bad Request", "422 Unprocessable Content", "401 Unauthorized", "500 Internal Server Error"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang terjadi bila middleware memanggil next(err)?",
              pilihan: [
                "Rantai lanjut ke middleware berikutnya seperti biasa",
                "Express melompat ke penangan galat",
                "Permintaan dibatalkan tanpa respons",
                "Express mengulang permintaan dari awal",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // r8 — Aksesibilitas Web (WCAG) Dasar
  // -------------------------------------------------------------------------
  {
    id: "r8",
    slug: "r8",
    judul: "Aksesibilitas Web (WCAG) Dasar",
    deskripsi:
      "Kuasai prinsip WCAG 2.2 (Perceivable, Operable, Understandable, Robust), tingkat kepatuhan A/AA/AAA, serta praktik HTML semantik, teks alternatif, kontras, dan navigasi keyboard yang membuat situs dapat dipakai semua orang.",
    tags: ["Accessibility", "HTML"],
    level: "menengah",
    track: "web-dev",
    provider: "W3C",
    modul: [
      {
        judul: "Prinsip POUR dan Tingkat Kepatuhan",
        ringkasan:
          "Kerangka WCAG 2.2: empat prinsip, kriteria sukses bernomor, dan perbedaan tingkat A, AA, dan AAA.",
        durasi_min: 30,
        halaman: [
          {
            judul: "Empat prinsip yang mudah diingat",
            blok: [
              h2("POUR"),
              p(
                "WCAG 2.2 disusun di atas empat prinsip yang saling menopang. Menghafalnya membantu kamu menebak kriteria mana yang relevan ketika menghadapi komponen baru.",
              ),
              li(
                "Perceivable — informasi harus dapat dipersepsikan, misalnya lewat teks alternatif untuk gambar dan kontras yang cukup.",
                "Operable — antarmuka dapat dioperasikan, termasuk hanya dengan keyboard.",
                "Understandable — teks dapat dibaca dan perilaku antarmuka dapat diprediksi.",
                "Robust — konten dapat diandalkan oleh beragam teknologi bantu, termasuk layar pembaca.",
              ),
              h3("Panduan, kriteria sukses, dan teknik"),
              p(
                "Setiap prinsip dipecah menjadi panduan, lalu menjadi kriteria sukses yang dapat diuji, lalu menjadi teknik implementasi. Yang dinilai kepatuhannya adalah kriteria sukses, bukan tekniknya — teknik hanya contoh cara memenuhinya.",
              ),
              q("WCAG bukan daftar tips; ia hierarki kriteria yang bisa diuji satu per satu."),
            ],
          },
          {
            judul: "Tingkat A, AA, dan AAA",
            blok: [
              h2("Tiga tingkat kepatuhan"),
              p(
                "Setiap kriteria sukses berada di salah satu dari tiga tingkat. Kepatuhan dinyatakan per halaman atau per situs lengkap, bukan per komponen.",
              ),
              li(
                "Level A: kriteria minimum; kegagalan di sini membuat konten tidak dapat dipakai sama sekali oleh sebagian pengguna.",
                "Level AA: tingkat yang paling sering dijadikan acuan kebijakan dan peraturan aksesibilitas.",
                "Level AAA: paling ketat dan sering tidak realistis untuk diterapkan di seluruh situs.",
              ),
              h3("Angka kontras yang perlu diingat"),
              li(
                "1.4.3 Kontras (Minimum) — AA: rasio 4,5:1 untuk teks normal dan 3:1 untuk teks besar.",
                "1.4.11 Kontras Non-teks — AA: rasio 3:1 untuk batas komponen antarmuka dan ikon yang bermakna.",
                "1.4.6 Kontras (Diperkuat) — AAA: rasio 7:1 untuk teks normal.",
                "Teks besar berarti sekitar 24px ke atas, atau 18,66px ke atas bila dicetak tebal.",
              ),
              p(
                "Nomor kriteria seperti 1.4.3 dibaca berlapis: angka pertama prinsip, kedua panduan, ketiga kriteria.",
              ),
              q(
                "Menyebut \"patuh AA\" berarti menyebut versi standar tertentu — sebut WCAG 2.2, bukan hanya \"WCAG\".",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Prinsip WCAG dan Tingkat Kepatuhan",
          deskripsi: "Menguji pemahaman POUR, tingkat kepatuhan, dan ambang kontras.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa kepanjangan prinsip POUR dalam WCAG?",
              pilihan: [
                "Perceivable, Operable, Understandable, Robust",
                "Portable, Open, Universal, Responsive",
                "Public, Official, Reviewed, Approved",
                "Perceivable, Optimized, Usable, Reliable",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Rasio kontras minimum untuk teks normal pada level AA adalah?",
              pilihan: ["3:1", "4,5:1", "7:1", "2:1"],
              jawaban_benar: 1,
            },
            {
              pertanyaan:
                "Level WCAG yang paling sering dijadikan acuan kebijakan aksesibilitas adalah?",
              pilihan: ["Level A", "Level AA", "Level AAA", "Tidak ada level"],
              jawaban_benar: 1,
            },
            {
              pertanyaan:
                "Prinsip mana yang menuntut konten dapat diandalkan oleh berbagai teknologi bantu?",
              pilihan: ["Perceivable", "Operable", "Understandable", "Robust"],
              jawaban_benar: 3,
            },
          ],
        },
      },
      {
        judul: "Praktik Aksesibilitas di HTML",
        ringkasan:
          "Semantik HTML, teks alternatif, kontras, urutan fokus, dan kapan ARIA benar-benar diperlukan.",
        durasi_min: 30,
        halaman: [
          {
            judul: "Semantik, teks alternatif, dan kontras",
            blok: [
              h2("HTML yang benar adalah lapisan aksesibilitas pertama"),
              p(
                "Teknologi bantu membaca struktur DOM, bukan tampilan visual. Elemen HTML asli sudah membawa peran, keadaan, dan perilaku keyboard — memakainya berarti kamu mendapat aksesibilitas gratis.",
              ),
              li(
                "<button> untuk tindakan, <a href> untuk navigasi — jangan memakai <div onclick>.",
                "Setiap gambar butuh teks alternatif bermakna; gambar dekoratif murni memakai alt=\"\".",
                "Satu <h1> per halaman dan hierarki heading yang berurutan memudahkan navigasi layar pembaca.",
                "Atribut lang pada <html> memberi tahu pelafalan yang benar.",
              ),
              h3("Formulir yang dapat dipahami"),
              kode({
                kode: `<form action="/daftar" method="post">
  <label for="email">Alamat email</label>
  <input id="email" name="email" type="email" required
         aria-describedby="email-bantuan" />
  <p id="email-bantuan">Kami tidak akan membagikan alamatmu.</p>
  <button type="submit">Daftar</button>
</form>`,
                dapatDijalankan: false,
              }),
              p(
                "Setiap kontrol formulir butuh label yang benar-benar terhubung lewat atribut for/id. Placeholder bukan pengganti label karena ia hilang saat pengguna mulai mengetik.",
              ),
              q(
                "Aturan pertama ARIA: jangan pakai ARIA bila elemen HTML asli sudah bisa melakukan hal yang sama.",
              ),
            ],
          },
          {
            judul: "Navigasi keyboard dan ARIA",
            blok: [
              h2("Semua yang bisa diklik harus bisa di-Tab"),
              p(
                "Pengguna yang tidak memakai tetikus menjelajah dengan Tab dan Enter. Jika sebuah kontrol hanya merespons klik tetikus, ia tidak dapat dipakai oleh mereka.",
              ),
              li(
                "Urutan fokus harus logis dan mengikuti urutan visual halaman.",
                "Indikator fokus tidak boleh dihapus tanpa pengganti — pakai :focus-visible dengan gaya yang jelas.",
                "Sediakan tautan \"lewati ke konten\" agar pengguna dapat melewati menu berulang.",
              ),
              h3("Kapan ARIA benar-benar diperlukan"),
              p(
                "ARIA mengubah pohon aksesibilitas, bukan tampilan. Ia tepat dipakai ketika tidak ada elemen HTML yang cocok, misalnya menu yang dapat dibuka-tutup atau wilayah yang mengumumkan perubahan.",
              ),
              kode({
                kode: `<button type="button" aria-expanded="false" aria-controls="menu-utama">
  Menu
</button>
<ul id="menu-utama" hidden>
  <li><a href="/kursus">Kursus</a></li>
  <li><a href="/profil">Profil</a></li>
</ul>

<!-- Wilayah yang mengumumkan perubahan tanpa memindahkan fokus -->
<p role="status" aria-live="polite">Perubahan tersimpan.</p>`,
                dapatDijalankan: false,
              }),
              p(
                "Atribut aria-expanded wajib diperbarui oleh JavaScript setiap kali menu dibuka atau ditutup; nilai yang tidak sinkron lebih membingungkan daripada tidak ada ARIA sama sekali.",
              ),
              q("ARIA tidak memperbaiki HTML yang salah; ia hanya menjelaskan apa yang sudah benar."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Praktik Aksesibilitas HTML",
          deskripsi: "Semantik, teks alternatif, fokus keyboard, dan penggunaan ARIA.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Elemen apa yang tepat untuk tindakan yang memicu JavaScript?",
              pilihan: ["<a href=\"#\">", "<div>", "<button>", "<span>"],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Nilai alt yang tepat untuk gambar dekoratif murni adalah?",
              pilihan: ["alt=\"gambar\"", "alt=\"\"", "Tanpa atribut alt sama sekali", "alt=\"dekoratif\""],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa isi aturan pertama ARIA?",
              pilihan: [
                "Selalu pakai ARIA untuk setiap elemen",
                "Jangan pakai ARIA bila elemen HTML asli sudah cukup",
                "ARIA wajib untuk semua tombol",
                "ARIA menggantikan semantik HTML",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa akibat menghapus indikator fokus tanpa pengganti?",
              pilihan: [
                "Tidak ada dampaknya",
                "Pengguna keyboard kehilangan penanda posisi fokus",
                "Layar pembaca berhenti bekerja",
                "Halaman gagal validasi HTML",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // r9 — Playwright End-to-End Testing
  // -------------------------------------------------------------------------
  {
    id: "r9",
    slug: "r9",
    judul: "Playwright End-to-End Testing",
    deskripsi:
      "Uji aplikasi web dari sisi pengguna dengan Playwright: menulis test yang stabil memakai locator berbasis peran, memahami auto-waiting dan web-first assertion, lalu menjalankannya di beberapa browser lewat pipeline CI.",
    tags: ["Testing", "Playwright"],
    level: "lanjut",
    track: "web-dev",
    provider: "Playwright",
    modul: [
      {
        judul: "Menjalankan Test dan Locator",
        ringkasan:
          "Memasang Playwright Test, menulis skenario pertama, dan memilih locator yang tidak rapuh.",
        durasi_min: 45,
        halaman: [
          {
            judul: "Test pertama dengan Playwright",
            blok: [
              h2("Memasang dan menjalankan"),
              p(
                "Playwright Test adalah runner bawaan dari paket @playwright/test. Ia menyediakan struktur test, fixture, dan assertion yang sadar-browser, sehingga kamu tidak perlu merangkai runner lain.",
              ),
              kode({
                kode: `import { test, expect } from "@playwright/test";

test("beranda menampilkan judul utama", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Careevo");
});

test("pengguna dapat membuka halaman kursus", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Kursus" }).click();
  await expect(page).toHaveURL(/\/kursus$/);
});`,
                dapatDijalankan: false,
              }),
              li(
                "npx playwright install memasang browser Chromium, Firefox, dan WebKit.",
                "npx playwright test menjalankan seluruh berkas *.spec.ts.",
                "npx playwright test --ui membuka mode interaktif untuk menelusuri langkah.",
                "npx playwright codegen merekam aksimu menjadi kode test.",
              ),
              p(
                "Blok kode di atas adalah TypeScript, bukan C++. Ia hanya dibaca; tombol Jalankan sengaja tidak tersedia karena runner platform ini mengompilasi C++.",
              ),
            ],
          },
          {
            judul: "Locator yang tahan perubahan",
            blok: [
              h2("Utamakan peran dan label"),
              p(
                "Locator adalah cara menunjuk elemen di halaman. Pilihan locator menentukan seberapa sering test rusak saat tampilan diubah, tanpa mengubah perilakunya.",
              ),
              li(
                "page.getByRole(\"button\", { name: \"Masuk\" }) — paling stabil karena mengikuti peran dan nama aksesibel.",
                "getByLabel untuk kontrol formulir yang punya label.",
                "getByTestId(\"keranjang\") untuk elemen tanpa makna aksesibel; perlu atribut data-testid.",
                "getByText untuk teks yang terlihat, dengan hati-hati karena teks mudah berubah.",
              ),
              h3("Hindari selektor rapuh"),
              kode({
                kode: `// Rapuh: bergantung pada urutan DOM dan nama kelas CSS.
await page.locator("main > div:nth-child(2) .btn-primary").click();

// Lebih tahan lama: bergantung pada peran dan nama aksesibel.
await page.getByRole("button", { name: "Tambah ke keranjang" }).click();

// Alternatif terkontrol untuk elemen tanpa peran:
await page.getByTestId("keranjang-tambah").click();`,
                dapatDijalankan: false,
              }),
              p(
                "Selektor berbasis peran juga memberi umpan balik aksesibilitas gratis: bila locator peran tidak menemukan elemen, sering kali itu tanda bahwa elemennya memang tidak aksesibel.",
              ),
              q(
                "Kalau test hanya bisa menemukan elemen lewat kelas CSS, refactor tampilan akan sering mematahkannya.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Dasar Playwright dan Locator",
          deskripsi: "Paket, perintah dasar, dan pemilihan locator.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Paket yang menyediakan test runner resmi Playwright adalah?",
              pilihan: ["playwright", "@playwright/test", "puppeteer", "jest-playwright"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Locator mana yang paling tahan terhadap perubahan tampilan?",
              pilihan: [
                "page.locator(\".btn-primary\")",
                "page.locator(\"div > div:nth-child(3)\")",
                "page.getByRole(\"button\", { name: \"Masuk\" })",
                "page.locator(\"//div[3]\")",
              ],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Perintah untuk memasang browser Playwright?",
              pilihan: [
                "npx playwright install",
                "npm run browsers",
                "npx playwright setup",
                "npx playwright browsers --add",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Atribut apa yang dipakai getByTestId secara bawaan?",
              pilihan: ["data-cy", "data-testid", "id", "data-qa"],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Auto-waiting, Fixture, dan CI",
        ringkasan:
          "Memanfaatkan auto-waiting dan assertion yang mencoba ulang, membagi penyiapan lewat fixture, dan menjalankan test di pipeline.",
        durasi_min: 45,
        halaman: [
          {
            judul: "Auto-waiting dan web-first assertion",
            blok: [
              h2("Playwright menunggu, kamu tidak"),
              p(
                "Sebelum bertindak, Playwright memeriksa apakah elemen siap: terlihat, stabil (tidak beranimasi), menerima event, dan aktif. Karena itu kamu tidak perlu menulis waktu tunggu manual.",
              ),
              li(
                "Aksi seperti click menunggu elemen memenuhi syarat actionability.",
                "Assertion seperti toBeVisible(), toHaveText(), dan toHaveURL() mencoba ulang sampai batas waktu.",
                "Jangan menyisipkan waitForTimeout — itu membuat test lambat sekaligus tetap rapuh.",
              ),
              h3("Menyinkronkan dengan jaringan"),
              kode({
                kode: `await Promise.all([
  page.waitForResponse((r) => r.url().includes("/api/kursus") && r.ok()),
  page.getByRole("button", { name: "Muat" }).click(),
]);

await expect(page.getByRole("listitem")).toHaveCount(3);`,
                dapatDijalankan: false,
              }),
              p(
                "Menunggu respons bersamaan dengan aksi mencegah balapan: klik dan penantian dijalankan pada saat yang sama, bukan berurutan.",
              ),
              q("Waktu tunggu tetap adalah tanda test yang belum selesai dirancang."),
            ],
          },
          {
            judul: "Fixture, proyek, dan pipeline",
            blok: [
              h2("Fixture membagi penyiapan"),
              p(
                "Playwright menyediakan fixture bawaan seperti page, context, dan browser. Kamu juga bisa menambah fixture sendiri, misalnya sesi yang sudah login, agar setiap test mulai dari keadaan bersih tanpa mengulang langkah yang sama.",
              ),
              li(
                "projects di playwright.config.ts menjalankan matriks Chromium, Firefox, dan WebKit.",
                "baseURL membuat page.goto(\"/\") relatif terhadap satu alamat.",
                "storageState menyimpan sesi login agar tidak mengulang alur autentikasi.",
                "retries menangani kegagalan sekunder di CI; trace: \"on-first-retry\" merekam jejak saat itu terjadi.",
              ),
              h3("Menjalankan di CI"),
              kode({
                kode: `// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});`,
                dapatDijalankan: false,
              }),
              p(
                "Jejak (trace) dapat dibuka dengan npx playwright show-trace dan berisi rekaman DOM, jaringan, serta konsol — ini cara tercepat memahami kegagalan yang tidak muncul di lokal.",
              ),
              q(
                "Test yang lulus di laptop tetapi gagal di CI biasanya soal waktu, data, atau paralelisme — bukan soal browser.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Auto-waiting, Fixture, dan CI",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa yang dilakukan auto-waiting sebelum Playwright mengeklik elemen?",
              pilihan: [
                "Menunggu 5 detik tetap",
                "Memeriksa actionability elemen lalu mengeklik",
                "Memuat ulang seluruh halaman",
                "Menonaktifkan seluruh animasi CSS",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Praktik mana yang sebaiknya dihindari di dalam test?",
              pilihan: [
                "await expect(locator).toBeVisible()",
                "await page.waitForTimeout(3000)",
                "await page.getByRole(\"button\").click()",
                "test.beforeEach(async ({ page }) => {})",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Fitur konfigurasi mana yang menjalankan test di beberapa browser sekaligus?",
              pilihan: ["projects", "retries", "workers", "trace"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa fungsi storageState?",
              pilihan: [
                "Menyimpan jejak trace",
                "Menyimpan sesi (misalnya login) agar dipakai ulang antar test",
                "Menyalin berkas unduhan",
                "Menetapkan ukuran viewport",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // r10 — Optimasi Performa Web (Core Web Vitals)
  // -------------------------------------------------------------------------
  {
    id: "r10",
    slug: "r10",
    judul: "Optimasi Performa Web (Core Web Vitals)",
    deskripsi:
      "Pahami tiga metrik inti yang dinilai Google — LCP, INP, dan CLS — beserta ambang batasnya, cara mengukurnya di lab dan lapangan, serta teknik optimasi nyata yang mempercepat muat dan menstabilkan tata letak.",
    tags: ["Performance"],
    level: "lanjut",
    track: "web-dev",
    provider: "web.dev",
    modul: [
      {
        judul: "Metrik dan Ambang Core Web Vitals",
        ringkasan:
          "Apa yang diukur LCP, INP, dan CLS, ambang batas baik/perlu perbaikan/buruk, dan cara membacanya.",
        durasi_min: 30,
        halaman: [
          {
            judul: "Tiga metrik inti",
            blok: [
              h2("Apa yang diukur Core Web Vitals"),
              p(
                "Core Web Vitals adalah sekumpulan metrik yang berpusat pada pengalaman pengguna nyata: seberapa cepat halaman tampak selesai dimuat, seberapa gesit ia merespons interaksi, dan seberapa stabil tata letaknya.",
              ),
              li(
                "LCP (Largest Contentful Paint) — kapan elemen terbesar di viewport selesai dirender; menggambarkan persepsi kecepatan muat.",
                "INP (Interaction to Next Paint) — jeda terburuk antara interaksi pengguna dan frame berikutnya; menggantikan FID sejak 12 Maret 2024.",
                "CLS (Cumulative Layout Shift) — total pergeseran tata letak tak terduga selama halaman hidup.",
              ),
              h3("Ambang batas"),
              li(
                "LCP: baik ≤ 2,5 detik · perlu perbaikan 2,5–4 detik · buruk > 4 detik.",
                "INP: baik ≤ 200 ms · perlu perbaikan 200–500 ms · buruk > 500 ms.",
                "CLS: baik ≤ 0,1 · perlu perbaikan 0,1–0,25 · buruk > 0,25.",
              ),
              p(
                "Angka-angka ini ditetapkan pada persentil ke-75: 75% kunjungan harus berada di bawah ambang agar sebuah halaman dianggap baik.",
              ),
              q(
                "Core Web Vitals dinilai pada persentil ke-75 kunjungan, terpisah untuk seluler dan desktop.",
              ),
            ],
          },
          {
            judul: "Mengukur di lab dan di lapangan",
            blok: [
              h2("Lab vs lapangan"),
              p(
                "Pengukuran lab dilakukan dengan perangkat dan jaringan yang dikendalikan sehingga hasilnya dapat diulang; pengukuran lapangan datang dari pengguna sungguhan dan mencerminkan variasi perangkat serta jaringan.",
              ),
              li(
                "CrUX (Chrome User Experience Report) mengumpulkan data lapangan dari pengguna Chrome sungguhan.",
                "Lighthouse dan PageSpeed Insights menyediakan audit lab yang dapat diulang.",
                "Pustaka web-vitals mengirim LCP, INP, dan CLS dari halaman produksi ke analitikmu sendiri.",
                "Search Console menampilkan laporan Core Web Vitals per kelompok URL.",
              ),
              h3("Membaca angka dengan benar"),
              kode({
                kode: `import { onLCP, onINP, onCLS } from "web-vitals";

function kirim(metrik) {
  const isi = JSON.stringify({ nama: metrik.name, nilai: metrik.value });
  navigator.sendBeacon("/analitik", isi);
}

onLCP(kirim);
onINP(kirim);
onCLS(kirim);`,
                dapatDijalankan: false,
              }),
              p(
                "Nilai metrik yang dilaporkan bukan nilai rata-rata, melainkan nilai yang mewakili persentil ke-75. Karena itu satu halaman lambat di perangkat kelas bawah bisa mendominasi penilaian.",
              ),
              q("Angka lab menjelaskan sebab; angka lapangan menentukan apakah perbaikan benar-benar berhasil."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Metrik dan Ambang Core Web Vitals",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Ketiga Core Web Vitals saat ini adalah?",
              pilihan: [
                "LCP, FID, CLS",
                "LCP, INP, CLS",
                "TTFB, FCP, TBT",
                "FCP, LCP, TTI",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Metrik apa yang menggantikan FID pada Maret 2024?",
              pilihan: ["TBT", "INP", "TTI", "CLS"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Ambang \"baik\" untuk LCP adalah?",
              pilihan: ["≤ 1 detik", "≤ 2,5 detik", "≤ 4 detik", "≤ 200 ms"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Pada persentil berapa Core Web Vitals dinilai di lapangan?",
              pilihan: ["Median (ke-50)", "ke-75", "ke-95", "ke-99"],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Optimasi Nyata",
        ringkasan:
          "Teknik mempercepat LCP, menstabilkan CLS dengan mencadangkan ruang, dan memperbaiki INP dengan memecah tugas panjang.",
        durasi_min: 30,
        halaman: [
          {
            judul: "Mempercepat LCP",
            blok: [
              h2("Kenali elemen LCP dulu"),
              p(
                "LCP biasanya sebuah gambar hero, poster video, gambar latar, atau blok teks besar. Optimasi yang tepat bergantung pada elemen mana yang menjadi LCP di halamanmu — ukur dulu, jangan menebak.",
              ),
              li(
                "Jangan memuat gambar LCP dengan loading=\"lazy\" — itu justru menundanya.",
                "Pakai fetchpriority=\"high\" dan <link rel=\"preload\"> untuk gambar hero.",
                "Sajikan gambar responsif dengan srcset/sizes dan format modern seperti AVIF atau WebP.",
                "Tekan TTFB lewat cache CDN, kompresi, dan server yang tidak memblokir render.",
              ),
              h3("Contoh markup"),
              kode({
                kode: `<link rel="preload" as="image" href="/hero.avif" fetchpriority="high" />

<img
  src="/hero.avif"
  width="1200"
  height="630"
  alt="Tangkapan layar dasbor Careevo"
  fetchpriority="high"
  decoding="async"
/>`,
                dapatDijalankan: false,
              }),
              p(
                "LCP adalah rantai empat tahap: TTFB, penundaan saat sumber daya belum dimuat, waktu muat sumber daya, dan waktu render. Perbaiki tahap yang paling terlambat, bukan semuanya sekaligus.",
              ),
              q(
                "Mengoptimalkan tahap yang bukan penyebab keterlambatan hanya menambah pekerjaan tanpa memindahkan angka.",
              ),
            ],
          },
          {
            judul: "Menstabilkan CLS dan merapikan INP",
            blok: [
              h2("Cadangkan ruang sebelum konten datang"),
              p(
                "CLS bertambah setiap kali elemen bergeser tanpa sebab yang dipicu pengguna. Penyebab paling umum adalah gambar tanpa ukuran, iklan yang disisipkan, dan font yang berganti metrik.",
              ),
              li(
                "Setel width dan height (atau aspect-ratio) pada gambar dan video.",
                "Sediakan ruang tetap untuk iklan, iframe, dan banner persetujuan.",
                "Jangan menyisipkan konten di atas konten yang sudah dibaca; gunakan transform untuk animasi.",
                "Pakai font-display: swap bersama metrik fallback yang disesuaikan (size-adjust).",
              ),
              h3("Interaksi yang responsif"),
              li(
                "Pecah tugas panjang menjadi bagian di bawah 50 ms dan serahkan kendali dengan scheduler.yield atau setTimeout.",
                "Kurangi JavaScript pada jalur kritis dan tunda pekerjaan yang tidak penting.",
                "Hindari handler yang memaksa sinkronisasi tata letak, seperti membaca offsetWidth lalu langsung menulis gaya.",
              ),
              p(
                "Pergeseran yang diharapkan pengguna — misalnya animasi yang dipicu interaksi — tidak dihitung CLS. Yang dinilai adalah pergeseran tak terduga yang membuat pengguna salah menekan.",
              ),
              q(
                "Main thread yang sibuk membuat interaksi terasa lelet; INP adalah ukuran langsung dari akibatnya.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Optimasi Core Web Vitals",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Praktik mana yang justru memperburuk LCP?",
              pilihan: [
                "fetchpriority=\"high\" pada gambar hero",
                "loading=\"lazy\" pada gambar hero",
                "Preload gambar hero",
                "srcset untuk gambar responsif",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Cara utama mengurangi CLS pada gambar adalah?",
              pilihan: [
                "Memuat gambar lebih cepat",
                "Menetapkan width/height atau aspect-ratio",
                "Menghapus semua animasi",
                "Mengubah format ke AVIF",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Cara paling tepat mengurangi INP adalah?",
              pilihan: [
                "Memecah tugas panjang agar main thread cepat kembali",
                "Menambah animasi CSS",
                "Memperbesar bundel JavaScript",
                "Mengaktifkan lazy-load pada semua gambar",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Pergeseran tata letak seperti apa yang dihitung CLS?",
              pilihan: [
                "Semua animasi",
                "Pergeseran tak terduga yang tidak dipicu interaksi pengguna",
                "Hanya pergeseran pada perangkat seluler",
                "Pergeseran yang terjadi saat pengguna menggulir",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // r11 — Struktur Data untuk Interview
  // -------------------------------------------------------------------------
  {
    id: "r11",
    slug: "r11",
    judul: "Struktur Data untuk Interview",
    deskripsi:
      "Siapkan diri menghadapi wawancara teknis dengan menguasai analisis Big-O, pola dua pointer dan sliding window, hash map, stack, queue, serta penelusuran BFS dan DFS pada pohon dan graf.",
    tags: ["Algoritma", "Interview"],
    level: "menengah",
    track: "data",
    provider: "YouTube",
    modul: [
      {
        judul: "Kompleksitas, Array, dan Dua Pointer",
        ringkasan:
          "Analisis biaya operasi dengan Big-O, lalu dua pola andalan untuk soal array dan string.",
        durasi_min: 90,
        halaman: [
          {
            judul: "Big-O dan analisis biaya",
            blok: [
              h2("Kenapa kompleksitas menentukan jawaban"),
              p(
                "Pewawancara menilai cara kamu memilih struktur dan memperkirakan biayanya, bukan kecepatan mengetik. Menyebut kompleksitas waktu dan ruang sebelum menulis kode menunjukkan kamu berpikir sebelum bertindak.",
              ),
              li(
                "O(1) — akses indeks array, sisip/hapus di ujung stack.",
                "O(log n) — pencarian biner dan operasi pada pohon seimbang.",
                "O(n) — pemindaian linear satu kali.",
                "O(n log n) — pengurutan berbasis perbandingan yang efisien.",
                "O(n²) — dua loop bersarang penuh, sering tanda solusi yang perlu diperbaiki.",
              ),
              h3("Array dinamis di C++"),
              p(
                "std::vector menyimpan elemen secara berurutan sehingga akses indeks O(1), sedangkan menyisipkan di tengah O(n) karena elemen setelahnya harus digeser.",
              ),
              kode({
                kode: `#include <vector>
#include <iostream>

int main() {
    std::vector<int> angka{4, 8, 15, 16, 23, 42};
    // Akses indeks O(1); menambah di akhir O(1) amortisasi.
    std::cout << angka[0] << ' ' << angka.back() << '\\n';
    std::cout << "ukuran: " << angka.size() << '\\n';
    return 0;
}`,
                dapatDijalankan: false,
              }),
              p(
                "Contoh di atas ditulis dalam C++ karena bertopik algoritma, tetapi sengaja dibiarkan tanpa tombol Jalankan; fokus halaman ini adalah analisis, bukan mengeksekusi program.",
              ),
              q("Wawancara menilai cara kamu memilih struktur, bukan hafalan rumus."),
            ],
          },
          {
            judul: "Dua pointer dan sliding window",
            blok: [
              h2("Dua pointer"),
              p(
                "Ketika data terurut, dua pointer yang bergerak dari ujung dapat menggantikan loop bersarang. Setiap langkah memindahkan paling banyak satu pointer, sehingga totalnya O(n).",
              ),
              kode({
                kode: `#include <vector>
#include <utility>

// Array terurut menaik; cari indeks pasangan yang jumlahnya sama dengan target.
std::pair<int, int> duaJumlah(const std::vector<int>& a, int target) {
    int kiri = 0, kanan = static_cast<int>(a.size()) - 1;
    while (kiri < kanan) {
        int jumlah = a[kiri] + a[kanan];
        if (jumlah == target) return {kiri, kanan};
        if (jumlah < target) ++kiri; else --kanan;
    }
    return {-1, -1};
}`,
                dapatDijalankan: false,
              }),
              h3("Sliding window"),
              p(
                "Sliding window memakai jendela yang bergeser di atas array atau string. Cocok untuk soal \"subarray terpanjang\" atau \"jumlah maksimum dengan panjang tetap\" karena setiap elemen masuk dan keluar jendela satu kali.",
              ),
              kode({
                kode: `#include <vector>
#include <algorithm>

// Jumlah maksimum subarray dengan panjang tetap k.
long long jendelaMaks(const std::vector<int>& a, int k) {
    long long jendela = 0;
    for (int i = 0; i < k; ++i) jendela += a[i];
    long long terbaik = jendela;
    for (int i = k; i < static_cast<int>(a.size()); ++i) {
        jendela += a[i] - a[i - k];   // geser jendela satu langkah
        terbaik = std::max(terbaik, jendela);
    }
    return terbaik;
}`,
                dapatDijalankan: false,
              }),
              p(
                "Perhatikan bahwa solusi naif untuk soal yang sama adalah O(n·k) karena menjumlahkan ulang setiap jendela; sliding window menurunkannya menjadi O(n) dengan memanfaatkan hasil sebelumnya.",
              ),
              q(
                "Sebutkan kompleksitas sebelum dan sesudah perbaikan — itu bagian yang paling dihargai dalam wawancara.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Kompleksitas dan Dua Pointer",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Kompleksitas waktu pencarian biner pada array terurut adalah?",
              pilihan: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kompleksitas rata-rata pencarian pada hash map adalah?",
              pilihan: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Teknik tepat untuk mencari pasangan berjumlah target pada array terurut?",
              pilihan: ["Dua pointer dari kedua ujung", "Bubble sort", "Rekursi tanpa kondisi basis", "BFS"],
              jawaban_benar: 0,
            },
            {
              pertanyaan:
                "Berapa kompleksitas sliding window untuk jumlah maksimum subarray panjang tetap k?",
              pilihan: ["O(1)", "O(log n)", "O(n)", "O(n·k)"],
              jawaban_benar: 2,
            },
          ],
        },
      },
      {
        judul: "Hash Map, Stack, Queue, dan Pohon",
        ringkasan:
          "Memilih wadah yang tepat untuk tiap soal, lalu menelusuri pohon dan graf dengan DFS dan BFS.",
        durasi_min: 90,
        halaman: [
          {
            judul: "Hash map, stack, dan queue",
            blok: [
              h2("Memilih wadah yang tepat"),
              p(
                "Banyak soal wawancara selesai begitu kamu memilih struktur data yang benar. Kenali operasi khas masing-masing dan kompleksitasnya.",
              ),
              li(
                "unordered_map untuk pencarian cepat rata-rata O(1) ketika urutan tidak penting.",
                "stack (LIFO) untuk tanda kurung berimbang, fitur undo, dan DFS iteratif.",
                "queue (FIFO) untuk BFS dan penjadwalan berurutan.",
                "priority_queue untuk mengambil elemen terkecil atau terbesar berulang kali.",
              ),
              h3("Menghitung frekuensi"),
              kode({
                kode: `#include <unordered_map>
#include <string>
#include <vector>

std::unordered_map<std::string, int> hitung(const std::vector<std::string>& kata) {
    std::unordered_map<std::string, int> frekuensi;
    for (const auto& k : kata) ++frekuensi[k];  // rata-rata O(1) per sisipan
    return frekuensi;
}`,
                dapatDijalankan: false,
              }),
              p(
                "Setiap kurung buka didorong ke stack, dan setiap kurung tutup harus cocok dengan puncak stack. Pola validasi tanda kurung berimbang muncul sangat sering karena memperlihatkan pemahaman LIFO secara langsung.",
              ),
              kode({
                kode: `#include <stack>
#include <string>

bool seimbang(const std::string& s) {
    std::stack<char> tumpukan;
    for (char c : s) {
        if (c == '(' || c == '[' || c == '{') {
            tumpukan.push(c);
        } else {
            if (tumpukan.empty()) return false;
            char atas = tumpukan.top();
            if ((c == ')' && atas != '(') ||
                (c == ']' && atas != '[') ||
                (c == '}' && atas != '{')) return false;
            tumpukan.pop();
        }
    }
    return tumpukan.empty();
}`,
                dapatDijalankan: false,
              }),
              q(
                "Kalau kamu bisa menyebut kasus terburuk tiap operasi, kamu sudah menguasai separuh jawabannya.",
              ),
            ],
          },
          {
            judul: "Pohon, BFS, dan DFS",
            blok: [
              h2("Penelusuran pohon dan graf"),
              p(
                "DFS dan BFS adalah dua cara menjelajahi graf. Keduanya mengunjungi setiap simpul dan sisi sekali, jadi kompleksitasnya O(V + E), tetapi urutan kunjungannya menghasilkan kegunaan yang berbeda.",
              ),
              li(
                "DFS memakai stack atau rekursi — bagus untuk mendeteksi siklus dan menelusuri jalur.",
                "BFS memakai queue — bagus untuk jarak terpendek pada graf tak berbobot.",
                "Simpan himpunan dikunjungi agar tidak berputar tanpa henti pada graf bersiklus.",
              ),
              h3("DFS rekursif"),
              kode({
                kode: `#include <vector>

void dfs(int simpul, const std::vector<std::vector<int>>& tetangga,
         std::vector<bool>& dikunjungi) {
    dikunjungi[simpul] = true;
    for (int berikut : tetangga[simpul]) {
        if (!dikunjungi[berikut]) dfs(berikut, tetangga, dikunjungi);
    }
}`,
                dapatDijalankan: false,
              }),
              h3("BFS berlapis"),
              kode({
                kode: `#include <queue>
#include <vector>

std::vector<int> jarakDari(int sumber, const std::vector<std::vector<int>>& tetangga) {
    std::vector<int> jarak(tetangga.size(), -1);
    std::queue<int> antrian;
    jarak[sumber] = 0;
    antrian.push(sumber);
    while (!antrian.empty()) {
        int kini = antrian.front();
        antrian.pop();
        for (int berikut : tetangga[kini]) {
            if (jarak[berikut] == -1) {          // belum pernah dikunjungi
                jarak[berikut] = jarak[kini] + 1;
                antrian.push(berikut);
            }
        }
    }
    return jarak;
}`,
                dapatDijalankan: false,
              }),
              q(
                "Pohon tidak punya siklus; graf bisa. Perbedaan itu menentukan perlunya himpunan dikunjungi.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Hash Map, Stack, Queue, dan Pohon",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Struktur data yang paling cocok memvalidasi tanda kurung berimbang?",
              pilihan: ["Queue", "Stack", "Hash map", "Priority queue"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Struktur data yang dipakai BFS untuk menyimpan kandidat simpul?",
              pilihan: ["Stack", "Queue", "Heap maksimum", "Linked list tanpa head"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kompleksitas waktu rata-rata pencarian di unordered_map adalah?",
              pilihan: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Mengapa DFS pada graf bersiklus memerlukan himpunan dikunjungi?",
              pilihan: [
                "Agar hasilnya terurut",
                "Agar tidak mengulang simpul tanpa henti",
                "Agar memori lebih kecil",
                "Agar BFS bisa dipakai sebagai gantinya",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // r12 — Laravel untuk Pemula (Opsional)
  // -------------------------------------------------------------------------
  {
    id: "r12",
    slug: "r12",
    judul: "Laravel untuk Pemula (Opsional)",
    deskripsi:
      "Mulai dari nol dengan Laravel: memahami siklus permintaan, menulis rute dan controller, merender data lewat Blade, lalu mengelola basis data dengan migrasi dan Eloquent sambil menjaga validasi serta keamanan dasar.",
    tags: ["PHP", "Laravel"],
    level: "dasar",
    track: "web-dev",
    provider: "Laravel",
    modul: [
      {
        judul: "Routing, Controller, dan Blade",
        ringkasan:
          "Alur permintaan Laravel, rute, controller, dan cara Blade mengubah data menjadi HTML.",
        durasi_min: 90,
        halaman: [
          {
            judul: "Siklus permintaan Laravel",
            blok: [
              h2("Dari URL ke respons"),
              p(
                "Setiap permintaan masuk lewat satu pintu di public/index.php. Dari sana Laravel memuat konfigurasi, melewati middleware, mencocokkan rute, lalu memanggil kode yang kamu tulis dan mengembalikan respons.",
              ),
              li(
                "public/ adalah satu-satunya direktori yang boleh diakses web; sisanya dijaga di luar akar dokumen.",
                "Router mencocokkan URL ke closure atau method controller.",
                "Middleware menjalankan pemeriksaan sebelum permintaan mencapai controller.",
                "Controller mengembalikan respons, sering berupa view Blade.",
              ),
              h3("Menyiapkan proyek"),
              kode({
                kode: `composer create-project laravel/laravel belajar-laravel
cd belajar-laravel
php artisan serve
# Aplikasi tersedia di http://127.0.0.1:8000`,
                dapatDijalankan: false,
              }),
              p(
                "Blok kode di atas adalah perintah shell dan PHP, bukan C++. Ia hanya dibaca; tombol Jalankan tidak tersedia karena runner platform ini mengompilasi C++.",
              ),
              q(
                "Laravel mengurus banyak hal secara otomatis, tetapi urutan permintaan tetap harus kamu pahami agar tahu di mana menaruh kode.",
              ),
            ],
          },
          {
            judul: "Routing, controller, dan Blade",
            blok: [
              h2("Rute dan controller"),
              p(
                "Rute tinggal di routes/web.php. Untuk aplikasi yang tumbuh, arahkan rute ke method controller agar logika tidak menumpuk di satu berkas.",
              ),
              kode({
                kode: `// routes/web.php
use App\\Http\\Controllers\\KursusController;

Route::get("/kursus", [KursusController::class, "index"]);
Route::get("/kursus/{kursus}", [KursusController::class, "show"]);`,
                dapatDijalankan: false,
              }),
              p(
                "Parameter {kursus} digabungkan dengan tipe pada controller. Bila model Kursus tidak ditemukan, Laravel otomatis mengembalikan 404 tanpa kode tambahan.",
              ),
              kode({
                kode: `// app/Http/Controllers/KursusController.php
namespace App\\Http\\Controllers;

use App\\Models\\Kursus;
use Illuminate\\View\\View;

class KursusController extends Controller
{
    public function index(): View
    {
        return view("kursus.index", ["kursus" => Kursus::latest()->get()]);
    }

    public function show(Kursus $kursus): View
    {
        return view("kursus.show", ["kursus" => $kursus]);
    }
}`,
                dapatDijalankan: false,
              }),
              h3("Blade mengubah data menjadi HTML"),
              kode({
                kode: `{{-- resources/views/kursus/index.blade.php --}}
<h1>Daftar Kursus</h1>
<ul>
  @foreach ($kursus as $item)
    <li><a href="/kursus/{{ $item->id }}">{{ $item->judul }}</a></li>
  @endforeach
</ul>`,
                dapatDijalankan: false,
              }),
              li(
                "{{ $nilai }} meloloskan HTML sehingga aman untuk data pengguna; {!! $nilai !!} tidak meloloskan — pakai hanya untuk HTML yang kamu percaya.",
                "Direktif @if, @foreach, dan @csrf menyederhanakan template.",
                "Gunakan Route::resource untuk membuat rute CRUD standar sekaligus.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Dasar Routing dan Blade",
          deskripsi: "Siklus permintaan, rute, controller, dan sintaks Blade.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Direktori mana yang menjadi satu-satunya pintu masuk web Laravel?",
              pilihan: ["app/", "public/", "routes/", "storage/"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Perintah untuk menjalankan server pengembangan Laravel?",
              pilihan: ["php artisan serve", "npm run dev", "php artisan migrate", "composer serve"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Sintaks Blade mana yang meloloskan HTML keluaran?",
              pilihan: ["{!! $x !!}", "{{ $x }}", "@{{ $x }}", "<?= $x ?>"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Untuk apa Route::resource dipakai?",
              pilihan: [
                "Membuat rute CRUD standar untuk sebuah sumber daya",
                "Mengunggah berkas",
                "Menjalankan migrasi",
                "Menghapus cache aplikasi",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Eloquent, Migrasi, dan Validasi",
        ringkasan:
          "Mendefinisikan skema lewat migrasi, membaca data dengan Eloquent, dan melindungi penyimpanan lewat validasi.",
        durasi_min: 90,
        halaman: [
          {
            judul: "Migrasi dan Eloquent ORM",
            blok: [
              h2("Skema hidup di migrasi"),
              p(
                "Migrasi adalah riwayat perubahan skema basis data dalam bentuk kode, sehingga semua anggota tim mendapat struktur tabel yang sama hanya dengan menjalankan php artisan migrate.",
              ),
              kode({
                kode: `// database/migrations/xxxx_create_kursus_table.php
public function up(): void
{
    Schema::create("kursus", function (Blueprint $table) {
        $table->id();
        $table->string("judul");
        $table->string("slug")->unique();
        $table->text("deskripsi")->nullable();
        $table->timestamps();
    });
}`,
                dapatDijalankan: false,
              }),
              h3("Model dan relasi"),
              kode({
                kode: `// app/Models/Kursus.php
class Kursus extends Model
{
    protected $fillable = ["judul", "slug", "deskripsi"];

    public function modul(): HasMany
    {
        return $this->hasMany(Modul::class);
    }
}

// Eager loading memuat relasi sekali jalan (menghindari masalah N+1).
$kursus = Kursus::with("modul")->latest()->get();`,
                dapatDijalankan: false,
              }),
              li(
                "php artisan make:model Kursus -m membuat model sekaligus berkas migrasinya.",
                "findOrFail mengembalikan 404 otomatis bila data tidak ditemukan.",
                "with() memuat relasi sekaligus untuk menghindari kueri berulang (N+1).",
              ),
              q(
                "N+1 adalah penyebab lambat paling umum di aplikasi Eloquent — panggil with() sejak awal.",
              ),
            ],
          },
          {
            judul: "Validasi dan keamanan dasar",
            blok: [
              h2("Validasi di controller"),
              p(
                "Laravel menyediakan validasi bawaan yang langsung mengalihkan pengguna kembali dengan pesan galat bila aturan tidak terpenuhi. Kamu cukup mendeklarasikan aturannya.",
              ),
              kode({
                kode: `public function store(Request $request): RedirectResponse
{
    $data = $request->validate([
        "judul" => ["required", "string", "min:3", "max:120"],
        "slug" => ["required", "string", "unique:kursus,slug"],
        "deskripsi" => ["nullable", "string"],
    ]);

    Kursus::create($data); // hanya kolom di $fillable yang terisi

    return redirect()->route("kursus.index")->with("status", "Kursus dibuat.");
}`,
                dapatDijalankan: false,
              }),
              li(
                "$fillable membatasi kolom yang boleh diisi massal, sehingga field tak diinginkan tidak bisa disuntikkan lewat formulir.",
                "@csrf menyertakan token pada formulir POST, PUT, PATCH, dan DELETE.",
                "Eloquent memakai binding parameter sehingga kueri aman dari SQL injection.",
                "Setel APP_DEBUG=false di produksi agar detail galat tidak bocor ke pengguna.",
              ),
              h3("Menjaga alur formulir"),
              p(
                "Ketika validasi gagal, Laravel mengembalikan pengguna ke formulir sebelumnya bersama pesan galat per field. Manfaatkan $errors di Blade untuk menampilkannya.",
              ),
              q(
                "Validasi gagal harus mengembalikan pengguna ke formulir dengan pesan yang jelas, bukan halaman putih.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Eloquent, Migrasi, dan Validasi",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Perintah untuk menjalankan migrasi?",
              pilihan: ["php artisan db:seed", "php artisan migrate", "php artisan make:model", "php artisan route:list"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa fungsi properti $fillable pada model Eloquent?",
              pilihan: [
                "Membatasi kolom yang boleh diisi massal",
                "Menentukan nama tabel",
                "Mengaktifkan cache kueri",
                "Mendefinisikan relasi antar tabel",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Cara menghindari masalah N+1 saat memuat relasi?",
              pilihan: [
                "Memakai with() untuk eager loading",
                "Mengulang kueri di dalam loop",
                "Menonaktifkan cache",
                "Memakai findOrFail",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Direktif Blade yang menyisipkan token CSRF pada formulir?",
              pilihan: ["@method", "@csrf", "@include", "@auth"],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },
];
