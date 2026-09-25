# Database lokal (PostgreSQL)

Fase 1 (`docs/backend-production-plan.md` §5) memindahkan identity dari cookie
ke PostgreSQL. Halaman ini adalah prosedur menjalankan dan menguji database itu
di mesin lokal. Produksi memakai managed PostgreSQL — topologi dan providernya
belum diputuskan, lihat `docs/adr/0001-topologi-deployment-produksi.md`.

Kredensial di bawah adalah nilai **dev** yang sudah dipublikasikan di
`docker-compose.yml`. Keduanya bukan secret dan tidak boleh dipakai di
deployment mana pun.

## 1. Menyalakan PostgreSQL

```bash
docker compose up -d postgres           # 5432:5432, user/db: careevo
docker compose ps                       # tunggu status "healthy"
docker compose logs -f postgres         # bila tidak kunjung sehat
```

Healthcheck-nya `pg_isready`, jadi `healthy` berarti benar-benar siap menerima
koneksi — bukan sekadar container-nya hidup. Data disimpan di volume bernama
`careevo_pgdata`, sehingga `docker compose down` tidak menghapusnya.

`docker compose up` **tanpa** nama service akan menyalakan semua service yang
ada di berkas itu; saat ini hanya `postgres`, tapi menuliskan namanya membuat
perintahnya tetap benar bila nanti ada tambahan.

## 2. `DATABASE_URL`

Aplikasi membaca env ini lewat `src/lib/db/client.ts`:

- `TEST_DATABASE_URL` menang atas `DATABASE_URL` bila keduanya terisi.
- Di luar produksi, keduanya kosong → fallback
  `postgres://careevo:careevo_dev@localhost:5432/careevo`.
- Di produksi (`NODE_ENV=production`), kosong → **server menolak start**. Ini
  disengaja: fallback dev adalah kredensial publik di repositori, jadi
  membiarkannya berlaku di produksi berarti siapa pun bisa menyambung.

Jadi untuk pengembangan biasa kamu **tidak perlu** membuat `.env` sama sekali;
`npm run dev` dan `npm run test:db` sudah menunjuk database dev di atas.
Buat `.env.local` hanya bila ingin menunjuk server lain:

```bash
cp .env.example .env.local
# lalu isi DATABASE_URL (opsional; lihat blok "Database (PostgreSQL)")
```

## 3. Migrasi

Schema adalah kontrak bersama: **satu-satunya sumber kebenaran** ada di
`src/lib/db/schema.ts`, dan SQL-nya ada di `drizzle/` yang di-commit.

```bash
# 1. Ubah src/lib/db/schema.ts
# 2. Hasilkan SQL — tidak butuh database hidup
npm run db:generate

# 3. Baca SQL-nya sebelum menjalankan. Ini yang akan dipakai di produksi.
$EDITOR drizzle/0000_*.sql

# 4. Terapkan ke DATABASE_URL
npm run db:migrate
```

Dua hal yang mudah salah:

- **`drizzle/` harus di-commit.** SQL yang hanya hidup di memori tidak bisa
  di-review dan tidak bisa diputar ulang di produksi. `drizzle/` tidak masuk
  `.gitignore` — jangan tambahkan.
- **`db:generate` tidak menyentuh database, `db:migrate` menyentuhnya.**
  Generate yang aneh biasanya berarti schema-nya yang aneh, bukan databasenya.

Migrator-nya idempoten: ia mencatat migrasi yang sudah jalan di
`drizzle.__drizzle_migrations`, jadi `npm run db:migrate` boleh diulang.

Migrasi **maju saja**; tidak ada rollback otomatis. Untuk membatalkan sebuah
migrasi, tulis migrasi baru yang mengoreksinya. Menghapus berkas SQL yang sudah
pernah dijalankan akan membuat database lain (staging, produksi) berbeda dari
dev tanpa jejak.

### Melihat isi database

```bash
docker compose exec postgres psql -U careevo -d careevo -c '\dt'
docker compose exec postgres psql -U careevo -d careevo -c 'select id, email_normalized, status from users'
```

## 4. Test

```bash
npm test          # test unit — TIDAK butuh Docker
npm run test:db   # test integrasi — BUTUH PostgreSQL hidup
```

Pemisahannya bukan konvensi gaya, tapi kontrak nama berkas:

- Semua test integrasi bernama `*.integration.test.ts` dan dikecualikan di
  `vitest.config.mts`. Karena itu `npm test` tetap hijau di mesin tanpa Docker.
- `npm run test:db` memakai `vitest.integration.config.mts`, yang hanya
  meng-include pola itu dan memasang `globalSetup` dari
  `scripts/test-db-setup.ts`.

**Konsekuensinya:** test integrasi yang lupa memakai sufiks
`.integration.test.ts` akan ikut `npm test` biasa dan menggagalkan mesin yang
tidak punya database.

