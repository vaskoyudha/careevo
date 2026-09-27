/**
 * Pemantauan kamera untuk lapisan anti-curang — **klien saja**.
 *
 * Modul ini menyentuh `HTMLVideoElement`, `navigator.mediaDevices`, dan
 * WebAssembly, jadi ia **hanya boleh diimpor dari komponen klien**. Jangan
 * pernah mengimpornya dari server action atau server component: build akan
 * menjatuhkannya, dan kalau toh jalan, peserta bisa membaca aturan integritas
 * yang seharusnya otoritatif di server.
 *
 * **Yang dikirim ke server hanya ANGKA** — jumlah wajah, durasi, status.
 * Frame video tidak pernah keluar dari perangkat pada pass ini (lihat bagian
 * Retensi di spec 2026-09-27). Retensi gambar adalah task terpisah dengan
 * keputusan produk tersendiri.
 *
 * **Yang ini tetap bukan bukti.** Face *detection* bukan face *recognition*:
 * model ini memberitahu "ada wajah di frame", tidak "wajah siapa". Deteksinya
 * juga bisa salah, terutama pada pencahayaan rumah — dan itu batas yang wajib
 * tertulis di laporan, bukan asumsi senyap.
 */

/** Berapa lama wajah boleh absen sebelum dicatat sebagai celah. */
export const AMBANG_WAJAH_HILANG_DETIK = 10;

export type StatusWajah = "tidak_ada" | "satu" | "lebih_dari_satu";

/**
 * Jumlah wajah yang dilaporkan model menjadi status.
 *
 * Gagal-tertutup: nilai non-finite (model mengembalikan `NaN`/`Infinity`) dan
 * nilai `<= 0` semuanya jatuh ke `"tidak_ada"`. Angka yang tidak bisa dibaca
 * tidak boleh menciptakan `wajah_kedua` dari ketiadaan bukti — "tidak ada
 * wajah" adalah nilai yang aman, karena ia hanya bisa memperkuat sinyal
 * `celah`, bukan menuduh orang lain ada di ruangan.
 */
export function statusWajah(jumlahWajah: number): StatusWajah {
  if (!Number.isFinite(jumlahWajah) || jumlahWajah <= 0) return "tidak_ada";
  return jumlahWajah === 1 ? "satu" : "lebih_dari_satu";
}

export interface TemuanWajahHilang {
  durasi_detik: number;
}

/**
 * Apakah kondisi "wajah tidak ada" sudah cukup lama untuk dicatat.
 *
 * Mengembalikan `null` untuk semuanya yang tidak layak dicatat — termasuk
 * `sejakMs === null`, karena "kapan wajah terakhir terlihat" memang tidak
 * diketahui dan mengarang durasi dari `null` berarti mengarang bukti.
 */
export function perluCatatWajahHilang(
  status: StatusWajah,
  sejakMs: number | null,
  sekarang: number,
): TemuanWajahHilang | null {
  if (status !== "tidak_ada" || sejakMs === null) return null;
  const milidetik = sekarang - sejakMs;
  // Gagal-tertutup saat selisihnya tidak masuk akal: jam mundur (negatif) atau
  // nilai non-finite berarti durasinya **tidak bisa diukur**, dan catatan
  // "celah 0 detik" adalah temuan yang mengarang bukti. `lewatBatas` di
  // `akses.ts` memakai sikap yang sama untuk waktu yang tidak terbaca.
  if (!Number.isFinite(milidetik) || milidetik <= 0) return null;
  const detik = Math.floor(milidetik / 1000);
  if (detik < AMBANG_WAJAH_HILANG_DETIK) return null;
  return { durasi_detik: detik };
}

type HasilWajah = { status: StatusWajah; sejakMs: number | null };

/**
 * Bentuk minimal yang dipakai model. Sengaja bukan tipe resmi MediaPipe:
 * modul ini dimuat lewat `import()` dinamis, jadi tipe resminya tidak selalu
 * tersedia saat modul ini dikompilasi, dan bentuk yang dibutuhkan hanya ini.
 */
