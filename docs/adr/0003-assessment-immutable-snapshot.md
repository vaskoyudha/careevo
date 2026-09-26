# ADR 0003 — Assessment immutable: snapshot per attempt

**Status:** accepted
**Tanggal:** 2026-09-26
**Konteks:** Fase 2 (`docs/backend-production-plan.md` §7) — learning evidence.

## Keputusan

Dari dua opsi di plan §7 (publikasi versi kanonik vs snapshot per attempt), dipilih
**snapshot per attempt**.

Setiap attempt `quiz_attempts` menyimpan, pada kolom `assessment_snapshot` (jsonb),
definisi lengkap asesmen **sebagaimana adanya saat attempt dikirim**:

- `judul`, `soal[]` (pertanyaan, `pilihan[]`, dan `jawaban_benar` indeks kunci), dan
  `nilai_lulus` — yaitu seluruh isi `Kuis` dari bank saat itu.
- `assessment_definition_version` — hash SHA-256 dari bentuk JSON kanonik snapshot
  (key terurut), dipakai sebagai identitas versi yang stabil dan dapat direkonstruksi.
- `grading_version` — versi algoritma penilaian yang dipakai saat menghitung skor,
  supaya perubahan aturan grading kelak tidak menulis ulang arti skor lama.

Penilaian server **hanya membaca snapshot**, bukan membaca ulang `data/kuis.json`.
`quiz_id` tetap disimpan sebagai referensi untuk navigasi, tetapi tidak pernah
dipakai lagi untuk menilai setelah attempt tersimpan.

## Mengapa bukan publikasi versi kanonik

Opsi publikasi versi (schema PostgreSQL untuk course/module/quiz/question + versi
published yang immutable) adalah pekerjaan Fase 4 (`docs/backend-production-plan.md`
§8), ketika bank soal dan CMS berpindah penuh ke database. Membuat schema quiz di
PostgreSQL sekarang, sementara sumber kebenarannya masih `data/kuis.json`, akan
menciptakan **dua sumber kebenaran** untuk asesmen yang sama — persis kegagalan yang
plan larang ("dua sumber kebenaran untuk soal yang sama"). Snapshot menutup kebutuhan
immutability Fase 2 tanpa mendahului migrasi CMS.

## Akibat yang dijamin

- Edit/hapus kuis, soal, kunci jawaban, atau `nilai_lulus` **setelah** attempt tidak
  mengubah snapshot, outcome, eligibility, review, atau payload credential historis —
  karena attempt memegang salinannya sendiri dan penilaian tidak membaca bank.
- `assessment_definition_version` memungkinkan audit "definition mana yang dinilai"
  tanpa bergantung pada isi bank yang bisa berubah.

## Retention dan referensi

- `quiz_attempt_answers` `ON DELETE cascade` ke `quiz_attempts` — jawaban tidak punya
  arti tanpa attempt-nya.
- `module_progress.evidence_id` adalah referensi **lunak** (uuid, tanpa FK) ke attempt
  atau run yang menjadi bukti penyelesaian: bukti yang sudah dipakai credential tidak
  boleh hilang hanya karena attempt/run di-cleanup. Kebijakan delete/retention nyata
  ditetapkan di Fase 3 (`docs/backend-production-plan.md` §7 prasyarat credential).
