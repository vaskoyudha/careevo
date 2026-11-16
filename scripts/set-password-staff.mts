/**
 * CLI set/ganti password satu akun staf — jalur pemulihan resmi.
 *
 * **Kapan dipakai.** Akun staf yang sudah terdaftar tapi tidak bisa dimasuki
 * karena passwordnya tidak diketahui. Kasus nyata yang memicu berkas ini:
 * `verifikator@careevo.test` ada di database produksi dengan role
 * `verifikator`, tetapi `password_hash`-nya adalah hash acak
 * `demo:<email>:<timestamp>` yang ditulis `pastikanUserDemo` — jalur login
 * demo tidak pernah memverifikasi lewat hash itu, dan di produksi
 * `findDemoAccount` menolak lebih dulu (`DEMO_MODE` tidak diset). Jadi akun itu
 * tampak "ada" tetapi tidak punya password yang dapat dipakai.
 *
 * **Kenapa bukan `DEMO_MODE`.** Menyalakan `DEMO_MODE` di produksi berarti
 * membuka login berpassword publik (`careevo`) — backdoor, dan dilarang
 * eksplisit oleh `.env.production.example`. Skrip ini justru kebalikannya:
 * satu password acak untuk satu email yang disebutkan operator.
 *
 * **Yang disentuh.** Hanya `user_credentials` (upsert) + `sessions` (cabut
 * semua sesi lama) dalam satu transaksi. Tidak membuat user, tidak menyentuh
 * role, tidak menulis `audit_events` — skrip ini TIDAK didahului sesi login,
 * jadi tidak ada `actorUserId` yang jujur untuk dicatat.
 *
 * **Target yang diterima:** akun staf (`verifikator`/`admin`) dan akun demo
 * ber-domain `@careevo.test`. Akun pengguna biasa dengan domain lain ditolak,
 * supaya salah ketik email tidak mengganti password orang lain.
 *
 * **Tidak ada `npm run` script untuk ini, dan itu disengaja** — alasan yang
 * sama dengan `scripts/bootstrap-admin.ts`: menjalankannya dari `package.json`
 * membuatnya mudah ikut terpanggil gate build/deploy.
 *
 * Pemakaian:
 *
 * ```bash
 * # Password dibangkitkan acak (disarankan):
 * npx tsx scripts/set-password-staff.mts verifikator@careevo.test
 *
 * # Password ditentukan operator, dibaca dari stdin:
 * echo 'kata-sandi-pilihan-anda' | npx tsx scripts/set-password-staff.mts verifikator@careevo.test --stdin
 * ```
 *
 * Password **tidak pernah** lewat argumen baris perintah: ia dibangkitkan di
 * sini (lalu dicetak sekali) atau dibaca dari stdin. Argumen masuk `ps` dan
 * shell history di server bersama, jadi `--password <nilai>` sengaja tidak ada.
 *
 * Varian `--stdin` ada untuk pemulihan di mana operator sudah punya password
 * tertentu. Ia **tidak** memeriksa password terhadap daftar bocor, dan password
 * yang mudah ditebak di sini sama lemahnya dengan password apa pun yang lemah —
 * nilainya sama dengan `user_credentials` milik akun itu.
 */

import { randomInt } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { getDb, tutupDb } from "../src/lib/db/client";
import { sessions } from "../src/lib/db/schema";
import {
  ambilRolesAktif,
  cariUserByEmail,
  normalisasiEmail,
  simpanKredensial,
} from "../src/lib/auth/identity-repository";
import { hashPassword } from "../src/lib/auth/password";

/** Panjang password: 20 karakter dari alfabet 30 huruf → ≈98 bit entropi. */
const PANJANG = 20;

/**
 * Alfabet yang **tidak ambigu saat diketik/dibaca ulang**.
 *
 * `base64url` sengaja ditinggalkan: password sebelumnya (`okwUtfp-HVPbOgXMT2ZSNNqM`)
 * mengandung `-`, `_`, dan campuran huruf besar-kecil — karakter yang mudah
 * tertukar saat diketik manual, dan percobaan login pertama gagal karenanya.
 *
 * Yang dibuang: `i`/`l`/`1`, `o`/`0`, `s`, dan semua huruf besar. Yang tersisa
 * 30 karakter yang tetap terbaca benar walau diketik di ponsel.
 */
const ALFABET = "abcdefghjkmnpqrtuvwxyz23456789";

/**
 * Bangkitkan password acak, dikelompokkan 4 karakter dengan tanda hubung.
 *
 * Kelompok dipisah `-` supaya mudah dibaca-ulang, tetapi `-` juga satu-satunya
 * karakter non-alfabet. `randomInt` dipakai, bukan `randomBytes % 31`: modulo
 * pada angka acak mencondongkan sisa bagi, dan passwordnya jadi kurang acak
 * daripada panjangnya.
 */
function passwordAcak(): string {
  const kelompok: string[] = [];
  for (let g = 0; g < PANJANG / 4; g++) {
    let potongan = "";
    for (let i = 0; i < 4; i++) {
      potongan += ALFABET[randomInt(ALFABET.length)];
    }
    kelompok.push(potongan);
  }
  return kelompok.join("-");
}

