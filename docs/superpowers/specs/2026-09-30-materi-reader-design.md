# Materi Reader — desain

**Tanggal:** 2026-09-30
**Status:** draft untuk implementasi
**Konteks:** `src/components/features/learning/detail-kursus.tsx`,
`src/components/features/learning/course-session.tsx`,
`src/lib/learning/{akses,session}.ts`, `src/app/(focus)/`, `docs/adr/0003`.

---

## 1. Masalah

Halaman `/belajar/[slug]` hari ini mengerjakan **tiga pekerjaan sekaligus** dalam
satu dokumen 894 baris: hero pemasaran, silabus, dan permukaan baca yang
sesungguhnya. Tombol **"Buka materi"** (`detail-kursus.tsx:579`) membuka isi modul
*inline* lewat state `modulTerbuka`, sehingga membaca satu kursus 5 modul berarti
menggulir dokumen yang juga memuat kotak sertifikat, tabel integritas, panel
Project, dan daftar kursus terkait.

Akibatnya:

- **Tidak ada permukaan baca yang fokus.** Prosa halaman (`HalamanView`) bersaing
  dengan empat panel lain di dokumen yang sama.
- **Satu modul terbuka pada satu waktu.** Membandingkan modul 2 dan modul 4 berarti
  membuka-tutup-buka.
- **Tidak ada URL per modul.** Modul tidak bisa ditautkan, di-bookmark, atau
  dilanjutkan dari tempat terakhir; "Lanjutkan belajar" hanya melompat ke
  `#kurikulum` (`detail-kursus.tsx:726`, `kursus-subnav.tsx:78`).
- **Tidak ada peta kemajuan yang menetap.** Saat membaca, daftar modul tidak
  terlihat.

Platform acuan (Coursera, Codecademy, Dicoding) memisahkan dua hal ini: halaman
kursus adalah **silabus**, dan menekan satu modul membuka **pemutar dengan
outline yang menetap di sisi kiri**.

## 2. Yang sudah ada dan dipakai ulang

Desain ini **tidak menyentuh mesin akses**. Semua keputusan otoritatif tetap di
tempatnya; yang berubah hanya rumah bagi komponennya.

| Yang dipakai ulang | Lokasi | Peran di reader |
|---|---|---|
| `putuskanAkses` / `boleh()` | `src/lib/learning/akses.ts` | Gerbang `materi`, `kuis`, `bantuan_akademik` |
| `CourseSessionGate` / `Prompt` | `course-session.tsx` | Gerbang (`boleh(...) === false`) dan ajakan memulai sesi |
| `KejadianPanel` | `kejadian-panel.tsx` | **Satu-satunya** permukaan status sesi: kepala ringkas + catatan yang bisa dibuka (§3.3a) |
| `HalamanView` | `halaman-view.tsx` | Prosa + pager `?halaman=` |
| `MateriView` | `materi-view.tsx` | Lampiran video/PDF |
| `KuisView` | `kuis-view.tsx` | Asesmen (dinilai server) |
| `selesaikanMateriAction` | `src/actions/learning.ts:228` | Satu-satunya jalur penyelesaian terverifikasi |
| `tandaiModulAction` | `src/actions/enrollment.ts:169` | Jalur penyelesaian informal |
| `modulUntukSumber` | `modul-resolver.ts` | Resolver modul tunggal |
| `(focus)/layout.tsx` | `src/app/(focus)/layout.tsx` | Gerbang sesi + onboarding |

`HalamanView`'s pager sudah memakai tautan **relatif** (`?halaman=<id>`,
`halaman-view.tsx:217`), jadi ia bekerja di route reader tanpa perubahan.

## 3. Keputusan

### 3.1 Route dan shell

```
src/app/(focus)/belajar/[slug]/materi/layout.tsx       ← shell: rail + bar fokus + drawer + sesi
src/app/(focus)/belajar/[slug]/materi/[modulId]/page.tsx ← hanya pane modul
```

- Berada di grup **`(focus)`**, sehingga `(focus)/layout.tsx` menyediakan gerbang
  sesi + onboarding. Halaman hanya membaca data. Ini **bukan preseden baru**:
  `/belajar/mastery`, `/belajar/buku`, `/belajar/latihan` sudah memakai pengecualian
  yang sama, dan AGENTS.md mencatatnya sebagai pengecualian yang disengaja.
- **Shell tinggal di `layout.tsx`, bukan di `page.tsx`.** Layout Next.js bertahan
  lintas perubahan child-route, jadi berpindah modul 1 → modul 4 **tidak**
  me-remount rail, provider sesi, atau iframe tutor. Kalau shell ada di `page.tsx`,
  setiap klik modul memuat ulang iframe dan memutus WebSocket di tengah giliran —
  ini jebakan yang sengaja dirancang keluar, bukan detail gaya.
