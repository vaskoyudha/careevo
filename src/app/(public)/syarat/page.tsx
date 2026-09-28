import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumen, BagianLegal } from "@/components/features/legal/legal-documen";
import "@/components/features/legal/legal.css";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description:
    "Ketentuan penggunaan Careevo: akun, pekerjaan yang kamu kerjakan, dan cara kredensial terbit dan dicabut.",
  alternates: { canonical: "/syarat" },
};

const ENTRI = [
  { id: "ringkasan", judul: "Ringkasan" },
  { id: "cakupan", judul: "Cakupan" },
  { id: "akun", judul: "Akun" },
  { id: "karya", judul: "Pekerjaanmu" },
  { id: "sertifikat", judul: "Sertifikat dan pencabutan" },
  { id: "biaya", judul: "Biaya dan langganan" },
  { id: "idt", judul: "Hak intelektual" },
  { id: "idt-materi", judul: "Karya yang kamu kirim" },
  { id: "idt-hasil", judul: "Materi dan materi ajar" },
  { id: "perilaku", judul: "Perilaku yang dilarang" },
  { id: "ganti", judul: "Penghentian dan perubahan" },
  { id: "tanggung-jawab", judul: "Penegakan ketentuan ini" },
  { id: "kontak", judul: "Kontak" },
];

