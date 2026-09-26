# Rencana Backend MVP Careevo

## Context

Careevo ditujukan untuk submission lomba dengan **sisa satu hari efektif**, bukan peluncuran layanan skala produksi. Target: **satu VPS, satu proses Next.js, PostgreSQL, dan disk persisten**. Fondasi Fase 1–3 tetap digunakan; pekerjaan Fase 4 yang telah dihentikan pengguna dikeluarkan dari versi MVP setelah diarsipkan.

**Status: menunggu persetujuan — belum dieksekusi.** Tidak ada test/build/server dijalankan dalam penyusunan rencana. Commit `1e92a04` adalah kandidat baseline, bukan bukti siap deploy.

### Temuan penentu

- Fase 4 menambah gate startup storage di `src/instrumentation.ts:46–50`, dependency AWS, schema baru, dan folder storage/files yang belum terintegrasi. Gate dapat menolak startup produksi walaupun upload aktif masih filesystem.
- Migration repository hanya `0000–0003`. Inspeksi database lokal menemukan ledger baru tiga entri dan belum ada tabel review/attestation: migration Fase 3 perlu diterapkan. Database VPS harus diperiksa sendiri, jangan dianggap identik.
- `src/lib/review/service.ts` sudah memiliki create/submit/assign/start/decide, tetapi hanya keputusan review yang terhubung ke browser melalui `src/actions/review.ts:68`.
- Submit belum menegakkan peta `TRANSISI`; start/decide belum memeriksa kesesuaian reviewer; `submitted_at` belum ditulis oleh `src/lib/review/repository.ts:152`. Ini diperbaiki sebelum endpoint baru dibuka.
- Detail review belum menampilkan konten karya yang dinilai; tombol challenge masih memakai task ID seolah-olah submission UUID (`src/components/features/challenge/workbench.tsx:316`).

## Target selesai dan scope

Alur wajib yang nyata:

**Registrasi/login → onboarding → enroll/belajar/completion → buat dan kirim karya teks → verifikator ambil/mulai review → approve atau reject → credential nyata → public verify.**

- Gunakan service, repository, auth, resolver kursus, rubrik, dan transaksi yang sudah ada.
- UI baru hanya form/tombol/list minimum untuk mengakses backend. Tidak redesign.
- Submission MVP terikat kursus/enrollment milik pengguna. Completion dan kelayakan diverifikasi dari DB; form tidak menentukan pemilik, skor, eligibility, atau reviewer.
- Bukti berupa judul/catatan teks; URL dapat ditulis sebagai teks tanpa server-fetch. Tidak membangun upload submission atau field/file store baru.
- Tunda UI revisi/resubmit, revoke/reissue, assignment ke staf lain, dan editor riwayat. Service lama tetap dipertahankan dan diuji; jangan menawarkan tombol yang tidak berfungsi.
- Akun/materi awal boleh disiapkan. Approval dan credential **tidak boleh dibuat lewat seed atau SQL agar seolah-olah alur browser berhasil**.

## M0 — Amankan pekerjaan Fase 4, lalu keluarkan dari MVP

**Timebox: 30–45 menit. Selesai sebelum menulis fitur.**

1. Periksa ulang cwd, branch, HEAD, diff staged/unstaged, daftar untracked, dan tidak ada penulis lain. Catat inventaris final.
2. Buat arsip lokal di luar source/build: patch tracked (termasuk staged), salinan semua untracked Fase 4, daftar path, dan SHA-256. Verifikasi hash, isi arsip, serta rekonstruksi patch terhadap baseline di direktori sementara sebelum melepas sumber. Jangan mengarsipkan `.env`, secret, database, atau upload pribadi.
3. Setelah backup terbukti lengkap, keluarkan **hanya** perubahan Fase 4:
   - Gate storage `src/instrumentation.ts`; **pertahankan gate secrets dan rate limit**.
   - Tambahan Fase 4 `src/lib/db/schema.ts`, termasuk FK avatar/cover menuju tabel yang dilepas, metadata CMS baru, tabel file/resume/storage, import tipe, dan ekspor terkait. Jangan menyentuh schema Fase 1–3.
   - `src/lib/config/storage.ts` dan test-nya; `src/lib/storage/`; `src/lib/files/`.
   - Tiga dependency AWS di `package.json` beserta perubahan lockfile yang sesuai; sinkronkan instalasi dependency setelahnya tanpa upgrade.
   - Blok env storage, service/volume MinIO–ClamAV, ADR 0005/0006, dan dokumentasi Fase 4 dari paket aktif; salinannya tetap ada di arsip.
