"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { RiArrowDownSLine, RiCheckLine } from "@remixicon/react";
import { cn } from "@/lib/utils";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import { halamanDipilih } from "@/lib/courses/halaman";
import {
  hitungItem,
  itemModul,
  modulPunyaIsi,
  silabusModul,
  type BabSilabus,
  type HitunganItem,
  type ItemModul,
} from "@/lib/courses/silabus";
import { submodulUntukModul } from "@/lib/courses/submodul";

/**
 * Dua tampilan panel silabus, sebagai nilai yang sah — bukan boolean.
 *
 * Menambah tampilan ketiga nanti (mis. pencarian) harus menjadi perubahan tipe
 * di sini, bukan boolean yang diam-diam berarti "bukan yang pertama".
 */
export type TampilanRail = "modul" | "semua";

/**
 * Peta modul reader — **dua tampilan dalam satu panel**: daftar seluruh kursus,
 * dan modul yang sedang dibuka.
 *
 * ## Kenapa dua tampilan
 *
 * Sebelumnya panel ini selalu memuat **semua** modul sekaligus, dan membentangkan
 * satu modul menampilkan seluruh halamannya sebagai daftar datar. Begitu tiap
 * modul punya bab, daftar datar itu berhenti menjawab pertanyaan yang sebenarnya
 * ditanyakan peserta saat membaca: *"saya sedang di bagian mana, dan apa lagi isi
 * bagian ini?"* — pertanyaan yang butuh tingkat bab, bukan sekadar daftar.
 *
 * Karena itu saat sebuah modul dibuka, panelnya **menyempit ke modul itu**:
 *
 * 1. **Judul panel menjadi nama modul yang dibuka.** Itu judul yang benar untuk
 *    isinya — yang dirender di bawahnya memang bab-bab modul itu, bukan kursus.
 *    Judulnya **bukan** milik rail: ia hidup di kepala panel (`IsiPanelSilabus`),
 *    yang juga memegang pintu "Semua modul". Rail hanya memuat isinya, jadi satu
 *    panel tidak pernah punya dua judul dengan teks yang sama.
 * 2. **Isinya daftar bab** (sub-modul).
 * 3. **Tiap bab bisa dibentangkan** dan menampilkan halaman-halamannya.
 *
 * Daftar seluruh modul tidak hilang — ia jadi **tampilan pertama**, yang dicapai
 * lewat pintu "Semua modul" di kepala panel. Itu juga yang menjaga janji rail
 * lama: peta kemajuan tetap bisa dilihat tanpa keluar dari reader. Yang berubah
 * hanya defaultnya — saat membaca, yang paling berguna adalah modul yang sedang
 * dibaca, bukan daftar seluruh kursus.
 *
 * ## Halaman sebagai tautan, bukan state
 *
 * Sub-item halaman menautkan ke `?halaman=<id>`, bukan memanggil callback.
 * Tautan punya dua sifat yang tidak dimiliki state: bisa dibagikan, dan tombol
 * kembali peramban bekerja. Pager di pane modul memakai bentuk yang sama, jadi
 * tidak ada dua cara berpindah halaman.
 *
 * ## Bab yang sedang dibaca dibentangkan sejak awal
 *
 * Bab yang memuat `?halaman=` dimulai terbuka, sehingga penanda "kamu di sini"
 * terlihat tanpa satu klik lagi. Tanpa itu, deep link ke sebuah halaman
 * mendaratkan peserta pada bab yang tertutup — halaman yang benar, peta yang
 * salah.
 *
 * ## `ringkas`
 *
 * Bentuk ciut: lencana + judul, tanpa meta dan **tanpa pembentangan** — di 104px
 * tidak ada ruang untuk sub-item, dan sub-item yang terpotong lebih buruk
 * daripada tidak ada. Karena itu barisnya tetap tautan langsung ke modulnya:
 * membentang tidak mungkin, jadi membiarkannya sebagai tombol akan membuat rail
 * ciut menjadi jalan buntu (tidak ada satu pun cara membuka sebuah modul).
 * Isinya tetap daftar modul yang **sama** — `ringkas` tidak menyaring apa pun.
 */
