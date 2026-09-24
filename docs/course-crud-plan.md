# Implementation Plan: CRUD Course → Modul Pembelajaran → Materi

**Status:** ✅ **SUDAH DIEKSEKUSI** (2026-09-24). Lihat §8 untuk koreksi terhadap rencana ini dan apa yang benar-benar dibangun.
**Cakupan:** `/admin/courses` (CRUD kursus → modul → materi), unggahan berkas, persistensi.
**Keputusan produk yang sudah dikunci:** JSON di disk · unggah ke `public/uploads/` · empat tipe materi (Video, Teks, PDF, Kuis).


## 0. TL;DR

Halaman `/admin/courses` berjudul **"Kelola Kursus & Kurikulum"**, tapi janji itu belum ditepati kode. Yang ada hari ini hanya CRUD metadata kursus; kata "silabus", "materi", dan "kurikulum" di UI hanyalah label pemasaran.

Modul **tidak disimpan** — `modulKursus()` di `src/lib/courses/kurikulum.ts:47` menurunkan tepat 5 modul secara deterministik dari `title + tags + duration_min`, dan kelima modul itu mewarisi URL kursus induknya. Materi belum ada sebagai konsep sama sekali.

Rencana ini membangun CRUD sungguhan untuk **course → modul pembelajaran → materi**, dengan empat tipe materi, unggah gambar & PDF ke disk, dan persistensi file JSON sehingga data bertahan antar restart server.

### Kondisi awal (terverifikasi dari kode)

| Lapisan | Status |
|---|---|
| CRUD Course | Lengkap, tapi **volatil** (`let coursesState` in-process, hilang saat restart) |
| CRUD Modul | **Nol** — tidak ada entitas, store, skema, action, UI |
| CRUD Materi | **Tidak ada konsepnya** sama sekali |
| Konsumsi learner | Satu tautan `<a href={m.url}>Buka materi ↗</a>`; `m.url` identik untuk kelima modul |
| Persistensi progres | Cookie HMAC `ls_enroll`, `selesai_modul: string[]` |

---

## 1. Temuan teknis yang membentuk desain

Diverifikasi langsung terhadap `node_modules/next` 16.3.5 dan kode repo ini. Masing-masing **mengubah keputusan desain**, jadi dicatat eksplisit:

1. **`serverActions` adalah opsi top-level di Next 16**, bukan `experimental.serverActions` seperti di Next 13–15. Diverifikasi di `config-shared.d.ts:928` (blok `NextConfig.serverActions`) dan `config-schema.js:245`. Batas body default **1 MB** — terlalu kecil untuk PDF, jadi perlu dinaikkan disertai validasi ukuran sendiri (batas kerangka bukan validasi).

2. **`public/` dilayani dinamis di `next dev`** — `filesystem.js` sengaja melakukan `fileExists` ulang saat dev. Jadi berkas yang ditulis saat runtime **langsung muncul** di dev. Di `next start` produksi, `public/` di-snapshot saat startup sehingga berkas baru perlu restart. Demo memakai `npm run dev`, jadi dev bisa diandalkan; batas produksi ini dicatat, bukan disembunyikan.

3. **`cookies()` sudah mengopt route ke dynamic rendering** (didokumentasikan di `cookies.md:69`), jadi `/belajar` dan `/admin/courses` tidak akan menyajikan data basi setelah file JSON berubah. Tidak perlu `force-dynamic`.

4. **Server Action yang memanggil `revalidatePath` sudah mengirim ulang RSC payload segar dalam satu response** (`server-actions.md`). Artinya salinan state di klien pada `course-manager.tsx` **memang tidak diperlukan** — dan justru itu sumber bug saat ini: klien membangun ulang objek `Course` sendiri (slug fallback, tag split, `new Date()`) sehingga bisa menyimpang dari yang benar-benar tersimpan.

