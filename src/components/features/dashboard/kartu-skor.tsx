import { Info, MoreHorizontal, ShieldCheck, TrendingUp } from "lucide-react";
import { SKOR_AWAL, labelTingkatSkor, tingkatSkor, type RingkasanSkor } from "@/lib/integritas/skor";

/**
 * Kartu skor kejujuran di dashboard peserta.
 *
 * Angka, rincian, dan status semua diteruskan dari server
 * (`skorIntegritasDenganDelta`). Komponen ini **tidak** menghitung apa pun:
 * `learning_runs` dan `integrity_violations` tidak pernah ikut ke bundel browser,
 * dan hitungan kedua di klien akan bisa berbeda dari yang dibaca server tanpa ada
 * yang memperingatkan. Chip tingkatnya juga turunan dari angka yang sama
 * (`labelTingkatSkor`), bukan ambang yang ditulis ulang di sini.
 *
 * Yang ditampilkan apa adanya:
 *
 * - **Angka besar + rincian per course.** Skor 80 tanpa penjelasan course mana
 *   yang memotongnya tidak bisa dijelaskan peserta; ia hanya menimbulkan
 *   pertanyaan yang tidak terjawab.
 * - **Angka penuh ditulis, bukan cuma bar.** Skor 100 tampil sebagai "100 / 100",
 *   bukan "100", supaya "mulai dari 100" terlihat eksplisit dan tidak bisa
 *   disalahbaca sebagai "nilai kuis".
 * - **Penjelasan dasar skor.** Skor ini turun dari catatan yang ditulis manusia,
 *   bukan dari deteksi otomatis; mengatakannya mencegah "100/100" dibaca sebagai
 *   "tidak ada yang salah". Tidak ada kata vonis di sini — batas yang dijaga
 *   `katalog.test.ts` berlaku juga untuk copy ini.
 * - **Delta hanya bila ada pembandingnya.** `delta` bernilai `null` untuk akun
 *   yang belum punya riwayat sama sekali; chip "+0 dari minggu lalu" pada akun
 *   bersih adalah klaim kosong, jadi ia tidak dirender sama sekali.
 *
 * Batas kata vonis: kata "curang", "menyalin", "mencontek", "penyalahgunaan",
 * dan "bersalah" tidak boleh muncul sebagai label yang dirender otomatis.
 */
