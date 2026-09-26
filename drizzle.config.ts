import { defineConfig } from "drizzle-kit";

/**
 * Konfigurasi drizzle-kit (generate + migrate lewat CLI, bila dipakai).
 *
 * `db:generate` **tidak** memerlukan database yang hidup — ia hanya membaca
 * `schema.ts` dan menulis SQL ke `drizzle/`. `db:migrate` justru menjalankan
 * SQL itu, dan itu dilakukan lewat `scripts/migrate.ts` (migrator
 * programmatic), bukan lewat `drizzle-kit migrate`, supaya jalur yang sama
 * dipakai oleh CLI dan oleh setup test integrasi.
 *
 * URL di bawah hanya dipakai bila seseorang menjalankan drizzle-kit yang
 * memang butuh koneksi. Ia dibaca dari env yang sama dengan runtime
 * (`TEST_DATABASE_URL` menang, lihat `src/lib/db/client.ts`) dan punya
 * fallback dev yang sama supaya `npm run db:generate` tetap jalan tanpa `.env`.
 */
const DATABASE_URL_DEV = "postgres://careevo:careevo_dev@localhost:5432/careevo";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? DATABASE_URL_DEV,
  },
  strict: true,
  verbose: true,
});
