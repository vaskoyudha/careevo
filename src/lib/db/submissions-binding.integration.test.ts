/**
 * Back-compat integrasi untuk `submissions.mastery_topic_id`.
 *
 * Kolom ini adalah **referensi lunak**: nullable, tanpa FK, dan hanya
 * boleh terisi kalau `course_id` kosong. Berkas ini membuktikan ketiga sifat
 * itu terhadap database sungguhan, bukan terhadap asumsi:
 *
 * 1. Submission jalur tetap bisa dibuat (`mastery_topic_id` terisi,
 *    `course_id` null).
 * 2. `submissions_binding_check` benar-benar menolak submission yang
 *    terikat kursus **dan** jalur sekaligus. Kalau tes ini hanya
 *    `rejects.toThrow()`, ia juga akan hijau bila insert ditolak karena
 *    alasan lain apa pun — jadi SQLSTATE `23514` (check_violation) yang
 *    diassert, mengikuti pola `schema.integration.test.ts`.
 * 3. Submission portofolio kosong tetap sah, sehingga penambahan kolom
 *    tidak memutus jalur lama.
 *
 * Dijalankan hanya oleh `npm run test:db` (lihat `vitest.integration.config.mts`).
 * Sufiks `.integration.test.ts` itu kontrak: `npm test` mengecualikannya
 * sehingga mesin tanpa database tetap hijau.
 */

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDb } from "@/lib/db/client";
import { submissions, users } from "@/lib/db/schema";

/** SQLSTATE PostgreSQL untuk pelanggaran CHECK constraint. */
const KODE_CHECK = "23514";

describe("submissions.mastery_topic_id", () => {
  let userId = "";

  beforeEach(async () => {
    const seed = Date.now();
    const [user] = await getDb()
      .insert(users)
      .values({
        // Ketiga kolom ini `notNull()` di `schema.ts` — `email` bukan nama
        // kolomnya, yang benar `email_normalized`.
        emailNormalized: `-binding-${seed}@contoh.id`,
        usernameNormalized: `binding_${seed}`,
        displayName: `Binding ${seed}`,
      })
      .returning({ id: users.id });
    userId = user!.id;
  });

  afterEach(async () => {
    await getDb().delete(users).where(eq(users.id, userId));
  });

  it("terima submission jalur tanpa course_id", async () => {
    const [baris] = await getDb()
      .insert(submissions)
      .values({ userId, masteryTopicId: "topic_abc" })
      .returning({ masteryTopicId: submissions.masteryTopicId });
    expect(baris!.masteryTopicId).toBe("topic_abc");
  });

  it("tolak submission yang terikat kursus dan jalur sekaligus", async () => {
    // SQLSTATE diassert, bukan sekadar "ada error": Drizzle membungkus galat
    // driver, jadi kodenya bisa ada di `err.code` atau `err.cause.code`.
    let tertangkap: unknown;
    try {
      await getDb()
        .insert(submissions)
        .values({ userId, courseId: "kursus-1", masteryTopicId: "topic_abc" });
    } catch (err) {
      tertangkap = err;
    }
    expect(tertangkap, "CHECK harus menolak, tapi insert berhasil").toBeDefined();

    const kandidat = tertangkap as { code?: string; cause?: { code?: string } };
    const kodeAktual = kandidat.code ?? kandidat.cause?.code;
    expect(kodeAktual, `SQLSTATE tidak sesuai (pesan: ${String(tertangkap)})`).toBe(KODE_CHECK);
  });

  it("submission portofolio kosong tetap sah", async () => {
    const [baris] = await getDb()
      .insert(submissions)
      .values({ userId })
      .returning({ id: submissions.id, masteryTopicId: submissions.masteryTopicId });
    expect(baris!.masteryTopicId).toBeNull();
  });
});