- Reader memakai **shell-nya sendiri**, bukan `LearnerShell`: `h-dvh overflow-hidden
  flex flex-col`, tanpa `.chrome`. Ini pola yang sudah ada di **reader ter-dock**
  repo ini (`book-reader.tsx:31`), bukan `min-h-dvh` milik `latihan-view.tsx:133` /
  `book-library.tsx:33`.
  **Kenapa terbatas tinggi, bukan `min-h-dvh`:** dengan `min-h-dvh` tidak ada yang
  membatasi baris flex di bawah bar fokus, jadi modul yang lebih tinggi dari
  viewport membuat baris itu tumbuh setinggi isinya — rail dan pane ikut setinggi
  modul (`overflow-y-auto` keduanya jadi hampa; yang menggulir dokumen), dan
  `TutorDrawer` yang ter-dock di `xl` (saudara flex di baris yang sama, §3.7) juga
  setinggi itu. Akar `h-dvh` aplikasi AI Mastery di dalam iframe mengikuti tinggi
  aside-nya, sehingga daftar pesannya tidak pernah menggulir dan **composer tutor
  berakhir ribuan piksel di bawah** — tidak terjangkau selama membaca bagian atas
  modul. Diukur di Chrome headless 1440×900 dengan pane 2600px:
  `docScrollHeight=2680 aside clientHeight=2600 composerTop=2566`. Di bawah `xl`
  drawer adalah lembar `fixed`, jadi masalahnya khusus `xl` ke atas. `h-dvh
  overflow-hidden` memindahkan gulir ke baris; rantai `min-h-0` di bawahnya wajib
  utuh supaya kolom-kolom flex benar-benar bisa menyusut.
- **Latar halaman biru, kartu putih.** Shell reader memakai `.reader-shell`
  (`--reader-canvas`), dan semua isinya — kartu materi, rail, strip sesi,
  drawer tutor — tetap `--card` putih di atasnya. Bar fokus juga putih
  (`--wing-fill: var(--card)`): memberi bar warna kanvas yang sama dengannya
  menggabungkan bar dan halaman jadi satu bidang, dan bar-nya sendiri berhenti
  terbaca sebagai bar.
- Bar fokus: `sticky top-0`, `border-b`, memuat **← Silabus · judul kursus · tombol
  tutor · "Tandai selesai"**. Karena bar ini di `top-0` (bukan di bawah
  navbar mengambang), ia **tidak** membutuhkan offset `--chrome-h` dan tidak boleh
  memperkenalkan `-mt-[Npx]` — `chrome-offset.test.ts` akan gagal kalau begitu.
- **Tidak ada permukaan sesi di bar fokus.** Bar `sticky`, jadi apa pun yang
  tinggal di dalamnya ikut mengambang sepanjang modul: kartu amber setinggi
  beberapa baris menutupi judul modul tepat saat peserta membacanya. Yang boleh
  tinggal di bar hanya baris **satu kalimat** yang menyertain aksi di bar itu
  sendiri — penolakan completion dari server (`pesan`) dan alasan tutor ditolak.
- **`CourseSessionPrompt` (kartu verifikasi kuning) duduk di kolom baca, tepat di
  atas kartu materi** — bukan di dalam bar fokus, dan bukan di panel terpisah di
  shell. Jaraknya dari `space-y-6` pembungkus kolom baca, **bukan** `mb` pada
  elemennya: course `opsional` membuat komponen itu mengembalikan `null`, dan
  `mb` yang menempel padanya akan menyisakan rongga kosong di atas kartu pertama.
- **Status sesi yang sedang berjalan tidak di bar fokus**, melainkan di strip sesi
  `KejadianPanel` di atas pane (§3.3a). Bar ini `sticky`, dan apa pun yang tinggal di
  dalamnya ikut mengambang sepanjang modul. `CourseSessionPrompt` menyembunyikan
  dirinya begitu sesi `aktif`, jadi keduanya tidak pernah tampil bersamaan.
- **Pemicu silabus + progres di ujung kiri bar fokus** (`reader-silabus.tsx`,
  `ReaderSilabusLeading`), mengikuti referensi: ikon menu, lalu nama kursus dengan
  bit progres di bawahnya — satu bit per modul, `aria-hidden`, dengan kalimat
  `sr-only` yang menyebut angkanya. Bar fokus adalah satu-satunya bagian layar
  yang selalu terlihat, jadi peta "di mana saya, sisa berapa" tinggal di sana.
- **Daftar modul hidup di panel silabus setinggi layar**, bukan di kolom rail.
  Panelnya `position: fixed` setinggi `100dvh`, menutupi bar fokus sekaligus, dan
  dibuka dari tombol paling kiri bar. Ia memuat **seluruh** modul kursus beserta
  sub-itemnya (halaman, lampiran, kuis) dan tanda centang per modul, plus kepala
  yang mengulang judul/penyedia/progres dan CTA ke modul berikutnya yang belum
  selesai.
- **Tidak ada rail permanen lagi.** Dulu ada kolom rail `lg:` **dan** panel bawah
  `lg`; keduanya digantikan satu panel. Dua daftar modul di satu layar adalah
  penyimpangan yang harus dijaga sinkron tanpa alasan — dan itulah yang dihapus.
  Daftarnya tetap komponen `MateriRail` yang sama, jadi tidak ada salinan kedua
  dari komponennya; yang dihapus hanya rumah keduanya.
- **Panelnya `portal` ke `<body>`**, bukan anak bar: bar fokus ber-`z-index: 30`,
  jadi sebagai anak bar `z-index` panelnya hanya berlaku di dalam konteks itu dan
  ia tidak akan pernah bisa menutupi bar yang melahirkannya. Ia diparkir di
  `z-index: 90` — di atas scrim drawer tutor (`z-30`) dan dock-nya (`z-40`), di
  bawah `.skip-link` (100). Perilaku papan ketiknya mengikuti
  `mobile-nav-drawer.tsx`: Escape menutup, Tab terjerat, `overflow` bodi dikunci,
  fokus kembali ke tombol pemicu.

### 3.1a Panel silabus — satu daftar modul, bukan dua

Panelnya menggantikan rail, jadi ia harus membawa seluruh yang dulu dibawa rail
tanpa menambah daftar kedua:

