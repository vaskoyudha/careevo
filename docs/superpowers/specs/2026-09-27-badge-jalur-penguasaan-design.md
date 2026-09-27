# Badge Jalur Penguasaan — desain

**Tanggal:** 2026-09-27
**Status:** draft untuk implementasi
**Konteks:** `src/lib/mastery/` (file store `.data/mastery/`), `src/lib/review/`
(submission → review → badge → attestation), `docs/adr/0004`.

---

## 1. Masalah

Satu path penguasaan bisa diselesaikan, dan **tidak ada yang bisa dicatat sebagai
selesai**. `src/lib/mastery/` menyimpan `attempts` per topik dan menurunkan
`overall` sebagai rata-rata `hitungPenguasaan` — tetapi:

- **Tidak ada peristiwa terminal.** Kursus menulis `course_completions`; path tidak
  menulis apa pun. Tidak ada tempat di sistem yang bisa berkata "path ini selesai".
- **`overall` tidak bisa mencapai 1.** `CincinProgres` melukis penuh hanya pada
  `value >= 1` (`src/components/features/mastery/cincin-progres.tsx:42`), sedangkan
  `overall` adalah rata-rata **seluruh** poin dengan poin yang belum dicoba dihitung
  0. Jadi "penuh" bukan keadaan yang bisa dicapai sekarang.
- **Tidak ada kredensial.** Satu-satunya jalur credential adalah submission yang
  terikat kursus, dan `pastikanKelayakanKursus` (`src/lib/review/service.ts:143`)
  menolak apa pun yang tidak punya `course_completions` ber-`terverifikasi`.

Yang hilang bukan "sertifikat". Yang hilang adalah **peristiwa terminal**, dan
karena itu kredensial tidak mungkin diambil dari apa pun.

## 2. Yang sudah ada dan dipakai ulang

Rantai credential Careevo **utuh dan sudah bekerja** untuk kursus terverifikasi:

```
learning_runs (kamera_mulai) / quiz_attempts (assessment_snapshot)
  → module_progress → course_completions (completionPath = "terverifikasi")
    → submissions.course_id / enrollment_id  ← sudah dipakai, bukan vestigial
      → reviews (staf, compare-and-set) → badges → attestations → /verify/[token]
```

`pastikanKeligibility` sudah persis bentuk yang dibutuhkan: server menghitung
kelayakan dari `completion`, bukan dari klaim browser. Plan ini **menyalin pola itu
apa adanya** untuk path, bukan membuat kredensial kedua.

## 3. Keputusan

### 3.1 Gerbang emoPAT — empat aturan, diturunkan dari scoring yang sudah ada

Ambang **tidak diketik tangan**. Semuanya diturunkan dari `src/lib/mastery/scoring.ts`
supaya tidak ada dua sumber kebenaran:

| # | Aturan | Sumber angka |
|---|---|---|
| 1 | **Cakupan** — `hitungPenguasaan(attempts) >= 1.0` untuk **setiap** poin | `CONFIDENCE_CAP = {1: 0.5, 2: 0.8}` sudah menyatakan bahwa 1–2 jawaban benar tidak cukup. Menuntut cap memberi aturan itu gratis. |
| 2 | **Retensi** — tiap poin punya ≥1 attempt `correct` dengan `source === "review"` | `Attempt.source` sudah membedakan `session` (sukarela) dari `review` (due on schedule). |
| 3 | **Kedalaman** — tiap poin punya ≥1 attempt `review` yang `correct` dan jaraknya dari attempt sebelumnya ≥ `ambangHari(type)` | Dihitung dari `attempts`, bukan dari `RepetitionState` — lihat §3.2. |
| 4 | **Bersih** — `errorPointIds` kosong saat penerbitan | Bukan syarat komposit: poin yang dijawab salah lalu tidak pernah dibetulkan tidak bisa mendapat badge. |

**`ambangHari(type)`** diturunkan dari `INTERVAL_SEQUENCES` dengan
`Math.floor((len - 1) / 2)`, mengikuti prinsip yang sudah ditulis di
`rentangTinjauan` ("ditulis dari `INTERVAL_SEQUENCES` sendiri"):

| Tipe | Tabel | Indeks | Ambang |
|---|---|---|---|
| `memory` | `[0,1,3,7,14,30,60]` | 3 | 7 hari |
| `concept` | `[3,7,14,30]` | 1 | 7 hari |
| `procedure` | `[3,7,14]` | 1 | 7 hari |
| `design` | `[14,28]` | 0 | 14 hari |

### 3.2 Kenapa kedalaman dihitung dari `attempts`, bukan dari `intervalIndex`

`RepetitionState` menyimpan **posisi saat ini** di jadwal, dan `jadwalkanBerikutnya`
menurunkannya satu langkah tiap jawaban salah. Jadi `intervalIndex` current
adalah posisi sekarang, bukan **yang pernah dicapai** — memakaianya untuk badge
akan menghukum peserta yang sedang diturunkan jadwalnya karena salah. Plus, tidak ada
high-water mark yang tersimpan, dan menambahkannya berarti mengubah store.

