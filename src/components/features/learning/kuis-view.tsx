"use client";

import { useId, useRef, useState } from "react";
import { kirimDanSelesaikanKuisAction, mulaiKuisVerifiedAction } from "@/actions/assessment";
import { cn } from "@/lib/utils";
import type { Kuis } from "@/types/course";

/**
 * Konteks modul tempat kuis ini terpasang.
 *
 * Wajib ada untuk menilai server: action asesmen menerima tiga id ini, dan
 * `attemptId` saja tidak cukup — service memverifikasi bahwa attempt memang
 * milik enrollment pemanggil pada kuis yang terpasang di modul itu.
 */
interface KonteksKuisTerverifikasi {
  courseId: string;
  modulId: string;
}

/**
 * Renderer kuis untuk sisi learner — **menilai di server**.
 *
 * Dulu komponen ini menghitung nilai di peramban lalu mengirim hasilnya sebagai
 * catatan lewat action skor lama, fire-and-forget. Nilai itu **tidak pernah
 * terbaca laporan staf**, yang membaca `quiz_attempts` di PostgreSQL — jadi
 * peserta melihat angka di layar sementara laporan melihat kosong, dan kegagalan
 * penyimpanan tidak terlihat siapa pun. Sekarang penilaian lewat jalur
 * terverifikasi: UI membuka attempt lewat `mulaiKuisVerifiedAction`, mengirim
 * `selectedOption` per soal lewat `kirimDanSelesaikanKuisAction`, dan **skor
 * yang ditampilkan adalah skor yang dihitung server dari snapshot**, bukan
 * hitungan peramban.
 *
 * Yang tetap benar dan tidak boleh diklaim lebih:
 *
 * - **Kunci jawaban masih ikut ke peramban.** Snapshot membekukan `jawaban_benar`
 *   di server (attempt dinilai terhadap snapshot, bukan bank soal yang bisa
 *   berubah), tetapi bank soal yang sama juga dikirim ke sini untuk menampilkan
 *   pilihan dan umpan balik. Peramban yang memegang kunci bisa menghitung
 *   sendiri; karena itu penilaian server ini membuat nilai **kredibel**, bukan
 *   membuat peserta tak bisa menebak jawabannya. Ini bukan ujian tahan curang.
 * - **Skor lokal hanya umpan balik sementara.** Begitu server menjawab, angka
 *   yang ditampilkan berganti ke skor server. Bila server gagal, nilainya tetap
 *   ditampilkan sebagai hasil latihan, disertai pesan bahwa ia **belum tersimpan**
 *   — bukan dibiarkan tampak tersimpan padahal tidak.
 *
 * `konteks` absen = pratinjau admin (`kuis-modul-editor.tsx` merender tanpa
 * konteks). Admin yang memeriksa kunci jawaban bukan peserta yang mengerjakan
 * kuis, jadi tidak ada attempt yang boleh dibuat untuknya.
 *
 * `konteks` sengaja satu objek, bukan dua string terpisah: satu kuis bisa
 * terpasang di beberapa modul sekaligus, jadi konteks penilaian tidak boleh bisa
 * terkirim dengan `modulId` tertinggal. Bentuk satu objek membuatnya mustahil
 * secara tipe.
 */