- **Satu sumber daftar.** Panel merender `MateriRail`, komponen yang sama yang
  dulu dipakai rail — bukan salinan kedua yang bisa menyimpang.
- **Status selesai tetap terbaca.** Tiap baris menandai modulnya sendiri; modul
  yang sedang dibuka ditandai `aria-current="page"`.
- **Konteknya tidak hilang saat panel menutupi bar.** Kepala panel mengulang
  judul kursus, penyedia, dan progresnya (bit versi `is-besar`, dibaca dari jarak
  layar penuh), karena panelnya menutupi bar yang memuat salinan kecilnya.
- **Fokusnya dikembalikan.** Saat panel ditutup — lewat Escape, scrim, atau CTA —
  fokus kembali ke tombol pemicu di bar, supaya pembaca layar tidak kehilangan
  tempatnya. Panelnya juga tertutup otomatis saat berpindah modul, karena shell
  hidup di `layout.tsx` dan tidak di-remount.

Status buka/tutupnya hidup di shell (`materi-shell.tsx`), bukan di panelnya:
portal hidup di luar bar, jadi ia tidak bisa menyimpan state-nya sendiri. Karena
shell hidup di `layout.tsx`, keadaan itu **bertahan saat berpindah modul** — tapi
tidak bertahan selepas muat ulang halaman.
- Pane utama: satu modul — halaman (dengan pager), lalu lampiran, lalu kuis, masing
  masing di belakang gerbangnya sendiri. **Tutor AI tidak di sini** — ia pindah ke
  drawer (§3.7).

**Id modul** aman di URL: modul tersimpan punya id sendiri, modul turunan memakai
`${courseId}-m1`…`-m5` (`kurikulum.ts:124`). `modulId` yang tidak ada di kurikulum
kursus itu → `notFound()`.

**Kursus tanpa modul tersimpan** (tanpa `materi`/`halaman`/`kuis`) tidak berpura-pura
punya isi: reader menampilkan ringkasan modul + CTA tautan eksternal (`m.url`),
persis perilaku lama.

### 3.2 Kontinuitas sesi — risiko utama

`CourseSessionProvider` menyimpan `bukti`/`runId` **di state React**
(`course-session.tsx:166–170`), dan provider itu di-mount di dalam `DetailKursus`
— yaitu **per halaman**. Berpindah dari silabus ke route reader akan meng-unmount
provider dan **kehilangan sesi terverifikasi yang sedang berjalan**. Peserta yang
sedang di tengah sesi akan mendarat di reader tanpa bukti, gerbang menutup lagi,
dan modul tampak mustahil diselesaikan.

Perbaikannya murah karena **`buktiBaru` adalah tanda tangan murni atas
`(courseId, owner, policyVersion)`** (`session.ts:119`), bukan token acak:

```
server reader: cariRunAktif({ courseId, owner })   → session.ts:336
               ambilRun(id)                        → session.ts:213
               kedaluwarsa(run)?                   → session.ts:185
                 ya  → tidak ada sesi (gerbang tampil)
                 tidak → buktiBaru({ courseId, owner, policyVersion })
```

Karena `policyVersion` diambil dari kebijakan kursus yang sama, tanda tangan yang
dihasilkan **identik** dengan yang dikeluarkan `mulaiSesiAction`. Reader lalu
men-seed provider dengan `bukti` + `runId` itu, sehingga navigasi silabus ↔ reader
mempertahankan **satu** sesi alih-alih bercabang.

Perubahan pada `CourseSessionProvider`: dua prop opsional `buktiAwal` /
`runIdAwal` (dan `kejadianAwal`), dipakai sebagai nilai awal `useState`. Tanpa prop
itu perilakunya persis seperti sekarang, jadi pemanggil lama tidak berubah.

**Dua lapis, bukan satu.** Shell di `layout.tsx` (§3.1) sudah membuat navigasi
**di dalam** reader (modul 1 → modul 4) mempertahankan sesi secara struktural —
provider tidak pernah di-unmount. Seed server di atas menutup sisa kasusnya:
**muat ulang halaman** dan **deep link langsung** ke satu modul, di mana tidak ada
state klien yang bisa diwarisi. Keduanya dibutuhkan; yang pertama tidak menggantikan
yang kedua.

**Yang tidak berubah:** `putuskanAkses` tetap satu-satunya mesin keputusan, tetap
murni, tetap dipakai klien dan server. Gerbang di reader **tidak lebih lemah**
daripada di silabus — ia memakai keputusan yang sama, hanya dirender di tempat
yang lebih terlihat.

### 3.3 Isi reader dan gerbangnya

| Isi | Komponen | Gerbang |
|---|---|---|
| Prosa halaman | `HalamanView` | **bebas** — membaca bukan penyelesaian |
| Lampiran | `MateriView` | `boleh("materi")` |
| Kuis | `KuisView` | `boleh("kuis")` |
| Tutor AI | drawer + iframe (§3.7) | `boleh("bantuan_akademik")` |

Ketiga keputusan dihitung **saat render**, bukan disimpan di state — alasan yang
sama yang sudah ditulis di `detail-kursus.tsx:231`: keputusannya bergantung pada
bukti sesi yang bisa berubah kapan saja, dan menyalinnya ke state membuat gerbang
tertinggal. Pesan gerbang diambil apa adanya dari `putuskanAkses` supaya copy tidak
menyimpang dari mesin akses.

`aiCourseId` di-resolve server lewat `selaraskanKursusAi` seperti di
`belajar/[slug]/page.tsx`, dan hanya untuk peserta yang **sudah terdaftar** — sama
seperti sekarang (`detail-kursus.tsx:785`). Panel tutor tidak lagi dirender inline di
pane modul; ia menjadi drawer (§3.7).