Log attempt bersifat immutable dan sudah menyimpan `at`. Jarak nyata antara dua
percobaan pada poin yang sama **adalah** klaim "bertahan N hari lalu kembali dengan
benar", dan itu diukur, bukan diperkirakan. Sumber kebenaran badge karena itu
selalu log attempt — yang persis harus dictate sebuah credential.

Attempt pertama pada satu poin tidak punya attempt sebelumnya; jaraknya diukur dari
`topic.createdAt`. Itu dicatat eksplisit, bukan dibiarkan jadi `Infinity` yang
lolos.

### 3.3 Provenance — badge menguty threshold-nya sendiri

Seluruh attempt hari ini berasal dari `catatPercobaanAction`, yaitu tombol
"Bisa"/"Belum". Jadi aturan 2–3 saat ini mengukur **kedisiplinan** (apakah kamu
kembali saat jatuh tempo), bukan **penguasaan**. Keduanya klaim nyata, dan badge
tidak boleh mencampurkannya.

Solusinya bukan menaikkan ambang sekarang, tapi **mencatat ambang yang dipakai**
di dalam snapshot yang dibekukan:

```jsonc
{ "jalur": {
    "topicId": "…", "policyVersion": 1,
    "provenanceMinimum": 0,        // 0 = semua attempt self-declared
    "perBanding": { "dinilai": 0, "dideklarasikan": 23 },
    "poin": [ /* per-point mastery, attempts, gap, terpenuhi */ ],
    "ringkasan": { "totalPoin": 7, "poinTerpenuhi": 7, "percobaan": 23 }
}}
```

Ketika bridge AI Mastery mengirim attempt yang **dinilai** (graded), ambang naik dan
badge baru otomatis lebih ketat — **tanpaMigrasi dan tanpa penerbitan ulang**, karena
badge lama froze di ambangnya sendiri dan verifier bisa membaca ambang mana yang
berlaku. `Attempt.provenance?: "dinilai" | "dideklarasikan"` ditambahkan sebagai
field opsional di plan ini **tanpa producer** — disengaja, karena producer-nya
adalah bridge yang bergantung pada hasil Task 0.

### 3.4 Bukti dibekukan saat submission, bukan dibaca saat verify

`submissions` tidak punya kolom topic, dan `KontenSubmission` itu free text dengan
catatan "bukan bahan payload attestation" — jadi identitas topic **tidak boleh**
berasal dari form.

Keputusan: **server** menuliskan bukti jalur ke
`submission_versions.content_snapshot` (jsonb) saat submission dibuat. Snapshot itu
sudah immutable, sudah di-`restrict`, dan sudah dibaca reviewer._verify publik
membaca `attestations`, bukan `.data/`. Menghapus topic setelah badge terbit
karena itu **tidak merusak kredensial** — snapshot yang jadi bukti, bukan file.

Konsekuensi yang mengikutinya: `mastery_topic_id` jadi **referensi lunak** (tanpa
FK), persis preseden `module_progress.evidence_id` yang di-spesifikasi sebagai
"deliberately soft reference". Topik bisa dihapus; kredensial tidak ikut hilang.
**Karena itu badge tidak pernah menunjuk file** — ini yang membuat migrasi mastery
ke PostgreSQL menjadi **tidak perlu** sekarang.

### 3.5 Badge type — tiga nilai, mengikuti konvensi yang ada

Kode ada sudah `submission.courseId ? "course_submission" : "portfolio_submission"`
(`service.ts:408`) dengan `type: text` bebas. Ditambah satu:

| `type` | Kapan | depended on |
|---|---|---|
| `course_submission` | `courseId` terisi | tidak berubah |
| `portfolio_submission` | keduanya null | tidak berubah |
| `mastery_submission` | `masteryTopicId` terisi, `topic.jobId` kosong | baru |
| `job_mastery_submission` | `masteryTopicId` terisi, `topic.jobId` ada | baru |

**Id topic tidak ditulis ke dalam `type`.** Binding-nya sudah ada di
`submissions.mastery_topic_id`; menyalinnya ke `type` akan jadi sumber kebenaran
kedua yang pasti akan berbeda.

### 3.6 Payload attestation — bentuknya tidak berubah

`AttestationPayload` (`src/lib/attestation/sign.ts:3`) adalah kontrak publik yang
dibaca `/verify/[token]` dan `/p/[username]`. **Tujuh field-nya tidak ditambah.**
Untuk submission jalur:

```ts
task_id:    submission.masteryTopicId   // id topik
task_title: topic.title
track:      "jalur penguasaan"
level:      "independen"
score:      skorDariRubrik(rubric)       // penilaian reviewer — BUKAN persentase mastery
```

