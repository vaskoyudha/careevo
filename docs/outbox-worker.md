# Worker outbox dan operasi dead-letter

Fase 1A (`docs/backend-production-plan.md` §6) memindahkan efek samping
non-transaksional keluar dari siklus request lewat **transactional outbox**.
Halaman ini adalah runbook operator untuk menjalankan worker, memeriksa
dead-letter, dan me-replay-nya di mesin lokal.

Produksi belum ada. Worker Fase 1A direncanakan berjalan di VPS yang sama
dengan API dan PostgreSQL, **bukan** lewat queue eksternal
(`docs/adr/0001-topologi-deployment-produksi.md` §1.2), dan VPS itu belum
dibeli maupun diprovision (§1.0). Karena itu §7 halaman ini masih placeholder,
dan tidak ada langkah di sini yang boleh dibaca sebagai prosedur deploy.

Batas kepastian halaman ini:

| | |
|---|---|
| **Milestone** | M1A — Async foundation (plan §13) |
| **Sumber** | plan §6; ADR 0001 §1.0, §1.1 butir 3, §1.2, §11.3 butir 2 dan §11.4 |
| **Basis kode** | `src/lib/outbox/{writer,worker,handlers,replay}.ts`, `scripts/{worker,replay-outbox,bootstrap-admin}.ts` |
| **Sudah diverifikasi** | Gate test lulus di checkout utama: `check` 991/991, `test:db` 125/125 di 8 berkas, `build` lulus. Perilaku CLI diamati lewat eksekusi di direktori checkout utama oleh sesi agen, atas basis kode pra-final. Rincian, termasuk yang **belum** diverifikasi, ada di §9 |
| **Belum diverifikasi** | Jalur CLI oleh koordinator, eksekusi di produksi (VPS belum ada), koneksi worker ke sink eksternal (§6), dan pemantauan berkelanjutan (§8) |

---

## 1. Model state

`outbox_events` **tidak punya kolom `status`**. Statusnya diturunkan dari tiga
kolom, dan turunan itulah kontrak yang dipakai bersama oleh worker, CLI, dan
query dead-letter (`src/lib/outbox/worker.ts`):

| kondisi | arti |
|---|---|
| `processed_at IS NULL AND dead_lettered_at IS NULL` | pending — menunggu, sedang di-lease, atau menunggu jadwal retry |
| `processed_at IS NOT NULL` | selesai |
| `dead_lettered_at IS NOT NULL` | gagal terminal (dead-letter) |

Karena itu baris sukses **tidak boleh** mengisi `dead_lettered_at`, dan baris
mati **tidak boleh** mengisi `processed_at`. Menggabungkan keduanya membuat
"gagal permanen" terbaca sebagai "selesai".

Satu perjalanan sebuah event:

```text
transaksi bisnis + baris outbox_events  (satu transaksi, lewat tulisOutbox)
        │
        ▼
   pending ──(worker klaim: lease_owner + lease_expires_at, attempts +1)──▶ diproses
        │                                                                     │
        │                                       ┌── sukses ────────────────────┤
        │                                       ▼                              │
        │                              processed_at terisi                     │
        │                                                                      │
        │                                       ┌── gagal sementara ───────────┤
        │                                       ▼                              │
        │                    available_at bergeser (backoff), lease dilepas ──▶ pending
        │                                                                      │
        │                                       ┌── gagal permanen / attempts habis ──┤
        │                                       ▼                                     │
        └─────────────────────────  dead_lettered_at + last_error_code ◀──────────────┘
                                                │
                                    operator: list → putuskan → replay
```

Kolom ledger sink ada di tabel terpisah, `outbox_deliveries`, dengan primary key
komposit `(event_id, sink)` — lihat §6.

---

## 2. Menjalankan worker

```bash
npm run worker                                  # putaran sampai antrean kosong
npm run worker -- --once                        # satu putaran saja
npm run worker -- --batch 50 --json             # batch lebih besar, keluaran JSON
npm run worker -- --lease-ms 45000 --max-attempts 3
npm run worker -- --owner worker-a --once
npm run worker -- --maks-putaran 5
```

`npm run worker` adalah alias dari `tsx scripts/worker.ts`; semua argumen
diteruskan setelah `--`.

| Opsi | Arti | Default |
|---|---|---|
| `--once` | satu putaran klaim-lalu-proses, lalu keluar | tidak; tanpa ini worker mengulang sampai antrean kosong |
| `--batch N` | jumlah maksimum event yang diklaim per putaran | `10` |
| `--lease-ms N` | durasi lease dalam milidetik | `30000` |
| `--max-attempts N` | percobaan maksimum sebelum baris dipindah ke dead-letter | `5` |
| `--owner ID` | identitas pemilik lease | `cli-<hostname>-<pid>` |
| `--maks-putaran N` | batas putaran pada mode loop (pengaman agar tidak menggantung) | `1000` |
| `--json` | keluaran JSON satu baris, untuk cron/alert | tidak |

`N` harus bilangan bulat positif; nilai `0`, negatif, atau bukan angka
ditolak sebelum menyentuh database:

```console
$ npm run worker -- --batch 0
[worker] GAGAL: --batch harus bilangan bulat positif, menerima "0".
```

Mode CLI, dan perilaku `--help` berbeda antar dua skrip:

- **Worker tidak punya `--help`.** Argumen tak dikenal seperti `--help`
  diabaikan dan worker **tetap berjalan**; jangan memakainya untuk mencoba-coba.
  Baca bagian ini atau `scripts/worker.ts`.
