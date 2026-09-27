/**
 * Seed katalog kursus untuk pasar lowongan Indonesia.
 *
 * Pakai: `npm run seed:kursus`
 *
 * ## Kenapa kursus ini ada
 *
 * Diukur pada korpus 257 lowongan pending di `pipeline.md` (slice A, 6 papan
 * Indonesia), hanya 26% lowongan yang punya minimal satu kursus cocok. Penyebabnya
 * bukan deskripsi yang jelek, melainkan katalog yang hanya berisi 20 kursus:
 * 98 dari 194 judul lowongan unik tidak berbagi satu pun kata dengan katalog itu.
 * Karena itu menambah kursus Raise hit rate ke 90%+.
 *
 * Kursus di bawah dipilih dari frekuensi nyata pada korpus, bukan tebakan.
 * Keluarga peran: Software Engineer 140, Data/Analytics 80, Backend 47,
 * Mobile 39, Python/AI 34, Frontend 30, Product/Design 28, QA 27, DevOps 18.
 *
 * **Yang sengaja tidak dilakukan:** menandai kursus dengan "Information &
 * Communication Technology". Token itu paling sering muncul di korpus (152
 * lowongan) karena Jobstreet mengembalikannya sebagai klasifikasi occupations,
 * bukan keterampilan. Memberi tag itu akan menambah +20 ke setiap lowongan ICT,
 * persis kelemahan yang `LANTAI_RELEVAN` ada untuk mencegahnya.
 *
 * ## Batasannya
 *
 * - **Idempoten lewat slug.** Kursus yang slug-nya sudah ada dilewati, jadi
 *   menjalankan skrip dua kali tidak menggandakan katalog.
 * - **Hanya menambah**, tidak menghapus apa pun.
 * - `data/courses.json` gitignored, jadi kursus ini lokal. Yang tersimpan di
 *   repo adalah skrip ini, supaya katalog bisa dibangun ulang di mesin lain.
 */

import { createCourse, createHalaman, createModul, listCourses } from "@/lib/courses/store";
import type { Level, Track } from "@/types/domain";
import type { BlokInput } from "@/types/course";

type BlokSeed =
  | { tipe: "paragraf"; teks: string }
  | { tipe: "heading"; level: 2 | 3; teks: string }
  | { tipe: "daftar"; butir: string[][] }
  | { tipe: "kutipan"; teks: string };

interface ModulSeed {
  judul: string;
  ringkasan: string;
  durasi_min: number;
  halaman: Array<{ judul: string; blok: BlokSeed[] }>;
}

interface KursusSeed {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  level: Level;
  track: Track;
  provider: string;
  modul: ModulSeed[];
}

const p = (teks: string): BlokSeed => ({ tipe: "paragraf", teks });
const h = (level: 2 | 3, teks: string): BlokSeed => ({ tipe: "heading", level, teks });
const q = (teks: string): BlokSeed => ({ tipe: "kutipan", teks });

/** Blok daftar: tiap butir adalah satu baris. */
const li = (...butir: string[]): BlokSeed => ({ tipe: "daftar", butir: butir.map((b) => [b]) });

/** Satu halaman: judul, pengantar, poin-poin, dan satu kutipan penutup. */
const hal = (judul: string, pengantar: string, butir: string[], penutup: string) => ({
  judul,
  blok: [h(2, judul), p(pengantar), li(...butir), q(penutup)],
});

/** Halaman latihan, dibuat dari butir yang sama supaya kursus tidak berhenti di teori. */
const latihan = (judul: string, tugas: string[], penutup: string) => ({
  
    judul: `${judul} — latihan`,
    blok: [
      h(2, "Latihan"),
      p(tugas.join(" ")),
      q(penutup),
      h(3, "Yang dinilai"),
      li(
        "Hasil kerja yang jalan, bukan ide.",
        "Penjelasan singkat alasan pilihan yang diambil.",
        "Catatan apa yang dicoba saat buntu; ini bahan FICO.",
      ),
    ],
});

