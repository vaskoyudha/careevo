import { describe, it, expect } from "vitest";
import { hasilGagal, petakanStatus, type StatusJalankan } from "./port";

const SEMUA: StatusJalankan[] = [
  "sukses",
  "gagal_kompilasi",
  "batas_dilampaui",
  "galat_program",
  "ditolak",
  "galat_runner",
];

describe("petakanStatus", () => {
  it("memetakan setiap status ke judul yang tidak kosong", () => {
    for (const status of SEMUA) {
      expect(petakanStatus(status).judul.length).toBeGreaterThan(0);
    }
  });

  it("tidak pernah menampilkan angka exit mentah ke peserta", () => {
    // P4 spec. Angka 124, 137, 139, dan 255 adalah detail internal podman. Kalau
    // angka ini bocor ke peserta, peserta membaca angka yang tidak menjelaskan
    // apa pun. Angka batas layanan (10, 512, 64) bukan exit code dan memang
    // harus terlihat, jadi larangan ini daftar dan bukan "tidak boleh ada angka".
    for (const status of SEMUA) {
      const petakan = petakanStatus(status);
      expect(petakan.judul).not.toMatch(/\b(124|137|139|255)\b/);
      expect(petakan.detail ?? "").not.toMatch(/\b(124|137|139|255)\b/);
    }
  });

  it("menyatakan batas pelayanan tanpa menyalahkan peserta", () => {
    // Batas 10 detik, 512 MB, dan 64 proses adalah limit layanan, bukan
    // kesalahan orang. `galat_program` memang bug peserta sendiri, tapi
    // judurnya tetap menyatakan peristiwa, bukan menyudutkan. Detail ikut
    // diuji: sebelumnya hanya judul yang diperiksa, jadi detailnya bebas
    // menuduh.
    const terlarang = /kamu|kamu salah|tidak mampu|gagal mengerjakan/;
    for (const status of ["batas_dilampaui", "galat_program"] as const) {
      const petakan = petakanStatus(status);
      expect(petakan.judul.toLowerCase()).not.toMatch(terlarang);
      expect((petakan.detail ?? "").toLowerCase()).not.toMatch(terlarang);
    }
  });

  it("tidak menyebut batas mana yang terlampaui", () => {
    // Tiga batas itu tidak bisa dibedakan dari luar kontainer, jadi judul tidak
    // boleh menebak salah satunya. Ketiga judul lama ("berjalan terlalu lama",
    // "memakai terlalu banyak memori", dan "membuat terlalu banyak proses")
    // adalah tiga judul yang dilarang di sini.
    //
    // Yang diperiksa hanya `judul`. `detail` justru boleh menyebut ketiga
    // batas, karena tugasnya memberi tahu amplopnya.
    const batasTertentu = /waktu|memori|proses|heap|terlalu lama|kedaluwarsa/;
    const judul = petakanStatus("batas_dilampaui").judul.toLowerCase();
    expect(judul).not.toMatch(batasTertentu);
  });

  it("menyatakan seluruh angka batasnya sendiri", () => {
    // Karena judul tidak menunjuk satu batas, `detail` wajib memuat ketiganya.
    // Kalau satu angka hilang, amplop yang peserta lihat jadi tidak lengkap.
    const detail = petakanStatus("batas_dilampaui").detail ?? "";
    expect(detail).toContain("10 detik");
    expect(detail).toContain("512 MB");
    expect(detail).toContain("64 proses");
  });

  it("galat_program tidak mengarang diagnosis", () => {
    // Status ini mencakup semua crash, jadi menyebut penyebab tertentu
    // berarti menebak. "SIGSEGV" memang 139, tapi "galat_program" tidak
    // menjamin itu yang terjadi.
    const diagnosa =
      /segmentation|access violation|signal|sigsegv|null pointer|stack overflow/;
    const petakan = petakanStatus("galat_program");
    expect(petakan.judul.toLowerCase()).not.toMatch(diagnosa);
    expect((petakan.detail ?? "").toLowerCase()).not.toMatch(diagnosa);
  });

  it("galat_program menyatakan bahwa ini bukan batas layanan", () => {
    // Tanpa ini, peserta akan membaca crash sebagai "kena batas" lalu
    // mencoba mengecilkan programnya, bukan memperbaiki bug-nya.
    expect(petakanStatus("galat_program").detail).toMatch(/batas layanan/i);
  });

  it("hanya sukses yang bernada sukses", () => {
    expect(petakanStatus("sukses").nada).toBe("sukses");
    for (const status of SEMUA.filter((s) => s !== "sukses")) {
      expect(petakanStatus(status).nada).not.toBe("sukses");
    }
  });

  it("gagal_kompilasi tidak meringkas pesan compiler", () => {
    // Yang ditampilkan adalah stderr GCC apa adanya. Ringkasan akan jadi
    // penurunan kualitas, jadi pemeta tidak boleh menimpanya dengan detail.
    const petakan = petakanStatus("gagal_kompilasi");
    expect(petakan.detail).toBeUndefined();
    expect(petakan.nada).toBe("galat");
  });
});

describe("hasilGagal", () => {
  it("mengisi stdout kosong dan durasi nol", () => {
    const hasil = hasilGagal("batas_dilampaui");
    expect(hasil.stdout).toBe("");
    expect(hasil.durasiMs).toBe(0);
    expect(hasil.status).toBe("batas_dilampaui");
  });

  it("menyimpan stderr bila diberikan", () => {
    expect(hasilGagal("gagal_kompilasi", "error: expected ';'").stderr).toBe(
      "error: expected ';'",
    );
  });

  it("tidak mengarang exitCode untuk status semantik", () => {
    // Status semantik sudah membawa artinya. Mengisi exitCode di sini hanya
    // menciptakan jalan bagi UI untuk menampilkannya.
    expect(hasilGagal("galat_program").exitCode).toBeNull();
  });
});
