"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, GraduationCap, MapPin, Search, X } from "lucide-react";
import { filterInbox } from "@/lib/jobs/kueri-inbox";
import { monogram } from "@/lib/jobs/monogram";
import { labelSinyal } from "@/lib/agents/sentinel";
import type { BarisDiaudit, InboxJob } from "@/lib/career-ops";

/**
 * Satu baris inbox setelah audit: data lowongan + hasil Sentinel.
 *
 * Didefinisikan di sini, bukan di `inbox-list.tsx`, karena `verdictBadge`
 * pindah ke modul ini dan `inbox-list` mengimpor builder itu. Menarik type-nya
 * juga ke sini berarti satu bentuk baris untuk semua pemanggil, bukan dua.
 */
export type Baris = InboxJob & { firstSeen?: string } & Partial<BarisDiaudit>;

/**
 * Komponen bersama untuk hasil pencarian lowongan, bergaya kartu chat AI Mastery.
 *
 * Diujiplak dari `features/sijago/components/chat/home/` (AI Mastery):
 *   - `CapabilityConfigCard` — chrome kartu: `rounded-xl` + border rambut
 *     (`--border`/55) + bayangan berlapis `color-mix`.
 *   - `MasteryHandoffCard` — sigil bulat: ring `color-mix` primary + isian
 *     radial-gradient, mark monogram di tengahnya.
 *
 * Yang dipinjam dari AI Mastery adalah *kartu* hasil, bukan composer-nya. Kotak
 * pencarian pindah ke `permukaan-cari-loker.tsx` sebagai form conventional
 * (teks + kota + kategori + tombol Cari), karena pemanggilnya punya bentuk form
 * yang harus diterapkan saat tombol ditekan, bukan menyaring sambil mengetik.
 * Yang dipindah tetap bahasanya, bukan logikanya — kartu di sini merender baris
 * hasil pindai, bukan payload tool dari backend AI Mastery.
 */

/**
 * Hasil audit Sentinel untuk satu baris, sudah diterjemahkan ke bahasa manusia.
 *
 * Didefinisikan sekali di sini karena bentuknya sebelumnya ditulis ulang di
 * tiga tempat (`KartuLokerInbox`, `DaftarLokerLayarPenuh`, `inbox-list.tsx`) dan
 * ketiganya bisa diam-diam melenceng — persis kegagalan kontrak-field yang
 * `careevo-review` memperingatkan.
 *
 * **`sinyal` adalah alasan sebenarnya, bukan status.** `status` hanya
 * bounce satu kata (AMAN / KARANTINA / DITOLAK) dan tidak pernah menjelaskan
 * kenapa; dulu `PopupDetailLoker` menerima `status` saja sehingga popup tidak
 * pernah bisa menampilkan penyebabnya. `sinyal` membawa label lengkap dari
 * `labelSinyal` supaya popup bisa menampilkannya.
 *
 * `terperiksa` membedakan "aman" dari "belum sempat dicek": `auditBaris`
 * mengembalikan `quarantined` untuk keduanya, jadi tanpa flag ini lowongan
 * yang gagal di-enrichment akan terbaca sebagai GERAH RIPUAN.
 */
export type VerdictLoker = {
  /** Kata verdict untuk badge: AMAN / KARANTINA / DITOLAK. */
  label: string;
  /** Kelas CSS untuk badge pill. */
  cls: string;
  /** Alasan lengkap, sudah dibaca orang. Untuk `title` dan popup. */
  title: string;
  /** Alasan per-flag, dipisah " · ". Kosong untuk verdict clean. */
  sinyal: string[];
  status?: "clean" | "quarantined" | "rejected";
  /** false = data lowongan tidak bisa diambil, jadi belum pernah diaudit. */
  terperiksa: boolean;
};

/**
 * Verdict satu baris, dalam bahasa manusia. Dihidupkan di sini, bukan di `inbox-list.tsx`, karena
 * `kartu-rekomendasi-profil.tsx` juga membutuhkannya: mengikuti aturan
 * `careevo-review` soal jangan menyimpan dua salinan aturan yang bisa berbeda.
 *
 * `auditBaris` (`inbox-audit.ts:55`) mengembalikan `quarantined` untuk lowongan
 * yang GAGAL di-enrichment, sama seperti lowongan yang sungguhan mencurigakan.
 * Yang membedakan keduanya hanya `enriched` dan flag `data_tidak_terverifikasi`
 * — jadi `terperiksa` di sini, kalau tidak, lowongan yang belum sempat dicek
 * akan tampil badge "Perlu ditinjau", dan popup-nya akan menampilkan
 * "KARANTINA" — sebuah tuduhan yang belum bisa dibuktikan.
 */