`score` sengaja tetap skor rubrik. Mastery percentage adalah **bukti**;
`score` adalah **penilaian reviewer**. Menggabungkannya akan membuat kredensial
mastery-tinggi/rubrik-rendah terbaca sebagai skor tinggi. Kalimat klaim yang
kaya (jumlah poin, jumlah percobaan, hari penilaian ulang) hidup di `content_snapshot`
dan di UI — bukan di payload yang ditandatangani.

### 3.7 Yang tidak berubah

- **`AttestationPayload`**: tujuh field, bentuk dan renderer verify apa adanya.
- **`badges`**: tanpa kolom baru. `sourceReviewId` tetap `notNull() + unique()`, jadi
  review gate dan "satu badge per review" tetap struktur, bukan konvensi.
- **`course_completions`, `completion_path`, `jalur-selesai.ts`**: empat label jalur
  tidak bertambah. Badge jalur **tidak** menambah nilai pada label jalur
  penyelesaian kursus.
- **Tidak ada migrasi ke `mastery_topics`.** Byte-for-byte, lihat §3.4.

## 4. Di luar lingkup

- **Bridge AI Mastery → Careevo.** Bergantung pada Task 0. Satu arah, non-authoritative.
- **Badge retention bertingkat** (re-issue setelah 60/180 hari). Log `attempts`
  menahannya, jadi tidak perlu merchandise sekarang.
- **Migrasi `src/lib/mastery/` ke PostgreSQL.** Dibatalkan oleh §3.4, bukan ditunda.
- **Mendiscoverykan flow credential kursus yang sudah jadi.** Itu urusan sendiri, dan
  kemungkinan perubahan dengan nilai-per-jam lebih tinggi daripada apa pun di plan ini.

## 5. Risiko yang diterima

- **Volume badge terbatas staf.** Review-gated, sama seperti badge kursus yang
  sudah jadi. bukan gerbang baru — itu reuse antrean reviewer yang sudah ada.
- **Klaim "retensi" lebih lemah dari "penguasaan" sampai bridge hidup.** Karena itu
  ambang dicatat di snapshot dan tampil di verify, bukan disembunyikan.
- **Reviewer menilai bukti, bukan angka.** `provenanceMinimum: 0` berarti reviewer
  sedang menilai disiplin belajar. Form reviewer harus menyatakan itu, supaya
  keputusan approve bernalar.

## 6. Hasil Task 0 (spike)

**`LAYANAN_BISA_PER_PESERTA: true` — bersyarat: hanya berlaku bila
`AUTH_ENABLED=true` *dan* tiap peserta Careevo punya satu akun non-admin AI Mastery.
Syarat itu BELUM terpenuhi, jadi isolasi per-peserta tidak aktif hari ini dan
seluruh peserta yang memakai `/ai-mastery` berbagi satu store yang sama.**

Yang terbukti adalah *kemampuan* mengisolasi per akun, bukan isolasi yang sedang
berjalan. Tiga butir berikut; butir 2 dan 3 yang menentukan apakah bridge boleh
dibangun sekarang.

1. **Mekanismenya ada, tapi hanya lewat akun non-admin.** `LearningStore()` tanpa
   argumen (`mastery_path.py:439-448`, `storage.py:353-361`) mewarisi ContextVar
   pengguna yang dipasang `require_auth` (`auth.py:416`), dan
   `get_account_path_service()` (`paths.py:153-161`) mengembalikan root
   `data/users/<uid>` yang berbeda per akun non-admin. Router memang memasang
   `dependencies=_auth` (`main.py:614-619`; `_auth` di `main.py:590`).
2. **Hari ini tidak terisolasi sama sekali.**
   `backend/data/user/settings/auth.json` berisi `"enabled": false` dan
   `backend/data/users/` tidak ada — nol akun non-admin. Setiap request diperlakukan
   sebagai local-admin. Akun admin juga berbagi satu root, jadi `true` hanya berlaku
   setelah `AUTH_ENABLED=true` *dan* satu akun non-admin diprovisioning per peserta.
3. **Respons terisolasi tidak pernah diamati.** Store `:8011` berbaris 0 di seluruh
   tabel data, jadi tidak ada `path_id` dan `GET /topics/{path_id}` hanya menjawab
   `404`. Kesimpulan bertumpu pada resolusi path dan config auth di atas, bukan pada
   pengamatan respons yang benar-benar terisolasi.

Bridge karena itu harus memetakan peserta Careevo → akun AI Mastery secara eksplisit:
`path_id` sendiri tidak membawa identitas peserta. **Konsekuensi:** `provenanceMinimum`
tetap `0` pada plan ini dan bridge tetap plan terpisah — ketiga syarat di atas adalah
prasyarat operasional, bukan perubahan pada spec ini. Bukti mentah dan langkah
verifikasinya: `docs/ai-mastery-scope-finding.md`.