5. **`next dev` tidak memantau `data/`.** Diverifikasi di `setup-dev-bundler.js:266`: daftar `directories` yang dipantau hanya `[...pages, ...app]`, dan `ignored` menolak path di luar keduanya. Jadi `data/courses.json` di root **tidak** memicu rebuild berulang.

6. **`z.url()` di zod v4 menerima `javascript:alert(1)`.** Diuji langsung dengan zod 4.6.5 yang terpasang: `z.url().safeParse("javascript:alert(1)").success === true`. Zod memvalidasi *bentuk* URL, bukan keamanan protokol. `z.string().url()` punya lubang yang sama.

7. **`slugify()` yang ada sudah aman untuk nama berkas.** Diuji: `../../etc/passwd` → `etcpasswd`, `a b/../c.png` → `a-bcpng`. Path traversal hilang tanpa util baru.

---

## 2. Rancangan

### 2.1 Model data

**Modul disimpan, bukan diturunkan.** Ini pembalikan mendasar dari prinsip "derive, don't store" yang berlaku untuk kursus.

```ts
// src/types/course.ts (ditambahkan)
export interface Modul {
  id: string;             // slug stabil, mis. "fullstack-web-development-m1"
  course_id: string;
  judul: string;
  ringkasan: string;
  urutan: number;         // 1-based, eksplisit
  durasi_min: number;
  created_at: string;
  updated_at: string;
}

export type TipeMateri = "video" | "teks" | "pdf" | "kuis";

export interface SoalKuis {
  id: string;
  pertanyaan: string;
  pilihan: string[];      // minimal 2
  jawaban_benar: number;  // indeks ke `pilihan`
}

/** Field bersama semua tipe materi. */
interface MateriDasar {
  id: string;
  modul_id: string;
  judul: string;
  urutan: number;
}

/** Payload per tipe — discriminated union, sehingga `switch (m.tipe)` bersifat exhaustive. */
export type Materi =
  | (MateriDasar & { tipe: "video"; url: string; durasi_min: number })
  | (MateriDasar & { tipe: "teks"; konten: string })
  | (MateriDasar & { tipe: "pdf"; path: string; ukuran_bytes: number })
  | (MateriDasar & { tipe: "kuis"; soal: SoalKuis[]; nilai_lulus: number });
```

`Course` mendapat dua field opsional baru: `cover_image?: string` (path unggahan) dan `modul?: Modul[]`.

### 2.2 Kontrak id modul & migrasi progres

Id lama bersifat **posisional** (`${courseId}-m${index+1}`, selalu 5) dan **tersimpan di cookie `ls_enroll`** milik pengguna nyata.

`irisModulSelesai()` (`kurikulum.ts:103`) sudah menyaring id basi secara aman dan **wajib dipertahankan sebagai gerbang migrasi**: cabang turunan tetap memakai skema id lama, cabang tersimpan memakai id baru. Progres lama tidak dipetakan paksa — dibuang dengan aman, dan itu perilaku yang sudah diuji.

### 2.3 Persistensi

Modul baru `src/lib/courses/storage.ts` — satu-satunya modul yang menyentuh `node:fs`:

- `path.join(process.cwd(), "data", "courses.json")`, `mkdir` rekursif bila belum ada.
- **Tulis atomik**: tulis ke `courses.json.tmp` lalu `rename` — mencegah berkas korup bila proses mati di tengah.
- Muat-sekali lalu cache di memori modul; `simpanCourses()` menulis ulang cache.
- `data/courses.json` ditambahkan ke `.gitignore`.

`src/lib/courses/store.ts` **mempertahankan seluruh signature `async`-nya** (sudah dirancang untuk swap ke I/O nyata tanpa mengubah pemanggil). Yang berubah hanya sumber `coursesState`: dari `[...INITIAL_COURSES]` menjadi hasil `muatCourses()`. `resetCourses()` tetap ada (dipakai `beforeEach` di test) dan mengembalikan ke seed in-memory tanpa menyentuh disk.

