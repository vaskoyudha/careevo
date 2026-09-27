/**
 * Seed kursus "Dasar C++" — kursus pertama yang seluruh contoh di dalamnya
 * benar-benar bisa dijalankan peserta lewat blok `kode`.
 *
 * Pakai: `npx tsx scripts/seed-kursus-dasar-cpp.mts`
 *
 * ## Kenapa kursus ini ada
 *
 *-Blok `kode` yang bisa dijalankan adalah fitur terbaru di platform ini, dan
 * kursus ini adalah yang pertama memakainya. Kalau satu contoh saja gagal
 * dikompilasi, pengajarannya jadi: "tombol Jalankan tidak bisa dipercaya".
 * Karena itu setiap `outputHarapan` di bawah **diperiksa lewat runner sungguhan**
 * (`src/lib/exec/runner/server.mjs`), bukan dikira-kira dari membaca kode.
 * Ulangi sendiri setelah menyunting apa pun di sini.
 *
 * Tiga halaman sengaja `dapatDijalankan: false`. Bukan karena lupa, dan bukan
 * karena kodenya kedaluwarsa: dua di antaranya belum diisi (kode latihan) dan satu
 * memang bukan program (pseudocode). Sakelar itu berarti sesuatu hanya kalau
 * ada kasus yang benar-benar tidak bisa dijalankan. Kalau tidak, peserta yang
 * menekan Jalankan di situ akan belajar bahwa tombolnya kadang bohong.
 *
 * ## Idempoten lewat pencocokan, bukan lewat "buat lalu lupakan"
 *
 * Jalankan berkali-kali aman: kursus dicocokkan dari slug, modul dari judul, dan
 * halaman dari judul. Isi yang ada diperbarui, sisanya dibuang. Jadi skrip ini
 * bukan "seed sekali lalu mati" — ia juga alat menyunting: ubah teks di sini,
 * jalankan, dan `data/courses.json` menyusul.
 *
 * Id blok dibuat dari posisi (m1-h2-b3) dan **tidak** diacak, karena
 * `petaSection()` memetakan tautan `#anchor` lewat id blok. Id yang berubah
 * setiap kali skrip dijalankan akan memutus semua tautan balik di daftar isi.
 *
 * `data/courses.json` gitignored, jadi hasil run ini lokal. Yang tersimpan di
 * repo adalah skrip ini, supaya kursus bisa dibangun ulang di mesin lain.
 */

import {
  createCourse,
  createHalaman,
  createModul,
  deleteHalaman,
  deleteModul,
  getCourseBySlug,
  listCourses,
  listHalaman,
  listModul,
  updateCourse,
  updateHalaman,
  updateModul,
} from "@/lib/courses/store";
import type { BlokInput, CreateHalamanInput } from "@/types/course";
import type { Course } from "@/types/course";

const SLUG = "dasar-cpp";

/** Seberapa lama satu modul — tiga halaman, dibaca lalu dijalankan satu per satu. */
const DURASI_PER_MODUL = 30;

// ---------------------------------------------------------------------------
// Bentuk blok
// ---------------------------------------------------------------------------

const p = (teks: string): BlokInput => ({ tipe: "paragraf", segmen: [{ teks }] });
const h2 = (teks: string): BlokInput => ({ tipe: "heading", level: 2, segmen: [{ teks }] });
const h3 = (teks: string): BlokInput => ({ tipe: "heading", level: 3, segmen: [{ teks }] });
const li = (...butir: string[]): BlokInput => ({
  tipe: "daftar",
  butir: butir.map((teks) => [{ teks }]),
});
const q = (teks: string): BlokInput => ({ tipe: "kutipan", segmen: [{ teks }] });

interface KodeSeed {
  kode: string;
  dapatDijalankan: boolean;
  /** Hanya diisi kalau programnya benar-benar membaca masukan. */
  stdin?: string;
  /** Keluaran yang sudah diverifikasi lewat runner. */
  outputHarapan?: string;
}

/**
 * Blok kode.
 *
 * `bahasa` selalu diisi walau opsional di tipe: `blokSchema` mewajibkannya,
 * dan blok yang lewat jalur ini tanpa `bahasa` akan ditolak begitu someday
 * disimpan lewat form admin.
 */
const kode = (seed: KodeSeed): BlokInput => ({
  tipe: "kode",
  bahasa: "cpp",
  dapatDijalankan: seed.dapatDijalankan,
  kode: seed.kode,
  ...(seed.stdin !== undefined ? { stdin: seed.stdin } : {}),
  ...(seed.outputHarapan !== undefined ? { outputHarapan: seed.outputHarapan } : {}),
});

/** Halaman yang bisa dijalankan: blok kodenya sudah diverifikasi. */
const jalankan = (sumber: string, masukan: string, keluaran: string): KodeSeed => ({
  kode: sumber,
  dapatDijalankan: true,
  stdin: masukan,
  outputHarapan: keluaran,
});

interface ModulSeed {
  judul: string;
  ringkasan: string;
  halaman: Array<{ judul: string; blok: BlokInput[] }>;
}