export default function HalamanSyarat() {
  return (
    <div className="marketing-type bg-white pt-28 pb-24 lg:pt-32">
      <div className="mx-auto mb-14 max-w-6xl px-5 lg:px-6">
        <p className="mb-4 font-mono text-[11px] tracking-[0.14em] text-[--text-secondary] uppercase">
          Dokumen legal
        </p>
        <h1 className="max-w-3xl text-4xl font-medium tracking-[-0.03em] text-[--text] sm:text-5xl">
          Syarat &amp; Ketentuan
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[--text-secondary]">
          Ketentuan ini mengatur apa yang kamu lakukan di Careevo, dan yang kami
          lakukan untukmu sebagai gantinya.
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
                Kamu yang mengerjakan karyanya, dan kami yang mencatatnya apa
                adanya.
              </strong>{" "}
              Kami menilai dari prosesnya, bukan dari hasilnya saja — termasuk
              bagian yang salah dan yang kamu perbaiki sendiri.
            </p>
          </div>
          <p>
            Dengan membuat akun, kamu menerima ketentuan ini. Jika kamu tidak
            setuju dengan salah satunya, jangan buat akun. Ketentuan ini berlaku
            bersama <Link href="/privasi">Kebijakan Privasi</Link> yang mengatur
            data yang kami simpan.
          </p>
        </BagianLegal>

        <BagianLegal id="cakupan" judul="Cakupan">
          <p>
            Ketentuan ini berlaku untuk situs dan aplikasi Careevo, termasuk
            halaman lowongan dan profil publik. Layanan pihak ketiga yang
            tautannya kamu temukan lewat platform ini punya ketentuannya
            masing-masing.
          </p>
        </BagianLegal>

        <BagianLegal id="akun" judul="Akun">
          <ul>
            <li>Kamu butuh akun untuk mengirim karya dan meminta penilaian.</li>
            <li>
              Kamu bertanggung jawab menjaga kata sandimu, dan bertanggung jawab
              atas aktivitas yang terjadi di akunmu.
            </li>
            <li>
              Kata sandi yang bocor harus diganti. Kalau kamu menduga ada yang
              menyalahgunakan akunmu, hubungi kami.
            </li>
            <li>
              Satu orang, satu akun. Dengan lebih dari satu akun, kamu
              kehilangan hak atas karya dan kredensial yang terikat pada akun
              itu.
            </li>
            <li>Usia minimum untuk membuat akun adalah 16 tahun.</li>
          </ul>
        </BagianLegal>

        <BagianLegal id="karya" judul="Pekerjaanmu">
          <h3>Karya yang kamu kirim</h3>
          <p>
            Saat kamu mengirim tugas atau proyek, kamu menyatakan kamu menulisnya
            sendiri atau punya hak untuk mengerjakannya. Kami menilai dari proses
            yang tercatat, bukan dari hasilnya saja.
          </p>
          <h3>Apa yang kami periksa</h3>
          <p>
            Penilaian memakai lima kriteria berbobot: kelengkapan, kualitas,
            orisinalitas, ketepatan dengan brief, dan dokumentasi. Nilai
            ketercapaian modul dihitung terpisah dari nilai karya, dan keduanya
            bisa berbeda.
          </p>
          <h3>Keputusan verifikator</h3>
          <p>
            Verifikator adalah manusia, dan penilaiannya bisa ditolak dengan
            alasan. Setiap keputusan, baik diterima atau ditolak, menyimpan
            alasannya, dan alasan itu bisa kamu baca.
          </p>
        </BagianLegal>

        <BagianLegal id="sertifikat" judul="Sertifikat dan pencabutan">
          <p>
            Sertifikat terbit setelah dua hal benar-benar terjadi: kamu
            menyelesaikan kursus lewat jalur terverifikasi, lalu karyanya
            ditinjau dan disetujui verifikator.{" "}
            <strong>
              Menyelesaikan 100% materi tidak otomatis menerbitkan sertifikat.
            </strong>
          </p>
          <div className="overflow-x-auto">
            <table className="legal-table">
              <caption className="sr-only">
                Keadaan kredensial dan artinya
              </caption>
              <thead>
                <tr>
                  <th scope="col">Keadaan</th>
                  <th scope="col">Artinya</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Terkunci</th>
                  <td>Materi belum selesai. Belum ada yang dikirim ke mana pun.</td>
                </tr>
                <tr>
                  <th scope="row">Siap</th>
                  <td>
                    Kursus selesai dan terverifikasi. Kamu bisa mengirim karya.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Terbit</th>
                  <td>
                    Ada kredensial bertanda tangan yang bisa dibuka siapa pun.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Dicabut</th>
                  <td>
                    Ditarik karena karya yang mendasarinya tidak valid. Tautan
                    verifikasi ikut berubah.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Kredensial bisa dicabut kalau kami menemukan karyanya bukan milikmu,
            atau kalau jawaban yang kamu kirim tidak dikerjakan olehmu.
            Pencabutan tercatat di log audit dan tidak bisa dihapus.
          </p>
          <p>
            Sertifikat tidak menjamin kamu diterima di suatu pekerjaan. Itu
            pernyataan tentang proses belajarmu, bukan pernyataan tentang nilai
            kerjamu di pasar.
          </p>
        </BagianLegal>

        <BagianLegal id="biaya" judul="Biaya dan langganan">
          <p>
            <strong>[PLACEHOLDER: ketentuan harga dan paket]</strong>
          </p>
          <p>
            Paket gratis tidak memerlukan kartu kredit. Kalau kamu berlangganan
            lalu membatalkan, akses berbayar tetap jalan sampai akhir periode yang
            sudah dibayar, dan tidak ada tagihan kedua.
          </p>
        </BagianLegal>

        <BagianLegal id="idt" judul="Hak intelektual">
          <p>
            Careevo, tanda tangannya, perangkat lunak, desain, dan materi
            aslinya adalah milik kami atau pemberi lisensinya. Hak ini dilindungi
            hukum, dan kami menghargainya.
          </p>
        </BagianLegal>

        <BagianLegal id="idt-materi" judul="Karya yang kamu kirim">
          <p>
            Kamu tetap pemilik karya yang kamu kerjakan. Kamu memberi kami
            <strong> lisensi terbatas dan non-eksklusif</strong> untuk
            menampilkannya, menilai, menandatanganinya, dan menautkannya ke
            profil publikmu. Kamu bisa mencabut lisensi ini kapan saja; karya
            akan hilang dari yang bisa dilihat orang, sementara catatan
            penilaiannya tetap tersimpan sebagai riwayat akademikmu.
          </p>
        </BagianLegal>

        <BagianLegal id="idt-hasil" judul="Materi dan materi ajar">
          <p>
            Materi, kurikulum, pertanyaan kuis, dan rubrik penilaian milik
            Careevo. Kamu boleh belajar dan mengacu padanya, tapi tidak boleh
            menyalin, menjual, atau mendistorsinya.
          </p>
        </BagianLegal>

        <BagianLegal id="perilaku" judul="Perilaku yang dilarang">
          <p>Kamu tidak boleh:</p>
          <ul>
            <li>Menyalin karya orang lain dan mengakuinya milikmu</li>
            <li>Menggunakan akun orang lain</li>
            <li>Mengirim jawaban memakai alat otomatis atau skrip</li>
            <li>Mengganggu layanan kami atau menghalangi orang lain memakainya</li>
            <li>
              Menggunakan platform untuk memata-matai, menilai, atau
              menyeleksi orang di luar proses yang kami tawarkan
            </li>
          </ul>
        </BagianLegal>

        <BagianLegal id="ganti" judul="Penghentian dan perubahan">
          <p>
            Kamu bisa menghapus akunmu kapan saja di Pengaturan, dan penghapusan
            tidak bisa dibatalkan. Kami bisa menonaktifkan akun yang melanggar
            ketentuan ini, dengan alasan yang bisa kamu baca.
          </p>
          <p>
            Kami bisa mengubah ketentuan ini. Untuk perubahan yang memengaruhi
            hakmu, kami memberi tahu lewat email dan memperbarui tanggal di atas.
            Ketentuan yang berlaku untukmu adalah versi yang aktif saat kamu
            menyetujuinya.
          </p>
        </BagianLegal>

        <BagianLegal id="tanggung-jawab" judul="Penegakan ketentuan ini">
          <p>
            Ketentuan ini ditulis dalam bahasa Indonesia dan tunduk pada hukum{" "}
            <strong>[PLACEHOLDER: yurisdiksi]</strong>. Kalau ada bagian yang
            tidak bisa dijalankan, bagian itu dilepaskan tanpa memengaruhi bagian
            lain.
          </p>
        </BagianLegal>

        <BagianLegal id="kontak" judul="Kontak">
          <p>Untuk pertanyaan soal ketentuan ini:</p>
          <ul>
            <li>
              Email: <strong>[PLACEHOLDER: email kontak]</strong>
            </li>
            <li>
              Badan usaha: <strong>[PLACEHOLDER: nama badan usaha]</strong>
            </li>
            <li>
              Alamat: <strong>[PLACEHOLDER: alamat terdaftar]</strong>
            </li>
          </ul>
          <p className="mt-6 text-sm text-[--text-tertiary]">
            Baca juga <Link href="/privasi">Kebijakan Privasi</Link> untuk apa
            yang kami rekam dan berapa lama menyimpannya.
          </p>
        </BagianLegal>
      </LegalDocumen>
    </div>
  );
}