type DeteksiWajah = {
  detectForVideo(video: unknown, waktuMs: number): { detections?: unknown[] };
};

let detektorCache: DeteksiWajah | null = null;

/**
 * Muat model sekali lalu pakai ulang.
 *
 * `import()` dinamis dipakai supaya modul MediaPipe **tidak ikut** di bundel
 * awal: peserta yang tidak menyalakan kamera tidak pernah mengunduhnya.
 *
 * Mengembalikan `null` (bukan melempar) bila model gagal dimuat — jaringan
 * buruk atau CSP adalah kondisi nyata, dan melempar akan menghentikan
 * penghitungan tanpa memberi tahu apa pun ke pemanggil.
 */
export async function praMuatModelWajah(): Promise<DeteksiWajah | null> {
  if (detektorCache) return detektorCache;
  try {
    const vision = await import("@mediapipe/tasks-vision");
    const berkas = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm",
    );
    detektorCache = (await vision.FaceDetector.createFromOptions(berkas, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
    })) as unknown as DeteksiWajah;
    return detektorCache;
  } catch {
    return null;
  }
}

/**
 * Hitung wajah pada satu frame.
 *
 * Selalu mengembalikan angka dan tidak pernah melempar. 0 berarti "tidak ada
 * wajah yang terdeteksi", dan sistem memperlakukannya sebagai **celah**, bukan
 * sebagai bukti.
 */
function hitungWajah(detektor: DeteksiWajah, video: HTMLVideoElement, waktuMs: number): number {
  try {
    return detektor.detectForVideo(video, waktuMs).detections?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Pemantau wajah berbasis MediaPipe, berjalan sepenuhnya di perangkat.
 */
export class PemantauWajah {
  private readonly padaHasil: (h: HasilWajah) => void;
  private video: HTMLVideoElement | null = null;
  private detektor: DeteksiWajah | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private sejakWajahTerakhir: number | null = null;
  private berjalan = false;

  constructor(padaHasil: (h: HasilWajah) => void) {
    this.padaHasil = padaHasil;
  }

  /** Apakah kamera sedang berjalan. Dipakai pemanggil untuk menghindari dobel. */
  get aktif(): boolean {
    return this.berjalan;
  }

  /**
   * Minta akses kamera, muat model, lalu mulai menghitung wajah.
   *
   * Mengembalikan `false` (bukan melempar) bila model gagal dimuat, izin
   * ditolak, atau kamera tidak ada. Pemanggil mencatatnya sebagai
   * `kamera_gagal` — yang berbeda dari "produk tidak pernah meminta" (lihat
   * `statusPersetujuan` di `src/lib/performa/integritas.ts`).
   */
  async mulai(video: HTMLVideoElement): Promise<boolean> {
    if (this.berjalan) return true;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;

    const detektor = await praMuatModelWajah();
    if (!detektor) return false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
    } catch {
      return false;
    }

    this.detektor = detektor;
    this.stream = stream;
    this.video = video;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => undefined);
    this.berjalan = true;
    void this.putar();
    return true;
  }

  private putar(): void {
    if (!this.berjalan || !this.detektor || !this.video) return;
    const status = statusWajah(hitungWajah(this.detektor, this.video, Date.now()));
    const sekarang = Date.now();
    if (status === "tidak_ada") {
      // Hanya di-*set* sekali: bila di-set ulang tiap frame, durasi yang
      // dilaporkan selalu nol dan celah tidak pernah terdeteksi.
      if (this.sejakWajahTerakhir === null) this.sejakWajahTerakhir = sekarang;
    } else {
      this.sejakWajahTerakhir = null;
    }
    this.padaHasil({ status, sejakMs: this.sejakWajahTerakhir });
    this.raf = requestAnimationFrame(() => this.putar());
  }

  /** Hentikan kamera dan lepaskan stream. Aman dipanggil berkali-kali. */
  berhenti(): void {
    this.berjalan = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video = null;
    this.detektor = null;
    this.sejakWajahTerakhir = null;
  }
}
