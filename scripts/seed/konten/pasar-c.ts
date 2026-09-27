/**
 * Seed konten kursus pasar gelombang C — lima kursus yang **halaman kurasinya
 * sudah ada** di `data/courses.json`. Berkas ini sengaja **tidak menulis
 * `halaman`**: satu-satunya tugasnya adalah melengkapi **satu kuis per modul**
 * (4 soal) agar setiap modul bisa dikerjakan dan dinilai.
 *
 * Judul modul di bawah ini **persis** sama dengan judul modul di katalog, supaya
 * engine mencocokkan modul lama alih-alih membuat modul baru.
 */

import type { KursusSeed } from "./tipen";

export const KURSUS_PASAR_C: KursusSeed[] = [
  // -------------------------------------------------------------------------
  // Mobile iOS
  // -------------------------------------------------------------------------
  {
    slug: "mobile-ios-swift",
    judul: "Mobile iOS dengan Swift dan SwiftUI",
    deskripsi:
      "Swift dan SwiftUI untuk iOS: optional, value semantics, alur data satu arah, Codable, dan proses rilis ke App Store. Banyak dilamar sebagai remote role.",
    tags: ["ios", "mobile", "swift", "swiftui", "developer", "apple"],
    level: "menengah",
    track: "web-dev",
    modul: [
      {
        judul: "Optional dan Value Type",
        ringkasan:
          "Tiga konsep yang membedakan Swift dari bahasa lain.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Optional dan Value Type",
          deskripsi: "Menguji optional chaining, value semantics, dan guard di Swift.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Ekspresi `pengguna?.alamat?.kota` menghasilkan nilai bertipe…",
              pilihan: [
                "`String` biasa",
                "`String?` (optional), karena seluruh rantai berhenti dan bernilai nil bila salah satu mata rantai nil",
                "`Bool` yang menandakan keberhasilan",
                "Rantai langsung gagal kompilasi",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Perbedaan utama `struct` dan `class` di Swift adalah…",
              pilihan: [
                "Struct memakai value semantics (disalin saat diteruskan), class memakai reference semantics (berbagi rujukan yang sama)",
                "Struct tidak bisa punya method",
                "Class tidak bisa punya properti",
                "Struct hanya boleh menyimpan angka",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa keuntungan `guard let` dibanding `if let` bertingkat?",
              pilihan: [
                "Ia menghilangkan optional sepenuhnya di seluruh berkas",
                "Ia memberi early return yang jelas sehingga nilai yang lolos tetap ter-unwrap di sisa fungsi",
                "Ia lebih cepat saat runtime",
                "Ia bisa dipakai untuk memutasi nilai asli secara paksa",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Untuk membuka optional secara paksa dengan `!`, konsekuensinya adalah…",
              pilihan: [
                "Nilai otomatis diberi default",
                "Crash saat runtime bila nilainya nil — karena itu pakai `!` dengan sangat hemat",
                "Kompiler menolak berkasnya",
                "Optional berubah menjadi non-optional selamanya",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "SwiftUI dan State",
        ringkasan:
          "Alur data satu arah dan preview sebagai alat uji.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: SwiftUI dan State",
          deskripsi: "Menguji alur data satu arah, property wrapper, dan preview.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Property wrapper yang tepat untuk meneruskan state ke view anak agar bisa diubah adalah…",
              pilihan: ["`@State`", "`@Binding`", "`@StateObject`", "`@Environment`"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kapan `@StateObject` dipakai alih-alih `@ObservedObject`?",
              pilihan: [
                "Saat objek dimiliki dan dibuat oleh view itu sendiri, sehingga siklus hidupnya terjaga",
                "Saat objek diteruskan dari parent",
                "Saat objek hanya berisi nilai primitive",
                "Saat view tidak pernah dirender ulang",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Pada alur data satu arah, state seharusnya…",
              pilihan: [
                "Diubah saat proses menggambar view berlangsung",
                "Dibaca untuk menggambar dan hanya diubah lewat aksi pengguna",
                "Disimpan di dalam body view",
                "Ditulis langsung dari kode rendering",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Menurut modul ini, preview sebaiknya dibuat untuk kondisi…",
              pilihan: [
                "Hanya kondisi terisi",
                "Memuat, kosong, gagal, dan terisi",
                "Hanya kondisi gagal",
                "Tidak perlu, cukup dijalankan di simulator",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Networking dan Persistensi",
        ringkasan:
          "URLSession async, Codable, dan penyimpanan lokal.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: Networking dan Persistensi",
          deskripsi: "Menguji URLSession async, Codable, dan aturan main thread.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Protokol apa yang membuat sebuah tipe otomatis bisa di-encode/decode dari JSON di Swift?",
              pilihan: ["`Serializable`", "`Codable`", "`JSONParser`", "`Encodable` saja tanpa `Decodable`"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Cara memanggil URLSession modern di dalam kode `async` adalah…",
              pilihan: [
                "Memakai `dataTask(with:completionHandler:)` lalu menunggu dengan semaphore",
                "Memakai `try await URLSession.shared.data(for:)`",
                "Memanggilnya di dalam loop tanpa `await`",
                "Menjalankannya langsung di main thread",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa decoding JSON besar tidak boleh dilakukan di main thread?",
              pilihan: [
                "Karena JSON tidak bisa didecode di main thread",
                "Karena pekerjaan berat di main thread memblokir antarmuka dan membuat aplikasi tampak membeku",
                "Karena Codable hanya bekerja di background thread",
                "Karena main thread tidak punya akses jaringan",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Untuk kegagalan jaringan sementara, pola yang dianjurkan modul ini adalah…",
              pilihan: [
                "Membiarkan request gagal tanpa penanganan",
                "Menambahkan retry pada panggilan async URLSession",
                "Menampilkan layar putih",
                "Menghapus cache setiap kali gagal",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Rilis ke App Store",
        ringkasan:
          "TestFlight, peninjauan, dan kesalahan yang paling sering ditolak.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Rilis ke App Store",
          deskripsi: "Menguji alur TestFlight, penyebab penolakan, dan uji perangkat.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Menurut modul ini, kapan aplikasi sebaiknya dikirim ke TestFlight?",
              pilihan: [
                "Tepat sebelum rilis produksi, menunggu semuanya sempurna",
                "Lebih awal, karena review internal butuh beberapa hari kalender",
                "Setelah pengguna pertama melapor crash",
                "Tidak perlu, cukup diuji di simulator",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Salah satu penyebab penolakan yang paling sering adalah…",
              pilihan: [
                "Meminta izin tanpa alasan yang jelas yang ditampilkan di layar",
                "Memakai ikon beresolusi tinggi",
                "Mendukung lebih dari satu ukuran layar",
                "Menulis deskripsi aplikasi dalam Bahasa Indonesia",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Metadata yang tidak cocok dengan isi aplikasi berisiko…",
              pilihan: [
                "Mempercepat peninjauan",
                "Menyebabkan penolakan saat review",
                "Tidak berpengaruh apa pun",
                "Otomatis diperbaiki Apple",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Sebelum rilis, pengujian minimal yang dianjurkan adalah…",
              pilihan: [
                "Satu ukuran layar pada satu versi OS saja",
                "Lebih dari satu ukuran layar dan lebih dari satu versi OS",
                "Hanya di perangkat terbaru",
                "Hanya lewat preview di Xcode",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Mobile Android
  // -------------------------------------------------------------------------
  {
    slug: "mobile-android-kotlin",
    judul: "Mobile Android dengan Kotlin dan Compose",
    deskripsi:
      "Kotlin dan Jetpack Compose untuk Android: null safety, coroutines, state dan recomposisi, arsitektur MVVM, sertaieljord yang bekerja saat jaringan buruk.",
    tags: ["android", "mobile", "kotlin", "compose", "developer"],
    level: "menengah",
    track: "web-dev",
    modul: [
      {
        judul: "Kotlin untuk Pemula",
        ringkasan:
          "Null safety, data class, dan coroutines.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Kotlin untuk Pemula",
          deskripsi: "Menguji null safety, data class, dan coroutines.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Bagaimana Kotlin menangani kemungkinan nilai null?",
              pilihan: [
                "Di type system: tipe non-null tidak boleh bernilai null, sehingga bug null jadi compile error",
                "Semua tipe boleh null dan baru ketahuan saat crash",
                "Dengan mengabaikan null sepenuhnya",
                "Hanya lewat anotasi dokumentasi",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Keuntungan `data class` adalah…",
              pilihan: [
                "Menghasilkan `equals`, `hashCode`, dan `copy` tanpa ditulis manual",
                "Tidak bisa diubah sama sekali",
                "Menyimpan datanya di database secara otomatis",
                "Menghapus kebutuhan akan null safety",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa fungsi utama coroutines di Kotlin?",
              pilihan: [
                "Menjalankan kode secara paralel dengan thread baru untuk setiap tugas",
                "Membuat kerja asynchronous terbaca berurutan tanpa memblokir thread",
                "Menggantikan semua class",
                "Menghapus kebutuhan penanganan error",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Menurut modul ini, `lateinit` dan operator `!!` sebaiknya…",
              pilihan: [
                "Dipakai di mana-mana untuk menghindari kompilasi error",
                "Dipakai hemat, karena keduanya memindahkan kegagalan ke runtime",
                "Tidak pernah ada di Kotlin",
                "Menggantikan null safety sepenuhnya",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "State dan Recomposisi",
        ringkasan:
          "Kenapa aplikasi Compose lambat, dan cara memangkasnya.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: State dan Recomposisi",
          deskripsi: "Menguji penyebab recomposisi berlebihan dan cara menguranginya.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Recomposisi terjadi ketika…",
              pilihan: [
                "Fungsi Compose dipanggil ulang karena state yang dibacanya berubah",
                "Aplikasi ditutup lalu dibuka lagi",
                "Perangkat diputar",
                "Gradle di-sync",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Cara memangkas recomposisi yang tidak perlu saat meneruskan data adalah…",
              pilihan: [
                "Meneruskan seluruh objek besar ke setiap Composable",
                "Meneruskan state lewat parameter primitive yang stabil, bukan objek besar",
                "Menyimpan semua state di satu file",
                "Membaca state di dalam `remember` tanpa kunci",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kapan `derivedStateOf` dipakai?",
              pilihan: [
                "Untuk nilai yang dihitung dari state lain dan ingin dihindari perhitungan ulang yang boros",
                "Untuk menyimpan data ke database",
                "Untuk memulai coroutine",
                "Untuk mengganti `ViewModel`",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Komponen yang tepat untuk menampilkan daftar panjang tanpa membebani memori adalah…",
              pilihan: ["`Column`", "`LazyColumn`", "`Row`", "`Box`"],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Arsitektur MVVM",
        ringkasan:
          "Pisahkan yang berubah cepat dari yang berubah lambat.",
        durasi_min: 270,
        kuis: {
          judul: "Kuis: Arsitektur MVVM",
          deskripsi: "Menguji pembagian tanggung jawab Composable, ViewModel, dan Repository.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Tanggung jawab utama sebuah Composable dalam MVVM adalah…",
              pilihan: [
                "Mengambil data langsung dari database",
                "Menampilkan state dan mengirim event, tanpa logika bisnis",
                "Menyimpan seluruh aturan bisnis",
                "Mengelola koneksi jaringan",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Keunggulan ViewModel pada Android adalah…",
              pilihan: [
                "Ia memegang state layar dan bertahan dari perubahan konfigurasi seperti rotasi",
                "Ia menggantikan Composable sepenuhnya",
                "Ia hanya bisa dipakai di activity",
                "Ia menyimpan data secara permanen di disk",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Composable yang memanggil repository secara langsung menandakan…",
              pilihan: [
                "Praktik yang dianjurkan",
                "Batas tanggung jawab yang salah, karena logika data bocor ke lapisan tampilan",
                "Optimasi performa",
                "Cara wajib mengakses jaringan di Compose",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Peran Repository dalam arsitektur ini adalah…",
              pilihan: [
                "Menjadi sumber data di balik antarmuka yang bisa diuji",
                "Menggambar tampilan ke layar",
                "Menangani event klik tombol",
                "Menentukan warna tema aplikasi",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Jaringan Buruk",
        ringkasan:
          "Cache, antrean offline, dan umpan balik yang jujur.",
        durasi_min: 390,
        kuis: {
          judul: "Kuis: Jaringan Buruk",
          deskripsi: "Menguji cache, antrean offline, dan kejujuran status sinkronisasi.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Pola yang dianjurkan saat koneksi tidak stabil adalah…",
              pilihan: [
                "Menunggu koneksi sempurna sebelum menampilkan apa pun",
                "Menampilkan data cache lebih dulu, lalu memperbarui di latar belakang",
                "Menampilkan layar kosong",
                "Memblokir aplikasi sampai data baru datang",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Bagaimana menangani aksi pengguna yang butuh jaringan saat sedang offline?",
              pilihan: [
                "Menolak aksi tersebut tanpa penjelasan",
                "Mengantrekannya dan mengirim ulang saat koneksi tersedia",
                "Menghapus aksi tersebut",
                "Menyimpannya selamanya tanpa pernah dikirim",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Menurut modul ini, umpan balik yang jujur kepada pengguna berarti…",
              pilihan: [
                "Menyembunyikan kenyataan bahwa data belum tersinkron",
                "Memberi tahu tanggal data dan berapa banyak yang belum tersinkron",
                "Selalu menampilkan ikon berputar",
                "Mengklaim data selalu terbaru",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa aplikasi yang hanya bekerja dengan koneksi sempurna dianggap bermasalah?",
              pilihan: [
                "Karena koneksi sempurna tidak pernah ada pada kondisi nyata, terutama di luar kota besar",
                "Karena jaringan selalu tersedia",
                "Karena cache dilarang",
                "Karena offline mode tidak berguna",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Backend Go
  // -------------------------------------------------------------------------
  {
    slug: "backend-golang-microservices",
    judul: "Backend Golang: Microservices di Produksi",
    deskripsi:
      "Golang untuk backend: goroutine, channel, context, batas antar layanan, observability, dan graceful shutdown. Banyak dipakai startup dan fintech Indonesia.",
    tags: [
      "golang",
      "go",
      "backend",
      "microservice",
      "api",
      "rest",
      "grpc",
      "systems",
      "scalable",
    ],
    level: "menengah",
    track: "web-dev",
    modul: [
      {
        judul: "Concurrency dengan Context",
        ringkasan:
          "Goroutine, channel, dan pembatalan yang benar.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: Concurrency dengan Context",
          deskripsi: "Menguji errgroup, penerusan context, dan WaitGroup.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Kesalahan paling mahal terkait context di Go adalah…",
              pilihan: [
                "Context tidak diteruskan, sehingga request yang sudah dibatalkan tetap berjalan dan memakai sumber daya",
                "Context diteruskan sebagai parameter pertama",
                "Context dipakai untuk menyimpan nilai request id",
                "Context dibuat dengan `context.Background()`",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Peran `errgroup.Group` adalah…",
              pilihan: [
                "Menjalankan operasi paralel dan membatalkan yang lain saat ada yang gagal",
                "Menggantikan `sync.Mutex`",
                "Menutup channel secara otomatis",
                "Menjalankan goroutine secara berurutan",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Kapan `sync.WaitGroup` lebih tepat daripada `errgroup`?",
              pilihan: [
                "Saat pembatalan tidak dibutuhkan dan hanya perlu menunggu semua goroutine selesai",
                "Saat butuh membatalkan operasi lain karena satu gagal",
                "Saat butuh meneruskan deadline",
                "Saat butuh menyimpan nilai di dalam goroutine",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Posisi yang benar untuk `context.Context` pada sebuah fungsi adalah…",
              pilihan: [
                "Sebagai parameter terakhir",
                "Sebagai parameter pertama, lalu diteruskan ke bawah",
                "Disimpan di variabel global",
                "Di dalam struct saja",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Batas Antar Layanan",
        ringkasan:
          "Kapan memecah itu benar, dan biayanya.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Batas Antar Layanan",
          deskripsi: "Menguji kapan memecah layanan dan biaya yang menyertainya.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Menurut modul ini, untuk tim kecil pilihan yang sering lebih tepat adalah…",
              pilihan: [
                "Langsung memecah ke banyak microservice",
                "Monolit, karena memecah terlalu dini menambah jumlah jaringan yang harus gagal dengan benar",
                "Satu layanan per tabel database",
                "Tanpa database sama sekali",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Konsekuensi pola satu database per layanan adalah…",
              pilihan: [
                "Transaksi terdistribusi menjadi sulit",
                "Semua layanan bisa langsung membaca tabel layanan lain",
                "Tidak ada dampak apa pun",
                "Latency jaringan menjadi nol",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa biaya nyata dari setiap panggilan jaringan antar layanan?",
              pilihan: [
                "Tidak ada biaya",
                "Memiliki latency dan bisa gagal, sehingga harus ditangani",
                "Selalu lebih cepat dari pemanggilan fungsi lokal",
                "Hanya berdampak pada biaya lisensi",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Yang lebih penting daripada jumlah layanan adalah…",
              pilihan: [
                "Batas yang jelas antar layanan",
                "Nama layanan yang pendek",
                "Jumlah bahasa pemrograman yang dipakai",
                "Banyaknya repo terpisah",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Observability",
        ringkasan:
          "Log, metrik, dan tracing untuk tiga pertanyaan berbeda.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Observability",
          deskripsi: "Menguji peran log, metrik, dan tracing.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Metrik paling tepat menjawab pertanyaan…",
              pilihan: [
                "Apa yang terjadi pada satu request tertentu",
                "Apakah sistem sehat secara keseluruhan, misalnya latensi p99, error rate, dan throughput",
                "Ke mana waktu habis pada satu request lintas layanan",
                "Siapa yang menulis kode terakhir",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Tracing berguna untuk…",
              pilihan: [
                "Menjawab ke mana waktu habis pada satu request yang melintasi banyak layanan",
                "Menghitung jumlah total request per hari",
                "Menampilkan pesan galat ke pengguna",
                "Menyimpan rahasia aplikasi",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Setiap log sebaiknya memuat…",
              pilihan: [
                "Hanya pesan bebas tanpa konteks",
                "Request id, nama operasi, dan durasi",
                "Kata sandi pengguna",
                "Seluruh isi database",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Menurut modul ini, sistem yang rusak biasanya pertama kali ketahuan dari…",
              pilihan: [
                "Pengguna, bukan dari dashboard — karena itu observability perlu disiapkan lebih awal",
                "Otomatis dari dashboard sebelum berdampak",
                "Tim keamanan",
                "Log berkala bulanan",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Graceful Shutdown",
        ringkasan:
          "Deployment yang tidak menjatuhkan request berjalan.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: Graceful Shutdown",
          deskripsi: "Menguji penanganan SIGTERM, drain request, dan timeout.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Sinyal apa yang ditangkap aplikasi Go untuk memulai graceful shutdown?",
              pilihan: ["`SIGKILL`", "`SIGTERM`", "`SIGSTOP`", "`SIGSEGV`"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Langkah pertama yang benar saat menerima sinyal penghentian adalah…",
              pilihan: [
                "Langsung menutup proses tanpa menunggu",
                "Berhenti menerima request baru, lalu beri waktu request berjalan selesai sebelum menutup listener",
                "Membuka koneksi database baru",
                "Mengabaikan sinyal tersebut",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa risiko bila pod dihentikan tanpa graceful shutdown?",
              pilihan: [
                "Koneksi terbuka bisa terpotong di tengah balasan",
                "Database otomatis terhapus",
                "Log tidak pernah dibuat",
                "Tidak ada risiko sama sekali",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Agar shutdown tidak menggantung selamanya, modul ini menyarankan…",
              pilihan: [
                "Menunggu tanpa batas waktu",
                "Timeout eksplisit untuk setiap request dan koneksi database",
                "Menonaktifkan semua timeout",
                "Mematikan proses secara paksa setiap kali",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Backend Java Spring Boot
  // -------------------------------------------------------------------------
  {
    slug: "backend-java-spring-boot",
    judul: "Backend Java dengan Spring Boot untuk Fintech",
    deskripsi:
      "Membangun REST API dengan Java dan Spring Boot: pemisahan lapisan, kontrak galat, transaksi, dan pengujian. Mengikuti pola yang dipakai bank dan payment gateway di Indonesia.",
    tags: [
      "java",
      "backend",
      "spring",
      "api",
      "rest",
      "microservice",
      "fintech",
      "payment",
      "banking",
    ],
    level: "menengah",
    track: "web-dev",
    modul: [
      {
        judul: "Struktur Proyek Spring Boot",
        ringkasan:
          "Controller, service, repository, dan alasan pemisahannya.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Struktur Proyek Spring Boot",
          deskripsi: "Menguji pembagian lapisan dan tanggung jawabnya.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Alasan utama memisahkan lapisan controller dan service adalah…",
              pilihan: [
                "Aturan gaya penulisan kode",
                "Agar logika bisnis bisa diuji tanpa menyalakan seluruh framework HTTP",
                "Supaya lebih banyak berkas dibuat",
                "Karena Spring mewajibkannya",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Tanggung jawab lapisan Controller adalah…",
              pilihan: [
                "Rute, validasi payload, dan pemilihan kode status",
                "Query langsung ke database",
                "Aturan bisnis dan transaksi",
                "Menyimpan konfigurasi database",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Lapisan Repository seharusnya…",
              pilihan: [
                "Memuat aturan bisnis",
                "Hanya berisi query ke database, tanpa aturan bisnis",
                "Menangani routing HTTP",
                "Menentukan kode status respons",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Menurut modul ini, pertanyaan tes yang berguna saat memutuskan letak sebuah aturan adalah…",
              pilihan: [
                "Bisa tidak kamu menguji aturan ini tanpa menyalakan server?",
                "Berapa baris kodenya?",
                "Siapa yang menulisnya?",
                "Apakah namanya pendek?",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "REST API yang Konsisten",
        ringkasan:
          "Status, validasi, dan satu bentuk galat untuk semua endpoint.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: REST API yang Konsisten",
          deskripsi: "Menguji pemilihan kode status dan kontrak galat.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Kode status yang tepat untuk payload tidak valid, beserta field dan alasannya, adalah…",
              pilihan: ["200", "400", "401", "500"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Perbedaan 401 dan 403 adalah…",
              pilihan: [
                "401 berarti belum masuk, 403 berarti sudah masuk tetapi tidak berhak",
                "401 berarti sudah masuk, 403 berarti belum masuk",
                "Keduanya identik",
                "401 untuk galat server, 403 untuk galat klien",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Kode status yang tepat untuk konflik seperti saldo tidak cukup adalah…",
              pilihan: ["400", "404", "409", "422"],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Mengapa validasi bentuk dan validasi aturan bisnis sebaiknya dipisahkan?",
              pilihan: [
                "Agar galat yang dihasilkan bisa ditindaklanjuti dan tidak tercampur",
                "Agar lebih banyak kode ditulis",
                "Karena keduanya selalu sama",
                "Agar respons lebih besar",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Transaksi Database",
        ringkasan:
          "Isolation, transaksi lintas tabel, dan dua jebakan yang mahal.",
        durasi_min: 270,
        kuis: {
          judul: "Kuis: Transaksi Database",
          deskripsi: "Menguji batas transaksi, self-invocation, dan idempotency.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Mengapa `@Transactional` pada self-invocation (memanggil method transaksional dari method lain di kelas yang sama) tidak bekerja?",
              pilihan: [
                "Karena pemanggilan internal melewati proxy, sehingga transaksi tidak dibuka sama sekali",
                "Karena anotasi hanya berlaku di controller",
                "Karena Spring tidak mendukung transaksi",
                "Karena database menolak transaksi lokal",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Pada kasus transfer, mengapa pengurangan saldo pengirim dan penambahan saldo penerima harus berada dalam satu transaksi?",
              pilihan: [
                "Agar tidak ada celah di mana nilai hilang di tengah jalan bila proses gagal",
                "Agar query lebih cepat",
                "Agar kode lebih pendek",
                "Karena database mewajibkannya",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa akibat `catch` yang menelan error di dalam method transaksional?",
              pilihan: [
                "Transaksi otomatis di-rollback dengan benar",
                "Commit bisa terjadi diam-diam sehingga data setengah jadi tersimpan",
                "Error diteruskan ke pengguna",
                "Tidak ada dampak apa pun",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Fungsi idempotency key pada transfer adalah…",
              pilihan: [
                "Mempercepat transfer",
                "Memastikan transfer yang sama tidak dieksekusi dua kali",
                "Mengenkripsi data transfer",
                "Menghapus riwayat transfer",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Menguji API",
        ringkasan:
          "Unit test service, integration test, dan tes endpoint.",
        durasi_min: 270,
        kuis: {
          judul: "Kuis: Menguji API",
          deskripsi: "Menguji pemilihan jenis tes dan biaya pemeliharaannya.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Unit test service biasanya memakai…",
              pilihan: [
                "Database sungguhan",
                "Mock repository, sehingga cepat dan menjaga aturan bisnis",
                "Server HTTP sungguhan",
                "Koneksi ke layanan eksternal",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Integration test dengan database sungguhan berguna untuk…",
              pilihan: [
                "Menangkap masalah pada query SQL",
                "Menguji tampilan antarmuka",
                "Menggantikan semua unit test",
                "Mengukur performa jaringan",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Tes endpoint tipis sebaiknya mencakup…",
              pilihan: [
                "Routing, validasi, dan kode status",
                "Seluruh aturan bisnis secara mendetail",
                "Hanya header respons",
                "Konfigurasi database",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Menurut modul ini, test yang flaky (sering gagal tanpa sebab jelas) sebaiknya…",
              pilihan: [
                "Dibiarkan karena tidak penting",
                "Diperbaiki atau dimatikan, karena tidak menambah keyakinan",
                "Dijalankan berulang sampai hijau",
                "Ditambahkan lebih banyak",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Software Engineer Fundamentals
  // -------------------------------------------------------------------------
  {
    slug: "software-engineer-fundamentals",
    judul: "Software Engineer: Fundamentals Ngaktual",
    deskripsi:
      "Fondasi kerja software engineer yang hampir selalu diminta lowongan: version control, algoritma, dan cara kerja sama dalam tim engineering. Contoh diambil dari fintech dan e-commerce Indonesia.",
    tags: [
      "software",
      "engineer",
      "engineering",
      "sde",
      "developer",
      "programming",
      "git",
      "algorithms",
    ],
    level: "dasar",
    track: "web-dev",
    modul: [
      {
        judul: "Version Control dengan Git",
        ringkasan:
          "Branch, commit, dan pull request yang tidak membingungkan.",
        durasi_min: 180,
        kuis: {
          judul: "Kuis: Version Control dengan Git",
          deskripsi: "Menguji konvensi branch, pesan commit, dan penanganan konflik.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Pola nama branch yang dianjurkan modul ini adalah…",
              pilihan: [
                "Nama acak agar unik",
                "Prefiks seperti `feat`, `fix`, atau `chore`, lalu deskripsi singkat",
                "Tanggal saja",
                "Nama orang yang mengerjakan",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Pesan commit yang baik menjelaskan…",
              pilihan: [
                "Kenapa perubahan dilakukan, bukan sekadar apa yang berubah",
                "Daftar lengkap baris yang diubah",
                "Nama reviewer",
                "Nomor telepon penulis",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Cara menyelesaikan konflik merge yang benar adalah…",
              pilihan: [
                "Memilih sisi sendiri tanpa membaca sisi lain",
                "Memahami kedua sisi konflik, lalu menyusun hasil yang benar",
                "Menghapus seluruh berkas yang berkonflik",
                "Membatalkan semua pekerjaan",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Sebuah nama branch dianggap belum berhasil bila…",
              pilihan: [
                "Orang lain tidak bisa menebak isi branch dari namanya",
                "Namanya terlalu pendek",
                "Tidak memakai nomor tiket",
                "Ditulis dengan huruf kecil",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Algoritma dan Struktur Data",
        ringkasan:
          "Pola yang benar-benar muncul di wawancara kerja.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Algoritma dan Struktur Data",
          deskripsi: "Menguji pola dua pointer, hash map, dan kompleksitas.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Teknik dua pointer pada array terurut biasanya memakai…",
              pilihan: [
                "Dua indeks yang bergerak dari ujung yang berbeda untuk mencari pasangan atau rentang",
                "Dua loop bersarang yang memeriksa semua pasangan",
                "Menyortir ulang array setiap langkah",
                "Rekursi tanpa kondisi berhenti",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Kompleksitas waktu dua pointer pada array berurut (satu kali lintas) adalah…",
              pilihan: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Struktur data yang tepat untuk lookup frekuensi atau pasangan nilai adalah…",
              pilihan: ["Stack", "Hash map", "Queue", "Linked list"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Menurut modul ini, sebelum menulis kode solusi sebaiknya…",
              pilihan: [
                "Langsung menulis kode secepat mungkin",
                "Menuliskan kompleksitas waktu dan ruang yang dituju terlebih dahulu",
                "Menghafal solusi yang pernah dilihat",
                "Menunggu sampai waktu ujian habis",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Kode yang Bisa Dirawat",
        ringkasan:
          "Fungsi kecil, nama jelas, batas yang jelas.",
        durasi_min: 180,
        kuis: {
          judul: "Kuis: Kode yang Bisa Dirawat",
          deskripsi: "Menguji sinyal kode yang sulit dibaca dan cara memperbaikinya.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Fungsi yang panjangnya lebih dari sekitar 50 baris biasanya menandakan…",
              pilihan: [
                "Dua tanggung jawab yang belum dipisahkan",
                "Fungsi tersebut terlalu cepat",
                "Kode tersebut wajib dihapus",
                "Kompilernya salah",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Nama variabel seperti `data` atau `temp` bermasalah karena…",
              pilihan: [
                "Terlalu pendek untuk diketik",
                "Tidak menjelaskan apa pun tentang isi atau perannya",
                "Tidak boleh dipakai di Java",
                "Selalu menyebabkan error",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Komentar yang berguna adalah yang menjelaskan…",
              pilihan: [
                "Bagaimana kode bekerja baris per baris",
                "Mengapa keputusan itu diambil",
                "Siapa yang menulis kode",
                "Tanggal kode dibuat",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa kode yang susah dibaca dianggap masalah biaya?",
              pilihan: [
                "Karena setiap pembaca berikutnya, termasuk penulisnya nanti, harus membayar untuk memahaminya",
                "Karena kode panjang dikenai biaya lisensi",
                "Karena kompiler lebih lambat",
                "Karena repository jadi penuh",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Kerja Sama dalam Tim",
        ringkasan:
          "Code review, estimasi, dan umpan balik yang jalan.",
        durasi_min: 180,
        kuis: {
          judul: "Kuis: Kerja Sama dalam Tim",
          deskripsi: "Menguji cara menulis code review yang membantu.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Pujian dalam code review sebaiknya…",
              pilihan: [
                "Bersifat umum agar tidak menyakiti hati",
                "Bersifat spesifik, menyebut bagian yang memang baik",
                "Dihilangkan sepenuhnya",
                "Diberikan hanya untuk senior",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Dalam code review, hal yang wajib diperbaiki sebaiknya…",
              pilihan: [
                "Dicampur dengan preferensi pribadi",
                "Dipisahkan dari yang hanya preferensi",
                "Ditulis dalam huruf kapital semua",
                "Disampaikan lewat obrolan pribadi saja",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Cara menyampaikan saran perbaikan yang dianjurkan adalah…",
              pilihan: [
                "Memberi perintah langsung",
                "Menawarkan opsi, bukan perintah",
                "Menolak pull request tanpa penjelasan",
                "Mengubah kode orang lain sendiri",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Menurut modul ini, review yang paling berguna adalah yang…",
              pilihan: [
                "Menunjuk letak masalah saja",
                "Menjelaskan alasan di balik perubahan yang disarankan",
                "Memberi skor penilaian",
                "Menghitung jumlah baris kode",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },
];
