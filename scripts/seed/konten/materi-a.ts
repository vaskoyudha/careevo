/**
 * Seed konten materi gelombang A — entri fixture `r1`–`r6`.
 *
 * Enam entri ini dulunya hanya "fixture resource" (artikel) tanpa modul
 * tersimpan, sehingga halaman `/belajar/<slug>` kosong. Berkas ini memberi
 * setiap entri `id` eksplisit (menutup fixture dengan id yang sama lewat dedup
 * `katalogBelajar`) beserta kurikulum nyata: 2 modul, tiap modul 2 halaman prosa
 * berformat dan 1 kuis 4 soal.
 *
 * Topiknya bukan C++, jadi seluruh blok kode ditulis sebagai contoh **baca
 * saja** (`kode({ kode })` tanpa `dapatDijalankan`) — runner platform ini hanya
 * mengompilasi C++.
 */

import { h2, h3, kode, li, p, q, type KursusSeed } from "./tipen";

export const KURSUS_MATERI_A: KursusSeed[] = [
  // -------------------------------------------------------------------------
  // r1 — Belajar HTML & CSS dari Nol
  // -------------------------------------------------------------------------
  {
    id: "r1",
    slug: "r1",
    judul: "Belajar HTML & CSS dari Nol",
    deskripsi:
      "Mulai dari nol: menyusun struktur halaman dengan HTML yang semantik, lalu menghiasinya dengan CSS. Kamu akan memahami box model, selektor, spesifisitas, dan tata letak responsif dengan Flexbox.",
    tags: ["HTML", "CSS"],
    level: "dasar",
    track: "web-dev",
    provider: "MDN",
    durasi_min: 120,
    modul: [
      {
        judul: "Struktur HTML dan Semantik",
        ringkasan:
          "Kerangka wajib sebuah dokumen HTML, peran setiap bagian, dan cara memilih elemen yang bermakna bagi manusia maupun mesin.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Anatomi Dokumen HTML",
            blok: [
              h2("Kerangka wajib sebuah halaman"),
              p(
                "Setiap dokumen HTML dimulai dengan deklarasi `<!DOCTYPE html>` yang memberi tahu peramban bahwa ini adalah HTML5. Setelah itu seluruh isi dibungkus elemen `<html>`, yang terbagi dua: `<head>` untuk metadata dan `<body>` untuk konten yang benar-benar terlihat.",
              ),
              kode({
                kode: `<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Halaman Pertama</title>
  </head>
  <body>
    <h1>Halo, dunia</h1>
    <p>Ini paragraf pertama saya.</p>
  </body>
</html>`,
              }),
              p(
                "Elemen `<head>` tidak ditampilkan, tetapi menentukan banyak hal: judul yang muncul di tab, penyandian karakter, dan tautan ke berkas CSS. Karena itu ia harus ada di setiap halaman.",
              ),
              li(
                "`<!DOCTYPE html>` memicu mode standar peramban, bukan mode quirks.",
                "`<meta charset=\"utf-8\">` memastikan huruf beraksen tampil benar.",
                "`<title>` adalah judul halaman di tab dan hasil pencarian.",
              ),
              h3("Atribut menentukan perilaku elemen"),
              p(
                "Atribut ditulis di dalam tag pembuka dalam bentuk `nama=\"nilai\"`. Contohnya `lang` pada `<html>` memberi tahu pembaca layar bahasa yang dipakai, sehingga pengucapannya tepat.",
              ),
              q("HTML yang benar mendeskripsikan makna konten, bukan sekadar mengatur tampilannya."),
            ],
          },
          {
            judul: "Elemen Semantik dan Aksesibilitas",
            blok: [
              h2("Semantik membantu manusia dan mesin"),
              p(
                "Elemen semantik seperti `<header>`, `<nav>`, `<main>`, dan `<footer>` menjelaskan peran bagian halaman. Peramban, mesin pencari, dan pembaca layar memanfaatkannya untuk memahami struktur, bukan hanya tata letak.",
              ),
              kode({
                kode: `<body>
  <header>
    <nav>
      <a href="/">Beranda</a>
      <a href="/kursus">Kursus</a>
    </nav>
  </header>
  <main>
    <article>
      <h1>Judul Artikel</h1>
      <p>Isi utama artikel.</p>
    </article>
  </main>
  <footer>© 2026 Careevo</footer>
</body>`,
              }),
              li(
                "Satu halaman umumnya punya satu `<h1>` dan satu `<main>`.",
                "Gunakan `<button>` untuk aksi dan `<a>` untuk navigasi — jangan tertukar.",
                "Selalu isi `alt` pada `<img>` agar informasi tetap sampai bila gambar gagal dimuat.",
              ),
              p(
                "Membuat `<div>` untuk segalanya memang cepat, tetapi menghapus makna yang dibutuhkan teknologi bantu. Menukar `<div>` dengan elemen semantik yang tepat hampir selalu gratis.",
              ),
              q("Aksesibilitas dimulai dari HTML yang benar, bukan ditambal belakangan dengan ARIA."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Struktur HTML dan Semantik",
          deskripsi: "Memeriksa pemahaman kerangka dokumen dan pemilihan elemen semantik.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa fungsi deklarasi `<!DOCTYPE html>`?",
              pilihan: [
                "Menentukan bahasa halaman",
                "Memberi tahu peramban bahwa dokumen memakai standar HTML5",
                "Mengimpor berkas CSS",
                "Membuat judul tab",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Di elemen mana judul tab peramban ditentukan?",
              pilihan: [
                "`<h1>`",
                "`<title>` di dalam `<head>`",
                "`<header>`",
                "`<meta charset>`",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Elemen semantik yang tepat untuk menu navigasi utama adalah…",
              pilihan: ["`<div>`", "`<nav>`", "`<section>`", "`<aside>`"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Mengapa atribut `alt` pada `<img>` sebaiknya selalu diisi?",
              pilihan: [
                "Agar gambar memuat lebih cepat",
                "Agar pembaca layar dan pengguna saat gambar gagal muat tetap mendapat informasi",
                "Agar gambar bisa dianimasikan",
                "Agar gambar tersimpan di cache",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Dasar CSS dan Tata Letak",
        ringkasan:
          "Cara CSS memilih elemen, menghitung ukuran kotak lewat box model, dan menyusun tata letak responsif dengan Flexbox.",
        durasi_min: 60,
        halaman: [
          {
            judul: "Selektor, Spesifisitas, dan Box Model",
            blok: [
              h2("Menghubungkan CSS ke HTML"),
              p(
                "CSS dihubungkan lewat elemen `<link>` di dalam `<head>`. Selektor menentukan elemen mana yang terkena aturan: selektor tag, kelas, dan id adalah tiga yang paling sering dipakai.",
              ),
              kode({
                kode: `/* styles.css */
body {
  font-family: system-ui, sans-serif;
  margin: 0;
}

.kartu {
  padding: 16px;
  border: 1px solid #dddddd;
}

#utama {
  max-width: 720px;
}`,
              }),
              h3("Kotak di dalam kotak"),
              p(
                "Setiap elemen dirender sebagai kotak. Dari dalam ke luar: konten, `padding`, `border`, lalu `margin`. Secara bawaan `width` hanya menghitung konten, sehingga menambah padding membuat elemen melebar.",
              ),
              kode({
                kode: `.kotak {
  box-sizing: border-box; /* width mencakup padding dan border */
  width: 200px;
  padding: 16px;
  border: 2px solid black;
  margin: 24px;
}`,
              }),
              li(
                "`box-sizing: border-box` membuat ukuran lebih mudah diprediksi.",
                "Spesifisitas naik dari tag → kelas → id; id lebih kuat dari kelas.",
                "Hindari `!important` karena ia memutus perhitungan spesifisitas yang wajar.",
              ),
            ],
          },
          {
            judul: "Flexbox dan Tata Letak Responsif",
            blok: [
              h2("Menyusun satu dimensi dengan Flexbox"),
              p(
                "Flexbox mengatur anak-anak sebuah wadah sepanjang satu sumbu. Setel `display: flex` pada wadah, lalu gunakan `justify-content` untuk sumbu utama dan `align-items` untuk sumbu silang.",
              ),
              kode({
                kode: `.baris {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
}`,
              }),
              li(
                "`gap` memberi jarak antar-anak tanpa margin yang saling menumpuk.",
                "`flex: 1` membuat anak tumbuh mengisi ruang yang tersisa.",
                "`flex-wrap: wrap` membiarkan anak turun ke baris baru saat sempit.",
              ),
              h3("Menyesuaikan diri dengan ukuran layar"),
              p(
                "Media query menerapkan aturan hanya pada kondisi tertentu. Pola umumnya menulis gaya dasar untuk layar kecil, lalu menambah tata letak lebar lewat `min-width`.",
              ),
              kode({
                kode: `.kolom {
  display: block;
}

@media (min-width: 768px) {
  .kolom {
    display: flex;
    gap: 24px;
  }
}`,
              }),
              p(
                "Pendekatan mobile-first ini menjaga gaya dasar tetap sederhana dan menambah kerumitan hanya saat ruang memang tersedia.",
              ),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Dasar CSS dan Tata Letak",
          deskripsi: "Menguji selektor, box model, dan tata letak responsif.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Selektor mana yang paling tinggi spesifisitasnya?",
              pilihan: [
                "Selektor tag (`p`)",
                "Selektor kelas (`.kartu`)",
                "Selektor id (`#utama`)",
                "Selektor universal (`*`)",
              ],
              jawaban_benar: 2,
            },
            {
              pertanyaan: "Urutan lapisan box model dari dalam ke luar adalah…",
              pilihan: [
                "margin, border, padding, content",
                "content, padding, border, margin",
                "content, border, padding, margin",
                "padding, content, margin, border",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Properti apa yang mengaktifkan tata letak Flexbox pada sebuah wadah?",
              pilihan: ["`display: block`", "`display: flex`", "`position: flex`", "`float: flex`"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa fungsi `@media (min-width: 768px)`?",
              pilihan: [
                "Menyembunyikan elemen di layar kecil",
                "Menerapkan aturan CSS hanya saat lebar viewport minimal 768px",
                "Memuat gambar berukuran besar",
                "Menetapkan lebar tetap 768px",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // r2 — JavaScript Modern: Async & Promise
  // -------------------------------------------------------------------------
  {
    id: "r2",
    slug: "r2",
    judul: "JavaScript Modern: Async & Promise",
    deskripsi:
      "Pahami bagaimana JavaScript tetap responsif meski hanya punya satu utas, lewat event loop, callback, dan Promise. Lanjut ke async/await serta pola menjalankan banyak tugas asinkron sekaligus.",
    tags: ["JavaScript", "Async"],
    level: "menengah",
    track: "web-dev",
    provider: "javascript.info",
    durasi_min: 90,
    modul: [
      {
        judul: "Callback dan Promise",
        ringkasan:
          "Event loop yang membuat kode asinkron berjalan, batas callback, dan bagaimana Promise merapikan alur asinkron.",
        durasi_min: 45,
        halaman: [
          {
            judul: "Event Loop dan Callback",
            blok: [
              h2("Satu utas, tetapi tidak memblokir"),
              p(
                "JavaScript menjalankan kode pada satu utas utama. Agar tidak membeku menunggu operasi lambat, tugas seperti timer dan permintaan jaringan diserahkan ke lingkungan host, lalu hasilnya dikembalikan lewat antrean yang diproses event loop.",
              ),
              kode({
                kode: `console.log("1");
setTimeout(() => console.log("2"), 0);
console.log("3");
// Output: 1, 3, 2`,
              }),
              li(
                "Kode sinkron selesai lebih dulu, walau `setTimeout(..., 0)` terlihat instan.",
                "Callback adalah fungsi yang dipanggil setelah tugas asinkron selesai.",
                "Menumpuk callback di dalam callback membuat alur sulit dibaca.",
              ),
              p(
                "Masalahnya bukan callback itu sendiri, melainkan pola bersarangnya. Semakin banyak langkah yang bergantung pada langkah sebelumnya, semakin dalam sarangnya — inilah yang dijuluki callback hell.",
              ),
              q("Antrean tugas asinkron selalu menunggu tumpukan panggilan kosong lebih dulu."),
            ],
          },
          {
            judul: "Promise: Tiga Keadaan dan Rantai",
            blok: [
              h2("Janji yang pasti diselesaikan"),
              p(
                "Promise merepresentasikan hasil operasi asinkron yang belum selesai. Ia punya tiga keadaan: `pending`, lalu `fulfilled` bila berhasil, atau `rejected` bila gagal. Setelah selesai, keadaannya tidak berubah lagi.",
              ),
              kode({
                kode: `const janji = new Promise((resolve, reject) => {
  setTimeout(() => resolve("selesai"), 1000);
});

janji
  .then((hasil) => console.log(hasil))
  .catch((err) => console.error("gagal:", err));`,
              }),
              li(
                "`.then()` mengembalikan Promise baru, sehingga bisa dirantai.",
                "`.catch()` menangani penolakan di sepanjang rantai.",
                "`Promise.resolve(x)` membungkus nilai menjadi Promise yang langsung selesai.",
              ),
              h3("Menangani kegagalan"),
              p(
                "Satu `.catch()` di ujung rantai cukup untuk menangkap galat dari langkah mana pun sebelumnya. Ini jauh lebih rapi daripada memeriksa galat di setiap callback.",
              ),
              kode({
                kode: `fetch("/api/data")
  .then((res) => res.json())
  .then((data) => console.log(data))
  .catch((err) => console.error("gagal:", err));`,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Callback dan Promise",
          deskripsi: "Menguji event loop dan perilaku dasar Promise.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Berapa utas yang dipakai JavaScript untuk menjalankan kode di peramban?",
              pilihan: [
                "Satu utas utama (single-threaded)",
                "Dua utas per fungsi",
                "Satu utas per fungsi",
                "Tak terbatas",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa tiga keadaan sebuah Promise?",
              pilihan: [
                "mulai, jalan, selesai",
                "pending, fulfilled, rejected",
                "open, closed, error",
                "async, await, return",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa yang dikembalikan oleh `.then()` pada sebuah Promise?",
              pilihan: ["Promise baru", "Nilai boolean", "Callback", "Selalu `undefined`"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Callback hell muncul terutama karena…",
              pilihan: [
                "Callback bersarang di dalam callback untuk mengurutkan operasi asinkron",
                "Terlalu banyak variabel global",
                "Penggunaan `const`",
                "Mengimpor terlalu banyak modul",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Async/Await dan Pola Konkurensi",
        ringkasan:
          "Menulis kode asinkron yang terbaca seperti sinkron dengan async/await, plus cara menjalankan tugas secara berurutan maupun bersamaan.",
        durasi_min: 45,
        halaman: [
          {
            judul: "async/await dan Penanganan Galat",
            blok: [
              h2("Gula sintaksis di atas Promise"),
              p(
                "`async/await` tidak menggantikan Promise — ia membuatnya lebih enak dibaca. Fungsi `async` selalu mengembalikan Promise, dan `await` menjeda fungsi itu sampai Promise yang ditunggu selesai.",
              ),
              kode({
                kode: `async function muatData() {
  try {
    const res = await fetch("/api/data");
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("gagal memuat:", err);
  }
}`,
              }),
              li(
                "`await` hanya boleh dipakai di dalam fungsi `async` (atau top-level module).",
                "Galat dari `await` ditangkap dengan `try/catch` biasa.",
                "`await` tidak memblokir seluruh program — hanya menjeda fungsi ini.",
              ),
              p(
                "Karena galat asinkron muncul seperti galat biasa di dalam `try/catch`, penanganannya jadi konsisten dengan kode sinkron.",
              ),
              q("`await` menjeda fungsi, bukan seluruh halaman."),
            ],
          },
          {
            judul: "Menjalankan Tugas Bersamaan",
            blok: [
              h2("Berurutan atau bersamaan?"),
              p(
                "Menulis beberapa `await` berurutan berarti menunggu satu per satu. Bila tugas-tugas itu tidak saling bergantung, menunggunya secara bersamaan bisa jauh lebih cepat.",
              ),
              kode({
                kode: `// Berurutan: total kira-kira 2 detik
const a = await tugasA();
const b = await tugasB();

// Bersamaan: total kira-kira 1 detik
const [x, y] = await Promise.all([tugasA(), tugasB()]);`,
              }),
              li(
                "`Promise.all` menunggu semua selesai, dan menolak bila ada satu yang menolak.",
                "`Promise.allSettled` menunggu semua dan melaporkan status masing-masing.",
                "`Promise.race` selesai mengikuti Promise pertama yang selesai.",
              ),
              p(
                "Aturan praktisnya: jalankan bersamaan bila tugas tidak saling bergantung, dan berurutan hanya bila hasil yang satu memang dibutuhkan untuk memulai yang lain.",
              ),
              q("Ketergantungan data menentukan urutan; ketiadaan ketergantungan membuka peluang paralel."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Async/Await dan Konkurensi",
          deskripsi: "Memastikan pemahaman async/await dan pola menjalankan tugas bersamaan.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa yang selalu dikembalikan oleh fungsi `async`?",
              pilihan: ["Nilai mentah", "Promise", "Callback", "Generator"],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Bagaimana menangkap galat dari `await` yang gagal?",
              pilihan: ["`try/catch`", "`if/else`", "`switch`", "`while`"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "`Promise.all()` menyelesaikan diri bila…",
              pilihan: [
                "Promise pertama selesai",
                "Semua promise selesai, dan menolak bila salah satu menolak",
                "Tidak ada yang selesai",
                "Selalu setelah satu detik",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan:
                "Untuk dua permintaan jaringan yang tidak saling bergantung, cara paling tepat agar cepat adalah…",
              pilihan: [
                "`await` satu per satu secara berurutan",
                "`await Promise.all([...])`",
                "Membungkusnya dengan `setTimeout`",
                "Memakai `for` loop tanpa `await`",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // r3 — React Fundamentals
  // -------------------------------------------------------------------------
  {
    id: "r3",
    slug: "r3",
    judul: "React Fundamentals",
    deskripsi:
      "Pelajari inti React: komponen sebagai fungsi, props, dan state yang memicu render ulang. Kemudian menyusun daftar, menangani event, dan menjaga alur data satu arah tetap jelas.",
    tags: ["React"],
    level: "dasar",
    track: "web-dev",
    provider: "React Docs",
    durasi_min: 150,
    modul: [
      {
        judul: "Komponen, Props, dan State",
        ringkasan:
          "Menyusun antarmuka dari fungsi kecil yang dapat dipakai ulang, meneruskan data lewat props, dan menyimpan nilai yang berubah dengan state.",
        durasi_min: 75,
        halaman: [
          {
            judul: "Komponen sebagai Fungsi",
            blok: [
              h2("Antarmuka sebagai kumpulan fungsi"),
              p(
                "Komponen React pada dasarnya adalah fungsi yang mengembalikan elemen React (JSX). Dengan memecah antarmuka menjadi komponen kecil, setiap bagian punya satu tanggung jawab dan mudah dipakai ulang.",
              ),
              kode({
                kode: `function Kartu({ judul, isi }) {
  return (
    <article>
      <h3>{judul}</h3>
      <p>{isi}</p>
    </article>
  );
}`,
              }),
              li(
                "Nama komponen ditulis dengan huruf kapital awal agar dikenali JSX.",
                "Data diteruskan dari induk ke anak lewat props.",
                "Props bersifat hanya baca — anak tidak boleh mengubahnya langsung.",
              ),
              p(
                "Karena komponen adalah fungsi murni terhadap props-nya, komponen yang sama dengan props berbeda akan menghasilkan tampilan berbeda tanpa saling mengganggu.",
              ),
              q("Komponen yang baik melakukan satu hal dengan baik dan menerima datanya dari luar."),
            ],
          },
          {
            judul: "State dan Render Ulang",
            blok: [
              h2("Nilai yang berubah seiring waktu"),
              p(
                "State adalah memori sebuah komponen. Ketika state berubah, React merender ulang komponen itu dan anak-anaknya, lalu memperbarui DOM seminimal mungkin.",
              ),
              kode({
                kode: `import { useState } from "react";

function Penghitung() {
  const [hitung, setHitung] = useState(0);
  return (
    <button onClick={() => setHitung(hitung + 1)}>
      Klik: {hitung}
    </button>
  );
}`,
              }),
              li(
                "`useState` mengembalikan pasangan nilai saat ini dan fungsi penyetelnya.",
                "Memanggil penyetel dengan nilai baru memicu render ulang.",
                "Mengubah variabel biasa tidak memicu render ulang.",
              ),
              p(
                "Saat memperbarui state yang bergantung pada nilai sebelumnya, gunakan bentuk fungsi seperti `setHitung((n) => n + 1)` agar tetap benar walau beberapa pembaruan digabung.",
              ),
              q("State adalah memori; variabel biasa hilang setiap kali fungsi dijalankan ulang."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Komponen, Props, dan State",
          deskripsi: "Menguji dasar komponen, props, dan state React.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Komponen React pada dasarnya adalah…",
              pilihan: [
                "Fungsi yang mengembalikan elemen React",
                "Kelas CSS",
                "Berkas HTML",
                "Kueri database",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Bagaimana cara meneruskan data dari komponen induk ke anak?",
              pilihan: ["Lewat props", "Lewat variabel global", "Lewat CSS", "Lewat URL selalu"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa yang memicu render ulang sebuah komponen yang memakai `useState`?",
              pilihan: [
                "Memanggil fungsi penyetel state dengan nilai baru",
                "Mengubah variabel biasa",
                "Menulis ke `console`",
                "Mengubah nama berkas",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Props di dalam komponen anak bersifat…",
              pilihan: [
                "Bisa diubah langsung oleh anak",
                "Hanya baca (read-only)",
                "Selalu berupa angka",
                "Selalu bersifat global",
              ],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Render List, Event, dan Alur Data",
        ringkasan:
          "Menampilkan daftar dengan key yang benar, menangani event, dan mengangkat state agar beberapa komponen berbagi data tanpa melanggar alur satu arah.",
        durasi_min: 75,
        halaman: [
          {
            judul: "Membuat Daftar dan Menangani Event",
            blok: [
              h2("Merender kumpulan data"),
              p(
                "Untuk menampilkan banyak item, petakan array menjadi elemen React. Setiap item perlu prop `key` yang unik dan stabil agar React bisa mencocokkan item antar-render.",
              ),
              kode({
                kode: `function Daftar({ buah }) {
  return (
    <ul>
      {buah.map((b) => (
        <li key={b.id}>{b.nama}</li>
      ))}
    </ul>
  );
}`,
              }),
              li(
                "Gunakan id stabil sebagai `key`, bukan indeks array bila urutan bisa berubah.",
                "`key` hanya dipakai React, tidak diteruskan ke DOM.",
                "Jangan membuat key yang berubah-ubah setiap render.",
              ),
              h3("Menangani kejadian pengguna"),
              p(
                "Event handler diteruskan sebagai prop seperti `onClick`. React memakai penamaan camelCase dan menerima fungsi, bukan string.",
              ),
              kode({
                kode: `function Formulir() {
  function tanganiKirim(e) {
    e.preventDefault();
    console.log("terkirim");
  }
  return (
    <form onSubmit={tanganiKirim}>
      <button type="submit">Kirim</button>
    </form>
  );
}`,
              }),
            ],
          },
          {
            judul: "Alur Data Satu Arah dan Mengangkat State",
            blok: [
              h2("Data turun, kejadian naik"),
              p(
                "Di React, data mengalir satu arah: induk mengirim data ke anak lewat props, dan anak memberi tahu induk lewat fungsi callback yang juga diteruskan sebagai prop.",
              ),
              kode({
                kode: `function Anak({ onUbah }) {
  return <button onClick={() => onUbah("nilai baru")}>Ubah</button>;
}

function Induk() {
  const [nilai, setNilai] = useState("awal");
  return <Anak onUbah={setNilai} />;
}`,
              }),
              li(
                "Anak tidak mengubah state induk secara langsung, melainkan memanggil callback.",
                "State bersama diletakkan di komponen leluhur terdekat yang membutuhkannya.",
                "Mengangkat state menghindari dua salinan data yang bisa berbeda.",
              ),
              p(
                "Ketika dua komponen bersaudara perlu berbagi data, pindahkan state itu ke induk bersama mereka, lalu turunkan nilainya dan fungsi pengubahnya sebagai props.",
              ),
              q("Satu sumber kebenaran mencegah dua komponen menampilkan data yang saling bertentangan."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Render List, Event, dan Alur Data",
          deskripsi: "Menguji key, event handler, dan alur data satu arah di React.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Mengapa setiap item dalam daftar React perlu prop `key`?",
              pilihan: [
                "Agar React bisa mencocokkan item antar-render secara efisien",
                "Agar CSS berfungsi",
                "Agar item bisa diklik",
                "Agar data tersimpan di server",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Bagaimana sebaiknya memperlakukan indeks array sebagai `key`?",
              pilihan: [
                "Selalu memakai indeks array",
                "Hindari bila daftar bisa berubah urutan atau disisipi, karena `key` harus stabil dan unik",
                "Hanya dipakai untuk daftar kosong",
                "Indeks dilarang dalam semua keadaan",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Alur data satu arah (one-way data flow) di React berarti…",
              pilihan: [
                "Anak mengubah props induk secara langsung",
                "Data mengalir dari induk ke anak lewat props, dan anak memberi tahu induk lewat callback",
                "Data mengalir dari anak ke induk lewat props",
                "Data mengalir dua arah secara otomatis",
              ],
              jawaban_benar: 1,
            },
            {
              pertanyaan: "Apa itu 'mengangkat state' (lifting state up)?",
              pilihan: [
                "Memindahkan state ke komponen leluhur bersama agar beberapa anak berbagi data",
                "Menghapus state",
                "Menyimpan state di `localStorage`",
                "Menambah state baru di setiap anak",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // r4 — TypeScript untuk Pemula
  // -------------------------------------------------------------------------
  {
    id: "r4",
    slug: "r4",
    judul: "TypeScript untuk Pemula",
    deskripsi:
      "Mengenal sistem tipe TypeScript: anotasi dan inferensi, interface, type alias, dan union. Dilanjutkan dengan fungsi generik serta penyempitan tipe (narrowing) agar kode aman sejak kompilasi.",
    tags: ["TypeScript"],
    level: "menengah",
    track: "web-dev",
    provider: "TypeScript",
    durasi_min: 100,
    modul: [
      {
        judul: "Tipe Dasar dan Inferensi",
        ringkasan:
          "Bagaimana TypeScript menebak dan memeriksa tipe, serta membentuk tipe kustom lewat interface, type alias, dan union.",
        durasi_min: 50,
        halaman: [
          {
            judul: "Anotasi Tipe dan Inferensi",
            blok: [
              h2("TypeScript memeriksa saat kompilasi"),
              p(
                "TypeScript menambahkan pemeriksaan tipe di atas JavaScript. Pemeriksaan terjadi saat kompilasi, bukan saat program berjalan — tipe hilang sepenuhnya di keluaran akhir.",
              ),
              kode({
                kode: `let nama = "Budi";        // diinferensi sebagai string
const umur: number = 20;  // dianotasi sebagai number

// Error: Type 'string' is not assignable to type 'number'.
umur = "dua puluh";`,
              }),
              li(
                "Inferensi: TypeScript menyimpulkan tipe dari nilai yang kamu tulis.",
                "Anotasi dipakai saat inferensi tidak cukup atau tipe perlu ditegaskan.",
                "Galat tipe muncul saat kompilasi, bukan saat runtime di peramban.",
              ),
              p(
                "Karena tipe tidak ada saat runtime, TypeScript tidak bisa memvalidasi data yang datang dari luar seperti respons jaringan. Untuk itu tetap diperlukan pemeriksaan runtime.",
              ),
              q("Tipe membantumu saat menulis kode, bukan menggantikan validasi data saat berjalan."),
            ],
          },
          {
            judul: "Interface, Type Alias, dan Union",
            blok: [
              h2("Membentuk tipe kustom"),
              p(
                "`interface` mendeskripsikan bentuk objek, sedangkan `type` memberi nama pada tipe apa pun, termasuk gabungan. Keduanya sering bisa dipakai bergantian untuk objek sederhana.",
              ),
              kode({
                kode: `interface Pengguna {
  id: number;
  nama: string;
}

type Status = "aktif" | "nonaktif";

function label(status: Status): string {
  return status === "aktif" ? "Aktif" : "Nonaktif";
}`,
              }),
              li(
                "Union `\"aktif\" | \"nonaktif\"` membatasi nilai ke pilihan yang sah.",
                "`interface` bisa diperluas dengan `extends`; `type` bisa digabung dengan `&`.",
                "Nilai di luar union langsung ditolak saat kompilasi.",
              ),
              p(
                "Membatasi nilai ke union literal jauh lebih aman daripada `string` bebas, karena salah ketik sekecil apa pun akan ketahuan lebih awal.",
              ),
              q("Lebih baik tipe yang sempit dan benar daripada tipe lebar yang membiarkan salah ketik lolos."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Tipe Dasar dan Inferensi",
          deskripsi: "Menguji inferensi, anotasi, dan pembentukan tipe kustom.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa itu inferensi tipe di TypeScript?",
              pilihan: [
                "TypeScript menyimpulkan tipe dari nilai yang ditulis",
                "TypeScript mewajibkan anotasi di setiap variabel",
                "TypeScript menghapus tipe saat runtime",
                "TypeScript mengubah JavaScript menjadi CSS",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Manakah yang mendefinisikan tipe gabungan (union)?",
              pilihan: ["`string | number`", "`string & number`", "`string, number`", "`string + number`"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Kapan TypeScript memeriksa tipe?",
              pilihan: [
                "Saat kompilasi",
                "Saat runtime di peramban",
                "Saat request jaringan",
                "Tidak pernah",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Tipe `any` sebaiknya dihindari karena…",
              pilihan: [
                "Mematikan pemeriksaan tipe untuk nilai itu sehingga galat bisa lolos",
                "Membuat kode lebih lambat saat runtime",
                "Tidak bisa dikompilasi sama sekali",
                "Selalu mengubah nilai menjadi number",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Generik dan Penyempitan Tipe",
        ringkasan:
          "Menulis fungsi yang bekerja untuk banyak tipe tanpa kehilangan informasi, lalu mempersempit union dengan typeof, in, dan type guard.",
        durasi_min: 50,
        halaman: [
          {
            judul: "Fungsi Generik",
            blok: [
              h2("Tipe sebagai parameter"),
              p(
                "Generik memungkinkan sebuah fungsi bekerja untuk banyak tipe sekaligus tetap menjaga hubungan antar tipe. Alih-alih menulis `any`, kamu menulis parameter tipe seperti `<T>`.",
              ),
              kode({
                kode: `function pertama<T>(arr: T[]): T | undefined {
  return arr[0];
}

const angka = pertama([1, 2, 3]); // number | undefined
const teks = pertama(["a", "b"]); // string | undefined`,
              }),
              li(
                "Tanpa generik, tipe kembalian akan melebar menjadi `any` dan kehilangan informasi.",
                "TypeScript biasanya menyimpulkan `T` dari argumen, jadi tidak perlu ditulis ulang.",
                "Generik menjaga tipe masukan dan keluaran tetap terkait.",
              ),
              p(
                "Kekuatan generik bukan pada fleksibilitas semata, melainkan pada fleksibilitas yang tetap mempertahankan informasi tipe di seluruh fungsi.",
              ),
              q("Generik berarti fleksibel tanpa kehilangan tipe."),
            ],
          },
          {
            judul: "Penyempitan Tipe (Narrowing)",
            blok: [
              h2("Mempersempit kemungkinan"),
              p(
                "Saat sebuah nilai bertipe union, TypeScript mengizinkan operasi yang aman untuk semua anggota. Untuk memakai anggota tertentu, kamu harus mempersempitnya lebih dulu.",
              ),
              kode({
                kode: `function panjang(nilai: string | number): number {
  if (typeof nilai === "string") {
    return nilai.length; // di sini nilai bertipe string
  }
  return nilai; // di sini nilai bertipe number
}`,
              }),
              li(
                "`typeof` mempersempit berdasarkan tipe primitif nilai.",
                "Operator `in` mempersempit berdasarkan keberadaan sebuah properti.",
                "Pemeriksaan seperti `Array.isArray` juga bertindak sebagai penyempit.",
              ),
              h3("Type guard buatan sendiri"),
              p(
                "Ketika logika penyempitan lebih rumit, kamu bisa menulis fungsi yang mengembalikan type predicate, yaitu tipe kembalian berbentuk `x is Tipe`.",
              ),
              kode({
                kode: `function adalahString(x: unknown): x is string {
  return typeof x === "string";
}`,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Generik dan Penyempitan Tipe",
          deskripsi: "Menguji parameter generik dan teknik narrowing.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa tujuan parameter generik `<T>` pada sebuah fungsi?",
              pilihan: [
                "Menjaga hubungan tipe antara argumen dan nilai kembalian tanpa kehilangan informasi tipe",
                "Menambah performa saat runtime",
                "Membuat fungsi menjadi asinkron",
                "Menghapus semua tipe",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Operator apa yang mempersempit tipe berdasarkan tipe primitif nilai?",
              pilihan: ["`typeof`", "`new`", "`delete`", "`import`"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Bagaimana cara mempersempit union objek berdasarkan keberadaan sebuah properti?",
              pilihan: ["Operator `in`", "Operator `===`", "Operator `+`", "Operator `&&`"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Type guard buatan sendiri ditulis sebagai fungsi yang mengembalikan…",
              pilihan: [
                "Tipe kembalian berupa type predicate, mis. `x is string`",
                "Boolean biasa tanpa tipe khusus",
                "`void`",
                "`number`",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // r5 — Testing Frontend dengan Vitest
  // -------------------------------------------------------------------------
  {
    id: "r5",
    slug: "r5",
    judul: "Testing Frontend dengan Vitest",
    deskripsi:
      "Menulis test yang cepat dan andal dengan Vitest: struktur test, matcher, dan siklus hidup. Kemudian menguji komponen dengan mocking dan pendekatan yang berpusat pada perilaku pengguna.",
    tags: ["Testing", "Vitest"],
    level: "menengah",
    track: "web-dev",
    provider: "Vitest",
    durasi_min: 75,
    modul: [
      {
        judul: "Dasar Pengujian dengan Vitest",
        ringkasan:
          "Menyusun test case, memakai assertion, dan mengelola persiapan serta pembersihan antar-test.",
        durasi_min: 40,
        halaman: [
          {
            judul: "Struktur Test dan Assertion",
            blok: [
              h2("Test adalah kode biasa"),
              p(
                "Vitest memakai API mirip Jest, tetapi dijalankan di atas pipeline transform Vite. Test didefinisikan dengan `test` (atau `it`), dikelompokkan dengan `describe`, dan diperiksa dengan `expect`.",
              ),
              kode({
                kode: `import { describe, test, expect } from "vitest";
import { jumlah } from "./jumlah";

describe("jumlah", () => {
  test("menjumlahkan dua angka", () => {
    expect(jumlah(2, 3)).toBe(5);
  });
});`,
              }),
              li(
                "`describe` mengelompokkan test dalam satu suite.",
                "`test`/`it` mendefinisikan satu test case.",
                "`expect` memeriksa hasil lewat sebuah matcher.",
              ),
              p(
                "Nama test yang baik menjelaskan perilaku yang diharapkan, bukan nama fungsi yang dipanggil. Ini membuat kegagalan test mudah dipahami tanpa membuka kodenya.",
              ),
              q("Test adalah dokumentasi yang tidak bisa basi — ia gagal saat perilakunya berubah."),
            ],
          },
          {
            judul: "Matcher dan Siklus Hidup Test",
            blok: [
              h2("Memilih matcher yang tepat"),
              p(
                "Matcher menentukan apa yang diperiksa. `toBe` memakai kesamaan ketat (`Object.is`), sedangkan `toEqual` memeriksa kesamaan struktural untuk objek dan array.",
              ),
              kode({
                kode: `expect(nilai).toBe(5);            // kesamaan ketat
expect(objek).toEqual({ a: 1 }); // kesamaan struktural
expect(teks).toContain("ka");    // memuat substring
expect(fn).toThrow();            // melempar galat`,
              }),
              li(
                "`toBe` untuk nilai primitif; `toEqual` untuk objek dan array.",
                "`toContain` memeriksa keanggotaan pada string atau array.",
                "Pilih matcher yang paling spesifik agar kegagalan informatif.",
              ),
              h3("Menyiapkan dan membersihkan"),
              p(
                "Hook siklus hidup menjalankan kode di sekitar test. `beforeEach` dan `afterEach` berjalan untuk setiap test, sementara `beforeAll` dan `afterAll` hanya sekali per suite.",
              ),
              kode({
                kode: `import { beforeEach, afterEach } from "vitest";

beforeEach(() => {
  // siapkan keadaan bersih sebelum tiap test
});

afterEach(() => {
  // bersihkan efek samping setelah tiap test
});`,
              }),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Dasar Pengujian dengan Vitest",
          deskripsi: "Menguji struktur test, matcher, dan hook siklus hidup.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Fungsi yang mendefinisikan satu test case di Vitest adalah…",
              pilihan: ["`test()` atau `it()`", "`describe()`", "`expect()`", "`assert()`"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa fungsi `describe()` di Vitest?",
              pilihan: [
                "Mengelompokkan beberapa test dalam satu suite",
                "Menjalankan test",
                "Menegaskan sebuah nilai",
                "Mengimpor React",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Hook yang dijalankan sebelum setiap test adalah…",
              pilihan: ["`beforeEach()`", "`afterEach()`", "`beforeAll()`", "`describe()`"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Matcher mana yang tepat untuk memeriksa kesamaan struktural objek?",
              pilihan: ["`toBe`", "`toEqual`", "`toContain`", "`toThrow`"],
              jawaban_benar: 1,
            },
          ],
        },
      },
      {
        judul: "Mocking dan Pengujian Komponen",
        ringkasan:
          "Mengganti dependensi dengan tiruan memakai vi.fn dan vi.mock, lalu menguji komponen React lewat perilaku yang terlihat pengguna.",
        durasi_min: 35,
        halaman: [
          {
            judul: "Mock, Spy, dan vi.fn",
            blok: [
              h2("Mengganti dunia nyata dengan tiruan"),
              p(
                "Mock membuat test terisolasi dari dependensi yang lambat atau tidak dapat diprediksi, seperti jaringan dan waktu. Vitest menyediakannya lewat objek `vi`.",
              ),
              kode({
                kode: `import { vi, expect } from "vitest";

const kirim = vi.fn();
kirim("halo");

expect(kirim).toHaveBeenCalledWith("halo");`,
              }),
              li(
                "`vi.fn()` membuat fungsi tiruan yang merekam cara pemanggilannya.",
                "`mockResolvedValue` menetapkan hasil Promise yang dikembalikan.",
                "`vi.mock()` mengganti seluruh modul dengan tiruan.",
              ),
              h3("Mengganti modul"),
              p(
                "`vi.mock` diangkat ke atas berkas, sehingga ia menggantikan modul sebelum kode yang diuji mengimpornya. Ini penting agar tiruan benar-benar dipakai.",
              ),
              kode({
                kode: `import { vi } from "vitest";

vi.mock("./api", () => ({
  ambilData: vi.fn().mockResolvedValue({ id: 1 }),
}));`,
              }),
            ],
          },
          {
            judul: "Menguji Komponen React",
            blok: [
              h2("Berpusat pada perilaku pengguna"),
              p(
                "React Testing Library mendorong pengujian lewat apa yang dilihat dan dilakukan pengguna, bukan lewat detail implementasi. Komponen dirender dengan `render`, lalu dicari dengan `screen`.",
              ),
              kode({
                kode: `import { render, screen } from "@testing-library/react";
import { Tombol } from "./Tombol";

test("menampilkan label tombol", () => {
  render(<Tombol />);
  expect(screen.getByRole("button")).toHaveTextContent("Kirim");
});`,
              }),
              li(
                "Cari elemen lewat peran (`getByRole`) agar sekaligus menguji aksesibilitas.",
                "Hindari memeriksa nama kelas atau struktur DOM internal.",
                "Simulasikan interaksi lewat event pengguna, bukan memanggil method komponen.",
              ),
              p(
                "Test yang menguji detail implementasi mudah rapuh: perubahan kecil yang tidak mengubah perilaku bisa mematahkannya. Menguji perilaku membuat test bertahan lebih lama.",
              ),
              q("Uji apa yang dilihat pengguna, bukan bagaimana kode disusun di dalam."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Mocking dan Pengujian Komponen",
          deskripsi: "Menguji mock, spy, dan pendekatan pengujian komponen.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa yang dibuat oleh `vi.fn()`?",
              pilihan: [
                "Fungsi tiruan yang merekam bagaimana ia dipanggil",
                "Kelas CSS",
                "Komponen React",
                "Berkas konfigurasi",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "`vi.mock()` berguna untuk…",
              pilihan: [
                "Mengganti modul dengan tiruan agar test terisolasi dari dependensi nyata",
                "Menambah dependensi baru ke proyek",
                "Mempercepat runtime produksi",
                "Mengubah tipe TypeScript",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Pendekatan yang disarankan React Testing Library adalah…",
              pilihan: [
                "Menguji perilaku yang terlihat pengguna, bukan detail implementasi",
                "Menguji nama fungsi internal",
                "Menguji jumlah variabel",
                "Menguji warna CSS saja",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Mengapa test yang menguji detail implementasi cenderung rapuh?",
              pilihan: [
                "Karena perubahan kecil pada implementasi mematahkannya meski perilaku tetap benar",
                "Karena test berjalan terlalu cepat",
                "Karena tidak memakai mock",
                "Karena tidak memakai TypeScript",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // r6 — Git & Version Control
  // -------------------------------------------------------------------------
  {
    id: "r6",
    slug: "r6",
    judul: "Git & Version Control",
    deskripsi:
      "Kuasai dasar Git: tiga area kerja, alur commit, dan membaca riwayat. Lanjut ke branch, merge, serta kolaborasi lewat remote tanpa kehilangan jejak perubahan.",
    tags: ["Git"],
    level: "dasar",
    track: "web-dev",
    provider: "Pro Git",
    durasi_min: 60,
    modul: [
      {
        judul: "Dasar Git dan Commit",
        ringkasan:
          "Tiga area kerja Git, alur menuju commit pertama, dan cara membaca riwayat serta perbedaan perubahan.",
        durasi_min: 30,
        halaman: [
          {
            judul: "Tiga Area Git",
            blok: [
              h2("Perubahan mengalir melewati tiga area"),
              p(
                "Git mengelola perubahan lewat tiga area: working directory tempat kamu menyunting berkas, staging area tempat perubahan dipilih, dan repositori tempat commit tersimpan permanen.",
              ),
              kode({
                kode: `git status          # lihat keadaan sekarang
git add .           # pindahkan perubahan ke staging area
git commit -m "Tambah halaman beranda"`,
              }),
              li(
                "Working directory: berkas yang sedang kamu kerjakan.",
                "Staging area: perubahan yang sudah dipilih untuk commit berikutnya.",
                "Repositori: riwayat commit yang tersimpan.",
              ),
              p(
                "Staging area adalah kunci kekuatan Git: kamu bisa memilih sebagian perubahan untuk dicatat sebagai satu commit yang utuh dan bermakna, bukan mencampur semuanya.",
              ),
              q("Commit yang fokus jauh lebih mudah ditinjau dan dibatalkan daripada commit raksasa."),
            ],
          },
          {
            judul: "Commit dan Membaca Riwayat",
            blok: [
              h2("Setiap commit adalah snapshot"),
              p(
                "Sebuah commit merekam keadaan berkas pada satu titik waktu beserta pesan yang menjelaskannya. Pesan yang jelas membuat riwayat bisa dibaca seperti catatan perubahan proyek.",
              ),
              kode({
                kode: `git log --oneline
git diff
git show HEAD`,
              }),
              li(
                "`git log --oneline` menampilkan riwayat ringkas satu baris per commit.",
                "`git diff` memperlihatkan perubahan yang belum di-staging.",
                "`git show HEAD` menampilkan detail commit terakhir.",
              ),
              p(
                "Karena setiap commit adalah snapshot, kamu bisa kembali ke keadaan mana pun di masa lalu. Ini yang membuat Git menjadi jaring pengaman saat bereksperimen.",
              ),
              q("Commit sering dan kecil memberi titik kembali yang murah saat ada yang salah."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Dasar Git dan Commit",
          deskripsi: "Menguji tiga area Git, alur commit, dan pembacaan riwayat.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Tiga area utama Git secara berurutan adalah…",
              pilihan: [
                "working directory, staging area, repository",
                "repository, staging, working",
                "staging, repository, working",
                "working, repository, staging",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Perintah untuk memindahkan perubahan ke staging area adalah…",
              pilihan: ["`git add`", "`git commit`", "`git push`", "`git clone`"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa yang dilakukan `git commit`?",
              pilihan: [
                "Menyimpan snapshot perubahan yang sudah di-staging ke riwayat repositori",
                "Mengunggah perubahan ke server",
                "Membuat branch baru",
                "Menghapus seluruh riwayat",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa fungsi `git status`?",
              pilihan: [
                "Menampilkan keadaan working directory dan staging area",
                "Menampilkan seluruh riwayat commit",
                "Menggabungkan dua branch",
                "Menghapus berkas",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
      {
        judul: "Branch, Merge, dan Remote",
        ringkasan:
          "Bekerja di jalur terpisah dengan branch, menggabungkannya dengan merge, dan berkolaborasi lewat remote.",
        durasi_min: 30,
        halaman: [
          {
            judul: "Branch dan Merge",
            blok: [
              h2("Jalur pengembangan yang terpisah"),
              p(
                "Branch memungkinkan kamu mengembangkan fitur tanpa mengganggu jalur utama. Di Git, branch hanyalah penunjuk ringan ke sebuah commit, sehingga membuatnya sangat murah.",
              ),
              kode({
                kode: `git branch fitur
git switch fitur
# ...kerjakan fitur, lalu commit...
git switch main
git merge fitur`,
              }),
              li(
                "`git switch <nama>` berpindah ke branch lain.",
                "`git merge` menggabungkan perubahan branch lain ke branch aktif.",
                "Konflik muncul bila kedua sisi mengubah baris yang sama.",
              ),
              p(
                "Ketika terjadi konflik, Git menandai bagian yang bertabrakan dan menyerahkan keputusan kepadamu. Selesaikan, tandai sebagai selesai dengan `git add`, lalu lanjutkan merge.",
              ),
              q("Branch membuat eksperimen menjadi gratis — biayanya hanya satu penunjuk."),
            ],
          },
          {
            judul: "Remote dan Kolaborasi",
            blok: [
              h2("Satu repositori, banyak salinan"),
              p(
                "Remote adalah salinan repositori di server, biasanya bernama `origin`. Kamu mengunggah commit dengan `push` dan mengambil perubahan orang lain dengan `pull`.",
              ),
              kode({
                kode: `git remote add origin https://contoh.test/repo.git
git push -u origin main
git pull`,
              }),
              li(
                "`git clone` menyalin repositori remote beserta seluruh riwayatnya.",
                "`git push` mengunggah commit lokal ke remote.",
                "`git pull` mengambil perubahan remote lalu menggabungkannya ke branch lokal.",
              ),
              p(
                "Karena setiap orang punya salinan lengkap, Git bekerja tanpa koneksi terus-menerus. Remote hanyalah titik sinkronisasi, bukan satu-satunya tempat data berada.",
              ),
              q("Bekerja lokal dulu, sinkronkan ke remote saat siap dibagikan."),
            ],
          },
        ],
        kuis: {
          judul: "Kuis: Branch, Merge, dan Remote",
          deskripsi: "Menguji branch, merge, dan alur kerja remote.",
          nilai_lulus: 70,
          soal: [
            {
              pertanyaan: "Apa itu branch di Git?",
              pilihan: [
                "Garis pengembangan terpisah yang menunjuk ke sebuah commit",
                "Salinan penuh repositori di server",
                "Berkas konfigurasi",
                "Cadangan otomatis",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Perintah untuk menggabungkan branch fitur ke branch aktif adalah…",
              pilihan: ["`git merge fitur`", "`git push fitur`", "`git clone fitur`", "`git add fitur`"],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "Apa yang dilakukan `git pull`?",
              pilihan: [
                "Mengambil perubahan dari remote dan menggabungkannya ke branch lokal",
                "Hanya mengunggah perubahan lokal",
                "Menghapus remote",
                "Membuat commit baru tanpa perubahan",
              ],
              jawaban_benar: 0,
            },
            {
              pertanyaan: "`git clone` digunakan untuk…",
              pilihan: [
                "Menyalin repositori remote beserta riwayatnya ke mesin lokal",
                "Menyalin satu berkas saja",
                "Membuat branch baru",
                "Menghapus repositori",
              ],
              jawaban_benar: 0,
            },
          ],
        },
      },
    ],
  },
];