### 3.3a Strip sesi dan catatan kejadian

`KejadianPanel` adalah **satu-satunya permukaan yang menyatakan keadaan sesi di
reader**. Ia satu komponen dengan dua bagian:

- **Kepala (selalu terlihat)** — tombol disclosure `aria-expanded`/`aria-controls`,
  berisi ikon keadaan (titik berdenyut `status-pulse` hanya saat sesi berjalan),
  judul (`Sesi terverifikasi aktif` / `… berakhir`), dan ringkasan satu baris:
  jumlah catatan, jumlah celah pengawasan, dan `LABEL_ATURAN_BANTUAN[kebijakan]`.
  Tombol "Akhiri sesi" ada **di luar** tombol disclosure — `button` bersarang tidak
  sah.
- **Isi (tertutup secara default)** — penjelasan apa yang dicatat, `fieldset`
  pelaporan kamera, tautan `/pengaturan`, dan daftar "Catatan terakhir". Dipasang
  dengan `hidden`, **bukan** render bersyarat: `aria-controls` yang menunjuk id yang
  tidak ada melanggar ARIA, dan `hidden` sekaligus mengeluarkan radio di dalamnya
  dari urutan tab.

Bentuk lamanya — panel ~390px yang selalu terbuka, di atas pane — adalah keluhan
yang memicu desain ini: isi modul terdorong ke bawah lipatan dan tidak ada cara
menutupnya. Yang dijaga oleh desain baru: ringkasannya **selalu** terbaca tanpa satu
klik pun (status, hitungan celah, aturan bantuan), sementara sisanya atas permintaan
peserta.

Aturan copy yang tidak boleh dilanggar di sini:

- Jumlah ditulis apa adanya, **termasuk nol** — "tidak ada celah" berbeda artinya dari
  "belum ada yang dicatat".
- Kata yang dipakai adalah **"catatan"** untuk total, sedangkan "kejadian" adalah nama
  salah satu klasifikasi. `ringkasanKejadian.kejadian` berarti "yang bukan celah", jadi
  mencetaknya sebagai "N kejadian" berdampingan dengan "M celah pengawasan" terbaca
  seperti dua total yang berbeda.
- Kamera **tidak** diklaim sedang dipantau: panel ini mencatat apa yang dilaporkan
  peserta, bukan gambar.

### 3.4 Penyelesaian modul

Logika dua jalur disalin **apa adanya** dari `tandai()`
(`detail-kursus.tsx:336–376`); tidak ada aturan baru:

- `wajibSesiTerverifikasi(kebijakan) && checkpointTerverifikasi(checkpointEfektif(m))`
  → `selesaikanMateriAction({ courseId, modulId, bukti })`. **Bukti kosong bukan
  alasan mengganti jalur** — server yang menolak, dan pesannya dipakai apa adanya.
  Tidak ada penulisan optimistis di jalur ini.
- Sisanya (kursus `opsional`, checkpoint `kuis`/`proyek`, atau pembatalan
  `sudah === true`) → `tandaiModulAction`.

Klien **tidak** memeriksa ada/tidaknya bukti sebelum memilih jalur — itu justru
bug yang dikomentari di `detail-kursus.tsx:319`. Server tetap otoritatif.

### 3.5 Halaman kursus menjadi silabus

- Baris modul berubah dari tombol expand menjadi `<Link href={/belajar/[slug]/materi/[id]}>`,
  menampilkan durasi, jumlah halaman/lampiran/kuis, tanda centang, dan penanda
  "Lanjutkan" pada modul pertama yang belum selesai.
- State `modulTerbuka` dan `halamanTerpilih` **dihapus**, beserta render inline
  `HalamanView`/`MateriView`/`KuisView`/`CourseSessionGate` di dalam daftar modul.
- Impor yang menjadi mati ikut dihapus (`MateriView`, `HalamanView`, `KuisView`,
  `KejadianPanel`) — `eslint` akan menandainya.
- Hero, `SertifikatPanel`, panel Project, `TabelPelanggaran`, kursus terkait:
  **tidak berubah**.
- `KursusSubNav` dan CTA sidebar "Lanjutkan belajar" berpindah dari `#kurikulum`
  ke URL reader modul pertama yang belum selesai. Kalau semua sudah selesai,
  tetap ke modul pertama ("Ulas kembali modul").

### 3.6 Revalidasi

`selesaikanMateriAction` dan `tandaiModulAction` hari ini me-revalidate
`/belajar` dan `/belajar/${slug}` (`learning.ts:392`, `enrollment.ts:254`). Route
reader adalah halaman **lain**, jadi tanpa revalidasi tambahan tanda centang di
rail bisa basi pada navigasi lunak. Kedua action ditambah
`safeRevalidate('/belajar/${slug}/materi/${modulId}')`.

Ini aditif dan aman: `safeRevalidate` sudah menelan kegagalan di luar lifecycle
request (dipakai unit test).

### 3.7 Drawer Tutor AI — tombol di bar fokus, isi dari AI Mastery

Tutor adalah **drawer dari sisi kanan**, dibuka tombol di bar fokus. Ini meniru
panel "reading companion" DeepTutor yang sudah ada di
`features/sijago/components/reading/workspace/{ReadingWorkspace,ReadingCompanion}.tsx`.
Kita **mengadaptasi mekanismenya, bukan menulis chat baru**.

#### Yang diambil dari DeepTutor, apa adanya

