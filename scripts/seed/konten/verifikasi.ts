/**
 * Seed konten untuk kursus verifikasi `verifikasi-blok-kode-cpp` — kursus
 * sementara yang dipakai untuk memverifikasi bahwa blok kode C++ benar-benar
 * bisa dikompilasi dan dijalankan lewat runner platform.
 *
 * Kursus ini **sudah ada** di katalog dengan satu modul ("Modul 1 Halo C++")
 * yang punya dua halaman kurasi. Karena itu modul tersebut ditulis **tanpa**
 * `halaman` — halaman yang sudah ada dibiarkan utuh — dan hanya dilengkapi satu
 * kuis. Dua modul berikutnya sengaja ditambahkan sebagai contoh nyata pemrograman
 * C++ yang bisa dijalankan di platform, masing-masing dengan halaman prosa dan
 * kuis sendiri.
 *
 * Setiap blok `dapatDijalankan: true` di bawah ini sudah diuji lewat runner
 * (`:8021`) dan `outputHarapan`-nya disalin persis dari `stdout` yang keluar.
 */

import { h2, h3, kode, li, p, q, type KursusSeed } from "./tipen";

export const KURSUS_VERIFIKASI: KursusSeed[] = [
  {
    slug: "verifikasi-blok-kode-cpp",
    judul: "Verifikasi Blok Kode C++",
    deskripsi:
      "Kursus sementara untuk memverifikasi bahwa blok kode C++ bisa dikompilasi dan dijalankan langsung di peramban, dari program pertama hingga percabangan dan perulangan.",
    tags: ["C++", "dasar pemrograman", "verifikasi"],
    level: "dasar",
    track: "web-dev",
    /**
     * `draft`, bukan `published`.
     *
     * Ini kursus perkakas, bukan kursus yang ditawarkan: ia ada supaya blok kode
     * C++ terbukti bisa dikompilasi runner, dan tidak pernah dimaksudkan muncul
     * di daftar `/belajar` sebelah kursus sungguhan. `katalogBelajar()` hanya
     * membaca kursus `published`, jadi `draft` menariknya dari katalog **dan**
     * dari rute reader sekaligus (`/belajar/[slug]` maupun `/materi/[modulId]`
     * mencari lewat katalog yang sama). Ia tetap terlihat di daftar kursus admin
     * dan bisa dipratinjau dari sana.
     *
     * Untuk membukanya kembali sementara — mis. memverifikasi blok kode lewat
     * peramban — ubah ke `published`, jalankan ulang seed ini, lalu kembalikan.
     */
    status: "draft",
    modul: [
      // -----------------------------------------------------------------------
      // Modul yang SUDAH ADA — dipertahankan tanpa `halaman`, hanya ditambah kuis.
      // -----------------------------------------------------------------------
      {
        judul: "Modul 1 Halo C++",
        ringkasan: "Menyalin, membaca, dan memahami program C++ pertama.",
        durasi_min: 30,
        // Halaman 1 diambil alih seed **hanya** untuk membetulkan
        // `outputHarapan` yang salah: keluaran aslinya berakhir baris baru,
        // sedangkan nilai lama tidak memuatnya, sehingga peserta yang menekan
        // Jalankan melihat "keluaran berbeda" pada program yang benar. Halaman 2
        // sengaja tidak disebut, jadi isinya dibiarkan utuh oleh engine.
        halaman: [
          {
            judul: "Halaman 1 - Kode C++",
            blok: [
              kode({
                dapatDijalankan: true,
                stdin: "Budi",
                outputHarapan: "Halo, Budi! Angka 42\n",
                kode: `#include <iostream>
#include <string>
// komentar baris: menyapa pengguna
/* komentar blok
   dua baris penuh */
int main() {
  const int angka = 42;
  std::string nama;
  std::getline(std::cin, nama);
  char awal = 'B';
  std::cout << "Halo, " << nama << "! Angka " << angka << '\\n';
  return 0;
}`,
              }),
              kode({
                dapatDijalankan: false,
                kode: `#include <iostream>
int main() { std::cout << "Hi\\n"; }`,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Modul 1 Halo C++",
          deskripsi: "Memastikan kamu memahami pondasi program C++ pertama.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Header mana yang harus disertakan agar `std::cout` bisa dipakai?",
              pilihan: ["<iostream>", "<string>", "<cstdio>", "<vector>"],
              jawaban_benar: 0,
            },
            {
              pertanyaan:
                "Nilai kembalian apa yang ditulis `return 0;` di akhir `main` dan apa artinya?",
              pilihan: [
                "`0` — menandakan program berakhir tanpa galat",
                "`1` — menandakan program sukses",
                "`0` — menandakan program gagal",
                "Tidak ada artinya, hanya hiasan",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan:
                "Manakah pernyataan yang benar untuk mencetak teks lalu pindah baris?",
              pilihan: [
                'std::cout << "Hai\\n";',
                'cout("Hai");',
                'print("Hai");',
                'std::print["Hai"];',
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "`std::cout` berada di dalam namespace apa?",
              pilihan: ["std", "main", "iostream", "cpp"],
              jawaban_benar: 0,
            },
          ],
        },
      },

      // -----------------------------------------------------------------------
      // Modul BARU 1 — Variabel dan tipe data.
      // -----------------------------------------------------------------------
      {
        judul: "Variabel dan Tipe Data C++",
        ringkasan:
          "Mendeklarasikan variabel, memilih tipe dasar yang tepat, memakai std::string dan const, serta membaca dan menulis data dengan std::cin dan std::cout.",
        durasi_min: 45,
        halaman: [
          {
            judul: "Variabel, Tipe, dan const",
            blok: [
              h2("Setiap nilai punya tipe"),
              p(
                "Variabel di C++ adalah nama untuk sebuah kotak di memori yang menampung nilai bertipe tertentu. Tipe menentukan berapa besar ruang yang dipakai dan operasi apa yang masuk akal dilakukan. Untuk pemula, empat tipe dasar ini sudah cukup untuk hampir semua latihan.",
              ),
              li(
                "`int` — bilangan bulat, misalnya `20` atau `-7`.",
                "`double` — bilangan pecahan, misalnya `3.14159`.",
                "`char` — satu karakter tunggal, misalnya `'A'`.",
                "`bool` — nilai benar/salah, hanya `true` atau `false`.",
              ),
              p(
                "Teks, seperti nama orang, tidak ditampung di `char` (yang hanya satu karakter) melainkan di `std::string`, sebuah tipe dari pustaka standar yang perlu header `<string>`.",
              ),
              h3("Membaca dan menulis"),
              p(
                "Program C++ yang berguna hampir selalu berinteraksi: ia membaca masukan dengan `std::cin >> variabel` dan menulis hasilnya dengan `std::cout << nilai`. Perhatikan bahwa `>>` mengarah ke variabel (data masuk) dan `<<` mengarah ke `cout` (data keluar).",
              ),
              kode({
                kode: `#include <iostream>
#include <string>

int main() {
    std::string nama;
    int umur;
    std::cin >> nama >> umur;

    const double PI = 3.14159;
    std::cout << "Halo, " << nama << "!\\n";
    std::cout << "Umur tahun depan: " << umur + 1 << "\\n";
    std::cout << "Nilai PI: " << PI << "\\n";
    return 0;
}`,
                dapatDijalankan: true,
                stdin: "Budi 20\n",
                outputHarapan: `Halo, Budi!
Umur tahun depan: 21
Nilai PI: 3.14159
`,
              }),
              p(
                "Jalankan contoh di atas. Program membaca dua nilai dari masukan (nama dan umur), menghitung umur tahun depan dengan `umur + 1`, lalu mencetaknya baris demi baris.",
              ),
              q(
                "`const` bukan sekadar catatan: setelah `const double PI = 3.14159;`, baris yang mencoba mengubah `PI` akan ditolak oleh compiler.",
              ),
            ],
          },
          {
            judul: "Membaca masukan dengan std::cin",
            blok: [
              h2("Operator >> berhenti di spasi"),
              p(
                "`std::cin >> teks` membaca satu kata — ia berhenti pada spasi, tab, atau baris baru. Untuk membaca satu kata saja, perilaku ini justru menguntungkan. Bila kamu perlu satu baris utuh, gunakan `std::getline(std::cin, baris)`.",
              ),
              p(
                "Setelah membaca sebuah `std::string`, kamu bisa memakai method-nya. Salah satu yang paling sering dipakai adalah `.length()` yang mengembalikan jumlah karakter.",
              ),
              kode({
                kode: `#include <iostream>
#include <string>

int main() {
    std::string nama;
    std::cin >> nama;
    std::cout << "Selamat datang, " << nama << "!\\n";
    std::cout << "Panjang nama: " << nama.length() << " karakter\\n";
    return 0;
}`,
                dapatDijalankan: true,
                stdin: "Careevo\n",
                outputHarapan: `Selamat datang, Careevo!
Panjang nama: 7 karakter
`,
              }),
              li(
                "`std::cin >> nama` membaca satu kata dari masukan.",
                "`nama.length()` mengembalikan jumlah karakter, bukan indeks terakhir.",
                "`\\n` di dalam string berarti pindah baris.",
              ),
              p(
                "Karena masukan untuk contoh ini adalah `Careevo`, panjang yang dicetak adalah 7. Coba ubah `stdin` menjadi namamu dan perhatikan hasilnya berubah.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Variabel dan Tipe Data C++",
          deskripsi: "Menguji pemahaman tipe dasar, const, std::string, dan alur masukan/keluaran.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Tipe mana yang paling tepat untuk menampung bilangan bulat?",
              pilihan: ["double", "int", "std::string", "bool"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa makna `const` pada `const double PI = 3.14159;`?",
              pilihan: [
                "Nilai `PI` boleh diubah kapan saja",
                "`PI` hanya bisa dibaca, tidak bisa diubah setelah diinisialisasi",
                "`PI` dihitung ulang setiap kali dipakai",
                "`PI` menjadi variabel global",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Header mana yang menyediakan tipe `std::string`?",
              pilihan: ["<iostream>", "<string>", "<cstdlib>", "<cmath>"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang dilakukan `std::cin >> nama;`?",
              pilihan: [
                "Mencetak isi `nama` ke layar",
                "Membaca satu kata dari masukan ke dalam `nama`",
                "Menghapus isi `nama`",
                "Membandingkan `nama` dengan masukan",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },

      // -----------------------------------------------------------------------
      // Modul BARU 2 — Percabangan dan perulangan.
      // -----------------------------------------------------------------------
      {
        judul: "Percabangan dan Perulangan",
        ringkasan:
          "Mengendalikan alur program dengan if/else dan switch, lalu mengulang pekerjaan dengan for dan while sambil memakai break dan continue secara tepat.",
        durasi_min: 45,
        halaman: [
          {
            judul: "Percabangan: if, else, dan switch",
            blok: [
              h2("Memilih satu dari beberapa jalur"),
              p(
                "`if` menjalankan blok hanya bila kondisinya benar. Bila tidak, `else if` memeriksa kondisi berikutnya, dan `else` menangkap semua sisa kemungkinan. Kondisi harus berupa ekspresi `bool`, misalnya `umur >= 18`.",
              ),
              li(
                "`if (kondisi) { ... }` — jalankan bila benar.",
                "`else if (kondisi) { ... }` — periksa kemungkinan lain.",
                "`else { ... }` — jalur terakhir bila semua salah.",
              ),
              h3("switch untuk banyak nilai diskret"),
              p(
                "Ketika kamu membandingkan satu nilai terhadap beberapa kemungkinan tetap, `switch` lebih rapi daripada rantai `if/else` yang panjang. Setiap `case` diakhiri `break` agar eksekusi tidak jatuh ke case berikutnya.",
              ),
              kode({
                kode: `#include <iostream>

int main() {
    int pilihan = 2;
    switch (pilihan) {
        case 1:
            std::cout << "Menu satu\\n";
            break;
        case 2:
            std::cout << "Menu dua\\n";
            break;
        default:
            std::cout << "Menu lain\\n";
            break;
    }
    return 0;
}`,
                dapatDijalankan: true,
                stdin: "",
                outputHarapan: `Menu dua
`,
              }),
              p(
                "Karena `pilihan` bernilai `2`, program mencetak `Menu dua`. Coba ubah nilai `pilihan` menjadi `1` atau `3` dan jalankan lagi untuk melihat `case` lain bekerja.",
              ),
              q(
                "Lupa menulis `break` di dalam `switch` membuat eksekusi berlanjut ke case berikutnya — sumber bug klasik yang harus kamu hafal.",
              ),
            ],
          },
          {
            judul: "Perulangan: for, while, break, continue",
            blok: [
              h2("for untuk jumlah iterasi yang pasti"),
              p(
                "`for` memadatkan tiga hal dalam satu baris: nilai awal, kondisi lanjut, dan langkah tiap iterasi. Bentuk `for (int i = 1; i <= 6; ++i)` berjalan untuk `i` bernilai 1 sampai 6.",
              ),
              p(
                "Di dalam loop kamu bisa mengatur alur dengan `continue` (lewati sisa iterasi ini, lanjut ke iterasi berikutnya) dan `break` (keluar dari loop sepenuhnya).",
              ),
              kode({
                kode: `#include <iostream>

int main() {
    int jumlah = 0;
    for (int i = 1; i <= 6; ++i) {
        if (i % 2 == 0) continue;
        jumlah += i;
        std::cout << "i = " << i << ", jumlah = " << jumlah << "\\n";
    }
    std::cout << "Total ganjil: " << jumlah << "\\n";
    return 0;
}`,
                dapatDijalankan: true,
                stdin: "",
                outputHarapan: `i = 1, jumlah = 1
i = 3, jumlah = 4
i = 5, jumlah = 9
Total ganjil: 9
`,
              }),
              p(
                "Karena `i % 2 == 0` memicu `continue`, semua bilangan genap dilewati. Yang tersisa dan dijumlahkan hanyalah 1, 3, dan 5 — totalnya 9.",
              ),
              h2("while untuk kondisi yang belum pasti"),
              p(
                "Bila jumlah iterasi belum diketahui di awal, `while` lebih tepat. Selama kondisinya benar, blok diulang. Jangan lupa mengubah nilai yang diperiksa, kalau tidak loop tidak akan pernah berhenti.",
              ),
              kode({
                kode: `#include <iostream>

int main() {
    int n = 5;
    while (n > 0) {
        if (n == 3) {
            std::cout << "melewati 3\\n";
            n = n - 1;
            continue;
        }
        std::cout << "n = " << n << "\\n";
        n = n - 1;
    }
    std::cout << "selesai\\n";
    return 0;
}`,
                dapatDijalankan: true,
                stdin: "",
                outputHarapan: `n = 5
n = 4
melewati 3
n = 2
n = 1
selesai
`,
              }),
              q(
                "Setiap `while` harus punya jalan keluar: pastikan sesuatu di dalamnya benar-benar berubah menuju kondisi berhenti.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Percabangan dan Perulangan",
          deskripsi: "Menguji if/else, switch, for, while, break, dan continue.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan:
                "Keyword apa yang melewati sisa badan loop dan langsung lanjut ke iterasi berikutnya?",
              pilihan: ["break", "continue", "return", "goto"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Keyword apa yang menghentikan loop sepenuhnya?",
              pilihan: ["continue", "break", "skip", "stop"],
              jawaban_benar: 1,
            },
            {
              pertanyaan:
                "Percabangan mana yang paling tepat untuk membandingkan satu nilai dengan beberapa kemungkinan tetap?",
              pilihan: ["switch", "while", "for", "continue"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Berapa kali `for (int i = 0; i < 3; ++i)` menjalankan badannya?",
              pilihan: ["2 kali", "3 kali", "4 kali", "Tidak pernah"],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },
];