**Urutan tulis vs revalidate.** `revalidatePath` harus dipanggil **setelah** `simpanCourses()` selesai; kalau mendahului, RSC payload segar bisa dirender dari berkas yang belum ter-flush dan halaman menampilkan data basi.

### 2.4 Sumber tunggal kebenaran modul

Saat ini kebenaran modul dibangun ulang di **empat** tempat yang bisa menyimpang: `modulKursus()` (generator), `selesaikanKursus()` (`actions/enrollment.ts:49,66`), `belajar/page.tsx:31`, dan `belajar/[slug]/page.tsx:40`.

Satu resolver menggantikannya:

```ts
// src/lib/courses/kurikulum.ts (diperluas, tetap fungsi murni + satu fungsi async)
export async function modulUntuk(courseId: string): Promise<ModulKursus[]>
//  - modul tersimpan bila ada  -> pakai, urutkan by urutan
//  - selain itu                -> fallback modulKursus() (perilaku lama, id lama)
```

Semua pemanggil lama dialihkan ke resolver ini. Fungsi murni `modulKursus()`, `hitungProgres()`, dan `irisModulSelesai()` **tidak dihapus** — fallback dan test-nya tetap berlaku, sehingga `kurikulum.test.ts` yang ada terus lulus.

**Konsekuensi yang harus disadari: hanya kursus yang kurikulumnya benar-benar diedit yang berpindah ke modul tersimpan.** Selama admin tidak menyentuh modul sebuah kursus, kursus itu tetap memakai modul turunan dengan id lama. Ini bukan kekurangan, melainkan yang menjaga dua invariant yang sudah teruji:

- `enrollment.test.ts` menandai modul dengan id literal `"crs-1-m1"`, `"crs-2-m1"`, `"crs-8-m1"` terhadap kursus seed — test itu akan gagal bila kursus seed tiba-tiba mendapat modul tersimpan dengan id berbeda.
- Progres nyata di cookie `ls_enroll` pengguna memakai id lama; kursus yang belum disentuh admin tetap terbaca. Kursus yang **sudah** dimigrasikan akan kehilangan centang progres lamanya (dibuang aman oleh `irisModulSelesai`) — perilaku yang sudah diuji, dan alasan mengapa resolver harus dipakai seragam di keempat titik agar tidak ada layar yang memakai id berbeda dari yang lain.

### 2.5 Unggah berkas

Route handler `src/app/api/unggah/route.ts` (preseden: `src/app/(public)/keluar/route.ts`), **bukan** Server Action — supaya batas 1 MB tidak menjadi penentu dan progres unggah bisa dilaporkan.

- Gerbang sesi + `isStaffRole` **di dalam handler** (route handler tidak berada di bawah layout yang menggating).
- Validasi berlapis: allow-list MIME, batas ukuran, sanitasi nama berkas. Tidak ada satu pun validasi unggah di repo saat ini — `saveProfileAction` menerima `avatarUrl` mentah tanpa cek skema/MIME/ukuran.
- **Nama berkas: pakai ulang `slugify()`** (`store.ts:174`), sudah diuji aman terhadap path traversal. Tambahkan ekstensi dari MIME yang terverifikasi (bukan dari nama kiriman pengguna), plus sufiks unik agar tidak saling menimpa.
- Tulis ke `public/uploads/courses/<courseId>/`, kembalikan path relatif.
- Gambar: perkecil di klien via `useImageUpload` yang sudah ada (`src/components/ui/profile-dialog/use-image-upload.ts`) sebelum dikirim — jangan mengirim gambar penuh.
- `next.config.ts` — tambahkan `serverActions: { bodySizeLimit: '8mb' }` sebagai jaring pengaman untuk action yang membawa berkas kecil.

### 2.6 Validasi

`src/lib/validation/modul.ts` dan `src/lib/validation/materi.ts`, mengikuti pola `courseSchema` (`src/lib/validation/course.ts`): enum konstanta diekspor, `.trim()`, min/max, `z.coerce.number()` untuk FormData, `updateXSchema = xSchema.partial()`.

