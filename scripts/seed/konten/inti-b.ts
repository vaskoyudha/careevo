/**
 * Seed konten untuk empat kursus inti Careevo (`crs` kategori A/B pada katalog):
 * backend Node.js, keamanan web OWASP, analisis data Python, dan ML/prompt
 * engineering.
 *
 * Setiap modul membawa dua halaman prosa berformat dan satu kuis yang dinilai
 * server. Blok kode di berkas ini memakai JS/TS/Python/SQL dan **selalu**
 * `dapatDijalankan: false` — runner platform hanya mengompilasi C++, jadi blok
 * ini murni untuk dibaca (lihat README.md pada aturan 5 dan 6).
 */

import { h2, h3, kode, li, p, q, type KursusSeed } from "./tipen";

export const KURSUS_INTI_B: KursusSeed[] = [
  // -------------------------------------------------------------------------
  // 1. Membangun REST API Modern dengan Node.js
  // -------------------------------------------------------------------------
  {
    slug: "membangun-rest-api-modern-dengan-nodejs",
    judul: "Membangun REST API Modern dengan Node.js",
    deskripsi:
      "Panduan komprehensif merancang RESTful API yang aman, modular, dan teruji menggunakan Node.js, Express, validasi Zod, dan token HMAC.",
    tags: ["Node.js", "Express", "REST API", "Backend"],
    level: "menengah",
    track: "web-dev",
    modul: [
      {
        judul: "Fondasi HTTP dan Siklus Hidup Request Express",
        ringkasan:
          "Bagaimana Express memetakan permintaan HTTP ke rantai middleware, dan kenapa urutan serta status code menentukan hasil.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Request, response, dan rantai middleware",
            blok: [
              h2("Tiga lapisan yang harus kamu pahami"),
              p(
                "Node.js menjalankan kode pada satu event loop, jadi setiap permintaan HTTP harus selesai cepat tanpa memblokir. Express hanyalah pembungkus tipis di atas modul http bawaan: ia mengubah permintaan menjadi objek req dan wadah balasan res, lalu menjalankan rantai fungsi yang disebut middleware.",
              ),
              li(
                "req memuat metode, path, header, query, dan body — semuanya berasal dari klien dan tidak boleh dipercaya.",
                "res hanya boleh mengirim balasan sekali; memanggil res.send dua kali memicu error ERR_HTTP_HEADERS_SENT.",
                "next() menyerahkan kendali ke middleware berikutnya; lupa memanggilnya membuat permintaan menggantung sampai timeout.",
              ),
              q(
                "Rute adalah mata rantai terakhir: setelah ia mengirim balasan, rantai middleware berhenti dan tidak lanjut.",
              ),
              h3("Urutan middleware menentukan hasil"),
              kode({
                kode: `const express = require('express');
const app = express();

app.use(express.json());            // parse body JSON
app.use((req, res, next) => {        // logger sederhana
  console.log(req.method, req.path);
  next();                            // WAJIB, kalau tidak permintaan menggantung
});

app.get('/sehat', (req, res) => res.json({ ok: true }));
app.listen(3000);`,
                dapatDijalankan: false,
              }),
              p(
                "Middleware yang didaftarkan dengan app.use sebelum sebuah rute ikut berjalan untuk semua permintaan yang lewat setelahnya, termasuk yang tidak cocok rutenya. Blok di atas adalah JavaScript/Node.js — hanya contoh untuk dibaca; runner platform ini mengompilasi C++, jadi tombol Jalankan sengaja tidak tersedia.",
              ),
            ],
          },
          {
            judul: "Status code yang benar sejak awal",
            blok: [
              h2("Kode status adalah kontrak, bukan hiasan"),
              p(
                "Klien memutuskan tindakan berdasarkan kode status. Mengembalikan 200 untuk kegagalan memaksa klien menebak dari isi body, dan itu sumber bug yang sulit dilacak.",
              ),
              li(
                "2xx — sukses: 200 OK untuk balasan biasa, 201 Created saat membuat resource (sertakan header Location), 204 No Content saat menghapus tanpa body.",
                "4xx — kesalahan klien: 400 input cacat, 401 belum terautentikasi, 403 terautentikasi tapi tidak berhak, 404 tidak ditemukan, 409 konflik, 422 sintaks benar tapi semantik tidak valid.",
                "5xx — kesalahan server: 500 kegagalan tak terduga, 503 layanan sementara tidak siap.",
              ),
              q("401 dan 403 sering tertukar: 401 berarti 'siapa kamu?', 403 berarti 'aku tahu siapa kamu, tapi kamu tidak boleh'."),
              h3("Jangan mengembalikan 200 untuk kegagalan"),
              p(
                "Selain membingungkan klien, kode status yang benar membuat cache, monitoring, dan retry otomatis bekerja sesuai harapan. Tetapkan pemetaan error ke status sejak awal dan pakai konsisten di seluruh API.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Fondasi HTTP dan Express",
          deskripsi: "Memastikan kamu memahami middleware, status code, dan siklus permintaan.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Apa yang terjadi bila middleware lupa memanggil next() dan tidak mengirim balasan?",
              pilihan: [
                "Express otomatis memanggil middleware berikutnya",
                "Permintaan menggantung sampai klien timeout",
                "Express otomatis mengirim 500",
                "Rute berikutnya tetap dijalankan",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kode status mana yang tepat ketika resource baru berhasil dibuat?",
              pilihan: ["200 OK", "201 Created", "204 No Content", "202 Accepted"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa perbedaan 401 dan 403?",
              pilihan: [
                "401 kesalahan server, 403 kesalahan klien",
                "401 berarti belum terautentikasi, 403 berarti terautentikasi tapi tidak berhak",
                "Keduanya identik",
                "401 hanya untuk API, 403 hanya untuk halaman web",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Middleware yang didaftarkan dengan app.use sebelum sebuah rute akan...",
              pilihan: [
                "Hanya berjalan untuk rute tertentu",
                "Berjalan untuk semua permintaan yang lewat setelahnya",
                "Tidak pernah berjalan",
                "Hanya berjalan di mode produksi",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Desain RESTful: Resource, Status Code, dan Idempotensi",
        ringkasan:
          "Memodelkan resource sebagai kata benda, memilih verb HTTP yang benar, dan menjaga operasi tetap idempoten.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Resource adalah kata benda",
            blok: [
              h2("URL menamai benda, verb menamai aksi"),
              p(
                "REST memisahkan dua hal: URL menunjuk resource (kata benda, umumnya jamak), sedangkan metode HTTP menyatakan aksi. Jadi kamu memakai /kursus/12, bukan /ambilKursus?id=12.",
              ),
              li(
                "GET /kursus — daftar resource",
                "POST /kursus — buat resource baru",
                "GET /kursus/12 — ambil satu resource",
                "PUT /kursus/12 — ganti utuh, PATCH /kursus/12 — ubah sebagian",
                "DELETE /kursus/12 — hapus resource",
              ),
              q(
                "Kalau URL-mu memuat kata kerja seperti getKursus atau hapusUser, kamu menaruh aksi di tempat yang salah.",
              ),
              h3("Idempotensi dan keamanan metode"),
              p(
                "GET bersifat aman (safe) dan idempoten: memanggilnya tidak mengubah state. PUT dan DELETE idempoten — memanggilnya berkali-kali menghasilkan keadaan akhir yang sama. POST tidak idempoten: memanggilnya dua kali bisa membuat dua resource berbeda.",
              ),
            ],
          },
          {
            judul: "Pagination, filter, dan versioning",
            blok: [
              h2("Daftar besar tidak boleh dikirim sekaligus"),
              p(
                "Endpoint daftar hampir selalu butuh pagination. Dua gaya umum: offset (limit dan offset) yang mudah dinavigasi, serta cursor (after atau before) yang stabil saat data berubah.",
              ),
              li(
                "limit dan offset sederhana, tetapi baris bisa bergeser bila ada penyisipan atau penghapusan di antara permintaan.",
                "Cursor stabil untuk feed real-time, tetapi tidak bisa melompat langsung ke halaman N.",
                "Selalu tetapkan batas atas limit, misalnya 100, untuk mencegah satu permintaan menarik seluruh tabel.",
              ),
              q("Tanpa batas atas limit, satu permintaan nakal bisa menumbangkan server dan database sekaligus."),
              h3("Versioning API"),
              p(
                "Bila kontrak respons berubah secara tidak kompatibel, sediakan versi baru: prefix path seperti /v1/kursus atau header Accept. Jangan mengubah bentuk respons endpoint lama tanpa menyediakan versi baru bagi klien yang belum siap.",
              ),
              kode({
                kode: `{
  "data": [ { "id": 12, "judul": "Express Lanjutan" } ],
  "meta": { "limit": 20, "offset": 0, "total": 137 }
}`,
                dapatDijalankan: false,
              }),
              p(
                "Contoh di atas adalah bentuk respons JSON untuk endpoint berhalaman — dibaca saja, bukan kode yang dijalankan.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Desain RESTful",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Metode HTTP mana yang TIDAK idempoten?",
              pilihan: ["GET", "PUT", "DELETE", "POST"],
              jawaban_benar: 3,
            },
            {
              pertanyaan: "URL REST yang baik untuk mengambil satu kursus ber-id 12 adalah...",
              pilihan: [
                "/kursus/ambil?id=12",
                "/getKursus/12",
                "/kursus/12",
                "/kursus?aksi=lihat&id=12",
              ],
              jawaban_benar: 2,
            },
            {
              pertanyaan:
                "Mengapa cursor pagination lebih stabil daripada offset saat data sering berubah?",
              pilihan: [
                "Karena memakai memori lebih sedikit",
                "Karena ia menandai posisi berdasar data, bukan nomor baris yang bisa bergeser",
                "Karena tidak memerlukan index database",
                "Karena selalu lebih cepat",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa tujuan versioning API?",
              pilihan: [
                "Mempercantik URL",
                "Mengizinkan perubahan tidak kompatibel tanpa memecah klien lama",
                "Menambah jumlah endpoint",
                "Menyembunyikan data sensitif",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Validasi Input dengan Zod dan Penanganan Error Terpusat",
        ringkasan:
          "Menjadikan skema validasi sebagai satu-satunya gerbang, lalu mengubah error menjadi respons yang konsisten.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Validasi di batas kepercayaan",
            blok: [
              h2("Semua input dari luar adalah asing"),
              p(
                "Body, query, dan parameter URL berasal dari klien. Validasi bukan formalitas; ia mencegah data cacat menyebar ke database dan lapisan lain yang lebih sulit diperbaiki.",
              ),
              li(
                "Validasi bentuk: tipe, panjang, rentang, dan format.",
                "Normalisasi: trim spasi, samakan huruf, koersi tipe (misal string angka menjadi number).",
                "Tolak field tak dikenal dengan skema ketat bila kamu tidak ingin klien menitipkan kolom liar.",
              ),
              q("Validasi di klien adalah kenyamanan; validasi di server adalah keamanan."),
              h3("Zod: satu skema, dipakai berkali-kali"),
              kode({
                kode: `const express = require('express');
const { z } = require('zod');

const skemaKursus = z.object({
  judul: z.string().trim().min(3).max(120),
  durasi: z.coerce.number().int().min(1).max(600),
});

function validasi(skema) {
  return (req, res, next) => {
    const hasil = skema.safeParse(req.body);
    if (!hasil.success) {
      return res.status(422).json({ error: hasil.error.flatten() });
    }
    req.data = hasil.data; // data sudah tervalidasi dan ternormalisasi
    next();
  };
}

app.post('/kursus', validasi(skemaKursus), (req, res) => {
  res.status(201).json(req.data);
});`,
                dapatDijalankan: false,
              }),
              p(
                "Skema yang sama bisa dipakai ulang untuk memvalidasi query atau parameter, sehingga aturan validasi hidup di satu tempat. Blok ini JavaScript/TypeScript, hanya untuk dibaca.",
              ),
            ],
          },
          {
            judul: "Error handler terpusat",
            blok: [
              h2("Satu tempat untuk semua kegagalan"),
              p(
                "Express mengenali middleware error dari tanda tangan empat argumen (err, req, res, next). Daftarkan paling akhir; setiap error yang dilempar atau diteruskan lewat next(err) akan berakhir di sana.",
              ),
              li(
                "Jangan bocorkan stack trace atau detail database ke klien.",
                "Petakan error domain ke status HTTP yang tepat, misalnya konflik menjadi 409.",
                "Catat error asli di server, kirim pesan ringkas ke klien.",
              ),
              q("Error yang tidak ditangani adalah kebocoran informasi sekaligus gangguan keandalan."),
              h3("Express 5 menangkap promise yang ditolak"),
              p(
                "Di Express 4, handler async yang melempar error harus dibungkus try/catch atau wrapper. Express 5 meneruskan promise yang ditolak ke error handler secara otomatis, tetapi memutuskan status dan pesan tetap tanggung jawabmu.",
              ),
              kode({
                kode: `app.use((err, req, res, next) => {
  const status = err.statusCode ?? 500;
  console.error(err); // detail lengkap di server
  res.status(status).json({
    error: err.pesanPublik ?? 'Terjadi kesalahan',
  });
});`,
                dapatDijalankan: false,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Validasi dan Error Handling",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Dari berapa argumen Express mengenali middleware error?",
              pilihan: ["2", "3", "4", "5"],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Fungsi Zod mana yang mengembalikan hasil tanpa melempar exception?",
              pilihan: ["parse", "safeParse", "check", "validate"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa stack trace tidak boleh dikirim ke klien?",
              pilihan: [
                "Karena memperlambat respons",
                "Karena mengungkap detail internal yang membantu penyerang",
                "Karena JSON tidak mendukungnya",
                "Karena peramban akan mengabaikannya",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang dilakukan z.coerce.number() pada input string '42'?",
              pilihan: [
                "Menolaknya karena bukan number",
                "Mengubahnya menjadi angka 42",
                "Mengembalikan NaN",
                "Mengabaikan field itu",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Autentikasi Token, Rate Limit, dan Kesiapan Produksi",
        ringkasan:
          "Menyimpan password dengan aman, menerbitkan token HMAC, membatasi laju permintaan, dan mematikan server dengan rapi.",
        durasi_min: 75,
        halaman: [
          {
            judul: "Password dan token HMAC",
            blok: [
              h2("Password tidak pernah disimpan apa adanya"),
              p(
                "Simpan hash, bukan password. Gunakan fungsi lambat dan ber-salt: bcrypt, scrypt, atau Argon2id. MD5 dan SHA-1 terlalu cepat dan tidak layak untuk password.",
              ),
              li(
                "bcrypt: cost factor menentukan lambatnya; naikkan seiring waktu mengikuti kemampuan perangkat keras.",
                "Argon2id: pemenang Password Hashing Competition, tahan terhadap serangan GPU.",
                "Selalu bandingkan lewat fungsi verifikasi pustaka, jangan menyusun ulang hash sendiri.",
              ),
              q("Hash yang cepat adalah hash yang buruk untuk password."),
              h3("Token HMAC: tanda tangan, bukan rahasia"),
              p(
                "JWT dengan algoritma HS256 ditandatangani memakai HMAC-SHA256 dan kunci rahasia. Isinya (header dan payload) hanya di-encode base64url, bukan dienkripsi — siapa pun yang memegang token bisa membacanya. Karena itu jangan simpan data sensitif di payload.",
              ),
              kode({
                kode: `const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { sub: 'user-42', peran: 'siswa' },
  process.env.JWT_SECRET,           // kunci rahasia di server
  { algorithm: 'HS256', expiresIn: '15m' }
);

// Saat memverifikasi, batasi algoritma agar tidak menerima 'none'
jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });`,
                dapatDijalankan: false,
              }),
            ],
          },
          {
            judul: "Rate limit, health check, dan graceful shutdown",
            blok: [
              h2("Melindungi diri dari penyalahgunaan"),
              p(
                "Rate limiting membatasi jumlah permintaan per jendela waktu. Saat klien melampaui batas, balas 429 Too Many Requests dan sertakan header Retry-After agar klien tahu kapan boleh mencoba lagi.",
              ),
              li(
                "Batasi ketat endpoint login untuk menahan serangan brute force.",
                "Batasi berdasarkan IP dan/atau identitas pengguna, sesuai konteks.",
                "Simpan penghitung di penyimpanan bersama seperti Redis bila aplikasi berjalan di banyak instance.",
              ),
              q("Tanpa batas laju, satu skrip kecil bisa menghabiskan sumber daya seluruh layanan."),
              h3("Health check dan graceful shutdown"),
              p(
                "Sediakan endpoint /sehat yang memeriksa dependensi kritis (database, cache). Saat menerima SIGTERM, berhenti menerima koneksi baru lewat server.close(), selesaikan permintaan yang sedang berjalan, lalu tutup koneksi database.",
              ),
              kode({
                kode: `process.on('SIGTERM', () => {
  server.close(async () => {
    await db.end();   // tutup pool koneksi dengan rapi
    process.exit(0);
  });
});`,
                dapatDijalankan: false,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Autentikasi dan Kesiapan Produksi",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Algoritma mana yang TIDAK layak untuk menyimpan password?",
              pilihan: ["bcrypt", "Argon2id", "scrypt", "MD5"],
              jawaban_benar: 3,
            },
            {
              pertanyaan: "Status HTTP yang tepat saat klien melampaui rate limit adalah...",
              pilihan: ["400", "401", "429", "503"],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Pada JWT yang ditandatangani HS256, bagaimana keadaan isi payload?",
              pilihan: [
                "Terenkripsi sehingga tidak terbaca",
                "Hanya di-encode base64url sehingga bisa dibaca",
                "Dikompresi agar lebih kecil",
                "Disembunyikan oleh server",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa tujuan server.close() saat menerima SIGTERM?",
              pilihan: [
                "Menutup koneksi database seketika",
                "Berhenti menerima koneksi baru sambil menyelesaikan permintaan yang berjalan",
                "Menghapus semua data",
                "Mematikan proses tanpa menyelesaikan apa pun",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2. Web Security & OWASP Top 10 Defense
  // -------------------------------------------------------------------------
  {
    slug: "web-security-owasp-top-10-defense",
    judul: "Web Security & OWASP Top 10 Defense",
    deskripsi:
      "Pelajari mitigasi kerentanan web standar OWASP: SQL Injection, XSS, CSRF, IDOR, serta implementasi audit keamanan dan input sanitization.",
    tags: ["Security", "OWASP", "Auth", "Cryptography"],
    level: "lanjut",
    track: "cyber-sec",
    modul: [
      {
        judul: "OWASP Top 10: Peta Ancaman Web",
        ringkasan:
          "Sepuluh kategori risiko paling berdampak pada aplikasi web dan apa yang sesungguhnya dilindungi tiap kategori.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Daftar OWASP Top 10 edisi 2021",
            blok: [
              h2("Sepuluh kategori, satu bahasa bersama"),
              p(
                "OWASP Top 10 bukan daftar bug tertentu, melainkan kesepakatan industri tentang kategori risiko paling kritis pada aplikasi web. Edisi 2021 menggeser penekanan ke masalah kontrol akses dan integritas rantai pasok perangkat lunak.",
              ),
              li(
                "A01 Broken Access Control",
                "A02 Cryptographic Failures",
                "A03 Injection",
                "A04 Insecure Design",
                "A05 Security Misconfiguration",
                "A06 Vulnerable and Outdated Components",
                "A07 Identification and Authentication Failures",
                "A08 Software and Data Integrity Failures",
                "A09 Security Logging and Monitoring Failures",
                "A10 Server-Side Request Forgery (SSRF)",
              ),
              q("Sebagian besar insiden nyata jatuh ke A01 dan A03 — bukan trik eksotis, melainkan kelalaian dasar."),
              h3("Kenapa urutannya penting"),
              p(
                "Peringkat disusun dari data insiden, bukan selera. Memperbaiki A01 lebih dahulu biasanya menutup lebih banyak celah nyata daripada menambal kasus langka yang jarang terjadi.",
              ),
            ],
          },
          {
            judul: "Dari kategori ke kontrol yang bisa diuji",
            blok: [
              h2("Setiap kategori punya kontrol konkret"),
              p(
                "Kategori hanya berguna bila dipetakan ke pemeriksaan yang bisa diuji dalam kode dan konfigurasi. Berikut pemetaan ringkas yang bisa kamu masukkan ke checklist tinjauan.",
              ),
              li(
                "A01 — periksa kepemilikan objek di server, jangan percaya id dari klien.",
                "A02 — pakai TLS, hash password dengan fungsi lambat, jangan simpan rahasia di repositori.",
                "A03 — gunakan query berparameter dan escape output sesuai konteks.",
                "A05 — matikan mode debug, hapus kredensial default, batasi CORS.",
                "A09 — catat percobaan login gagal dan perubahan hak akses.",
              ),
              q("Kontrol yang tidak pernah diuji sama saja tidak ada."),
              h3("Berpikir seperti penyerang"),
              p(
                "Untuk setiap endpoint, tanyakan tiga hal: data apa yang ia sentuh, siapa yang seharusnya boleh mengaksesnya, dan apa yang terjadi bila identitas atau parameternya diubah. Pertanyaan itu memunculkan sebagian besar kasus A01 dan A03.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: OWASP Top 10",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Kategori mana yang menempati peringkat pertama OWASP Top 10:2021?",
              pilihan: ["Injection", "Broken Access Control", "SSRF", "Security Misconfiguration"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa arti A10 pada edisi 2021?",
              pilihan: [
                "Cross-Site Scripting",
                "Server-Side Request Forgery",
                "Broken Authentication",
                "Insecure Deserialization",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "OWASP Top 10 paling tepat digambarkan sebagai apa?",
              pilihan: [
                "Daftar bug di satu framework",
                "Kategori risiko paling kritis berdasarkan data insiden",
                "Kumpulan patch keamanan",
                "Standar algoritma enkripsi",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kontrol konkret untuk A03 Injection adalah...",
              pilihan: [
                "Menambahkan captcha",
                "Query berparameter dan escape output",
                "Menonaktifkan HTTPS",
                "Memakai CDN",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Injection dan XSS: Menutup Jalur Eksekusi",
        ringkasan:
          "Menghentikan SQL Injection lewat query berparameter dan XSS lewat escape output serta Content-Security-Policy.",
        durasi_min: 60,
        halaman: [
          {
            judul: "SQL Injection dan query berparameter",
            blok: [
              h2("Mengapa penggabungan string berbahaya"),
              p(
                "Bila input pengguna digabung ke dalam string SQL, penyerang bisa mengubah struktur query. Nilai seperti ' OR '1'='1 dapat membuat klausa WHERE selalu benar dan membuka seluruh tabel.",
              ),
              li(
                "Query berparameter mengirim SQL dan data lewat jalur terpisah.",
                "Placeholder seperti ? atau $1 membuat nilai diperlakukan sebagai data, bukan kode.",
                "Jangan pernah membangun query dengan konkatenasi string atau template literal berisi input pengguna.",
              ),
              q("Database tidak bisa membedakan kode dan data bila kamu sendiri yang menggabungkannya."),
              h3("Contoh yang salah dan yang benar"),
              kode({
                kode: `// SALAH - input digabung langsung, rentan SQL Injection
const q1 = "SELECT * FROM pengguna WHERE email = '" + email + "'";

// BENAR - query berparameter, nilai dikirim terpisah dari SQL
const q2 = 'SELECT * FROM pengguna WHERE email = ?';
db.query(q2, [email]);`,
                dapatDijalankan: false,
              }),
              p(
                "Dengan query berparameter, nilai email tidak pernah menjadi bagian dari teks SQL, sehingga tidak bisa mengubah struktur query. Contoh ini JavaScript dan SQL, hanya untuk dibaca.",
              ),
            ],
          },
          {
            judul: "XSS: keluaran yang tidak di-escape",
            blok: [
              h2("Tiga jenis XSS"),
              p(
                "XSS terjadi saat data pengguna dirender sebagai HTML atau JavaScript. Stored XSS tersimpan di server dan menyerang banyak pengguna, Reflected XSS ikut dalam permintaan, sedangkan DOM-based XSS terjadi sepenuhnya di klien.",
              ),
              li(
                "Escape sesuai konteks: HTML, atribut, URL, dan JavaScript butuh aturan berbeda.",
                "Pakai Content-Security-Policy untuk membatasi sumber skrip yang boleh dijalankan.",
                "Tandai cookie sesi sebagai HttpOnly agar tidak bisa dibaca JavaScript.",
              ),
              q("Tidak ada satu fungsi escape yang aman untuk semua konteks — HTML, atribut, dan JavaScript berbeda."),
              h3("CSP sebagai jaring pengaman"),
              p(
                "Header Content-Security-Policy seperti default-src 'self' memblokir skrip dari domain tak dikenal. Ia bukan pengganti escape output, tetapi lapisan kedua yang membatasi kerusakan bila sebuah celah lolos.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Injection dan XSS",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa yang membuat SQL Injection berhasil?",
              pilihan: [
                "Enkripsi yang lemah",
                "Menggabungkan input pengguna ke dalam string query",
                "Tidak memakai HTTPS",
                "Cookie tanpa HttpOnly",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Cara paling andal mencegah SQL Injection adalah...",
              pilihan: [
                "Memperpanjang password",
                "Query berparameter dengan placeholder",
                "Mengganti mesin database",
                "Menyembunyikan pesan error",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "XSS yang tersimpan di server dan muncul ke banyak pengguna disebut...",
              pilihan: ["Reflected XSS", "Stored XSS", "DOM-based XSS", "CSRF"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa fungsi header Content-Security-Policy?",
              pilihan: [
                "Mengenkripsi body respons",
                "Membatasi sumber skrip yang boleh dijalankan peramban",
                "Mempercepat pemuatan halaman",
                "Mengatur kebijakan cache",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "CSRF, IDOR, dan Kontrol Akses",
        ringkasan:
          "Menutup permintaan lintas situs dan memastikan setiap objek diperiksa kepemilikannya di server.",
        durasi_min: 60,
        halaman: [
          {
            judul: "CSRF dan IDOR",
            blok: [
              h2("CSRF: memanfaatkan sesi yang sudah ada"),
              p(
                "CSRF terjadi karena peramban otomatis mengirim cookie ke domain target, walau permintaan dipicu dari situs lain. Bila server hanya mengandalkan cookie sesi untuk operasi mutasi, penyerang bisa memaksa tindakan atas nama pengguna.",
              ),
              li(
                "Token anti-CSRF per sesi atau per formulir, diverifikasi di server.",
                "Cookie SameSite=Lax atau Strict untuk membatasi pengiriman lintas situs.",
                "Untuk API stateless yang memakai token di header Authorization, risiko CSRF menyusut.",
              ),
              q("SameSite=Lax adalah perlindungan bawaan yang murah; jangan matikan tanpa alasan kuat."),
              h3("IDOR: id yang bisa ditebak"),
              p(
                "Insecure Direct Object Reference terjadi saat server menerima id dari klien tanpa memeriksa kepemilikan. Mengubah /invoice/1001 menjadi /invoice/1002 tidak boleh membuka data milik orang lain.",
              ),
              kode({
                kode: `// SALAH - hanya memakai id dari URL
const inv = await db.invoice.findById(req.params.id);

// BENAR - kepemilikan diperiksa terhadap identitas terautentikasi
const inv = await db.invoice.findOne({
  id: req.params.id,
  penggunaId: req.user.sub,
});
if (!inv) return res.status(404).json({ error: 'Tidak ditemukan' });`,
                dapatDijalankan: false,
              }),
            ],
          },
          {
            judul: "Kontrol akses yang tidak bisa dilewati",
            blok: [
              h2("Deny by default"),
              p(
                "Mulailah dari menolak, lalu beri izin secara eksplisit. Setiap endpoint baru seharusnya tertutup sampai hak aksesnya dinyatakan dengan jelas.",
              ),
              li(
                "Pusatkan pemeriksaan otorisasi; jangan menyebarkannya di tiap handler dengan cara berbeda.",
                "Bedakan autentikasi (siapa kamu) dari otorisasi (apa yang boleh kamu lakukan).",
                "Uji dengan akun berperan berbeda; jangan hanya menguji sebagai admin.",
              ),
              q("Autentikasi tanpa otorisasi hanya memastikan siapa penyerangnya, bukan mencegahnya."),
              h3("Balas 404 bila perlu"),
              p(
                "Saat pengguna tidak berhak mengetahui keberadaan sebuah objek, mengembalikan 404 alih-alih 403 mencegah enumerasi id. Pilih sesuai konteks, tetapi terapkan secara konsisten di seluruh API.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: CSRF, IDOR, dan Kontrol Akses",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa yang dimanfaatkan serangan CSRF?",
              pilihan: [
                "Kata sandi yang lemah",
                "Cookie sesi yang dikirim otomatis oleh peramban",
                "Koneksi tanpa TLS",
                "Query tanpa index",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "IDOR terjadi ketika...",
              pilihan: [
                "Server memeriksa kepemilikan objek",
                "Server memakai id dari klien tanpa memeriksa kepemilikan",
                "Server memakai HTTPS",
                "Server memakai rate limit",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Prinsip 'deny by default' berarti...",
              pilihan: [
                "Semua akses diizinkan kecuali dilarang",
                "Semua akses ditolak kecuali diizinkan secara eksplisit",
                "Hanya admin yang boleh masuk",
                "Cookie selalu ditolak",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Nilai SameSite=Lax pada cookie membantu mencegah serangan...",
              pilihan: ["XSS", "CSRF", "SQL Injection", "Clickjacking pada iframe"],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Kriptografi Terapan dan Manajemen Sesi",
        ringkasan:
          "Memilih fungsi hash untuk tujuan yang tepat, mengelola rahasia, dan menghindari jebakan umum pada token serta TLS.",
        durasi_min: 75,
        halaman: [
          {
            judul: "Hash, salt, dan rahasia",
            blok: [
              h2("Gunakan primitif untuk tujuannya"),
              p(
                "Kriptografi punya alat berbeda untuk tujuan berbeda. Memakai alat yang salah menciptakan rasa aman tanpa perlindungan nyata.",
              ),
              li(
                "Hash password: bcrypt, scrypt, atau Argon2id (lambat dan ber-salt).",
                "Integritas pesan: HMAC-SHA256.",
                "Enkripsi simetris: AES-256-GCM (authenticated encryption).",
                "Tanda tangan kunci publik: RSA atau ECDSA.",
              ),
              q("SHA-256 polos bagus untuk checksum, tetapi salah untuk password karena terlalu cepat dihitung."),
              h3("Manajemen rahasia"),
              p(
                "Kunci rahasia tidak boleh berada di repositori. Simpan di variabel lingkungan atau secret manager, rotasi secara berkala, dan batasi siapa yang boleh membacanya.",
              ),
              kode({
                kode: `const crypto = require('crypto');

// Bandingkan token dengan waktu konstan untuk mencegah timing attack
const a = Buffer.from(tokenDariKlien);
const b = Buffer.from(tokenTersimpan);
const sama = a.length === b.length && crypto.timingSafeEqual(a, b);`,
                dapatDijalankan: false,
              }),
            ],
          },
          {
            judul: "Jebakan token dan TLS",
            blok: [
              h2("Jangan biarkan JWT melindungi dirinya sendiri"),
              p(
                "JWT membawa tanda tangan, tetapi implementasi yang ceroboh bisa menerima algoritma 'none' atau algoritma di luar dugaan. Selalu batasi algoritma saat verifikasi dan validasi klaim exp serta aud.",
              ),
              li(
                "Tolak alg 'none' dan batasi ke algoritma yang benar-benar kamu terbitkan.",
                "Periksa klaim exp, nbf, iss, dan aud.",
                "Pakai masa berlaku pendek dengan refresh token terpisah.",
                "Jangan menyimpan data sensitif di payload yang bisa dibaca siapa pun.",
              ),
              q("Token yang tidak pernah kedaluwarsa adalah kredensial permanen bila bocor."),
              h3("TLS dan HSTS"),
              p(
                "Paksa HTTPS di seluruh situs dan aktifkan HSTS dengan max-age yang cukup panjang. Tanpa TLS, semua token, cookie, dan data pengguna bisa disadap di jaringan.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Kriptografi dan Sesi",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Fungsi hash mana yang tepat untuk menyimpan password?",
              pilihan: ["MD5", "SHA-1", "Argon2id", "CRC32"],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Apa tujuan crypto.timingSafeEqual?",
              pilihan: [
                "Mempercepat hashing",
                "Membandingkan nilai dalam waktu konstan untuk mencegah timing attack",
                "Mengenkripsi data",
                "Membuat token acak",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Klaim JWT mana yang menyatakan waktu kedaluwarsa?",
              pilihan: ["nbf", "exp", "aud", "iat"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa fungsi header HSTS?",
              pilihan: [
                "Mengenkripsi cookie",
                "Memaksa peramban selalu memakai HTTPS ke domain tersebut",
                "Menyembunyikan versi server",
                "Membatasi laju permintaan",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 3. Dasar Analisis Data & Visualisasi Python
  // -------------------------------------------------------------------------
  {
    slug: "dasar-analisis-data-visualisasi-python",
    judul: "Dasar Analisis Data & Visualisasi Python",
    deskripsi:
      "Kuasai manipulasi dataset dengan Pandas, agregasi numerik dengan NumPy, serta visualisasi data interaktif menggunakan Matplotlib dan Seaborn.",
    tags: ["Python", "Pandas", "Matplotlib", "Data Analytics"],
    level: "dasar",
    track: "data",
    modul: [
      {
        judul: "Menyiapkan Lingkungan dan Dasar NumPy",
        ringkasan:
          "Membuat virtual environment, memasang paket, dan memahami ndarray serta vectorization sebagai fondasi analisis.",
        durasi_min: 45,
        halaman: [
          {
            judul: "Lingkungan Python yang bisa diulang",
            blok: [
              h2("Virtual environment per proyek"),
              p(
                "Jangan memasang paket secara global. Buat virtual environment agar versi paket setiap proyek terisolasi dan hasilnya bisa direproduksi.",
              ),
              li(
                "python -m venv .venv",
                "source .venv/bin/activate (Linux/macOS) atau .venv\\Scripts\\activate (Windows)",
                "pip install pandas numpy matplotlib seaborn",
                "pip freeze > requirements.txt untuk merekam versi paket",
              ),
              q("Tanpa pencatatan versi, hasil analisis hari ini bisa berbeda bulan depan tanpa kamu sadari."),
              h3("Cek cepat setelah aktivasi"),
              p(
                "Setelah aktivasi, jalankan python -c \"import pandas, numpy; print(pandas.__version__)\" untuk memastikan paket terpasang di environment yang benar, bukan di Python global.",
              ),
            ],
          },
          {
            judul: "NumPy: ndarray dan vectorization",
            blok: [
              h2("Array yang jauh lebih cepat dari list"),
              p(
                "NumPy menyimpan angka dalam blok memori berurutan dengan satu tipe data (dtype). Operasi dijalankan di kode C, bukan loop Python, sehingga jauh lebih cepat untuk data berukuran besar.",
              ),
              li(
                "np.array([1, 2, 3]) membuat ndarray.",
                "Aritmetika berlaku elemen per elemen tanpa loop eksplisit.",
                "Broadcasting memungkinkan operasi antar bentuk berbeda, misalnya array dikali skalar.",
                "dtype seperti int64 atau float64 menentukan presisi dan pemakaian memori.",
              ),
              q("Loop Python untuk aritmetika array hampir selalu bisa diganti satu operasi NumPy."),
              kode({
                kode: `import numpy as np

nilai = np.array([70, 85, 90, 60], dtype='float64')
print(nilai.mean())         # 76.25
print(nilai * 1.1)          # tiap elemen dikali 1.1 (broadcasting skalar)
print(nilai[nilai >= 80])   # boolean indexing -> [85. 90.]`,
                dapatDijalankan: false,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Lingkungan Python dan NumPy",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Mengapa ndarray NumPy cepat untuk aritmetika?",
              pilihan: [
                "Karena ditulis dalam Python murni",
                "Karena data berurutan dan operasi dijalankan di kode C",
                "Karena memakai GPU",
                "Karena tidak menyimpan tipe data",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Perintah untuk membuat virtual environment adalah...",
              pilihan: ["pip install venv", "python -m venv .venv", "python create env", "npm init"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa hasil dari np.array([1, 2, 3]) * 2?",
              pilihan: ["Error", "[2, 4, 6]", "[1, 2, 3, 2, 4, 6]", "6"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "dtype pada ndarray menentukan...",
              pilihan: [
                "Jumlah dimensi array",
                "Tipe data tiap elemen",
                "Nama variabel",
                "Warna plot",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Pandas: DataFrame dan Pembersihan Data",
        ringkasan:
          "Membaca dataset, memeriksa struktur, dan menangani nilai hilang serta tipe data yang salah.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Membaca dan memeriksa data",
            blok: [
              h2("DataFrame adalah tabel berlabel"),
              p(
                "DataFrame memiliki baris dan kolom berlabel; Series adalah satu kolom. Sebelum analisis apa pun, periksa bentuk dan tipe data agar kamu tahu apa yang sebenarnya kamu pegang.",
              ),
              li(
                "pd.read_csv('penjualan.csv') membaca berkas CSV menjadi DataFrame.",
                "df.shape, df.info(), dan df.head() memberi gambaran cepat.",
                "df.dtypes menunjukkan tipe tiap kolom.",
                "df.describe() merangkum statistik kolom numerik.",
              ),
              q("Membaca data tanpa memeriksanya adalah cara tercepat membuat kesimpulan yang salah."),
              kode({
                kode: `import pandas as pd

df = pd.read_csv('penjualan.csv')
print(df.shape)             # (jumlah baris, jumlah kolom)
print(df.dtypes)
print(df.head(3))
print(df['kota'].value_counts())`,
                dapatDijalankan: false,
              }),
            ],
          },
          {
            judul: "Membersihkan nilai hilang dan tipe",
            blok: [
              h2("Nilai hilang punya banyak wajah"),
              p(
                "Selain NaN, data kotor sering menyamar sebagai string kosong, tanda '-', atau angka yang mustahil. Deteksi dulu, lalu putuskan: buang, isi, atau tandai.",
              ),
              li(
                "df.isna().sum() menghitung nilai hilang per kolom.",
                "df.dropna(subset=['harga']) membuang baris yang kolom harganya kosong.",
                "df['harga'].fillna(df['harga'].median()) mengisi nilai hilang dengan median.",
                "pd.to_datetime(df['tanggal'], errors='coerce') memperbaiki kolom tanggal yang bertipe teks.",
              ),
              q("Perhatikan errors='coerce': nilai yang gagal dikonversi menjadi NaT, bukan melempar error — periksa berapa banyak yang rusak."),
              kode({
                kode: `df['tanggal'] = pd.to_datetime(df['tanggal'], errors='coerce')
df['harga'] = df['harga'].astype('float64')
df = df.dropna(subset=['tanggal'])
df['kota'] = df['kota'].str.strip().str.title()
print(df.isna().sum())`,
                dapatDijalankan: false,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: DataFrame dan Pembersihan Data",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa yang dilakukan df.isna().sum()?",
              pilihan: [
                "Menghapus baris kosong",
                "Menghitung nilai hilang per kolom",
                "Mengisi nilai hilang",
                "Mengurutkan data",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Fungsi untuk mengubah kolom string tanggal menjadi datetime adalah...",
              pilihan: ["pd.to_numeric", "pd.to_datetime", "df.astype('date')", "pd.read_date"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa efek errors='coerce' pada pd.to_datetime?",
              pilihan: [
                "Melempar exception",
                "Mengganti nilai yang gagal dikonversi menjadi NaT",
                "Mengabaikan seluruh kolom",
                "Mengurutkan tanggal",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "df.shape mengembalikan apa?",
              pilihan: [
                "Daftar nama kolom",
                "Tuple (jumlah baris, jumlah kolom)",
                "Tipe data kolom",
                "Rata-rata kolom",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Agregasi dan Analisis Eksploratif",
        ringkasan:
          "Mengelompokkan, menggabungkan, dan meringkas data untuk menjawab pertanyaan bisnis dengan angka.",
        durasi_min: 60,
        halaman: [
          {
            judul: "groupby dan agregasi",
            blok: [
              h2("Pecah, terapkan, gabungkan"),
              p(
                "groupby mengikuti pola split-apply-combine: data dipecah per grup, fungsi diterapkan pada tiap grup, lalu hasilnya digabung. Ini inti dari hampir semua ringkasan bisnis.",
              ),
              li(
                "df.groupby('kota')['penjualan'].sum() menjumlahkan penjualan per kota.",
                "df.groupby('kota').agg({'penjualan': ['sum','mean','count']}) meringkas beberapa statistik sekaligus.",
                "sort_values(ascending=False) mengurutkan hasil agar grup teratas terlihat.",
                "reset_index() mengubah hasil groupby kembali menjadi DataFrame biasa.",
              ),
              q("Agregasi yang tepat menjawab pertanyaan lebih cepat daripada menelusuri tabel raksasa."),
              kode({
                kode: `ringkas = (
    df.groupby('kota')
      .agg(total=('penjualan', 'sum'),
           rata=('penjualan', 'mean'),
           jumlah=('penjualan', 'count'))
      .sort_values('total', ascending=False)
)
print(ringkas.head())`,
                dapatDijalankan: false,
              }),
            ],
          },
          {
            judul: "Menggabungkan tabel dan pivot",
            blok: [
              h2("merge menghubungkan tabel lewat kunci"),
              p(
                "Data nyata tersebar di beberapa tabel. merge menggabungkan berdasarkan kolom kunci, mirip JOIN di SQL. Ketahui jenis join yang kamu pakai agar baris tidak diam-diam terbuang.",
              ),
              li(
                "how='inner' hanya menyisakan kunci yang ada di kedua tabel.",
                "how='left' mempertahankan semua baris tabel kiri.",
                "validate='many_to_one' menangkap asumsi kunci yang salah sebelum merusak hasil.",
                "pivot_table meringkas nilai per baris dan kolom, cocok untuk matriks.",
              ),
              q("Merge dengan asumsi kunci yang salah menghasilkan duplikasi baris yang mengubah total tanpa peringatan."),
              kode({
                kode: `pelanggan = pd.read_csv('pelanggan.csv')
gabung = df.merge(pelanggan, on='pelanggan_id', how='left', validate='many_to_one')

matriks = gabung.pivot_table(
    index='kota', columns='kategori',
    values='penjualan', aggfunc='sum', fill_value=0,
)`,
                dapatDijalankan: false,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Agregasi dan Eksplorasi",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Pola kerja groupby di Pandas adalah...",
              pilihan: [
                "join-merge-sort",
                "split-apply-combine",
                "read-clean-plot",
                "filter-map-reduce",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "how='left' pada merge akan...",
              pilihan: [
                "Membuang baris tanpa pasangan di tabel kanan",
                "Mempertahankan semua baris tabel kiri",
                "Hanya menyisakan kunci yang cocok",
                "Menggandakan semua baris",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "validate='many_to_one' pada merge berguna untuk...",
              pilihan: [
                "Mempercepat merge",
                "Memastikan asumsi kardinalitas kunci benar",
                "Menghapus duplikat secara otomatis",
                "Mengurutkan hasil",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "pivot_table berguna untuk...",
              pilihan: [
                "Menghapus nilai hilang",
                "Meringkas nilai berdasarkan baris dan kolom",
                "Membuat virtual environment",
                "Melatih model machine learning",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Visualisasi dengan Matplotlib dan Seaborn",
        ringkasan:
          "Memilih grafik yang jujur, memakai API objek Matplotlib, dan memanfaatkan Seaborn untuk data statistik.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Grafik yang tepat untuk pertanyaan yang tepat",
            blok: [
              h2("Bentuk data menentukan bentuk grafik"),
              p(
                "Grafik yang salah menyesatkan lebih cepat daripada tabel. Pilih jenis grafik berdasarkan pertanyaan: distribusi, perbandingan, hubungan, atau tren waktu.",
              ),
              li(
                "Histogram: distribusi satu variabel numerik.",
                "Boxplot: sebaran dan pencilan antar kelompok.",
                "Scatter: hubungan dua variabel numerik.",
                "Line: tren sepanjang waktu.",
              ),
              q("Selalu beri label sumbu beserta satuannya; grafik tanpa label adalah teka-teki bagi pembaca."),
              h3("API objek: fig dan ax"),
              p(
                "Matplotlib modern memakai fig, ax = plt.subplots(). Kamu bekerja pada objek ax, bukan state global plt, sehingga lebih mudah mengatur banyak subplot dan menyimpan hasil.",
              ),
              kode({
                kode: `import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(8, 5))
ax.hist(df['penjualan'], bins=30, color='steelblue')
ax.set_title('Distribusi Penjualan')
ax.set_xlabel('Penjualan (ribu rupiah)')
ax.set_ylabel('Frekuensi')
fig.savefig('distribusi.png', dpi=150, bbox_inches='tight')`,
                dapatDijalankan: false,
              }),
            ],
          },
          {
            judul: "Seaborn untuk statistik yang cepat",
            blok: [
              h2("Ringkasan statistik dalam satu panggilan"),
              p(
                "Seaborn dibangun di atas Matplotlib dan dirancang untuk bekerja langsung dengan DataFrame. Ia menambahkan agregasi statistik otomatis dan tema yang lebih rapi.",
              ),
              li(
                "sns.histplot(data=df, x='penjualan', hue='kota') memisahkan distribusi per kelompok.",
                "sns.boxplot(data=df, x='kota', y='penjualan') membandingkan sebaran antar kota.",
                "sns.heatmap(df.corr(numeric_only=True), annot=True) menampilkan matriks korelasi.",
                "sns.pairplot(df[['a','b','c']]) menjelajahi hubungan berpasangan antar variabel.",
              ),
              q("Seaborn menggambar grafiknya, tetapi Matplotlib tetap yang menata dan menyimpan hasil akhirnya."),
              kode({
                kode: `import seaborn as sns
import matplotlib.pyplot as plt

sns.set_theme(style='whitegrid')
sns.boxplot(data=df, x='kota', y='penjualan')
plt.title('Sebaran Penjualan per Kota')
plt.tight_layout()
plt.savefig('boxplot.png', dpi=150)`,
                dapatDijalankan: false,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Visualisasi Data",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Grafik mana paling tepat untuk melihat distribusi satu variabel numerik?",
              pilihan: ["Line chart", "Histogram", "Scatter plot", "Pie chart"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa keunggulan pola fig, ax = plt.subplots()?",
              pilihan: [
                "Lebih cepat dieksekusi",
                "Memberi kontrol eksplisit atas objek grafik dan subplot",
                "Tidak memerlukan data",
                "Menghapus kebutuhan label sumbu",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Seaborn dibangun di atas pustaka apa?",
              pilihan: ["Plotly", "Matplotlib", "Bokeh", "Pillow"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Fungsi untuk menyimpan gambar Matplotlib ke berkas adalah...",
              pilihan: ["plt.show()", "fig.savefig('nama.png')", "plt.export()", "df.to_image()"],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 4. Machine Learning & AI Prompt Engineering
  // -------------------------------------------------------------------------
  {
    slug: "machine-learning-ai-prompt-engineering",
    judul: "Machine Learning & AI Prompt Engineering",
    deskripsi:
      "Eksplorasi teknik LLM prompting terstruktur, evaluasi output model, pipeline RAG sederhana, dan integrasi API AI modern.",
    tags: ["AI", "Machine Learning", "Prompting", "LLM"],
    level: "menengah",
    track: "data",
    modul: [
      {
        judul: "Fondasi Machine Learning dan Cara Kerja LLM",
        ringkasan:
          "Membedakan jenis pembelajaran, memahami alur pelatihan dan pengujian, serta mengapa LLM bekerja dengan token.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Jenis pembelajaran dan alur dasar",
            blok: [
              h2("Supervised, unsupervised, dan reinforcement"),
              p(
                "Machine learning melatih model menemukan pola dari data, bukan aturan yang ditulis manual. Jenis pembelajaran ditentukan oleh ada tidaknya label pada data.",
              ),
              li(
                "Supervised: data berlabel; klasifikasi memprediksi kategori, regresi memprediksi angka.",
                "Unsupervised: tanpa label; klastering dan reduksi dimensi.",
                "Reinforcement: agen belajar dari hadiah dan hukuman lewat interaksi dengan lingkungan.",
              ),
              q("Model yang menghafal data latih tetapi gagal pada data baru disebut overfitting — musuh utama praktisi."),
              h3("Memisahkan data latih dan uji"),
              p(
                "Selalu sisihkan sebagian data untuk pengujian yang tidak pernah dilihat model saat pelatihan. Performa pada data latih mengukur kemampuan menghafal; performa pada data uji mengukur generalisasi.",
              ),
            ],
          },
          {
            judul: "Token: unit kerja LLM",
            blok: [
              h2("Model membaca token, bukan kata"),
              p(
                "LLM memecah teks menjadi token — potongan kata atau karakter. Bahasa Indonesia sering terpecah menjadi lebih banyak token daripada bahasa Inggris untuk makna yang sama, sehingga biaya per kata bisa lebih tinggi.",
              ),
              li(
                "Tokenisasi umumnya memakai algoritma seperti BPE (Byte Pair Encoding).",
                "Context window adalah batas total token masukan dan keluaran yang bisa diproses sekaligus.",
                "Perkiraan kasar: 1 token sekitar 3–4 karakter untuk bahasa Inggris.",
                "Bahasa Indonesia cenderung memakai lebih banyak token karena kosakata latihnya lebih sedikit.",
              ),
              q("Bila percakapan melebihi context window, bagian tertua harus diringkas atau dibuang sebelum dikirim ulang."),
              h3("Determinisme dan temperature"),
              p(
                "Output LLM bersifat probabilistik. Temperature mengatur keacakan: nilai rendah menghasilkan keluaran lebih konsisten, nilai tinggi lebih beragam. Untuk tugas yang butuh jawaban stabil, gunakan temperature rendah.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Fondasi ML dan LLM",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Masalah klasifikasi memprediksi apa?",
              pilihan: ["Angka kontinu", "Kategori atau kelas", "Klaster", "Embedding"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa data uji harus terpisah dari data latih?",
              pilihan: [
                "Agar pelatihan lebih cepat",
                "Untuk mengukur generalisasi pada data yang belum pernah dilihat model",
                "Untuk mengurangi jumlah token",
                "Agar model lebih besar",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa itu context window pada LLM?",
              pilihan: [
                "Ukuran berkas model",
                "Batas total token masukan dan keluaran yang bisa diproses",
                "Jumlah GPU yang dipakai",
                "Kecepatan inferensi",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Menurunkan temperature umumnya membuat output menjadi...",
              pilihan: [
                "Lebih acak",
                "Lebih konsisten dan deterministik",
                "Selalu lebih panjang",
                "Tidak berubah sama sekali",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Prompt Engineering Terstruktur",
        ringkasan:
          "Merancang prompt dengan peran, contoh, dan instruksi bertahap agar output dapat diandalkan dan mudah diurai.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Anatomi prompt yang baik",
            blok: [
              h2("Sistem, tugas, konteks, format"),
              p(
                "Prompt yang dapat diandalkan memisahkan beberapa bagian: peran (system), tugas, konteks yang relevan, dan format keluaran yang diharapkan.",
              ),
              li(
                "System prompt menetapkan peran dan batasan yang berlaku sepanjang percakapan.",
                "Instruksi harus spesifik: sebutkan format, panjang, dan audiens.",
                "Sertakan konteks yang relevan saja; konteks berlebihan menambah biaya dan kebisingan.",
                "Minta format terstruktur seperti JSON bila hasilnya akan diproses program.",
              ),
              q("Prompt yang kabur menghasilkan keluaran yang kabur; kejelasan mengalahkan kepintaran."),
              h3("Contoh: zero-shot dan few-shot"),
              p(
                "Zero-shot memberi instruksi tanpa contoh. Few-shot menyertakan beberapa contoh pasangan masukan-keluaran sehingga model meniru pola dan format yang kamu inginkan.",
              ),
              kode({
                kode: `System: Kamu asisten yang mengubah deskripsi kursus menjadi JSON.
Aturan: hanya keluarkan JSON valid dengan kunci "judul" dan "tags".

User: Buat entri untuk kursus "Dasar SQL untuk Analis Data".

Assistant: {"judul": "Dasar SQL untuk Analis Data", "tags": ["SQL", "Data"]}`,
                dapatDijalankan: false,
              }),
            ],
          },
          {
            judul: "Chain-of-thought dan iterasi",
            blok: [
              h2("Minta penalaran bila tugasnya berlapis"),
              p(
                "Untuk tugas bertahap seperti matematika, perencanaan, atau debug, meminta model menuliskan langkah penalaran meningkatkan akurasi. Pisahkan penalaran itu dari keluaran akhir bila kamu hanya ingin jawabannya.",
              ),
              li(
                "Zero-shot chain-of-thought: tambahkan instruksi 'berpikirlah langkah demi langkah'.",
                "Pisahkan proses berpikir dari jawaban akhir agar hasil mudah diurai program.",
                "Uji prompt dengan beberapa masukan sulit, bukan hanya contoh yang mudah.",
                "Simpan versi prompt agar perubahan bisa dibandingkan dari waktu ke waktu.",
              ),
              q("Prompt adalah artefak yang diuji dan diberi versi, bukan teks sekali pakai."),
              h3("Batasan yang harus kamu sadari"),
              p(
                "Model dapat berhalusinasi dengan sangat yakin. Untuk fakta yang harus benar, minta model hanya merujuk konteks yang kamu berikan dan mengaku tidak tahu bila jawabannya tidak ada di sana.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Prompt Engineering",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa peran system prompt?",
              pilihan: [
                "Menghapus konteks percakapan",
                "Menetapkan peran dan batasan yang berlaku sepanjang percakapan",
                "Mempercepat tokenisasi",
                "Menyimpan data pengguna",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Teknik few-shot berarti...",
              pilihan: [
                "Memberi instruksi tanpa contoh",
                "Menyertakan beberapa contoh pasangan masukan-keluaran",
                "Melatih ulang model dari nol",
                "Menghapus system prompt",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kapan chain-of-thought paling membantu?",
              pilihan: [
                "Untuk sapaan singkat",
                "Untuk tugas bertahap seperti matematika atau perencanaan",
                "Saat menginginkan jawaban acak",
                "Saat konteks benar-benar kosong",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Cara terbaik menekan halusinasi pada tugas faktual adalah...",
              pilihan: [
                "Menaikkan temperature",
                "Meminta model menjawab hanya dari konteks yang diberikan dan mengaku bila tidak tahu",
                "Menghapus system prompt",
                "Memperpendek pertanyaan",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Evaluasi Output dan Pipeline RAG",
        ringkasan:
          "Mengukur kualitas keluaran secara terukur dan membangun retrieval-augmented generation dengan embedding.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Mengukur keluaran, bukan menebak",
            blok: [
              h2("Evaluasi harus punya kriteria"),
              p(
                "'Terlihat bagus' bukan metrik. Tentukan kriteria yang bisa diperiksa: kebenaran faktual, kelengkapan, format, dan kesesuaian gaya. Uji dengan kumpulan kasus yang tetap.",
              ),
              li(
                "Buat set uji berisi masukan beserta keluaran yang diharapkan.",
                "Ukur format valid, misalnya apakah JSON bisa di-parse, secara otomatis.",
                "Nilai kebenaran dengan pemeriksa manusia atau model penilai (LLM-as-judge).",
                "Jalankan ulang evaluasi setiap kali prompt atau model berubah.",
              ),
              q("Tanpa set uji tetap, kamu tidak tahu apakah perubahan prompt memperbaiki atau justru merusak."),
              h3("Bias model penilai"),
              p(
                "Model penilai bisa memihak jawaban yang lebih panjang atau bergaya tertentu. Kalibrasi dengan contoh yang sudah dinilai manusia, dan sadari batasnya sebelum memercayai skor sepenuhnya.",
              ),
            ],
          },
          {
            judul: "RAG: menyambungkan model ke dokumenmu",
            blok: [
              h2("Mengambil lalu menjawab"),
              p(
                "Retrieval-Augmented Generation memberi model konteks yang relevan dari basis pengetahuanmu. Alurnya: potong dokumen menjadi chunk, ubah menjadi embedding, cari chunk paling mirip, lalu sertakan ke dalam prompt.",
              ),
              li(
                "Chunking: ukuran potongan memengaruhi mutu pencarian.",
                "Embedding mengubah teks menjadi vektor yang merepresentasikan makna.",
                "Cosine similarity mengukur kedekatan arah antar vektor.",
                "Ambil top-k chunk, lalu minta model menjawab hanya berdasarkan itu.",
              ),
              q("RAG mengurangi halusinasi dengan memberi sumber, tetapi mutunya tidak pernah melebihi kualitas retrieval-nya."),
              kode({
                kode: `import numpy as np

def cosine_similarity(a, b):
    a, b = np.asarray(a), np.asarray(b)
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))

skor = cosine_similarity(embedding_pertanyaan, embedding_chunk)`,
                dapatDijalankan: false,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Evaluasi dan RAG",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Mengapa set uji tetap penting dalam evaluasi prompt?",
              pilihan: [
                "Agar model berjalan lebih cepat",
                "Agar perubahan prompt bisa dibandingkan secara konsisten",
                "Agar biaya menjadi nol",
                "Agar tidak memerlukan token",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Urutan alur RAG yang benar adalah...",
              pilihan: [
                "Jawab dulu, lalu cari sumber",
                "Potong chunk, buat embedding, cari chunk mirip, sertakan ke prompt",
                "Latih ulang model pada setiap permintaan",
                "Enkripsi dokumen lalu jawab",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Cosine similarity mengukur...",
              pilihan: [
                "Panjang vektor",
                "Kedekatan arah antara dua vektor",
                "Jumlah token",
                "Kecepatan inferensi",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa fungsi chunking pada pipeline RAG?",
              pilihan: [
                "Mengenkripsi dokumen",
                "Memecah dokumen menjadi potongan agar bisa dicari dan diambil",
                "Mempercepat GPU",
                "Menghapus data duplikat",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Integrasi API AI dan Praktik Produksi",
        ringkasan:
          "Memanggil API LLM, mengendalikan biaya dan latensi, serta menambahkan pengaman sebelum dirilis ke pengguna.",
        durasi_min: 75,
        halaman: [
          {
            judul: "Memanggil API dengan pesan berperan",
            blok: [
              h2("Struktur pesan"),
              p(
                "API LLM modern umumnya memakai daftar pesan berperan: system, user, dan assistant. Riwayat percakapan dikirim ulang agar model memiliki konteks.",
              ),
              li(
                "system: peran dan aturan tetap.",
                "user: masukan pengguna.",
                "assistant: balasan model sebelumnya, untuk menjaga konteks lanjutan.",
                "Parameter penting: pilihan model, temperature, dan max_tokens.",
              ),
              q("Setiap panggilan mengirim ulang konteks; makin panjang riwayat, makin mahal dan makin lambat."),
              kode({
                kode: `const respon = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  temperature: 0.2,
  max_tokens: 400,
  messages: [
    { role: 'system', content: 'Jawab singkat dalam bahasa Indonesia.' },
    { role: 'user', content: 'Ringkas paragraf berikut: ...' },
  ],
});
console.log(respon.choices[0].message.content);`,
                dapatDijalankan: false,
              }),
            ],
          },
          {
            judul: "Biaya, latensi, dan pengaman",
            blok: [
              h2("Kendalikan tiga hal sekaligus"),
              p(
                "Di produksi, kualitas bukan satu-satunya pertimbangan. Kamu mengelola biaya (token), latensi (waktu tunggu), dan keandalan (kegagalan API).",
              ),
              li(
                "Batasi max_tokens dan panjang riwayat untuk menekan biaya.",
                "Streaming menurunkan latensi yang dirasakan pengguna karena keluaran muncul bertahap.",
                "Tangani kegagalan: timeout, retry dengan backoff, dan fallback ke model lain.",
                "Simpan cache untuk prompt berulang yang identik.",
              ),
              q("Panggilan API bisa gagal; anggap kegagalan sebagai keadaan normal, bukan pengecualian langka."),
              h3("Pengaman sebelum rilis"),
              p(
                "Validasi keluaran model sebelum ditampilkan atau dijalankan. Jangan biarkan model memicu tindakan sensitif tanpa konfirmasi manusia. Catat prompt dan keluaran untuk audit, tetapi jaga data pribadi pengguna.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Integrasi API AI",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa fungsi pesan berperan 'system' pada API LLM?",
              pilihan: [
                "Menyimpan riwayat percakapan",
                "Menetapkan peran dan aturan tetap",
                "Mengukur biaya pemakaian",
                "Mengompres token",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa streaming berguna pada aplikasi produksi?",
              pilihan: [
                "Mengurangi jumlah token yang dibayar",
                "Menurunkan latensi yang dirasakan karena keluaran muncul bertahap",
                "Meningkatkan temperature",
                "Menghapus kebutuhan system prompt",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Strategi yang tepat menghadapi kegagalan API adalah...",
              pilihan: [
                "Mengabaikan error",
                "Timeout, retry dengan backoff, dan fallback model",
                "Mengirim ulang tanpa batas seketika",
                "Mematikan aplikasi",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa keluaran model perlu divalidasi sebelum dijalankan?",
              pilihan: [
                "Karena keluaran model selalu salah",
                "Karena model bisa berhalusinasi atau menghasilkan tindakan yang tidak diinginkan",
                "Karena validasi membuatnya lebih cepat",
                "Karena menghemat token",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },
];