export function KartuSkor({
  ringkasan,
}: {
  ringkasan: RingkasanSkor & { skorSebelumnya?: number | null; delta?: number | null };
}) {
  const { skor, penaltiTotal, perCourse, delta } = ringkasan;
  const bersih = skor === SKOR_AWAL;
  const tingkat = tingkatSkor(skor);

  const nadaTingkat =
    tingkat === "sangat-baik"
      ? "bg-emerald-50 text-emerald-700"
      : tingkat === "baik"
        ? "bg-blue-50 text-[#0056D2]"
        : "bg-amber-50 text-amber-700";

  return (
    <section aria-labelledby="judul-skor" className="dash-card min-w-0">
      <div className="dash-card-head">
        <span className="dash-icon" aria-hidden="true">
          <ShieldCheck className="size-4" />
        </span>
        <h2 id="judul-skor" className="dash-title">
          Skor Kejujuran
        </h2>
        {/* Dekoratif, sama seperti di kartu profil: bukan menu yang bisa dibuka. */}
        <span className="dash-head-action text-gray-400" aria-hidden="true">
          <MoreHorizontal className="size-4" />
        </span>
      </div>

      <div className="dash-gap-sm flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <SkorAngka nilai={skor} />
          <span className="text-[14px] font-medium text-gray-500">/ {SKOR_AWAL}</span>
        </div>

        {/* Delta naik dan turun dibedakan oleh arah panah DAN tanda, bukan warna
            saja. Penurunan sengaja tidak diwarnai merah: skor yang turun karena
            catatan baru adalah produk bekerja, bukan kesalahan peserta. */}
        {delta !== null && delta !== undefined && delta !== 0 ? (
          <span
            className={
              "inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold " +
              (delta > 0 ? "text-emerald-600" : "text-gray-500")
            }
          >
            <TrendingUp
              className={"size-3.5 " + (delta < 0 ? "-scale-y-100" : "")}
              aria-hidden="true"
            />
            {delta > 0 ? `+${delta}` : delta} dari minggu lalu
          </span>
        ) : null}
      </div>

      {/* Chip tingkat duduk **di atas** ujung kiri bar, bukan di barisnya
          sendiri — itu yang membuat kartu ini setinggi kartu lain di
          referensi. Bar-nya tetap elemen penuh dengan `aria-label` sendiri,
          jadi angka dan statusnya tetap terbaca dua-duanya. */}
      <div className="dash-gap-sm relative">
        <span
          className={`absolute top-1/2 left-0 z-10 inline-flex -translate-y-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-[1.3] font-bold ${nadaTingkat}`}
        >
          {/* Cincin centang kecil: memberi tahu "terverifikasi/bersih" tanpa
              menambah kalimat. Murni dekoratif — teksnya sudah menyatakan
              tingkatnya. */}
          {tingkat === "sangat-baik" ? (
            <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
              <path
                d="M2 5.3 4 7.2 8 2.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
          {labelTingkatSkor(skor)}
        </span>
        <div
          role="progressbar"
          aria-label={`Skor kejujuran ${skor} dari ${SKOR_AWAL}`}
          aria-valuenow={skor}
          aria-valuemin={0}
          aria-valuemax={SKOR_AWAL}
          className="h-2 overflow-hidden rounded-full bg-[#dce9f8]"
        >
          <div
            className="h-full rounded-full bg-[#007aff]"
            style={{ width: `${skor}%` }}
          />
        </div>
      </div>

      {bersih ? (
        <p className="dash-gap-sm text-[12.5px] leading-[1.5] text-gray-600">
          Tidak ada catatan integritas aktif. Skor penuh bukan jaminan, tetapi
          catatan yang ada memang tidak memotong apa pun.
        </p>
      ) : (
        <>
          <p className="dash-gap-sm text-[12.5px] leading-[1.5] text-gray-600">
            {perCourse.length} course memotong {penaltiTotal} poin dari skor.
          </p>
          <ul className="dash-gap-xs space-y-1" aria-labelledby="judul-skor">
            {perCourse.map((r) => (
              <li
                key={r.courseId}
                className="flex items-baseline justify-between gap-3 text-[12.5px]"
              >
                <span className="min-w-0 truncate text-gray-700">
                  {r.courseId}
                </span>
                <span className="shrink-0 tabular-nums text-gray-500">
                  −{r.penaltiDiterapkan}
                  {r.dipotong ? (
                    <span
                      className="ml-1 text-[11px] text-gray-400"
                      title={`Penalti mentah ${r.penaltiMentah}, dipotong pada batas per course`}
                    >
                      (dari {r.penaltiMentah})
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Panel penjelasan. Satu tingkat lebih biru dari kartunya (`dash-inset`),
          jadi ia terbaca sebagai catatan di dalam kartu — bukan kartu kedua. */}
      <p className="dash-inset dash-gap-sm flex items-start gap-2 text-[11.5px] leading-[1.5] text-gray-600">
        <Info className="mt-px size-3.5 shrink-0 text-[#007aff]" aria-hidden="true" />
        <span>
          Sinyal peramban dan kamera dicatat sebagai konteks, bukan sebagai
          penilaian. Skor hanya turun dari catatan yang ditulis verifikator atau
          admin, dan kembali sendiri setelah course diulang sampai tuntas.
        </span>
      </p>
    </section>
  );
}

/**
 * Angka skor besar.
 *
 * Dipisah ke komponen sendiri supaya `SkorAngka` adalah satu-satunya tempat
 * angka itu ditulis — dan `kartu.test.ts` bisa mengunci bahwa angka itu
 * diteruskan, bukan dihitung di dalam komponen.
 */
function SkorAngka({ nilai }: { nilai: number }) {
  return <b className="dash-figure">{nilai}</b>;
}