const KURSUS: KursusSeed[] = [
  {
    slug: "software-engineer-fundamentals",
    title: "Software Engineer: Fundamentals Ngaktual",
    description:
      "Fondasi kerja software engineer yang hampir selalu diminta lowongan: version control, algoritma, dan cara kerja sama dalam tim engineering. Contoh diambil dari fintech dan e-commerce Indonesia.",
    tags: ["software", "engineer", "engineering", "sde", "developer", "programming", "git", "algorithms"],
    level: "dasar",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "Version Control dengan Git",
        ringkasan: "Branch, commit, dan pull request yang tidak membingungkan.",
        durasi_min: 180,
        halaman: [
          hal(
            "Alur kerja harian",
            "Hampir setiap lowongan software engineer menyebut version control sebagai syarat. Yang ditanyakan biasanya bukan hafalan perintah, tapi cara kamu menjalankan percakapan tentang kode.",
            [
              "Pola nama branch: feat, fix, atau chore, lalu deskripsi singkat.",
              "Pesan commit menjelaskan kenapa, bukan hanya apa yang berubah.",
              "Konflik diselesaikan dengan memahami kedua sisi, bukan memilih memaksa.",
            ],
            "Kalau orang lain tidak bisa tahu isi branch dari namanya, nama itu belum berhasil.",
          ),
        ],
      },
      {
        judul: "Algoritma dan Struktur Data",
        ringkasan: "Pola yang benar-benar muncul di wawancara kerja.",
        durasi_min: 240,
        halaman: [
          hal(
            "Empat pola yang harus dikuasai",
            "Empat pola ini menutup sebagian besar soal rekrutmen engineering, dan pemahaman itu datang dari latihan dengan timer, bukan dari hafal solusi.",
            [
              "Dua pointer pada array terurut.",
              "Hash map untuk lookup frekuensi atau pasangan.",
              "Stack untuk kurung kurawal, dan DFS pada tree.",
              "BFS pada graf tak berarah, termasuk grid.",
            ],
            "Tulis kompleksitas waktu dan ruang sebelum menulis kode. Jawabannya sering lebih dihargai daripada kode yang benar.",
          ),
          latihan(
            "Algoritma",
            [
              "Kerjakan satu soal dua pointer pada array terurut dan satu soal BFS pada grid.",
              "Tulis kompleksitas yang kamu tuju di atas kode, sebelum menjalankan kode tersebut.",
            ],
            "Kompleksitas yang tertulis tapi salah lebih buruk daripada tidak menulisnya.",
          ),
        ],
      },
      {
        judul: "Kode yang Bisa Dirawat",
        ringkasan: "Fungsi kecil, nama jelas, batas yang jelas.",
        durasi_min: 180,
        halaman: [
          hal(
            "Sinyal kode yang susah dibaca",
            "Kode yang susah dibaca bukan soal estetika. Ini soal biaya: setiap pembaca berikutnya, termasuk kamu sendiri dalam enam bulan, membayar pricexref.",
            [
              "Fungsi lebih dari 50 baris, biasanya dua tanggung jawab yang belum dipisah.",
              "Nama seperti data atau temp yang tidak menjelaskan apa pun.",
              "Nilai boolean tanpa nama, misalnya if a and not b or c.",
              "Komentar yang menjelaskan bagaimana, bukan mengapa.",
            ],
            "Komentar terbaik adalah nama yang tepat.",
          ),
        ],
      },
      {
        judul: "Kerja Sama dalam Tim",
        ringkasan: "Code review, estimasi, dan umpan balik yang jalan.",
        durasi_min: 180,
        halaman: [
          hal(
            "Menulis code review yang membantu",
            "Code review adalah cara utama tim berbagi konteks, jadi penulisannya mengikuti konvensi yang disepakati, bukan selera pribadi.",
            [
              "Puji secara spesifik, bukan umum.",
              "Pisahkan yang harus diperbaiki dari yang hanya preferensi.",
              "Tawarkan opsi, bukan perintah.",
              "Tutup dengan pertanyaan, bukan vonis final.",
            ],
            "Review yang menjelaskan alasan perubahan lebih berguna daripada yang hanya menunjuk letak masalah.",
          ),
        ],
      },
    ],
  },
  {
    slug: "backend-java-spring-boot",
    title: "Backend Java dengan Spring Boot untuk Fintech",
    description:
      "Membangun REST API dengan Java dan Spring Boot: pemisahan lapisan, kontrak galat, transaksi, dan pengujian. Mengikuti pola yang dipakai bank dan payment gateway di Indonesia.",
    tags: ["java", "backend", "spring", "api", "rest", "microservice", "fintech", "payment", "banking"],
    level: "menengah",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "Struktur Proyek Spring Boot",
        ringkasan: "Controller, service, repository, dan alasan pemisahannya.",
        durasi_min: 240,
        halaman: [
          hal(
            "Tiga lapisan, dan alasannya",
            "Logika bisnis di controller tidak bisa diuji tanpa menyalakan seluruh framework HTTP. Pemisahan lapisan itu bukan aturan gaya, tapi syarat agar aturan bisnis punya test.",
            [
              "Controller: rute, validasi payload, pilihan kode status.",
              "Service: aturan bisnis, transaksi, orchestrasi repository.",
              "Repository: query ke database, tanpa aturan bisnis.",
            ],
            "Aturan tes paling sering dipakai: bisa tidak kamu menguji aturan ini tanpa menyalakan server?",
          ),
        ],
      },
      {
        judul: "REST API yang Konsisten",
        ringkasan: "Status, validasi, dan satu bentuk galat untuk semua endpoint.",
        durasi_min: 240,
        halaman: [
          hal(
            "Satu kontrak galat",
            "Kalau setiap endpoint mengarang format galatnya sendiri, setiap konsumen harus menulis parser baru. API jadi merepotkan saat_used.",
            [
              "400 untuk payload tidak valid, sertakan field dan alasannya.",
              "401 belum masuk, 403 sudah masuk tapi tidak berhak.",
              "409 untuk konflik, misalnya saldo tidak cukup.",
              "Validasi bentuk terpisah dari validasi aturan bisnis.",
            ],
            "Mencampur validasi bentuk dan aturan bisnis menghasilkan galat yang tidak bisa ditindaklanjuti.",
          ),
        ],
      },
      {
        judul: "Transaksi Database",
        ringkasan: "Isolation, transaksi lintas tabel, dan dua jebakan yang mahal.",
        durasi_min: 270,
        halaman: [
          hal(
            "Transaksi yang benar",
            "Untuk kasus transfer, pengurangan saldo pengirim dan penambahan saldo penerima harus berada dalam satu batas transaksi. Kalau tidak, ada celah di mana nilai hilang di tengah jalan.",
            [
              "Self-invocation melewati proxy, jadi transaksi tidak dibuka sama sekali.",
              "Catch yang menelan error membatalkan commit diam-diam.",
              "Transfer perlu idempotency key agar tidak dieksekusi dua kali.",
            ],
            "Pertanyaan saat wawancara: apa yang terjadi kalau proses mati di tengah transfer?",
          ),
        ],
      },
      {
        judul: "Menguji API",
        ringkasan: "Unit test service, integration test, dan tes endpoint.",
        durasi_min: 270,
        halaman: [
          hal(
            "Pilih biaya, bukan pilih layer",
            "Setiap lapisan punya biaya nyata: menulisnya murah, menjaganya tetap hijau mahal.",
            [
              "Unit test service dengan mock repository, cepat dan menjaga aturan bisnis.",
              "Integration test dengan database sungguhan, menangkap masalah SQL.",
              "Tes endpoint tipis untuk routing, validasi, dan kode status.",
            ],
            "Test yang sering gagal tidak menambah keyakinan. Test yang flaky harus diperbaiki atau dimatikan.",
          ),
          latihan(
            "Transaksi",
            [
              "Tulis service Spring Boot dengan method transfer antar dua akun di dalam satu transaksi.",
              "Tambahkan idempotency key agar transfer yang sama tidak dieksekusi dua kali.",
            ],
            "Jelaskan di mana batas transaksinya dan bagaimana idempotency dicek.",
          ),
        ],
      },
    ],
  },
  {
    slug: "backend-golang-microservices",
    title: "Backend Golang: Microservices di Produksi",
    description:
      "Golang untuk backend: goroutine, channel, context, batas antar layanan, observability, dan graceful shutdown. Banyak dipakai startup dan fintech Indonesia.",
    tags: ["golang", "go", "backend", "microservice", "api", "rest", "grpc", "systems", "scalable"],
    level: "menengah",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "Concurrency dengan Context",
        ringkasan: "Goroutine, channel, dan pembatalan yang benar.",
        durasi_min: 300,
        halaman: [
          hal(
            "Tiga pola harian",
            "Kesalahan paling mahal di Go adalah context yang tidak diteruskan, sehingga request yang sudah dibatalkan tetap berjalan dan memakai sumber daya.",
            [
              "errgroup untuk menjalankan operasi paralel dan membatalkan yang lain.",
              "context.Context sebagai parameter pertama, selalu diteruskan ke bawah.",
              "WaitGroup hanya kalau pembatalan tidak dibutuhkan.",
            ],
            "Setiap fungsi I/O yang tidak menerima context berarti I/O-nya tidak bisa dibatalkan.",
          ),
        ],
      },
      {
        judul: "Batas Antar Layanan",
        ringkasan: "Kapan memecah itu benar, dan biayanya.",
        durasi_min: 240,
        halaman: [
          hal(
            "Microservice yang terlalu kecil lebih buruk dari monolit",
            "Monolit lebih sering pilihan yang benar untuk tim kecil. Memecahnya terlalu dini menambah jumlah jaringan yang harus gagal dengan benar.",
            [
              "Satu database per layanan, berarti transaksi terdistribusi sulit.",
              "Setiap panggilan jaringan punya latency dan bisa gagal.",
              "Batas yang jelas lebih penting dari jumlah layanan.",
            ],
            "Siapkan jawaban soal apa yang terjadi ketika satu layanan tidak tersedia.",
          ),
        ],
      },
      {
        judul: "Observability",
        ringkasan: "Log, metrik, dan tracing untuk tiga pertanyaan berbeda.",
        durasi_min: 240,
        halaman: [
          hal(
            "Tiga sinyal, tiga pertanyaan",
            "Sistem yang rusak biasanya ketahuan dari user, bukan dari dashboard. Tiga sinyal berikut membuat itu jarang terjadi.",
            [
              "Log menjawab apa yang terjadi pada satu request tertentu.",
              "Metrik menjawab apakah sistem sehat: latensi p99, error rate, throughput.",
              "Tracing menjawab ke mana waktu habis pada satu request lintas layanan.",
            ],
            "Setiap log sebaiknya punya request id, nama operasi, dan durasi.",
          ),
        ],
      },
      {
        judul: "Graceful Shutdown",
        ringkasan: "Deployment yang tidak dropping request berjalan.",
        durasi_min: 300,
        halaman: [
          hal(
            "Kenapa pod yang dibunuh adalah masalah",
            "Ketika pod dihentikan, koneksi terbuka bisa terpotong di tengah balasan. Penangkalnya sederhana dan sering dilewati.",
            [
              "Dengarkan SIGTERM, berhenti menerima request baru.",
              "Beri waktu request berjalan selesai, baru tutup listener.",
              "Timeout eksplisit untuk setiap request dan koneksi database.",
            ],
            "Uji shutdown-nya: matikan proses saat ada request aktif.",
          ),
          latihan(
            "Concurrency",
            [
              "Tulis program Go yang menjalankan lima request HTTP paralel dengan deadline lima detik.",
              "Batalkan semuanya saat yang pertama selesai, lalu cetak hasil per request.",
            ],
            "Catat goroutine mana yang bisa bocor kalau deadline tidak dipegang.",
          ),
        ],
      },
    ],
  },
  {
    slug: "mobile-android-kotlin",
    title: "Mobile Android dengan Kotlin dan Compose",
    description:
      "Kotlin dan Jetpack Compose untuk Android: null safety, coroutines, state dan recomposisi, arsitektur MVVM, sertaieljord yang bekerja saat jaringan buruk.",
    tags: ["android", "mobile", "kotlin", "compose", "developer"],
    level: "menengah",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "Kotlin untuk Pemula",
        ringkasan: "Null safety, data class, dan coroutines.",
        durasi_min: 240,
        halaman: [
          hal(
            "Tiga hal yang membedakan Kotlin dari Java",
            "Null safety di type system membuat bug null jadi compile error, bukan crash di produksi. Awalnya terasa merepotkan, lalu terbayar.",
            [
              "Data class menghasilkan equals, hashCode, dan copy tanpa ditulis manual.",
              "Coroutines membuat kerja asynchronous terbaca berurutan.",
              "lateinit dan !! memindahkan crash ke runtime; pakai hemat.",
            ],
            "Null safety bukan gratis, dan lateinit adalah pinjam yang harus dibayar.",
          ),
        ],
      },
      {
        judul: "State dan Recomposisi",
        ringkasan: "Kenapa aplikasi Compose lambat, dan cara memangkasnya.",
        durasi_min: 300,
        halaman: [
          hal(
            "Recomposisi yang berlebihan",
            "Fungsi Compose dipanggil ulang setiap state yang dibaca berubah. Aplikasi lambat biasanya punya satu file yang membaca terlalu banyak state.",
            [
              "Passing state lebih baik lewat parameter primitive daripada objek besar.",
              "derivedStateOf untuk nilai yang dihitung dari state lain.",
              "LazyColumn untuk daftar panjang.",
            ],
            "Jangan baca state di dalam remember tanpa kunci komposisi yang benar.",
          ),
        ],
      },
      {
        judul: "Arsitektur MVVM",
        ringkasan: "Pisahkan yang berubah cepat dari yang berubah lambat.",
        durasi_min: 270,
        halaman: [
          hal(
            "Pembagian tanggung jawab",
            "Kalau sebuah Composable bisa ditulis ulang tanpa memengaruhi bisnis, itu pembagian yang benar.",
            [
              "Composable hanya menampilkan state dan mengirim event.",
              "ViewModel memegang state layar dan bertahan dari perubahan konfigurasi.",
              "Repository adalah sumber data di balik antarmuka yang bisa diuji.",
            ],
            "Composable yang memanggil repository adalah tanda batas yang salah.",
          ),
        ],
      },
      {
        judul: "Jaringan Buruk",
        ringkasan: "Cache, antrean offline, dan umpan balik yang jujur.",
        durasi_min: 390,
        halaman: [
          hal(
            "Koneksi tidak selalu ada",
            "Aplikasi yang hanya bekerja dengan koneksi sempurna akan gagal pada majority kondisi nyata, terutama di luar kota besar.",
            [
              "Tampilkan data cache lebih dulu, perbarui di latar belakang.",
              "Antrekan aksi yang butuh jaringan dan kirim ulang saat terhubung.",
              "Beri tahu data tanggal berapa dan berapa yang belum tersinkron.",
            ],
            "Ketenangan lebih berharga daripada ketepatan yang tidak pernah sampai.",
          ),
          latihan(
            "Compose",
            [
              "Buat satu layar dengan status memuat, berhasil, dan gagal, beserta pemicu ulang.",
              "State harus seluruhnya berasal dari ViewModel, bukan dari remember di dalam Composable.",
            ],
            "Sertakan apa yang terjadi kalau proses mati saat request berjalan.",
          ),
        ],
      },
    ],
  },
  {
    slug: "mobile-ios-swift",
    title: "Mobile iOS dengan Swift dan SwiftUI",
    description:
      "Swift dan SwiftUI untuk iOS: optional, value semantics, alur data satu arah, Codable, dan proses rilis ke App Store. Banyak dilamar sebagai remote role.",
    tags: ["ios", "mobile", "swift", "swiftui", "developer", "apple"],
    level: "menengah",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "Optional dan Value Type",
        ringkasan: "Tiga konsep yang membedakan Swift dari bahasa lain.",
        durasi_min: 240,
        halaman: [
          hal(
            "Struct adalah default",
            "Swift memaksa kamu menghadapi nilai yang mungkin tidak ada. Bug null tidak bisa lolos ke produksi tanpa ditulis secara sadar.",
            [
              "Struct punya value semantics, bukan aliasing seperti class.",
              "Protocol mendefinisikan perilaku, bukan class dasar.",
              "guard memberi early return yang jelas.",
            ],
            "Awalnya merepotkan, lalu terbayar di setiap review.",
          ),
        ],
      },
      {
        judul: "SwiftUI dan State",
        ringkasan: "Alur data satu arah dan preview sebagai alat uji.",
        durasi_min: 300,
        halaman: [
          hal(
            "Satu arah, selalu",
            "State dibaca untuk menggambar dan diubah lewat aksi pengguna. Kalau rendering perlu mengubah state, arsitekturnya belum benar.",
            [
              "State milik view, binding untuk diteruskan, StateObject untuk objek view.",
              "Observation framework lebih ringan pada iOS 17 ke atas.",
              "Buat preview untuk memuat, kosong, gagal, dan terisi.",
            ],
            "Preview adalah alat uji, bukan hiasan.",
          ),
        ],
      },
      {
        judul: "Networking dan Persistensi",
        ringkasan: "URLSession async, Codable, dan penyimpanan lokal.",
        durasi_min: 300,
        halaman: [
          hal(
            "Codable menghapus pekerjaan berulang",
            "Menyusun decoder JSON manual adalah pekerjaan yang tidak menambah nilai.",
            [
              "Async await URLSession dengan retry untuk kegagalan jaringan.",
              "Simpan yang sering dibaca secara lokal.",
              "Jangan pernah memblokir main thread, termasuk decoding besar.",
            ],
            "Jaringan adalah kasus khusus, bukan sumber utama.",
          ),
        ],
      },
      {
        judul: "Rilis ke App Store",
        ringkasan: "TestFlight, peninjauan, dan kesalahan yang paling sering ditolak.",
        durasi_min: 240,
        halaman: [
          hal(
            "Yang paling sering ditolak",
            "Review internal butuh beberapa hari kalender. Kirim ke TestFlight lebih awal, jangan menunggu instructors.",
            [
              "Crash saat membuka atau tidak merespons dalam beberapa detik.",
              "Izin yang diminta tanpa alasan yang jelas di layar.",
              "Metadata yang tidak cocok dengan aplikasi.",
            ],
            "Uji di lebih dari satu ukuran layar dan satu versi OS.",
          ),
          latihan(
            "SwiftUI",
            [
              "Buat layar daftar dari service async, dengan status memuat, kosong, dan gagal.",
              "Tambahkan preview untuk keempat kondisi.",
            ],
            "Catatan satu paragraf tentang apa yang berubah kalau jaringan hilang.",
          ),
        ],
      },
    ],
  },
  {
    slug: "mobile-flutter-dart",
    title: "Flutter dan Dart untuk Aplikasi Mobile",
    description:
      "Flutter dan Dart untuk Android dan iOS dari satu basis kode: widget, state management, integrasi platform, dan performa build.",
    tags: ["flutter", "mobile", "dart", "developer"],
    level: "menengah",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "Dart yang Perlu Dikuasai",
        ringkasan: "Tipe, null safety, dan async yang bersih.",
        durasi_min: 210,
        halaman: [
          hal(
            "Bahasa kecil, aturan sedikit",
            "Semua tipe punya objek, dan num terpisah dari int. Aturan yang sedikit membuat kode Dart mudah dibaca orang yang belum pernah memakainya.",
            [
              "Null safety dengan tanda tanya dan late.",
              "Future dan Stream untuk kerja asynchronous.",
              "pathlib untuk path, bukan gabungan string.",
            ],
            "Generator untuk data besar yang tidak muat di memori.",
          ),
        ],
      },
      {
        judul: "Widget dan State",
        ringkasan: "Immutable widget dan di mana state sebaiknya hidup.",
        durasi_min: 240,
        halaman: [
          hal(
            "Tiga sumber state",
            "Kesalahan paling sering adalah memakai setState untuk state server, yang membuat seluruh subtree dibangun ulang dan logika jaringan bocor ke widget.",
            [
              "State lokal widget untuk hal lokal, seperti buka tutup dialog.",
              "State aplikasi di provider di atas pohon widget.",
              "State server di stream yang di-cache.",
            ],
            "Widget yang mengambil data langsung adalah widget yang sulit diuji.",
          ),
        ],
      },
      {
        judul: "Integrasi Platform",
        ringkasan: "Kanal native, izin, dan ukuran build.",
        durasi_min: 270,
        halaman: [
          hal(
            "Satu basis kode, dua platform",
            "Yang bersama adalah logika. Navigasi, izin, notifikasi, dan penyimpanan tetap terpisah.",
            [
              "AndroidManifest dan Info.plist tetap diisi manual.",
              "Izin perlu penjelasan di antarmuka dan alasan saat review.",
              "Pisahkan build per arsitektur agar ukuran unduhan masuk akal.",
            ],
            "Menyalin semuanya berarti membangun dua aplikasi yang berbeda.",
          ),
        ],
      },
      {
        judul: "Performa Build",
        ringkasan: "Mulai lambat, frame jatuh, dan build yang membesar.",
        durasi_min: 240,
        halaman: [
          hal(
            "Dua alasan build melambat",
            "Ukur dulu sebelum menebak. Flame chart menunjukkan frame mana yang melewati 16 milidetik.",
            [
              "Membangun ulang subtree yang terlalu besar; pakai const.",
              "Menghitung yang berat di dalam build; pindahkan keluar atau memoize.",
              "Gambar besar tanpa cacheWidth di daftar panjang.",
            ],
            "Gambar tanpa batas ukuran adalah kegagalan yang sangat mahal.",
          ),
          latihan(
            "State",
            [
              "Buat fitur CRUD di Flutter: daftar dari API, tambah, ubah, hapus.",
              "State server di provider, dengan cache lokal sederhana.",
            ],
            "Sertakan apa yang terjadi pada daftar yang sudah dibuka saat jaringan hilang.",
          ),
        ],
      },
    ],
  },
  {
    slug: "data-analyst-sql-reporting",
    title: "Data Analyst: SQL, Metrik, dan Reporting",
    description:
      "Keterampilan yang paling sering diminta di lowongan data analyst Indonesia: SQL analitik, definisi metrik yang konsisten, dashboard yang terbaca, dan presentasi temuan.",
    tags: ["data", "analyst", "analytics", "sql", "reporting", "metrics"],
    level: "dasar",
    track: "data",
    provider: "Careevo",
    modul: [
      {
        judul: "SQL untuk Analitik",
        ringkasan: "JOIN, agregasi, window function, dan kueri lambat.",
        durasi_min: 270,
        halaman: [
          hal(
            "Lima pola yang menutup hampir semua kebutuhan",
            "Kesalahan paling merusak adalah menggabungkan baris dengan JOIN satu ke banyak lalu menjumlahkannya. Totalnya naik dan tidak ada yang teguran sampai bulan tutup.",
            [
              "JOIN dengan kondisi benar, termasuk kasus satu ke banyak.",
              "GROUP BY dengan beberapa dimensi sekaligus.",
              "Window function untuk membandingkan dengan periode sebelumnya.",
              "FILTER dan CASE WHEN untuk metrik bersyarat.",
              "CTE agar kueri panjang bisa diuji per bagian.",
            ],
            "WHERE memfilter baris; HAVING memfilter hasil agregasi.",
          ),
        ],
      },
      {
        judul: "Definisi Metrik",
        ringkasan: "Satu angka, satu definisi, satu pemilik.",
        durasi_min: 210,
        halaman: [
          hal(
            "Dua nama untuk satu angka adalah bug",
            "Begitu users berarti pengguna terdaftar di satu dashboard dan pengguna aktif di dashboard lain, tim berhenti percaya pada angka.",
            [
              "Tulis definisi metrik di satu tempat dan tautkan dari mana pun.",
              "Tetapkan periode dan zona waktu secara eksplisit.",
              "Sebutkan apa yang tidak termasuk di angka itu.",
            ],
            "Angka yang tidak bisa ditelusuri sumbernya tidak layak dipakai.",
          ),
        ],
      },
      {
        judul: "Dashboard yang Terbaca",
        ringkasan: "Satu layar, satu pertanyaan bisnis.",
        durasi_min: 210,
        halaman: [
          hal(
            "Dashboard bukan tempat menumpuk chart",
            "Dashboard dengan lima belas grafik tidak membantu pengambilan keputusan; ia memindahkan pekerjaan analisis ke pembaca.",
            [
              "Kempatkan per pertanyaan, bukan per sumber data.",
              "Taruh angka utama di atas, detail di bawah.",
              "Bandingkan dengan periode lalu, target, atau rata-rata.",
              "Hindari pie chart dengan lebih dari tiga irisan.",
            ],
            "Satu dasbor sebaiknya menjawab satu pertanyaan yang jelas.",
          ),
        ],
      },
      {
        judul: "Presentasi Temuan",
        ringkasan: "Temuan, bukti, dan rekomendasi yang bisa ditindaklanjuti.",
        durasi_min: 270,
        halaman: [
          hal(
            "Empat bagian yang tidak boleh dilewati",
            "Bagian yang paling sering terlewat adalah mengapa. Tanpa itu, temuan hanya deskripsi dan tidak menghasilkan keputusan.",
            [
              "Temuan: apa yang berubah, satu kalimat.",
              "Bukti: angka pendukung, dengan pembandingnya.",
              "Mengapa itu terjadi: hipotesis yang bisa diuji.",
              "Rekomendasi: tindakan spesifik dengan pemilik dan dampak.",
            ],
            "Temuan tanpa implikasi tidak menghasilkan keputusan.",
          ),
          latihan(
            "SQL",
            [
              "Hitung pengguna aktif per hari selama 90 hari terakhir.",
              "Bandingkan dengan 7 hari sebelumnya memakai window function.",
            ],
            "Sertakan definisi pengguna aktif yang kamu pakai.",
          ),
        ],
      },
    ],
  },
  {
    slug: "database-sql-fundamental",
    title: "Database: SQL, Normalisasi, dan Performa Query",
    description:
      "Fondasi database untuk engineer dan analis: SQL tingkat lanjut, normalisasi, indeks, transaksi, dan cara menjaga kueri tetap cepat saat data bertambah.",
    tags: ["database", "sql", "postgresql", "mysql", "query", "performance", "systems"],
    level: "dasar",
    track: "data",
    provider: "Careevo",
    modul: [
      {
        judul: "SQL yang Dipakai Sehari-hari",
        ringkasan: "SELECT, JOIN, subquery, dan CTE.",
        durasi_min: 210,
        halaman: [
          hal(
            "Urutan yang benar-benar penting",
            "Urutan pemrosesan kueri bukan urutan yang tertulis, dan mengetahui urutan sebenarnya mempercepat debugging.",
            [
              "FROM, lalu JOIN, lalu WHERE, GROUP BY, HAVILY, SELECT, ORDER BY, LIMIT.",
              "Subquery di SELECT lambat; derived table atau JOIN lebih baik.",
              "CTE membuat kueri panjang bisa diuji per bagian.",
            ],
            "SELECT di dalam WHERE tidak ada; itu filter, bukan kolom.",
          ),
        ],
      },
      {
        judul: "Normalisasi",
        ringkasan: "Bentuk pertama sampai ketiga, dan kapan menyimpang dengan sadar.",
        durasi_min: 180,
        halaman: [
          hal(
            "Normalisasi menghapus duplikasi",
            "Normalisasi mengurangi duplikasi data, dan menambah kompleksitas kalau diterapkan tanpa disiplin.",
            [
              "Bentuk 1: satu nilai per kolom, tanpa daftar di dalam teks.",
              "Bentuk 2: setiap non key bergantung pada seluruh kunci utama.",
              "Bentuk 3: tidak ada dependensi transitif terhadap kunci utama.",
            ],
            "Penyimpangan yang wajar dicatat sebagai keputusan, bukan kebetulan.",
          ),
        ],
      },
      {
        judul: "Indeks",
        ringkasan: "Memahami urutan eksekusi sebelum menambah indeks.",
        durasi_min: 210,
        halaman: [
          hal(
            "Indeks bukan obat semua kueri lambat",
            "Indeks memperlambat penulisan dan pembacaan. Menambahkannya tanpa rencana hanya menambah biaya dan memberi optimizer lebih banyak pilihan yang salah.",
            [
              "Baca plan eksekusi dulu; seq scan pada tabel besar diperiksa pertama.",
              "Indeks komposit mengikuti urutan kolom.",
              "UNIQUE constraint adalah indeks sekaligus aturan.",
            ],
            "Kueri lambat yang tidak pernah diukur hanya menambah tebakan.",
          ),
        ],
      },
      {
        judul: "Transaksi",
        ringkasan: "Isolation level, lock, dan deadlock.",
        durasi_min: 180,
        halaman: [
          hal(
            "Empat anomali yang mungkin terjadi",
            "Isolation yang lebih tinggi mengurangi anomali dan menurunkan throughput. Pilih yang paling rendah yang masih memenuhi kebutuhan.",
            [
              "Dirty read: membaca perubahan yang belum di-commit.",
              "Non repeatable read: baris berubah di antara dua SELECT.",
              "Phantom read: baris baru muncul di antara dua SELECT.",
              "Deadlock: dua transaksi saling menunggu.",
            ],
            "Tulis transaksi sesingkat mungkin; itu memperbaiki lebih banyak masalah daripada menambah lock.",
          ),
          latihan(
            "Indeks",
            [
              "Ambil tabel dengan setidaknya seratus ribu baris dan satu kueri lambat.",
              "Ukur plan eksekusinya, tambahkan satu indeks, lalu ukur lagi.",
            ],
            "Kesimpulan tanpa angka tidak dianggap.",
          ),
        ],
      },
    ],
  },
  {
    slug: "qa-test-automation",
    title: "QA Engineer: Test Automation dan Quality Gate",
    description:
      "Keahlian QA yang diminta lowongan software QA engineer: merancang test case dari risiko, automation framework, regression suite, dan gerbang rilis.",
    tags: ["quality", "qa", "test", "testing", "automation", "regression"],
    level: "menengah",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "Merancang Test Case",
        ringkasan: "Test case dari risiko, bukan dari jumlah.",
        durasi_min: 210,
        halaman: [
          hal(
            "Mulai dari risiko",
            "Menutup setiap tombol yang terlihat menghasilkan banyak test lambat dan sedikit yang menangkap bug.",
            [
              "Mulai dari apa yang paling berbahaya jika gagal: transaksi, data hilang, akses bocor.",
              "Tabel kombinasi untuk nilai batas: nol, satu, banyak, negatif.",
              "Skenario gagal: input tidak valid, jaringan putus, klik ganda.",
            ],
            "Satu test punya satu alasan gagal yang jelas.",
          ),
        ],
      },
      {
        judul: "Automation Framework",
        ringkasan: "Pisahkan test yang menguji antarmuka dari test yang menguji logika.",
        durasi_min: 240,
        halaman: [
          hal(
            "Piramida yang menyeimbangkan",
            "Test yang sering gagal tidak menambah keyakinan, hanya mengajari tim untuk mengabaikannya.",
            [
              "Banyak unit test: cepat, stabil, menangkap logika.",
              "Lebih sedikit integration test: kontrak antar komponen.",
              "Sedikit end to end: hanya alur utama.",
            ],
            "Test flaky harus diperbaiki atau dimatikan, bukan diulang tanpa batas.",
          ),
        ],
      },
      {
        judul: "Test API dan Database",
        ringkasan: "Menguji kontrak dan memverifikasi efeknya.",
        durasi_min: 210,
        halaman: [
          hal(
            "Respons 200 tidak berarti benar",
            "Endpoint yang mengembalikan 200 dengan data salah adalah bug yang lolos paling banyak pengujian.",
            [
              "Status code, skema body, dan header untuk setiap kasus.",
              "Verifikasi efek samping: baris yang ditulis benar-benar ada.",
              "Uji idempotensi dan otorisasi.",
            ],
            "Data lama yang ikut berubah adalah bug yang paling mahal ditemukan belakangan.",
          ),
        ],
      },
      {
        judul: "Quality Gate",
        ringkasan: "Mencegah rilis rusak, bukan mencatatnya setelah terjadi.",
        durasi_min: 180,
        halaman: [
          hal(
            "Laporan defect yang bisa ditindaklanjuti",
            "Gerbang yang berguna sedikit dan tegas, bukan banyak dan longgar.",
            [
              "Langkah reproduksi yang bisa diulang tanpa bertanya.",
              "Lingkungan: OS, versi aplikasi, akun.",
              "Dampak: apa yang rusak dan seberapa sering.",
            ],
            "Test wajib hijau sebelum merge adalah satu-satunya gerbang yang tidak perlu dinegosiasi.",
          ),
          latihan(
            "Test case",
            [
              "Ambil satu fitur, tulis 12 test case yang berasal dari risiko.",
              "Otomasikan lima yang paling penting sebagai regression suite.",
            ],
              "Sertakan test mana yang sengaja tidak diotomasikan dan mengapa.",
          ),
        ],
      },
    ],
  },
  {
    slug: "devops-cloud-cicd",
    title: "DevOps: CI/CD, Docker, dan Cloud",
    description:
      "Alur kerja modern untuk engineer: pipeline CI/CD, containerization, deployment, secrets, dan monitoring. Menjadikan rilis tidak menegangkan saraf.",
    tags: ["devops", "infrastructure", "cloud", "docker", "kubernetes", "automation", "scalable", "systems", "engineer", "server"],
    level: "menengah",
    track: "cyber-sec",
    provider: "Careevo",
    modul: [
      {
        judul: "Container dengan Docker",
        ringkasan: "Image kecil, reproducible, dan aman.",
        durasi_min: 270,
        halaman: [
          hal(
            "Tiga keputusan yang menentukan image yang bagus",
            "Urutan lapisan menentukan berapa cepat build berikutnya, dan satu build yang sukses di laptop belum berarti apa-apa kalau tidak ada yang mengujinya.",
            [
              "Image dasar kecil, diperbarui dengan lapisan berlapis yang benar.",
              "Salin package lebih dulu, pasang dependensi, baru salin kode.",
              "Jalankan sebagai user non root; jangan taruh secret di image.",
            ],
            "Cache layer adalah hal yang paling murah untuk diperbaiki.",
          ),
        ],
      },
      {
        judul: "Pipeline CI/CD",
        ringkasan: "Dari commit ke produksi, dengan gerbang yang bisa dipercaya.",
        durasi_min: 300,
        halaman: [
          hal(
            "Tahap pipeline yang menutup risiko",
            "Aturan yang jarang dipegang: artefak yang dipromosikan antar environment harus identik. Build ulang saat deploy berarti yang diuji bukan yang dijalankan.",
            [
              "Lint dan typecheck lebih dulu, gagal lebih awal.",
              "Test unit lalu integrasi dengan database sungguhan.",
              "Build image sekali, pakai di semua environment.",
              "Deploy bertahap dengan rollback yang sudah diuji.",
            ],
            "Pipeline yang tidak bisa dibatalkan adalah batch job, bukan pipeline.",
          ),
        ],
      },
      {
        judul: "Secrets dan Konfigurasi",
        ringkasan: "Konfigurasi per environment dan secret yang tidak bocor.",
        durasi_min: 270,
        halaman: [
          hal(
            "Secret di repository berarti secret bocor",
            "Secret yang pernah di-commit dianggap bocor, karena history menyimpan semuanya dan salinan bisa ada di mirror.",
            [
              "Secret disuntikkan saat runtime, bukan ada di image.",
              "Pisahkan konfigurasi per environment; kode sama, nilai berbeda.",
              "Punya jalur rotasi: kalau bocor, seberapa cepat bisa diganti?",
            ],
            "Hapus barisnya bukan berarti mengganti secretnya.",
          ),
        ],
      },
      {
        judul: "Monitoring",
        ringkasan: "Tahu ada masalah sebelum user memberi tahu.",
        durasi_min: 300,
        halaman: [
          hal(
            "Alert yang berguna",
            "Alert yang tidak perlu tindakan adalah derau: ia melatih tim untuk mengabaikan alert, dan alert yang diabaikan berhenti bekerja saat penting.",
            [
              "Alert berdasarkan dampak pengguna, bukan CPU tinggi.",
              "Setiap alert punya penanggung jawab dan langkah yang bisa dijalankan.",
              "Latensi p99 lebih informatif daripada rata-rata.",
            ],
            "Latihan Contributor: cara Anda merespons insiden menentukan apakah sistemnya dapat diandalkan.",
          ),
          latihan(
            "Pipeline",
            [
              "Buat pipeline untuk aplikasi kecil: test, build image, deploy ke staging.",
              "Tambahkan satu gerbang yang memblokir merge bila test gagal.",
            ],
            "Catatan apa yang terjadi kalau deploy gagal separuh jalan.",
          ),
        ],
      },
    ],
  },
  {
    slug: "product-management-fundamentals",
    title: "Product Management: Dari Masalah ke Keputusan",
    description:
      "Keterampilan product manager yang diminta lowongan PM di Indonesia: menemukan masalah, memprioritaskan, menulis PRD, dan mengukur dampak.",
    tags: ["product", "manager", "management", "business", "users", "strategy", "roadmap", "lead"],
    level: "menengah",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "Menemukan Masalah",
        ringkasan: "Riset pengguna dan data sebelum solusi.",
        durasi_min: 240,
        halaman: [
          hal(
            "Solusi yang tidak menjawab masalah tetap fitur yang tidak dipakai",
            "Feature yang tidak pernah dipakai membakar biaya pengembangan tanpa menyelesaikan masalah aslinya.",
            [
              "Wawancara perilaku masa lalu, bukan pendapat tentang fitur yang belum ada.",
              "Data perilaku lebih jujur daripada survey.",
              "Tuliskan daftar masalah sebelum mengusulkan solusi pertama.",
            ],
            "Tanyakan apa yang mereka lakukan terakhir kali, bukan apa yang merekaderekomendasikan.",
          ),
        ],
      },
      {
        judul: "Memprioritaskan",
        ringkasan: "RICE, ICE, dan cara berdebat dengan bukti.",
        durasi_min: 210,
        halaman: [
          hal(
            "Skor membantu, tapi tidak pernah memutuskan",
            "Skoring seperti RICE berguna karena memaksa setiap fitur punya alasan. Yang penting angkanya boleh dipertanyakan, dan di situlah perdebatan yang productive terjadi.",
            [
              "Dampak, keyakinan, usaha, dan jangkauan.",
              "Keyakinan rendah berarti eksperimen dulu, bukan menebak.",
              "Yang tidak dikerjakan juga worth dicatat, supaya tidak diusulkan ulang.",
            ],
            "Daftar fitur yang tidak dikerjakan adalah dokumen pertahanan yang paling berguna.",
          ),
        ],
      },
      {
        judul: "PRD yang Bisa Dieksekusi",
        ringkasan: "Masalah, ruang lingkup, edge case, dan metrik.",
        durasi_min: 240,
        halaman: [
          hal(
            "Enam bagian PRD yang tidak bisa dilewati",
            "PRD yang tidak menyebut apa yang tidak dikerjakan akan dibaca sebagai janji bahwa semuanya harus ada, dan itu sumber utama keterlambatan.",
            [
              "Masalah dan bukti, serta siapa yang terdampak.",
              "Metrik keberhasilan, termasuk angka awal.",
              "Ruang lingkup: apa yang sengaja tidak dikerjakan.",
              "Alur utama dan edge case yang harus ditangani.",
            ],
            "Sertakan rencana peluncuran dan cara mengukur setelahnya.",
          ),
        ],
      },
      {
        judul: "Mengukur Dampak",
        ringkasan: "Metrik yang bisa naik dan turun karena alasan yang benar.",
        durasi_min: 210,
        halaman: [
          hal(
            "Metrik yang selalu naik",
            "Pengguna aktif dan total unduhan naik hampir tanpa informasi. Tanpa konteks, tidak ada yang bisa disimpulkan.",
            [
              "Konversi, retensi, dan waktu menuju nilai pertama lebih berguna.",
              "Selalu ada komparator: periode lalu, cohort, atau kelompok kontrol.",
              "Perubahan metrik setelah rilis bisa jadi karena hal lain.",
            ],
            "Selalu ukur sebelum rilis, kalau tidak kamu hanya melihat hal yang kamu fuck",
          ),
          latihan(
            "PRD",
            [
              "Tulis PRD satu halaman untuk satu fitur pada aplikasi yang kamu gunakan.",
              "Isi masalah, angka, ruang lingkup yang tidak dikerjakan, edge case, dan metrik.",
            ],
            "Sertakan dari mana angka awalnya berasal.",
          ),
        ],
      },
    ],
  },
  {
    slug: "ui-ux-design-fundamental",
    title: "UI/UX Design: Antarmuka yang Bisa Dipakai",
    description:
      "Dasar desain antarmuka untuk product designer: hierarki visual, tipografi, kontras dan aksesibilitas, desain mobile, serta validasi sebelum ada kode.",
    tags: ["design", "designer", "ux", "ui", "product", "mobile", "web"],
    level: "dasar",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "Hierarki Visual",
        ringkasan: "Menentukan mana yang dibaca lebih dulu.",
        durasi_min: 210,
        halaman: [
          hal(
            "Empat alat yang hampir selalu cukup",
            "Desain yang ramai biasanya bukan kurang dekorasi, tapi terlalu banyak elemen yang sama-sama bersaing mendapat perhatian.",
            [
              "Ukuran: perbedaan jelas lebih kuat daripada perbedaan tipis.",
              "Bobot: tebal untuk hal penting, biasa untuk sisanya.",
              "Ruang: jarak yang lega membuat hierarki tanpa warna tambahan.",
              "Warna: untuk makna dan penekanan, bukan dekorasi.",
            ],
            "Kalau semuanya penting, sebenarnya tidak ada yang penting.",
          ),
        ],
      },
      {
        judul: "Warna dan Aksesibilitas",
        ringkasan: "Membaca yang tetap terbaca oleh semua orang.",
        durasi_min: 180,
        halaman: [
          hal(
            "Kontras bukan tambahan",
            "Desainer sering mengorbankan kontras demi estetika, padahal orang dengan gangguan penglihatan adalah pengguna yang paling tidak bisa mengeluh.",
            [
              "Rasio kontras teks minimal 4.5 banding 1, dan 3 banding 1 untuk teks besar.",
              "Jangan menyampaikan makna hanya dengan warna.",
              "Uji dengan simulator buta warna; merah dan hijau kombinasi terburuk.",
            ],
            "Fokus keyboard harus selalu terlihat, dan urutannya mengikuti urutan baca.",
          ),
        ],
      },
      {
        judul: "Desain untuk Mobile",
        ringkasan: "Jempol, satu tangan, dan jaringan buruk.",
        durasi_min: 200,
        halaman: [
          hal(
            "Batasan yang tidak bisa diabaikan",
            "Desain mobile yang baik dimulai dari batasan fisik perangkat, bukan dari menipped screenshot.",
            [
              "Target sentuh minimal 44 piksel.",
              "Tindakan destruktif tidak boleh dekat tindakan utama.",
              "Satu kolom, jarak antar baris longgar.",
              "Kondisi pemuatan, kosong, dan gagal harus dirancang.",
            ],
            "Layar kosong tanpa desain adalah bug, bukan pilihan.",
          ),
        ],
      },
      {
        judul: "Prototipe dan Validasi",
        ringkasan: "Menguji dengan pengguna sebelum menulis kode.",
        durasi_min: 190,
        halaman: [
          hal(
            "Tiga sumber validasi dan batasnya",
            "Lima peserta sudah cukup untuk menemukan sebagian besar masalah kegunaan. Yang menentukan kualitas uji bukan jumlah, tapi apakah peserta termasuk kelompok yang benar.",
            [
              "Uji kegunaan: apakah orang menemukan jalan yang benar.",
              "Studi tugas: apakah alur utama selesai tanpa bantuan.",
              "Ulasan: tentang pengalaman, berguna untuk masalah di luar tugas.",
            ],
            "Satu perubahan konkret karena hasil uji lebih berharga daripada sepuluh ide.",
          ),
          latihan(
            "Desain",
            [
              "Ambil satu alur di aplikasi yang kamu pakai, buat dua versi.",
              "Uji ke lima orang, lalu tulis apa yang mereka coba dan di mana mereka tersesat.",
            ],
            "Sertakan satu perubahan konkret karena hasil uji.",
          ),
        ],
      },
    ],
  },
  {
    slug: "system-design-arsitektur",
    title: "System Design dan Arsitektur Skala Besar",
    description:
      "Merancang sistem yang tetap kuat ketika pengguna dan data bertambah: batas layanan, model data, caching, dan strategi scaling yang realistis untuk produk Indonesia.",
    tags: ["systems", "design", "architecture", "scalable", "microservice", "distributed", "database", "performance"],
    level: "lanjut",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "Mulai dari Kebutuhan",
        ringkasan: "Kebutuhan fungsional, non-fungsional, dan perkiraan skala.",
        durasi_min: 300,
        halaman: [
          hal(
            "Lima pertanyaan sebelum menggambar diagram",
            "Diagram sistem yang bagus dimulai dari pertanyaan, bukan dari daftar layanan cloud. Urutan yang terbalik menghasilkan arsitektur yang tidak ada yang butuh.",
            [
              "Berapa pengguna aktif, dan seperti apa pola lonkatannya?",
              "Data mana yang harus cepat dibaca, dan mana yang boleh lambat?",
              "Batas waktu yang bisa diterima untuk satu request?",
              "Apa yang harus tetap berjalan kalau satu bagian gagal?",
              "Seberapa besar tim yang akan menjaganya?",
            ],
            "Gambar setelah menjawab lima pertanyaan itu, bukan sebelumnya.",
          ),
        ],
      },
      {
        judul: "Batas Layanan dan Data",
        ringkasan: "Memilih yang perlu dipisah, dan yang sebaiknya tidak.",
        durasi_min: 300,
        halaman: [
          hal(
            "Satu database per layanan, tapi transaksi lintas batas itu mahal",
            "Begitu data dipecah, satu operasi bisnis bisa menyeberang beberapa layanan. Kalau itu sering terjadi, batas yang dipilih salah, dan yang perlu diperbaiki adalah batasnya.",
            [
              "Pecah berdasarkan perubahan yang berbeda, bukan berdasarkan tabel.",
              "Transaksi lintas layanan butuh kompensasi, dan itu selalu lebih sulit.",
              "Baca lintas layanan boleh; tulis lintas layanan perlu dirancang eksplisit.",
            ],
            "Batas layanan adalah keputusan organisasi sebelum jadi keputusan teknis.",
          ),
        ],
      },
      {
        judul: "Caching dan Konsistensi",
        ringkasan: "Apa yang layak dicache, dan berapa lama boleh basi.",
        durasi_min: 300,
        halaman: [
          hal(
            "Cache adalah transaksi antara kecepatan dan kebenaran",
            "Begitu ada cache, ada dua sumber kebenaran, dan tempat lain yang perlu direkonsiliasi.",
            [
              "Isi yang jarang berubah dan sering dibaca: TTL panjang aman.",
              "Isi yang berubah karena aksi pengguna: invalidated saat tulis.",
              "Cache aside lebih umum daripada write through.",
              "Stale while revalidate membuat halaman terasa cepat dengan basi yang bisa diterima.",
            ],
            "Tentukan dulu toleransi basi, baru pilih strateginya.",
          ),
        ],
      },
      {
        judul: "Scaling",
        ringkasan: "Menjawab apa yang terjadi kalau trafik naik sepuluh kali.",
        durasi_min: 300,
        halaman: [
          hal(
            "Urutan yang jarang ditanyakan tapi selalu dijawab",
            "Perbaiki yang terukur, bukan yang terdengar menarik. Bertambah mesin adalah langkah terakhir, bukan langkah pertama.",
            [
              "Ukur dulu: CPU, input output, lock, atau jaringan.",
              "Cache dan indeks dulu untuk query, sebelum menambah mesin.",
              "Pecah bagian yang independen, lalu skalakan horizontal bagian itu.",
              "Pastikan sistem tetap benar saat satu bagian mati.",
            ],
            "Pada skala cukup, ada bagian yang pasti mati. Rancang untuk itu sekarang.",
          ),
          latihan(
            "System design",
            [
              "Rancang arsitektur untuk sistem submission berkas dengan 50 ribu unggahan per hari.",
              "Tulis pertanyaan yang perlu kamu ajukan sebelum menggambar diagramnya.",
            ],
              "Sertakan bagian mana yang paling mungkin menjadi bottleneck dan cara mengukurnya.",
          ),
        ],
      },
    ],
  },
  {
    slug: "python-automation-scripting",
    title: "Python untuk Automation dan Scripting",
    description:
      "Python untuk pekerjaan berulang: memproses berkas, memanggil API, mengambil data dari web, menjadwalkan job, dan merapikan data. Fokus pada hasil kerja nyata.",
    tags: ["python", "automation", "scripting", "developer", "tools", "data", "analyst", "programming"],
    level: "dasar",
    track: "data",
    provider: "Careevo",
    modul: [
      {
        judul: "Dasar Python untuk Otomasi",
        ringkasan: "Struktur data, comprehension, dan idiom yang memperpendek kode.",
        durasi_min: 210,
        halaman: [
          hal(
            "Idiom yang memendekkan kode tanpa membuatnya buram",
            "Kode otomatis yang sulit dibaca punya biaya operasional, karena orang berikutnya termasuk kamu akan membaca ulang setiap kali gagal.",
            [
              "List dan dict comprehension untuk transformasi sederhana.",
              "with untuk berkas dan koneksi, supaya selalu tertutup.",
              "pathlib untuk path, bukan gabungan string.",
              "Generator untuk data besar yang tidak muat di memori.",
            ],
            "Pendek tidak sama dengan jelas. Pilih yang jelas.",
          ),
        ],
      },
      {
        judul: "Memproses Data",
        ringkasan: "CSV, Excel, JSON, dan berkas yang rusak di tengah jalan.",
        durasi_min: 210,
        halaman: [
          hal(
            "Data dunia nyata selalu sedikit rusak",
            "Hampir semua masalah ingestion data adalah masalah format, bukan masalah logika.",
            [
              "Encoding salah adalah masalah paling sering; baca utf-8 dan tangani errors secara sadar.",
              "Baris kosong, kolom hilang, dan angka berformat lokal.",
              "Tanggal dengan format berbeda dalam satu kolom.",
              "Untuk skala besar pakai streaming, bukan list penuh.",
            ],
            "Bersihkan data di input, bukan di setiap tempat yang memakainya.",
          ),
        ],
      },
      {
        judul: "API dan Web yang Sopan",
        ringkasan: "Memanggil API dengan benar dan mengambil data dengan etika.",
        durasi_min: 180,
        halaman: [
          hal(
            "API yang digunakan dengan benar",
            "Scraping yang merusak situs sumber adalah cara tercepat untuk diblokir, dan sering juga ilegal.",
            [
              "Timeout eksplisit untuk setiap request.",
              "Coba ulang dengan jeda yang bertambah, bukan langsung mengukul.",
              "Rate limit dihormati dan token disimpan di tempat aman.",
              "Hormati robots.txt dan syarat layanan situs sumber.",
            ],
            "Tujuan yang baik tidak membenarkan cara yang merusak milik orang lain.",
          ),
        ],
      },
      {
        judul: "Menjadwalkan Job",
        ringkasan: "Cron, logging, dan memberitahu saat gagal.",
        durasi_min: 120,
        halaman: [
          hal(
            "Job yang diam-diam gagal tidak pernah diperbaiki",
            "Job terjadwal tanpa notifikasi akan gagal berbulan-bulan tanpa ada yang tahu, karena tidak ada yang melihatnya.",
            [
              "Log ke file dengan rotasi, bukan ke terminal yang lenyap.",
              "Kirim notifikasi saat gagal, bukan hanya saat berhasil.",
              "Idempoten: aman dijalankan dua kali tanpa efek ganda.",
              "Simpan waktu jalan agar perlambatan kelihatan.",
            ],
            "Notifikasi kegagalan adalah fitur, bukan tambahan.",
          ),
          latihan(
            "Otomatisasi",
            [
              "Tulis skrip yang mengunduh data dari API publik, membersihkannya, dan menyimpan ke CSV.",
              "Jalankan ulang setiap hari tanpa menduplikasi data.",
            ],
            "Catat cara menangani kegagalan yang kamu temui.",
          ),
        ],
      },
    ],
  },
  {
    slug: "git-colaboration-team",
    title: "Git dan Kolaborasi Tim Engineering",
    description:
      "Git dari dalam: branching strategy, pull request yang mudah direview, menyelesaikan konflik, dan alur monorepo yang dipakai tim engineering di Indonesia.",
    tags: ["git", "collaboration", "team", "developer", "programming", "software", "engineer", "workflow"],
    level: "dasar",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "Branching Strategy",
        ringkasan: "Gitflow, trunk based, dan mana yang cocok untuk timmu.",
        durasi_min: 150,
        halaman: [
          hal(
            "Tidak ada strategi terbaik, hanya yang dipakai semua orang",
            "Bermigrasi di tengah jalan ke strategi lain lebih mahal daripada memilih strategi yang salah sejak awal.",
            [
              "Trunk based: branch pendek, integrasi sering. Untuk produk yang sering rilis.",
              "Gitflow: branch panjang dan terstruktur. Untuk rilis berjadwal.",
              "Yang penting semua orang mengikuti aturan yang sama.",
            ],
            "Aturan yang tidak disepakati bukan aturan, itu saja.",
          ),
        ],
      },
      {
        judul: "Pull Request yang Mudah Direview",
        ringkasan: "Ukuran, deskripsi, dan urutan review.",
        durasi_min: 150,
        halaman: [
          hal(
            "Kecil di-review, besar di instruksi",
            "Review yang baik tidak mungkin dilakukan pada pull request yang menyentuh seluruh aplikasi.",
            [
              "Sekitar empat ratus baris per pull request adalah batas yang jarang dilanggar.",
              "Deskripsi menjelaskan kenapa; kode sudah menjelaskan apa.",
              "Pisahkan refactor dari perubahan perilaku.",
              "Minta review ke orang yang tepat, bukan ke semua orang.",
            ],
            "Banyak pull request yang kecil lebih cepat sampai produksi daripada satu yang besar.",
          ),
        ],
      },
      {
        judul: "Konflik dan Pemulihan",
        ringkasan: "Rebase, revert, dan menemukan commit yang hilang.",
        durasi_min: 180,
        halaman: [
          hal(
            "Empat perintah untuk pulih cepat",
            "Hampir semua menakut-nakuti Git bisa diselesaikan dengan beberapa perintah, selama kamu tahu membatalkannya.",
            [
              "git status dan git log graph sebelum melakukan apa pun.",
              "git rebase abort dan git merge abort tersedia dan sering dipakai.",
              "git revert lebih aman daripada reset hard pada kode yang sudah dibagikan.",
              "git reflog masih menemukan commit yang terlihat hilang.",
            ],
            "Menulis ulang history yang sudah dibagikan orang lain adalah sumber masalah yang paling mahal.",
          ),
        ],
      },
      {
        judul: "Monorepo",
        ringkasan: "Satu repository banyak service, dan biayanya.",
        durasi_min: 150,
        halaman: [
          hal(
            "Apa yang benar-benar didapat dari monorepo",
            "Monorepo memusatkan perubahan lintas service, dan sekaligus menambah beban build dan ukuran pull request.",
            [
              "Perubahan lintas service bisa satu commit dan satu pull request.",
              "Satu tempat untuk dependensi dan tooling bersama.",
              "Build time dan ukuran repository tumbuh nyata.",
            ],
            "Jalur folder yang jelas, atau strukturnya berubah setiap bulan.",
          ),
          latihan(
            "Git",
            [
              "Buat repository lokal dengan tiga branch dan satu konflik yang disengaja.",
              "Selesaikan konflik, lalu buat pull request bergaya yang bisa direview.",
            ],
            "Catat satu hal yang membuatmu regrets tentang hasilnya.",
          ),
        ],
      },
    ],
  },
  {
    slug: "net-dotnet-enterprise",
    title: "Backend C# dan ASP.NET Core untuk Enterprise",
    description:
      "C# dan ASP.NET Core untuk backend enterprise dan bank: LINQ, middleware, Entity Framework Core, async, dan pola arsitektur yang dipakai institusi di Indonesia.",
    tags: ["net", "dotnet", "backend", "api", "rest", "enterprise", "banking", "database", "developer", "programmer"],
    level: "menengah",
    track: "web-dev",
    provider: "Careevo",
    modul: [
      {
        judul: "C# dan LINQ",
        ringkasan: "LINQ bukan sekadar gula; eksekusi yang tertunda penting.",
        durasi_min: 240,
        halaman: [
          hal(
            "Eksekusi bertingkat dan diam",
            "LINQ bersifat lazy, yang menguntungkan untuk menghemat dan berbahaya ketika kamu menghitung sesuatu lebih dari sekali.",
            [
              "Operasi setelah Select pada IEnumerable masih memerlukan daftar penuh.",
              "Query yang menghitung berulang tanpa cache akan mengulang perhitungan.",
              "LINQ adalah alat, bukan doktrin; foreach biasa lebih jelas untuk logika sederhana.",
            ],
            "Kalau kamu menghitung panjang hasil, hitung sekali dan simpan.",
          ),
        ],
      },
      {
        judul: "ASP.NET Core dan Middleware",
        ringkasan: "Pipeline, dependency injection, dan penanganan error terpusat.",
        durasi_min: 270,
        halaman: [
          hal(
            "Urutan middleware itu penting",
            "Urutan pendaftaran menentukan urutan dijalankan, dan satu handle yang salah tempat membuat semua log tidak berguna.",
            [
              "Logging harus paling awal dalam pipeline.",
              "Penanganan exception terpusat, bukan try catch di setiap controller.",
              "DI bawaan ASP.NET Core sudah cukup untuk sebagian besar kasus.",
            ],
            "Konfigurasi lewat options pattern supaya bisa diuji.",
          ),
        ],
      },
      {
        judul: "Entity Framework Core",
        ringkasan: "Migration, N plus 1, dan kueri yang gagal diterjemahkan.",
        durasi_min: 270,
        halaman: [
          hal(
            "Dua masalah yang paling sering muncul",
            "Query yang berhasil di testing sering gagal di produksi, karena perbedaan mesin database.",
            [
              "N plus 1: satu kueri induk lalu satu kueri per anak; hindari dengan Include atau proyeksi.",
              "Fungsi yang tidak bisa diterjemahkan ke SQL.",
              "Migration yang ditambahkan tapi belum di-commit membuat lingkungan lain tertinggal.",
              "Mulai dari AsNoTracking untuk kueri baca saja.",
            ],
            "Selalu ukur jumlah kueri, bukan hanya waktu eksekusi.",
          ),
        ],
      },
      {
        judul: "Async dan Resilience",
        ringkasan: "Input output tidak memblokir, retry yang belum`().",
        durasi_min: 300,
        halaman: [
          hal(
            "Async over sync lebih buruk dari synchronous",
            "Menunggu sebuah future di thread yang sama memblokir thread pool, dan itu menjadi sumber aplikasi tidak responsif saat beban tinggi.",
            [
              "Result dan Wait memblokir thread pool.",
              "Satu CancellationToken diteruskan ke seluruh rantai panggilan.",
              "Retry memakai backoff eksponensial plus jitter.",
              "Bulkhead membatasi jumlah permintaan yang boleh menunggu.",
            ],
            "Circuit breaker menahan permintaan ke layanan yang sudah pasti gagal.",
          ),
          latihan(
            "EF Core",
            [
              "Buat dua entitas berelasi, tulis kueri yang menghindari N plus 1, tambahkan migration.",
              "Tambahkan pengujian yang memastikan kueri dieksekusi sejumlah kali yang diharapkan.",
            ],
            "Catatan apa yang terjadi kalau tabelnya tumbuh jadi sepuluh juta baris.",
          ),
        ],
      },
    ],
  },
  {
    slug: "it-security-fundamental",
    title: "Keamanan Aplikasi: Praktik Dasar",
    description:
      "Keamanan aplikasi yang bisa langsung diterapkan: OWASP Top 10, manajemen secret, autentikasi aman, validasi input, dan kerentahan dependensi.",
    tags: ["security", "owasp", "auth", "cryptography", "authentication", "authorization", "injection", "passwords", "cyber"],
    level: "menengah",
    track: "cyber-sec",
    provider: "Careevo",
    modul: [
      {
        judul: "OWASP Top 10",
        ringkasan: "Sepuluh risiko paling umum dan cara menutupnya.",
        durasi_min: 270,
        halaman: [
          hal(
            "Yang paling sering dieksploitasi",
            "Access control tidak pernah diperbaiki di sisi klien: UI menyembunyikan tombol, bukan server menolak request.",
            [
              "Broken access control: endpoint yang hanya disembunyikan di antarmuka.",
              "Injection: input yang disambung ke query; gunakan parameter binding.",
              "Broken authentication: sesi yang tidak kedaluwarsa dan login tanpa rate limit.",
              "Insecure design: aturan bisnis tanpa skenario negatif.",
            ],
            "Setiap aturan otorisasi harus diuji dengan akun yang tidak berhak.",
          ),
        ],
      },
      {
        judul: "Manajemen Secret",
        ringkasan: "Di mana secret hidup dan bagaimana cara merotasinya.",
        durasi_min: 240,
        halaman: [
          hal(
            "Secret bocor karena default",
            "Secret di dalam image Docker terbaca oleh siapa pun yang menarik image itu, termasuk di registry publik.",
            [
              "Secret di image terbaca siapa pun yang menarik image itu.",
              "Secret yang pernah masuk repository dianggap bocor meski dihapus.",
              "Simpan di vault atau environment variable yang diinjeksikan saat runtime.",
              "Untuk database, pakai user khusus aplikasi dengan hak akses seperlunya.",
            ],
            "Ganti secretnya, jangan sekadar menghapus barisnya.",
          ),
        ],
      },
      {
        judul: "Autentikasi dan Sesi",
        ringkasan: "Password, cookie, token, dan kenapa token tidak di local storage.",
        durasi_min: 210,
        halaman: [
          hal(
            "Token di local storage dibaca skrip yang berhasil disuntikkan",
            "Local storage bisa dibaca skrip mana pun di halaman, jadi satu XSS cukup untuk mencuri token.",
            [
              "Cookie HttpOnly tidak terbaca JavaScript, jadi XSS tidak bisa membacanya.",
              "Tandai cookie Secure dan SameSite.",
              "Token kedaluwarsa harus ditolak server, bukan hanya dihapus klien.",
            ],
            "Simpan sesi di cookie, bukan di local storage.",
          ),
        ],
      },
      {
        judul: "Validasi dan Dependensi",
        ringkasan: "Jangan percaya input mana pun, termasuk milik sendiri.",
        durasi_min: 180,
        halaman: [
          hal(
            "Dua lapis yang wajib ada",
            "Validasi di server adalah satu-satunya yang;=nilai penting, karena yang klien bisa diubah kapan saja.",
            [
              "Validasi di server; validasi klien hanya untuk kenyamanan.",
              "Encode saat keluar: parameterized query untuk database, escaping konteks untuk HTML.",
              "Pindai dependensi secara rutin.",
              "Deteksi kebocoran secret di log sebelum log masuk repository.",
            ],
            "Input yang tidak pernah divalidasi adalah input yang dipercaya buta.",
          ),
          latihan(
            "Keamanan",
            [
              "Audit satu endpoint: telusuri setiap input dan setiap output yang dirender.",
              "Tulis daftar temuan dengan tingkat keparahan, lalu perbaiki yang paling serius.",
            ],
            "Sertakan test yang membuktikan setiap perbaikan.",
          ),
        ],
      },
    ],
  },
];

