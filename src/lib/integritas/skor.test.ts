import { describe, expect, it } from "vitest";
import {
  SKOR_AWAL,
  hitungSkorIntegritas,
  labelTingkatSkor,
  skorPada,
  tingkatSkor,
  type BarisPelanggaran,
  type BarisPelanggaranBertanggal,
} from "./skor";

/** Baris pelanggaran aktif, bentuk yang repository hasilkan. */
function baris(
  courseId: string,
  penalty: number,
  kunci: string = `${courseId}-${penalty}`,
): BarisPelanggaran {
  return { id: kunci, courseId, penalty, status: "active" };
}

describe("hitungSkorIntegritas", () => {
  it("memberi skor penuh saat tidak ada pelanggaran", () => {
    const hasil = hitungSkorIntegritas([]);
    expect(hasil.skor).toBe(100);
    expect(hasil.penaltiTotal).toBe(0);
  });

  it("mengurangi skor sebesar bobot tiap pelanggaran aktif", () => {
    const hasil = hitungSkorIntegritas([baris("c1", 5, "a"), baris("c2", 10, "b")]);
    expect(hasil.penaltiTotal).toBe(15);
    expect(hasil.skor).toBe(85);
  });

  it("mengabaikan pelanggaran yang sudah dipulihkan", () => {
    // Inilah yang membuat "skor kembali sebelum dia curang" bekerja tanpa
    // menyimpan angka: begitu statusnya `expunged`, barisnya tidak lagi
    // dihitung. Kalau ini ikut dihitung, mengulang course dengan bersih tidak
    // akan mengembalikan apa pun dan aturan pemulihan jadi bohong.
    const hasil = hitungSkorIntegritas([
      { id: "a", courseId: "c1", penalty: 20, status: "expunged" },
      { id: "b", courseId: "c1", penalty: 5, status: "active" },
    ]);
    expect(hasil.penaltiTotal).toBe(5);
    expect(hasil.skor).toBe(95);
  });

  it("membatasi penalti satu course pada 20 poin", () => {
    // Tujuh pelanggaran ringan (7 × 5 = 35 mentah) di satu course tetap memotong
    // 20, tidak 35. Jumlah disengaja **melewati** batas: dengan empat-five saja
    // (4 × 5 = 20) test ini akan tetap hijau kalau batasnya dihapus, karena 20
    // sama dengan 20. Batas hanya bisa dibuktikan oleh yang melewatinya.
    const hasil = hitungSkorIntegritas([
      baris("c1", 5, "a"),
      baris("c1", 5, "b"),
      baris("c1", 5, "c"),
      baris("c1", 5, "d"),
      baris("c1", 5, "e"),
      baris("c1", 5, "f"),
      baris("c1", 5, "g"),
    ]);
    expect(hasil.perCourse[0]?.penaltiMentah).toBe(35);
    expect(hasil.perCourse[0]?.dipotong).toBe(true);
    expect(hasil.penaltiTotal).toBe(20);
    expect(hasil.skor).toBe(80);
    // Jumlah baris tetap dibaca apa adanya: batas memotong penalti, bukan
    // menyembunyikan bukti dari laporan.
    expect(hasil.jumlahAktif).toBe(7);
  });

  it("membatasi heavy violation tunggal di course pada 20 tanpa dipotong", () => {
    // Pelanggaran berat (20) persis sama dengan batas, jadi `dipotong` false.
    // Kalau ini ikut terpotong, batas akan maksimum satu pelanggaran berat pun
    // dan bobot "berat" tidak akan berarti apa-apa dibanding "sedang".
    const hasil = hitungSkorIntegritas([baris("c1", 20, "a")]);
    expect(hasil.perCourse[0]?.dipotong).toBe(false);
    expect(hasil.penaltiTotal).toBe(20);
  });

  it("membatasi penalti per course secara terpisah, bukan pada totalnya", () => {
    // Dua course, masing-masing 4 × 5. Batas per course membuat totalnya 40,
    // bukan 20: penjepitan harus terjadi per course, kalau tidak batas itu
    // sebenarnya hanya membatasi seluruh akun.
    const hasil = hitungSkorIntegritas([
      baris("c1", 5, "a"),
      baris("c1", 5, "b"),
      baris("c1", 5, "c"),
      baris("c1", 5, "d"),
      baris("c2", 5, "e"),
      baris("c2", 5, "f"),
      baris("c2", 5, "g"),
      baris("c2", 5, "h"),
    ]);
    expect(hasil.penaltiTotal).toBe(40);
    expect(hasil.skor).toBe(60);
  });

  it("tidak pernah menghasilkan skor negatif", () => {
    // Banyak course × pelanggaran berat. Skor dijepit di 0: angka negatif tidak
    // punya arti pada skala 0–100, dan menampilkannya di UI berarti data rusak
    // diperlakukan sebagai nilai.
    const hasil = hitungSkorIntegritas(
      Array.from({ length: 12 }, (_, i) => baris(`c${i}`, 20, `x${i}`)),
    );
    expect(hasil.penaltiTotal).toBe(240);
    expect(hasil.skor).toBe(0);
  });

  it("mengabaikan penalti yang tidak masuk akal, bukan menjadikannya negatif", () => {
    // Baris rusak harus "tidak menambah apa pun" (careevo-review §7): satu
    // penalti negatif yang lolos akan menaikkan skor di atas start, dan itu
    // lebih buruk daripada mengabaikannya.
    const hasil = hitungSkorIntegritas([baris("c1", -50, "a"), baris("c1", 5, "b")]);
    expect(hasil.penaltiTotal).toBe(5);
    expect(hasil.skor).toBe(95);
  });

  it("mengabaikan penalti nol dan non-finite", () => {
    const hasil = hitungSkorIntegritas([
      baris("c1", 0, "a"),
      baris("c1", Number.NaN, "b"),
      baris("c1", Number.POSITIVE_INFINITY, "c"),
    ]);
    expect(hasil.penaltiTotal).toBe(0);
    expect(hasil.skor).toBe(SKOR_AWAL);
  });

  it("mengabaikan baris tanpa course_id", () => {
    // `course_id` bisa tidak terbaca (baris lama, impor). Baris seperti itu
    // tidak punya tempat untuk dipulihkan, jadi menghitungnya berarti skor yang
    // tidak pernah bisa naik kembali — dan tidak bisa diaudit.
    const hasil = hitungSkorIntegritas([
      { id: "a", courseId: "", penalty: 20, status: "active" },
      baris("c1", 5, "b"),
    ]);
    expect(hasil.penaltiTotal).toBe(5);
  });

  it("menghasilkan rincian per course yang bisa ditampilkan di tabel report", () => {
    const hasil = hitungSkorIntegritas([
      baris("c1", 5, "a"),
      baris("c1", 5, "b"),
      baris("c2", 20, "c"),
    ]);
    const c1 = hasil.perCourse.find((r) => r.courseId === "c1");
    expect(c1?.jumlah).toBe(2);
    expect(c1?.penaltiMentah).toBe(10);
    expect(c1?.penaltiDiterapkan).toBe(10);
    const c2 = hasil.perCourse.find((r) => r.courseId === "c2");
    expect(c2?.penaltiDiterapkan).toBe(20);
    // Penalti yang terpakai harus sama dengan total, supaya UI yang menjumlahkan
    // kolom per course menghasilkan angka yang sama dengan `skor`.
    const jumlah = hasil.perCourse.reduce((n, r) => n + r.penaltiDiterapkan, 0);
    expect(jumlah).toBe(hasil.penaltiTotal);
  });

  it("mengurutkan rincian dari penalti terbesar", () => {
    const hasil = hitungSkorIntegritas([
      baris("kecil", 5, "a"),
      baris("besar", 20, "b"),
      baris("sedang", 10, "c"),
    ]);
    expect(hasil.perCourse.map((r) => r.courseId)).toEqual(["besar", "sedang", "kecil"]);
  });
});

