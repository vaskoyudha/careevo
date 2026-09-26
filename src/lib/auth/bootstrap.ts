/**
 * Bootstrap admin — provision admin pertama pada database produksi yang baru
 * dimigrasikan. **Server/CLI-only.**
 *
 * ## Masalah yang dipecahkan
 *
 * Tidak ada jalur provisioning admin pertama: `gateAdmin()` membaca
 * `user_roles` dari database, dan database yang baru dimigrasikan tidak punya
 * baris `admin` sama sekali. Akibatnya `buatUndanganAction`/`beriRoleAction`
 * unreachable — tidak ada yang bisa memberi role pertama. Sebelumnya satu-satunya
 * "jalan" adalah INSERT manual ke `user_roles`, yang tidak ber-audit.
 *
 * ## Aturan yang dikunci
 *
 * - **User harus sudah ada dan `status`-nya `active`.** Fungsi ini tidak
 *   membuat akun: ia hanya menaikkan role user yang sudah terdaftar. Registrasi
 *   saat ini belum memverifikasi kepemilikan email; operator wajib membuktikan
 *   identitas target di luar aplikasi sebelum grant admin pertama. "Admin pertama"
 *   yang dibuat langsung dari CLI dengan password pilihan operator adalah
 *   backdoor tanpa jejak kepemilikan.
 * - **Role dari daftar tertutup.** Hanya `admin`/`verifikator`
 *   (`ROLE_UNDANGAN_STAFF`) — daftar yang sama dengan jalur undangan.
 * - **Grant dan audit dalam satu transaksi.** Kalau grant gagal, audit tidak
 *   boleh ada; kalau audit gagal, grant harus ikut batal. Kalau tidak, ada role
 *   tanpa bukti siapa yang memberikannya.
 * - **Idempoten.** Menjalankan ulang pada user yang sudah memegang role itu
 *   tidak menulis audit kedua.
 * - **Tidak aktif otomatis.** Tidak ada action, layout, route, atau seed
 *   on-boot yang memanggilnya. Ia hanya berjalan bila operator menjalankan
 *   `scripts/bootstrap-admin.ts` sendiri.
 */

import { and, eq } from "drizzle-orm";

import { denganTransaksi } from "@/lib/db/client";
import { ROLE_UNDANGAN_STAFF, userRoles, users, type RoleUndanganStaff } from "@/lib/db/schema";
import { catatAudit } from "@/lib/auth/audit";
import { normalisasiEmail } from "@/lib/auth/identity-repository";
import { isRoleUndanganStaff } from "@/lib/auth/invitation";

/**
 * Aksi audit khusus bootstrap — dibedakan dari grant admin biasa supaya audit
 * trail menjawab "apakah role ini datang dari operator CLI atau dari admin di
 * produk" tanpa perlu menebak dari `actor_user_id` yang null.
 */
export const AKSI_AUDIT_BOOTSTRAP = "user_role.bootstrapped";

/** Role default bila operator tidak menyebutkannya: admin pertama. */
export const ROLE_BOOTSTRAP_DEFAULT: RoleUndanganStaff = "admin";

export type AlasanGagalBootstrap = "role_tidak_valid" | "user_tidak_ditemukan" | "user_tidak_aktif";

export type HasilBootstrap =
  | {
      ok: true;
      userId: string;
      email: string;
      username: string;
      role: RoleUndanganStaff;
      /** `false` bila role itu sudah aktif — tidak ada perubahan, tidak ada audit. */
      granted: boolean;
    }
  | { ok: false; alasan: AlasanGagalBootstrap; pesan: string };

const PESAN_GAGAL: Record<AlasanGagalBootstrap, string> = {
  role_tidak_valid: "Role bootstrap hanya boleh admin atau verifikator.",
  user_tidak_ditemukan:
    "User tidak ditemukan. Daftarkan dulu lewat alur normal, lalu jalankan ulang perintah ini.",
  user_tidak_aktif:
    "User tidak berstatus active (suspended/deleted), jadi tidak boleh diberi role.",
};