4. Pertahankan dua perubahan independen yang berguna: bind PostgreSQL loopback di `docker-compose.yml` dan koreksi dokumentasi ledger Drizzle di `docs/local-db.md`. Perintah reset di dokumentasi **tidak dijalankan**.
5. Jangan `reset --hard`, `git clean` massal, generate migration baru, drop tabel, atau rollback DB. Inspeksi ledger/schema aktual; bila ditemukan data/tabel Fase 4 di luar dugaan, berhenti untuk keputusan terpisah.

**Lulus:** arsip terverifikasi; tidak ada import/dependency/schema Fase 4 tertinggal; `git diff --check` bersih; typecheck berjalan; runtime tidak menuntut MinIO/ClamAV. Data dan volume lama tidak dihapus.

## M1 — Pastikan DB dan runtime baseline benar

**Timebox: 45–60 menit.**

1. Identifikasi database target dan ambil backup sebelum migration bila berisi data penting. Jangan cetak kredensial. Jalankan **migration existing saja** melalui `npm run db:migrate`, lalu ulangi untuk membuktikan idempoten.
2. Verifikasi ledger sesuai journal dan tabel `submissions`, `submission_versions`, `reviews`, `badges`, `attestations`, serta `attestation_events` tersedia. Tidak hardcode asumsi ledger VPS dari mesin lokal.
3. Jalankan typecheck dan integration test terarah auth/learning/review menggunakan harness test DB terisolasi yang sudah ada. Catat kegagalan baseline sebelum perubahan fitur.
4. Siapkan runtime produksi memakai `DATABASE_URL`, secrets non-default berbeda, dan **Upstash rate limiter existing**. MinIO/ClamAV tidak diperlukan. Jangan melemahkan `assertRateLimitSiapProduksi` supaya start tampak sukses.
5. Registrasikan akun learner dan verifikator melalui alur normal. Naikkan akun staf memakai `npx tsx scripts/bootstrap-admin.ts <email> --role verifikator` setelah akun terdaftar. Ulang CLI tidak menduplikasi role. Tidak mengaktifkan akun demo berpassword publik pada production.

**Lulus:** migration lengkap/idempoten, login/onboarding nyata berhasil, role staf terbaca, konfigurasi `npm start` tidak bergantung pada Fase 4. Kredensial/runtime yang belum tersedia dicatat sebagai blocker deploy, bukan diakali dengan fallback dev.

## M2 — Tutup alur submission dan review

**Timebox: 3–4 jam. Prioritas perubahan kode utama.**

### 2A. Service dan invariant

Berkas: `src/lib/review/service.ts`, `src/lib/review/repository.ts`, test unit/integration terkait.