describe("skorPada", () => {
  /** Baris bertanggal: `buat` = kapan dicatat, `pulih` = kapan dipulihkan. */
  function barisTgl(
    courseId: string,
    penalty: number,
    buat: string,
    pulih?: string,
  ): BarisPelanggaranBertanggal {
    return {
      id: `${courseId}-${buat}`,
      courseId,
      penalty,
      status: pulih ? "expunged" : "active",
      createdAt: new Date(buat),
      expungedAt: pulih ? new Date(pulih) : null,
    };
  }

  // `SEKARANG` sengaja lebih baru dari semua waktu di fixture, supaya "sekarang"
  // benar-benar memuat seluruh baris dan yang membedakan hanyalah titik
  // pembandingnya — bukan baris yang kebetulan berada di masa depan.
  const SEKARANG = new Date("2026-10-02T00:00:00.000Z");
  const SEHARI_LALU = new Date("2026-09-30T00:00:00.000Z");

  it("mengabaikan baris yang dicatat setelah titik pembanding", () => {
    // Pelanggaran hari ini tidak boleh muncul di skor minggu lalu — kalau ikut,
    // delta selalu 0 dan chip "+5" tidak akan pernah bisa muncul.
    const baris = [barisTgl("c1", 20, "2026-10-01T08:00:00.000Z")];
    expect(skorPada(baris, SEHARI_LALU).skor).toBe(100);
    expect(skorPada(baris, SEKARANG).skor).toBe(80);
  });

  it("masih menghitung baris yang dipulihkan setelah titik pembanding", () => {
    // Baris yang dicatat lama lalu dipulihkan **setelah** titik pembanding masih
    // memotong skor kemarin. Inilah isi cerita pemulihan: skornya naik, bukan
    // hilang dari sejarah.
    const baris = [
      barisTgl("c1", 20, "2026-09-20T00:00:00.000Z", "2026-10-01T06:00:00.000Z"),
    ];
    expect(skorPada(baris, SEHARI_LALU).skor).toBe(80);
    expect(skorPada(baris, SEKARANG).skor).toBe(100);
  });

  it("mengabaikan baris yang sudah dipulihkan sebelum titik pembanding", () => {
    const baris = [
      barisTgl("c1", 20, "2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z"),
    ];
    expect(skorPada(baris, SEHARI_LALU).skor).toBe(100);
  });

  it("menjepit per course dengan aturan yang sama, bukan hitungan kedua", () => {
    // Tujuh pelanggaran ringan di satu course: batas 20 tetap berlaku pada skor
    // masa lalu. Kalau fungsi ini punya penjepitannya sendiri, angka ini yang
    // pertama kali menyimpang dari kartu.
    const baris = Array.from({ length: 7 }, (_, i) =>
      barisTgl("c1", 5, `2026-09-1${i}T00:00:00.000Z`),
    );
    expect(skorPada(baris, SEHARI_LALU).skor).toBe(80);
  });

  it("mengembalikan skor penuh untuk tanggal yang tidak bisa dibaca", () => {
    // Titik pembanding yang rusak tidak boleh memotong apa pun: lebih baik tanpa
    // pembanding daripada pembanding yang mengarang penalti.
    const baris = [barisTgl("c1", 20, "2026-09-01T00:00:00.000Z")];
    expect(skorPada(baris, new Date(Number.NaN)).skor).toBe(100);
  });

  it("membuang baris yang waktu dibuatnya tidak bisa dibaca", () => {
    const rusak: BarisPelanggaranBertanggal = {
      id: "x",
      courseId: "c1",
      penalty: 20,
      status: "active",
      createdAt: new Date(Number.NaN),
      expungedAt: null,
    };
    expect(skorPada([rusak], SEKARANG).skor).toBe(100);
  });
});

