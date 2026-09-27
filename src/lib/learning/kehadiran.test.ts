import { describe, expect, it } from "vitest";
import {
  durasiMenit,
  hitungStreak,
  kunciHari,
  ringkasKehadiran,
  ZONA_WAKTU_DEFAULT,
  type BarisKehadiran,
} from "@/lib/learning/kehadiran";

const ZONA = "Asia/Jakarta";

/**
 * 04:00Z = 11:00 WIB. Angka tengah hari sengaja dipilih agar tanggalnya tidak
 * bergeser saat dikonversi ke `Asia/Jakarta` — uji di GMT+7 tidak boleh gagal
 * hanya karena jamnya.
 */
function jam(hari: string): Date {
  return new Date(`${hari}T04:00:00.000Z`);
}

function hari(offsetHari: number): string {
  const dasar = jam("2026-09-27");
  dasar.setUTCDate(dasar.getUTCDate() + offsetHari);
  return dasar.toISOString().slice(0, 10);
}

function selesai(
  mulai: Date,
  menit: number,
  state: BarisKehadiran["state"] = "completed",
): BarisKehadiran {
  const kedaluwarsa = new Date(mulai.getTime() + 120 * 60_000);
  return {
    startedAt: mulai,
    // `akhiriRun` menulis `completed_at` untuk `completed` maupun `expired`, dan
    // tidak pernah mengosongkannya lagi. Untuk `expired` kolom itu berisi waktu
    // **penyapu** menutup run — yang selalu melewati jendela, bukan waktu peserta
    // berhenti belajar. Helper ini membuat baris expired sesuai kenyataan itu,
    // bukan baris dengan `completed_at` null yang tidak pernah ada di database.
    completedAt:
      state === "completed"
        ? new Date(mulai.getTime() + menit * 60_000)
        : state === "expired"
          ? new Date(kedaluwarsa.getTime() + 60 * 60_000)
          : null,
    expiresAt: kedaluwarsa,
    state,
  };
}

const NOW = jam("2026-09-27");

describe("kunciHari", () => {
  it("mengkeysolusi tanggal menurut zona waktu, bukan UTC", () => {
    // 2026-09-26T20:00Z adalah 2026-09-27 03:00 WIB — hari berikutnya di lokal.
    expect(kunciHari(new Date("2026-09-26T20:00:00.000Z"), ZONA)).toBe("2026-09-27");
    // 2026-09-27T15:00Z adalah 2026-09-27 22:00 WIB — masih hari yang sama.
    expect(kunciHari(new Date("2026-09-27T15:00:00.000Z"), ZONA)).toBe("2026-09-27");
  });

  it("tanggal tidak bisa dibaca menjadi string kosong, bukan hari ini", () => {
    // Kegagalan baca harus menutup, bukan membuka: kunci yang diam-diam menjadi
    // "hari ini" akan menghitung sesi tidak valid sebagai kehadiran.
    expect(kunciHari(new Date(Number.NaN), ZONA)).toBe("");
  });

  it("ZONA_WAKTU_DEFAULT terkunci dan jadi nilai bawaan semua fungsi", () => {
    // Konstanta ini menentukan SETIAP angka produksi: streak, `hariAktif`, dan
    // jam yang diskor. Mengubahnya ke "UTC" tidak akan membuat satu pun test lain
    // gagal kalau semua test memakai literal sendiri — makanya ia dipin di sini.
    expect(ZONA_WAKTU_DEFAULT).toBe("Asia/Jakarta");

    // 20:00Z = 03:00 WIB tanggal 27, dan di UTC masih tanggal 26 — inilah
    // momen yang membedakan WIB dari UTC, jadi assertions di bawah gagal kalau
    // konstantanya diganti. 15:00Z = 22:00 WIB tanggal 27 tetap tanggal 27 di
    // kedua zona: sesi larut malam tidak melompati hari di sisi lokal.
    const sebelumTengahMalam = new Date("2026-09-26T20:00:00.000Z");
    const setelahTengahMalam = new Date("2026-09-27T15:00:00.000Z");
    expect(kunciHari(sebelumTengahMalam)).toBe("2026-09-27");
    expect(kunciHari(setelahTengahMalam)).toBe("2026-09-27");

    // Jalur parameter bawaan `hitungStreak` juga ikut diuji di sini: tanpa
    // argumen zona hasilnya harus sama dengan zona yang disebut eksplisit.
    expect(hitungStreak(new Set(["2026-09-27"]), NOW)).toBe(
      hitungStreak(new Set(["2026-09-27"]), NOW, ZONA_WAKTU_DEFAULT),
    );
    expect(hitungStreak(new Set(["2026-09-27"]), NOW)).toBe(1);
  });
});