// ---------------------------------------------------------------------------
// Isi kursus
// ---------------------------------------------------------------------------

const KURSUS: { title: string; description: string; tags: string[]; modul: ModulSeed[] } = {
  title: "Dasar C++",
  description:
    "Kursus pengantar C++ yang bisa langsung dicoba. Setiap halaman membawa satu contoh program yang benar-benar bisa kamu ubah dan jalankan langsung di dalam browser. Kamu akan paham bentuk program C++, cara menyimpan dan membaca data, membuat program memilih jalan, mengulang pekerjaan, dan memecahnya jadi fungsi.",
  tags: ["cpp", "pemrograman", "dasar"],
  modul: [
    {
      judul: "Menulis Program Pertama",
      ringkasan:
        "Bentuk paling dasar program C++: fungsi main, mencetak teks dan angka, serta menganotasi kode dengan komentar.",
      halaman: [
        {
          judul: "Program C++ yang pertama",
          blok: [
            h2("Tiga bagian yang wajib ada"),
            p(
              "Setiap program C++ punya minimal satu fungsi bernama main. Di situ program dimulai dan di situ ia berakhir. Dua hal lain ikut wajib: header iostream supaya std::cout dikenali oleh kompilator, dan return 0 di akhir main untuk memberi tahu sistem operasi bahwa program selesai tanpa galat.",
            ),
            p("Contoh paling kecil yang sudah benar:"),
            kode(
              jalankan(
                `#include <iostream>

int main() {
    // std::cout adalah jalan keluar program: di situ teks ditampilkan.
    std::cout << "Halo, dunia!" << std::endl;

    // Tanda << menggabungkan keluaran, bukan menambah spasi otomatis.
    std::cout << "Selamat" << " belajar" << " C++" << std::endl;

    return 0;
}
`,
                "",
                "Halo, dunia!\nSelamat belajar C++\n",
              ),
            ),
            p("Tekan Jalankan. Isi panel keluaran sama persis dengan yang tertulis di Keluaran yang diharapkan."),
            li(
              "Header iostream memberi tahu kompilator bahwa program ini memakai fasilitas keluaran dan masukan.",
              "int main() adalah titik awal program. Tipe int di depannya berarti fungsi ini mengembalikan satu bilangan bulat ke sistem operasi.",
              "return 0 mengembalikan angka nol. Kode nol berarti sukses, bukan galat.",
              "std::endl menutup baris dan membuat baris baru.",
            ),
            q(
              "Kalau programmu gagal dikompilasi, hampir selalu karena ada titik koma yang hilang atau salah nama. Baca peringatan kompilator dari baris pertama yang disebut, bukan dari yang terakhir.",
            ),
          ],
        },
        {
          judul: "Kerangka program",
          blok: [
            h2("Salin ini setiap kali mulai program baru"),
            p(
              "Kotak di bawah adalah kerangka paling sering dipakai. Isinya sengaja dibiarkan kosong, karena isinya adalah pekerjaanmu.",
            ),
            kode({
              dapatDijalankan: false,
              kode: `#include <iostream>

// Setiap program C++ punya tepat satu fungsi main.
int main() {
    // Tulis programmu di baris berikutnya.
    // Contoh: std::cout << "Halo" << std::endl;

    return 0;
}
`,
            }),
            p(
              "Blok ini sengaja tidak punya tombol Jalankan. Program yang belum diisi memang bisa dijalankan, tapi ia hanya mencetak kosong — dan itu tidak mengajarkan apa pun. Yang berguna justru menyalin kerangka ini ke editor, lalu mengisi baris di dalam kurung kurawal.",
            ),
            h3("Dua bentuk komentar"),
            li(
              "Dua garis miring berlaku sampai akhir baris saja. Bentuk inilah yang dipakai hampir selalu.",
              "Blok yang dibuka /* dan ditutup dengan */ berlaku sampai beberapa baris sekaligus. Bentuk ini jarang dipakai, dan tidak boleh saling bertumpuk.",
            ),
            q(
              "Komentar ditulis untuk pembaca berikutnya, dan pembaca berikutnya sering kali kamu sendiri enam bulan lagi.",
            ),
          ],
        },
        {
          judul: "Mencetak angka dan teks",
          blok: [
            h2("Hanya tanda kutip yang membedakan keduanya"),
            p(
              "std::cout tidak peduli apakah yang kamu kirim angka atau teks. Yang membedakan keduanya cuma satu: teks diapit tanda kutip, angka tidak.",
            ),
            kode(
              jalankan(
                `#include <iostream>

int main() {
    int umur = 17;
    double tinggi = 1.72;

    // Angka tidak perlu tanda kutip; cout sudah tahu tipenya.
    std::cout << "Umur: " << umur << " tahun" << std::endl;
    std::cout << "Tinggi: " << tinggi << " meter" << std::endl;

    // Hitung dulu, baru cetak. Tanda kurung menentukan urutan perhitungan.
    int tahunLahir = 2026 - umur;
    std::cout << "Tahun lahir: " << tahunLahir << std::endl;

    return 0;
}
`,
                "",
                "Umur: 17 tahun\nTinggi: 1.72 meter\nTahun lahir: 2009\n",
              ),
            ),
            li(
              "Teks selalu diapit dua tanda kutip, misalnya \"Halo\".",
              "Angka ditulis polos, misalnya 17. Kalau ditulis dengan tanda kutip, yang tersimpan adalah karakter, bukan bilangan.",
              "Karakter khusus seperti \\n (baris baru) juga bisa dipakai sebagai ganti std::endl.",
            ),
            q(
              "Satu baris cout boleh memuat banyak tulisan dan angka, dipisahkan tanda << sebanyak yang kamu perlukan.",
            ),
          ],
        },
      ],
    },
    {
      judul: "Variabel dan Masukan",
      ringkasan:
        "Memberi nama pada angka dan teks supaya bisa dipakai ulang, lalu membacanya dari keyboard supaya program bisa menjawab.",
      halaman: [
        {
          judul: "Menyimpan data dengan nama",
          blok: [
            h2("Kotak berlabel di memori"),
            p(
              "Variabel adalah tempat menyimpan satu nilai yang punya nama. Nama itu dipakai supaya programmu tidak bergantung pada urutan baris. C++ punya beberapa tipe dasar, dan tiap tipe punya aturan sendiri tentang nilai apa yang boleh masuk ke dalamnya.",
            ),
            kode(
              jalankan(
                `#include <iostream>
#include <string>

int main() {
    // int untuk bilangan bulat, double untuk pecahan.
    int jumlahKursus = 5;
    double nilaiRata = 87.5;

    // Teks perlu header string, dan ditulis di dalam tanda kutip.
    std::string kategori = "pemrograman";

    std::cout << "Jumlah kursus: " << jumlahKursus << std::endl;
    std::cout << "Nilai rata-rata: " << nilaiRata << std::endl;
    std::cout << "Kategori: " << kategori << std::endl;

    // const berarti nilai ini mengunci diri sejak ditulis.
    const int tahunDibuat = 2026;
    std::cout << "Tahun dibuat: " << tahunDibuat << std::endl;

    return 0;
}
`,
                "",
                "Jumlah kursus: 5\nNilai rata-rata: 87.5\nKategori: pemrograman\nTahun dibuat: 2026\n",
              ),
            ),
            li(
              "int menyimpan bilangan bulat: 3, -12, 1000.",
              "double menyimpan pecahan: 3.5, -0.25.",
              "string menyimpan teks dan bisa diubah isinya setelah dibuat.",
              "bool hanya punya dua nilai yang mungkin: true atau false.",
              "char menyimpan tepat satu karakter, dan ditulis dengan satu tanda kutip.",
            ),
            q(
              "Gunakan const untuk setiap nilai yang memang tidak pernah berubah. Program yang lebih banyak const lebih mudah dibaca, karena pembaca langsung tahu mana yang boleh diasumsikan tetap.",
            ),
          ],
        },
        {
          judul: "Membaca masukan dari keyboard",
          blok: [
            h2("std::cin adalah pasangan std::cout"),
            p(
              "std::cout menulis ke layar, std::cin membaca dari keyboard. Program baru bisa ber-balik dengan orang yang menjalankannya setelah cin ada, dan itulah yang membuat program terasa hidup.",
            ),
            kode(
              jalankan(
                `#include <iostream>
#include <string>

int main() {
    std::string nama;
    int umur;

    // Tanda << hanya mencetak; tanda >> hanya membaca.
    std::cout << "Siapa namamu? ";
    std::cin >> nama;

    std::cout << "Berapa umurmu? ";
    std::cin >> umur;

    std::cout << "Halo, " << nama << "! Kamu " << umur << " tahun." << std::endl;

    return 0;
}
`,
                "Rina\n21\n",
                "Siapa namamu? Berapa umurmu? Halo, Rina! Kamu 21 tahun.\n",
              ),
            ),
            h3("Kenapa pertanyaannya tercetak menempel"),
            p(
              "Pertanyaan yang dicetak dengan cout tidak diakhiri baris baru, jadi jawaban yang diketik muncul tepat setelahnya. Tambahkan std::endl kalau mau pertanyaannya berdiri sendiri.",
            ),
            p(
              "std::cin >> nama hanya membaca sampai spasi pertama. Kalau yang dibaca bisa mengandung spasi, misalnya nama lengkap, pakainya std::getline(std::cin, nama) sebagai gantinya.",
            ),
            q(
              "Pastikan banyaknya nilai yang dibaca sama dengan banyaknya nilai yang diketik. Program yang membaca lebih banyak akan menunggu sampai batas 10 detik habis, dan itu bukan hang — itu programmu yang salah.",
            ),
          ],
        },
        {
          judul: "Menghitung dengan variabel",
          blok: [
            h2("Operasi aritmetika, dan satu yang sering menipu"),
            p(
              "Operator aritmetika di C++ sama dengan yang biasa dipakai di kalkulator: tambah, kurang, kali, dan bagi. Satu perbedaan yang sering mengejutkan pemula ada di pembagian.",
            ),
            kode(
              jalankan(
                `#include <iostream>

int main() {
    int panjang = 12;
    int lebar = 5;

    int hasilTambah = panjang + lebar;
    int hasilKali = panjang * lebar;

    // Dua bilangan bulat membagi dengan cara membuang bagian desimalnya.
    int hasilBagi = panjang / lebar;

    // Ubah salah satu sisi jadi double supaya bagian desimalnya ikut terlihat.
    double hasilBagiDesimal = static_cast<double>(panjang) / lebar;

    std::cout << "Panjang + lebar = " << hasilTambah << std::endl;
    std::cout << "Panjang * lebar = " << hasilKali << std::endl;
    std::cout << "Panjang / lebar = " << hasilBagi << std::endl;
    std::cout << "Panjang / lebar (desimal) = " << hasilBagiDesimal << std::endl;

    return 0;
}
`,
                "",
                "Panjang + lebar = 17\nPanjang * lebar = 60\nPanjang / lebar = 2\nPanjang / lebar (desimal) = 2.4\n",
              ),
            ),
            li(
              "Sisa pembagian ditulis dengan tanda persen: 7 % 3 bernilai 1.",
              "static_cast<double>(panjang) mengubah satu nilai menjadi double tanpa mengubah variabelnya.",
            ),
            q(
              "Dua belas dibagi lima bernilai 2.4, bukan 2. Kalau kamu butuh bagian desimalnya, pastikan salah satu sisinya sudah double sebelum pembagian dilakukan.",
            ),
          ],
        },
      ],
    },
    {
      judul: "Percabangan",
      ringkasan:
        "Membuat program mengambil jalan berbeda tergantung syarat yang kamu tuliskan, lalu menggabungkan beberapa syarat jadi satu keputusan.",
      halaman: [
        {
          judul: "If dan else",
          blok: [
            h2("Ketika program harus memilih jalannya"),
            p(
              "Sejauh ini program kita melakukan hal yang sama setiap kali dijalankan. if membuatnya bisa memilih: jalankan bagian ini kalau syaratnya benar, kalau tidak jalankan bagian yang lain.",
            ),
            kode(
              jalankan(
                `#include <iostream>

int main() {
    int umur;
    std::cout << "Masukkan umur: ";
    std::cin >> umur;

    // Kurung kurawal menandai apa yang harus dijalankan kalau syaratnya benar.
    if (umur >= 17) {
        std::cout << "Kamu boleh membuat SIM." << std::endl;
    } else {
        // else hanya berjalan kalau semua syarat di atas tidak terpenuhi.
        std::cout << "Kamu belum boleh membuat SIM." << std::endl;
    }

    return 0;
}
`,
                "20\n",
                "Masukkan umur: Kamu boleh membuat SIM.\n",
              ),
            ),
            li(
              "Syarat di dalam kurung boleh berupa perbandingan apa saja: lebih besar, lebih kecil, sama dengan, atau tidak sama dengan.",
              "Kurung kurawal menandai awal dan akhir bagian yang dijalankan kalau syaratnya benar.",
              "else tidak perlu kurung kurawal, dan hanya boleh ada satu untuk tiap if.",
            ),
            q(
              "Tidak perlu menulis if kalau syaratnya sudah pasti benar. Kode yang jujur — if (true) — lebih mudah dibaca daripada if yang sebenarnya tidak melakukan apa pun.",
            ),
          ],
        },
        {
          judul: "Menggabungkan beberapa syarat",
          blok: [
            h2("Tiga operator untuk menggabungkan kondisi"),
            p(
              "Kadang satu syarat belum cukup. Dua operator yang paling sering dipakai menggabungkan beberapa kondisi: && berarti dan, || berarti atau. Ada satu lagi, yaitu ! yang berarti bukan.",
            ),
            kode(
              jalankan(
                `#include <iostream>

int main() {
    int umur;
    double saldo;

    std::cout << "Masukkan umur: ";
    std::cin >> umur;
    std::cout << "Masukkan saldo: ";
    std::cin >> saldo;

    // Simpan tiap syarat lebih dulu supaya baris if tetap pendek.
    bool cukupUmur = umur >= 17;
    bool cukupSaldo = saldo >= 50000;

    if (cukupUmur && cukupSaldo) {
        std::cout << "Boleh naik bus sendirian." << std::endl;
    } else if (cukupSaldo || cukupUmur) {
        // Diperiksa hanya kalau kondisi pertama tidak terpenuhi.
        std::cout << "Boleh naik, tapi harus ditemani." << std::endl;
    } else {
        std::cout << "Belum boleh naik." << std::endl;
    }

    return 0;
}
`,
                "20\n60000\n",
                "Masukkan umur: Masukkan saldo: Boleh naik bus sendirian.\n",
              ),
            ),
            p(
              "Urutan baris itu penting. else if hanya diperiksa kalau semua if sebelumnya gagal, jadi syarat yang paling umum ditulis paling atas supaya tidak pernah ikut diperiksa kalau memang tidak perlu.",
            ),
            q(
              "Kalau satu syarat sudah cukup untuk memutuskan, jangan menggabungkannya. Syarat yang berlebihan dituliskan karena tidak yakin, bukan karena memang perlu.",
            ),
          ],
        },
        {
          judul: "Aturan nilai akhir",
          blok: [
            h2("Tulis aturannya dulu, baru tulis kodenya"),
            p(
              "Sebelum menulis satu baris if pun, tulis dulu aturannya dalam bahasa biasa: syaratnya apa, dan hasilnya apa. Bukan C++, hanya daftar syarat dan akibatnya. Bentuk seperti ini disebut pseudocode, dan tugas berikutnya adalah menerjemahkannya menjadi C++.",
            ),
            kode({
              dapatDijalankan: false,
              kode: `SETIAP nilai_akhir dihitung dari tiga nilai: nilai_materi, nilai_tugas, nilai_ujian.
Tentukan dulu rata_rata = (nilai_materi + nilai_tugas + nilai_ujian) / 3.

JIKA nilai_ujian < 60 MAKA
    hasil = "tidak lulus"
LAIN JIKA rata_rata >= 85 MAKA
    hasil = "A"
LAIN JIKA rata_rata >= 75 MAKA
    hasil = "B"
LAIN JIKA rata_rata >= 60 MAKA
    hasil = "C"
LAIN JIKA
    hasil = "D"
AKHIR JIKA
`,
            }),
            p(
              "Blok ini sengaja tidak punya tombol Jalankan: isinya pseudocode, bukan program, jadi memang tidak ada yang bisa dikompilasi. Coba terjemahkan sendiri aturan di atas menjadi C++, lalu jalankan di compiler mana pun untuk memastikan hasilmu sama.",
            ),
            h3("Yang perlu diperhatikan saat menerjemahkan"),
            li(
              "Huruf besar di sini ditulis sebagai huruf kecil di C++. JIKA menjadi if, LAIN JIKA menjadi else if, AKHIR JIKA menjadi tanda kurung penutup.",
              "Nilai dengan tanda kutip di sini — hasil = \"A\" — tetap perlu tanda kutip di C++, karena itu teks.",
              "Kurung kurawal dipakai untuk setiap cabang, bukan cuma yang terakhir.",
            ),
            q(
              "Bug yang paling mahal di kelas sering muncul dari program yang jalan, tapi salah. Aturan yang ditulis sebelum kode membuat bug seperti itu jauh lebih mudah ditemukan.",
            ),
          ],
        },
      ],
    },
    {
      judul: "Perulangan",
      ringkasan:
        "Mengulangi pekerjaan tanpa menyalin baris yang sama berulang kali, lalu memakainya untuk menjumlahkan dan menghitung.",
      halaman: [
        {
          judul: "Perulangan for",
          blok: [
            h2("Ketika kita tahu berapa kali harus mengulang"),
            p(
              "for dipakai saat banyaknya perulangan sudah diketahui. Ia punya tiga bagian yang dipisahkan titik koma: nilai awal, syarat yang harus tetap benar supaya perulangan jalan, dan perubahan yang terjadi setiap putaran.",
            ),
            kode(
              jalankan(
                `#include <iostream>

int main() {
    // Mulai dari 1, jalan selama angka masih 5 atau kurang, tambah 1 tiap putar.
    for (int angka = 1; angka <= 5; angka++) {
        std::cout << "Langkah ke-" << angka << std::endl;
    }

    // Hitung mundur juga bisa: cukup kurangi, bukan tambah.
    for (int hitung = 3; hitung >= 1; hitung--) {
        std::cout << "Tinggal " << hitung << " detik" << std::endl;
    }

    return 0;
}
`,
                "",
                "Langkah ke-1\nLangkah ke-2\nLangkah ke-3\nLangkah ke-4\nLangkah ke-5\nTinggal 3 detik\nTinggal 2 detik\nTinggal 1 detik\n",
              ),
            ),
            li(
              "Syarat di tengah diperiksa sebelum tiap putaran, bukan sesudahnya. Karena itu angka 5 masih ikut tercetak di perulangan pertama.",
              "Kalau syaratnya pernah salah sejak awal, badan perulangan tidak dijalankan sama sekali.",
              "Urutannya bebas. Menambah satu, mengurang satu, atau menambah dua sama sahnya.",
            ),
            q(
              "Mulai dari 1 dan berakhir di 5 memakai angka <= 5. Mulai dari 0 dan berakhir di 4 memakai angka < 5. Dua cara itu menghasilkan jumlah perulangan yang berbeda, dan salah satunya akan membuat programmu meleset satu langkah.",
            ),
          ],
        },
        {
          judul: "Perulangan while",
          blok: [
            h2("Ketika kita belum tahu berapa kali harus mengulang"),
            p(
              "while dipakai saat banyaknya perulangan tidak diketahui di awal, tapi kita tahu kapan harus berhenti. Ia hanya punya satu syarat, dan syarat itu diperiksa sebelum badan perulangan dijalankan — persis seperti if.",
            ),
            kode(
              jalankan(
                `#include <iostream>

int main() {
    int poin;
    std::cout << "Masukkan poin: ";
    std::cin >> poin;

    // Kita tidak tahu akan jalan berapa kali: yang penting berhenti saat poin habis.
    int langkah = 0;
    while (poin > 0) {
        poin = poin - 10;
        langkah = langkah + 1;
    }

    std::cout << "Butuh " << langkah << " langkah." << std::endl;

    return 0;
}
`,
                "35\n",
                "Masukkan poin: Butuh 4 langkah.\n",
              ),
            ),
            h3("Aturan yang tidak boleh dilanggar"),
            p(
              "Selalu ada satu baris di dalam badan while yang mengubah nilai yang diperiksa. Kalau tidak ada baris seperti itu, syaratnya tidak akan pernah berubah dan programmu akan berjalan sampai batas 10 detik habis. Itu bukan hang — itu programmu yang salah.",
            ),
            q(
              "Pakai for kalau jumlahnya jelas, pakai while kalau jumlahnya muncul dari datanya. Campur keduanya tanpa alasan hanya membuat program lebih sulit dibaca.",
            ),
          ],
        },
        {
          judul: "Menjumlahkan dengan perulangan",
          blok: [
            h2("Pola yang sama untuk semua pekerjaan berulang"),
            p(
              "Perulangan paling berguna bukan untuk mencetak angka berulang, tapi untuk menjumlahkan, menghitung, atau mencari sesuatu. Polanya selalu sama: siapkan satu variabel dengan nilai awal sebelum perulangan, lalu ubah variabel itu di dalam setiap putaran.",
            ),
            kode(
              jalankan(
                `#include <iostream>

int main() {
    int batas = 10;

    // Accumulator: sengaja dibuat nol di luar perulangan, lalu diisi berulang.
    int jumlah = 0;
    for (int angka = 1; angka <= batas; angka++) {
        jumlah = jumlah + angka;
    }
    std::cout << "Jumlah 1 sampai " << batas << " adalah " << jumlah << std::endl;

    // Perulangan kedua memakai accumulator yang berbeda, dengan syarat di dalam.
    int jumlahKelipatanTiga = 0;
    for (int angka = 1; angka <= batas; angka++) {
        if (angka % 3 == 0) {
            jumlahKelipatanTiga = jumlahKelipatanTiga + angka;
        }
    }
    std::cout << "Jumlah kelipatan 3: " << jumlahKelipatanTiga << std::endl;

    return 0;
}
`,
                "",
                "Jumlah 1 sampai 10 adalah 55\nJumlah kelipatan 3: 18\n",
              ),
            ),
            li(
              "Accumulator yang ditulis di dalam perulangan akan selalu bernilai satu pada akhir program. Itu sebabnya ia disiapkan sebelum perulangan dimulai.",
              "Syarat angka % 3 == 0 berarti angka habis dibagi 3, yaitu kelipatan 3.",
              "Batas yang tidak ikut dihitung: 1 sampai 10 berarti 10 angka, bukan 9.",
            ),
            q(
              "Beri accumulator nama yang menjelaskan isinya — jumlahAngka lebih berguna daripada x. Nama yang buruk membuat program yang salah jadi sulit ditemukan.",
            ),
          ],
        },
      ],
    },
    {
      judul: "Fungsi",
      ringkasan:
        "Memecah program jadi bagian-bagian yang punya nama, bisa dipanggil berulang, dan bisa diuji sendiri.",
      halaman: [
        {
          judul: "Mendefinisikan fungsi",
          blok: [
            h2("Memberi nama pada satu bagian pekerjaan"),
            p(
              "Sampai sekarang semua program kita cuma punya satu fungsi. Fungsi lain membiarkan kamu memberi nama pada satu bagian pekerjaan, lalu memanggilnya sebanyak yang diperlukan, tanpa menyalin kodenya.",
            ),
            kode(
              jalankan(
                `#include <iostream>

// void di depan nama fungsi berarti: tidak ada nilai yang dikembalikan.
void tampilkanJudul() {
    std::cout << "=== Belajar C++ ===" << std::endl;
}

void sapa() {
    std::cout << "Halo dari fungsi sapa!" << std::endl;
}

int main() {
    // Fungsi dipanggil dengan menyebut namanya saja.
    tampilkanJudul();
    sapa();
    sapa();

    return 0;
}
`,
                "",
                "=== Belajar C++ ===\nHalo dari fungsi sapa!\nHalo dari fungsi sapa!\n",
              ),
            ),
            li(
              "Tipe di depan nama fungsi menentukan tipe nilai yang dikembalikannya. void berarti tidak ada nilai sama sekali.",
              "Tanda kurung kurawal adalah badan fungsi. Kode di dalamnya belum berjalan sampai fungsinya dipanggil.",
              "Fungsi yang melakukan dua hal sekaligus sebaiknya dipecah jadi dua, supaya namanya bisa dipilih dengan jujur.",
            ),
            q(
              "Kalau dua fungsi melakukan hal yang sama persis, salah satunya harus dihapus. Duplikasi pada kode yang kecil lebih merusak daripada pada kode yang besar, karena tidak terlihat dari jauh.",
            ),
          ],
        },
        {
          judul: "Parameter dan argumen",
          blok: [
            h2("Supaya fungsi bisa dipakai pada data apa saja"),
            p(
              "Fungsi yang selalu mengerjakan hal yang sama hanya jadi kode yang dipindah, bukan kode yang dipakai ulang. Parameter membuatnya bisa bekerja pada data apa pun, dan nama parameter sebaiknya menjelaskan isinya.",
            ),
            kode(
              jalankan(
                `#include <iostream>
#include <string>

// Parameter adalah data yang diterima fungsi.
void perHalo(const std::string& nama, int umur) {
    std::cout << "Halo, " << nama << "! Kamu " << umur << " tahun." << std::endl;
}

int main() {
    std::string nama;
    int umur;

    std::cout << "Nama: ";
    std::cin >> nama;
    std::cout << "Umur: ";
    std::cin >> umur;

    // Yang dikirim boleh variabel, atau nilai yang diketik langsung.
    perHalo(nama, umur);
    perHalo("Budi", 30);

    return 0;
}
`,
                "Rina\n21\n",
                "Nama: Umur: Halo, Rina! Kamu 21 tahun.\nHalo, Budi! Kamu 30 tahun.\n",
              ),
            ),
            li(
              "Tanda ampersand di depan nama parameter berarti teks itu diteruskan tanpa disalin. Untuk program sekecil ini, menulis std::string nama saja juga benar.",
              "const di depan parameter berarti fungsi itu tidak boleh mengubah nilainya.",
              "Nilai yang diketik langsung di tempat pemanggilan disebut argumen.",
            ),
            q(
              "Sebutkan nama parameter seperti apa isinya — perHalo(nama, umur) jauh lebih terbaca daripada perHalo(a, b). Nama parameter adalah dokumentasi yang tidak perlu ditulis terpisah.",
            ),
          ],
        },
        {
          judul: "Nilai yang dikembalikan",
          blok: [
            h2("return mengembalikan hasil ke pemanggil"),
            p(
              "Fungsi boleh mengembalikan satu nilai ke tempat yang memanggilnya. Begitu return dieksekusi, fungsi itu berhenti — apa pun yang ditulis setelahnya di baris yang sama tidak pernah dijalankan.",
            ),
            kode({
              dapatDijalankan: false,
              kode: `#include <iostream>

// Fungsi yang ditulis "int" harus mengembalikan satu bilangan bulat
// di setiap jalannya. Yang di bawah ini belum melakukannya.
int nilaiAkhir(int materi, int tugas, int ujian) {
    int rata = (materi + tugas + ujian) / 3;

    // TODO: kalau rata >= 85 kembalikan 4,
    //       kalau rata >= 75 kembalikan 3,
    //       kalau rata >= 60 kembalikan 2,
    //       dan untuk sisanya kembalikan 1.
}

int main() {
    // Baris di bawah baru berarti apa-apa setelah TODO di atas selesai.
    std::cout << "Nilai akhir: " << nilaiAkhir(80, 70, 90) << std::endl;

    return 0;
}
`,
            }),
            p(
              "Blok ini sengaja belum lengkap, jadi tombol Jalankan tidak muncul di sini. Kalau tombolnya dinyalakan sekarang, kompilasi tetap lolos dengan satu peringatan, lalu program berhenti dengan galat. Penyebabnya bukan kode yang salah ditulis, tapi belum adanya jalur yang mengembalikan nilai.",
            ),
            h3("Yang perlu dijaga"),
            li(
              "Tiap jalur keluar dari fungsi harus mengembalikan nilai. Kalau ada jalur yang jatuh sampai kurung penutup tanpa return, kompilasi tetap lolos dengan peringatan — dan hasilnya tidak bisa dipercayai.",
              "Nilai kembalian ditulis di dalam tanda kurung fungsi, bukan di dalam return di dalam main. Itulah yang membuat fungsi bisa diuji sendiri.",
              "Satu fungsi yang mengembalikan nilai bisa dipakai langsung di dalam perhitungan, misalnya cout << nilaiAkhir(80, 70, 90) + 1.",
            ),
            q(
              "Fungsi yang mengembalikan satu nilai saja lebih mudah dibaca dan lebih mudah diuji. Fungsi yang mengembalikan void sekaligus mengubah beberapa variabel di sekitarnya jauh lebih sulit dilacak.",
            ),
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Menjalankan
// ---------------------------------------------------------------------------

/** Beri id blok yang stabil supaya tautan #anchor tidak putus saat skrip diulang. */
function beriId(blok: BlokInput[], prefiks: string): BlokInput[] {
  return blok.map((item, index) => ({ ...item, id: `${prefiks}-b${index}` }));
}

/** Satu halaman dari seed, lengkap dengan id bloknya. */
function halamanSiap(seed: { judul: string; blok: BlokInput[] }, prefiks: string): CreateHalamanInput {
  return { judul: seed.judul, blok: beriId(seed.blok, prefiks) };
}

/**
 * Selaraskan modul yang sudah ada dengan seed.
 *
 * Dicocokkan dari **judul**, bukan dari id, karena id modul dibuat acak oleh
 * store setiap kali `createModul` dipanggil. Page yang tidak ada di seed
 * dihapus, jadi mengurangi jumlah halaman di sini juga mengurangi course.
 */
async function selaraskanModul(kursus: Course, indexModul: number, seed: ModulSeed) {
  const ada = await listModul(kursus.id);
  const posisi = ada.findIndex((m) => m.judul === seed.judul);

  const modul =
    posisi === -1
      ? await createModul(kursus.id, {
          judul: seed.judul,
          ringkasan: seed.ringkasan,
          durasi_min: DURASI_PER_MODUL,
          urutan: indexModul + 1,
        })
      : await updateModul(kursus.id, ada[posisi].id, {
          judul: seed.judul,
          ringkasan: seed.ringkasan,
          durasi_min: DURASI_PER_MODUL,
        });

  if (!modul) throw new Error(`modul gagal diselaraskan: ${SLUG} / ${seed.judul}`);

  const halaman = await listHalaman(kursus.id, modul.id);
  const dipakai = new Set<string>();

  for (const [indexHalaman, seedHalaman] of seed.halaman.entries()) {
    const prefiks = `${SLUG}-m${indexModul + 1}-h${indexHalaman + 1}`;
    const isi = halamanSiap(seedHalaman, prefiks);
    const lama = halaman.find((hal) => hal.judul === seedHalaman.judul);

    if (lama) {
      dipakai.add(lama.id);
      const hasil = await updateHalaman(kursus.id, modul.id, lama.id, isi);
      if (!hasil) throw new Error(`halaman gagal diperbarui: ${prefiks}`);
    } else {
      dipakai.add((await createHalaman(kursus.id, modul.id, isi))?.id ?? "");
    }
  }

  for (const hal of halaman) {
    if (!dipakai.has(hal.id)) await deleteHalaman(kursus.id, modul.id, hal.id);
  }
}

async function main() {
  const ada = await getCourseBySlug(SLUG);

  const kursus =
    ada ??
    (await createCourse({
      title: KURSUS.title,
      slug: SLUG,
      description: KURSUS.description,
      provider: "Careevo",
      type: "course",
      track: "web-dev",
      level: "dasar",
      tags: KURSUS.tags,
      // Kursus milik platform, jadi arahkan ke katalog internal, bukan URL luar.
      url: `/belajar/${SLUG}`,
      duration_min: KURSUS.modul.length * DURASI_PER_MODUL,
      is_free: true,
      status: "published",
    }));

  if (ada) {
    await updateCourse(kursus.id, {
      title: KURSUS.title,
      slug: SLUG,
      description: KURSUS.description,
      provider: "Careevo",
      type: "course",
      track: "web-dev",
      level: "dasar",
      tags: KURSUS.tags,
      url: `/belajar/${SLUG}`,
      duration_min: KURSUS.modul.length * DURASI_PER_MODUL,
      is_free: true,
      status: "published",
    });
    console.log(`  ~ ${KURSUS.title} (diputar ulang, bukan diduplikasi)`);
  } else {
    console.log(`  + ${KURSUS.title}`);
  }

  for (const [indexModul, seedModul] of KURSUS.modul.entries()) {
    await selaraskanModul(kursus, indexModul, seedModul);
  }

  // Modul sisa: hapus hanya yang tidak ada di seed, supaya mengurangi
  // jumlah modul di sini ikut mengurangi jumlah halaman di course.
  const modulSekarang = await listModul(kursus.id);
  const judulModulSeed = new Set(KURSUS.modul.map((m) => m.judul));
  for (const modul of modulSekarang) {
    if (!judulModulSeed.has(modul.judul)) await deleteModul(kursus.id, modul.id);
  }

  const total = (await listCourses()).filter((c) => c.slug === SLUG).length;
  const blokKode = KURSUS.modul.flatMap((m) => m.halaman).filter((h) => h.blok.some((b) => b.tipe === "kode"));
  const bisaJalan = blokKode.filter((h) => h.blok.find((b) => b.tipe === "kode")?.dapatDijalankan === true);

  console.log(
    `\nkursus "${SLUG}": ${KURSUS.modul.length} modul, ${blokKode.length} halaman, ` +
      `${bisaJalan.length} bisa dijalankan, ${blokKode.length - bisaJalan.length} hanya contoh, ` +
      `total kursus dengan slug ini: ${total}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