Sekaligus **memperbaiki lubang yang sudah ada dan akan menular ke materi**: `courseSchema.url` hanya `min(1)`, sehingga `javascript:` bisa tersimpan lalu dirender ke `<a href>` (`course-manager.tsx:568`). Perbaikannya:

```ts
// src/lib/validation/url.ts
export const skemaUrlHttp = z.string().trim().refine((v) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}, { message: "URL harus diawali http:// atau https://" });
```

Diuji: menerima `https://…`/`http://…`; menolak `javascript:`, `data:`, `ftp:`, path relatif, dan string kosong. Dipakai untuk `url` kursus **dan** `url` materi video (embed). **Jangan** pakai `z.url()` — lihat temuan §1.6.

**Teks materi dirender sebagai teks biasa, bukan HTML.** Repo tidak punya sanitizer dan `dangerouslySetInnerHTML` nol hit. Menyimpan HTML dari admin lalu merendernya mentah akan mengubah lubang XSS yang jinak menjadi tersimpan. Rich-text editor ditunda sampai ada kebutuhan nyata.

### 2.7 Server action

`src/actions/modul.ts` dan `src/actions/materi.ts`, pola `courses.ts` (state `{ok, message?, error?, fieldErrors?, ...}`, `safeRevalidate`, gate `getSession()` + `isStaffRole`).

Sebelum menambah dua salinan lagi, **ekstrak yang sudah terduplikasi 3× ke `src/lib/actions-common.ts`** (helper non-`"use server"` — modul `"use server"` tidak boleh mengekspor nilai non-async): `extractFieldErrors(error)`, `gateStaff()`, `safeRevalidate(path)`.

Setiap mutasi mengembalikan **entitas lengkap yang tersimpan**, bukan sekadar `{ok}` — supaya klien tidak perlu menebak.

### 2.8 UI admin

`src/app/(verifikator)/admin/courses/[id]/page.tsx` — halaman detail kursus, server component, `AppShell` (sidebar; area admin selalu `AppShell`, bukan `LearnerShell`).

Registri yang **wajib** diperbarui saat menambah route admin:
- `STAFF_GROUPS` di `src/components/ui/dashboard-sidebar.tsx:47`
- `PAGE_LABELS` di `src/components/ui/app-shell.tsx:26` (fallback diam-diam ke "Dashboard" bila terlewat)

Komponen baru di `src/components/features/admin/courses/`:

| Komponen | Tanggung jawab |
|---|---|
| `kursus-detail.tsx` | Dua tab: **Modul** dan **Materi** |
| `modul-editor.tsx` | Daftar modul; tambah/ubah/hapus; **naik/turun** untuk urutan (tanpa dependency drag-drop) |
| `materi-editor.tsx` | **Satu form per tipe**: video → URL embed; teks → textarea; pdf → unggah; kuis → daftar soal |
| `unggah-berkas.tsx` | Tombol unggah + progres + pratinjau, di atas route handler §2.5 |
| `pratinjau-materi.tsx` | Render tiap tipe sebagai learner |

Tiga perbaikan pola yang berlaku di semua form baru:

- **Hilangkan salinan state klien.** Setelah mutasi, andalkan RSC payload dari `revalidatePath` — bukan `setCourses()` lokal. Ini menghapus bug penyimpangan slug/timestamp dan menghapus `recomputeStats` manual.
- **Ikuti pola form yang lebih benar.** `course-manager.tsx` merakit `FormData` manual di `onClick` dan memanggil action imperatif dengan `{ ok: false }` palsu — akibatnya tombol Enter tidak men-submit. Preseden yang sudah ada dan lebih baik adalah `edit-profile-dialog.tsx:70`, yang memakai `<form action={formAction}>` + `useActionState`.
- **Tempelkan setiap berkas unggahan ke entitasnya segera setelah dibuat.** Unggahan berjalan lewat route handler (di luar transaksi action), jadi berkas bisa yatim bila pembuatan modul/materi gagal setelah unggah. Urutannya: buat entitas → dapatkan id → unggah ke `public/uploads/courses/<courseId>/<materiId>/` → `updateMateri` dengan path.
- **Tampilkan hasil normalisasi server.** Store men-unique-kan slug diam-diam (`store.ts:243-247` menambah sufiks `-1`, `-2`), tapi UI tidak pernah menampilkannya.