export function verdictBadge(row: Baris): VerdictLoker | null {
  if (!row.audit) return null;

  if (!row.enriched) {
    // Naming the board matters: for a board with no adapter this state is
    // permanent, and a generic "belum bisa diambil" reads like a transient
    // failure a retry would fix.
    const papan = row.papan;
    return {
      label: "Belum diperiksa",
      cls: "verdict-unverified",
      status: "quarantined",
      title: papan
        ? `Lowongan dari ${papan} belum bisa dibaca otomatis, jadi belum diverifikasi.`
        : "Data lowongan ini belum bisa diambil dari papan aslinya, jadi belum diverifikasi.",
      sinyal: [
        papan
          ? `Papan ${papan} belum bisa dibaca otomatis`
          : "Data lowongan belum bisa diambil dari papan aslinya",
      ],
      terperiksa: false,
    };
  }

  // `flags` bisa kosong hanya untuk `clean`; `quarantined`/`rejected` selalu
  // punya minimal satu, tapi `||` menjaga agar badge tidak menampilkan "Sinyal: ".
  const sinyal = row.audit.flags.map(labelSinyal);

  if (row.audit.status === "clean") {
    return {
      label: "Aman",
      cls: "verdict-clean",
      status: "clean",
      title: "Tidak ditemukan pola penipuan pada lowongan ini.",
      sinyal,
      terperiksa: true,
    };
  }

  const ditolak = row.audit.status === "rejected";
  return {
    label: ditolak ? "Ditolak" : "Perlu ditinjau",
    cls: ditolak ? "verdict-rejected" : "verdict-quarantined",
    status: row.audit.status,
    title: sinyal.length > 0 ? `Sinyal: ${sinyal.join(" · ")}` : "Ada sinyal yang perlu diperiksa lebih lanjut.",
    sinyal,
    terperiksa: true,
  };
}

/**
 * Satu kartu lowongan, bergaya kartu chat AI Mastery.
 *
 * Header = sigil monogram + role + company (hairline border di bawah).
 * Footer = location + compensation, dengan pill verdict bila ada.
 *
 * **Kartu ini bukan `<a>`.** Membuat seluruh kartu sebuah link mustahil bila
 * panel `PersiapanLoker` ikut di dalamnya: sebuah `<button>` di dalam `<a>`
 * tidak bisa diaktifkan tanpa mengaktifkan link-nya juga, dan browser lalu
 * melompat ke lowongan saat learner sedang ingin melihat kursus. Jadi tautan ke
 * lowongan asli adalah `Buka` di header, dan seluruh kartu bisa berisi kontrol.
 */