export function MateriRail({
  slug,
  modul,
  modulAktif,
  selesai,
  halamanAktif,
  ringkas = false,
  tampilan,
  onTampilan,
  onNavigasi,
  aksi,
}: {
  slug: string;
  modul: ModulKursus[];
  /** Id modul yang sedang dibuka — panel menyempit ke modul ini sejak awal. */
  modulAktif: string;
  /** Id modul yang sudah selesai; dari server, bukan dihitung di sini. */
  selesai: string[];
  /**
   * Id halaman yang sedang dibaca (`?halaman=`), bila ada.
   *
   * Dipakai untuk menandai **satu** baris sub-item "kamu di sini" dan untuk
   * membentangkan bab yang memuatnya sejak awal. `undefined` (dan id yang sudah
   * tidak ada) berarti halaman **pertama** — keputusan yang sama yang dipakai
   * pane, karena keduanya lewat `halamanDipilih()`.
   */
  halamanAktif?: string;
  /** Bentuk ciut: hanya lencana + judul, tanpa meta dan tanpa pembentangan. */
  ringkas?: boolean;
  /**
   * Tampilan yang aktif — **dikendalikan panel, bukan state lokal rail**.
   *
   * Sejak pintu "Semua modul" pindah ke kepala panel (di atas judul kursus),
   * kepala itulah yang harus tahu tampilan mana yang sedang berlaku; state yang
   * tinggal di sini akan membuat kepala dan isi panel bisa berbeda pendapat
   * tanpa error apa pun. Jadi rail menerimanya sebagai prop.
   */
  tampilan: TampilanRail;
  /** Ganti tampilan — panel yang menyimpannya, rail yang memintanya. */
  onTampilan: (tampilan: TampilanRail) => void;
  /**
   * Dipanggil saat sebuah tautan di dalam rail ditekan.
   *
   * Panel silabus yang membukanya harus **menutup diri**: ia menutupi seluruh
   * layar, dan berpindah halaman masih berada di pathname yang sama, sehingga
   * penutupan otomatis "pindah modul" di `materi-shell.tsx` tidak menyala —
   * peserta akan mendarat di halaman baru dengan panelnya masih menutupi.
   */
  onNavigasi?: () => void;
  /**
   * Slot aksi di rail — tombol ciut/bentang milik shell.
   *
   * Ditaruh di sini, bukan sebagai elemen terpisah di atas `<nav>`, karena
   * tempatnya memang **di dalam panel**: ia satu-satunya jalan membuka kembali
   * rail yang sudah ciut, jadi ia tidak boleh ikut menghilang bersama ruang
   * yang dikorbankan.
   *
   * Sejak judul modul pindah ke kepala panel, baris ini **hanya** memuat `aksi`;
   * ia tidak dirender sama sekali saat tidak ada aksi, supaya daftar bab tidak
   * diawali baris kosong. Panel silabus reader tidak mengirim `aksi`, jadi di
   * sana daftarnya langsung mulai dari bab pertama.
   */
  aksi?: ReactNode;
}) {
  const setSelesai = new Set(selesai);
  const modulDibuka = modul.find((m) => m.id === modulAktif) ?? null;

  /**
   * Halaman yang **benar-benar** dirender pane — hasil `halamanDipilih()`, bukan
   * `halamanAktif` mentah.
   *
   * Dihitung sekali di sini, bukan dibandingkan per baris, karena aturan "id
   * basi → halaman pertama" hanya boleh ada di satu tempat (`halaman.ts`). Kalau
   * rail membandingkan `halamanAktif` mentah, id yang sudah dihapus admin akan
   * membuat **tidak ada** baris tersorot, sementara pane tetap menampilkan
   * halaman pertama — panel dan pane menjawab berbeda tanpa error apa pun.
   */
  const halamanTerpilih = modulDibuka ? halamanDipilih(modulDibuka, halamanAktif)?.id : undefined;

  /**
   * Bab yang sedang dibentangkan — **akordeon, satu per waktu**.
   *
   * Dimulai dari bab yang memuat halaman yang sedang dibaca, sehingga penanda
   * "kamu di sini" langsung terlihat: deep link ke sebuah halaman mendarat dengan
   * babnya sudah terbuka, bukan halaman yang benar di balik bab yang tertutup.
   *
   * Disimpan sebagai id, bukan peta boolean: keadaan yang sah hanyalah "tidak ada
   * yang terbuka" atau "satu bab terbuka".
   */
  const [babDibuka, setBabDibuka] = useState<string | null>(() =>
    babHalamanTerpilih(modulDibuka, halamanTerpilih),
  );
  const bentangBab = (id: string) => setBabDibuka((kini) => (kini === id ? null : id));

  /**
   * Akordeonnya **mengikuti modul yang baru** saat modulnya berganti.
   *
   * Sejak peserta bisa berpindah modul dari dalam panel (pilih modul di daftar
   * "Semua modul"), akordeon yang dibiarkan menunjuk bab modul lama akan
   * mendaratkan mereka di modul baru dengan **tidak ada** bab yang terbuka —
   * panel yang tampak kosong, padahal isinya ada. Id bab sudah pasti tidak
   * bertabrakan antar-modul, jadi tanpa penyelarasan ini gejalanya senyap:
   * tidak ada error, hanya daftar terlipat semua.
   *
   * Diselaraskan **saat render** (pola "sesuaikan state saat prop berubah"),
   * sama seperti `materi-shell.tsx` — `setState` sinkron di dalam effect ditolak
   * lint repo ini.
   */
  const [modulSebelumnya, setModulSebelumnya] = useState(modulDibuka?.id ?? null);
  if (modulSebelumnya !== (modulDibuka?.id ?? null)) {
    setModulSebelumnya(modulDibuka?.id ?? null);
    setBabDibuka(babHalamanTerpilih(modulDibuka, halamanTerpilih));
  }

  if (ringkas) {
    return (
      <nav aria-label="Daftar modul" className="flex flex-col gap-1">
        <div className="flex items-center justify-center pb-1">{aksi}</div>
        <ol className="flex flex-col gap-0.5">
          {modul.map((m, index) => (
            <li key={m.id}>
              <Link
                href={`/belajar/${slug}/materi/${m.id}`}
                aria-current={m.id === modulAktif ? "page" : undefined}
                title={`${index + 1}. ${m.judul}`}
                className={gayaBaris(true, m.id === modulAktif)}
              >
                <LencanaModul
                  lencana={lencanaModul(m, modulAktif, setSelesai)}
                  nomor={index + 1}
                  sudah={setSelesai.has(m.id)}
                  ringkas
                />
                <BarisModul
                  judul={m.judul}
                  ringkas
                  aktif={m.id === modulAktif}
                  sudah={setSelesai.has(m.id)}
                  meta={null}
                />
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label={tampilan === "modul" && modulDibuka ? modulDibuka.judul : "Daftar modul"}>
      {tampilan === "modul" && modulDibuka ? (
        <TampilanModul
          slug={slug}
          modulDibuka={modulDibuka}
          babDibuka={babDibuka}
          onBentangBab={bentangBab}
          halamanTerpilih={halamanTerpilih}
          selesai={setSelesai}
          onNavigasi={onNavigasi}
          aksi={aksi}
        />
      ) : (
        <TampilanSemua
          slug={slug}
          modul={modul}
          modulAktif={modulAktif}
          selesai={setSelesai}
          onBukaModul={() => onTampilan("modul")}
          aksi={aksi}
        />
      )}
    </nav>
  );
}

/**
 * Bab yang memuat sebuah halaman, atau `null` bila tidak ada / halamannya tidak
 * diketahui.
 *
 * Dipakai dua kali dengan maksud yang sama — saat mount dan saat modulnya
 * berganti — jadi ia tinggal di sini, bukan disalin ke kedua tempat. Salinan
 * yang menyimpang akan membuat deep link dan perpindahan modul berperilaku
 * berbeda untuk keadaan yang sama.
 */
function babHalamanTerpilih(
  modul: ModulKursus | null,
  halamanId: string | undefined,
): string | null {
  if (!modul || !halamanId) return null;
  return (
    modul.submodul?.find((s) => (s.halaman ?? []).some((h) => h.id === halamanId))?.id ?? null
  );
}

/** Warna lencana modul — dipakai bentuk penuh dan bentuk ciut, satu definisi. */
function lencanaModul(m: ModulKursus, modulAktif: string, selesai: Set<string>): string {
  return cn(
    "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
    selesai.has(m.id)
      ? "bg-emerald-500 text-white"
      : m.id === modulAktif
        ? "bg-[#0056D2] text-white"
        : "bg-gray-100 text-gray-500",
  );
}

/**
 * Tampilan "seluruh kursus": daftar setiap modul.
 *
 * Tiap baris adalah **tautan** ke reader modulnya (bukan tombol pembentang):
 * menekannya berarti berpindah modul, dan panelnya menyusul ke tampilan modul.
 *
 * ## Barisnya **tidak** menutup panel
 *
 * Dulu baris ini memanggil `onNavigasi` (yang berarti "tutup panel") karena
 * panel setinggi layar hanya punya satu arti saat itu: pilih modul, lalu
 * tinggalkan panel untuk membacanya. Sejak panel punya tampilan per-modul, ada
 * langkah yang lebih berguna di antara keduanya — memperlihatkan bab modul yang
 * baru dipilih — dan menutup panel justru **melewatinya**. Jadi baris ini
 * berpindah modul dan membiarkan panel terbuka.
 *
 * `onNavigasi` tetap dipakai sub-item halaman dan pintu "Buka materi": keduanya
 * berarti "saya mau membaca", bukan "saya sedang menelusuri".
 */
function TampilanSemua({
  slug,
  modul,
  modulAktif,
  selesai,
  onBukaModul,
  aksi,
}: {
  slug: string;
  modul: ModulKursus[];
  modulAktif: string;
  selesai: Set<string>;
  onBukaModul: () => void;
  aksi?: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-1 px-2 pb-1">
        <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
          Daftar modul
        </p>
        {aksi}
      </div>
      <ol className="flex flex-col gap-0.5">
        {modul.map((m, index) => {
          const aktif = m.id === modulAktif;
          const sudah = selesai.has(m.id);
          const punyaIsi = modulPunyaIsi(m);
          const item = punyaIsi ? itemModul(m) : null;

          return (
            <li key={m.id}>
              <Link
                href={`/belajar/${slug}/materi/${m.id}`}
                // Menekan modul di daftar ini membawa panel ke tampilan modul,
                // dan **tidak** menutupnya. Navigasi tetap terjadi (URL
                // berpindah, pane ikut berubah), jadi rail dan pane tidak bisa
                // menunjuk modul yang berbeda.
                onClick={onBukaModul}
                aria-current={aktif ? "page" : undefined}
                className={gayaBaris(false, aktif)}
              >
                <LencanaModul
                  lencana={lencanaModul(m, modulAktif, selesai)}
                  nomor={index + 1}
                  sudah={sudah}
                  ringkas={false}
                />
                <BarisModul
                  judul={m.judul}
                  ringkas={false}
                  aktif={aktif}
                  sudah={sudah}
                  meta={
                    <BarisMetaModul
                      durasiMin={m.durasi_min}
                      hitung={hitungItem(item ?? [])}
                      sudah={sudah}
                    />
                  }
                />
                <RiArrowDownSLine
                  className="mt-0.5 size-4 shrink-0 -rotate-90 text-gray-300"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * Tampilan "modul yang dibuka": bab-bab modul, dengan halamannya.
 *
 * Nama modul **bukan** judul di sini — ia hidup di kepala panel
 * (`IsiPanelSilabus`), yang memilihnya saat panel menyempit. Rail hanya memuat
 * isinya (daftar bab), jadi tidak ada dua judul berteks sama dalam satu panel.
 *
 * Pintu kembali ke daftar seluruh kursus juga **bukan** di sini: ia tinggal di
 * kepala panel (di atas judul), tempat satu-satunya kontrol yang mengubah seluruh
 * isi panel memang berada. Menaruhnya di dua tempat akan memberi dua pintu untuk
 * satu tindakan, dan yang di dalam daftar itu terbaca sebagai bagian dari daftar.
 */
function TampilanModul({
  slug,
  modulDibuka,
  babDibuka,
  onBentangBab,
  halamanTerpilih,
  selesai,
  onNavigasi,
  aksi,
}: {
  slug: string;
  modulDibuka: ModulKursus;
  babDibuka: string | null;
  onBentangBab: (id: string) => void;
  halamanTerpilih?: string;
  selesai: Set<string>;
  onNavigasi?: () => void;
  aksi?: ReactNode;
}) {
  const sudah = selesai.has(modulDibuka.id);
  const hrefModul = `/belajar/${slug}/materi/${modulDibuka.id}`;
  const silabus = silabusModul(modulDibuka);
  const punyaBab = submodulUntukModul(modulDibuka).length > 0;

  return (
    <>
      {/* Nama modul **tidak** diulang di sini: judul panel sudah membawanya
          (`IsiPanelSilabus` memilih nama modul saat panel menyempit). Dulu rail
          merendernya sebagai eyebrow di atas daftar, dan begitu kepala panel
          memakai nama modul yang sama, satu panel punya dua judul dengan teks
          identik — pembaca mengira salah satunya label bagian. Yang tersisa di
          baris ini hanyalah `aksi` (tombol ciut/bentang milik shell), dan ia
          hanya dirender kalau ada. */}
      {aksi ? (
        <div className="flex items-center justify-end gap-1 px-2 pb-1">{aksi}</div>
      ) : null}

      {punyaBab ? (
        <ol className="flex flex-col gap-0.5">
          {silabus.bab.map((bab, index) => (
            <ButirBab
              key={bab.id}
              bab={bab}
              nomor={index + 1}
              hrefModul={hrefModul}
              terbuka={babDibuka === bab.id}
              onBentang={() => onBentangBab(bab.id)}
              halamanTerpilih={halamanTerpilih}
              onNavigasi={onNavigasi}
            />
          ))}
        </ol>
      ) : (
        // Modul tanpa bab (turunan, atau modul tersimpan yang halamannya belum
        // dikelompokkan): daftar isinya ditampilkan seperti bentuk lama, supaya
        // modul seperti itu tidak tampak kosong.
        <ol className="flex flex-col gap-0.5">
          {silabus.bab.flatMap((s) => s.halaman).map((h) => (
            <li key={h.id}>
              <SubItem
                item={{
                  jenis: "halaman",
                  id: h.id,
                  judul: h.judul,
                  nomor: h.nomor,
                  menit: h.menit,
                }}
                href={`${hrefModul}?halaman=${encodeURIComponent(h.id)}`}
                aktif={h.id === halamanTerpilih}
                onNavigasi={onNavigasi}
              />
            </li>
          ))}
        </ol>
      )}

      {/* Kuis dan lampiran tetap milik **modul**, bukan babnya: penilaian dan
          checkpoint berhenti di tingkat modul. Ditampilkan setelah bab supaya
          urutannya sama dengan urutan baca di pane (prosa dulu, lalu asesmen,
          lalu lampiran). */}
      {silabus.kuis.length > 0 || silabus.lampiran.length > 0 ? (
        <div className="mt-1 flex flex-col gap-0.5 border-t border-gray-100 pt-1">
          {[...silabus.kuis, ...silabus.lampiran].map((it) => (
            <SubItem
              key={`${it.jenis}-${it.id}`}
              item={it}
              href={hrefModul}
              aktif={false}
              onNavigasi={onNavigasi}
            />
          ))}
        </div>
      ) : null}

      <Link
        href={hrefModul}
        onClick={onNavigasi}
        className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0056D2] hover:bg-blue-50"
      >
        Buka materi {sudah ? "(ulang)" : ""}
      </Link>
    </>
  );
}

/**
 * Satu baris bab — tombol pembentang yang menampilkan halamannya.
 *
 * Barisnya **bukan** tautan: menekannya membentangkan, tidak berpindah, karena
 * yang dicari saat menekan "Relasi" adalah "isi bab ini". Pintu masuk halaman
 * ada di dalam sub-itemnya.
 */
function ButirBab({
  bab,
  nomor,
  hrefModul,
  terbuka,
  onBentang,
  halamanTerpilih,
  onNavigasi,
}: {
  bab: BabSilabus;
  nomor: number;
  hrefModul: string;
  terbuka: boolean;
  onBentang: () => void;
  halamanTerpilih?: string;
  onNavigasi?: () => void;
}) {
  const memuatHalamanAktif = bab.halaman.some((h) => h.id === halamanTerpilih);
  // Dihitung dari indeks, bukan id: id tersimpan boleh memuat spasi, dan id
  // ber-spasi tidak sah dipakai `aria-controls`.
  const idPanel = `rail-bab-${bab.id}`;

  return (
    <li>
      <button
        type="button"
        onClick={onBentang}
        aria-expanded={terbuka}
        aria-controls={idPanel}
        aria-current={memuatHalamanAktif ? "true" : undefined}
        className={cn(
          "flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm",
          memuatHalamanAktif ? "bg-blue-50 text-[#0056D2]" : "text-gray-700 hover:bg-gray-50",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-lg text-[10px] font-bold",
            memuatHalamanAktif ? "bg-[#0056D2] text-white" : "bg-gray-100 text-gray-500",
          )}
        >
          {nomor}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className={cn("block leading-snug", memuatHalamanAktif && "font-semibold")}>
            {bab.judul}
          </span>
          <span className="mt-0.5 block text-[11px] text-gray-500">
            {bab.halaman.length} halaman
          </span>
        </span>
        <RiArrowDownSLine
          className={cn(
            "mt-0.5 size-4 shrink-0 text-gray-400 transition-transform duration-200",
            terbuka && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {terbuka ? (
        // `ml-8` menyejajarkan judul halaman dengan judul babnya: 10px padding +
        // 20px lencana + 10px gap = 40px, dan 32px + 8px = 40px. Sub-item yang
        // tidak sejajar terbaca sebagai tingkat yang berbeda dari yang dimaksud.
        <div id={idPanel} className="mt-0.5 mb-1 ml-8 flex flex-col gap-0.5">
          {bab.halaman.length === 0 ? (
            <p className="px-2 py-1.5 text-[12px] text-gray-400">Belum ada halaman.</p>
          ) : (
            bab.halaman.map((h) => (
              <SubItem
                key={h.id}
                item={{
                  jenis: "halaman",
                  id: h.id,
                  judul: h.judul,
                  nomor: h.nomor,
                  menit: h.menit,
                }}
                href={`${hrefModul}?halaman=${encodeURIComponent(h.id)}`}
                aktif={h.id === halamanTerpilih}
                onNavigasi={onNavigasi}
              />
            ))
          )}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Gaya satu baris modul, satu tempat untuk kedua bentuk.
 *
 * `ringkas` bukan daftar lain: ia baris yang **sama**, dibaca di 104px. Karena
 * itu perbedaannya hanya susunan (kolom, terpusat) — warna keadaan aktif,
 * hover, dan lencananya tetap sama, dan itulah yang membuat keduanya tidak bisa
 * berbeda status.
 */
function gayaBaris(ringkas: boolean, aktif: boolean): string {
  return cn(
    ringkas
      ? "flex w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center"
      : "flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm",
    aktif ? "bg-blue-50 text-[#0056D2]" : "text-gray-700 hover:bg-gray-50",
  );
}

/**
 * Lencana nomor/centang.
 *
 * `aria-hidden` di kedua bentuk: nomornya sudah dibawa teks meta sub-item, dan
 * status selesai dibawa kata "Selesai" — membiarkannya terbaca hanya menambah
 * "1 2 3" tanpa arti bagi pembaca layar.
 */
function LencanaModul({
  lencana,
  nomor,
  sudah,
  ringkas,
}: {
  lencana: string;
  nomor: number;
  sudah: boolean;
  ringkas: boolean;
}) {
  return (
    <span aria-hidden="true" className={ringkas ? lencana : cn(lencana, "mt-0.5")}>
      {sudah ? <RiCheckLine className="size-3" /> : nomor}
    </span>
  );
}

/**
 * Judul modul, dengan baris meta di bawahnya pada bentuk penuh.
 *
 * "Selesai" ditulis **di sini**, bukan di `BarisMetaModul`: bentuk ciut tidak
 * punya baris meta sama sekali, dan status itu tetap harus terbaca — centangnya
 * `aria-hidden`, jadi tanpa kata ini pembaca layar kehilangan status yang justru
 * alasan rail ini ada.
 */
function BarisModul({
  judul,
  ringkas,
  aktif,
  sudah,
  meta,
}: {
  judul: string;
  ringkas: boolean;
  aktif: boolean;
  sudah: boolean;
  meta: ReactNode;
}) {
  if (ringkas) {
    return (
      <span
        className={cn(
          "line-clamp-2 w-full text-center text-[10px] leading-tight font-medium tracking-tight",
          aktif && "font-semibold",
        )}
      >
        {judul}
        {sudah ? <span className="sr-only"> · Selesai</span> : null}
      </span>
    );
  }

  return (
    <span className="min-w-0 flex-1 text-left">
      <span className={cn("block leading-snug", aktif && "font-semibold")}>{judul}</span>
      {meta}
    </span>
  );
}

/**
 * Baris meta modul: durasi, jumlah isi, dan status selesai.
 *
 * `hitung` boleh `null` untuk modul yang **tidak punya isi** (modul turunan):
 * yang tersisa di baris itu hanya durasinya, tanpa klaim "0 halaman" yang tidak
 * memberi tahu apa pun.
 */
function BarisMetaModul({
  durasiMin,
  hitung,
  sudah,
}: {
  durasiMin: number;
  hitung: HitunganItem | null;
  sudah: boolean;
}) {
  const bagian = [
    `${durasiMin} mnt`,
    hitung && hitung.halaman > 0 ? `${hitung.halaman} halaman` : null,
    hitung && hitung.lampiran > 0 ? `${hitung.lampiran} lampiran` : null,
    hitung && hitung.kuis > 0 ? `${hitung.kuis} kuis` : null,
    sudah ? "Selesai" : null,
  ].filter(Boolean);

  return <span className="mt-0.5 block text-[11px] text-gray-500">{bagian.join(" · ")}</span>;
}

/**
 * Satu baris sub-item: halaman, kuis, atau lampiran.
 *
 * Ketiganya dirender sebagai tautan meski hanya halaman yang punya alamat
 * sendiri: kuis dan lampiran hidup di pane yang sama dengan halamannya, jadi
 * tujuannya adalah modulnya. Menjadikannya tombol mati akan menyembunyikan
 * fakta bahwa modul ini memang punya kuis.
 */
function SubItem({
  item,
  href,
  aktif,
  onNavigasi,
}: {
  item: ItemModul;
  href: string;
  aktif: boolean;
  onNavigasi?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigasi}
      aria-current={aktif ? "page" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
        aktif ? "bg-blue-50 text-[#0056D2]" : "text-gray-600 hover:bg-gray-50",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className={cn("block leading-snug", aktif && "font-semibold")}>{item.judul}</span>
        <span className="mt-0.5 block text-[11px] text-gray-400">{metaItem(item)}</span>
      </span>
    </Link>
  );
}

/**
 * Meta satu sub-item, satu tempat.
 *
 * "≈" pada halaman itu disengaja dan bukan hiasan: angkanya perkiraan turunan
 * dari jumlah kata, bukan durasi yang diukur maupun data yang disimpan admin.
 * Menuliskannya tanpa penanda akan menjanjikan ketepatan yang tidak dimilikinya.
 */
function metaItem(item: ItemModul): string {
  switch (item.jenis) {
    case "halaman":
      return `Halaman ${item.nomor} · ≈${item.menit} mnt`;
    case "kuis":
      return `Kuis · ${item.jumlahSoal} soal`;
    case "lampiran":
      return item.tipe === "video" ? "Video" : "PDF";
  }
}