describe("tingkatSkor", () => {
  it("menyatakan skor penuh sebagai tingkat tertinggi", () => {
    expect(tingkatSkor(SKOR_AWAL)).toBe("sangat-baik");
    expect(labelTingkatSkor(SKOR_AWAL)).toBe("Sangat Baik");
  });

  it("tidak menjatuhkan akun dengan potongan kecil dari tingkat tertinggi", () => {
    // Skor 90 masih "Sangat Baik": satu pelanggaran sedang (10) tidak boleh
    // mengubah label itu — labelnya menyatakan kondisi catatan secara umum, bukan
    // angka persis.
    expect(tingkatSkor(90)).toBe("sangat-baik");
  });

  it("memisahkan tingkat pada batasnya", () => {
    expect(tingkatSkor(89)).toBe("baik");
    expect(tingkatSkor(70)).toBe("baik");
    expect(tingkatSkor(69)).toBe("perhatian");
    expect(tingkatSkor(0)).toBe("perhatian");
  });

  it("tidak pernah memakai kata yang menyatakan bersalah", () => {
    // Batas yang sama dengan `katalog.test.ts`, tapi untuk label yang baru: kata
    // vonis tidak boleh masuk lewat pintu ini.
    for (const skor of [100, 90, 75, 40, 0]) {
      const teks = labelTingkatSkor(skor).toLowerCase();
      for (const kata of ["curang", "menyalin", "mencontek", "penyalahgunaan", "bersalah"]) {
        expect(teks).not.toContain(kata);
      }
    }
  });
});