/** Baca seluruh stdin sebagai satu baris, tanpa newline akhir. */
async function bacaStdin(): Promise<string> {
  const potongan: Buffer[] = [];
  for await (const bagian of process.stdin) potongan.push(bagian as Buffer);
  return Buffer.concat(potongan).toString("utf8").replace(/\r?\n$/, "");
}

async function main() {
  const email = process.argv[2];
  const dariStdin = process.argv.includes("--stdin");
  if (!email) {
    console.error("Pemakaian: npx tsx scripts/set-password-staff.mts <email-staf> [--stdin]");
    console.error("Contoh:   npx tsx scripts/set-password-staff.mts verifikator@careevo.test");
    console.error("          echo 'sandi-pilihan' | npx tsx scripts/set-password-staff.mts <email> --stdin");
    process.exit(1);
  }

  const emailNormalized = normalisasiEmail(email);
  const db = getDb();

  const user = await cariUserByEmail(db, emailNormalized);
  if (!user) {
    console.error(`[set-password] GAGAL: tidak ada user dengan email ${emailNormalized}.`);
    console.error("[set-password] Script ini tidak membuat user — daftarkan dulu lewat alur normal.");
    process.exit(1);
  }

  const roles = await ambilRolesAktif(db, user.id);

  // Gerbang target: akun staf ATAU akun demo terlokalisasi.
  //
  // Akun demo perlu ikut diizinkan karena hash yang ditulis `pastikanUserDemo`
  // adalah hash acak `demo:<email>:<timestamp>` yang tidak pernah dipakai jalur
  // login, dan di produksi `findDemoAccount` menolak lebih dulu (`DEMO_MODE`
  // tidak diset). Akibatnya akun demo yang hidup di database produksi — mis.
  // `user@careevo.test` yang memegang sampel sertifikat — tidak punya password
  // yang bisa dipakai sama sekali. Hanya akun `@careevo.test` yang dibuka di
  // sini; akun pengguna biasa tetap ditolak supaya salah ketik email tidak
  // mengganti password orang lain.
  const domainDemo = "@careevo.test";
  const akunDemo = emailNormalized.endsWith(domainDemo);
  const roleStaf = roles.filter((r) => r === "verifikator" || r === "admin");
  if (roleStaf.length === 0 && !akunDemo) {
    console.error(
      `[set-password] GAGAL: ${emailNormalized} bukan akun staf dan bukan akun demo (${domainDemo}).`,
    );
    console.error(`[set-password] Role yang dimiliki: [${roles.join(", ") || "-"}].`);
    process.exit(1);
  }

  let password: string;
  if (dariStdin) {
    password = await bacaStdin();
    // Akun staf menuntut panjang wajar lewat stdin (password produksi tidak
    // boleh sependek nama role-nya). Akun demo dikecualikan: password demo yang
    // sah memang `careevo` (7 karakter), dan menolaknya hanya memaksa operator
    // memilih sandi lain yang menyimpang dari dokumentasi.
    const minimum = roleStaf.length > 0 ? 8 : 1;
    if (password.length < minimum) {
      console.error(
        `[set-password] GAGAL: password dari stdin kosong` +
          (minimum > 1 ? ` atau kurang dari ${minimum} karakter.` : "."),
      );
      process.exit(1);
    }
  } else {
    password = passwordAcak();
  }
  const passwordHash = await hashPassword(password);

  // Satu transaksi: kredensial baru + cabut semua sesi lama. `password_changed_at`
  // ikut diperbarui di dalam `simpanKredensial`, jadi sesi lama sudah tidak sah
  // bahkan jika pencabutan di sini gagal sebagian.
  await db.transaction(async (tx) => {
    await simpanKredensial(tx, { userId: user.id, passwordHash });
    await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
  });

  const jumlahRole = roles.length;
  console.log("[set-password] BERHASIL");
  console.log(`  email    : ${emailNormalized}`);
  console.log(`  nama     : ${user.displayName}`);
  console.log(`  username : ${user.usernameNormalized}`);
  console.log(`  role     : ${roles.join(", ")} (${jumlahRole} aktif)`);
  if (dariStdin) {
    // Tidak di-echo: operator yang mengetiknya, dan mencetaknya di sini hanya
    // menambah satu salinan di log/journal yang tidak perlu.
    console.log("  password : (dari stdin, tidak ditampilkan)");
    console.log("");
    console.log("[set-password] Password diset dari stdin. Tidak ada cara membacanya kembali");
    console.log("[set-password] dari database (Argon2id). Semua sesi lama sudah dicabut.");
  } else {
    console.log(`  password : ${password}`);
    console.log("");
    console.log("[set-password] Password di atas HANYA tercetak sekali. Simpan sekarang;");
    console.log("[set-password] tidak ada cara membacanya kembali dari database (Argon2id).");
    console.log("[set-password] Semua sesi lama akun ini sudah dicabut.");
  }
}

main()
  .then(() => tutupDb())
  .catch(async (err: unknown) => {
    console.error("[set-password] GAGAL:", err instanceof Error ? err.message : String(err));
    await tutupDb().catch(() => {});
    process.exit(1);
  });
