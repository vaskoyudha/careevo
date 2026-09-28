import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumen, BagianLegal } from "@/components/features/legal/legal-documen";
import "@/components/features/legal/legal.css";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Data apa yang Careevo catat, data apa yang tidak pernah dicatat, dan berapa lama setiap data disimpan.",
  alternates: { canonical: "/privasi" },
};

const ENTRI = [
  { id: "ringkasan", judul: "Ringkasan" },
  { id: "dikumpulkan", judul: "Data yang kami kumpulkan" },
  { id: "tidak-dikumpulkan", judul: "Yang tidak pernah kami kumpulkan" },
  { id: "kegunaan", judul: "Untuk apa datanya dipakai" },
  { id: "publik", judul: "Data yang publik" },
  { id: "pembagian", judul: "Berbagi dengan pihak ketiga" },
  { id: "penyimpanan", judul: "Berapa lama disimpan" },
  { id: "hak-anda", judul: "Hak Anda" },
  { id: "kamera", judul: "Soal kamera" },
  { id: "keamanan", judul: "Keamanan" },
  { id: "perubahan", judul: "Perubahan kebijakan" },
  { id: "kontak", judul: "Kontak" },
];

export default function HalamanPrivasi() {
  return (
    <div className="marketing-type bg-white pt-28 pb-24 lg:pt-32">
      {/* Kop: satu kalimat yang menjawab pertanyaan paling sering muncul
          ("apakah ini aman?") sebelum kata legal apa pun. */}
      <div className="mx-auto mb-14 max-w-6xl px-5 lg:px-6">
        <p className="mb-4 font-mono text-[11px] tracking-[0.14em] text-[--text-secondary] uppercase">
          Dokumen legal
        </p>
        <h1 className="max-w-3xl text-4xl font-medium tracking-[-0.03em] text-[--text] sm:text-5xl">
          Kebijakan privasi
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[--text-secondary]">
          Halaman ini menjelaskan data apa yang kami simpan, data apa yang tidak
          pernah kami simpan, dan berapa lama setiap data disimpan.
        </p>
        <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[--text-tertiary]">
          <span>Terakhir diperbarui 28 September 2026</span>
          <span aria-hidden="true">·</span>
          <span>Berlaku untuk careevo.id</span>
        </p>
      </div>

      <LegalDocumen entri={ENTRI}>
        <BagianLegal id="ringkasan" judul="Ringkasan">
          <div className="legal-callout">
            <p>
              <strong>
                Kami tidak memakai kamera, tidak merekam layar, dan tidak
                mengambil sidik jari atau data biometrik apa pun.
              </strong>{" "}
              Yang kami simpan hanya pekerjaanmu di platform: tugas yang kamu
              kerjakan, revisi yang kamu buat, dan jawaban tesmu.
            </p>
          </div>
          <p>
            Halaman ini disusun supaya bisa dibaca orang awam, bukan hanya
            oleh petugas. Setiap bagian punya jawaban singkat di paragraf
            paling atas, dan seluruh dokumen bisa dipindai dengan daftar isi
            di samping.
          </p>
        </BagianLegal>

        <BagianLegal id="dikumpulkan" judul="Data yang kami kumpulkan">
          <p>Kami mengumpulkan tiga kelompok data:</p>
          <h3>Data akun</h3>
          <p>
            Nama, alamat email, dan kata sandi dalam bentuk terenkripsi. Kami
            juga menyimpan peran akunmu — peserta, verifikator, atau admin.
          </p>
          <h3>Data aktivitas belajar</h3>
          <p>
            Materi apa yang kamu buka, kapan kamu mulai dan selesai belajar,
            jawaban yang kamu ketik, dan hasil tes. Ini yang membuat rekam jejak
            kerjamu bisa dinilai dan ditandatangani.
          </p>
          <h3>Data teknis</h3>
          <p>
            Alamat IP dan jenis peramban, dipakai untuk keamanan akun dan
            untuk menelusuri kesalahan. Data ini tidak pernah ditampilkan di
            profil publikmu.
          </p>
        </BagianLegal>

        <BagianLegal id="tidak-dikumpulkan" judul="Yang tidak pernah kami kumpulkan">
          <div className="overflow-x-auto">
            <table className="legal-table">
              <caption className="sr-only">
                Data yang tidak pernah dikumpulkan Careevo
              </caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Foto/video kamera</th>
                  <td>
                    Tidak dikumpulkan. Kamera tidak menyala di sesi yang kamu
                    mulai dari Careevo.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Sidik jari, wajah, sidik suara</th>
                  <td>
                    Tidak dikumpulkan, dan tidak ada kode yang memprosesnya.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Rekaman layar</th>
                  <td>
                    Tidak direkam. Kami mencatat halaman yang kamu buka, bukan
                    isi layar saat kamu membukanya.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Nomor KTP / NPWP</th>
                  <td>Tidak pernah diminta, untuk tujuan apa pun.</td>
                </tr>
                <tr>
                  <th scope="row">Lokasi Continuity</th>
                  <td>
                    Tidak dilacak antar situs. Lokasi yang kamu masuk sendiri di
                    lowongan hanya untuk lowongan itu.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BagianLegal>

        <BagianLegal id="kegunaan" judul="Untuk apa datanya dipakai">
          <p>
            Tiga hal saja: menjalankan platformnya, menilai karya yang kamu
            kerjakan, dan menerbitkan sertifikat yang bisa diverifikasi.
          </p>
          <p>
            <strong>Kami tidak menjual datamu</strong> dan tidak
            membagikannya untuk iklan. Datamu tidak pernah masuk ke model
            bahasa pihak ketiga mana pun.
          </p>
        </BagianLegal>

        <BagianLegal id="publik" judul="Data yang publik">
          <p>
            Sertifikat yang terbit bersifat publik, dan itu justru
            pertunjukannya. Halaman <code>/p/[username]</code> menampilkan
            hal-hal berikut, dan tidak ada yang lain:
          </p>
          <ul>
            <li>Username, bukan nama asli dan bukan email</li>
            <li>Kursus yang selesai, jalur penyelesaian, dan skor</li>
            <li>Attestation yang terbit beserta tanda tangannya</li>
            <li>Skor integritas akun</li>
          </ul>
          <p>
            Kamu bisa menyembunyikan profilmu kapan saja di{" "}
            <Link href="/pengaturan">Pengaturan</Link>. Menonaktifkannya
            membatalkan tautan verifikasi lama; ini tidak bisa dibatalkan
            setelah kredensial terbit.
          </p>
        </BagianLegal>

        <BagianLegal id="pembagian" judul="Berbagi dengan pihak ketiga">
          <p>Data hanya keluar dari sistem kami dalam tiga keadaan:</p>
          <ol>
            <li>
              <strong>Penyedia infrastruktur.</strong> Hosting dan database
              menyimpan data atas nama kami, dengan kontrak yang mengikat mereka
              pada kewajiban yang sama dengan kami.
            </li>
            <li>
              <strong>Verifikator.</strong> Saat kamu submit karya, verifikator
              yang menilainya melihat isi karya dan rubrik penilaiannya. Mereka
              melihat username-mu, bukan identitas asli dan bukan email-mu.
            </li>
            <li>
              <strong>Aturan hukum.</strong> Jika diwajibkan oleh hukum yang
              berlaku, kami akan memberitahu kamu kecuali hukum tersebut
              melarang pengungkapan itu.
            </li>
          </ol>
          <p>Kami tidak menjual, menyewakan, atau menukar data kamu.</p>
        </BagianLegal>

        <BagianLegal id="penyimpanan" judul="Berapa lama disimpan">
          <div className="overflow-x-auto">
            <table className="legal-table">
              <caption className="sr-only">Masa simpan tiap kelompok data</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Disimpan selama</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Akun aktif</th>
                  <td>Selama akunmu aktif.</td>
                </tr>
                <tr>
                  <th scope="row">Data setelah akun dihapus</th>
                  <td>
                    <strong>[PLACEHOLDER: masa simpan]</strong>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Rekam jejak dan attestation</th>
                  <td>
                    <strong>[PLACEHOLDER: masa simpan]</strong>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Log keamanan</th>
                  <td>
                    <strong>[PLACEHOLDER: masa simpan]</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Kredensial yang pernah terbit tetap bisa diverifikasi sebagai
            dicabut setelah akun dihapus, karena rekam jejak yang pernah
            dibagikan adalah bagian dari jejak yang sudah keluar dari tangan
            kami.
          </p>
        </BagianLegal>

        <BagianLegal id="hak-anda" judul="Hak Anda">
          <p>Kamu berhak, dan kami menyediakan jalannya lewat Pengaturan:</p>
          <ul>
            <li>Melihat dan mengunduh salinan data yang tersimpan tentangmu</li>
            <li>Mengoreksi data yang salah</li>
            <li>Menyembunyikan profil publikmu</li>
            <li>Menghapus akunmu beserta isinya</li>
            <li>Menarik persetujuan atas pemrosesan tertentu</li>
          </ul>
          <p>
            Untuk permintaan yang tidak bisa kamu kerjakan sendiri, hubungi kami
            di alamat pada bagian Kontak. Kami menjawab dalam{" "}
            <strong>[PLACEHOLDER: tenggat jawaban]</strong>.
          </p>
        </BagianLegal>

        <BagianLegal id="kamera" judul="Soal kamera">
          <p>
            Ini bagian yang paling sering ditanyakan, jadi kami meletakkannya
            sendiri.
          </p>
          <p>
            Ada fitur kamera yang dirancang hanya menyala di dalam sesi
            verifikasi yang kamu setujui sendiri.{" "}
            <strong>Fitur itu belum berjalan di aplikasi ini</strong> — tidak
            ada kamera yang menyala hari ini. Jika suatu saat kami
            mengaktifkannya, halaman ini akan diperbarui lebih dulu, dan kami
            tidak akan menyalakannya tanpa persetujuanmu lebih dulu.
          </p>
          <p>
            Yang kami catat di sesi belajar adalah kapan kamu mulai, kapan
            selesai, dan halaman mana yang kamu buka — bukan video dari kamera.
          </p>
        </BagianLegal>

        <BagianLegal id="keamanan" judul="Keamanan">
          <ul>
            <li>Kata sandi disimpan dengan hash bcrypt, tidak pernah sebagai teks biasa.</li>
            <li>Semua lalu lintas dienkripsi dengan TLS.</li>
            <li>Session disimpan di cookie httpOnly, jadi tidak bisa dibaca JavaScript.</li>
            <li>
              Sertifikat ditandatangani HMAC-SHA256 atas payload yang
              di-canonicalize, sehingga satu karakter pun yang diubah akan
              menggagalkan verifikasinya.
            </li>
            <li>
              Setiap perubahan penting ditulis ke audit log append-only yang
              tidak bisa diedit.
            </li>
          </ul>
          <p>
            Tidak ada sistem yang sempurna. Kalau kamu menemukan celah, laporkan
            ke alamat Kontak dan kami akan mengetahuinya.
          </p>
        </BagianLegal>

        <BagianLegal id="perubahan" judul="Perubahan kebijakan">
          <p>
            Kami mungkin memperbarui halaman ini. Untuk perubahan yang
            memengaruhi hakmu secara material, kami memberi tahu lewat email dan
            menampilkan tanggal di bagian atas dokumen ini.
          </p>
        </BagianLegal>

        <BagianLegal id="kontak" judul="Kontak">
          <p>
            Untuk pertanyaan soal privasi, atau untuk mengajukan permintaan
            atas data kamu:
          </p>
          <ul>
            <li>
              Email: <strong>[PLACEHOLDER: email privasi]</strong>
            </li>
            <li>
              Badan usaha: <strong>[PLACEHOLDER: nama badan usaha]</strong>
            </li>
            <li>
              Alamat: <strong>[PLACEHOLDER: alamat terdaftar]</strong>
            </li>
          </ul>
          <p className="mt-6 text-sm text-[--text-tertiary]">
            Lihat juga{" "}
            <Link href="/syarat">Syarat &amp; Ketentuan</Link> untuk ketentuan
            layanan dan penggunaan kredensial.
          </p>
        </BagianLegal>
      </LegalDocumen>
    </div>
  );
}
