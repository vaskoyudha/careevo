import type { BerkasSnapshot } from "@/lib/workspace/snapshot";

/**
 * Bentuk snapshot yang dibaca dua halaman (learner dan verifikator).
 *
 * Dideklarasikan di sini, bukan di salah satu halaman, karena dua halaman itu
 * membacanya dan bentuk yang disalin dua kali adalah dua definisi yang bisa
 * menyimpang — persis kelas bug yang dilarang `careevo-review` butir 2.
 *
 * Semua field opsional: snapshot lama (dibuat sebelum fitur ruang kerja ada)
 * tidak punya `berkas` sama sekali, dan itu harus dirender sebagai "tidak ada
 * daftar berkas", bukan sebagai galat.
 */
export interface SnapshotKarya {
  judul?: string | null;
  catatan?: string | null;
  berkas?: BerkasSnapshot[] | null;
  berkasTerpotong?: boolean;
}

/** Ukuran berkas dalam satuan yang bisa dibaca manusia. */
function ukuranRingkas(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Daftar berkas yang dibekukan saat submission dibuat.
 *
 * Tiga keadaan dibedakan dengan sengaja, dan pembedaannya bagian dari
 * kegunaannya:
 *
 * - `berkas` absen → snapshot dibuat sebelum fitur ruang kerja ada, atau ruang
 *   kerja tidak terbaca saat itu. Dikatakan apa adanya.
 * - `berkas` kosong → ruang kerja terbaca dan memang tidak berisi berkas. Itu
 *   temuan tentang karyanya, bukan tentang sistemnya.
 * - ada isi → daftarnya ditampilkan, beserta penanda bila dipotong.
 *
 * Yang **tidak** ditampilkan: isi berkasnya. Snapshot menyimpan path dan ukuran
 * saja; membuka isinya berarti menyalin seluruh proyek ke dalam baris database,
 * dan itu keputusan yang tidak diambil di sini.
 */
export function DaftarBerkasSnapshot({ snapshot }: { snapshot: SnapshotKarya | undefined }) {
  const berkas = snapshot?.berkas;

  if (!Array.isArray(berkas)) {
    return (
      <p className="caption muted" style={{ marginTop: "0.75rem" }}>
        Tidak ada daftar berkas pada karya ini.
      </p>
    );
  }

  if (berkas.length === 0) {
    return (
      <p className="caption muted" style={{ marginTop: "0.75rem" }}>
        Ruang kerja terbaca, tetapi tidak ada berkas di dalamnya.
      </p>
    );
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <h3 className="caption" style={{ marginBottom: "0.5rem" }}>
        Berkas ruang kerja ({berkas.length}
        {snapshot?.berkasTerpotong ? ` dari ${berkas.length}+` : ""})
      </h3>
      <ul className="list-app" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {berkas.map((baris) => (
          <li className="list-app-row" key={baris.path}>
            <span className="row-title" style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
              {baris.path}
            </span>
            <span className="row-aside row-meta">{ukuranRingkas(baris.ukuran)}</span>
          </li>
        ))}
      </ul>
      {snapshot?.berkasTerpotong ? (
        <p className="caption muted" style={{ marginTop: "0.5rem" }}>
          Daftar dipotong; hanya sebagian berkas yang ditampilkan.
        </p>
      ) : null}
    </div>
  );
}