- **`outbox:replay` punya bantuan**, tetapi sebagai **perintah posisional**,
  bukan flag: `npm run outbox:replay -- help` (atau `-h`, `--help`).
  Menjalankan tanpa perintah juga mencetak bantuan, dengan exit `0` — jadi
  script yang "sukses" tanpa melakukan apa pun tetap mungkin; periksa
  keluarannya, bukan hanya exit code-nya. Yang keluar dengan exit `1` adalah
  perintah yang tidak dikenal.

### Keluaran dan exit code

Bentuk keluaran mode `--once` (nilai statistik bergantung isi antrean):

```text
[worker] owner=cli-<host>-<pid> diklaim=2 berhasil=1 gagalSementara=0 gagalTerminal=1 kehilanganLease=0
```

Bentuk keluaran mode loop:

```text
[worker] owner=cli-<host>-<pid> putaran=1
[worker] diklaim=1 berhasil=0 gagalSementara=0 gagalTerminal=1 kehilanganLease=0
[worker] 1 event dead-letter. Periksa: npx tsx scripts/replay-outbox.ts list
```

Contoh nyata dari checkout utama, antrean kosong:

```console
$ npm run worker -- --once
[worker] owner=cli-<host>-<pid> diklaim=0 berhasil=0 gagalSementara=0 gagalTerminal=0 kehilanganLease=0
```

Statistiknya:

| Medan | Arti |
|---|---|
| `diklaim` | event yang berhasil di-lease putaran ini |
| `berhasil` | handler selesai; baris ditutup `processed_at` |
| `gagalSementara` | dijadwalkan ulang dengan backoff; belum mati |
| `gagalTerminal` | masuk dead-letter pada proses ini |
| `kehilanganLease` | lease diambil alih worker lain; baris tidak disentuh |

`--json` mencetak satu objek JSON. Pada mode `--once` medannya `statistik` dan
`durasiMs`; pada mode loop ada tambahan `putaran`:

```json
{"statistik":{"diklaim":0,"berhasil":0,"gagalSementara":0,"gagalTerminal":0,"kehilanganLease":0},"durasiMs":42}
```

`durasiMs` bergantung mesin dan isi antrean; jangan pakai sebagai ambang alert.

**Exit code.** Ini penting untuk cron, dan perilakunya tidak seragam:

| Keadaan | `--once` | mode loop (tanpa `--once`) |
|---|---|---|
| Tidak ada event | `0` | `0` |
| Ada `gagalTerminal` | `0` | **`2`** |
| Argumen tidak valid | `1` | `1` |
| Gagal koneksi/query | `1` | `1` |

Mode loop sengaja keluar dengan `2` bila ada event dead-letter, supaya cron bisa
membedakan "bersih" dari "ada yang mati" tanpa mem-parsing log. Mode `--once`
tidak melakukannya — **jangan pakai `--once` sebagai satu-satunya dasar
alerting.** Bila butuh gerbang yang andal, gunakan `outbox:replay -- count`
(§5) atau mode loop.

Bila ada yang mati, worker juga mencetak baris penunjuk ke CLI dead-letter di
stderr. Baris itu menuliskan path skrip, bukan perintah npm — kedua bentuk itu
setara, lihat catatan di §4.

### Pemicu dan kepemilikan lease

`npm run worker` menjalankan satu proses lalu keluar. Produksi menuntut
pemanggil berulang (systemd timer, cron, container long-running, atau platform
job) — **belum diputuskan**, lihat §7. Yang tidak boleh: worker yang berjalan
"saat ada request". Outbox justru ada untuk melepas efek samping dari siklus
request.

`--owner` harus unik per proses. Default `cli-<host>-<pid>` cukup di satu
mesin. Di multi-mesin dua proses bisa mendapat host dan pid yang sama, dan
**dua proses ber-`owner` sama akan saling menganggap dirinya pemilik lease** —
fencing-nya berbasis kepemilikan, bukan waktu. Selalu beri `--owner` eksplisit
begitu ada lebih dari satu worker atau lebih dari satu mesin.

---

## 3. Lease, retry, dan backoff

Nilai default yang berlaku (`src/lib/outbox/worker.ts`):

| Parameter | Default | Opsi CLI |
|---|---|---|
| Ukuran batch | 10 | `--batch` |
| Lease | 30.000 ms | `--lease-ms` |
| Percobaan maksimum | 5 | `--max-attempts` |
| Basis backoff | 1.000 ms | — (tidak ada flag) |
| Plafon backoff | 300.000 ms | — (tidak ada flag) |

**Aturan yang mengikat: lease harus lebih panjang dari handler terlama.** Handler
Fase 1A hanya menulis satu baris database, jadi 30 detik longgar. Sink jaringan
(email, scan) nanti menuntut lease yang jauh lebih besar atau handler yang
dipecah; menaikkan `--lease-ms` tanpa memikirkan itu hanya menyembunyikan
masalahnya.

Backoff: percobaan ke-`n` menunggu `min(1000 × 2^(n-1), 300000)` ms, ditambah
jitter acak 0–25% dari nilai itu. Jitter **ditambahkan**, tidak dikurangkan,
sehingga jeda tidak pernah lebih pendek dari basis yang diharapkan operator.
Jitter mencegah semua worker yang gagal bersamaan bangun bersamaan.

`attempts` dinaikkan **saat claim**, bukan saat gagal. Artinya angka yang
terlihat di baris adalah nomor percobaan yang sedang berjalan, dan itu yang
dipakai menghitung backoff.