| Mekanisme DeepTutor | Sumber | Adaptasi Careevo |
|---|---|---|
| Kolom kanan ter-dock, drag-resize 300–640px | `ReadingWorkspace.tsx:451–458` | Sama, `xl` ke atas |
| Lebar disimpan di `localStorage` | `ReadingWorkspace.tsx:186–196` | Ide sama, kunci milik Careevo |
| Tombol header `PanelRightOpen`/`PanelRightClose` + `aria-expanded` | `ReadingWorkspace.tsx:576–593` | Dipasang di bar fokus (§3.1) |
| Di bawah `xl` jadi sheet di atas dokumen + scrim | `ReadingWorkspace.tsx:461–466` | Sama; `Escape` menutup |
| Companion **memakai ulang** komponen chat utama, tidak menulis ulang | `ReadingCompanion.tsx:5–16` | Kita lebih jauh lagi: **seluruh aplikasi chat** dipakai ulang lewat iframe |

Filosofi di `ReadingCompanion.tsx:6–12` — *"it is a chat surface first and a reading
feature second"* — justru alasan kita **tidak** menulis chat baru di Careevo. Skill
`careevo-sijago` mencatat chat buatan sendiri (`/belajar/tutor`) sudah pernah ada dan
**dihapus** dengan pesan tegas: *"do not rebuild one."*

#### Isi drawer: rute chromeless di pohon vendored

AI Mastery **selalu** merender chrome-nya sendiri: `(workspace)/layout.tsx` membungkus
anak-anaknya tanpa syarat dengan `AppShell sidebar={<WorkspaceSidebar />}`. Sidebar itu
punya lebar variabel yang bisa di-resize pengguna (`--sidebar-width`, dengan 220px
sebagai lebar mobile — `SidebarShell.tsx:256–257`). Menaruh halaman itu di drawer
300–640px berarti menaruh sidebar selebar itu **di dalam** drawer — chrome ganda,
transkrip terjepit. Jadi yang dibutuhkan satu rute **tanpa chrome**:

```
features/sijago/app/embed/chat/page.tsx     ← di luar SEMUA route group
```

Berada di luar semua route group berarti ia tidak mewarisi `AppShell` mana pun,
sehingga tidak ada sidebar. Ini **pola yang sudah ada**, bukan akal-akalan:
`features/sijago/app/handoff/page.tsx` duduk di posisi yang sama untuk alasan yang
sama.

Yang harus disediakan rute itu adalah provider yang **memang** dibutuhkan
`ChatWorkspace`, dan keempatnya sudah terbukti **tidak** bergantung pada `AppShell`:

- `CapabilityAccessProvider` — `components/access/CapabilityAccessContext.tsx`
- `ChatRuntimeProvider` — `features/chat/ChatRuntimeProvider.tsx`
- `ReadingProvider` — `context/ReadingContext.tsx`
- `WatchingProvider` — `context/WatchingContext.tsx`

`AppShellProvider` sudah dipasang di `app/layout.tsx` (root), jadi rute ini tetap
mendapatkannya tanpa sidebar. `ChatWorkspace` merender header chat-nya sendiri; yang
hilang hanya sidebar dari `AppShell` — persis yang kita mau.

**Ini menyentuh pohon vendored**, jadi gate-nya gate miliknya sendiri
(`careevo-sijago`): `cd features/sijago && npm run typecheck && npm run test:unit &&
npm run i18n:check && npm run contracts:check && npm run build`. Dan `:3790` menyajikan
`.next/standalone` — edit sumber **tidak hidup** sampai bundle di-build ulang **dan**
server `:3790` di-restart. Build saja tidak cukup: proses lama berjalan dari cwd yang
sudah dihapus.

#### URL dan kontrak deep-link

Helper baru di `src/lib/learning/tutor-ai.ts`, bersebelahan dengan
`urlFrameAiMastery` (`tutor-ai.ts:68`) yang sudah ada:

```
urlFrameTutorEmbed(baseUrl, { course, capability })
  → `${baseUrl}/embed/chat?course=<id>&capability=course_study`
```

Id kursus **di-encode** dengan alasan yang sudah tertulis di `tautanTutorAi`
(`tutor-ai.ts:34`): `courses.id` adalah `text`, jadi ia boleh memuat `&` — menempel
mentah membuat `?course=a&b` terpecah. `baseUrl` tidak valid **dilempar** (`new URL`
melempar), sama seperti `urlFrameAiMastery` (`tutor-ai.ts:65–66`): konfigurasi salah
harus gagal saat render, bukan memuat frame kosong. Helper ini murni (tanpa IO)
sehingga bisa diuji di `tutor-ai.test.ts` — vitest repo ini hanya mengimpor `.test.ts`
di environment `node`.

**Konteks yang dikirim tetap lingkup kursus, bukan modul.** Kontrak
`course_study` mengikat **id kursus**; tidak ada parameter posisi baca di
`tautanTutorAi` maupun di `urlFrameAiMastery`, dan desain ini **tidak menambahkannya**
(§4). Jadi copy drawer menyebut kursus ("Tanya materi kursus ini"), **tidak** "modul
ini" — klaim bahwa tutor tahu modul yang sedang dibaca adalah klaim yang tidak
didukung kode.

#### Gerbang tombol: kebijakan kursus, bukan checkpoint modul

| `kebijakan.aturan_bantuan` | Tombol tutor di bar fokus |
|---|---|
| `bebas` | Aktif — drawer bisa dibuka |
| `bertutor` | Aktif — drawer bisa dibuka |
| `tanpa_ai` | **Nonaktif**, dengan alasan dari `putuskanAkses` |