describe("durasiMenit", () => {
  it("run completed memakai completed_at dikurangi started_at", () => {
    expect(durasiMenit(selesai(jam("2026-09-27"), 90), NOW)).toBe(90);
  });

  it("run completed dijepit expires_at ketika completed_at melewati jendela", () => {
    // `akhiriRun` tidak punya prasyarat `expires_at` — hanya `state = 'active'` —
    // jadi peserta yang membiarkan run basi lalu menutupnya menulis
    // `completed_at > expires_at`. Jam di luar jendela bukan jam belajar, dan
    // `jamEfektif` masuk ke `hitungSkorJadwal` sebagai 30 dari 100 poin.
    const mulai = jam("2026-09-27");
    const run: BarisKehadiran = {
      startedAt: mulai,
      completedAt: new Date(mulai.getTime() + 600 * 60_000), // 10 jam setelah mulai
      expiresAt: new Date(mulai.getTime() + 120 * 60_000), // jendela hanya 2 jam
      state: "completed",
    };
    expect(durasiMenit(run, NOW)).toBe(120);
  });

  it("run expired memakai expires_at, mengabaikan completed_at setelah kedaluwarsa", () => {
    // Baris `expired` di produksi tetap punya `completed_at`: waktu penyapu
    // menutupnya, yang selalu SETELAH `expires_at`. Cabang ini ada justru untuk
    // mengabaikannya — kalau tidak, durasi ikut tumbuh bersama waktu penyapu dan
    // bisa melebihi jendela.
    const run = selesai(jam("2026-09-27"), 0, "expired");
    expect(run.completedAt!.getTime()).toBeGreaterThan(run.expiresAt.getTime());
    expect(durasiMenit(run, NOW)).toBe(120);
  });

  it("run active dibatasi expires_at, tidak bisa melebihi jendela", () => {
    const mulai = jam("2026-09-27");
    const run: BarisKehadiran = {
      startedAt: mulai,
      completedAt: null,
      expiresAt: new Date(mulai.getTime() + 30 * 60_000),
      state: "active",
    };
    // `now` jauh lewat `expiresAt`; durasi tidak boleh ikut grew.
    expect(durasiMenit(run, new Date(mulai.getTime() + 999 * 60_000))).toBe(30);
  });

  it("tutup sebelum mulai menghasilkan 0, bukan negatif", () => {
    const run: BarisKehadiran = {
      startedAt: jam("2026-09-27"),
      completedAt: new Date(jam("2026-09-27").getTime() - 60_000),
      expiresAt: jam("2026-09-27"),
      state: "completed",
    };
    expect(durasiMenit(run, NOW)).toBe(0);
  });

  it("startedAt tidak bisa dibaca menghasilkan 0", () => {
    const run: BarisKehadiran = {
      startedAt: new Date(Number.NaN),
      completedAt: new Date("2026-09-27T05:00:00.000Z"),
      expiresAt: jam("2026-09-27"),
      state: "completed",
    };
    expect(durasiMenit(run, NOW)).toBe(0);
  });
});

describe("hitungStreak", () => {
  it("tanpa hari aktif bernilai 0", () => {
    expect(hitungStreak(new Set(), NOW, ZONA)).toBe(0);
  });

  it("sesi hari ini bernilai 1", () => {
    expect(hitungStreak(new Set(["2026-09-27"]), NOW, ZONA)).toBe(1);
  });

  it("tiga hari berturut-turut bernilai 3", () => {
    expect(
      hitungStreak(new Set(["2026-09-25", "2026-09-26", "2026-09-27"]), NOW, ZONA),
    ).toBe(3);
  });

  it("lubang satu hari memutus streak", () => {
    // 25 dan 27 ada, 26 tidak — streak-nya 1, bukan 2.
    expect(hitungStreak(new Set(["2026-09-25", "2026-09-27"]), NOW, ZONA)).toBe(1);
  });

  it("hari yang belum terjadi hari ini tidak langsung memutus streak", () => {
    // TOLERANSI: hari ini pukul 11:00 WIB dan peserta belum belajar. Streak
    // harus tetap bertahan sampai hari ini berakhir, kalau tidak setiap pagi
    // angkanya akan putus dan naik lagi di sore hari.
    expect(hitungStreak(new Set(["2026-09-26", "2026-09-25"]), NOW, ZONA)).toBe(2);
  });

  it("selesai di hari sebelum kemarin sudah terputus", () => {
    expect(hitungStreak(new Set(["2026-09-25"]), NOW, ZONA)).toBe(0);
  });

  it("melewati batas bulan tetap dihitung berurutan", () => {
    // 30 September dan 1 Oktober adalah dua hari berturut-turut. Hitungan
    // berbasis difference hari dari kunci "YYYY-MM-DD" tetap benar di sini,
    // sedangkan iterasi kalender dengan melompati bulan akan salah.
    // `hari(4)` = "2026-10-01", jadi ini persis batas bulan, bukan akhir bulan.
    const akhirOkt = jam(hari(4));
    expect(
      hitungStreak(new Set(["2026-09-29", "2026-09-30", "2026-10-01"]), akhirOkt, ZONA),
    ).toBe(3);
  });

  it("melewati batas tahun tetap dihitung berurutan", () => {
    // 31 Desember dan 1 Januari adalah dua hari berturut-turut, dan kode ini
    // membedakan kunci hari sebagai bilangan absolut — bukan dengan mengiterasi
    // kalender — jadi pergantian tahun tidak menambah cabang kode baru: yang
    // diuji di sini persis jalur yang sama dengan batas bulan di atas.
    //
    // Kuncinya dipin eksplisit: tanpa baris ini, test ini akan tetap hijau untuk
    // tiga hari berturut-turut yang sama sekali tidak melewati tahun baru.
    expect(hari(94)).toBe("2026-12-30");
    expect(hari(95)).toBe("2026-12-31");
    expect(hari(96)).toBe("2027-01-01");
    expect(hitungStreak(new Set([hari(94), hari(95), hari(96)]), jam(hari(96)), ZONA)).toBe(3);
  });
});

