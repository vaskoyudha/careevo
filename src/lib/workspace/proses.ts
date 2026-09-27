import type { RingkasanBerkas } from "./snapshot";

/**
 * Jejak proses ruang kerja — **murni**, tanpa I/O.
 *
 * ## Apa yang sebenarnya diketahui dari jejak ini
 *
 * Ruang kerja adalah code-server di dalam kontainer pada **origin lain**, jadi
 * halaman ini tidak bisa melihat ketikan atau tempelan di dalamnya. Yang bisa
 * dilihat hanya **hasil**: berkas apa yang ada, sebesar apa, dan kapan ukurannya
 * berubah — karena itu dibaca dari luar lewat `find`.
 *
 * Jadi jejaknya adalah **fakta tentang berkas**, bukan kesimpulan tentang orang:
 *
 * - `ukuranAwal` = berapa byte berkas itu **saat pertama terlihat**. Berkas yang
 *   pertama terlihat sudah 400 baris bisa berarti ditempel, **atau** diketik
 *   sangat cepat. Keduanya mungkin, dan modul ini tidak memilih salah satu.
 * - `perubahan` = berapa kali ukurannya berubah antar observasi. Ini benar-benar
 *   terukur, dan inilah yang paling berguna: iterasi proses yang terlihat,
 *   dibanding berkas yang muncul sekali lalu tidak pernah berubah lagi.
 * - Jeda antar observasi dihitung `jedaSnapshot`. Jeda panjang setelah satu
 *   perubahan tunggal sering berarti seseorang berhenti menulis lalu membaca.
 *
 * ## Kenapa modul ini tidak punya ambang
 *
 * Versi pertama punya `AMBANG_MUNCUL_PENUH` dan menghitung "berkas mencurigakan".
 * Itu dihapus: angka tersebut memindahkan penilaian ke aritmetika, dan
 * `AGENTS.md` mengunci dua hal yang keduanya dilanggarnya — `learning_events`
 * tidak pernah menurunkan skor, dan hanya keputusan manusia yang bisa menurunkan.
 * Modul ini karena itu **tidak punya ambang** sama sekali; ia melaporkan angka
 * apa adanya dan membiarkan orang membacanya. Batas yang tetap berguna (jumlah
 * berkas, direktori yang diabaikan) tetap tinggal di `snapshot.ts`, karena itu
 * batas sumber daya, bukan penilaian.
 */

/** Satu snapshot: daftar berkas pada satu waktu. */
export interface SnapshotProses {
  /** ISO waktu pengambilan. */
  at: string;
  /** Hasil `ringkasBerkas` — bentuk yang sama dengan snapshot submission. */
  ringkasan: RingkasanBerkas;
}

/** Perjalanan satu berkas sepanjang observasi. */
export interface JejakBerkas {
  path: string;
  /** Waktu observasi pertama yang memuat berkas ini. */
  pertamaPada: string;
  /** Waktu observasi terakhir yang memuat berkas ini. */
  terakhirPada: string;
  /** Ukuran saat pertama terlihat. */
  ukuranAwal: number;
  /** Ukuran pada observasi terakhir yang memuatnya. */
  ukuranAkhir: number;
  /** Berapa kali ukuran berubah antar observasi berturut-turut. */
  perubahan: number;
  /** Berapa observasi berturut-turut berkas ini terlihat. */
  kemunculan: number;
  /**
   * Ada pada observasi sebelumnya, tidak ada pada observasi terakhir.
   *
   * `true` **tidak** berarti dihapus: `find` juga tidak memuatnya kalau
   * berkasnya diganti nama, dan snapshot berikutnya bisa saja tidak sengaja
   * terputus. Modul ini tidak menyimpulkan penghapusan — pemanggil yang memutuskan.
   */
  hilang: boolean;
}

/** Hasil `hitungJejak`. */
export interface RingkasanProses {
  /** Satu entri per berkas, urut dari perubahan terbanyak lalu path. */
  jejak: JejakBerkas[];
  /** Berapa snapshot yang digabung. */
  observasi: number;
  /** Berkas yang pernah terlihat lalu tidak ada di observasi terakhir. */
  hilang: number;
  /**
   * True kalau salah satu snapshot menyatakan `terpotong`.
   *
   * Ini penting: kalau ada yang terpotong, jumlah berkas sebenarnya lebih besar
   * dari yang tercatat, dan perubahan pada berkas yang tidak masuk tidak akan
   * pernah terlihat. Menyembunyikannya membuat jejak tampak lengkap padahal tidak.
   */
  adaTerpotong: boolean;
}

/** Waktu sebagai epoch ms; snapshot tanpa waktu yang terbaca diabaikan. */
function waktu(at: string): number {
  const ms = Date.parse(at);
  return Number.isFinite(ms) ? ms : Number.NaN;
}

/** Snapshot dengan waktu terbaca, urut waktu. */
function snapshotTerpakai(snapshots: readonly SnapshotProses[]): SnapshotProses[] {
  return snapshots
    .filter((s) => Number.isFinite(waktu(s.at)))
    .sort((a, b) => waktu(a.at) - waktu(b.at));
}