**Tidak ada aturan AI per modul, dan desain ini tidak menambahkannya.**
`aturan_bantuan` hidup di `KebijakanCourse` (`types/course.ts:377`); `CheckpointMateri`
— record per modul (`types/course.ts:386`) — hanya punya `batas_waktu_menit`, `mode`,
dan `ref`, **tanpa field AI**. `putuskanAkses` untuk `bantuan_akademik` membaca
kebijakan kursus saja dan tidak pernah melihat modul (`akses.ts:123`). Jadi "modul yang
mengizinkan AI" = **kursus yang mengizinkan AI**.

Konsekuensi yang harus disadari: **tutor tidak dimatikan di modul asesmen.** Modul
ber-checkpoint `kuis`/`proyek` di kursus `bertutor` tetap membuka drawer, persis
seperti hari ini. Mematikannya berdasarkan `mode` checkpoint berarti mengubah mesin
akses yang dikunci dan diam-diam mencabut fitur di kursus `bertutor` — itu perubahan
perilaku, bukan pemindahan UI, jadi **di luar lingkup** (§4).

Saat `tanpa_ai`, tombol **tetap dirender** meski nonaktif, dengan alasan dipakai apa
adanya dari `putuskanAkses`. Alasan yang sudah ditulis di `kursus-ai-panel.tsx:15`
berlaku sama: peserta berhak tahu fitur itu ada dan kenapa ia tidak bisa dipakai.

#### Drawer tetap ter-mount; tidak pernah di-unmount

Drawer disembunyikan dengan **CSS** (lebar/visibilitas), **bukan** dibongkar dari pohon
React. Melepas iframe memuat ulang dokumen dan **memutus WebSocket di tengah giliran** —
`careevo-sijago` mencatat giliran yang hilang persis karena race hidrasi seperti ini.

Ini **berbeda dari DeepTutor dengan sengaja**: di sana `companionOpen && <ReadingCompanion/>`
memang membongkar panelnya (`ReadingWorkspace.tsx:740`) karena `ChatRuntimeProvider` di
atasnya memegang state percakapan. Careevo tidak punya lapisan itu — state hidup **di
dalam** iframe — jadi drawer-nya harus tetap hidup.

`iframe` diberi `sandbox="allow-scripts allow-same-origin allow-forms allow-popups
allow-downloads"` dan `referrerPolicy="no-referrer"`, sama seperti
`ai-mastery-frame.tsx`, supaya ia tidak bisa menjangkau dokumen Careevo.

#### Perilaku per lebar layar

- **`xl` ke atas:** drawer ter-dock di kolom kanan, bisa di-drag (300–640px), lebarnya
  disimpan di `localStorage`. Pane modul menyempit, tidak tertutup.
- **Di bawah `xl`:** drawer menjadi **sheet** di atas dokumen dengan scrim yang menutup
  saat diklik, dan `Escape` menutupnya — pola `useLearningMode.ts`.

Tombol di bar fokus selalu tersedia di kedua mode; tidak ada jalan buntu untuk membuka
tutor.

## 4. Yang **tidak** dilakukan

- **Tidak** mengubah `putuskanAkses`, `wajibSesiTerverifikasi`,
  `checkpointEfektif`, atau `putuskanAkses`' pesan.
- **Tidak** memindahkan penyelesaian modul ke klien, dan **tidak** menambah jalur
  penyelesaian ketiga.
- **Tidak** menyentuh `assessment_snapshot` (ADR 0003): kuis tetap dinilai server
  dari snapshot.
- **Tidak** mengubah rantai kredensial. "Selesai kursus" tetap bukan sertifikat;
  kotak sertifikat tetap punya tiga keadaan (`terkunci`/`siap`/`terbit`).
- **Tidak** menambah pencarian di bar fokus (navbar memang tidak punya search).
- **Tidak** memigrasikan modul turunan menjadi modul tersimpan.
- **Tidak** mengubah `--chrome-h` atau `.under-chrome`.
- **Tidak** menambah aturan AI **per modul**. `aturan_bantuan` tetap milik
  `KebijakanCourse`, dan `putuskanAkses` tetap tidak membaca modul. Tutor AI hanya
  **dipindahkan** ke drawer (§3.7); ia tidak digerbangi per checkpoint, dan tidak
  dicabut di modul `kuis`/`proyek` kursus `bertutor`.
- **Tidak** mengirim posisi baca/modul ke AI Mastery — kontrak `tautanTutorAi`
  tetap hanya `courseId`.
- **Tidak** menulis chat baru di Careevo. Drawer memakai AI Mastery lewat iframe;
  `getLlm()` (non-streaming, tanpa store percakapan) **tidak** dipakai untuk chat.
  Skill `careevo-sijago` melarang membangun ulang chat.
- **Tidak** menaruh drawer di halaman silabus. Drawer hanya ada di reader (§3.7);
  silabus tetap memakai kartu tutor di sidebar yang menautkan `/ai-mastery`.
- **Tidak** membongkar iframe saat drawer ditutup — drawer tetap ter-mount (§3.7).
- **Tidak** menyentuh `vendor/` dan `contracts/` di pohon vendored —
  `contracts:check` gagal kalau berubah.

## 5. Berkas

**Baru**

- `src/app/(focus)/belajar/[slug]/materi/layout.tsx` — shell reader: rail, bar fokus,
  drawer, dan `CourseSessionProvider` (bertahan lintas modul).