### Apa yang dilakukan setup

`scripts/test-db-setup.ts` berjalan sekali per `npm run test:db`:

1. Membuat basis data ephemeral bernama unik, `careevo_test_<seed>`, di server
   yang sama dengan `DATABASE_URL` (nama apa pun basis datanya diganti; yang
   dipakai adalah host/user/password-nya).
2. Menjalankan migrasi ke basis data itu — jalur yang sama dengan
   `npm run db:migrate`, jadi database test tidak bisa berbeda dari dev.
3. Menyerahkan URL-nya sebagai `TEST_DATABASE_URL` ke proses test.
4. `DROP DATABASE ... WITH (FORCE)` di teardown, termasuk saat suite gagal.

Basis data itu selalu baru, jadi test membuktikan **fresh install** dan tidak
dipengaruhi sisa run sebelumnya. Yang penting: database dev (`careevo`) tidak
pernah disentuh, jadi test yang menghapus baris atau melanggar constraint tidak
bisa merusak data kerjamu.

Bila PostgreSQL tidak hidup, `npm run test:db` **gagal dengan pesan yang
menyebut `docker compose up -d postgres`** — bukan di-skip. Test integrasi yang
di-skip akan tampak hijau dan menyembunyikan schema yang rusak.

Mengarahkan test ke server lain (mis. CI):

```bash
DATABASE_URL=postgres://user:pass@host:5432/careevo npm run test:db
```

Basis data ephemeral tetap dibuat di server itu dan tetap dihapus setelahnya;
user-nya butuh izin `CREATEDB`.

## 5. Reset

```bash
# Hapus semua data, schema tetap ada
docker compose exec postgres psql -U careevo -d careevo -c 'drop schema public cascade; create schema public;'
npm run db:migrate

# Nuklir: hapus container DAN volume, lalu mulai dari nol
docker compose down -v
docker compose up -d postgres
npm run db:migrate
```

`docker compose down` saja **tidak** menghapus data — volumenya bernama dan
sengaja dipertahankan. `-v` yang menghapusnya, dan itu tidak bisa dibatalkan.

## 6. Yang tidak berhubungan dengan database ini

Dua cache/penyimpanan berikut sering tertukar dengan "database", padahal
terpisah penuh. Kosongnya database PostgreSQL tidak menjelaskan keduanya, dan
sebaliknya.

- **Cache kursus per proses** (`src/lib/courses/storage.ts`). Kursus dan kuis
  ada di `data/courses.json` dan `data/kuis.json`, bukan di PostgreSQL.
  Cache-nya **per proses**: server `next dev` yang sudah lama berjalan tidak
  melihat kursus yang baru ditulis proses lain sampai ia di-restart. Restart
  server, bukan restart Postgres.
- **Toko file di `.data/`** (`src/lib/resume`, `src/lib/performa`). Resume,
  performa, dan berkas unggahan ada di filesystem, bukan di PostgreSQL.

`.data/` dan `data/` keduanya gitignored. PostgreSQL adalah tambahan di
sampingnya selama migrasi Fase 1 berjalan, bukan penggantinya.

## 7. Pemecahan masalah

**`Connection refused` / `ECONNREFUSED`** — Postgres belum siap atau port
5432 dipakai instance lain. `docker compose ps` untuk statusnya;
`docker compose logs postgres` untuk sebabnya. Port lain bisa dipakai dengan
mengubah `ports` di `docker-compose.yml` menjadi `"5433:5432"` lalu menunjuk
`DATABASE_URL` ke port itu.

**`database "careevo_test_..." already exists`** — sisa run yang mati di tengah
jalan. Setup sudah menjalankan `DROP DATABASE IF EXISTS ... WITH (FORCE)`
sebelum `CREATE`, jadi ini hanya muncul bila ada koneksi yang menahan drop.
Hentikan proses test lain, atau hapus manual:

```bash
docker compose exec postgres psql -U careevo -d postgres -c '\l' | grep careevo_test
docker compose exec postgres psql -U careevo -d postgres -c 'drop database "careevo_test_xxx" with (force)'
```

**`role "careevo" does not exist`** — kamu menyambung ke PostgreSQL lain, bukan
container di `docker-compose.yml` (mungkin Postgres host di port 5432). Cek
`DATABASE_URL` di `.env.local` dan port yang dipublikasikan container.

**`npm run db:migrate` bilang sukses tapi tabelnya tidak ada** — pemeriksaan
yang mudah menipu: migrator menulis ke `DATABASE_URL` yang dibacanya. Pastikan
URL yang dicetak skrip (password disamarkan) menunjuk database yang kamu
periksa:

```bash
docker compose exec postgres psql -U careevo -d careevo -c '\dt'
```