/** Bentuk `TipeBlok` dari seed ringkas. Id diisi skrip ini, bukan oleh store. */
function keBlok(blok: BlokSeed, awalan: string, indeks: number): BlokInput {
  const id = `${awalan}-${indeks}`;
  switch (blok.tipe) {
    case "paragraf":
      return { id, tipe: "paragraf", segmen: [{ teks: blok.teks }] };
    case "heading":
      return { id, tipe: "heading", level: blok.level, segmen: [{ teks: blok.teks }] };
    case "daftar":
      return { id, tipe: "daftar", butir: blok.butir.map((baris) => baris.map((teks) => ({ teks }))) };
    case "kutipan":
      return { id, tipe: "kutipan", segmen: [{ teks: blok.teks }] };
  }
}

async function main() {
  const ada = new Set((await listCourses()).map((c) => c.slug));
  let dibuat = 0;
  let dilewati = 0;
  let jumlahModul = 0;
  let jumlahHalaman = 0;

  for (const seed of KURSUS) {
    if (ada.has(seed.slug)) {
      dilewati += 1;
      continue;
    }

    const kursus = await createCourse({
      title: seed.title,
      slug: seed.slug,
      description: seed.description,
      provider: seed.provider,
      type: "course",
      track: seed.track,
      level: seed.level,
      tags: seed.tags,
      // Kursus milik platform, jadi arahkan ke katalog internal, bukan URL luar.
      url: `/belajar/${seed.slug}`,
      duration_min: seed.modul.reduce((total, m) => total + m.durasi_min, 0),
      is_free: true,
      status: "published",
    });

    for (const [m, modulSeed] of seed.modul.entries()) {
      const dibuatModul = await createModul(kursus.id, {
        judul: modulSeed.judul,
        ringkasan: modulSeed.ringkasan,
        durasi_min: modulSeed.durasi_min,
        urutan: m + 1,
      });
      if (!dibuatModul) {
        throw new Error(`modul gagal dibuat: ${kursus.slug} / ${modulSeed.judul}`);
      }

      for (const [h, halamanSeed] of modulSeed.halaman.entries()) {
        const jadiHalaman = await createHalaman(kursus.id, dibuatModul.id, null, {
          judul: halamanSeed.judul,
          urutan: h + 1,
          blok: halamanSeed.blok.map((b, i) => keBlok(b, `${kursus.slug}-m${m + 1}-h${h + 1}`, i)),
        });
        if (!jadiHalaman) {
          throw new Error(`halaman gagal dibuat: ${kursus.slug} / ${halamanSeed.judul}`);
        }
        jumlahHalaman += 1;
      }
      jumlahModul += 1;
    }

    dibuat += 1;
    console.log(`  + ${kursus.title}`);
  }

  console.log(
    `\nkursus baru: ${dibuat}, dilewati: ${dilewati}, modul: ${jumlahModul}, halaman: ${jumlahHalaman}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
