/**
 * CLI bootstrap admin — `npx tsx scripts/bootstrap-admin.ts <email> [--role admin]`.
 *
 * Menutup utang review Fase 1 §6 butir 4: database produksi yang baru
 * dimigrasikan tidak punya admin sama sekali, sehingga `gateAdmin()` tidak
 * pernah lulus dan `buatUndanganAction`/`beriRoleAction` unreachable.
 *
 * **Tidak ada `npm run` script untuk ini, dan itu disengaja.** Utang aslinya
 * menuntut seed yang "tidak aktif otomatis di produksi"; memasukkannya ke
 * `package.json` akan membuatnya mudah ikut terpanggil oleh gate build/deploy
 * (yang menjalankan banyak script npm) atau oleh orang yang menyalin perintah
 * tanpa membaca. Perintahnya sengaja panjang supaya tidak tidak sengaja
 * dijalankan. Bila integrator memutuskan menambah `"bootstrap:admin"`, itu satu
 * baris di `package.json` — fungsi yang dipanggilnya sudah ada.
 *
 * Kenapa `tsx`, bukan `.mjs`: alasan yang sama dengan `scripts/migrate.ts` —
 * Node tidak bisa me-resolve import TS tanpa ekstensi, dan `tsc` repo ini
 * menolak spesifier `.ts`. `tsx` menyelesaikan keduanya sehingga skrip ini tetap
 * ikut `npm run typecheck`.
 *
 * Pemakaian:
 *
 * ```bash
 * # 1. User harus SUDAH terdaftar lewat alur normal (registrasi).
 * # 2. Baru naikkan role-nya:
 * npx tsx scripts/bootstrap-admin.ts admin@contoh.test
 * npx tsx scripts/bootstrap-admin.ts admin@contoh.test --role verifikator
 * npx tsx scripts/bootstrap-admin.ts --user-id <uuid>
 *
 * # Bila belum yakin siapa targetnya:
 * npx tsx scripts/bootstrap-admin.ts --list-candidates
 * ```
 *
 * Skrip ini hanya menyentuh `user_roles` + `audit_events`; ia tidak pernah
 * membuat user, tidak menyentuh password, dan tidak menerima role di luar
 * `admin`/`verifikator`.
 */

import { and, eq, isNull } from "drizzle-orm";

import { getDb, tutupDb } from "../src/lib/db/client";
import { sessions, users, userRoles } from "../src/lib/db/schema";
import {
  AKSI_AUDIT_BOOTSTRAP,
  ROLE_BOOTSTRAP_DEFAULT,
  ROLE_BOOTSTRAP_SAH,
  bootstrapRoleStaff,
  type TargetBootstrap,
} from "../src/lib/auth/bootstrap";
import { samarkanUrlDatabase } from "../src/lib/db/migrate";
import { ambilUrlDatabase } from "../src/lib/db/client";

type Argumen = {
  email?: string;
  userId?: string;
  role: string;
  listCandidates: boolean;
};

function parseArgumen(argv: string[]): Argumen {
  const hasil: Argumen = { role: ROLE_BOOTSTRAP_DEFAULT, listCandidates: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--role") {
      hasil.role = argv[++i] ?? "";
    } else if (arg === "--user-id") {
      hasil.userId = argv[++i] ?? "";
    } else if (arg === "--list-candidates") {
      hasil.listCandidates = true;
    } else if (arg.startsWith("--")) {
      throw new Error(`Argumen tidak dikenal: ${arg}`);
    } else if (!hasil.email) {
      hasil.email = arg;
    } else {
      throw new Error(`Argumen posisional berlebih: ${arg}`);
    }
  }
  return hasil;
}

function cetakPemakaian(): void {
  console.error(
    [
      "Pemakaian:",
      "  npx tsx scripts/bootstrap-admin.ts <email> [--role admin|verifikator]",
      "  npx tsx scripts/bootstrap-admin.ts --user-id <uuid> [--role admin|verifikator]",
      "  npx tsx scripts/bootstrap-admin.ts --list-candidates",
      "",
      "Catatan: user harus SUDAH terdaftar dan berstatus active.",
      "Skrip ini tidak membuat akun dan tidak menerima password.",
    ].join("\n"),
  );
}