export function KuisView({
  kuis,
  konteks,
  className,
}: {
  kuis: Kuis;
  konteks?: KonteksKuisTerverifikasi;
  className?: string;
}) {
  const [jawaban, setJawaban] = useState<Record<string, number>>({});
  /** Skor umpan balik instan dari peramban — bukan skor yang tersimpan. */
  const [nilaiLokal, setNilaiLokal] = useState<number | null>(null);
  /**
   * Status penilaian server.
   *
   * - `diam` — belum diperiksa, atau pratinjau (tidak ada konteks).
   * - `mengirim` — attempt sedang dibuka/dikirim.
   * - `sukses` — server mengembalikan skor yang tersimpan.
   * - `gagal` — penyimpanan gagal; peserta harus melihatnya.
   */
  const [server, setServer] = useState<
    | { fase: "diam" }
    | { fase: "mengirim" }
    | { fase: "sukses"; score: number; lulus: boolean }
    | { fase: "gagal"; pesan: string }
  >({ fase: "diam" });

  /**
   * Attempt yang sudah dibuka, agar **retry tidak menggandakan attempt**.
   *
   * Bila pengiriman gagal (mis. jaringan) sesudah server sempat menyimpan,
   * `periksa()` yang dipanggil ulang hanya perlu **mengirim ulang attempt yang
   * sama**: `kirimDanSelesaikanKuisAction` idempoten (skor tersimpan yang
   * pertama menang). Tanpa simpanan ini, setiap retry membuka attempt baru dan
   * menumpuk baris `in_progress` yang tidak pernah dikirim.
   *
   * Sengaja `useRef`, bukan state: nilainya tidak boleh memicu render, dan
   * dibaca di dalam handler. Direset `ulangi()` supaya pengerjaan ulang benar
   * memulai attempt baru.
   */
  const attemptRef = useRef<string | null>(null);

  /**
   * Awalan nama radio yang unik per instans.
   *
   * Bukan `kuis.id`: satu kuis bisa dipasang di **beberapa modul** sekaligus —
   * itu justru alasan kuis dipisahkan ke bank soal. Radio hanya bisa satu
   * terpilih per nama, jadi memakai id kuis membuat dua salinan kuis yang sama
   * berbagi grup: menjawab di modul A membatalkan jawaban di modul B, dan
   * jumlah "terjawab" salah di keduanya. `useId` memberi awalan berbeda per
   * instans tanpa membuat markup server dan klien tidak cocok.
   */
  const awalan = useId();
  const soal = kuis.soal;
  const terjawab = soal.filter((s) => jawaban[s.id] !== undefined).length;
  const mengirim = server.fase === "mengirim";

  const nilaiSekarang = () => {
    if (soal.length === 0) return 0;
    const benar = soal.filter((s) => jawaban[s.id] === s.jawaban_benar).length;
    return Math.round((benar / soal.length) * 100);
  };

  /**
   * Periksa jawaban: hitung lokal untuk umpan balik, lalu nilai di server.
   *
   * Skor yang ditampilkan setelah server menjawab **selalu** `server.score`,
   * bukan hasil hitung lokal: `score` dari action berasal dari snapshot yang
   * dibekukan saat attempt dibuka, dan itulah yang tersimpan untuk laporan.
   */
  const periksa = async () => {
    // Tombol sudah dinonaktifkan sebelum semua soal dijawab, tetapi guard ini
    // tetap wajib di handler: state/UI bukan batas kepercayaan dan tidak boleh
    // membuka attempt yang akan tersimpan sebagai skor nol parsial.
    if (terjawab < soal.length) return;

    setNilaiLokal(nilaiSekarang());
    if (!konteks) return;

    setServer({ fase: "mengirim" });
    try {
      // Buka attempt hanya bila belum ada. Retry setelah kegagalan jaringan
      // memakai ulang attempt yang sama, sehingga pengiriman kedua idempoten
      // dan tidak meninggalkan attempt `in_progress` yang menggantung.
      let attemptId = attemptRef.current;
      if (!attemptId) {
        const mulai = await mulaiKuisVerifiedAction({
          courseId: konteks.courseId,
          modulId: konteks.modulId,
          quizId: kuis.id,
        });
        if (!mulai.ok) {
          setServer({ fase: "gagal", pesan: mulai.error });
          return;
        }
        attemptId = mulai.attemptId;
        attemptRef.current = attemptId;
      }

      const kirim = await kirimDanSelesaikanKuisAction({
        courseId: konteks.courseId,
        modulId: konteks.modulId,
        quizId: kuis.id,
        attemptId,
        // Soal tak terjawab dikirim sebagai `-1`: tombol memang menunggu semua
        // soal dijawab, tetapi mengirim sentinel lebih baik daripada melewatkan
        // barisnya — server mencatat "tidak dijawab" eksplisit.
        jawaban: soal.map((s) => ({ questionId: s.id, selectedOption: jawaban[s.id] ?? -1 })),
      });
      if (!kirim.ok) {
        setServer({ fase: "gagal", pesan: kirim.error });
        return;
      }
      setServer({ fase: "sukses", score: kirim.score, lulus: kirim.lulus });
    } catch {
      // Action yang melempar (mis. jaringan) tidak boleh membuat nilai tampak
      // tersimpan. Pesannya generik: penyebabnya bukan domain, jadi tidak ada
      // kode yang bisa dipetakan.
      setServer({ fase: "gagal", pesan: "Tidak bisa menghubungi server. Coba lagi." });
    }
  };

  const ulangi = () => {
    setJawaban({});
    setNilaiLokal(null);
    setServer({ fase: "diam" });
    // Pengerjaan ulang = attempt baru; simpanan attempt lama dibuang supaya
    // tidak ada pengiriman ulang ke attempt yang sudah selesai.
    attemptRef.current = null;
  };

  const sudahDiperiksa = nilaiLokal !== null;
  /**
   * Apakah angka yang tampil sudah **tersimpan** (sukses server).
   *
   * Inilah satu-satunya keadaan yang boleh menampilkan klaim "Lulus!": sebelum
   * ini, `nilaiLokal` hanyalah hitungan peramban, dan menampilkan "Lulus!" di
   * atasnya akan mengklaim progres terverifikasi yang belum ada.
   */
  const tersimpan = server.fase === "sukses";
  // Skor server menang atas skor lokal begitu tersedia — ia yang tersimpan.
  const nilaiDitampilkan = tersimpan ? server.score : (nilaiLokal ?? 0);

  /**
   * Kalimat status di bawah angka, dipisah per keadaan.
   *
   * Pratinjau (tanpa konteks), fase `diam` setelah konteks ada, dan fase
   * `mengirim`/`gagal` semuanya **belum tersimpan**; hanya `sukses` yang boleh
   * mengklaim kelulusan.
   */
  let pesanNilai: string;
  let lulusTampil: boolean;
  if (tersimpan) {
    pesanNilai = server.lulus ? "Lulus!" : `Belum lulus — minimal ${kuis.nilai_lulus}.`;
    lulusTampil = server.lulus;
  } else if (mengirim) {
    pesanNilai = "Menilai di server…";
    lulusTampil = false;
  } else if (!konteks) {
    pesanNilai = "Hasil latihan sementara (pratinjau, tidak disimpan).";
    lulusTampil = false;
  } else if (server.fase === "gagal") {
    pesanNilai = "Hasil latihan sementara — belum tersimpan.";
    lulusTampil = false;
  } else {
    // `diam` dengan konteks: dipanggil ulang sebelum hasil server kembali.
    pesanNilai = "Hasil latihan sementara — belum tersimpan.";
    lulusTampil = false;
  }

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#0056D2] uppercase">
              Kuis
            </span>
            {kuis.judul}
          </p>
          {kuis.deskripsi ? (
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{kuis.deskripsi}</p>
          ) : null}
        </div>
        <p className="shrink-0 text-xs text-gray-500">
          {soal.length} soal · lulus {kuis.nilai_lulus}
        </p>
      </div>

      <ol className="mt-4 space-y-4">
        {soal.map((s, index) => (
          <li key={s.id}>
            <p className="text-sm font-semibold text-gray-900">
              {index + 1}. {s.pertanyaan}
            </p>
            <div className="mt-2 space-y-1.5">
              {s.pilihan.map((pilihan, i) => {
                const dipilih = jawaban[s.id] === i;
                // Setelah dinilai, tandai mana yang benar — umpan balik yang
                // membuat kuis berguna, bukan sekadar angka di akhir.
                const benar = sudahDiperiksa && i === s.jawaban_benar;
                const salah = sudahDiperiksa && dipilih && i !== s.jawaban_benar;
                return (
                  <label
                    key={`${s.id}-${i}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      mengirim && "cursor-not-allowed opacity-60",
                      benar
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : salah
                          ? "border-red-300 bg-red-50 text-red-800"
                          : "border-gray-200 hover:bg-gray-50",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${awalan}-${s.id}`}
                      checked={dipilih}
                      // Dikunci selama pengiriman: jawaban yang berubah di tengah
                      // penilaian akan dikirim setengah jalan dan tidak cocok
                      // dengan umpan balik yang ditampilkan.
                      disabled={mengirim}
                      onChange={() => setJawaban((prev) => ({ ...prev, [s.id]: i }))}
                      className="accent-[#0056D2]"
                    />
                    <span className="text-gray-700">{pilihan}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void periksa()}
          disabled={terjawab < soal.length || mengirim}
          className="cursor-pointer rounded-full bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00419e] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mengirim ? "Menyimpan…" : "Periksa jawaban"}
        </button>
        {sudahDiperiksa ? (
          <button
            type="button"
            onClick={ulangi}
            disabled={mengirim}
            className="cursor-pointer rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            Ulangi
          </button>
        ) : null}
        <span className="text-xs text-gray-500">
          {terjawab} dari {soal.length} soal terjawab
        </span>
      </div>

      {sudahDiperiksa ? (
        <div className="mt-3 space-y-2">
          <p
            role="status"
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium",
              lulusTampil ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
            )}
          >
            {/* "Lulus!" adalah klaim kelulusan yang memicu progres terverifikasi,
                jadi hanya ditampilkan saat server benar-benar sudah menyimpannya.
                Selagi menunggu atau sesudah gagal, kalimatnya adalah hasil
                latihan sementara. */}
            Nilaimu {nilaiDitampilkan}. {pesanNilai}
          </p>

          {/* Satu tempat yang menjawab "nilai ini tersimpan di mana?". Sebelum
              perubahan ini, jawabannya tersirat dan salah; sekarang eksplisit:
              pratinjau tidak menyimpan, dan kegagalan penyimpanan terlihat. */}
          {konteks ? (
            <p
              role={server.fase === "gagal" ? "alert" : "status"}
              className={cn(
                "rounded-lg px-3 py-2 text-xs",
                server.fase === "gagal"
                  ? "bg-red-50 font-medium text-red-800"
                  : "bg-gray-50 text-gray-600",
              )}
            >
              {server.fase === "mengirim"
                ? "Menyimpan nilai ke server…"
                : server.fase === "sukses"
                  ? "Nilai tersimpan di server dan terbaca laporan pengajar."
                  : server.fase === "gagal"
                    ? `Nilai belum tersimpan: ${server.pesan}`
                    : null}
            </p>
          ) : (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Pratinjau: nilai tidak disimpan.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