/**
 * Gabungkan beberapa snapshot menjadi satu jejak per berkas.
 *
 * Snapshot **diurutkan sendiri** oleh waktu. Pemanggilnya adalah kode server
 * yang bisa memanggil dalam urutan apa pun (restart, retry), dan jejak yang
 * tersusun salah urutan melaporkan "berkas berubah 7 kali" padahal isinya sama.
 *
 * Snapshot tanpa `at` yang terbaca **diabaikan**, bukan dipaksa jadi epoch 0:
 * yang dihitung adalah jarak waktunya, dan jarak dari "tidak diketahui" bukan
 * jarak.
 */
export function hitungJejak(snapshots: readonly SnapshotProses[]): RingkasanProses {
  const terurut = snapshotTerpakai(snapshots);

  if (terurut.length === 0) {
    return { jejak: [], observasi: 0, hilang: 0, adaTerpotong: false };
  }

  /**
   * Peta akumulasi per path. `Map` bukan objek biasa supaya path bernama
   * `__proto__` atau `constructor` tidak mengambil entri prototipe — pola yang
   * sama dengan `definisiPelanggaran` di `katalog.ts`.
   *
   * `ukuranTerakhir` menyimpan ukuran pada observasi sebelumnya supaya
   * `perubahan` bisa dihitung tanpa membaca ulang peta.
   */
  const peta = new Map<string, JejakBerkas & { ukuranTerakhir: number }>();

  /**
   * Paths yang terlihat pada snapshot terakhir.
   *
   * `hilang` dihitung dari sini **setelah** seluruh snapshot diproses, bukan di
   * dalam loop. Menyimpannya per-observasi salah: berkas yang tidak terlihat di
   * snapshot 10:05 tapi terlihat lagi di 10:10 akan tertandai hilang, dan berkas
   * yang hilang untuk selamanya tidak akan pernah ditandai karena `terakhirPada`-nya
   * bukan observasi terakhir.
   */
  let dilihatTerakhir: Set<string> = new Set();

  for (const snap of terurut) {
    const dilihat = new Set<string>();

    for (const b of snap.ringkasan.berkas) {
      dilihat.add(b.path);
      const ada = peta.get(b.path);

      if (!ada) {
        peta.set(b.path, {
          path: b.path,
          pertamaPada: snap.at,
          terakhirPada: snap.at,
          ukuranAwal: b.ukuran,
          ukuranAkhir: b.ukuran,
          ukuranTerakhir: b.ukuran,
          perubahan: 0,
          kemunculan: 1,
          hilang: false,
        });
        continue;
      }

      if (b.ukuran !== ada.ukuranTerakhir) {
        ada.perubahan += 1;
        ada.ukuranTerakhir = b.ukuran;
        ada.ukuranAkhir = b.ukuran;
      }
      ada.terakhirPada = snap.at;
      ada.kemunculan += 1;
    }

    dilihatTerakhir = dilihat;
  }

  // Hanya observasi terakhir yang boleh menandai `hilang`: pada observasi
  // tengah, "tidak ada" lebih sering berarti snapshot yang tidak lengkap
  // daripada berkas yang benar-benar dihapus.
  for (const jejak of peta.values()) {
    jejak.hilang = !dilihatTerakhir.has(jejak.path);
  }

  // Dibangun eksplisit, bukan dengan `{ ukuranTerakhir, ...sisa }`: pemecahan
  // begitulah membuat variabel terbuang yang tidak pernah terpakai, dan daftar
  // field di sini adalah bentuk yang dikembalikan ke pemanggil — jadi menulisnya
  // penuh membuat perubahan field terlihat.
  const jejak: JejakBerkas[] = [...peta.values()].map((x) => ({
    path: x.path,
    pertamaPada: x.pertamaPada,
    terakhirPada: x.terakhirPada,
    ukuranAwal: x.ukuranAwal,
    ukuranAkhir: x.ukuranAkhir,
    perubahan: x.perubahan,
    kemunculan: x.kemunculan,
    hilang: x.hilang,
  }));
  jejak.sort((a, b) => b.perubahan - a.perubahan || a.path.localeCompare(b.path));

  return {
    jejak,
    observasi: terurut.length,
    hilang: jejak.filter((j) => j.hilang).length,
    adaTerpotong: terurut.some((s) => s.ringkasan.terpotong),
  };
}

/**
 * Jarak antar snapshot dalam detik, **menurun**.
 *
 * Yang diukur adalah jarak antar observasi, bukan antar perubahan: `JejakBerkas`
 * menyimpan satu waktu per perubahan, sehingga jarak sebenarnya hanya bisa
 * dihitung dari deret snapshotnya.
 *
 * Selisih negatif dibuang: dua snapshot dengan waktu identik tidak punya jarak,
 * dan mengarang "berlama-lama" darinya bukan informasi.
 */
export function jedaSnapshot(snapshots: readonly SnapshotProses[]): number[] {
  const terurut = snapshotTerpakai(snapshots);
  const jeda: number[] = [];
  for (let i = 1; i < terurut.length; i += 1) {
    const selisih = (waktu(terurut[i]!.at) - waktu(terurut[i - 1]!.at)) / 1000;
    if (Number.isFinite(selisih) && selisih >= 0) jeda.push(selisih);
  }
  return jeda.sort((a, b) => b - a);
}