export function KartuLokerInbox({
  job,
  verdict,
  onBukaDetail,
  jumlahKursus,
}: {
  job: InboxJob;
  verdict?: VerdictLoker | null;
  onBukaDetail?: (url: string, verdict?: VerdictLoker | null) => void;
  /** Berapa kursus yang cocok, dihitung server. 0 = tidak ada. */
  jumlahKursus?: number;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-dock-inner)] border border-[var(--border)]/55 bg-[var(--card)] shadow-[0_1px_2px_color-mix(in_srgb,var(--foreground)_5%,transparent),0_4px_14px_color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors hover:border-[var(--primary)]/40">
      {/* SELURUH badan kartu adalah satu tombol yang membuka popup detail.
          Dulu hanya baris lokasi yang bisa diklik, dan itu yang membuat
          "klik kartunya tidak terjadi apa-apa" — sebagian besar kartu lowongan
          adalah header plus judul, bukan baris lokasi. Header, lokasi, dan
          verdict sekarang satu target klik.

          Bukan `<a>`: popup memanggil server action, dan tautan ke lowongan
          asli tetap ada sebagai "Buka" di footer. */}
      <button
        type="button"
        onClick={() => onBukaDetail?.(job.url, verdict)}
        disabled={!onBukaDetail}
        aria-label={`Lihat detail ${job.role} di ${job.company}`}
        className="block w-full text-left transition-colors enabled:hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] disabled:cursor-default"
      >
        <span className="flex min-h-11 items-center gap-2.5 px-3.5 py-2.5">
          <span
            aria-hidden
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--primary)_22%,transparent)] bg-[radial-gradient(circle_at_30%_25%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_70%)] text-[11px] font-bold tracking-tight text-[var(--primary)]"
          >
            {monogram(job.company)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold tracking-[0.005em] text-[var(--foreground)]">
              {job.role}
            </span>
            <span className="block truncate text-[11px] text-[var(--muted-foreground)]">
              {job.company}
            </span>
          </span>
          {/* Badge verdict truncate, tidak lagi boleh melebar tanpa batas:
              label "Belum diperiksa" adalah yang terpanjang dan di lebar kartu
              269px ia mendorong judul lowongan sampai tersisa beberapa
              karakter saja. Dibiarkan `shrink-0` dulu karena judulnya
              `truncate` sehingga tidak ada yang terlihat rusak — hanya
              judulnya yang tak terbaca. */}
          {verdict ? (
            <span
              className={`max-w-[45%] shrink-0 truncate rounded-full px-2 py-[2px] text-[10px] font-semibold ${verdict.cls}`}
              title={verdict.title}
            >
              {verdict.label}
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5 border-t border-[var(--border)]/35 px-3.5 py-2 text-[11px] text-[var(--muted-foreground)]">
          <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="truncate">
            {[job.location, job.compensation].filter(Boolean).join(" · ") ||
              "Lokasi tidak disebutkan"}
          </span>
        </span>
      </button>

      {/* Footer aksi.

          Di mobile setiap chip memakai `min-h-11` (44px) dan `flex-1` supaya
          tiga sasaran sentuh kecil — "Buka" 20px, "Detail" 22px — yang
          sebelumnya berdempetan di sudut kiri kartu menjadi tiga sasaran
          selebar kartu. Ini baris yang paling sering salah tekan: "Buka"
          meninggalkan halaman ke situs asing, jadi meleset satu chip ke
          samping adalah kerugian nyata, bukan sekadar ketidaknyamanan.
          Dari `sm` ke atas ukuran chip aslinya kembali. */}
      <div className="flex items-center gap-1.5 px-3.5 py-2">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Buka lowongan ${job.role} di ${job.company} di situs aslinya`}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2 py-[2px] text-[10px] font-semibold text-[var(--primary)] transition-opacity hover:opacity-80 pointer-fine:min-h-0 pointer-fine:flex-none"
        >
          <ExternalLink className="size-3" aria-hidden />
          Buka
        </a>
        {onBukaDetail ? (
          <button
            type="button"
            onClick={() => onBukaDetail(job.url, verdict)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full border border-[var(--border)] px-2 py-[2px] text-[10px] font-semibold text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)] pointer-fine:min-h-0 pointer-fine:flex-none"
          >
            Detail
          </button>
        ) : null}
        {jumlahKursus && jumlahKursus > 0 ? (
          <span
            title={`${jumlahKursus} kursus di katalog yang cocok`}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2 py-[2px] text-[10px] font-semibold text-[var(--primary)] pointer-fine:min-h-0 pointer-fine:flex-none"
          >
            <GraduationCap className="size-3" aria-hidden />
            {jumlahKursus} kursus
          </span>
        ) : null}
      </div>
    </article>
  );
}

/**
 * DaftarLokerLayarPenuh — seluruh lowongan sebagai lapisan layar penuh.
 *
 * Dipanggil dari ikon kisi di dalam composer. Halaman utama menampilkan
 * hasil pencarian saja, jadi di sinilah daftar lengkap diletakkan; tanpa ini
 * lowongan yang tidak cocok dengan kueri mana pun tidak punya jalan masuk.
 *
 * `showModal()` BUKAN `open` — itu inti dari komponen ini. Sebuah `<dialog>`
 * yang hanya diberi atribut `open` tetap elemen biasa: ia dipositioning dengan
 * CSS lalu ikut bersaing di z-index, dan di halaman ini ia kalah. Yang melompat
 * ke *top layer* browser — di atas segalanya, tanpa z-index yang perlu
 * ditawar dengannya — hanya `showModal()`. Sidebar dashboard ada di `z-index: 60`
 * dan topbar di `50`; dengan `open` saja keduanya menutupi lapisan ini, persis
 * seperti yang terjadi sebelum perbaikan ini.
 *
 * Top layer itu juga memberi dua hal yang di versi tulisan-tangan mudah
 * dilupakan: focus terjerat di dalam lapisan, dan Escape yang menutupnya.
 * Jadi `onCancel` (kita panggil `preventDefault` supaya React yang memutuskan
 * state) menggantikan listener `keydown` global.
 */
export function DaftarLokerLayarPenuh({
  baris,
  onTutup,
  renderVerdict,
  kueriAwal = "",
  onBukaDetail,
  jumlahKursusPerUrl,
}: {
  baris: InboxJob[];
  onTutup: () => void;
  renderVerdict?: (job: InboxJob) => VerdictLoker | null;
  /** Kueri dari composer halaman, jadi panel dibuka dalam konteks yang sama. */
  kueriAwal?: string;
  /** Jumlah kursus per posting, dihitung server. */
  jumlahKursusPerUrl?: Map<string, number>;
  onBukaDetail?: (url: string, verdict?: VerdictLoker | null) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kueri, setKueri] = useState(kueriAwal);

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  const adaKueri = kueri.trim().length > 0;
  const cocok = useMemo(
    () => (adaKueri ? filterInbox(baris, kueri) : baris),
    [baris, kueri, adaKueri],
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="daftar-loker-judul"
      onCancel={(e) => {
        e.preventDefault();
        onTutup();
      }}
      onClick={(e) => {
        // Hanya klik pada latar lapisan itu sendiri yang menutup; klik di dalam
        // panel kartu akan membubble ke sini dan menutupnya tanpa sengaja.
        if (e.target === e.currentTarget) onTutup();
      }}
      /* Di mobile lapisan ini nyaris memenuhi layar: `100vw - 2rem` menyisakan
         16px di setiap sisi dan `85dvh` memotong daftar lebih awal, padahal
         tidak ada latar bermakna di belakangnya untuk dijaga. Karena itu
         `w-full max-h-[92dvh]` tanpa radius di bawah `sm` — sudut membulat
         pada panel yang menempel tepi hanya memakan lebar yang justru
         dibutuhkan kartu. Dari `sm` ke atas resep mengambangnya kembali. */
      className="m-auto max-h-[min(92dvh,900px)] w-full max-w-none overflow-hidden rounded-none border border-[var(--border)]/60 bg-[var(--card)] p-0 shadow-[0_24px_64px_color-mix(in_srgb,var(--foreground)_28%,transparent)] backdrop:bg-[color-mix(in_srgb,var(--foreground)_40%,transparent)] backdrop:backdrop-blur-sm sm:w-[min(1180px,calc(100vw-2rem))] sm:rounded-2xl"
    >
      <div className="flex max-h-[min(92dvh,900px)] flex-col">
        <header className="shrink-0 border-b border-[var(--border)]/60 bg-[var(--card)] px-4 py-3.5 sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                className="text-base font-bold text-[var(--foreground)]"
                id="daftar-loker-judul"
              >
                Semua lowongan
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]" aria-live="polite">
                {adaKueri
                  ? `${cocok.length} dari ${baris.length} lowongan cocok`
                  : `${baris.length} lowongan hasil pindai`}
              </p>
            </div>
            <button
              type="button"
              onClick={onTutup}
              aria-label="Tutup daftar lowongan"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)] pointer-fine:size-9"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {/* Saringan kedua di dalam panel. Tanpa ini membuka 214 lowongan hanya
              memindahkan masalah: yang muncul pertama tetap 214, dan menutup
              panel untuk kembali ke composer halaman adalah satu klik lebih
              banyak tanpa memfilter apa pun. */}
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-3 py-2 transition-colors focus-within:border-[var(--primary)]/50">
            <Search className="size-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
            <input
              type="search"
              value={kueri}
              onChange={(e) => setKueri(e.target.value)}
              placeholder="Saring daftar ini…"
              aria-label="Saring daftar lowongan"
              className="w-full border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
            />
            {adaKueri ? (
              <button
                type="button"
                onClick={() => setKueri("")}
                aria-label="Hapus saringan"
                className="shrink-0 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {cocok.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--muted-foreground)]">
              {baris.length === 0
                ? "Belum ada lowongan hasil pindai."
                : `Tidak ada lowongan untuk "${kueri.trim()}".`}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cocok.map((job) => (
                <KartuLokerInbox
                  key={job.url}
                  job={job}
                  verdict={renderVerdict?.(job)}
                  onBukaDetail={onBukaDetail}
                  jumlahKursus={jumlahKursusPerUrl?.get(job.url)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