Baris menjadi dead-letter bila galatnya permanen (mis. payload rusak) **atau**
`attempts` sudah menyentuh `maxAttempts`. Galat tak terduga (mis. koneksi
database putus) diperlakukan sebagai sementara dan di-retry — hanya
`GalatHandlerPermanen` yang memotong sisa anggaran percobaan.

### Pemulihan setelah worker mati

Lease adalah satu-satunya alasannya ada. Bila proses worker mati setelah klaim
tetapi sebelum selesai, barisnya tetap memegang `lease_owner` + `lease_expires_at`
sampai lease itu kedaluwarsa. Setelah kedaluwarsa, worker mana pun boleh
mengklaimnya lagi (`OUTBOX_LEASE_BEBAS`: `lease_owner IS NULL OR lease_expires_at
<= now()`). Jadi pemulihannya **otomatis dan tidak butuh intervensi**: jalankan
worker lagi setelah `--lease-ms` terlampaui.

Yang membuat ini aman adalah fencing, bukan kehati-hatian handler. Handler
berjalan di dalam transaksi yang mengunci baris dan memverifikasi kepemilikan
lease di depan dan di belakang; bila lease sudah diambil alih, UPDATE penutup
mengenai nol baris, transaksi rollback **termasuk seluruh efek samping handler**,
dan barisnya diproses ulang oleh pemilik baru. Statistikan keadaan itu sebagai
`kehilanganLease`.

Handler yang lambat namun hidup tidak kehilangan pekerjaannya: fencing
membandingkan **kepemilikan** (`lease_owner`), bukan waktu, dan `SKIP LOCKED`
mencegah reclaim selama barisnya masih terkunci transaksi yang hidup.

---

## 4. Memeriksa dead-letter

```bash
npm run outbox:replay -- list              # 20 terbaru
npm run outbox:replay -- list --limit 100
npm run outbox:replay -- count
```

`npm run outbox:replay` adalah alias dari `tsx scripts/replay-outbox.ts`.
`npx tsx scripts/replay-outbox.ts <perintah>` setara; pakai bentuk mana pun
yang konsisten dengan kebiasaanmu.

Contoh keluaran `list`:

```console
$ npm run outbox:replay -- list --limit 20
325822cf-cea9-4ac2-b38f-a9e8f46165f7  attestation.issued  attestation/uji-att-1  kode=handler_tidak_terdaftar  attempts=1  dead=2026-09-26T01:21:50.312Z
```

Formatnya: `id  type  aggregateType/aggregateId  kode=<last_error_code>
attempts=<n>  dead=<dead_lettered_at ISO>`. Payload **tidak** dicetak — ia
sudah ter-redact, tetapi tidak ada alasan menyalin isi antrean ke terminal
bersama.

`count` mencetak satu baris dan memberi sinyal yang bisa dipakai cron:

```console
$ npm run outbox:replay -- count
dead-letter=1        # exit 2

$ npm run outbox:replay -- count
dead-letter=0        # exit 0
```

### Kode galat yang akan kamu lihat

| Kode | Arti | Tindakan |
|---|---|---|
| `handler_tidak_terdaftar` | tipe event tidak ada di registry handler | lihat §6; jangan replay kecuali penyebabnya sudah hilang |
| `payload_tidak_valid` | payload tidak memuat field yang diwajibkan handler (mis. `userId` untuk `auth.registered`) | permanen — perbaiki penulis event, bukan replay |
| `gagal_sementara` | galat tak terduga dari handler (mis. database), termasuk kegagalan sink yang tidak punya kode sendiri | perbaiki penyebabnya dulu, baru replay |

Daftar ini adalah **seluruh** kode yang bisa muncul hari ini: hanya
`handler_tidak_terdaftar` (dari worker) dan `payload_tidak_valid` (dari handler
`auth.registered`) yang punya kode khusus; sisanya jatuh ke `gagal_sementara`.
Tidak ada kode khusus untuk "sink sedang diproses" di versi kode ini.

`last_error_code` hanya memuat **kode**, tidak pernah pesan galat. Ini
disengaja: barisnya permanen dan pesan driver PostgreSQL dapat memuat nilai
kolom yang berupa PII.

---

## 5. Replay

```bash
npm run outbox:replay -- replay <event-uuid> \
  --actor <admin-user-uuid> \
  --reason "sink diperbaiki di #1234"
```

Semua argumen wajib. Replay adalah **keputusan ber-audit**, bukan tombol:

- `--actor` harus uuid **user admin yang aktif**. CLI memeriksa itu di database:
  user harus berstatus `active` **dan** memegang role `admin` yang belum
  dicabut (`user_roles.revoked_at IS NULL`). UUID yang bukan admin aktif
  ditolak dengan `aktor_bukan_admin`, walaupun bentuknya uuid yang sah dan
  usernya ada. Jalankan bootstrap admin dulu (§5, "Actor untuk replay").
- `--reason` wajib dan tidak boleh kosong atau hanya spasi. Event yang mati
  pernah gagal berkali-kali; ia kembali ke antrean hanya karena **seseorang
  memutuskan** keadaannya sudah berubah. Tanpa alasan tercatat, keputusan itu
  tidak bisa ditelusuri lagi.

Yang terjadi, semuanya dalam satu transaksi:

1. aktor diverifikasi sebagai admin aktif — ditolak bila bukan;
2. baris dibaca `FOR UPDATE`;
3. ditolak bila bukan dead-letter atau lease-nya masih aktif;
4. audit ditulis: aksi `outbox.replay`, `entity_type = outbox_event`,
   `entity_id = <id event>`, `payload_redacted` berisi `reason`, `type`,
   `error_code` (kode lama, disalin sebelum dibersihkan), dan `attempts` lama;