- Reuse `buatSubmissionDb`, `kirimSubmissionDb`, `tetapkanReviewerDb`, `mulaiReviewDb`, `putuskanReviewDb`, `transisiSah` dan compare-and-set existing.
- Batasi submit ke `draft`/`changes_requested`; tolak status terminal sebelum mutation/outbox. Set `submittedAt` dalam UPDATE status yang sama.
- Untuk jalur kursus MVP: resolve course/enrollment dari server dan periksa ownership serta kecocokan course. Gunakan `ambilEnrollment`/`ambilEnrollmentById` dan `ambilCompletion` di `src/lib/learning/repository.ts`; submission credential kursus mensyaratkan completion terverifikasi yang persisten. Periksa kembali saat submit/approval, bukan percaya hidden field. Jalur standalone internal yang sudah ada jangan diam-diam dilabeli kelulusan kursus.
- Kebijakan MVP: **staf mengambil review untuk dirinya sendiri**, bukan memilih `reviewerUserId` dari browser; tidak menilai karya sendiri. Start dan decide wajib oleh staf yang ditugaskan. Jalur assign service memvalidasi target sesuai policy, bukan hanya FK user.
- Assignment dan start tetap dua transisi yang jelas: `submitted → assigned → in_review`. Jika proses terputus setelah assignment, reviewer yang sama dapat melanjutkan; tidak perlu orkestrator/transaksi gabungan baru.
- Pertahankan transaksi review+badge+attestation+outbox dan constraint anti-duplikasi existing. Tidak membuat queue atau state machine kedua.

### 2B. Action dan UI minimum

Berkas utama: `src/actions/review.ts`, `src/actions/review.test.ts`, schema validasi submission yang cocok, serta komponen fitur submission/review.

- Tambah action buat, kirim, ambil review, dan mulai review; gunakan `getSession`, policy ownership/role, Zod, `GalatReview`, dan pola `useActionState` existing.
- Validasi UUID submission/enrollment, course ID sesuai resolver, batas panjang judul/catatan, dan input rubrik/alasan. User ID/status/reviewer/score dari klien tidak menjadi authority.
- Revalidate daftar dan detail yang berubah setelah mutation/`decideReview`; navigasi menggunakan submission UUID hasil DB.
- Buat `/submission` sebagai list milik pengguna + form sederhana memilih kursus eligible. Sediakan tautan dari halaman belajar yang sudah ada. Tidak membangun wizard/editor.
- `/submission/[id]`: tampilkan snapshot judul/catatan, tombol kirim saat draft, status/hasil keputusan, serta link token attestation nyata melalui pembaca repository ber-ownership. Reuse `ambilVersiTerkini`.
- `/review` existing sudah membaca `listSubmissionStaf`: pertahankan daftar, pastikan assigned/in_review tetap dapat ditemukan. Tidak perlu mengganti query menjadi antrean submitted-only.
- `/review/[id]`: tampilkan snapshot karya yang benar-benar dinilai; tombol ambil pada submitted, mulai pada assigned milik reviewer, form keputusan **hanya saat in_review milik reviewer**. Reviewer lain read-only/ditolak untuk mutation. Tampilkan approve/reject saja dalam scope UI MVP.
- Perbaiki CTA challenge lama agar menuju daftar/form submission, **bukan** `/submission/<taskId fixture>`. Jangan menganggap task ID sebagai course ID tanpa mapping yang benar.
- Tambahkan label status yang diperlukan di `src/components/ui/status-badge.tsx`; tidak mengubah navbar atau desain global.

**Lulus:** learner menghasilkan submission dari browser; staf membaca isi karya, mengambil, memulai, dan memutuskan; learner memperoleh link verify dari DB. Tidak perlu SQL manual untuk memajukan status.

## M3 — Verifikasi vertical slice dan operasikan satu VPS

**Timebox: 2–3 jam, lalu buffer 1–2 jam untuk blocker. Bukan janji estimasi selesai.**

### Test otomatis

- Unit/action: session hilang, learner memanggil staf action, ID/teks invalid, field palsu user/role/score/reviewer, error domain, revalidation.
- DB integration: enrollment orang lain ditolak; course/enrollment tidak cocok atau belum eligible ditolak; submit terminal ditolak; `submittedAt` terisi; staf lain dan self-review ditolak; dua klaim/keputusan paralel tidak menghasilkan approval/attestation ganda; reject tidak menghasilkan credential; verify valid/invalid/revoked mengikuti record.
- Pertahankan regression test revoke yang sudah ada tanpa menambah UI revoke. Jalankan integration secara serial sesuai konfigurasi repo, pada DB ephemeral; tidak TRUNCATE database demo.
- Gate akhir: `npm run check`, `npm run test:db`, `npm run build`. Build/test panjang di background; baca hasil akhirnya, jangan menyimpulkan dari exit awal atau log parsial.

