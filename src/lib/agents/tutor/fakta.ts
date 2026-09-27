/**
 * Fakta deterministik dari transkrip tutor — **murni**, tanpa I/O.
 *
 * Modul ini menghitung hal yang **tidak** perlu model: berapa sesi, berapa
 * pesan, topik apa yang ditanyakan, topik mana yang muncul berulang. Angka ini
 * berdiri sendiri apakah model menjawab atau tidak — jadi ketika model mati,
 * panel tetap menampilkan sesuatu yang benar, bukan kosong.
 *
 * **Tidak ada skor di sini.** Angka-angka ini fakta interaksi, bukan penilaian
 * kemampuan. `AGENTS.md` mengunci bahwa yang menurunkan skor hanya keputusan
 * manusia, jadi angka yang dihitung tanpa manusia tidak boleh berbentuk seperti
 * nilai.
 */

/** Satu giliran percakapan, bentuk minimal yang dipakai modul ini. */
export interface GiliranRingkas {
  role: "user" | "assistant";
  content: string;
}

/** Satu sesi tutor, bentuk minimal. */
export interface SesiRingkas {
  /** Judul sesi, mis. "Jelaskan closure di JavaScript". */
  judul: string;
  courseId: string | null;
  messages: GiliranRingkas[];
}

/** Fakta yang bisa dihitung tanpa model. */
export interface FaktaTranskrip {
  /** Berapa sesi yang punya pesan dari peserta. */
  sesi: number;
  /** Total pesan peserta. */
  pesanPeserta: number;
  /** Total pesan tutor. */
  pesanTutor: number;
  /** Course yang disingguh, urut dari yang paling sering. */
  course: Array<{ id: string; sesi: number }>;
  /**
   * Topik dari judul sesi, urut dari yang paling sering.
   *
   * Judul sesi ditulis **peserta** — di UI tutor itu kolom yang diisi manual — jadi
   * ini bukti minat yang lebih jujur daripada mengurai isi jawaban tutor: judul
   * itu yang ingin diketahui peserta, bukan yang ingin ditulis model.
   */
  topik: Array<{ judul: string; sesi: number }>;
  /** Berapa topik yang muncul lebih dari sekali. */
  topikDiulang: number;
}

/** Normalisasi judul supaya "Closure di JS" dan "closure  di js" terhitung sama. */
function normalisasiJudul(judul: string): string {
  return judul.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Hitung fakta dari daftar sesi.
 *
 * Sesi tanpa pesan dari peserta **tidak** dihitung sebagai sesi. Pernah dibuka
 * bukan berarti pernah dipakai, dan menghitungnya membuat "2 sesi" terdengar
 * seperti bukti kerja yang isinya tidak ada.
 */
export function faktaTranskrip(sesi: readonly SesiRingkas[]): FaktaTranskrip {
  let pesanPeserta = 0;
  let pesanTutor = 0;
  let sesiBerisiPeserta = 0;
  const perCourse = new Map<string, number>();
  const perTopik = new Map<string, { judul: string; sesi: number }>();

  for (const s of sesi) {
    const dariPeserta = s.messages.filter((m) => m.role === "user");
    if (dariPeserta.length === 0) continue;

    sesiBerisiPeserta += 1;
    pesanPeserta += dariPeserta.length;
    pesanTutor += s.messages.length - dariPeserta.length;

    const courseId = (s.courseId ?? "").trim();
    if (courseId) perCourse.set(courseId, (perCourse.get(courseId) ?? 0) + 1);

    // Judul kosong tidak jadi topik: sesi tanpa judul memang ada, dan mengarang
    // placeholder untuknya akan menampilkan "tanpa judul" seolah-olah topik.
    const judul = s.judul.trim();
    if (!judul) continue;
    const kunci = normalisasiJudul(judul);
    const ada = perTopik.get(kunci);
    if (ada) ada.sesi += 1;
    else perTopik.set(kunci, { judul, sesi: 1 });
  }

  const course = [...perCourse.entries()]
    .map(([id, n]) => ({ id, sesi: n }))
    .sort((a, b) => b.sesi - a.sesi || a.id.localeCompare(b.id));

  const topik = [...perTopik.values()].sort(
    (a, b) => b.sesi - a.sesi || a.judul.localeCompare(b.judul),
  );

  return {
    sesi: sesiBerisiPeserta,
    pesanPeserta,
    pesanTutor,
    course,
    topik,
    topikDiulang: topik.filter((t) => t.sesi > 1).length,
  };
}

/** Batas atas jumlah giliran yang dikirim ke model. */
export const BATAS_GILIRAN_PROMPT = 60;

/**
 * Rakit transkrip menjadi teks untuk prompt.
 *
 * Dipotong pada `BATAS_GILIRAN_PROMPT`, dan pemotongan **dinyatakan di dalam
 * teks**. Memotong diam-diam membuat model menyimpulkan ada awal percakapan yang
 * tidak ada; model yang tahu transkripnya dipotong lebih jujur daripada model
 * yang mengarang awal percakapan.
 *
 * Sesi yang dipilih adalah yang **lebih baru** dalam urutan judul, bukan yang
 * paling panjang: yang paling baru menggambarkan keadaan peserta sekarang, dan
 * itu yang dilihat verifikator.
 */
export function transkripUntukPrompt(
  sesi: readonly SesiRingkas[],
  maks: number = BATAS_GILIRAN_PROMPT,
): string {
  const urut = [...sesi].sort((a, b) => b.judul.localeCompare(a.judul));
  const baris: string[] = [];
  let dipakai = 0;
  let terpotong = false;

  for (const s of urut) {
    if (dipakai >= maks) {
      terpotong = true;
      break;
    }
    for (const m of s.messages) {
      if (dipakai >= maks) {
        terpotong = true;
        break;
      }
      baris.push(`${m.role === "user" ? "Peserta" : "Tutor"}: ${m.content.trim()}`);
      dipakai += 1;
    }
  }

  const teks = baris.join("\n");
  return terpotong
    ? `${teks}\n\n(transkrip dipotong pada giliran terakhir)`
    : teks;
}