Kelas CSS yang **sudah tersedia** di `globals.css` (pakai, jangan bikin token arbitrary): `.table-app` (2515), `.field`/`.field-hint`/`.field-error` (1801–1851), `.card`/`.card-head`/`.card-title`/`.card-sub` (2275–2303), `.stat-box*` (2309–2333), `.alert-ok`/`.alert-warn`/`.alert-danger` (2694–2706), `.chip` (282). Komponen `Tabs`/`Table`/`Select`/`Card`/`Alert`/`Separator` sudah ada di `src/components/ui/` dan belum berconsumer — aman dipakai.

### 2.9 Sisi learner

**Cover kursus tidak akan otomatis tampil.** `belajar-home.tsx:52` menyimpan `COURSE_METAS` hardcoded per id, dan `getCourseMeta()` (`:200`) jatuh ke thumbnail Unsplash yang dipilih lewat hash id. Jadi `cover_image` yang diunggah admin akan **diabaikan sepenuhnya** kecuali jalur ini diubah: `getCourseMeta()` harus mengembalikan `cover_image` lebih dulu sebelum jatuh ke `COURSE_METAS`/hash. `ResourceFixture` (`src/lib/fixtures.ts:54`) belum punya field gambar, dan `katalogBelajar()` belum memetakannya dari `Course` — keduanya perlu ditambah.

`detail-kursus.tsx` — modul menjadi **expandable**; `<a href={m.url}>Buka materi ↗</a>` diganti pemilih per tipe:
- **video** → iframe embed (YouTube/Vimeo) + `aspect-video`
- **teks** → render paragraf sebagai teks biasa
- **pdf** → tautan buka/unduh
- **kuis** → kerjakan soal, nilai di klien

**Copy yang menyebut "5 modul" harus disesuaikan.** `belajar-home.tsx:1373` dan `:1381` menuliskan "modul 1 hingga modul 5" dan "lembar pelacakan 5 modul". Setelah modul menjadi tersimpan dan jumlahnya bebas, keduanya menjadi salah — ubah menjadi netral atau diturunkan dari data.

### 2.10 Kerangka gesit

Satu slot `materi` bertipe union membuat tipe baru bersifat **aditif**: tambah varian union, tambah cabang form, tambah cabang render; tidak ada skema atau store baru. Yang sengaja **tidak** dibangun sekarang (YAGNI): drag-drop, paginasi, editor rich-text, bank soal acak, prasyarat antar-modul, soft delete, jejak audit.

---

## 3. Berkas yang disentuh

### Baru

```
src/lib/courses/storage.ts          tulis/baca atomik data/courses.json
src/lib/actions-common.ts           ekstraksi: gateStaff, extractFieldErrors, safeRevalidate
src/lib/validation/url.ts           skema URL http/https (menutup lubang javascript:)
src/lib/validation/modul.ts         modulSchema + updateModulSchema
src/lib/validation/materi.ts        materiSchema (discriminated union) + updateMateriSchema
src/actions/modul.ts                create/update/delete/reorder modul
src/actions/materi.ts               create/update/delete materi
src/app/api/unggah/route.ts         unggah berkas + validasi MIME/ukuran/nama
src/app/(verifikator)/admin/courses/[id]/page.tsx
src/components/features/admin/courses/kursus-detail.tsx
src/components/features/admin/courses/modul-editor.tsx
src/components/features/admin/courses/materi-editor.tsx
src/components/features/admin/courses/unggah-berkas.tsx
src/components/features/admin/courses/pratinjau-materi.tsx
```

