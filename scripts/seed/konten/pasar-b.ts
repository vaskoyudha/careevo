/**
 * Seed konten untuk kursus pasar kelompok B (6 kursus).
 *
 * Kursus-kursus ini **sudah punya halaman kurasi** di `data/courses.json`, jadi
 * berkas ini sengaja hanya melengkapi `kuis` per modul — tidak ada field
 * `halaman` di mana pun. Judul modul wajib persis sama dengan yang ada di
 * katalog supaya engine mencocokkan modul lama, bukan membuat modul baru.
 *
 * Judul/deskripsi/tags/level/track diambil dari `data/courses.json`.
 */

import type { KursusSeed } from "./tipen";

export const KURSUS_PASAR_B: KursusSeed[] = [
  {
    slug: "product-management-fundamentals",
    judul: "Product Management: Dari Masalah ke Keputusan",
    deskripsi:
      "Keterampilan product manager yang diminta lowongan PM di Indonesia: menemukan masalah, memprioritaskan, menulis PRD, dan mengukur dampak.",
    tags: ["product", "manager", "management", "business", "users", "strategy", "roadmap", "lead"],
    level: "menengah",
    track: "web-dev",
    modul: [
      {
        judul: "Menemukan Masalah",
        ringkasan: "Riset pengguna dan data sebelum solusi.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Menemukan Masalah",
          deskripsi: "Menguji cara riset masalah sebelum melompat ke solusi.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Saat wawancara pengguna, pertanyaan mana yang paling berguna untuk menemukan masalah nyata?",
              pilihan: [
                "Apa fitur yang Anda inginkan?",
                "Apa yang terakhir kali Anda lakukan ketika menghadapi masalah itu?",
                "Menurut Anda fitur apa yang perlu kami tambahkan?",
                "Apakah Anda menyukai desain ini?",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Sumber informasi mana yang lebih jujur menggambarkan kebutuhan pengguna?",
              pilihan: [
                "Data perilaku nyata pengguna",
                "Hasil survey kepuasan",
                "Pendapat tim internal",
                "Jumlah permintaan fitur di papan ide",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa yang sebaiknya ditulis lebih dulu sebelum mengusulkan solusi pertama?",
              pilihan: [
                "Daftar fitur prioritas",
                "Daftar masalah",
                "Estimasi biaya pengembangan",
                "Wireframe antarmuka",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa fitur yang tidak pernah dipakai itu berbahaya?",
              pilihan: [
                "Karena membakar biaya pengembangan tanpa menyelesaikan masalah aslinya",
                "Karena selalu membuat aplikasi crash",
                "Karena menurunkan retensi pengguna",
                "Karena memperbesar ukuran unduhan",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Memprioritaskan",
        ringkasan: "RICE, ICE, dan cara berdebat dengan bukti.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Memprioritaskan",
          deskripsi: "Menguji pemahaman skoring prioritas dan cara memakainya untuk berdebat.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "RICE adalah singkatan dari empat komponen apa?",
              pilihan: [
                "Reach, Impact, Confidence, Effort",
                "Risk, Impact, Cost, Effort",
                "Revenue, Impact, Cost, Effort",
                "Reach, Idea, Confidence, Effort",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa yang sebaiknya dilakukan bila tingkat keyakinan (Confidence) sebuah ide rendah?",
              pilihan: [
                "Tetap kerjakan penuh seperti ide lain",
                "Jalankan eksperimen lebih dulu, bukan menebak",
                "Naikkan nilai Impact agar skornya tinggi",
                "Hapus ide itu dari daftar selamanya",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan:
                "Mengapa skor prioritas tetap berguna meskipun tidak boleh memutuskan sendiri?",
              pilihan: [
                "Karena angkanya selalu tepat",
                "Karena memaksa setiap fitur punya alasan yang bisa dipertanyakan dan diperdebatkan",
                "Karena menggantikan keputusan manusia sepenuhnya",
                "Karena skor tidak bisa salah",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa daftar fitur yang TIDAK dikerjakan perlu dicatat?",
              pilihan: [
                "Supaya tidak diusulkan ulang dan menjadi dokumen pertahanan",
                "Supaya tim terlihat lebih sibuk",
                "Untuk menaikkan skor RICE",
                "Karena wajib ada di setiap PRD",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "PRD yang Bisa Dieksekusi",
        ringkasan: "Masalah, ruang lingkup, edge case, dan metrik.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: PRD yang Bisa Dieksekusi",
          deskripsi: "Menguji bagian PRD yang menentukan apakah dokumen bisa dieksekusi.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Bagian PRD apa yang paling sering terlewat dan menjadi sumber utama keterlambatan?",
              pilihan: [
                "Daftar seluruh fitur yang diinginkan",
                "Ruang lingkup: apa yang sengaja tidak dikerjakan",
                "Nama penulis dokumen",
                "Estimasi tanggal peluncuran",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang harus disertakan pada bagian metrik keberhasilan sebuah PRD?",
              pilihan: [
                "Hanya target akhir tanpa pembanding",
                "Angka awal (baseline) sebagai titik banding",
                "Nama para stakeholder",
                "Daftar risiko teknis",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang termasuk dalam bagian masalah pada PRD?",
              pilihan: [
                "Masalah, bukti, dan siapa yang terdampak",
                "Hanya daftar fitur",
                "Hanya estimasi biaya",
                "Hanya mockup antarmuka",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Selain alur utama, apa lagi yang harus didokumentasikan di PRD?",
              pilihan: [
                "Edge case yang harus ditangani",
                "Warna tombol",
                "Jadwal libur tim",
                "Daftar kompetitor",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Mengukur Dampak",
        ringkasan: "Metrik yang bisa naik dan turun karena alasan yang benar.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Mengukur Dampak",
          deskripsi: "Menguji pemilihan metrik dan cara membacanya dengan benar.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Mengapa metrik seperti total unduhan kurang berguna untuk mengukur dampak?",
              pilihan: [
                "Karena angkanya selalu turun",
                "Karena naik hampir tanpa memberi informasi apa pun",
                "Karena sangat sulit diukur",
                "Karena tidak bisa dihitung oleh sistem",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kelompok metrik mana yang lebih berguna untuk menilai dampak?",
              pilihan: [
                "Total unduhan aplikasi",
                "Jumlah pengguna aktif harian saja",
                "Konversi, retensi, dan waktu menuju nilai pertama",
                "Jumlah halaman yang dibuka",
              ],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Apa yang harus selalu menyertai sebuah angka metrik?",
              pilihan: [
                "Komparator: periode lalu, cohort, atau kelompok kontrol",
                "Warna grafik yang konsisten",
                "Nama dashboard",
                "Jumlah total pengguna",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Mengapa pengukuran sebelum rilis itu penting?",
              pilihan: [
                "Agar angka bisa dinaikkan",
                "Tanpa pengukuran awal, perubahan tidak bisa dikaitkan dengan rilis",
                "Agar laporan terlihat lebih panjang",
                "Karena diwajibkan oleh manajemen",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },
  {
    slug: "devops-cloud-cicd",
    judul: "DevOps: CI/CD, Docker, dan Cloud",
    deskripsi:
      "Alur kerja modern untuk engineer: pipeline CI/CD, containerization, deployment, secrets, dan monitoring. Menjadikan rilis tidak menegangkan saraf.",
    tags: [
      "devops",
      "infrastructure",
      "cloud",
      "docker",
      "kubernetes",
      "automation",
      "scalable",
      "systems",
      "engineer",
      "server",
    ],
    level: "menengah",
    track: "cyber-sec",
    modul: [
      {
        judul: "Container dengan Docker",
        ringkasan: "Image kecil, reproducible, dan aman.",
        durasi_min: 270,
        kuis: {
          judul: "Kuis: Container dengan Docker",
          deskripsi: "Menguji keputusan yang menentukan kualitas image Docker.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Mengapa package.json disalin dan dependensi dipasang SEBELUM kode sumber disalin ke image?",
              pilihan: [
                "Agar ukuran image lebih kecil",
                "Agar lapisan dependensi bisa di-cache dan build berikutnya lebih cepat",
                "Agar container lebih aman",
                "Karena Docker mewajibkan urutan itu",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Sebagai user apa proses di dalam container sebaiknya dijalankan?",
              pilihan: ["root", "User non-root", "User sistem host", "Daemon Docker"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Di mana secret TIDAK boleh diletakkan?",
              pilihan: [
                "Di dalam image",
                "Disuntikkan saat runtime",
                "Di variabel lingkungan saat runtime",
                "Di secret manager",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan:
                "Apa yang paling murah diperbaiki untuk mempercepat build image?",
              pilihan: [
                "Menambah jumlah CPU mesin",
                "Urutan dan cache layer pada Dockerfile",
                "Mengganti registry",
                "Menghapus test",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Pipeline CI/CD",
        ringkasan: "Dari commit ke produksi, dengan gerbang yang bisa dipercaya.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: Pipeline CI/CD",
          deskripsi: "Menguji tahap pipeline dan aturan promosi artefak antar environment.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Aturan penting apa yang berlaku untuk artefak yang dipromosikan antar environment?",
              pilihan: [
                "Artefak harus identik di semua environment",
                "Artefak boleh dibuild ulang di tiap environment",
                "Artefak cukup mirip saja",
                "Artefak tidak perlu dipromosikan",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Mengapa membuild ulang saat deploy itu bermasalah?",
              pilihan: [
                "Karena boros sumber daya",
                "Karena yang diuji bukan yang benar-benar dijalankan",
                "Karena pipeline menjadi lebih cepat",
                "Karena tidak ada rollback",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Tahap apa yang sebaiknya dijalankan lebih dulu agar gagal lebih awal?",
              pilihan: ["Deploy ke produksi", "Lint dan typecheck", "Monitoring", "Rollback"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa deployment sebaiknya dilakukan bertahap?",
              pilihan: [
                "Agar pipeline terlihat sibuk",
                "Agar rollback sudah teruji dan dampak kegagalan bisa dibatasi",
                "Agar test tidak perlu dijalankan",
                "Karena penyedia cloud mewajibkannya",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Secrets dan Konfigurasi",
        ringkasan: "Konfigurasi per environment dan secret yang tidak bocor.",
        durasi_min: 270,
        kuis: {
          judul: "Kuis: Secrets dan Konfigurasi",
          deskripsi: "Menguji penanganan secret dan pemisahan konfigurasi per environment.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Bagaimana secret yang pernah ter-commit ke repository harus dianggap?",
              pilihan: [
                "Aman selama repository privat",
                "Bocor dan harus segera diganti (dirotasi)",
                "Aman karena sudah dihapus dari commit terakhir",
                "Aman karena sudah di-encrypt di git",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kapan sebuah secret sebaiknya disuntikkan ke aplikasi?",
              pilihan: [
                "Saat build image",
                "Saat runtime",
                "Saat commit",
                "Saat menjalankan test unit",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan:
                "Menghapus baris secret dari commit terakhir berarti apa terhadap keamanannya?",
              pilihan: [
                "Secret sudah aman sepenuhnya",
                "History masih menyimpannya, jadi secret tetap harus dirotasi",
                "Tidak perlu tindakan apa pun",
                "Repository menjadi lebih cepat",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Bagaimana prinsip konfigurasi antar environment yang benar?",
              pilihan: [
                "Kode sama, nilai konfigurasi berbeda",
                "Kode berbeda untuk setiap environment",
                "Konfigurasi di-hardcode di dalam image",
                "Satu konfigurasi dipakai untuk semua environment",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Monitoring",
        ringkasan: "Tahu ada masalah sebelum user memberi tahu.",
        durasi_min: 300,
        kuis: {
          judul: "Kuis: Monitoring",
          deskripsi: "Menguji cara membuat alert yang benar-benar berguna.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa masalah utama dari alert yang tidak memerlukan tindakan?",
              pilihan: [
                "Menghabiskan ruang penyimpanan",
                "Melatih tim untuk mengabaikan alert, sehingga alert penting berhenti bekerja",
                "Memperlambat aplikasi",
                "Hanya menambah biaya cloud",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Alert sebaiknya didasarkan pada apa?",
              pilihan: [
                "Penggunaan CPU yang tinggi",
                "Dampak terhadap pengguna",
                "Jumlah baris log",
                "Suhu server",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Metrik latensi mana yang lebih informatif?",
              pilihan: ["Rata-rata", "p99 (persentil ke-99)", "Nilai minimum", "Hanya median"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang wajib dimiliki setiap alert?",
              pilihan: [
                "Warna merah yang mencolok",
                "Penanggung jawab dan langkah yang bisa dijalankan",
                "Tabel histori panjang",
                "Grafik yang beranimasi",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },
  {
    slug: "qa-test-automation",
    judul: "QA Engineer: Test Automation dan Quality Gate",
    deskripsi:
      "Keahlian QA yang diminta lowongan software QA engineer: merancang test case dari risiko, automation framework, regression suite, dan gerbang rilis.",
    tags: ["quality", "qa", "test", "testing", "automation", "regression"],
    level: "menengah",
    track: "web-dev",
    modul: [
      {
        judul: "Merancang Test Case",
        ringkasan: "Test case dari risiko, bukan dari jumlah.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Merancang Test Case",
          deskripsi: "Menguji cara menurunkan test case dari risiko, bukan dari jumlah tombol.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Dari mana test case sebaiknya dirancang?",
              pilihan: [
                "Dari jumlah tombol yang terlihat di UI",
                "Dari apa yang paling berbahaya jika gagal",
                "Dari jumlah baris kode",
                "Dari daftar komponen di repo",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Nilai batas apa yang biasanya perlu diuji lewat tabel kombinasi?",
              pilihan: [
                "Nol, satu, banyak, dan negatif",
                "Hanya nilai normal",
                "Hanya nilai maksimum",
                "Nilai acak saja",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa prinsip penting sebuah test case yang baik?",
              pilihan: [
                "Memuat sebanyak mungkin assertion",
                "Punya satu alasan gagal yang jelas",
                "Menutup seluruh fitur sekaligus",
                "Tidak perlu assertion",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Manakah contoh skenario gagal yang perlu diuji?",
              pilihan: [
                "Input tidak valid, jaringan putus, dan klik ganda",
                "Hanya alur bahagia (happy path)",
                "Hanya tampilan visual",
                "Hanya kombinasi warna",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Automation Framework",
        ringkasan: "Pisahkan test yang menguji antarmuka dari test yang menguji logika.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Automation Framework",
          deskripsi: "Menguji bentuk piramida test dan penanganan test yang rapuh.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Bagaimana bentuk piramida test yang seimbang?",
              pilihan: [
                "Banyak test end to end, sedikit unit test",
                "Banyak unit test, lebih sedikit integration test, sedikit end to end",
                "Semua test berupa end to end",
                "Hanya test integration",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang harus dilakukan terhadap test yang flaky?",
              pilihan: [
                "Diulang tanpa batas sampai lulus",
                "Diperbaiki atau dimatikan",
                "Timeout-nya dinaikkan saja",
                "Dibiarkan begitu saja",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa ciri unit test yang baik?",
              pilihan: [
                "Lambat tetapi lengkap",
                "Cepat, stabil, dan menangkap logika",
                "Bergantung pada jaringan",
                "Menunggu animasi UI",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa test yang sering gagal (flaky) itu berbahaya?",
              pilihan: [
                "Karena menambah biaya listrik",
                "Karena tidak menambah keyakinan dan melatih tim mengabaikannya",
                "Karena memperlambat CI",
                "Karena menghabiskan memori",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Test API dan Database",
        ringkasan: "Menguji kontrak dan memverifikasi efeknya.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Test API dan Database",
          deskripsi: "Menguji verifikasi kontrak respons dan efek samping ke database.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Mengapa respons dengan status 200 belum tentu benar?",
              pilihan: [
                "Karena status 200 hanya kode status, isi body-nya bisa salah",
                "Karena 200 sebenarnya berarti error",
                "Karena 200 selalu salah",
                "Karena 200 tidak terdefinisi di HTTP",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Selain status code, apa yang harus diperiksa pada respons API?",
              pilihan: [
                "Warna tombol",
                "Skema body dan header",
                "Nama penguji",
                "Waktu server saja",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa verifikasi efek samping ke database itu penting?",
              pilihan: [
                "Agar respons lebih cepat",
                "Agar baris yang ditulis benar-benar ada dan data lain tidak ikut berubah",
                "Agar status code menjadi 200",
                "Agar header respons benar",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan:
                "Apa yang perlu diuji ketika operasi yang sama dipanggil dua kali?",
              pilihan: ["Warna", "Idempotensi", "Kecepatan jaringan", "Ukuran payload"],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Quality Gate",
        ringkasan: "Mencegah rilis rusak, bukan mencatatnya setelah terjadi.",
        durasi_min: 180,
        kuis: {
          judul: "Kuis: Quality Gate",
          deskripsi: "Menguji gerbang kualitas dan isi laporan defect yang bisa ditindaklanjuti.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa ciri gerbang kualitas yang berguna?",
              pilihan: [
                "Banyak tetapi longgar",
                "Sedikit tetapi tegas",
                "Tidak ada sama sekali",
                "Hanya berupa dokumentasi",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang wajib ada di laporan defect?",
              pilihan: [
                "Pendapat pribadi penulis",
                "Langkah reproduksi yang bisa diulang tanpa bertanya",
                "Jumlah baris kode yang diubah",
                "Nama branch git",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Informasi lingkungan apa yang perlu dicantumkan di laporan defect?",
              pilihan: [
                "OS, versi aplikasi, dan akun",
                "Warna tema",
                "Ukuran font",
                "Nama repository saja",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Gerbang apa yang tidak perlu dinegosiasikan sebelum merge?",
              pilihan: [
                "Test wajib hijau sebelum merge",
                "Review desain",
                "Rapat harian",
                "Estimasi sprint",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },
  {
    slug: "database-sql-fundamental",
    judul: "Database: SQL, Normalisasi, dan Performa Query",
    deskripsi:
      "Fondasi database untuk engineer dan analis: SQL tingkat lanjut, normalisasi, indeks, transaksi, dan cara menjaga kueri tetap cepat saat data bertambah.",
    tags: ["database", "sql", "postgresql", "mysql", "query", "performance", "systems"],
    level: "dasar",
    track: "data",
    modul: [
      {
        judul: "SQL yang Dipakai Sehari-hari",
        ringkasan: "SELECT, JOIN, subquery, dan CTE.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: SQL yang Dipakai Sehari-hari",
          deskripsi: "Menguji urutan pemrosesan kueri dan penggunaan JOIN, subquery, serta CTE.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Manakah urutan pemrosesan kueri yang benar (bukan urutan penulisannya)?",
              pilihan: [
                "SELECT sebelum WHERE",
                "FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT",
                "WHERE sebelum FROM",
                "ORDER BY sebelum WHERE",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Klausa mana yang memfilter hasil agregasi?",
              pilihan: ["WHERE", "HAVING", "LIMIT", "ORDER BY"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa CTE berguna untuk kueri yang panjang?",
              pilihan: [
                "Karena selalu lebih cepat",
                "Karena membuat kueri panjang bisa diuji per bagian",
                "Karena menghapus kebutuhan indeks",
                "Karena menambah baris secara otomatis",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Alternatif apa yang lebih baik daripada subquery di dalam SELECT?",
              pilihan: [
                "Subquery bersarang yang lebih dalam",
                "Derived table atau JOIN",
                "Cursor",
                "Trigger",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Normalisasi",
        ringkasan: "Bentuk pertama sampai ketiga, dan kapan menyimpang dengan sadar.",
        durasi_min: 180,
        kuis: {
          judul: "Kuis: Normalisasi",
          deskripsi: "Menguji aturan bentuk normal 1NF–3NF dan konsekuensinya.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa aturan bentuk normal pertama (1NF)?",
              pilihan: [
                "Tidak ada dependensi transitif terhadap kunci utama",
                "Satu nilai per kolom, tanpa daftar di dalam teks",
                "Setiap non-key bergantung pada seluruh kunci utama",
                "Semua kolom boleh bernilai null",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa aturan bentuk normal kedua (2NF)?",
              pilihan: [
                "Setiap atribut non-key bergantung pada seluruh kunci utama",
                "Satu nilai per kolom",
                "Tidak ada dependensi transitif",
                "Semua foreign key harus dihapus",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa aturan bentuk normal ketiga (3NF)?",
              pilihan: [
                "Satu nilai per kolom",
                "Tidak ada dependensi transitif terhadap kunci utama",
                "Setiap kolom harus unik",
                "Tidak boleh ada tabel gabungan",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa efek samping normalisasi bila diterapkan tanpa disiplin?",
              pilihan: [
                "Selalu mempercepat kueri",
                "Menambah kompleksitas",
                "Menghapus data secara otomatis",
                "Membuat kolom hilang",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Indeks",
        ringkasan: "Memahami urutan eksekusi sebelum menambah indeks.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Indeks",
          deskripsi: "Menguji cara memakai indeks berdasarkan plan eksekusi, bukan tebakan.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa yang harus dilakukan SEBELUM menambah indeks?",
              pilihan: [
                "Langsung menambah indeks pada semua kolom",
                "Membaca plan eksekusi terlebih dahulu",
                "Menghapus tabel lalu membuat ulang",
                "Me-restart database",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa efek samping dari menambah indeks?",
              pilihan: [
                "Tidak ada efek samping sama sekali",
                "Memperlambat operasi penulisan",
                "Menghapus data lama",
                "Mengunci semua baris secara permanen",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Bagaimana indeks komposit memperlakukan urutan kolom?",
              pilihan: [
                "Urutan kolom tidak pernah penting",
                "Indeks komposit mengikuti urutan kolom yang ditentukan",
                "Kolom selalu diurutkan menurut abjad",
                "Hanya kolom terakhir yang dipakai",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa itu UNIQUE constraint?",
              pilihan: [
                "Sekadar dokumentasi tanpa efek",
                "Indeks sekaligus aturan yang menjamin keunikan nilai",
                "Sebuah trigger",
                "Sebuah view",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Transaksi",
        ringkasan: "Isolation level, lock, dan deadlock.",
        durasi_min: 180,
        kuis: {
          judul: "Kuis: Transaksi",
          deskripsi: "Menguji anomali transaksi dan pengaruh isolation level.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa yang dimaksud dengan dirty read?",
              pilihan: [
                "Membaca perubahan yang belum di-commit",
                "Baris baru muncul di antara dua SELECT",
                "Dua transaksi saling menunggu",
                "Baris berubah di antara dua SELECT",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa yang dimaksud dengan phantom read?",
              pilihan: [
                "Membaca data yang belum di-commit",
                "Baris baru muncul di antara dua SELECT",
                "Baris yang sama berubah di antara dua SELECT",
                "Dua transaksi saling menunggu",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang dimaksud dengan deadlock?",
              pilihan: [
                "Dua transaksi saling menunggu satu sama lain",
                "Membaca data yang belum di-commit",
                "Baris berubah di antara dua SELECT",
                "Lock yang dilepas terlalu cepat",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa dampak memilih isolation level yang lebih tinggi?",
              pilihan: [
                "Selalu menambah throughput",
                "Mengurangi anomali tetapi menurunkan throughput",
                "Tidak berdampak apa pun",
                "Menghapus kebutuhan akan lock",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },
  {
    slug: "data-analyst-sql-reporting",
    judul: "Data Analyst: SQL, Metrik, dan Reporting",
    deskripsi:
      "Keterampilan yang paling sering diminta di lowongan data analyst Indonesia: SQL analitik, definisi metrik yang konsisten, dashboard yang terbaca, dan presentasi temuan.",
    tags: ["data", "analyst", "analytics", "sql", "reporting", "metrics"],
    level: "dasar",
    track: "data",
    modul: [
      {
        judul: "SQL untuk Analitik",
        ringkasan: "JOIN, agregasi, window function, dan kueri lambat.",
        durasi_min: 270,
        kuis: {
          judul: "Kuis: SQL untuk Analitik",
          deskripsi: "Menguji pola SQL analitik yang menutup hampir semua kebutuhan.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Kesalahan JOIN apa yang paling merusak ketika menjumlahkan nilai?",
              pilihan: [
                "JOIN tanpa alias tabel",
                "JOIN satu ke banyak lalu menjumlahkan, sehingga totalnya menggembung",
                "JOIN disertai klausa WHERE",
                "JOIN pada kolom primary key",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa kegunaan window function dalam analitik?",
              pilihan: [
                "Menghapus baris duplikat secara otomatis",
                "Membandingkan baris dengan periode sebelumnya tanpa menggabungkan hasilnya",
                "Membuat indeks baru",
                "Mengunci tabel saat dibaca",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Klausa mana yang memfilter hasil agregasi?",
              pilihan: ["WHERE", "HAVING", "LIMIT", "GROUP BY"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Untuk membuat metrik bersyarat, apa yang dipakai?",
              pilihan: ["FILTER dan CASE WHEN", "ORDER BY", "UNION", "TRIGGER"],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Definisi Metrik",
        ringkasan: "Satu angka, satu definisi, satu pemilik.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Definisi Metrik",
          deskripsi: "Menguji pentingnya definisi metrik yang konsisten dan bisa ditelusuri.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Mengapa satu istilah seperti 'users' yang bermakna berbeda di dua dashboard menjadi masalah?",
              pilihan: [
                "Karena kueri menjadi lebih lambat",
                "Karena tim berhenti percaya pada angka",
                "Karena penyimpanan cepat penuh",
                "Karena warnanya berbeda",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang harus ditetapkan secara eksplisit dalam definisi metrik?",
              pilihan: [
                "Warna grafik",
                "Periode dan zona waktu",
                "Nama tabel sumber",
                "Jumlah kolom",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Selain definisi, apa yang perlu disebutkan pada dokumentasi metrik?",
              pilihan: [
                "Apa yang tidak termasuk dalam angka tersebut",
                "Nama pembuat dashboard",
                "Harga server",
                "Versi database",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Angka seperti apa yang tidak layak dipakai?",
              pilihan: [
                "Angka yang nilainya besar",
                "Angka yang tidak bisa ditelusuri sumbernya",
                "Angka yang berbentuk desimal",
                "Angka yang dinyatakan dalam persen",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Dashboard yang Terbaca",
        ringkasan: "Satu layar, satu pertanyaan bisnis.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Dashboard yang Terbaca",
          deskripsi: "Menguji prinsip menata dashboard agar membantu keputusan.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Bagaimana sebaiknya grafik dikelompokkan di dalam dashboard?",
              pilihan: [
                "Per sumber data",
                "Per pertanyaan yang ingin dijawab",
                "Per warna",
                "Per tabel database",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Di mana angka utama sebaiknya diletakkan?",
              pilihan: [
                "Di bagian bawah",
                "Di atas, dengan detail di bawahnya",
                "Di sidebar",
                "Di footer",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Kapan pie chart sebaiknya dihindari?",
              pilihan: [
                "Ketika irisannya kurang dari tiga",
                "Ketika irisannya lebih dari tiga",
                "Ketika grafiknya berwarna",
                "Ketika ukurannya kecil",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang membuat dashboard sulit dibaca?",
              pilihan: [
                "Terlalu sedikit grafik",
                "Menumpuk banyak grafik sehingga memindahkan pekerjaan analisis ke pembaca",
                "Adanya pembanding periode lalu",
                "Menaruh angka utama di atas",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Presentasi Temuan",
        ringkasan: "Temuan, bukti, dan rekomendasi yang bisa ditindaklanjuti.",
        durasi_min: 270,
        kuis: {
          judul: "Kuis: Presentasi Temuan",
          deskripsi: "Menguji struktur presentasi temuan yang menghasilkan keputusan.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Bagian presentasi temuan apa yang paling sering terlewat?",
              pilihan: [
                "Temuan",
                "Mengapa (hipotesis penyebab)",
                "Bukti",
                "Rekomendasi",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang harus disertakan pada bagian bukti?",
              pilihan: [
                "Hanya angka mentah",
                "Angka pendukung beserta pembandingnya",
                "Opini pribadi",
                "Daftar tools yang dipakai",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Rekomendasi yang baik berisi apa?",
              pilihan: [
                "Ide yang masih umum",
                "Tindakan spesifik dengan pemilik dan dampaknya",
                "Daftar pertanyaan terbuka",
                "Ringkasan tools",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa akibat dari temuan yang tanpa implikasi?",
              pilihan: [
                "Tidak menghasilkan keputusan",
                "Membuat laporan lebih pendek",
                "Menambah akurasi angka",
                "Mengurangi biaya server",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },
  {
    slug: "mobile-flutter-dart",
    judul: "Flutter dan Dart untuk Aplikasi Mobile",
    deskripsi:
      "Flutter dan Dart untuk Android dan iOS dari satu basis kode: widget, state management, integrasi platform, dan performa build.",
    tags: ["flutter", "mobile", "dart", "developer"],
    level: "menengah",
    track: "web-dev",
    modul: [
      {
        judul: "Dart yang Perlu Dikuasai",
        ringkasan: "Tipe, null safety, dan async yang bersih.",
        durasi_min: 210,
        kuis: {
          judul: "Kuis: Dart yang Perlu Dikuasai",
          deskripsi: "Menguji null safety, tipe, dan primitif asynchronous di Dart.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Di Dart, apa arti tanda tanya pada tipe seperti String?",
              pilihan: [
                "Menandai bahwa tipe itu nullable (boleh null)",
                "Membuat nilainya konstan",
                "Menandai variabel sebagai final",
                "Menandai tipe generik",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan:
                "Kata kunci apa untuk variabel non-null yang diinisialisasi belakangan?",
              pilihan: ["late", "final", "const", "static"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Tipe apa yang mewakili kerja asynchronous yang menghasilkan satu nilai?",
              pilihan: ["Future", "Stream", "List", "Map"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Manakah pernyataan yang benar tentang sistem tipe Dart?",
              pilihan: [
                "int adalah primitif yang tidak punya metode",
                "Semua tipe adalah objek dan num terpisah dari int",
                "num identik dengan int",
                "String bukan sebuah objek",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Widget dan State",
        ringkasan: "Immutable widget dan di mana state sebaiknya hidup.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Widget dan State",
          deskripsi: "Menguji pembagian state lokal, state aplikasi, dan state server di Flutter.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa kesalahan yang paling sering terjadi terkait state server?",
              pilihan: [
                "Memakai setState untuk menyimpan state server",
                "Memakai const pada widget",
                "Memakai provider",
                "Memakai stream",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Di mana state lokal widget sebaiknya disimpan?",
              pilihan: [
                "Di provider global",
                "Di widget itu sendiri untuk hal-hal lokal",
                "Di database",
                "Di server",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Di mana state aplikasi sebaiknya hidup?",
              pilihan: [
                "Di setiap widget secara terpisah",
                "Di provider di atas pohon widget",
                "Di file konfigurasi",
                "Di server saja",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa widget yang mengambil data langsung itu bermasalah?",
              pilihan: [
                "Karena terlalu cepat dirender",
                "Karena sulit diuji",
                "Karena tidak bisa dirender sama sekali",
                "Karena selalu kehabisan memori",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Integrasi Platform",
        ringkasan: "Kanal native, izin, dan ukuran build.",
        durasi_min: 270,
        kuis: {
          judul: "Kuis: Integrasi Platform",
          deskripsi: "Menguji apa yang bisa dibagi antar platform dan pengaturan izin native.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa yang bisa dibagi bersama antar platform di Flutter?",
              pilihan: ["Logika", "Izin", "Navigasi", "Notifikasi"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Di mana konfigurasi izin platform didefinisikan?",
              pilihan: [
                "pubspec.yaml",
                "AndroidManifest.xml dan Info.plist",
                "main.dart",
                "build.gradle saja",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa izin perlu dijelaskan di antarmuka aplikasi?",
              pilihan: [
                "Agar aplikasi berjalan lebih cepat",
                "Agar pengguna memahami dan aplikasi lolos review toko aplikasi",
                "Agar ukuran build mengecil",
                "Agar warnanya konsisten",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa build sebaiknya dipisah per arsitektur?",
              pilihan: [
                "Agar ukuran unduhan tetap masuk akal",
                "Agar kode menjadi lebih pendek",
                "Agar warnanya benar",
                "Agar tidak perlu menjalankan test",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Performa Build",
        ringkasan: "Mulai lambat, frame jatuh, dan build yang membesar.",
        durasi_min: 240,
        kuis: {
          judul: "Kuis: Performa Build",
          deskripsi: "Menguji diagnosis dan perbaikan frame yang jatuh di Flutter.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa langkah pertama sebelum menebak penyebab aplikasi lambat?",
              pilihan: [
                "Mengganti framework",
                "Mengukur dulu, misalnya dengan flame chart",
                "Menambah RAM perangkat",
                "Menghapus fitur",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Berapa target waktu per frame agar animasi tetap mulus?",
              pilihan: ["8 ms", "16 ms", "100 ms", "1 detik"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Bagaimana cara mengurangi rebuild subtree yang tidak perlu?",
              pilihan: [
                "Pakai const pada widget",
                "Panggil setState sesering mungkin",
                "Bungkus dengan Future",
                "Pakai GlobalKey",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Untuk gambar besar di daftar panjang, apa yang diperlukan?",
              pilihan: ["cacheWidth", "setState", "const", "Stream"],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },
];
