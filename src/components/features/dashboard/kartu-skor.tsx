import { ShieldCheck, TriangleAlert } from "lucide-react";
import { SKOR_AWAL, type RingkasanSkor } from "@/lib/integritas/skor";

/**
 * Kartu skor kejujuran di dashboard peserta.
 *
 * Angka, rincian, dan status semua diteruskan dari server
 * (`skorIntegritasDb`). Komponen ini **tidak** menghitung apa pun: `learning_runs`
 * dan `integrity_violations` tidak pernah ikut ke bundel browser, dan hitungan
 * kedua di klien akan bisa berbeda dari yang dibaca server tanpa ada yang
 * memperingatkan.
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
 *
 * Batas kata vonis: kata "curang", "menyalin", "mencontek", "penyalahgunaan",
 * dan "bersalah" tidak boleh muncul sebagai label yang dirender otomatis.
 */
export function KartuSkor({ ringkasan }: { ringkasan: RingkasanSkor }) {
  const { skor, penaltiTotal, perCourse } = ringkasan;
  const bersih = skor === SKOR_AWAL;

  return (
    <section
      aria-labelledby="judul-skor"
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
    >
      <div className="mb-4 flex items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2
            id="judul-skor"
            className="flex items-center gap-1.5 text-base font-bold text-gray-900"
          >
            <ShieldCheck className="size-4 text-[#0056D2]" aria-hidden="true" />
            Skor kejujuran
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Diturunkan dari catatan integritas yang ditinjau manusia.
          </p>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <SkorAngka nilai={skor} />
        <span className="text-sm text-gray-500">/ {SKOR_AWAL}</span>
      </div>

      <div
        role="progressbar"
        aria-label={`Skor kejujuran ${skor} dari ${SKOR_AWAL}`}
        aria-valuenow={skor}
        aria-valuemin={0}
        aria-valuemax={SKOR_AWAL}
        className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className="h-full rounded-full bg-[#0056D2]"
          style={{ width: `${skor}%` }}
        />
      </div>

      {bersih ? (
        <p className="mt-3 text-[13px] text-gray-600">
          Tidak ada catatan integritas aktif. Skor penuh bukan jaminan, tetapi
          catatan yang ada memang tidak memotong apa pun.
        </p>
      ) : (
        <>
          <p className="mt-3 text-[13px] text-gray-600">
            {perCourse.length} course memotong {penaltiTotal} poin dari skor.
          </p>
          <ul className="mt-2 space-y-1.5" aria-labelledby="judul-skor">
            {perCourse.map((r) => (
              <li
                key={r.courseId}
                className="flex items-baseline justify-between gap-3 text-[13px]"
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

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-500">
        <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
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
  return (
    <b className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
      {nilai}
    </b>
  );
}