function gagal(alasan: AlasanGagalBootstrap): HasilBootstrap {
  return { ok: false, alasan, pesan: PESAN_GAGAL[alasan] };
}

/**
 * Target user untuk bootstrap. Tepat salah satu dari keduanya.
 *
 * Email lebih disukai di CLI karena itu yang diketik operator; `userId` untuk
 * skrip otomasi yang sudah memegang id dari database.
 */
export type TargetBootstrap = { email: string } | { userId: string };

/**
 * Memberi role staff pertama kepada user yang **sudah ada**.
 *
 * `grantedByUserId` selalu `null`: belum ada admin yang bisa menjadi aktor.
 * Memakai user target sendiri sebagai aktor akan membuat audit mengklaim "user
 * memberi role untuk dirinya sendiri", padahal yang terjadi adalah operator
 * menaikkannya lewat CLI. `null` berarti sistem/operator di luar aplikasi —
 * arti yang sama dengan `audit_events.actor_user_id` yang nullable.
 */
export async function bootstrapRoleStaff(
  target: TargetBootstrap,
  role: RoleUndanganStaff = ROLE_BOOTSTRAP_DEFAULT,
): Promise<HasilBootstrap> {
  if (!isRoleUndanganStaff(role)) return gagal("role_tidak_valid");

  return denganTransaksi(async (tx) => {
    const kolom = "email" in target ? users.emailNormalized : users.id;
    const nilai = "email" in target ? normalisasiEmail(target.email) : target.userId;

    const [user] = await tx
      .select({
        id: users.id,
        status: users.status,
        emailNormalized: users.emailNormalized,
        usernameNormalized: users.usernameNormalized,
      })
      .from(users)
      .where(eq(kolom, nilai))
      .limit(1);

    if (!user) return gagal("user_tidak_ditemukan");
    if (user.status !== "active") return gagal("user_tidak_aktif");

    // Kunci baris: dua bootstrap paralel tidak boleh sama-sama membaca "belum
    // ada". Pola yang sama dengan `terapkanGrant` di `invitation.ts`.
    const [ada] = await tx
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, user.id), eq(userRoles.role, role)))
      .limit(1)
      .for("update");

    if (ada && !ada.revokedAt) {
      // Sudah aktif: no-op, tanpa audit palsu. Idempoten terhadap re-run.
      return {
        ok: true as const,
        userId: user.id,
        email: user.emailNormalized,
        username: user.usernameNormalized,
        role,
        granted: false,
      };
    }

    if (ada) {
      // PK komposit `(user_id, role)` sudah terisi baris yang dicabut — INSERT
      // kedua akan gagal dengan SQLSTATE 23505, jadi ini WAJIB UPDATE.
      await tx
        .update(userRoles)
        .set({ revokedAt: null, grantedAt: new Date(), grantedByUserId: null })
        .where(and(eq(userRoles.userId, user.id), eq(userRoles.role, role)));
    } else {
      await tx.insert(userRoles).values({
        userId: user.id,
        role,
        grantedByUserId: null,
        revokedAt: null,
      });
    }

    await catatAudit(tx, {
      // Tidak ada aktor terautentikasi pada database yang baru dimigrasikan.
      actorUserId: null,
      action: AKSI_AUDIT_BOOTSTRAP,
      entityType: "user_role",
      entityId: `${user.id}:${role}`,
      payloadRedacted: {
        target_user_id: user.id,
        role,
        // Alamat email disamarkan oleh `catatAudit`; disebut di sini supaya
        // operator bisa memastikan orang yang benar tanpa perlu join.
        email: user.emailNormalized,
        sumber: "cli_bootstrap",
      },
    });

    return {
      ok: true as const,
      userId: user.id,
      email: user.emailNormalized,
      username: user.usernameNormalized,
      role,
      granted: true,
    };
  });
}

/** Role bootstrap yang sah — dipakai CLI untuk memvalidasi argumen. */
export const ROLE_BOOTSTRAP_SAH: readonly RoleUndanganStaff[] = ROLE_UNDANGAN_STAFF;
