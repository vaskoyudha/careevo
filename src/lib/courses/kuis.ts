import type { Course, Kuis, Modul, SoalKuis } from "@/types/course";

/**
 * Operasi murni atas kuis.
 *
 * Sama seperti `blok.ts` dan `halaman.ts`: **tidak boleh** menyentuh store atau
 * `node:fs`. Berkas ini ikut masuk bundel klien lewat renderer kuis, dan satu
 * impor ke `store.ts` saja akan menyeret `node:fs/promises` ke sisi klien —
 * build produksi Turbopack gagal dengan "chunking context does not support
 * external modules". `npm run build` adalah gerbang yang menangkapnya,
 * `npm run check` tidak.
 */

/**
 * Kuis milik sebuah modul, terurut sesuai `Modul.kuis`.
 *
 * Id yang tidak ada di bank **diabaikan**, bukan dikembalikan sebagai entri
 * kosong. Referensi yatim bisa muncul dari berkas yang disunting tangan atau
 * dari penghapusan yang terlewat; menampilkannya sebagai kuis hampa akan
 * membuat UI menjanjikan asesmen yang tidak bisa dikerjakan. `deleteKuis()`
 * membersihkan referensi seperti itu, dan fungsi ini adalah jaring keduanya.
 */
export function kuisUntukModul(modul: Pick<Modul, "kuis">, bank: Kuis[]): Kuis[] {
  const ids = modul.kuis ?? [];
  if (ids.length === 0 || bank.length === 0) return [];

  const peta = new Map(bank.map((k) => [k.id, k]));
  const hasil: Kuis[] = [];
  for (const id of ids) {
    const ketemu = peta.get(id);
    if (ketemu) hasil.push(ketemu);
  }
  return hasil;
}

/** Apakah id ini sudah dipasang di modul? Dipakai UI untuk menandai pilihan. */
export function terpasang(modul: Pick<Modul, "kuis">, kuisId: string): boolean {
  return (modul.kuis ?? []).includes(kuisId);
}

/** Jumlah soal di seluruh kuis sebuah modul — untuk ringkasan di daftar modul. */
export function jumlahSoalModul(modul: Pick<Modul, "kuis">, bank: Kuis[]): number {
  return kuisUntukModul(modul, bank).reduce((total, k) => total + k.soal.length, 0);
}

/**
 * Ringkasan satu kuis untuk daftar: jumlah soal dan ambang lulus.
 *
 * Bentuknya dipusatkan di sini supaya panel admin, pratinjau, dan halaman
 * belajar menyebut angka yang sama.
 */
export function ringkasKuis(kuis: Pick<Kuis, "soal" | "nilai_lulus">): string {
  const soal = kuis.soal.length;
  return `${soal} soal · lulus ${kuis.nilai_lulus}`;
}

/**
 * Bentuk materi `kuis` dari versi lama.
 *
 * Didefinisikan sendiri, bukan sebagai `Materi & { tipe: "kuis" }`: `Materi`
 * sudah tidak memuat varian `kuis`, sehingga irisan semacam itu bertipe `never`
 * dan setiap akses propertinya jadi error tipe. Data dari disk tetap bisa
 * memuatnya, jadi bentuknya dinyatakan terpisah dari union yang berlaku kini.
 */
