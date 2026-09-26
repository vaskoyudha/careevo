import Link from "next/link";
import { 
  Users, 
  Target, 
  BarChart3, 
  Clock, 
  TrendingUp, 
  Award,
  Zap,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Building2,
} from "lucide-react";
import { Reveal } from "@/components/features/marketing/primitives";

export const metadata = {
  title: "Careevo Bisnis · Solusi Pelatihan & Peningkatan Keterampilan Tim",
  description: "Tingkatkan keterampilan seluruh tim Anda dengan pelatihan interaktif, terarah, dan mandiri di bidang AI, data, rekayasa perangkat lunak, dan keterampilan industri masa depan.",
};

export default function BusinessPage() {
  return (
    <div className="marketing-type bg-white text-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/60 via-white to-white pt-12 pb-20 lg:pt-16 lg:pb-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_25rem_at_top,theme(colors.blue.100),transparent)] opacity-60" />
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50 px-3.5 py-1 text-xs font-semibold text-blue-700 shadow-xs">
                <Building2 className="size-3.5 text-blue-600" />
                <span>Careevo untuk Bisnis & Enterprise</span>
              </div>
              <h1 className="mb-6 text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl -tracking-[1.5px] leading-[1.12]">
                Dibangun untuk pembelajar.<br />
                <span className="text-[#0B408B]">Mendorong dampak nyata bagi tim.</span>
              </h1>
              <p className="mb-8 text-base text-gray-600 sm:text-lg lg:text-xl leading-relaxed">
                Dipercaya oleh ribuan profesional dan organisasi. Careevo Bisnis membantu perusahaan Anda meningkatkan keahlian teknis, literasi AI, dan kapabilitas rekayasa secara terukur dan terverifikasi.
              </p>

              {/* Value points */}
              <div className="mb-10 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs sm:text-sm font-medium text-gray-600">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-blue-600" />
                  Kurikulum berbasis praktik langsung
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-blue-600" />
                  Jalur belajar mandiri & interaktif
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-blue-600" />
                  Pelaporan & analitik tim real-time
                </span>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Link
                  href="/masuk"
                  className="grad-btn inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
                >
                  <span>Minta Demo Platform</span>
                  <ChevronRight className="size-4" />
                </Link>
                <Link
                  href="#harga"
                  className="inline-flex h-11 w-full sm:w-auto items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-800 shadow-xs transition hover:bg-gray-50 hover:text-gray-900"
                >
                  Lihat Paket & Harga
                </Link>
              </div>
            </Reveal>
          </div>

          {/* Hero Dashboard Preview */}
          <Reveal delay={150} className="mt-14 lg:mt-16">
            <div className="relative mx-auto max-w-5xl rounded-2xl border border-gray-200/90 bg-white p-2 shadow-2xl shadow-blue-900/10 ring-1 ring-gray-900/5">
              <div className="relative overflow-hidden rounded-xl bg-gray-900">
                <img
                  src="/images/business-landing/blp-hero.png"
                  alt="Dashboard Platform Careevo Bisnis"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Quick Action Grid */}
      <section className="border-t border-b border-gray-100 bg-gray-50/70 py-16 lg:py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 -tracking-[1px]">
              Mulai tingkatkan kapabilitas tim hari ini
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-500">
              Pilih opsi yang paling sesuai dengan kebutuhan divisi dan skala organisasi Anda.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Reveal delay={50}>
              <div className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md">
                <div>
                  <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Award className="size-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">Paket Tim Tahunan</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Akses tak terbatas ke seluruh katalog kursus teknis, modul AI, dan sertifikasi industri dengan lisensi fleksibel.
                  </p>
                </div>
                <Link
                  href="/masuk"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition group-hover:text-blue-700"
                >
                  <span>Mulai sekarang</span>
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md">
                <div>
                  <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Zap className="size-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">Uji Coba 14 Hari</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Evaluasi platform tanpa risiko hingga 10 anggota tim. Coba langsung modul interaktif dan panel analitik.
                  </p>
                </div>
                <Link
                  href="/daftar"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 transition group-hover:text-emerald-700"
                >
                  <span>Coba gratis 14 hari</span>
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md">
                <div>
                  <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <Users className="size-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">Enterprise Khusus</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Integrasi SSO/SAML kustom, API integrasi LMS, kurikulum tailor-made, dan Customer Success Manager berdedikasi.
                  </p>
                </div>
                <Link
                  href="/masuk"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-600 transition group-hover:text-purple-700"
                >
                  <span>Konsultasi Enterprise</span>
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Why Choose Careevo Bisnis */}
      <section className="py-20 lg:py-28 px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-3xl text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Keunggulan Platform</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 -tracking-[1.2px]">
              Mengapa Memilih Careevo untuk Bisnis?
            </h2>
            <p className="mt-3 text-base text-gray-500 leading-relaxed">
              Kombinasi pembelajaran berbasis praktik, bimbingan terstruktur, dan pemantauan berbasis data untuk hasil yang nyata.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Reveal delay={50}>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition hover:border-blue-200 hover:shadow-md">
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Zap className="size-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Belajar Sambil Praktik Langsung</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Hilangkan hambatan konfigurasi lingkungan lokal. Tim mulai menulis dan mengeksekusi kode langsung dari browser sejak menit pertama.
                </p>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition hover:border-blue-200 hover:shadow-md">
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Target className="size-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Jalur Pembelajaran Terpandu</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Kurikulum terstruktur memandu anggota tim langkah demi langkah untuk menguasai teknologi baru atau spesialisasi karier tertentu.
                </p>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition hover:border-blue-200 hover:shadow-md">
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Users className="size-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Mempertahankan Motivasi Tim</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Tantangan coding interaktif, target belajar mingguan, dan pencapaian terverifikasi menjaga keterlibatan anggota tim secara konsisten.
                </p>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition hover:border-blue-200 hover:shadow-md">
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <BarChart3 className="size-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Visualisasi Progres Real-Time</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Laporan metrik mendalam untuk melacak jam belajar, skor penilaian, modul selesai, dan tingkat retensi pemahaman keterampilan.
                </p>
              </div>
            </Reveal>

            <Reveal delay={250}>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition hover:border-blue-200 hover:shadow-md">
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Clock className="size-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Efisiensi Administrasi Tim</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Alat manajemen intuitif untuk manajer L&D dan pimpinan tim. Alokasikan kursi, tetapkan materi wajib, dan pantau kelulusan dengan mudah.
                </p>
              </div>
            </Reveal>

            <Reveal delay={300}>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition hover:border-blue-200 hover:shadow-md">
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <TrendingUp className="size-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Mencapai Target Pelatihan</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Sesuaikan materi untuk beragam profil: onboarding developer baru, transisi ke cloud, atau literasi AI untuk tim non-teknis.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feature Deep Dive 1: Admin Tools & Learning Experience */}
      <section className="border-t border-gray-100 bg-gray-50/60 py-20 lg:py-28 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Pengalaman Interaktif</span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 -tracking-[1.2px]">
                Metode belajar yang benar-benar melekat di ingatan
              </h2>
              <p className="mt-4 text-base text-gray-600 leading-relaxed">
                Bukan sekadar menonton video atau mencentang kotak. Pelajaran interaktif mandiri dalam topik AI, data analytics, cloud, dan pengembangan perangkat lunak membuat tim langsung mengaplikasikan apa yang dipelajari.
              </p>
              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <p className="text-sm text-gray-600">Editor kode interaktif langsung di browser tanpa instalasi perangkat lunak rumit.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <p className="text-sm text-gray-600">Umpan balik seketika saat ada sintaks atau logika program yang keliru.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <p className="text-sm text-gray-600">Proyek portofolio berbasis kasus nyata dari dunia industri modern.</p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-xl shadow-gray-200/50">
                <img
                  src="/images/business-landing/admin-tools.png"
                  alt="Alat Pengelolaan dan Admin Dashboard"
                  className="w-full rounded-xl object-cover"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feature Deep Dive 2: Real-time Reports */}
      <section className="py-20 lg:py-28 px-6 bg-white">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal delay={100} className="order-2 lg:order-1">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-xl shadow-gray-200/50">
                <img
                  src="/images/business-landing/reports.png"
                  alt="Laporan Hasil dan Analitik Pembelajaran"
                  className="w-full rounded-xl object-cover"
                />
              </div>
            </Reveal>

            <Reveal className="order-1 lg:order-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Analitik & Pelaporan</span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 -tracking-[1.2px]">
                Laporan transparan yang membuktikan hasil investasi L&D
              </h2>
              <p className="mt-4 text-base text-gray-600 leading-relaxed">
                Ketahui dengan pasti dampak program pembelajaran Anda. Dashboard pimpinan memberikan gambaran komprehensif mengenai tingkat partisipasi, kecepatan penyelesaian modul, dan keahlian baru yang telah dikuasai.
              </p>
              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <p className="text-sm text-gray-600">Ekspor data komprehensif untuk evaluasi performa kuartalan.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <p className="text-sm text-gray-600">Identifikasi kesenjangan keterampilan di tiap departemen dengan akurat.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <p className="text-sm text-gray-600">Pemberian sertifikat digital terverifikasi HMAC setelah modul selesai.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* AI Acceleration Section */}
      <section className="border-t border-gray-100 bg-gray-50/60 py-20 lg:py-28 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <Sparkles className="size-3.5" />
                <span>Asisten Belajar Cerdas</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 -tracking-[1.2px]">
                Akselerasi Penguasaan Materi dengan Asisten AI
              </h2>
              <p className="mt-4 text-base text-gray-600 leading-relaxed">
                Dapatkan bantuan terintegrasi langsung saat menghadapi error atau konsep rumit. Asisten AI kami memberikan petunjuk sokratik yang membimbing cara berpikir problem-solving tanpa langsung memberikan contekan kode.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-gray-900">Penjelasan Error Seketika</h4>
                  <p className="mt-1 text-xs text-gray-500">Membantu developer memahami pesan kesalahan kompilasi dan cara mengatasinya secara mandiri.</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-gray-900">Rangkuman Konsep Interaktif</h4>
                  <p className="mt-1 text-xs text-gray-500">Menyederhanakan konsep abstrak seperti arsitektur sistem, algoritma, atau pipeline data.</p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-xl shadow-gray-200/50">
                <img
                  src="/images/business-landing/ai-accelerated-learning.png"
                  alt="Asisten AI dalam Pembelajaran Careevo"
                  className="w-full rounded-xl object-cover"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="harga" className="py-20 lg:py-28 px-6 bg-white">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Investasi Transparan</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 -tracking-[1.2px]">
              Paket Fleksibel Sesuai Kebutuhan Organisasi
            </h2>
            <p className="mt-3 text-base text-gray-500">
              Tersedia diskon berjenjang untuk skala tim yang lebih besar. Hubungi kami untuk penawaran khusus.
            </p>
          </Reveal>

          <div className="mx-auto max-w-lg">
            <Reveal delay={100}>
              <div className="relative rounded-2xl border-2 border-blue-500 bg-white p-8 shadow-xl shadow-blue-500/5 ring-4 ring-blue-500/10">
                <div className="absolute -top-3.5 right-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-xs">
                  Paling Populer
                </div>
                <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Paket Careevo Teams</div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">IDR 399.000</span>
                  <span className="text-sm text-gray-500 font-medium">/kursi/bulan</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">Ditagih tahunan. Minimum 5 kursi untuk tim kolaboratif.</p>

                <div className="my-8 border-t border-gray-100 pt-6">
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="size-4 shrink-0 text-blue-600" />
                      <span>Akses penuh ke semua 500+ modul teknologi & AI</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="size-4 shrink-0 text-blue-600" />
                      <span>Dashboard analitik & laporan progres tim</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="size-4 shrink-0 text-blue-600" />
                      <span>Fitur re-assignment kursi lisensi fleksibel</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="size-4 shrink-0 text-blue-600" />
                      <span>Asisten pembelajaran AI tanpa batas penggunaan</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="size-4 shrink-0 text-blue-600" />
                      <span>Dukungan prioritas tim Customer Success Careevo</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link
                    href="/masuk"
                    className="grad-btn flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
                  >
                    Minta Penawaran Tim
                  </Link>
                  <Link
                    href="/daftar"
                    className="flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Mulai Uji Coba Gratis
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Customer Proof / Testimonial Showcase */}
      <section className="border-t border-gray-100 bg-gray-50/70 py-20 lg:py-28 px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-3xl text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Kisah Sukses Klien</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 -tracking-[1.2px]">
              Bagaimana Berbagai Perusahaan Berkembang Bersama Kami
            </h2>
            <p className="mt-3 text-base text-gray-500">
              Pelajari bagaimana para pemimpin teknologi meningkatkan retensi talenta dan kecepatan rilis produk.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Reveal delay={50}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition hover:shadow-md">
                <div>
                  <div className="mb-4 h-8">
                    <img src="/images/business-landing/logo-rizepoint.png" alt="RizePoint" className="h-6 object-contain" />
                  </div>
                  <h4 className="mb-2 text-base font-semibold text-gray-900">Mempertahankan Talenta & Membuka Jalur Karier</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    &ldquo;Careevo memberikan cara terstruktur bagi para engineer junior untuk naik ke level berikutnya secara terarah tanpa membebani jadwal senior engineer.&rdquo;
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100 text-xs font-semibold text-blue-600">
                  Studi Kasus RizePoint
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition hover:shadow-md">
                <div>
                  <div className="mb-4 h-8">
                    <img src="/images/business-landing/logo-mark-cuban-foundation.png" alt="Mark Cuban Foundation" className="h-6 object-contain" />
                  </div>
                  <h4 className="mb-2 text-base font-semibold text-gray-900">Mencetak Generasi Penerus Spesialis AI</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    &ldquo;Platform hands-on ini membuat pemahaman materi kecerdasan buatan menjadi sangat aplikatif dan mudah diakses oleh peserta dari berbagai latar belakang.&rdquo;
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100 text-xs font-semibold text-blue-600">
                  Studi Kasus Yayasan
                </div>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-xs transition hover:shadow-md">
                <div>
                  <div className="mb-4 h-8">
                    <img src="/images/business-landing/logo-motley-fool.png" alt="The Motley Fool" className="h-6 object-contain" />
                  </div>
                  <h4 className="mb-2 text-base font-semibold text-gray-900">Menghubungkan Tim Teknis & Non-Teknis</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    &ldquo;Kini tim analis bisnis dan produk kami dapat berkomunikasi dengan bahasa data dan kode yang sama dengan para software engineer kami.&rdquo;
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100 text-xs font-semibold text-blue-600">
                  Studi Kasus Kolaborasi Lintas Tim
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Curated Resources */}
      <section className="py-20 lg:py-28 px-6 bg-white">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Panduan & Sumber Daya</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 -tracking-[1.2px]">
              Panduan Memulai untuk Tim Anda
            </h2>
            <p className="mt-3 text-base text-gray-500">
              Pelajari materi kurasi dan video penjelasan untuk memaksimalkan implementasi pelatihan di tempat kerja.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Reveal delay={50}>
              <div className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs transition hover:border-blue-200 hover:shadow-md">
                <div className="h-44 bg-gray-50 flex items-center justify-center p-4">
                  <img
                    src="/images/business-landing/illu-product-demo.png"
                    alt="Demo Produk"
                    className="max-h-36 object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-base font-semibold text-gray-900">Tonton Demo Fitur Platform</h3>
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                    Kenali fitur manajemen pengguna, sistem penugasan materi, dan evaluasi hasil belajar dalam video singkat 5 menit.
                  </p>
                  <Link href="/masuk" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                    <span>Tonton sekarang</span>
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs transition hover:border-blue-200 hover:shadow-md">
                <div className="h-44 bg-gray-50 flex items-center justify-center p-4">
                  <img
                    src="/images/business-landing/illu-curated-catalog.png"
                    alt="Katalog Kurasi"
                    className="max-h-36 object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-base font-semibold text-gray-900">Jelajahi Katalog Modul Bisnis</h3>
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                    Daftar lengkap kurikulum AI, Fullstack, DevOps, Data Science, dan Cybersecurity yang dirancang khusus untuk kebutuhan industri.
                  </p>
                  <Link href="/courses" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                    <span>Lihat katalog lengkap</span>
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs transition hover:border-blue-200 hover:shadow-md">
                <div className="h-44 bg-gray-50 flex items-center justify-center p-4">
                  <img
                    src="/images/business-landing/illu-teams-tips.png"
                    alt="Tips Tim"
                    className="max-h-36 object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-base font-semibold text-gray-900">Praktik Terbaik Implementasi L&D</h3>
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                    Strategi terbukti dalam menyelaraskan modul pelatihan teknis dengan roadmap produk dan KPI tim rekayasa.
                  </p>
                  <Link href="/belajar" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                    <span>Baca panduan</span>
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 py-16 lg:py-20 text-white px-6">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight -tracking-[1px] text-white">
              Siap mentransformasi kapabilitas tim Anda?
            </h2>
            <p className="mt-4 text-base text-blue-100/90 leading-relaxed max-w-2xl mx-auto">
              Hubungi tim spesialis Careevo Bisnis untuk menjadwalkan sesi demonstrasi langsung dan diskusikan kebutuhan pelatihan perusahaan Anda.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/masuk"
                className="grad-btn inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg"
              >
                <span>Jadwalkan Konsultasi Tim</span>
                <ChevronRight className="size-4" />
              </Link>
              <Link
                href="/daftar"
                className="inline-flex h-11 w-full sm:w-auto items-center justify-center rounded-lg border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
              >
                Coba 14 Hari Gratis
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