5. baris outbox dinormalkan: `dead_lettered_at`, `processed_at`,
   `last_error_code` dibersihkan, `attempts = 0`, `available_at = now()`,
   lease dilepas.

Baris audit yang tertulis berbentuk:

```text
action      = outbox.replay
actor_user_id = <uuid admin aktif yang diberikan lewat --actor>
entity_type = outbox_event
entity_id   = <uuid event yang di-replay>
payload_redacted = {"reason": "<alasan>", "type": "<tipe event>",
                    "error_code": "<kode galat saat mati>", "attempts": <n>}
```

Riwayat "kenapa dulu mati" tetap terjawab dari tabel audit walaupun kolom di
baris outbox sudah dibersihkan.

**Efek samping yang sudah `succeeded` tidak digandakan pada sink internal.** Replay menormalkan
baris event, tetapi baris `outbox_deliveries` yang `succeeded` tidak disentuh;
handler melewati sink yang sudah selesai (untuk sink eksternal lihat batas §6). Itu yang membuat replay aman
untuk event yang mati *setelah* sebagian sinknya berhasil.

### Penolakan yang benar

| Perintah | Hasil |
|---|---|
| `replay <uuid yang sudah selesai> ...` | `[replay] GAGAL: event bukan dead-letter (mungkin sudah selesai atau masih pending).` |
| `replay <uuid pending> ...` | sama; event pending akan diklaim sendiri oleh worker |
| `replay <uuid ber-lease aktif> ...` | `[replay] GAGAL: event sedang diproses worker lain (lease masih aktif); coba lagi nanti.` |
| `replay bukan-uuid ...` | `[replay] GAGAL: id event atau id aktor bukan uuid yang sah.` |
| `replay <uuid> --actor <uuid non-admin> ...` | `[replay] GAGAL: id aktor bukan admin aktif; bootstrap admin pertama sebelum replay.` |
| `replay <uuid> --actor ... --reason ''` | `[replay] GAGAL: Alasan replay wajib diisi.` |
| `replay <uuid yang tidak ada> ...` | `[replay] GAGAL: event tidak ditemukan.` |

Semua kegagalan itu keluar dengan exit code `1`. Replay yang berhasil mencetak
`[replay] event <id> kembali ke antrean. Audit outbox.replay tertulis.`

Tidak ada replay massal. Untuk membersihkan beberapa event, jalankan perintah
ini satu per satu dengan alasan masing-masing — itu memang tujuannya.

### Actor untuk replay

`--actor` butuh uuid dari user yang sudah ada; kolom
`audit_events.actor_user_id` adalah foreign key ke `users.id`. Database yang
baru dimigrasikan tidak punya admin sama sekali, sehingga `gateAdmin()` tidak
pernah lulus dan tidak ada id yang bisa dipakai. Selesaikan itu lebih dulu:

```bash
# User harus SUDAH terdaftar lewat alur normal (/daftar) — CLI ini tidak
# membuat akun dan tidak menerima password.
npx tsx scripts/bootstrap-admin.ts --list-candidates
npx tsx scripts/bootstrap-admin.ts admin@contoh.test            # default: admin
npx tsx scripts/bootstrap-admin.ts --user-id <uuid> --role admin
```

Bootstrap admin **tidak punya `npm run` script, dan itu disengaja** — ia
sengaja panjang supaya tidak ikut terpanggil gate build/deploy atau disalin
orang tanpa membaca. Hanya `worker` dan `outbox:replay` yang punya alias npm.
Prosedur lengkapnya, termasuk mengapa audit bootstrap memakai `actor_user_id`
`null`, ada di `docs/local-db.md` §3b.

---

## 6. Batas jaminan: efek samping eksternal vs idempotensi provider

Ini bagian yang paling mudah diklaim berlebihan, jadi batasnya ditulis apa
adanya. Acceptance M1A yang direvisi membuktikan fondasi dan sink audit internal;
attestation, email, dan file scan tetap merupakan gerbang pada fase pemiliknya,
bukan bukti yang sudah ada ataupun prasyarat kelulusan M1A.

Yang **dijamin**:

- **Atomisitas pada alur yang memakai writer.** Perubahan bisnis dan baris
  `outbox_events` ditulis dalam transaksi PostgreSQL yang sama (`tulisOutbox` /
  `jalankanDenganOutbox`). Registrasi pengguna adalah alur bisnis yang sudah
  memakai writer: bila transaksinya rollback, event ikut rollback. Alur bisnis
  lain baru mendapat jaminan ini setelah diintegrasikan dengan writer;
  `src/lib/outbox/writer.integration.test.ts` menguji kontrak; `src/lib/auth/auth-service.integration.test.ts` menguji registrasi → event.
- **Satu klaim per event pada satu waktu.** `SELECT ... FOR UPDATE SKIP LOCKED`
  + lease membuat dua worker tidak bisa memproses baris yang sama bersamaan.
- **Pemrosesan dengan retry, bukan janji delivery tanpa batas.** Crash, lease
  kedaluwarsa, atau replay dapat membuat event dicoba lebih dari sekali; event
  juga dapat berakhir di dead-letter setelah batas percobaan atau galat
  permanen. Operator perlu menilai dan me-replay-nya agar diproses lagi.

Yang **tidak** dijamin, dan harus dinyatakan:

**`exactly-once` tidak dijanjikan.** Deduplikasi efek samping bergantung pada
sink-nya:

- **Sink internal** (satu database, transaksi yang sama) — mis. `audit` —
  mendapat **at-most-once** yang nyata. Baris ledger `outbox_deliveries` ditulis
  `in_progress` **sebelum** efek samping lalu di-`succeeded` dalam transaksi
  yang sama dengan efeknya; bila transaksi gagal, barisnya ikut hilang dan
  percobaan berikutnya boleh jalan; bila berhasil, baris `succeeded` membuat
  eksekusi ulang melewati efek sampingnya. Yang menjaga satu baris per
  `(event_id, sink)` adalah **primary key komposit** tabel itu — bukan unique
  parsial. Serialisasi dua eksekusi yang bersamaan datang dari `SELECT ... FOR
  UPDATE` pada baris ledger, bukan dari index: `onConflictDoNothing` saat insert
  dan `WHERE status <> 'succeeded'` saat mengambil alih baris `failed`/`
  in_progress` yang membuat satu eksekusi menang dan yang lain melewati efek
  sampingnya.
- **Sink eksternal** (email, penyimpanan objek, API pihak ketiga) — baris ledger
  `succeeded` saja **tidak** menyelesaikan jendela ini: provider sudah
  melakukan efeknya, lalu proses mati sebelum transaksi commit. Ledger belum
  mencatat apa-apa, dan retry akan mengirim ulang. Yang benar-benar menutupnya
  adalah **kunci idempotensi yang dikenali provider** (id pesan, header
  `Idempotency-Key`). Tanpa itu, handler hanya boleh dijalankan bila operator
  menerima kemungkinan duplikat.

Keadaan yang berlaku hari ini:

| Sink | Status di kode | Handler terdaftar | Gerbang sebelum production |
|---|---|---|---|
| `audit` (internal, satu database) | ada — satu-satunya sink | ya — `auth.registered` | bagian M1A |
| Email transaksional | **tidak ada** di kode | tidak | sebelum alur verifikasi/undangan email diaktifkan (plan Fase 1 dan 5) |
| Attestation issuance/revocation | **tidak ada** di kode | tidak | Fase 3, sebelum credential diterbitkan |
| File scan / thumbnail | **tidak ada** di kode | tidak | Fase 4, sebelum upload production dibuka |

Baris "tidak ada di kode" berarti literal: tidak ada nilai sink, handler, atau
tipe event untuk ketiganya di `handlers.ts`. Tidak ada yang bisa ditest, dan
tidak ada kode mati yang menunggu diaktifkan.

Handler `attestation.*` dan `file.scan` **sengaja belum terdaftar**: tabel
sumbernya belum ada di Fase 1A, dan mengklaim efek samping tanpa sumber
kebenaran adalah kebohongan. Karena tipe tanpa handler adalah kegagalan
terminal, bukan no-op, event semacam itu mati dengan
`handler_tidak_terdaftar` — lambang yang terlihat, bukan sukses yang tenang.

**Acceptance M1A yang direvisi berlaku untuk audit internal.** Uji integrasi
membuktikan transaksi bisnis dan event outbox atomik; duplicate delivery,
retry sesudah kegagalan handler sementara, dan pemulihan lease tidak
menggandakan baris audit `user.registered`. Crash sesudah claim disimulasikan
dengan lease kedaluwarsa; uji yang ada tidak membunuh proses OS saat operasi
berlangsung atau mensimulasikan timeout provider. Ini
**tidak** membuktikan exactly-once untuk sink jaringan.

Attestation, email, dan file scan **belum diterapkan** dan bukan prasyarat
kelulusan M1A yang direvisi. Masing-masing merupakan gerbang sebelum credential
Fase 3, alur email terkait, dan upload production Fase 4 diaktifkan. Handler
baru hanya boleh didaftarkan bila sumber bisnis/transisi status otoritatif ada,
payload disaring dari secret dan PII yang tidak perlu sebelum insert, kunci
idempotensi deterministik diteruskan serta dihormati tujuan efek samping, dan
uji integrasi membuktikan timeout/retry, replay, serta crash **sesudah efek
berhasil tetapi sebelum status delivery commit** tidak menggandakan efek.
Tanpa kemampuan deduplikasi downstream atau mitigasi setara yang terbukti,
rilis fitur terkait tetap diblokir sampai keputusan risiko tersendiri; jangan
mengubah tipe tanpa handler menjadi no-op untuk membuat gate tampak hijau.

Untuk dedupe lintas *event* (bukan lintas retry), jangan mengarang tabel baru:
tambahkan kunci deterministik di `outbox_events.idempotency_key` (unique) dan
buat handler idempoten terhadapnya. Kunci acak selalu lolos dan tidak menjamin
apa pun.

---

## 7. Produksi — belum, dan alasannya

Tidak ada prosedur deploy di halaman ini karena tidak ada yang bisa di-deploy.

| Yang belum diputuskan | Di mana |
|---|---|
| VPS belum dibeli/diprovision; worker tidak jalan di M0 | ADR 0001 §1.0 |
| Pemicu worker di VPS (systemd timer / cron / container / platform job) | `[TBD]`, ADR 0001 §11.3 butir 2 |
| Bentuk proses: `tsx`, `node`, atau container | `[TBD]` |
| Region, owner, RTO/RPO | `[REGION]`, `[OWNER]`, `[TBD]` — ADR 0001 §2, §3, §7 |
| Angka lease/attempt untuk sink jaringan | `[TBD]`; diturunkan saat sink itu dibuat |
| Metrics, tracing, alerting worker lag | Fase 5, plan §9 butir 3–4 |

Yang sudah pasti dan tetap berlaku bila worker dipindah ke VPS:

- Worker memakai `DATABASE_URL` yang sama dengan aplikasi. Di produksi, env
  kosong berarti worker **gagal** — ia melempar `DatabaseUrlError`, tidak jatuh
  ke kredensial dev (`src/lib/db/client.ts`).
- VPS adalah satu titik kegagalan: satu node berarti matinya API, worker, dan
  database sekaligus (ADR 0001 §1.1 butir 3).
- `--owner` wajib unik begitu ada lebih dari satu worker atau mesin.

---

## 8. Observability hari ini

Belum ada metrics, tracing, atau dashboard; itu Fase 5 (plan §9). Yang ada
sekarang: log worker, dua query, dan exit code.

Pertanyaan pertama saat ada keluhan "event tidak jalan" adalah **apakah worker
hidup dan antreannya mengalir**. Tanpa dashboard, jawab dengan query:

```bash
# Berapa yang masih pending, dan yang tertua sejak kapan?
docker compose exec postgres psql -U careevo -d careevo -c "
  select count(*) filter (where processed_at is null and dead_lettered_at is null) as pending,
         min(occurred_at) filter (where processed_at is null and dead_lettered_at is null) as pending_tertua,
         count(*) filter (where dead_lettered_at is not null) as dead_letter
  from outbox_events"
```

Cara membaca hasilnya:

- `pending` besar dan `pending_tertua` lama → worker tidak jalan, atau berhenti
  karena satu handler lambat/macet.
- `dead_letter` naik → ada sink yang rusak sistematis; periksa kode galatnya
  dengan `list` sebelum me-replay apa pun.
- `attempts` pada satu event terus bertambah tanpa pernah selesai → sink-nya
  rusak; retry tidak akan menolong, replay juga tidak.

Sinyal yang tersedia untuk cron:

| Sinyal | Perintah | Arti |
|---|---|---|
| Ada dead-letter | `npm run outbox:replay -- count` (exit `2`) | butuh perhatian operator |
| Dead-letter pada satu run | `npm run worker` (exit `2`) | ada yang mati saat itu |
| Statistik per run | `npm run worker -- --json` | untuk log/alerting |

Yang perlu dipantau (lihat komentar di `scripts/worker.ts`): `gagalTerminal`
naik, dan `gagalSementara` terus bertambah **untuk event yang sama** — yang
kedua menandakan sink rusak, bukan beban tinggi.

Satu hal yang **tidak** berlaku di sini, dan sering dikira berlaku: cache
per-proses. `data/courses.json` punya cache per proses, sehingga proses kedua
yang menulisnya tidak terlihat oleh `next dev` yang sudah lama berjalan sampai
restart (ADR 0001 §11.4). Outbox **tidak** seperti itu — ia tabel PostgreSQL, jadi
setiap proses membaca keadaan yang sama saat query dijalankan. Baris outbox yang
baru ditulis langsung terlihat oleh worker; tidak ada restart yang dibutuhkan.

Konsekuensi praktisnya justru sebaliknya: bila kamu melihat "event tidak jalan",
itu **bukan** cache. Periksa hal lain yang lebih mungkin — worker tidak
dijalankan sama sekali, `DATABASE_URL` menunjuk database berbeda dari yang
dibaca aplikasi, atau `available_at` masih di masa depan karena backoff.

---

## 9. Verifikasi

Tidak ada satu pihak yang menjalankan semuanya. Bagian ini memisahkan apa yang
diverifikasi koordinator di checkout utama, apa yang diverifikasi sesi agen di
basis kode pra-final, dan apa yang belum diverifikasi sama sekali.

### Diverifikasi koordinator di checkout utama

Yang dijalankan di sana, terhadap PostgreSQL dev:

| Yang dijalankan | Hasil yang diamati |
|---|---|
| `npm run worker -- --once --json` | berjalan; antrean kosong, `diklaim=0` |
| `npm run outbox:replay -- count` | `dead-letter=0`, exit `0` |
| `npx tsx scripts/bootstrap-admin.ts --list-candidates` | daftar kandidat dengan status dan penanda `admin` |

Itu **bukan** verifikasi jalur CLI yang lengkap. Yang belum dijalankan oleh
koordinator: worker pada event nyata, `list`, dan `replay` sungguhan.
Gate test yang dijalankannya ada di bagian "Bukti test" di bawah.

### Diverifikasi dari sesi agen

Sesi agen menjalankan CLI terhadap **PostgreSQL dev yang sama**, dengan
`outbox_events` yang di-seed manual, lalu menghapus kembali event, audit, dan
grant-nya. Ini **bukan** log sesi koordinator dan bukan verifikasinya; ini
catatan sesi agen yang dijalankan di direktori checkout utama dan di worktree
agen:

| Lokasi bukti | Yang dijalankan |
|---|---|
| Direktori checkout utama (sesi agen, setelah worktree-nya dihapus) | worker pada event nyata (sukses + dead-letter), mode loop, `list`, `count`, `replay` sukses, replay non-admin, replay pada event selesai, `--batch 0`, `bootstrap-admin --list-candidates`, `bootstrap-admin <email>` + idempotensinya |
| Worktree agen lain | worker pada event nyata, `list`, `count`, `replay`, `--batch 0` |

Yang diamati dari jalur itu:

- `npm run worker -- --once` dan mode loop pada event nyata: tipe tanpa handler
  mati `handler_tidak_terdaftar`; mode loop dengan dead-letter exit `2`,
  sedangkan `--once` exit `0` (§2).
- `npm run outbox:replay -- list --limit 20` menampilkan satu baris per event
  dengan format di §4.
