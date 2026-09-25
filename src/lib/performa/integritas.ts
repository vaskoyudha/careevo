import type { SessionRun } from "@/lib/learning/session";

/**
 * Pembacaan integritas untuk laporan staf.
 *
 * Membaca `.data/sessions/` secara langsung dan **menyimpan ulang tidak apa pun**
 * ke toko performa: menyalin akan menciptakan dua sumber kebenaran yang bisa
 * berbeda tanpa ada yang memperingatkan, sedangkan `.data/sessions/` sudah
 * merupakan sumber kebenarannya.
 *
 * Yang dikembalikan adalah **konteks**, bukan vonis. Ringkasan di bawah tidak
 * pernah menjadi skor, tidak pernah memengaruhi kelulusan, dan tidak pernah
 * memengaruhi reputasi. Angka "celah" menjelaskan apa yang tercatat — bukan siapa
 * yang dipercaya.
 */
export interface RingkasanSesi {
  run_id: string;
  course_id: string;
  status: SessionRun["status"];
  mulai_at: string;
  berakhir_at: string | null;
  kejadian: number;
  celah: number;
}

export interface RingkasanIntegritas {
  sesi: number;
  kejadian: number;
  celah: number;
  kedaluwarsa: number;
  daftar: RingkasanSesi[];
}

export function ringkasIntegritasByOwner(runs: SessionRun[]): Map<string, RingkasanIntegritas> {
  const peta = new Map<string, RingkasanIntegritas>();

  for (const run of runs) {
    const isi = peta.get(run.owner) ?? {
      sesi: 0,
      kejadian: 0,
      celah: 0,
      kedaluwarsa: 0,
      daftar: [],
    };
    // `klasifikasiKejadian` sudah ditetapkan server saat kejadian dicatat, jadi
    // yang dihitung ulang di sini hanya pengelompokannya, bukan artinya.
    const kejadian = run.kejadian.filter((k) => k.jenis_klasifikasi === "kejadian").length;
    const celah = run.kejadian.length - kejadian;

    isi.sesi += 1;
    isi.kejadian += kejadian;
    isi.celah += celah;
    if (run.status === "kedaluwarsa") isi.kedaluwarsa += 1;
    isi.daftar.push({
      run_id: run.id,
      course_id: run.course_id,
      status: run.status,
      mulai_at: run.mulai_at,
      berakhir_at: run.berakhir_at,
      kejadian,
      celah,
    });
    peta.set(run.owner, isi);
  }

  for (const isi of peta.values()) {
    isi.daftar.sort((a, b) => b.mulai_at.localeCompare(a.mulai_at));
  }
  return peta;
}
