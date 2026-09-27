/**
 * Seed konten kursus pasar gelombang A — enam kursus yang **halaman kurasinya
 * sudah ada** di `data/courses.json`. Berkas ini sengaja **tidak menulis
 * `halaman`**: satu-satunya tugasnya adalah melengkapi **satu kuis per modul**
 * (4 soal) agar setiap modul bisa dikerjakan dan dinilai.
 *
 * Judul modul di bawah ini **persis** sama dengan judul modul di katalog, supaya
 * engine mencocokkan modul lama alih-alih membuat modul baru.
 */

import type { KursusSeed } from "./tipen";

export const KURSUS_PASAR_A: KursusSeed[] = [
  // -------------------------------------------------------------------------
  // Keamanan aplikasi
  // -------------------------------------------------------------------------
  {
    slug: "it-security-fundamental",
    judul: "Keamanan Aplikasi: Praktik Dasar",
    deskripsi:
      "Keamanan aplikasi yang bisa langsung diterapkan: OWASP Top 10, manajemen secret, autentikasi aman, validasi input, dan kerentahan dependensi.",
    tags: [
      "security",
      "owasp",
      "auth",
      "cryptography",
      "authentication",
      "authorization",
      "injection",
      "passwords",
      "cyber",
    ],
    level: "menengah",
    track: "cyber-sec",
    modul: [
      {
        judul: "OWASP Top 10",
        ringkasan:
          "Kategori kerentanan yang paling sering dieksploitasi: kontrol akses yang hanya disembunyikan di antarmuka, injection, autentikasi yang rapuh, dan desain yang mengabaikan skenario negatif.",
        durasi_min: 270,
        kuis: {
          judul: "Kuis: OWASP Top 10",
          deskripsi: "Menguji pemahaman kategori kerentanan yang paling sering muncul.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Broken access control terjadi ketika…",
              pilihan: [
                "Tombol disembunyikan di UI tetapi server tetap melayani request tanpa memeriksa hak akses",
                "Server menolak request dari akun yang tidak berhak",
                "Kata sandi di-hash dengan salt",
                "Cookie ditandai HttpOnly",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Cara mencegah injection saat menyusun kueri database adalah…",
              pilihan: [
                "Menyambung input pengguna langsung ke string kueri",
                "Memakai parameter binding, bukan menyambung input ke kueri",
                "Menyembunyikan kolom di antarmuka",
                "Menonaktifkan HTTPS",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan:
                "Sesi yang tidak pernah kedaluwarsa dan login tanpa rate limit termasuk kategori…",
              pilihan: [
                "Insecure design",
                "Broken authentication",
                "Broken access control",
                "Security misconfiguration",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Menurut modul ini, aturan otorisasi harus diuji dengan…",
              pilihan: [
                "Akun yang tidak berhak, untuk memastikan server menolak",
                "Hanya akun admin",
                "Pengujian beban saja",
                "Membaca kode tanpa menjalankan apa pun",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Manajemen Secret",
        ringkasan:
          "Kenapa secret bocor karena default: secret di dalam image, riwayat repository yang tak bisa dihapus, dan pola penyimpanan aman lewat vault atau environment variable saat runtime.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Manajemen Secret",
          deskripsi: "Menguji penanganan kredensial dan rahasia aplikasi.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Secret yang ditulis di dalam image Docker…",
              pilihan: [
                "Aman karena image tidak bisa diunduh orang lain",
                "Terbaca oleh siapa pun yang menarik image itu",
                "Otomatis dienkripsi oleh registry",
                "Hanya terbaca saat container berjalan",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Secret yang pernah masuk ke repository lalu dihapus harus dianggap…",
              pilihan: [
                "Aman karena barisnya sudah hilang",
                "Tetap bocor, sehingga secretnya harus diganti",
                "Aman selama commit-nya tidak di-push",
                "Aman bila file ditambahkan ke .gitignore",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Tempat penyimpanan secret yang dianjurkan adalah…",
              pilihan: [
                "Konstanta di dalam kode sumber",
                "Vault atau environment variable yang diinjeksikan saat runtime",
                "Berkas .env yang ikut ter-commit",
                "Komentar di dalam berkas konfigurasi",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Untuk database, aplikasi sebaiknya memakai…",
              pilihan: [
                "Akun superuser agar tidak ada masalah izin",
                "User khusus aplikasi dengan hak akses seperlunya",
                "Akun root dengan kata sandi default",
                "Satu akun yang dipakai bersama seluruh layanan",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Autentikasi dan Sesi",
        ringkasan:
          "Kenapa token di local storage berbahaya saat ada XSS, dan bagaimana cookie HttpOnly, Secure, SameSite, serta kedaluwarsa yang ditegakkan server memperbaiki keadaan.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Autentikasi dan Sesi",
          deskripsi: "Menguji penyimpanan sesi dan atribut cookie yang aman.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Mengapa menyimpan token sesi di local storage berbahaya?",
              pilihan: [
                "Karena local storage terlalu kecil",
                "Karena skrip mana pun di halaman bisa membacanya, jadi satu XSS cukup untuk mencurinya",
                "Karena local storage dihapus setiap reload",
                "Karena local storage tidak bisa menyimpan string",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Atribut cookie yang membuatnya tidak bisa dibaca JavaScript adalah…",
              pilihan: ["HttpOnly", "SameSite", "Path", "Domain"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Atribut cookie yang membatasi pengiriman pada permintaan lintas situs adalah…",
              pilihan: ["Secure", "HttpOnly", "SameSite", "Expires"],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Token yang sudah kedaluwarsa harus…",
              pilihan: [
                "Ditolak oleh server, bukan hanya dihapus di klien",
                "Tetap diterima selama ada di cookie",
                "Dihapus di klien saja sudah cukup",
                "Diperpanjang otomatis tanpa pemeriksaan",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Validasi dan Dependensi",
        ringkasan:
          "Dua lapis validasi yang wajib ada, encoding saat keluar, pemindaian dependensi berkala, dan deteksi kebocoran secret di log sebelum sempat masuk repository.",
        durasi_min: 180,
        kuis: {
          judul: "Kuis: Validasi dan Dependensi",
          deskripsi: "Menguji validasi input, encoding output, dan pemeliharaan dependensi.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Validasi input yang benar-benar menentukan keamanan adalah…",
              pilihan: [
                "Validasi di klien saja",
                "Validasi di server",
                "Validasi di CSS",
                "Validasi di dokumentasi API",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan:
                "Untuk mencegah injection saat merender data ke HTML, yang dilakukan adalah…",
              pilihan: [
                "Escaping sesuai konteks keluaran",
                "Menyambung nilai apa adanya ke template",
                "Menyembunyikan nilai di UI",
                "Mengompres respons HTML",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Mengapa dependensi perlu dipindai secara rutin?",
              pilihan: [
                "Agar ukuran bundel mengecil",
                "Karena paket pihak ketiga bisa membawa kerentanan yang diketahui",
                "Karena lisensi selalu berubah",
                "Agar versinya selalu terbaru tanpa alasan lain",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Sebelum log masuk ke repository, sebaiknya dilakukan…",
              pilihan: [
                "Deteksi kebocoran secret di dalam log",
                "Kompresi log agar lebih kecil",
                "Penghapusan seluruh log",
                "Penggabungan semua baris log",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Backend .NET enterprise
  // -------------------------------------------------------------------------
  {
    slug: "net-dotnet-enterprise",
    judul: "Backend C# dan ASP.NET Core untuk Enterprise",
    deskripsi:
      "C# dan ASP.NET Core untuk backend enterprise dan bank: LINQ, middleware, Entity Framework Core, async, dan pola arsitektur yang dipakai institusi di Indonesia.",
    tags: [
      "net",
      "dotnet",
      "backend",
      "api",
      "rest",
      "enterprise",
      "banking",
      "database",
      "developer",
      "programmer",
    ],
    level: "menengah",
    track: "web-dev",
    modul: [
      {
        judul: "C# dan LINQ",
        ringkasan:
          "Sifat lazy LINQ yang menghemat sekaligus menjebak saat hasil dihitung lebih dari sekali, dan kapan foreach biasa lebih jelas daripada rangkaian operator.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: C# dan LINQ",
          deskripsi: "Menguji evaluasi lazy dan biaya perhitungan berulang pada LINQ.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Sifat eksekusi LINQ yang perlu diwaspadai adalah…",
              pilihan: [
                "Dieksekusi langsung saat operator ditulis",
                "Lazy: baru berjalan saat hasilnya dienumerasi",
                "Selalu dieksekusi di database",
                "Selalu dieksekusi paralel",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Bahaya utama evaluasi lazy adalah…",
              pilihan: [
                "Kode menjadi lebih panjang",
                "Perhitungan diulang setiap kali hasilnya dienumerasi ulang",
                "Tipe data berubah otomatis",
                "Operator LINQ tidak bisa dipakai berantai",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Bila panjang sebuah hasil perlu dipakai beberapa kali, sebaiknya…",
              pilihan: [
                "Hitung sekali lalu simpan hasilnya",
                "Hitung ulang setiap kali dibutuhkan",
                "Ganti LINQ dengan SQL mentah",
                "Nonaktifkan lazy evaluation secara global",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Menurut modul ini, LINQ sebaiknya dipandang sebagai…",
              pilihan: [
                "Alat, bukan doktrin — foreach biasa lebih jelas untuk logika sederhana",
                "Pengganti wajib semua perulangan",
                "Cara satu-satunya mengakses database",
                "Fitur yang tidak boleh dipakai di produksi",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "ASP.NET Core dan Middleware",
        ringkasan:
          "Urutan middleware menentukan perilaku aplikasi: logging paling awal, penanganan exception terpusat, dan konfigurasi lewat options pattern agar bisa diuji.",
        durasi_min: 270,
        kuis: {
          judul: "Kuis: ASP.NET Core dan Middleware",
          deskripsi: "Menguji urutan pipeline dan penanganan exception terpusat.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa yang menentukan urutan middleware dijalankan?",
              pilihan: [
                "Nama kelas middleware",
                "Urutan pendaftarannya di dalam pipeline",
                "Jumlah baris kode di dalamnya",
                "Prioritas yang diatur di appsettings",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Middleware logging sebaiknya diletakkan di mana?",
              pilihan: [
                "Paling awal dalam pipeline",
                "Paling akhir setelah semua endpoint",
                "Di dalam setiap controller",
                "Di dalam model",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Penanganan exception yang dianjurkan adalah…",
              pilihan: [
                "try/catch di setiap action controller",
                "Terpusat di satu tempat, bukan di tiap controller",
                "Mengabaikan exception agar aplikasi tidak berhenti",
                "Menampilkan stack trace ke pengguna",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Agar konfigurasi mudah diuji, modul ini menyarankan…",
              pilihan: [
                "Options pattern",
                "Konstanta hardcode di kelas",
                "Membaca Environment.GetEnvironmentVariable langsung di action",
                "Berkas XML yang dibaca ulang tiap request",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Entity Framework Core",
        ringkasan:
          "Dua masalah EF Core yang paling sering muncul: N+1 dan fungsi yang tak bisa diterjemahkan ke SQL, plus disiplin migration dan pemakaian AsNoTracking untuk kueri baca.",
        durasi_min: 270,
        kuis: {
          judul: "Kuis: Entity Framework Core",
          deskripsi: "Menguji N+1, proyeksi, dan disiplin kueri baca.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Masalah N+1 terjadi ketika…",
              pilihan: [
                "Satu kueri induk diikuti satu kueri tambahan untuk setiap baris anak",
                "Satu kueri mengambil seluruh data sekaligus",
                "Indeks tidak dipakai oleh database",
                "Kolom dijumlahkan dua kali",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Cara menghindari N+1 di EF Core adalah…",
              pilihan: [
                "Memakai Include atau proyeksi yang tepat",
                "Menambah try/catch di sekitar kueri",
                "Menonaktifkan change tracking secara global",
                "Memecah setiap entitas menjadi tabel terpisah",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Untuk kueri yang hanya membaca, sebaiknya dimulai dengan…",
              pilihan: ["AsNoTracking", "SaveChanges", "Attach", "Add"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Menurut modul ini, yang harus selalu diukur adalah…",
              pilihan: [
                "Jumlah kueri yang dijalankan, bukan hanya waktu eksekusi",
                "Ukuran berkas konfigurasi",
                "Jumlah kelas di dalam proyek",
                "Panjang nama tabel",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Async dan Resilience",
        ringkasan:
          "Kenapa async over sync lebih buruk daripada sinkron, satu CancellationToken yang diteruskan ke seluruh rantai, serta retry, bulkhead, dan circuit breaker.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: Async dan Resilience",
          deskripsi: "Menguji pola async dan ketahanan terhadap kegagalan layanan.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Mengapa memanggil `.Result` atau `.Wait` pada sebuah Task berbahaya?",
              pilihan: [
                "Karena memblokir thread pool",
                "Karena mengubah tipe hasil",
                "Karena mematikan proses",
                "Karena menghapus cache",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Strategi retry yang dianjurkan adalah…",
              pilihan: [
                "Mencoba ulang secepat mungkin tanpa jeda",
                "Backoff eksponensial ditambah jitter",
                "Mencoba ulang tanpa batas",
                "Menyerah setelah satu kali gagal",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Bulkhead berfungsi untuk…",
              pilihan: [
                "Membatasi jumlah permintaan yang boleh menunggu",
                "Mengenkripsi payload permintaan",
                "Menggandakan jumlah koneksi database",
                "Mempercepat cold start",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Circuit breaker berfungsi untuk…",
              pilihan: [
                "Menahan permintaan ke layanan yang sudah pasti gagal",
                "Mengulang permintaan tanpa jeda",
                "Memisahkan koneksi database",
                "Mencatat semua permintaan ke disk",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Git dan kolaborasi tim
  // -------------------------------------------------------------------------
  {
    slug: "git-colaboration-team",
    judul: "Git dan Kolaborasi Tim Engineering",
    deskripsi:
      "Git dari dalam: branching strategy, pull request yang mudah direview, menyelesaikan konflik, dan alur monorepo yang dipakai tim engineering di Indonesia.",
    tags: [
      "git",
      "collaboration",
      "team",
      "developer",
      "programming",
      "software",
      "engineer",
      "workflow",
    ],
    level: "dasar",
    track: "web-dev",
    modul: [
      {
        judul: "Branching Strategy",
        ringkasan:
          "Memilih antara trunk based dan Gitflow berdasarkan ritme rilis, dan alasan aturan yang disepakati bersama lebih penting daripada pilihan strateginya.",
        durasi_min: 150,
        kuis: {
          judul: "Kuis: Branching Strategy",
          deskripsi: "Menguji pemilihan strategi branch sesuai ritme rilis tim.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Trunk based branching cocok untuk…",
              pilihan: [
                "Produk yang sering rilis dengan branch pendek dan integrasi sering",
                "Rilis berjadwal dengan branch panjang terstruktur",
                "Proyek yang tidak pernah dirilis",
                "Tim yang bekerja sendiri tanpa branch",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Gitflow cocok untuk…",
              pilihan: [
                "Produk yang merilis setiap commit",
                "Rilis berjadwal dengan branch panjang dan terstruktur",
                "Skrip sekali pakai",
                "Repositori tanpa review",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Menurut modul ini, yang paling menentukan keberhasilan strategi adalah…",
              pilihan: [
                "Semua orang mengikuti aturan yang sama",
                "Memilih strategi yang paling populer di internet",
                "Jumlah branch yang banyak",
                "Nama branch yang panjang",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan:
                "Apa yang dikatakan modul ini lebih mahal daripada memilih strategi yang salah sejak awal?",
              pilihan: [
                "Bermigrasi di tengah jalan ke strategi lain",
                "Menulis pesan commit yang panjang",
                "Memakai tag rilis",
                "Menghapus branch yang sudah di-merge",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Pull Request yang Mudah Direview",
        ringkasan:
          "Ukuran pull request yang wajar, deskripsi yang menjelaskan kenapa, pemisahan refactor dari perubahan perilaku, dan memilih reviewer yang tepat.",
        durasi_min: 150,
        kuis: {
          judul: "Kuis: Pull Request yang Mudah Direview",
          deskripsi: "Menguji ukuran, deskripsi, dan pemilihan reviewer pull request.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Ukuran pull request yang dianjurkan modul ini adalah sekitar…",
              pilihan: [
                "Empat ratus baris",
                "Lima ribu baris",
                "Sepuluh baris",
                "Tidak ada batas sama sekali",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Deskripsi pull request seharusnya menjelaskan…",
              pilihan: [
                "Kenapa perubahan dilakukan, karena kode sudah menjelaskan apa",
                "Setiap baris yang diubah",
                "Riwayat karier penulis",
                "Daftar tool yang dipakai editor",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Refactor dan perubahan perilaku sebaiknya…",
              pilihan: [
                "Dipisahkan ke pull request yang berbeda",
                "Selalu digabung agar cepat",
                "Tidak pernah dilakukan",
                "Disembunyikan dari reviewer",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Review sebaiknya diminta kepada…",
              pilihan: [
                "Orang yang tepat untuk bagian itu, bukan ke semua orang",
                "Seluruh anggota tim",
                "Hanya manajer",
                "Tidak perlu diminta siapa pun",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Konflik dan Pemulihan",
        ringkasan:
          "Perintah untuk pulih cepat saat konflik: git status dan git log graph lebih dulu, abort pada rebase/merge, revert alih-alih reset hard pada kode bersama, dan reflog.",
        durasi_min: 180,
        kuis: {
          judul: "Kuis: Konflik dan Pemulihan",
          deskripsi: "Menguji pemulihan dari konflik dan riwayat yang tampak hilang.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Perintah yang masih bisa menemukan commit yang tampak hilang adalah…",
              pilihan: ["git reflog", "git clean", "git gc", "git blame"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Pada kode yang sudah dibagikan ke orang lain, tindakan yang lebih aman adalah…",
              pilihan: [
                "git revert, bukan reset hard",
                "git reset --hard",
                "Menghapus branch utama",
                "Force push ke trunk",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Sebelum melakukan apa pun saat menghadapi konflik, sebaiknya…",
              pilihan: [
                "Menjalankan git status dan git log graph",
                "Langsung force push",
                "Menghapus repositori lokal",
                "Mengedit berkas .git secara manual",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Perintah untuk membatalkan rebase yang sedang berjalan adalah…",
              pilihan: ["git rebase --abort", "git rebase --continue", "git rebase --skip", "git commit --amend"],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Monorepo",
        ringkasan:
          "Apa yang benar-benar didapat dari monorepo: perubahan lintas service dalam satu pull request, dependensi bersama, serta biaya build time dan ukuran repository.",
        durasi_min: 150,
        kuis: {
          judul: "Kuis: Monorepo",
          deskripsi: "Menguji keuntungan dan biaya pendekatan monorepo.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Keuntungan utama monorepo menurut modul ini adalah…",
              pilihan: [
                "Perubahan lintas service bisa jadi satu commit dan satu pull request",
                "Build time selalu lebih cepat",
                "Ukuran repository selalu lebih kecil",
                "Tidak perlu review sama sekali",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Biaya nyata yang tumbuh saat memakai monorepo adalah…",
              pilihan: [
                "Build time dan ukuran repository",
                "Jumlah bahasa pemrograman",
                "Jumlah akun pengguna",
                "Biaya lisensi editor",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Salah satu hal yang dimusatkan monorepo adalah…",
              pilihan: [
                "Dependensi dan tooling bersama",
                "Semua rahasia produksi",
                "Seluruh data pengguna",
                "Semua lingkungan staging",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Menurut modul ini, monorepo butuh…",
              pilihan: [
                "Jalur folder yang jelas, atau strukturnya akan berubah setiap bulan",
                "Satu orang yang mengurus semua kode",
                "Menghapus seluruh pengujian",
                "Menonaktifkan integrasi berkelanjutan",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Python untuk otomatisasi
  // -------------------------------------------------------------------------
  {
    slug: "python-automation-scripting",
    judul: "Python untuk Automation dan Scripting",
    deskripsi:
      "Python untuk pekerjaan berulang: memproses berkas, memanggil API, mengambil data dari web, menjadwalkan job, dan merapikan data. Fokus pada hasil kerja nyata.",
    tags: [
      "python",
      "automation",
      "scripting",
      "developer",
      "tools",
      "data",
      "analyst",
      "programming",
    ],
    level: "dasar",
    track: "data",
    modul: [
      {
        judul: "Dasar Python untuk Otomasi",
        ringkasan:
          "Idiom yang memendekkan kode tanpa membuatnya buram: comprehension untuk transformasi sederhana, with untuk sumber daya, pathlib untuk path, dan generator untuk data besar.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Dasar Python untuk Otomasi",
          deskripsi: "Menguji idiom Python yang aman dipakai di skrip otomasi.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Konstruksi yang memastikan berkas atau koneksi selalu tertutup adalah…",
              pilihan: ["with", "try", "lambda", "global"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Modul yang dianjurkan untuk menangani path adalah…",
              pilihan: ["pathlib", "string", "os.system", "subprocess"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Untuk data besar yang tidak muat di memori, modul ini menyarankan…",
              pilihan: [
                "Generator, bukan memuat semuanya ke dalam list",
                "List penuh agar lebih cepat",
                "Menambah memori mesin",
                "Menyimpan semuanya ke variabel global",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Comprehension paling cocok dipakai untuk…",
              pilihan: [
                "Transformasi sederhana yang tetap mudah dibaca",
                "Logika bercabang yang rumit",
                "Operasi I/O jaringan",
                "Menangani exception",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Memproses Data",
        ringkasan:
          "Data dunia nyata selalu sedikit rusak: masalah encoding, baris kosong dan kolom hilang, tanggal bercampur format, serta streaming untuk skala besar.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Memproses Data",
          deskripsi: "Menguji penanganan data yang kotor saat ingestion.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Menurut modul ini, masalah paling sering pada ingestion data adalah…",
              pilihan: [
                "Masalah format, terutama encoding",
                "Masalah kecepatan CPU",
                "Kekurangan memori",
                "Kesalahan logika algoritma",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Untuk skala besar, pemrosesan sebaiknya memakai…",
              pilihan: [
                "Streaming, bukan memuat list penuh",
                "List penuh agar semua di memori",
                "Satu baris per proses",
                "Menyimpan semua baris ke disk berulang",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Penanganan encoding yang benar adalah…",
              pilihan: [
                "Membaca utf-8 dan menangani errors secara sadar",
                "Mengabaikan errors tanpa catatan",
                "Membaca sebagai biner lalu mencetaknya",
                "Memaksa latin-1 untuk semua berkas",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Manakah yang disebut modul ini sebagai anomali umum data nyata?",
              pilihan: [
                "Baris kosong, kolom hilang, dan angka berformat lokal",
                "Tipe kolom yang selalu konsisten",
                "Selalu ada satu format tanggal",
                "Tidak pernah ada nilai kosong",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "API dan Web yang Sopan",
        ringkasan:
          "Memakai API dan web dengan benar: timeout eksplisit, retry dengan jeda bertambah, menghormati rate limit, menyimpan token dengan aman, serta robots.txt dan syarat layanan.",
        durasi_min: 180,
        kuis: {
          judul: "Kuis: API dan Web yang Sopan",
          deskripsi: "Menguji etika dan ketahanan saat memanggil API atau web.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Setiap request harus memiliki…",
              pilihan: [
                "Timeout eksplisit",
                "Header yang panjang",
                "Jumlah retry tak terbatas",
                "User-Agent palsu",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Saat sebuah request gagal, retry sebaiknya dilakukan dengan…",
              pilihan: [
                "Jeda yang bertambah, bukan langsung memukul berulang",
                "Interval nol detik",
                "Menambah jumlah thread tanpa batas",
                "Mengabaikan kegagalan",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Sebelum mengambil data dari sebuah situs, yang wajib dihormati adalah…",
              pilihan: [
                "robots.txt dan syarat layanan situs sumber",
                "Warna tema situs",
                "Nama domain registrar",
                "Versi JavaScript situs",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Token API sebaiknya disimpan di…",
              pilihan: [
                "Tempat aman, bukan langsung di dalam kode",
                "Dalam kode agar mudah dipakai",
                "Di dalam pesan commit",
                "Di komentar skrip",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Menjadwalkan Job",
        ringkasan:
          "Job yang diam-diam gagal tidak pernah diperbaiki: log dengan rotasi, notifikasi saat gagal, idempoten, dan menyimpan waktu jalan agar perlambatan terlihat.",
        durasi_min: 120,
        kuis: {
          judul: "Kuis: Menjadwalkan Job",
          deskripsi: "Menguji observabilitas dan keamanan menjalankan job terjadwal.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Job terjadwal tanpa notifikasi kegagalan berisiko…",
              pilihan: [
                "Gagal berbulan-bulan tanpa ada yang tahu",
                "Berjalan terlalu cepat",
                "Menghabiskan seluruh disk dalam sehari",
                "Mengubah kode sumber sendiri",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Notifikasi sebaiknya dikirim…",
              pilihan: [
                "Saat job gagal, bukan hanya saat berhasil",
                "Hanya saat job berhasil",
                "Setiap menit tanpa memandang status",
                "Tidak perlu sama sekali",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Job yang idempoten berarti…",
              pilihan: [
                "Aman dijalankan dua kali tanpa efek ganda",
                "Selalu selesai di bawah satu detik",
                "Tidak memerlukan log",
                "Tidak boleh dijadwalkan ulang",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Cara mencatat log job yang dianjurkan adalah…",
              pilihan: [
                "Ke berkas dengan rotasi",
                "Ke terminal yang hilang saat sesi berakhir",
                "Tidak dicatat sama sekali",
                "Ke variabel di memori saja",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // System design
  // -------------------------------------------------------------------------
  {
    slug: "system-design-arsitektur",
    judul: "System Design dan Arsitektur Skala Besar",
    deskripsi:
      "Merancang sistem yang tetap kuat ketika pengguna dan data bertambah: batas layanan, model data, caching, dan strategi scaling yang realistis untuk produk Indonesia.",
    tags: [
      "systems",
      "design",
      "architecture",
      "scalable",
      "microservice",
      "distributed",
      "database",
      "performance",
    ],
    level: "lanjut",
    track: "web-dev",
    modul: [
      {
        judul: "Mulai dari Kebutuhan",
        ringkasan:
          "Lima pertanyaan yang harus dijawab sebelum menggambar diagram: jumlah dan pola pengguna, kebutuhan baca, target latensi, bagian yang harus tetap hidup, dan besar tim.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: Mulai dari Kebutuhan",
          deskripsi: "Menguji kebiasaan bertanya kebutuhan sebelum menggambar diagram.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Diagram sistem yang bagus dimulai dari…",
              pilihan: [
                "Pertanyaan kebutuhan, bukan daftar layanan cloud",
                "Memilih vendor cloud terlebih dahulu",
                "Menentukan jumlah microservice",
                "Menggambar basis data paling dulu",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Salah satu pertanyaan wajib sebelum menggambar diagram adalah…",
              pilihan: [
                "Berapa pengguna aktif dan seperti apa pola lonjakannya",
                "Warna tema aplikasi",
                "Nama domain yang akan dipakai",
                "Merek laptop tim",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan:
                "Pertanyaan “apa yang harus tetap berjalan kalau satu bagian gagal” mengarah pada kebutuhan…",
              pilihan: [
                "Ketersediaan dan resiliensi",
                "Estetika antarmuka",
                "Anggaran iklan",
                "Jumlah desainer",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Urutan yang benar menurut modul ini adalah…",
              pilihan: [
                "Jawab pertanyaan kebutuhan dulu, baru gambar diagram",
                "Gambar diagram dulu, pertanyaan belakangan",
                "Gambar diagram tanpa perlu pertanyaan",
                "Mulai dari jumlah mesin yang dibeli",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Batas Layanan dan Data",
        ringkasan:
          "Memecah layanan berdasarkan perubahan yang berbeda, bukan tabel, serta alasan transaksi lintas layanan selalu lebih sulit dan perlu dirancang eksplisit.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: Batas Layanan dan Data",
          deskripsi: "Menguji cara memecah layanan dan menangani transaksi lintas batas.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Layanan sebaiknya dipecah berdasarkan…",
              pilihan: [
                "Perubahan yang berbeda, bukan berdasarkan tabel",
                "Jumlah tabel di basis data",
                "Abjad nama entitas",
                "Jumlah baris kode",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Transaksi lintas layanan membutuhkan…",
              pilihan: [
                "Kompensasi, dan itu selalu lebih sulit",
                "Satu basis data bersama untuk semua layanan",
                "Kunci tabel global",
                "Pengabaian konsistensi",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Operasi lintas layanan yang perlu dirancang eksplisit adalah…",
              pilihan: ["Tulis (write)", "Baca (read)", "Logging", "Kompilasi"],
              jawaban_benar: 0,
            },
            {
              pertanyaan:
                "Jika satu operasi bisnis sering menyeberang banyak layanan, menurut modul ini artinya…",
              pilihan: [
                "Batas yang dipilih salah dan yang perlu diperbaiki adalah batasnya",
                "Semua layanan harus digabung jadi satu monolit",
                "Transaksi harus dilarang",
                "Basis data harus dipecah lagi",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Caching dan Konsistensi",
        ringkasan:
          "Cache adalah pertukaran antara kecepatan dan kebenaran: dua sumber kebenaran, TTL untuk konten statis, invalidasi saat tulis, cache aside, dan stale while revalidate.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: Caching dan Konsistensi",
          deskripsi: "Menguji strategi cache dan toleransi terhadap data basi.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Begitu ada cache, muncul masalah berupa…",
              pilihan: [
                "Dua sumber kebenaran yang perlu direkonsiliasi",
                "Tidak ada sumber kebenaran sama sekali",
                "Basis data otomatis terhapus",
                "Latensi selalu meningkat",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Konten yang jarang berubah dan sering dibaca sebaiknya…",
              pilihan: [
                "Memakai TTL panjang",
                "Diinvalidasi setiap detik",
                "Tidak boleh di-cache",
                "Disimpan di local storage pengguna",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Konten yang berubah karena aksi pengguna sebaiknya…",
              pilihan: [
                "Diinvalidasi saat terjadi tulis",
                "Memakai TTL satu tahun",
                "Di-cache tanpa batas",
                "Di-cache di sisi klien saja",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Menurut modul ini, strategi cache yang lebih umum dipakai adalah…",
              pilihan: [
                "Cache aside",
                "Write through",
                "Write behind tanpa invalidasi",
                "Tanpa cache sama sekali",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Scaling",
        ringkasan:
          "Urutan scaling yang jarang ditanyakan: ukur lebih dulu, optimalkan cache dan indeks, pecah bagian independen, dan rancang agar sistem tetap benar saat satu bagian mati.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: Scaling",
          deskripsi: "Menguji urutan langkah scaling yang terukur.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Langkah pertama saat menghadapi masalah performa adalah…",
              pilihan: [
                "Mengukur: CPU, input output, lock, atau jaringan",
                "Langsung menambah jumlah mesin",
                "Menulis ulang seluruh aplikasi",
                "Mengganti bahasa pemrograman",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Sebelum menambah mesin, yang dilakukan untuk query adalah…",
              pilihan: [
                "Memakai cache dan indeks",
                "Menghapus semua indeks",
                "Memindahkan query ke klien",
                "Menonaktifkan basis data relasional",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Menambah mesin sebaiknya dipandang sebagai…",
              pilihan: [
                "Langkah terakhir, bukan langkah pertama",
                "Langkah pertama yang selalu dipakai",
                "Pengganti pengukuran",
                "Satu-satunya cara scaling",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Setelah memecah bagian yang independen, langkah berikutnya adalah…",
              pilihan: [
                "Menskalakan horizontal bagian itu",
                "Menggabungkan kembali semuanya",
                "Mematikan bagian tersebut",
                "Menyerahkan ke satu mesin besar",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // UI/UX design
  // -------------------------------------------------------------------------
  {
    slug: "ui-ux-design-fundamental",
    judul: "UI/UX Design: Antarmuka yang Bisa Dipakai",
    deskripsi:
      "Dasar desain antarmuka untuk product designer: hierarki visual, tipografi, kontras dan aksesibilitas, desain mobile, serta validasi sebelum ada kode.",
    tags: ["design", "designer", "ux", "ui", "product", "mobile", "web"],
    level: "dasar",
    track: "web-dev",
    modul: [
      {
        judul: "Hierarki Visual",
        ringkasan:
          "Empat alat yang hampir selalu cukup — ukuran, bobot, ruang, dan warna — untuk mengarahkan perhatian tanpa membuat antarmuka terasa ramai.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Hierarki Visual",
          deskripsi: "Menguji penggunaan alat hierarki untuk mengarahkan perhatian.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Desain yang terasa ramai biasanya disebabkan oleh…",
              pilihan: [
                "Terlalu banyak elemen yang sama-sama bersaing mendapat perhatian",
                "Kurang dekorasi",
                "Terlalu sedikit warna",
                "Terlalu banyak halaman",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Empat alat hierarki visual yang disebut modul ini adalah…",
              pilihan: [
                "Ukuran, bobot, ruang, dan warna",
                "Animasi, bayangan, gradien, dan ikon",
                "Tabel, grafik, diagram, dan peta",
                "Font, margin, border, dan radius",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Perbedaan ukuran yang tipis, dibanding perbedaan yang jelas…",
              pilihan: [
                "Lebih lemah untuk membangun hierarki",
                "Selalu lebih kuat",
                "Tidak berpengaruh sama sekali",
                "Selalu disarankan",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Menurut modul ini, warna sebaiknya dipakai untuk…",
              pilihan: [
                "Makna dan penekanan, bukan dekorasi",
                "Mengisi ruang kosong",
                "Menggantikan teks",
                "Menandai setiap elemen dengan warna berbeda",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Warna dan Aksesibilitas",
        ringkasan:
          "Kontras sebagai syarat, bukan tambahan: rasio 4.5 banding 1 untuk teks normal, 3 banding 1 untuk teks besar, makna yang tak bergantung warna, dan fokus keyboard yang terlihat.",
        durasi_min: 180,
        kuis: {
          judul: "Kuis: Warna dan Aksesibilitas",
          deskripsi: "Menguji kontras dan aksesibilitas warna.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Rasio kontras minimal untuk teks berukuran normal adalah…",
              pilihan: ["4.5 banding 1", "1.5 banding 1", "2 banding 1", "10 banding 1"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Rasio kontras minimal untuk teks berukuran besar adalah…",
              pilihan: ["3 banding 1", "1 banding 1", "4.5 banding 1", "7 banding 1"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Kombinasi warna yang disebut paling buruk untuk buta warna adalah…",
              pilihan: [
                "Merah dan hijau",
                "Hitam dan putih",
                "Biru dan kuning",
                "Abu-abu dan putih",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Menurut modul ini, fokus keyboard harus…",
              pilihan: [
                "Selalu terlihat, dan urutannya mengikuti urutan baca",
                "Disembunyikan agar tampilan bersih",
                "Hanya muncul saat mouse dipakai",
                "Diacak agar tidak membosankan",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Desain untuk Mobile",
        ringkasan:
          "Batasan fisik perangkat yang tidak bisa diabaikan: target sentuh minimal 44 piksel, menjauhkan tindakan destruktif, tata letak satu kolom, dan kondisi pemuatan/kosong/gagal.",
        durasi_min: 200,
        kuis: {
          judul: "Kuis: Desain untuk Mobile",
          deskripsi: "Menguji batasan dan pola desain untuk layar sentuh.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Ukuran target sentuh minimal yang dianjurkan adalah…",
              pilihan: ["44 piksel", "12 piksel", "24 piksel", "100 piksel"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Tindakan destruktif sebaiknya…",
              pilihan: [
                "Dijauhkan dari tindakan utama",
                "Diletakkan tepat di samping tindakan utama",
                "Diberi warna yang sama dengan tindakan utama",
                "Disembunyikan tanpa jalur alternatif",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Tata letak mobile yang dianjurkan modul ini adalah…",
              pilihan: [
                "Satu kolom dengan jarak antar baris longgar",
                "Dua kolom rapat di semua ukuran",
                "Tiga kolom agar informasi padat",
                "Tata letak meja kerja di perkecil",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Kondisi apa saja yang harus dirancang?",
              pilihan: [
                "Pemuatan, kosong, dan gagal",
                "Hanya kondisi berhasil",
                "Hanya kondisi kosong",
                "Hanya kondisi pemuatan",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Prototipe dan Validasi",
        ringkasan:
          "Tiga sumber validasi dan batasnya — uji kegunaan, studi tugas, dan ulasan — serta mengapa lima peserta sudah cukup bila kelompoknya benar.",
        durasi_min: 190,
        kuis: {
          judul: "Kuis: Prototipe dan Validasi",
          deskripsi: "Menguji sumber validasi desain dan batasnya.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Menurut modul ini, berapa peserta yang sudah cukup untuk menemukan sebagian besar masalah kegunaan?",
              pilihan: ["Lima", "Lima puluh", "Seratus", "Satu"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Yang menentukan kualitas sebuah uji bukan jumlah peserta, melainkan…",
              pilihan: [
                "Apakah peserta termasuk kelompok yang benar",
                "Berapa lama uji berlangsung",
                "Seberapa mahal hadiahnya",
                "Berapa banyak pertanyaan yang diajukan",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Uji kegunaan (usability test) mengukur…",
              pilihan: [
                "Apakah orang menemukan jalan yang benar",
                "Berapa estetis tampilannya",
                "Berapa biaya produksinya",
                "Berapa baris kode yang ditulis",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Studi tugas (task study) menilai…",
              pilihan: [
                "Apakah alur utama selesai tanpa bantuan",
                "Apakah warna sesuai tren",
                "Apakah animasi mulus",
                "Apakah kode mudah dibaca",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },
];