### Browser dan produksi

1. `npm start` dengan env produksi yang valid. Uji melalui tool browser/Playwright yang tersedia, **tanpa dependency test runner baru**. HTTP smoke hanya pemeriksaan tambahan, bukan pengganti E2E.
2. Dua browser context/akun: learner login/onboarding → enroll/completion → buat draft → submit; staf login → ambil → mulai → nilai approve; learner membuka link credential; anonim membuka public verify. Jalankan kasus reject terpisah dan cek tidak ada credential.
3. Refresh/login ulang/restart aplikasi: progress, assignment, submission, dan credential tetap ada. Ulangi lifecycle dengan submission baru; test otomatis menguji request duplikat pada record yang sama.
4. Skrip `e2e:onboarding` lama masih membuat cookie HMAC. Jangan mengklaimnya lulus untuk auth DB; jelaskan status legacy di runbook dan gunakan bukti sesi nyata. Tidak menambah `test.skip` atau memalsukan cookie agar lolos.
5. VPS memakai satu proses Node dan PostgreSQL volume persisten. Dokumentasikan `data/`, `.data/`, dan `public/uploads/` beserta env redirect aktual; jangan menganggap semuanya tercakup oleh volume DB. Material demo disiapkan sebelum production start. **Live upload tidak menjadi acceptance MVP**; keterbatasan file baru di `next start` dicatat, tidak disamarkan sebagai beres hanya karena disk persisten.
6. Gunakan reverse proxy HTTPS, PostgreSQL tidak publik, kredensial DB bukan default development, dan batas request/rate limit existing. Jangan aktifkan trust proxy/header kecuali proxy benar-benar menimpa header tersebut; pastikan `TEST_DATABASE_URL` tidak tersetel di runtime produksi.
7. Attestation terbit/verify langsung dari DB. Bila memeriksa audit, jalankan `npm run worker` dengan DB yang sama setelah aksi dan periksa statistik/DLQ; worker drain-and-exit, bukan daemon. Tidak menambah infrastruktur worker.
8. Deployment eksternal/ubah service VPS dilakukan setelah target serta akses dikonfirmasi; persetujuan plan bukan izin memakai server yang belum diidentifikasi.

### Dokumentasi dan penutupan

- Setelah persetujuan, simpan rencana MVP di `docs/backend-mvp-plan.md` dan runbook ringkas setup/verification di `docs/mvp-runbook.md`.
- Ubah header `docs/backend-production-plan.md` menjadi roadmap pascalomba yang bukan gate MVP; pertahankan isi sebagai referensi historis. Tidak harus menyelesaikan Fase 4–6 atau menunggu satu PR besar.
- Reviewer/verifier terpisah memeriksa changed files, security boundaries, placeholder, dan bukti test/browser. Semua failure/skipped check disebutkan. Tidak ada commit/push/deploy otomatis tanpa permintaan pengguna.

## Stop condition

Backend dibekukan begitu alur utama berhasil melalui browser dalam production build, gate relevan lulus, dan restart mempertahankan data. **Tidak lanjut MinIO/ClamAV, migrasi CMS, dashboard fixture menyeluruh, email, AI pipeline, atau refactor tambahan.**

Jika waktu habis sebelum alur lengkap, laporkan tepat langkah yang terblokir. Jangan menurunkan target diam-diam menjadi seed `in_review`, menghapus authorization, atau menyebut production-ready. Prioritas sisa waktu selalu: start/migration → auth → submit/review/verify → data persisten → regresi; kosmetik dan fitur di luar jalur ditunda.