### Diubah

```
src/types/course.ts                   + Modul, Materi (union), SoalKuis, cover_image
src/lib/courses/store.ts              sumber coursesState dari storage; signature async tetap
src/lib/courses/kurikulum.ts          + modulUntuk() resolver tunggal
src/lib/validation/course.ts          url pakai skema http/https; + cover_image
src/actions/courses.ts                pakai helper bersama; kembalikan entitas lengkap
src/actions/enrollment.ts             modulValid dari modulUntuk()
src/app/(app)/belajar/page.tsx        modulUntuk()
src/app/(app)/belajar/[slug]/page.tsx modulUntuk()
src/components/features/learning/detail-kursus.tsx       modul expandable + render per tipe
src/components/features/learning/belajar-home.tsx        cover_image menang atas hash; copy "5 modul" netral
src/lib/fixtures.ts                   ResourceFixture + cover_image?
src/lib/courses/katalog.ts            katalogBelajar(): petakan cover_image dari Course
src/components/features/admin/courses/course-manager.tsx buang salinan state klien
src/components/ui/dashboard-sidebar.tsx  + entri nav
src/components/ui/app-shell.tsx          + PAGE_LABELS
next.config.ts                        serverActions.bodySizeLimit
.gitignore                            + /data/ dan /public/uploads/
```

### Diuji

Vitest hanya `src/**/*.test.ts` dengan environment node — komponen React **tidak** bisa diuji.

```
src/lib/courses/storage.test.ts      round-trip tulis/baca, fallback seed, tulis atomik
src/lib/courses/kurikulum.test.ts    + modulUntuk(): tersimpan menang, fallback, id lama aman
src/lib/validation/url.test.ts       tolak javascript:/data:/ftp:, terima http/https
src/lib/validation/modul.test.ts     judul/urutan/durasi
src/lib/validation/materi.test.ts    tiap varian union; video menolak javascript:
src/actions/modul.test.ts            gate staff, CRUD, entitas lengkap dikembalikan
src/actions/materi.test.ts           gate staff, CRUD per tipe
```

---

## 4. Urutan eksekusi

Tiap fase diakhiri `npm run check` dan harus lulus sebelum lanjut.

| Fase | Isi | Verifikasi |
|---|---|---|
| **1. Persistensi** | `storage.ts`, `store.ts` baca dari storage, `.gitignore` + `/data/` | `storage.test.ts` lulus; test store lama lulus; buat kursus → restart dev → masih ada |
| **2. Tipe + validasi** | `Modul`/`Materi`/`SoalKuis`/`cover_image`; `skemaUrlHttp`; `modulSchema`; `actions-common.ts` | `npm run check`; test baru menolak `javascript:` |
| **3. Resolver tunggal** | `modulUntuk()`; keempat pemanggil lama dialihkan | `kurikulum.test.ts` lama lulus; `enrollment.test.ts` (id `crs-1-m1`) lulus — bukti fallback tidak regresi |
| **4. Action modul & materi** | `actions/modul.ts`, `actions/materi.ts` | test action baru (gate staff, CRUD, bentuk hasil) |
| **5. Unggah** | `api/unggah/route.ts` + `bodySizeLimit` | unggah gambar & PDF nyata; muncul di disk dan bisa dibuka via URL; berkas berlebih ditolak jelas |
| **6. UI admin** | halaman `[id]`, komponen editor, registri nav | buat kursus → 3 modul → urutkan → 4 tipe materi → unggah → refresh; semua bertahan |
| **7. Sisi learner** | modul expandable + render per tipe; alirkan `cover_image` | `/belajar/<slug>` menampilkan tiap tipe; progres naik; kursus fixture tetap 5 modul turunan |

---

## 5. Verifikasi