- `src/app/(focus)/belajar/[slug]/materi/[modulId]/page.tsx` — hanya pane modul.
- `src/components/features/learning/materi-rail.tsx` — daftar seluruh modul + sub-item;
  bentuk `ringkas` (ciut) dengan slot `aksi` untuk tombol ciut/bentang.
- `src/components/features/learning/materi-focus-bar.tsx` — bar fokus (judul, tombol
  tutor, selesai) + baris penolakan satu kalimat. Kartu verifikasi kuning **bukan**
  tetangganya: ia milik `materi-shell.tsx`, di kolom baca.
- `src/components/features/learning/materi-pane.tsx` — isi satu modul (halaman →
  lampiran → kuis), tiap bagian di belakang gerbangnya.
- `src/components/features/learning/tutor-drawer.tsx` — drawer kanan: tombol toggle,
  dock/sheet, resize + persist lebar, iframe.
- `features/sijago/app/embed/chat/page.tsx` — rute chromeless di pohon vendored
  (di luar semua route group), menyediakan empat provider yang dibutuhkan
  `ChatWorkspace` tanpa `AppShell`/sidebar.

**Diubah**

- `detail-kursus.tsx` — menjadi silabus; buang akordeon dan impor mati.
- `course-session.tsx` — prop opsional `buktiAwal`/`runIdAwal`/`kejadianAwal`;
  `CourseSessionIndicator` **tidak lagi dipakai reader** (hanya silabus), jadi
  ia tidak boleh diimpor ulang dari `materi-focus-bar.tsx`.
- `kejadian-panel.tsx` — dari panel terbuka menjadi strip dua bagian (§3.3a);
  `IsiPanelKejadian` diekspor supaya bisa dirender tanpa klik (lingkungan tes `node`,
  tanpa jsdom).
- `materi-shell.tsx` — rail dihapus; state `silabusBuka` + `ReaderPanelSilabus`
  (§3.1a), `CourseSessionPrompt` di kolom baca (§3.3a).
- `reader-silabus.tsx` — **baru**: `ReaderSilabusLeading` (pemicu + bit progres)
  dan `ReaderPanelSilabus` / `IsiPanelSilabus` (panel setinggi layar).
- `src/app/globals.css` — `.reader-shell` (kanvas biru), `.reader-bar` (sayap
  putih), `.reader-silabus*` (pemicu + progres), `.reader-panel*` (panel).
- `kursus-subnav.tsx` — target CTA ke reader.
- `src/lib/learning/tutor-ai.ts` — helper `urlFrameTutorEmbed` (murni), di samping
  `urlFrameAiMastery`.
- `src/lib/learning/tutor-ai.test.ts` — test untuk helper baru.
- `src/actions/learning.ts`, `src/actions/enrollment.ts` — revalidate route reader.
- `scripts/smoke.mjs` — tambah route reader ke array `routes`.
- `kursus-ai-panel.tsx` — **tidak diubah logikanya**; ia tetap dipakai di sidebar
  silabus, hanya tidak lagi dipanggil dari pane modul reader.

## 6. Gerbang dan pengujian

- `scripts/smoke.mjs` — route reader ditambahkan ke array `routes` (jumlahnya
  diturunkan dari array, bukan ditulis tangan).
- `chrome-offset.test.ts` — mengembara seluruh `.tsx`; reader **tidak boleh**
  memuat `-mt-[Npx]`.
- `npm run check` **dan** `npm run build` — reader menyentuh `src/app`, jadi
  `check` saja tidak menangkap pelanggaran impor client-safe/server-only
  (`modul-resolver`, `session.ts` server-only).
- `npx next typegen` — route baru.
- **Gate pohon vendored** (`features/sijago/`), karena §3.7 menambah rute di sana:
  `cd features/sijago && npm run typecheck && npm run test:unit && npm run i18n:check
  && npm run contracts:check && npm run build`. Lalu **restart** server `:3790` dari
  `.next/standalone` — build saja tidak cukup.
- **Verifikasi frame di browser** dengan `frameLocator` (frame-nya cross-origin):
  buka reader, tekan tombol tutor, pastikan rute `/embed/chat` memuat chat **tanpa**
  sidebar, lalu kirim satu giliran. Beri jeda ~10–12 s setelah muat sebelum
  berinteraksi (WebSocket belum siap) — ini jebakan yang sudah tercatat di
  `careevo-sijago`.

**Test baru (unit, murni):**

1. Rail memuat **setiap** modul kursus, dengan sub-item yang benar per modul.
2. `modulId` yang tidak ada di kurikulum → `notFound` (bukan render modul kosong).
3. Run yang **kedaluwarsa** atau **tidak aktif** → tidak ada bukti → gerbang
   `perlu_sesi` tetap tampil. (Fail-closed: `kedaluwarsa()` sudah menangani batas
   waktu; test mengunci bahwa reader tidak pernah memakai run non-aktif.)
4. Penyelesaian modul `materi` di kursus `wajib` **selalu** lewat
   `selesaikanMateriAction`, dan jalur informal hanya untuk `opsional` /
   checkpoint `kuis`/`proyek` / pembatalan.
5. Modul turunan (tanpa isi) merender CTA eksternal, bukan pane kosong.
6. Tutor AI mengikuti **kebijakan kursus**, bukan checkpoint modul: kursus
   `tanpa_ai` menonaktifkan tombol tutor di modul `materi` **maupun** `kuis`; kursus
   `bertutor` mengaktifkannya di modul `kuis`. Test ini mengunci §3.7 supaya tidak
   ada yang diam-diam menambahkan gerbang per checkpoint.