- `replay` pada event selesai/pending, uuid tidak ada, dan alasan kosong
  ditolak dengan pesan di §5.
- `npx tsx scripts/bootstrap-admin.ts <email>` memberi grant + audit
  `user_role.bootstrapped`, dan mengulangnya tidak menulis perubahan kedua.
- `npm run worker -- --batch 0` ditolak sebelum menyentuh database.

Satu koreksi penting soal guard aktor: jalur CLI itu diuji di atas basis kode
pra-final, dan versi awal `replay.ts` belum punya pemeriksaan "aktor harus admin
aktif". Karena itu replay lewat CLI **tidak** membuktikan guard tersebut. Yang
membuktikannya adalah `npm run test:db` di checkout utama, lewat
`src/lib/outbox/replay.integration.test.ts` — test-nya memanggil
`replayDeadLetter` langsung dan menegaskan `aktor_bukan_admin` untuk user tanpa
role admin **dan** untuk admin yang `revoked_at` sudah terisi. Pesan CLI
`id aktor bukan admin aktif` berasal dari peta pesan di
`scripts/replay-outbox.ts` dan belum diuji end-to-end lewat CLI.

Konsekuensi kepercayaan: **perilaku CLI di §2–§5 adalah perilaku yang diobservasi
di sesi agen pada basis kode pra-final**, bukan hasil verifikasi ulang terhadap
API final. Tidak ada baris di tabel bagian ini yang berasal dari verifikasi
koordinator — verifikasinya hanya tiga perintah CLI di tabel sebelumnya.
Perlakukan halaman ini sebagai dokumentasi perilaku yang diobservasi, bukan
sebagai hasil test yang bisa dipanggil ulang dengan satu perintah.

### Bukti test

Gate penuh checkout utama lulus, dengan angka yang dilaporkan koordinator:

| Perintah | Cakupan | Hasil |
|---|---|---|
| `npm run check` | typecheck + lint + skills:check + test | **991/991** lulus |
| `npm run build` | build produksi (gerbang boundary client/server) | lulus |
| `npm run test:db` | suite integrasi database, satu run penuh | **125/125** lulus di 8 berkas test |

`test:db` menjalankan **seluruh** berkas `src/**/*.integration.test.ts` dalam
satu run (config-nya `fileParallelism: false`, jadi berurutan) — delapan berkas,
lima di antaranya di luar outbox: schema, auth-service, authorization,
invitation, dan session-rotation. Suite outbox — `outbox.test.ts` sebagai unit,
lalu `writer`/`worker`/`replay` sebagai integrasi — ikut di dalamnya.

Angka-angka itu snapshot pada satu run, bukan jaminan yang tetap: suite masih
ditambah. Jalankan sendiri untuk angka terkini.

Yang dicakup test integrasi outbox:

| Acceptance criteria plan §6 (sink audit internal M1A) | Test |
|---|---|
| Transaksi gagal tidak meninggalkan event; alur yang memakai writer (`daftarPengguna`) selalu punya event | `writer.integration.test.ts` — atomisitas, idempotensi kunci, redaksi payload; `auth-service.integration.test.ts` — registrasi → event |
| Duplicate delivery dan retry tidak menggandakan efek samping audit | `worker.integration.test.ts` — idempotensi ledger, retry lalu sukses dengan audit tepat sekali |
| Lease kedaluwarsa dapat dipulihkan aman oleh worker lain | `worker.integration.test.ts` — reclaim, tidak mencuri lease aktif, fencing menolak penutupan |
| Event gagal terminal dapat ditemukan dan direplay dengan actor/reason tercatat | `replay.integration.test.ts` — pencarian, penolakan yang benar (termasuk actor bukan admin), `outbox.replay` |

Uji ini tidak mencakup jendela crash sesudah provider eksternal berhasil tetapi
sebelum ledger commit; bukti tersebut wajib tersedia pada fase tiap sink
sebelum fitur production terkait dibuka (§6).

### Klaim paralel antar owner — apa yang diuji, dan apa batasnya

Tiga test di `worker.integration.test.ts` menjalankan **dua worker ber-`owner`
berbeda secara paralel** lewat `Promise.all` dari **satu proses**:

1. dua klaim paralel atas **satu** event — total klaim tepat satu, tidak ada
   `kehilanganLease`, `attempts` naik sekali, audit dan baris ledger masing-masing
   tepat satu;
2. dua klaim paralel atas **dua** event dengan `batchSize: 1` — tiap event
   diklaim satu worker, tiap user mendapat satu audit;
3. dua worker paralel **merebut lease kedaluwarsa** (mensimulasikan worker yang
   mati) — satu pemenang, `attempts` naik dari 1 ke 2 tepat sekali, satu audit.

Batasnya, dan ini penting: itu **bukan** dua proses OS atau dua mesin. Kedua
klaim lahir dari event loop Node yang sama, jadi yang dibuktikan adalah
`FOR UPDATE SKIP LOCKED` dan fencing lease pada level database. Yang **tidak**
dibuktikan: perilaku dengan proses terpisah, koneksi/pool terpisah, latensi
jaringan, atau dua mesin dengan `owner` yang kebetulan sama. Untuk menjalankan
worker sungguhan di dua tempat, lihat peringatan `--owner` di §2.

### Caveat: eksekusi Vitest bersamaan