1. **Gate otomatis** — `npm run check` (typecheck → lint → skills:check → test) setelah tiap fase.
2. **Uji unit** — `npx vitest run src/lib/courses/kurikulum.test.ts`; test lama **wajib tetap lulus**.
3. **Persistensi lintas restart** — `npm run dev`, buat kursus + modul + materi, **matikan lalu nyalakan ulang** dev server, pastikan data masih ada (bukti utama pengganti in-memory) dan `data/courses.json` berisi data itu.
4. **Unggah** — unggah 1 gambar + 1 PDF; pastikan berkas muncul di `public/uploads/courses/<id>/` dan bisa dibuka lewat URL-nya.
5. **Sisi learner** — `/belajar/<slug>`: modul tampil, tiap tipe ter-render benar, "Tandai selesai" menaikkan progres, dan **progres lama tetap terbaca** untuk kursus yang belum dimigrasikan.
6. **Turunan vs tersimpan** — kursus fixture (`/belajar/fullstack-web-development-nextjs-15-react-19`) tetap 5 modul turunan; kursus baru memakai modul tersimpan.
7. **Smoke** — `npm run smoke` (butuh server jalan). Catatan: `/admin/courses` **tidak** ada di daftar route `scripts/smoke.mjs`; pertimbangkan menambahkannya.
8. **Batas unggah** — unggah berkas melebihi batas; pastikan ditolak dengan pesan jelas, bukan gagal senyap.

---

## 6. Risiko yang diketahui

| Risiko | Mitigasi |
|---|---|
| Tulis berkas di serverless tidak mungkin | Demo memakai `npm run dev`. `storage.ts` diisolasi satu modul sehingga bisa ditukar. |
| `public/` produksi di-snapshot saat startup | Terdokumentasi; dev OK. Catat di `AGENTS.md` bila perlu. |
| Dua admin menyimpan bersamaan | Tulis atomik mencegah korup; last-write-wins diterima untuk prototype. |
| Berkas yatim setelah unggah | Pola "buat entitas dulu, baru unggah"; bersihkan saat batal. |
| Progres lama hilang pada kursus yang dimigrasikan | Diterima & terdokumentasi; `irisModulSelesai` sudah menguji perilaku ini. |
| `deleteCourse` tidak memeriksa ketergantungan | Sudah ada sebelumnya; periksa `ls_enroll` sebelum hapus (perbaikan kecil, sekalian). |

---

## 7. Yang sengaja tidak dibangun

Drag-drop, paginasi, editor rich-text, bank soal acak, prasyarat antar-modul, soft delete, jejak audit (`logAudit` masih stub), dan perbaikan `decideReview` yang tidak memeriksa sesi. Semua di luar tujuan rencana ini dan layak menjadi pekerjaan terpisah.

---

## 8. Catatan eksekusi & koreksi rencana

Bagian ini ditulis **setelah** implementasi. Dua klaim di §1 ternyata salah dan sudah dikoreksi di kode.

### 8.1 Koreksi: `serverActions` ada DI DALAM `experimental` (§1.1 salah)

Rencana menyatakan `serverActions` adalah opsi top-level di Next 16. Itu keliru. Baris 928 di `config-shared.d.ts` memang memuat `serverActions`, tetapi baris itu berada di dalam `export interface ExperimentalConfig` yang dibuka di baris 345 — bukan di `NextConfig`. Skema runtime mengonfirmasi hal yang sama (`config-schema.js:616` menaruh `experimental` sebagai `strictObject`, dan `serverActions` ada di baris 245 di dalamnya).

Bentuk yang benar dan yang dipakai `next.config.ts`:

```ts
experimental: { serverActions: { bodySizeLimit: "8mb" } }
```

Menulisnya top-level gagal typecheck: `TS2353: 'serverActions' does not exist in type 'NextConfig'`.

### 8.2 Koreksi: resolver harus jadi modul server-only tersendiri