7. `urlFrameTutorEmbed` — id kursus yang memuat `&`/spasi ter-encode; `baseUrl`
   tidak valid **melempar**; tanpa `course` hasilnya tetap rute embed polos.
   (Murni, di `tutor-ai.test.ts`.)
8. **Strip sesi (§3.3a)** di `kejadian-panel.test.ts`: ringkasan (status, hitungan
   catatan, celah, aturan bantuan) terbaca **tanpa klik**; isi `hidden` secara
   default dan `aria-expanded="false"`; `aria-controls` menunjuk id yang ada;
   panel **tidak dirender** saat status bukan `aktif` **dan** tidak ada celah;
   sesi berakhir tanpa celah tetap menyembunyikan tombol "Akhiri sesi".
9. **Bar fokus bukan rumah permukaan sesi** di `materi-focus-bar.test.ts`: sumber
   bar fokus — komentarnya dibuang lebih dulu, karena komentar yang *menyebut*
   `CourseSessionIndicator` bukan pelanggaran — tidak boleh menyebut
   `CourseSessionIndicator`, `CourseSessionPrompt`, maupun `useCourseSession`.
10. **Kartu verifikasi di atas kartu materi** di `materi-shell.test.ts`: diuji lewat
   **urutan** di HTML (kehadiran saja tidak membuktikan siapa di atas siapa) plus
   scoping ke `<main>`, supaya memindahkannya kembali ke dalam `<header>` — di mana
   urutannya masih "di atas" markup modul — tetap membuat test merah.
11. **Panel silabus menutupi bar dan dock tutor** di `reader-silabus.test.ts`:
   `z-index` panelnya di atas 40 (dock tutor) dan di bawah 100 (`.skip-link`),
   `position: fixed`, `height: 100dvh`, dan scrimnya di bawah panelnya sendiri.
   Turun di bawah 30 membuat panel terbuka *di belakang* bar yang memicunya, dan
   tak satu pun dari `typecheck`/`lint`/`vitest` melihat `z-index`.
12. **Panelnya `portal` ke `<body>`, bukan anak bar** di `reader-silabus.test.ts`:
   assertion pada **target portal**-nya (`createPortal(…, document.body,)`), bukan
   pada kehadiran string `document.body` — berkasnya juga menyentuh
   `document.body.style`, jadi versi lemahnya tetap hijau walaupun target portalnya
   dihapus. Dibuktikan dengan menggantinya lalu mengembalikannya.
13. **Panel tidak dirender saat tertutup** di `reader-silabus.test.ts` (cabang
   `return null`), dan **pemicunya** di `materi-focus-bar.test.ts`: nama aksesibel,
   `aria-expanded`/`aria-controls` yang sejalan, satu bit per modul, id basi
   disaring, dan kalimat `sr-only` yang menyebut progresnya.
14. **Isi panel benar** di `reader-silabus.test.ts`: `IsiPanelSilabus` dirender
   langsung (portal tidak bisa di lingkungan `node`), dan yang diperiksa adalah
   seluruh kurikulum termuat, `aria-current` hanya pada modul aktif, kepala
   mengulang judul/penyedia/progres, CTA menunjuk modul berikutnya yang belum
   selesai (dan "Ulas modul" saat 100%), plus nama dialog dan tombol tutupnya.

## 7. Risiko

| Risiko | Mitigasi |
|---|---|
| Sesi hilang saat navigasi silabus → reader | Shell di `layout.tsx` (§3.1) + seed `bukti` dari `cariRunAktif` (§3.2); test #3 |
| **Info sesi jadi tidak terjangkau** karena sekarang dilipat | Ringkasan wajib tetap terbaca tanpa klik, dan isi dipasang `hidden` (bukan di-unmount) supaya `aria-controls` tetap sah; test #8 |
| **Dua permukaan mengucapkan keadaan yang sama** (regresi: indikator di bar + strip di atas pane) | Satu strip saja (§3.3a); test #9 mengunci bar fokus |
| Percakapan hilang saat pindah modul | Shell di `layout.tsx`; drawer tidak pernah di-unmount (§3.1, §3.7) |
| Giliran terputus karena iframe dimuat ulang | Drawer disembunyikan CSS, bukan di-unmount (§3.7) |
| Tanda centang basi di rail | `revalidatePath` route reader (§3.6) |
| Gerbang diam-diam lebih lemah | Mesin akses tidak disentuh; test #4 mengunci jalur |
| Rail + pane berdesakan di mobile | Rail runtuh jadi panel di bawah `lg`; drawer jadi sheet di bawah `xl` |
| **Rail ciut jadi jalan buntu** (tombolnya ikut menghilang bersama lebar) | Tombolnya hidup **di dalam** panel rail, di slot `aksi` `MateriRail`; test #12 |
| **Rail ciut berhenti jadi peta kemajuan** (mis. menyaring modul atau membuang status selesai) | Bentuk ciut memuat daftar yang sama; yang dibuang hanya meta, dan "selesai" tetap terbaca lewat `sr-only`; test #13 |
| Dua sumber "modul" (silabus vs reader) menyimpang | Keduanya membaca `modulUntukSumber` yang sama |
| Tutor AI diam-diam jadi gerbang per modul | §3.7 mengunci aturannya di kursus; test #6 |
| Copy tutor mengklaim tahu modul aktif | Kontrak hanya kirim `courseId`; copy menyebut kursus (§3.7) |
| Edit pohon vendored tidak terlihat di `:3790` | Build ulang standalone **dan** restart server; gate vendored (§6) |
| Chat Careevo kedua lahir tanpa sengaja | §4 melarang menulis chat baru; drawer memakai AI Mastery |