Ada satu catatan sejarah dari sesi agen: ketika beberapa proses Vitest
dijalankan **bersamaan** (beberapa perintah `vitest run` atas berkas yang sama,
saling tumpang tindih, bukan satu `npm run test:db`), satu test worker pernah
gagal sekali. Config integrasi sudah menetapkan `fileParallelism: false` dan
memakai satu database ephemeral bersama, jadi itu adalah efek menjalankan dua
runner terpisah — **bukan bukti bahwa suite ini flaky.** Run penuh tunggal
lulus, dan pengulangan suite outbox sendirian juga lulus.

Aturan praktisnya tetap: jangan menjalankan dua `vitest --config
vitest.integration.config.mts` bersamaan terhadap database yang sama. Satu gate
tunggal, seperti yang dipakai `npm run test:db`.

### Yang belum diverifikasi

- **Eksekusi worker di VPS atau produksi** — §7.
- **Efek samping eksternal (email, attestation, file scan)** — tidak ada
  implementasinya, jadi tidak ada yang bisa diuji (§6). Tidak ada kode
  pengiriman email ataupun bukti idempotensi provider. Ketiganya merupakan
  gerbang fase pemiliknya sebelum fitur production diaktifkan, bukan bukti
  kelulusan M1A yang direvisi; jangan mengklaim efeknya tidak terduplikasi.
- **Dua proses atau dua mesin nyata.** Klaim paralel sudah diuji, tetapi dari
  **satu proses** dengan dua `owner` berbeda lewat `Promise.all`; bukan dua
  proses OS terpisah, bukan dua mesin, dan bukan dua pool koneksi terpisah.
  Lihat "Klaim paralel antar owner" di atas untuk apa yang tepatnya dibuktikan.
  Uji dua proses nyata belum ada.
- **Alerting berkelanjutan** — belum ada mekanismenya (§8).
- **Guard aktor admin lewat CLI.** Logikanya diuji di `test:db`
  (`replay.integration.test.ts`), tetapi jalur CLI-nya — pesan
  `id aktor bukan admin aktif` dan exit code-nya — belum dijalankan
  end-to-end dengan actor non-admin.
- **Jalur CLI dari checkout bersih** (`npm ci` di direktori baru) — jalur CLI
  diuji di sesi agen, dan gate test di checkout utama, tetapi tidak ada yang
  menjalankan keduanya dari `npm ci` di direktori baru.
- **Bootstrap admin lewat mailbox eksternal.** CLI memverifikasi user sudah
  terdaftar dan berstatus `active` di database, tetapi **tidak** memverifikasi
  kepemilikan email: tidak ada mail server yang dihubungi, tidak ada tautan
  konfirmasi yang dikirim, dan tidak ada kode di repo ini yang membuktikan
  alamat email itu benar-benar dikendalikan pendaftar. Siapa pun yang bisa
  mendaftar dengan alamat tertentu lalu menaikkan role-nya lewat CLI akan
  mendapat role itu; yang menahan penyalahgunaan adalah kontrol akses database,
  bukan verifikasi email.

---

## 10. Pemecahan masalah

**`[worker] GAGAL: <pesan>` lalu proses keluar** — cek PostgreSQL hidup
(`docker compose ps`) dan `DATABASE_URL` benar. Lihat `docs/local-db.md`
§1 dan §2.

**Worker melaporkan `diklaim=0` padahal ada event** — event-nya mungkin belum
waktunya diproses (`available_at` di masa depan karena backoff yang belum
habis), masih di-lease worker lain yang belum kedaluwarsa, atau sudah
selesai/mati. Query di §8 memisahkan ketiganya.

**`[replay] GAGAL: event sedang diproses worker lain`** — lease-nya masih
aktif. Tunggu sampai `lease_expires_at` lewat, lalu coba lagi. Jangan
menjalankan replay berulang sebagai pengganti menunggu.

**`[replay] GAGAL: event bukan dead-letter`** — uuid-nya menunjuk event yang
sudah selesai atau masih pending. Ambil id dari `list`, bukan dari ingatan.

**Event terus kembali ke dead-letter sesudah di-replay** — replay memberi
anggaran percobaan baru, tetapi tidak memperbaiki penyebabnya. Bila kode
galatnya `handler_tidak_terdaftar`, replay tidak akan pernah berhasil sampai
handler untuk tipe itu didaftarkan (§6). Bila `payload_tidak_valid`, penulis
event-nya yang harus diperbaiki.

**`npm run bootstrap:admin` gagal** — script itu memang tidak ada, dan itu
disengaja. Pakai `npx tsx scripts/bootstrap-admin.ts`; lihat
`docs/local-db.md` §3b.

**Worker berjalan berdampingan dengan `next dev`** — keduanya penulis ke
database yang sama, jadi itu normal. Yang tidak normal adalah mengarahkan
store file (`CAREERS_DATA_DIR`, `CAREEVO_PERFORMA_DIR`) ke direktori repo
saat menjalankan test; test sudah mengalihkannya sendiri ke direktori
sementara.

---

## Referensi

- `docs/backend-production-plan.md` §6 (Fase 1A), §9 (Fase 5), §11 (peta modul),
  §12 (strategi test), §13 (milestone)
- `docs/adr/0001-topologi-deployment-produksi.md` §1.0, §1.1, §1.2, §11.3, §11.4
- `docs/local-db.md` — PostgreSQL lokal, migrasi, dan §3b bootstrap admin
- `src/lib/outbox/writer.ts` — penulisan event di dalam transaksi bisnis
- `src/lib/outbox/worker.ts` — claim, lease, backoff, dead-letter
- `src/lib/outbox/handlers.ts` — registry handler, ledger sink, batas idempotensi
- `src/lib/outbox/replay.ts` — pencarian dead-letter dan replay ber-audit
- `.agents/skills/careevo-review` — checklist sebelum commit