§2.4 menaruh `modulUntuk()` di `kurikulum.ts`. Itu **mematahkan build produksi**: `kurikulum.ts` juga diimpor komponen klien (`detail-kursus.tsx`), sehingga import store → `storage.ts` → `node:fs/promises` ikut masuk bundel klien dan Turbopack gagal dengan `the chunking context (unknown) does not support external modules`.

Perbaikannya: resolver pindah ke **`src/lib/courses/modul-resolver.ts`** (server-only), dan `kurikulum.ts` kembali murni. `npm run check` tidak menangkap ini — hanya `npm run build` yang bisa.

### 8.3 Perubahan bentuk data: materi bersarang di dalam modul

Rencana §2.1 menaruh `modul?: Modul[]` di `Course` tanpa menyebut tempat materi. Implementasinya menaruh `materi?: Materi[]` **di dalam `Modul`**, bukan koleksi terpisah. Alasannya: menghapus modul otomatis menghapus materinya, jadi tidak ada referensi yatim yang perlu dibersihkan terpisah.

Konsekuensinya `ModulKursus` (bentuk yang dipakai UI learner) ikut membawa `materi?`, sehingga halaman detail bisa merender tiap tipe tanpa kueri tambahan.

### 8.4 Tambahan di luar rencana

- **`npm run build` masuk daftar verifikasi.** Rencana §5 hanya memakai `npm run check`, yang tidak menjalankan `build`. Bug §8.2 membuktikan gate itu tidak cukup untuk perubahan yang menyentuh batas server/klien.
- **`materi-view.tsx` dipakai bersama admin dan learner.** Pratinjau admin memakai renderer yang sama dengan halaman belajar; pratinjau yang berbeda dari kenyataan lebih buruk daripada tidak ada pratinjau.
- **`validation/materi.ts` membatasi `path` PDF ke `/uploads/`.** Rencana hanya mengamankan `url` kursus/video dari `javascript:`. `path` juga dirender ke `<a href>` dan `<object data>`, jadi ia butuh batasan serupa; tanpa itu form bisa mengirim `javascript:` lewat field itu.
- **`store-hidrasi.test.ts`** menambah bukti otomatis bahwa store benar-benar membaca dari berkas, bukan seed in-memory — pengganti otomatis untuk verifikasi manual §5.3.

### 8.5 Bug yang ditemukan dan diperbaiki saat eksekusi

| Bug | Dampak | Perbaikan |
|---|---|---|
| `geserModul()` no-op | Tombol naik/turun modul tidak berpengaruh: `rapikanUrutan` mengurutkan ulang berdasarkan field `urutan` yang masih basi, membatalkan pertukaran | Pisahkan `nomoriUlang()` (berbasis posisi array, untuk mutasi) dari `rapikanUrutan()` (berbasis field, untuk pembacaan) |
| `pathPublik` unggahan membuang segmen `uploads` | URL yang dikembalikan 404 saat dipakai sebagai `src`/`href` | Pertahankan seluruh `segmen`; diverifikasi dengan `existsSync` terhadap path yang dikembalikan |

### 8.6 Verifikasi yang sudah dijalankan

- `npm run check` — typecheck, lint, skills:check, 298 test (30 berkas) lulus.
- `npm run build` — berhasil; `/admin/courses/[id]` dan `/api/unggah` terdaftar sebagai route dinamis.
- **Persistensi lintas proses** (pengganti restart dev di §5.3): satu proses menulis kursus + modul + materi, proses Node **terpisah** membacanya kembali dan menemukan `total=9` dengan modul dan materi utuh.
- **Gate unggah**: `POST /api/unggah` tanpa sesi → 401 sebelum body diurai; `/admin/courses` tanpa sesi → 307 ke `/masuk`.
- `npm run smoke` — 20/20 route merespons.
- Belum dijalankan: penelusuran manual di browser (daemon browser tidak tersedia di sesi ini). Rencana §5.7 menyarankan menambahkan `/admin/courses` ke daftar route `scripts/smoke.mjs` — belum dikerjakan.
