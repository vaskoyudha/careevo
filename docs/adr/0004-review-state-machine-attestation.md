# ADR 0004 — Review state machine dan lifecycle attestation otoritatif

**Status:** accepted
**Tanggal:** 2026-09-26
**Konteks:** Fase 3 (`docs/backend-production-plan.md` §7 "Fase 3") — submission, review,
badge, attestation, dan revocation.

## Keputusan

### 1. State machine submission hidup di `ReviewService`, bukan di component/action

```text
draft → submitted → assigned → in_review → approved | rejected | changes_requested
changes_requested → submitted → assigned → in_review   (resubmit learner)
approved → attested                                    (turunan, bukan status kolom)
attested → revoked
```

`approved`/`attested` dibedakan: `submissions.status = "approved"` adalah hasil review;
"attested" adalah keadaan turunan "ada `attestations` berstatus `active` untuk review itu".
Badge dan attestation tidak punya kolom status yang bisa drift dari barisnya — `badges`
menggunakan `revoked_at` nullable (active = `revoked_at is null`), sedangkan
`attestations.status` menyimpan `active`/`revoked` karena ia adalah sumber yang dibaca
endpoint verify publik tanpa join lain.

Transition ditegakkan dengan **compare-and-set** di repository (`UPDATE … WHERE id = $1 AND
status = $expected RETURNING`), bukan dibaca-lalu-tulis: dua reviewer yang menyetujui
submission yang sama bersamaan hanya menghasilkan satu transisi ke `approved`, dan yang kalah
melihat nol baris ter-update sehingga tidak menerbitkan attestation kedua.

### 2. Attestation lifecycle authoritative di database

Signature HMAC-SHA256 tetap dipertahankan untuk portabilitas (payload yang bisa diverifikasi
tanpa login), tetapi **issuance, key version, dan status active/revoked authoritative di
PostgreSQL**. Endpoint `/verify/[token]` kini membaca baris `attestations`, memverifikasi
signature terhadap `payload_canonical`, **dan** memeriksa `status` — token yang sudah dicabut
menampilkan `revoked` meskipun signaturenya masih sah.

### 3. `public_token` opaque, bukan id sequence

`attestations.id` adalah uuid (identitas internal), sedangkan `public_token` adalah nilai
acak 32-byte base64url yang **tidak** menurunkan id database. Token public tidak boleh
menyiratkan urutan penerbitan, dan kebocoran satu token tidak boleh memungkinkan menebak
token lain.

### 4. Key version untuk rotasi

`attestations.key_version` mencatat versi kunci yang dipakai menandatangani. Fase 3 hanya
punya `key_version = 1` (`ATTESTATION_SECRET`); rotasi menambah versi baru di
`src/lib/attestation/key.ts` dan `src/lib/config/secrets.ts` tanpa menulis ulang signature
lama. `payload_canonical` adalah string JSON kanonik (key terurut) yang persis ditandatangani,
bukan objek jsonb — sehingga verifikasi tidak bergantung pada normalisasi key-order
PostgreSQL.

### 5. Satu attestation aktif per review

Re-issuance setelah revocation adalah fitur yang sah, jadi `source_review_id` **tidak**
di-unique penuh. Yang dijamin adalah **paling banyak satu attestation `active` per review**,
lewat partial unique index `attestations_active_review_unique` (`WHERE status = 'active'`).
Penerbitan ganda oleh request/worker dua kali gagal di constraint ini, bukan di pengecekan
aplikasi.

## Akibat yang dijamin

- Score/username/task yang dikirim klien tidak mengubah `payload_canonical`: payload dibangun
  server-side dari baris review (`rubric_snapshot`, `score` terkomputasi) + course + user.
- Review tidak dapat dihapus bila sudah dipakai credential (`reviews` di-`restrict` oleh
  `attestations.source_review_id`); user/version/submission yang direferensikan credential
  tidak bisa dihapus (`onDelete: "restrict"`).
- Verifier publik melihat status minimal (active/revoked) tanpa PII berlebihan: payload yang
  ditampilkan dibatasi ke field yang memang dibutuhkan verifikasi.

## Retention dan redaction

- `attestation_events` adalah log append-only per attestation (`issued`/`revoked`), `payload_redacted`
  disaring sebelum insert (lihat `src/lib/auth/audit.ts`).
- Outbox: transisi bisnis (review + badge + attestation) commit atomik dengan
  `outbox_events` `attestation.issued`/`attestation.revoked`; handler-nya mem-fan-out ke
  sink `audit` lewat ledger `outbox_deliveries`, sehingga retry/replay tidak menggandakan
  baris audit.