describe("ringkasKehadiran", () => {
  it("tanpa run menghasilkan nol di semua field", () => {
    expect(ringkasKehadiran([], { now: NOW, zonaWaktu: ZONA })).toEqual({
      sesiHadir: 0,
      jamEfektif: 0,
      streakHari: 0,
      hariAktif: [],
    });
  });

  it("hanya run completed yang dihitung sebagai kehadiran", () => {
    const ringkasan = ringkasKehadiran(
      [
        selesai(jam("2026-09-27"), 90),
        selesai(jam("2026-09-27"), 60, "expired"),
        { ...selesai(jam("2026-09-27"), 30), state: "active" },
      ],
      // `now` 30 menit setelah ketiganya mulai: run `active` diukur
      // `min(now, expires_at)`, jadi ia baru menyumbang 30 menit kalau sudah
      // berjalan 30 menit. Dengan `now` persis di `startedAt`, elapsed-nya nol
      // dan totalnya 3,5 jam — bukan 4 seperti yang dihitung di bawah.
      { now: new Date(NOW.getTime() + 30 * 60_000), zonaWaktu: ZONA },
    );
    // Satu sesi hadir, tetapi ketiganya berjam-jam: 90 + 120 (expired) + 30 (active).
    expect(ringkasan.sesiHadir).toBe(1);
    expect(ringkasan.jamEfektif).toBe(4);
    expect(ringkasan.hariAktif).toEqual(["2026-09-27"]);
    expect(ringkasan.streakHari).toBe(1);
  });

  it("hariAktif unik dan terurut menaik", () => {
    const ringkasan = ringkasKehadiran(
      [
        selesai(jam("2026-09-27"), 30),
        selesai(jam("2026-09-27"), 30),
        selesai(jam("2026-09-26"), 30),
      ],
      { now: NOW, zonaWaktu: ZONA },
    );
    expect(ringkasan.sesiHadir).toBe(3);
    expect(ringkasan.hariAktif).toEqual(["2026-09-26", "2026-09-27"]);
  });

  it("jamEfektif dibulatkan dua desimal", () => {
    // 100 menit = 1,6666… jam. Skor membandingkan rasio, jadi pembulatan di sini
    // membuat angka yang ditampilkan dan angka yang diskor identik.
    const ringkasan = ringkasKehadiran([selesai(jam("2026-09-27"), 100)], {
      now: NOW,
      zonaWaktu: ZONA,
    });
    expect(ringkasan.jamEfektif).toBe(1.67);
  });

  it("run dengan startedAt rusak tidak menggagalkan seluruh ringkasan", () => {
    const rusakAktif: BarisKehadiran = {
      startedAt: new Date(Number.NaN),
      completedAt: null,
      expiresAt: new Date(Number.NaN),
      state: "active",
    };
    // Baris `completed` dengan `started_at` rusak: ia tetap **dihitung sebagai
    // sesi hadir** — run-nya memang selesai — tetapi tidak menyumbang kunci hari
    // dan tidak menyumbang menit. Tanggal yang tidak terbaca membatalkan
    // kalender, bukan kehadiran; dan `durasiMenit` sudah mengembalikan 0 menit
    // untuknya, jadi `jamEfektif` tidak ikut rusak.
    const rusakSelesai: BarisKehadiran = {
      startedAt: new Date(Number.NaN),
      completedAt: new Date("2026-09-27T05:00:00.000Z"),
      expiresAt: new Date("2026-09-27T06:00:00.000Z"),
      state: "completed",
    };
    const ringkasan = ringkasKehadiran(
      [rusakAktif, rusakSelesai, selesai(jam("2026-09-27"), 60)],
      { now: NOW, zonaWaktu: ZONA },
    );
    // Dua sesi hadir: `rusakSelesai` dan yang sehat. Baris `active` tidak pernah
    // sampai ke penghitungan kehadiran.
    expect(ringkasan.sesiHadir).toBe(2);
    // Hanya run sehat yang menyumbang menit maupun kunci hari.
    expect(ringkasan.jamEfektif).toBe(1);
    expect(ringkasan.hariAktif).toEqual(["2026-09-27"]);
    expect(ringkasan.streakHari).toBe(1);
  });
});