/**
 * Menampilkan user yang sudah terdaftar sebagai bahan pertimbangan operator.
 *
 * Hanya `email_normalized` (bukan display name) dan statusnya; ini untuk
 * memilih target, bukan ekspor data. Password hash tidak pernah dibaca.
 */
async function daftarKandidat(): Promise<void> {
  const db = getDb();
  const baris = await db
    .select({ id: users.id, email: users.emailNormalized, status: users.status })
    .from(users)
    .orderBy(users.createdAt)
    .limit(50);

  if (baris.length === 0) {
    console.log(
      "[bootstrap-admin] Belum ada user sama sekali. Daftarkan akun lewat alur normal dulu, lalu jalankan ulang.",
    );
    return;
  }

  const admin = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(and(eq(userRoles.role, "admin"), isNull(userRoles.revokedAt)));
  const idAdmin = new Set(admin.map((a) => a.userId));

  console.log(`[bootstrap-admin] ${baris.length} user terdaftar:`);
  for (const u of baris) {
    console.log(`  ${u.id}  ${u.email}  status=${u.status}${idAdmin.has(u.id) ? "  admin" : ""}`);
  }
  const sesiAktif = await db.select({ id: sessions.id }).from(sessions).limit(1);
  console.log(
    sesiAktif.length > 0
      ? "[bootstrap-admin] Ada sesi aktif; user yang baru diberi role akan memakainya pada permintaan berikutnya."
      : "[bootstrap-admin] Belum ada sesi aktif.",
  );
}

async function main(): Promise<void> {
  const args = parseArgumen(process.argv.slice(2));

  console.log(`[bootstrap-admin] database: ${samarkanUrlDatabase(ambilUrlDatabase())}`);

  if (args.listCandidates) {
    await daftarKandidat();
    return;
  }

  if (!args.email && !args.userId) {
    cetakPemakaian();
    process.exitCode = 1;
    return;
  }
  if (args.email && args.userId) {
    console.error("[bootstrap-admin] Pilih salah satu: <email> atau --user-id, bukan keduanya.");
    process.exitCode = 1;
    return;
  }

  const role = args.role as (typeof ROLE_BOOTSTRAP_SAH)[number];
  if (!ROLE_BOOTSTRAP_SAH.includes(role)) {
    console.error(
      `[bootstrap-admin] Role tidak valid: ${args.role}. Pilihan: ${ROLE_BOOTSTRAP_SAH.join(", ")}.`,
    );
    process.exitCode = 1;
    return;
  }

  const target: TargetBootstrap = args.email ? { email: args.email } : { userId: args.userId! };
  const hasil = await bootstrapRoleStaff(target, role);

  if (!hasil.ok) {
    console.error(`[bootstrap-admin] GAGAL (${hasil.alasan}): ${hasil.pesan}`);
    process.exitCode = 1;
    return;
  }

  if (hasil.granted) {
    console.log(
      `[bootstrap-admin] role ${hasil.role} diberikan kepada ${hasil.email} (${hasil.userId}).`,
    );
    console.log(`[bootstrap-admin] audit: ${AKSI_AUDIT_BOOTSTRAP} entity_id=${hasil.userId}:${hasil.role}`);
  } else {
    console.log(
      `[bootstrap-admin] ${hasil.email} sudah memegang role ${hasil.role} — tidak ada perubahan, tidak ada audit baru.`,
    );
  }
  console.log(
    "[bootstrap-admin] Lanjutkan dengan login sebagai user itu; role berlaku pada permintaan berikutnya.",
  );
}

main()
  .catch(() => {
    // Jangan log pesan driver: unique/FK error dapat memuat email mentah.
    console.error("[bootstrap-admin] GAGAL: operasi database tidak berhasil.");
    console.error(
      "[bootstrap-admin] Pastikan PostgreSQL hidup (`docker compose up -d postgres`), " +
        "DATABASE_URL benar, dan migrasi sudah dijalankan (`npm run db:migrate`). Lihat docs/local-db.md.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    // Pool harus ditutup, kalau tidak proses CLI menggantung setelah selesai.
    await tutupDb();
  });
