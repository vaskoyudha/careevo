/**
 * Mint satu cookie sesi untuk verifikasi HTTP manual.
 *
 * Pakai: `npx tsx scripts/seed/konten/sesi-verifikasi.mts user@careevo.test`
 *
 * Mencetak baris `ls_session=<token>` ke stdout. Hanya untuk mesin lokal:
 * memakai akun demo (`DEMO_MODE=1` + `NODE_ENV=development`).
 */

import { readFileSync } from "node:fs";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, findDemoAccount } from "@/lib/auth/demo-accounts";
import { authenticatePengguna } from "@/lib/auth/auth-service";

const env = process.env as unknown as Record<string, string | undefined>;
env.NODE_ENV ??= "development";
for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (cocok) env[cocok[1]] ??= cocok[2].replace(/^["']|["']$/g, "");
}

const email = process.argv[2]?.trim() ?? "user@careevo.test";
if (!findDemoAccount(email)) {
  console.error(`Bukan akun demo. Pilihan: ${DEMO_ACCOUNTS.map((a) => a.email).join(", ")}`);
  process.exit(1);
}

const masuk = await authenticatePengguna({ email, password: DEMO_PASSWORD, izinkanDemo: true });
if (!masuk.token || !masuk.hasil.ok) {
  console.error(`Login gagal: ${JSON.stringify(masuk.hasil)}`);
  process.exit(1);
}
console.log(`ls_session=${masuk.token}`);