interface MateriKuisLama {
  id: string;
  judul?: string;
  soal?: unknown[];
  nilai_lulus?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Apakah entri ini materi `kuis` dari versi lama?
 *
 * Diperiksa lewat bentuk runtime, bukan `tipe === "kuis"` saja: nilainya datang
 * dari berkas, dan berkas belum tentu setuju dengan tipe di compile time.
 */
function isMateriKuisLama(materi: unknown): materi is MateriKuisLama {
  if (typeof materi !== "object" || materi === null) return false;
  const kandidat = materi as Record<string, unknown>;
  return (
    kandidat.tipe === "kuis" &&
    typeof kandidat.id === "string" &&
    Array.isArray(kandidat.soal)
  );
}

/**
 * Rapikan soal dari berkas lama agar lolos skema yang berlaku.
 *
 * Berkas bisa memuat soal tanpa `id`, pilihan kurang dari dua, atau kunci
 * jawaban di luar rentang. Entri seperti itu **dibuang**, bukan dipaksakan
 * menjadi soal kosong: soal yang tidak punya jawaban benar tidak bisa dinilai,
 * dan menampilkannya berarti memberi peserta pertanyaan yang mustahil dijawab.
 * Bila seluruh soal gugur, kuisnya tidak dipromosikan sama sekali.
 */
function rapikanSoal(soal: unknown[], idKuis: string): SoalKuis[] {
  const hasil: SoalKuis[] = [];

  soal.forEach((mentah, index) => {
    if (typeof mentah !== "object" || mentah === null) return;
    const s = mentah as Record<string, unknown>;

    const pertanyaan = typeof s.pertanyaan === "string" ? s.pertanyaan.trim() : "";
    if (pertanyaan.length < 3) return;

    const pilihan = Array.isArray(s.pilihan)
      ? s.pilihan
          .filter((p): p is string => typeof p === "string")
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      : [];
    if (pilihan.length < 2) return;

    const kunci = Number(s.jawaban_benar);
    if (!Number.isInteger(kunci) || kunci < 0 || kunci >= pilihan.length) return;

    hasil.push({
      // Id soal dipertahankan bila ada: nilainya dipakai React sebagai key dan
      // oleh riwayat jawaban peserta. Bila tidak ada, diturunkan dari id kuis
      // dan posisinya supaya migrasi yang terpanggil ulang tetap menghasilkan
      // id yang sama.
      id: typeof s.id === "string" && s.id.trim() ? s.id.trim() : `${idKuis}-s${index + 1}`,
      pertanyaan,
      pilihan,
      jawaban_benar: kunci,
    });
  });

  return hasil;
}

export interface HasilMigrasiKuis {
  course: Course;
  /** Bank soal setelah promosi. Isinya identik dengan masukan bila tidak ada yang berubah. */
  bank: Kuis[];
}

/**
 * Promosikan materi bertipe `kuis` yang sudah tersimpan menjadi kuis di bank.
 *
 * `TipeMateri` kini hanya `video | pdf`, tapi berkas `courses.json` di mesin
 * pengembang bisa masih memuat materi `kuis` dari versi sebelumnya. Alih-alih
 * membiarkannya sebagai entri yang tidak bisa dirender siapa pun, tiap materi
 * `kuis` dipromosikan menjadi satu entri bank, dan modulnya diberi referensi.
 *
 * Empat sifat yang disengaja:
 *
 * - **Deterministik dan idempoten.** Id kuis diturunkan dari id materi
 *   (`kuis-<id materi>`), bukan dari waktu. Menjalankannya dua kali
 *   menghasilkan id yang sama, jadi migrasi yang terpanggil berulang tidak
 *   menggandakan kuis.
 * - **Tidak menyentuh bank yang sudah punya id itu.** Bila kuis dengan id
 *   turunan tersebut sudah ada, entri itu dipakai apa adanya dan isinya tidak
 *   ditimpa — admin yang sudah menyunting hasil migrasi tidak boleh kehilangan
 *   perubahannya.
 * - **Tidak mengubah apa pun bila tidak perlu.** Kursus tanpa materi `kuis`
 *   dikembalikan dengan referensi yang sama, sehingga tidak memicu penulisan
 *   disk tanpa perubahan nyata.
 * - **Referensi ditambahkan di akhir.** Kuis hasil migrasi masuk setelah kuis
 *   yang mungkin sudah dipasang admin, agar tidak menggeser urutan yang ada.
 *
 * Materi `kuis` dibuang dari `materi[]` setelah dipromosikan supaya tidak ada
 * dua sumber untuk asesmen yang sama — sama seperti penanganan materi `teks`.
 */
export function promosiKuisLama(course: Course, bank: Kuis[]): HasilMigrasiKuis {
  if (!course.modul?.length) return { course, bank };

  const now = new Date().toISOString();
  const idBank = new Set(bank.map((k) => k.id));
  const kuisBaru: Kuis[] = [];
  let berubah = false;

  const modul: Modul[] = course.modul.map((m) => {
    // `materi` di-`as unknown[]` hanya untuk keperluan filter: `Materi` sudah
    // tidak memuat varian `kuis`, jadi guard atas `Materi[]` akan menyempitkan
    // elemennya ke `Materi & MateriKuisLama` — tipe yang tidak punya `soal`.
    // Melebarkan ke `unknown[]` di sini membuat guard bekerja apa adanya.
    const materi = m.materi ?? [];
    const lama = (materi as unknown[]).filter(isMateriKuisLama);
    if (lama.length === 0) return m;

    const idTerpasang = [...(m.kuis ?? [])];
    // Hanya materi yang benar-benar berpindah yang boleh dibuang dari `materi[]`.
    // Materi yang soalnya rusak tetap ditinggal di sana supaya tidak hilang
    // tanpa jejak — admin masih bisa melihatnya di lampiran dan memperbaikinya.
    const idBerpindah = new Set<string>();

    for (const item of lama) {
      const idKuis = `kuis-${item.id}`;
      const soal = rapikanSoal(item.soal ?? [], idKuis);

      // Kuis tanpa satu pun soal yang bisa dinilai tidak dipromosikan: referensi
      // ke kuis kosong hanya akan menampilkan asesmen yang tidak bisa dikerjakan.
      if (soal.length === 0) continue;

      idBerpindah.add(item.id);

      if (!idBank.has(idKuis)) {
        idBank.add(idKuis);
        kuisBaru.push({
          id: idKuis,
          judul: item.judul?.trim() || "Kuis",
          deskripsi: "",
          soal,
          nilai_lulus: normalisasiNilaiLulus(item.nilai_lulus),
          created_at: item.created_at ?? now,
          updated_at: item.updated_at ?? now,
        });
      }

      if (!idTerpasang.includes(idKuis)) idTerpasang.push(idKuis);
    }

    const materiTersisa = (materi as unknown[]).filter(
      (item) => !(isMateriKuisLama(item) && idBerpindah.has(item.id)),
    );

    // Tidak ada yang berpindah (semua soal gugur) — biarkan modul apa adanya
    // supaya materi `kuis` yang rusak tidak hilang tanpa jejak.
    if (idTerpasang.length === (m.kuis ?? []).length && materiTersisa.length === materi.length) {
      return m;
    }

    berubah = true;
    return { ...m, kuis: idTerpasang, materi: materiTersisa as Modul["materi"] };
  });

  if (!berubah) return { course, bank };

  return {
    course: { ...course, modul, updated_at: now },
    bank: kuisBaru.length > 0 ? [...bank, ...kuisBaru] : bank,
  };
}

/** Jepit nilai lulus ke 0–100; nilai non-angka jatuh ke bawaan 70. */
function normalisasiNilaiLulus(nilai: unknown): number {
  const angka = Number(nilai);
  if (!Number.isFinite(angka)) return 70;
  return Math.min(100, Math.max(0, Math.round(angka)));
}
