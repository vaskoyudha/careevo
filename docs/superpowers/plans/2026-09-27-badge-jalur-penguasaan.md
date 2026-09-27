# Badge Jalur Penguasaan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memberi jalur penguasaan sebuah **peristiwa terminal** — saat syarat gerbang terpenuhi, bukti dibekukan ke `submission_versions.content_snapshot`, dan review staf menerbitkan `badge` + `attestation` dengan bentuk payload yang tidak berubah.

**Architecture:** Enam bagian. (A) **Spike** — menetapkan apakah API AI Mastery bisa dipakai per-peserta; informational, **tidak memblokir task mana pun**. (B) **Penilai murni** `src/lib/mastery/selesai.ts` — empat aturan yang diturunkan dari `scoring.ts` yang sudah ada, tanpa ambang yang diketik tangan. (C) **Migrasi** satu kolom: `submissions.mastery_topic_id`. (D) **Kelayakan + pembekuan bukti** — `pastikanKelayakanJalur` mencerminkan `pastikanKelayakanKursus` persis, dan **server** menuliskan snapshot jalur sehingga klaim tidak pernah datang dari browser. (E) **Badge + payload** — `badges.type` jadi empat nilai, `task_title` jadi judul topik, `score` tetap skor rubrik. (F) **UI + dokumentasi**.

**Tech Stack:** Next.js 16 App Router (Server Actions), React 19, TypeScript 5 (`strict: true`, **tanpa** `noUncheckedIndexedAccess`), Vitest 5 (node env, tanpa jsdom), Drizzle ORM + PostgreSQL 18, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-27-badge-jalur-penguasaan-design.md` — §3.1 (empat aturan), §3.2 (kedalaman dari log attempt), §3.3 (provenance), §3.4 (bukti dibekukan), §3.5 (empat `type`), §3.6 (payload).

---

## Global Constraints

- **Copy berbahasa Indonesia** (`id`); `<html lang>` tetap `id`. Kode yang sudah Bahasa Indonesia (`nilaiJalur`, `pastikanKelayakan*`, `hitungPenguasaan`) diterjemahkan; kode infra/UI tetap Inggris.
- **`AttestationPayload` tidak bertambah field.** Tujuh field di `src/lib/attestation/sign.ts:3` adalah kontrak yang dibaca `/verify/[token]` dan `/p/[username]`. Yang kaya (jumlah poin, percobaan, hari) hidup di `content_snapshot` dan UI.
- **`badges` tidak dapat kolom baru.** `type: text` sudah bebas (`src/lib/db/schema.ts:876`), `sourceReviewId` tetap `notNull() + unique()` — review gate tetap struktur, bukan konvensi.
- **`score` pada attestation tetap `skorDariRubrik(rubric)`.** Persentase mastery adalah **bukti**; `score` adalah **penilaian reviewer**. Menggabungkannya membuat kredensial mastery-tinggi/rubrik-rendah terbaca sebagai skor tinggi.
- **Id topik tidak masuk ke `badges.type`.** Binding-nya sudah ada di `submissions.mastery_topic_id`; menyalinnya ke `type` adalah sumber kebenaran kedua yang pasti akan berbeda.
- **`mastery_topic_id` adalah referensi lunak** (tanpa FK), persis preseden `module_progress.evidence_id`. Bukti kredensial adalah `content_snapshot` yang dibekukan, bukan file `.data/`. Menghapus topik setelah badge terbit **tidak** merusak kredensial.
- **At approve-time, jangan evaluasi ulang jalurnya.** Klaim credential adalah snapshot beku yang dilihat reviewer; evaluasi ulang bisa menghasilkan klaim berbeda dari yang ditinjau.
- **Tidak ada `dangerouslySetInnerHTML`.**
- **Modul `selesai.ts` wajib murni** — tidak boleh mengimpor `node:fs`, `node:path`, atau `next/headers`. Ia menerima `MasteryTopicBundle` dan tidak pernah memanggil store.
- **Ambang tidak diketik tangan.** `ambangHari` diturunkan dari `INTERVAL_SEQUENCES` (`Math.floor((len - 1) / 2)`), mengikuti prinsip yang sudah ditulis di `rentangTinjauan`.
- **Fail-closed.** Topik tanpa poin (`points.length === 0`) tidak pernah `selesai: true`; tidak adanya peta yang justifies apa pun tidak boleh menaikkan apa pun.
- **Migration:** `npm run db:generate` (tanpa DB) → **baca SQL yang dihasilkan** → `npm run db:migrate`. SQL di `drizzle/` **wajib di-commit**. Jangan pernah edit atau hapus `drizzle/00NN_*.sql` yang sudah dipakai.
- **Ikuti langkah merah→hijau per task, dan mutation check di setiap task kode (B, D, E).** Kalau mutasi tidak membuat test merah, test itu tidak menutup logikanya.
- **Gate per task:** `npm run check` (`typecheck` → `lint` → `skills:check` → `test`). Task yang menyentuh halaman server-rendered (`src/app`) atau komponen client juga menjalankan `npm run build` — `check` saja tidak menangkap pelanggaran impor client-safe/server-only.
- **Test integrasi:** suffix `.integration.test.ts` adalah kontrak; `npm test` harus tetap hijau tanpa PostgreSQL. Kalau sebuah test butuh DB, ia **wajib** ber-suffix itu (config: `vitest.integration.config.mts`).
- **Jalankan `npx next typegen` kalau ada route yang pindah.** `next dev` tidak andal menyegarkan `.next/types`.
- **Commit lokal saja, jangan `push`** tanpa izin eksplisit.

---

# BAGIAN A — Spike (informational, tidak memblokir)

> **Task 0 tidak memblokir Task 1–5.** Bridge AI Mastery bukan prasyarat badge; ia hanya menentukan `provenanceMinimum` di plan *berikutnya*. Kerjakan paling dulu karena murah, bukan karena ia prasyarat.

## Task 0: Cakupan per-peserta API AI Mastery

**Files:**
- Create: `docs/ai-mastery-scope-finding.md`
- Modify: `docs/superpowers/specs/2026-09-27-badge-jalur-penguasaan-design.md` (tambah §6)

**Interfaces:**
- Consumes: topologi `:3790` (web) / `:8011` (FastAPI), skill `careevo-sijago`.
- Produces: keputusan `LAYANAN_BISA_PER_PESERTA: boolean` di `docs/ai-mastery-scope-finding.md`, dibaca ulang di Task 1 hanya untuk menuliskan catatan ambang.

- [ ] **Step 1: Nyalakan backend AI Mastery**

```bash
# Ikuti runbook di .agents/skills/careevo-sijago/SKILL.md untuk menyalakan :8011.
ss -ltnp | grep -E ':(3790|8011)\b'
```

Expected: `8011` listening. Kalau gagal, catat dan lompat ke Step 5 — hasilnya "tidak bisa diuji", bukan "tidak ada data".

- [ ] **Step 2: Ambil daftar topic dan satu `path_id`**

```bash
curl -s http://127.0.0.1:8011/api/mastery-paths/topics | head -c 2000
```

Expected: JSON dengan `"topics": [...]`. Ambil satu `path_id` dari `book_id`/entri pertama.

- [ ] **Step 3: Baca peta pengetahuan + antrean tinjauan**

```bash
curl -s "http://127.0.0.1:8011/api/mastery-paths/topics/<PATH_ID>" | head -c 3000
```

Expected: memuat peta pengetahuan, `review_queue`, dan `next_step` (lihat `_topic_payload`, `backend/deeptutor/api/routers/mastery_path.py:371`).

- [ ] **Step 4: Tetapkan apakah ada scoping per-peserta**

```bash
rg -n "Depends|middleware|Authorization|current_account|get_current" backend/deeptutor/api/main.py backend/deeptutor/api/routers/mastery_path.py
rg -n "def __init__" -A 8 backend/deeptutor/learning/storage.py
```

Expected: `list_topics()` (`mastery_path.py:439`) **tidak menerima parameter apa pun** dan `LearningStore()` default-nya adalah workspace dir (`storage.py:355-360`). Kalau tidak ada `Depends` per-request di router, tulis `LAYANAN_BISA_PER_PESERTA: false`.

- [ ] **Step 5: Tulis temuan**

`docs/ai-mastery-scope-finding.md` — isi persis:

```markdown
# Cakupan API AI Mastery per-peserta

Tanggal: 2026-09-27
PYTHON_API: 127.0.0.1:8011
PATH_ID_YANG_DITES: <path_id>
LAYANAN_BISA_PER_PESERTA: <true|false|tidak-bisa-diuji>
BUKTI: <ringkas: apa yang dilihat di main.py/router, dan path store-nya>
AKHIR: <satu kalimat: apakah attempt yang dinilai bisa dikaitkan ke satu peserta Careevo>
```

- [ ] **Step 6: Tambahkan §6 ke spec dan commit**

Tambahkan ke spec:

```markdown
## 6. Hasil Task 0 (spike)

LAYANAN_BISA_PER_PESERTA: <true|false|tidak-bisa-diuji> — <satu kalimat bukti>.
Konsekuensi: `provenanceMinimum` tetap `0` pada plan ini. <Bridge AI Mastery adalah
plan terpisah, atau bergantung pada apa yang ditemukan.>
```

```bash
git add docs/ai-mastery-scope-finding.md docs/superpowers/specs/2026-09-27-badge-jalur-penguasaan-design.md
git commit -m "docs: hasil spike cakupan API AI Mastery per-peserta"
```

---

# BAGIAN B — Penilai murni

## Task 1: `src/lib/mastery/selesai.ts`

**Files:**
- Create: `src/lib/mastery/selesai.ts`
- Create: `src/lib/mastery/selesai.test.ts`
- Modify: `src/lib/mastery/types.ts` (tambah `Provenance` + `Attempt.provenance?`)
- Modify: `src/lib/mastery/store.ts` (`isAttempt` menerima `provenance`)

**Interfaces:**
- Consumes: `hitungPenguasaan(correctness: readonly boolean[]): number`, `INTERVAL_SEQUENCES: Readonly<Record<KnowledgeType, readonly number[]>>`, `DAY_MS: number` (semua dari `./scoring`); tipe dari `./types`.
- Produces:
  - `type Provenance = "dinilai" | "dideklarasikan"` (didefinisikan di `types.ts`, **re-export** dari `selesai.ts`)
  - `interface AmbangJalur { provenanceMinimum: number; policyVersion: number }`
  - `const AMBANG_JALUR_V1: AmbangJalur`
  - `function ambangHari(type: KnowledgeType): number`
  - `interface PenilaianPoin { id; name; type; mastery; percobaan; dariTinjauan; dariDinilai; gapHariTerpanjang; ambangHari; cakupan; retensi; kedalaman; terpenuhi }`
  - `interface PenilaianJalur { selesai: boolean; poin: PenilaianPoin[]; alasan: string[]; ambang: AmbangJalur; ringkasan: { totalPoin; poinTerpenuhi; percobaan; dariTinjauan; dariDinilai; ambangHariMinimum } }`
  - `function nilaiJalur(bundle: MasteryTopicBundle, ambang?: AmbangJalur): PenilaianJalur`
  - `function snapshotsBuktiJalur(penilaian: PenilaianJalur, topic: MasteryTopic): Record<string, unknown>`
  - `function kalimatKlaimJalur(penilaian: PenilaianJalur, topic: MasteryTopic): string`

- [ ] **Step 1: Tambah `Provenance` ke `types.ts`**

Tambahkan sebelum `export interface Attempt`, dan tambahkan satu field ke `Attempt`:

```ts
/**
 * Siapa yang menilai satu attempt.
 *
 * `dideklarasikan` = tombol "Bisa"/"Belum" milik peserta
 * (`catatPercobaanAction`). `dinilai` = attempt dari sesi yang dinilai server —
 * producer-nya adalah bridge AI Mastery, yang **belum ada** (Task 0). Field ini
 * opsional supaya envelope yang sudah tertulis di `.data/mastery/` tetap
 * valid; absennya berarti `dideklarasikan`, bukan `dinilai`.
 */
export type Provenance = "dinilai" | "dideklarasikan";
```

```ts
export interface Attempt {
  knowledgePointId: string;
  correct: boolean;
  at: string;
  /** Where the answer came from, so the review trail can be honest about it. */
  source: "session" | "review";
  /** Absen = `dideklarasikan`. Lihat `Provenance`. */
  provenance?: Provenance;
}
```

- [ ] **Step 2: `isAttempt` menerima `provenance`**

Di `src/lib/mastery/store.ts`, di dalam `isAttempt`, ganti baris terakhirCondition:

```ts
    (c.source === "session" || c.source === "review") &&
    (c.provenance === undefined || c.provenance === "dinilai" || c.provenance === "dideklarasikan")
```

- [ ] **Step 3: Tulis test yang gagal**

`src/lib/mastery/selesai.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DAY_MS, INTERVAL_SEQUENCES } from "./scoring";
import {
  AMBANG_JALUR_V1,
  ambangHari,
  kalimatKlaimJalur,
  nilaiJalur,
  snapshotsBuktiJalur,
} from "./selesai";
import type { Attempt, KnowledgePoint, MasteryTopicBundle } from "./types";

const HARI = (n: number): string => new Date(Date.UTC(2026, 0, 1) + n * DAY_MS).toISOString();

function topic(overrides: Partial<MasteryTopicBundle["topic"]> = {}) {
  return {
    id: "topic_1",
    owner: "peserta@contoh.id",
    title: "Percakapan Python",
    description: "",
    status: "active" as const,
    createdAt: HARI(0),
    updatedAt: HARI(0),
    ...overrides,
  };
}

const titikPython: KnowledgePoint = {
  id: "kp_1",
  name: "Fungsi def dan parameter",
  type: "concept",
  moduleId: "m1",
};

function bundle(
  points: KnowledgePoint[],
  attempts: Attempt[],
  errorPointIds: string[] = [],
  t: Partial<MasteryTopicBundle["topic"]> = {},
): MasteryTopicBundle {
  return {
    topic: topic(t),
    points,
    progress: { attempts, states: {}, knowledgeTypes: {}, errorPointIds },
  };
}

/** Tiga percobaan benar: jumlah minimum yang diizinkan `CONFIDENCE_CAP`. */
const tigaBenar = (id: string, mulai: number): Attempt[] => [
  { knowledgePointId: id, correct: true, at: HARI(mulai), source: "session" },
  { knowledgePointId: id, correct: true, at: HARI(mulai + 1), source: "session" },
  { knowledgePointId: id, correct: true, at: HARI(mulai + 20), source: "review" },
];

describe("ambangHari — diturunkan dari INTERVAL_SEQUENCES", () => {
  it("mengembalikan separuh tabel, bukan angka yang diketik tangan", () => {
    for (const type of ["memory", "concept", "procedure", "design"] as const) {
      const tabel = INTERVAL_SEQUENCES[type];
      expect(ambangHari(type)).toBe(tabel[Math.floor((tabel.length - 1) / 2)]);
    }
  });

  it("memberi ambang 7 hari untuk concept/procedure dan 14 hari untuk design", () => {
    expect(ambangHari("concept")).toBe(7);
    expect(ambangHari("procedure")).toBe(7);
    expect(ambangHari("memory")).toBe(7);
    expect(ambangHari("design")).toBe(14);
  });
});

describe("nilaiJalur — aturan cakupan", () => {
  it("tiga percobaan benar tepat menghasilkan mastery 1 (bukan 0.999…)", () => {
    const nilai = nilaiJalur(bundle([titikPython], tigaBenar("kp_1", 0)));
    expect(nilai.poin[0].mastery).toBe(1);
    expect(nilai.poin[0].cakupan).toBe(true);
  });

  it("dua percobaan benar tidak cukup — cap 0.8 MENOLAK cakupan", () => {
    // Dua, bukan tiga: inilah yang diuji `CONFIDENCE_CAP[2] = 0.8`. Tiga
    // percobaan benar akan menghasilkan mastery 1 dan membuktikan kebalikan.
    const nilai = nilaiJalur(
      bundle(
        [titikPython],
        [
          { knowledgePointId: "kp_1", correct: true, at: HARI(0), source: "session" },
          { knowledgePointId: "kp_1", correct: true, at: HARI(1), source: "session" },
        ],
      ),
    );
    expect(nilai.poin[0].mastery).toBe(0.8);
    expect(nilai.poin[0].cakupan).toBe(false);
  });

  it("satu jawaban salah terakhir menurunkan cakupan walau lebih dari tiga percobaan", () => {
    const nilai = nilaiJalur(
      bundle(
        [titikPython],
        [
          { knowledgePointId: "kp_1", correct: true, at: HARI(0), source: "session" },
          { knowledgePointId: "kp_1", correct: true, at: HARI(1), source: "session" },
          { knowledgePointId: "kp_1", correct: true, at: HARI(2), source: "session" },
          { knowledgePointId: "kp_1", correct: false, at: HARI(3), source: "review" },
        ],
      ),
    );
    expect(nilai.poin[0].cakupan).toBe(false);
    expect(nilai.selesai).toBe(false);
  });
});

describe("nilaiJalur — aturan retensi dan kedalaman", () => {
  it("tiga percobaan 'session' saja tidak memberi retensi", () => {
    const nilai = nilaiJalur(
      bundle(
        [titikPython],
        [0, 1, 2].map((hari) => ({
          knowledgePointId: "kp_1",
          correct: true,
          at: HARI(hari),
          source: "session" as const,
        })),
      ),
    );
    expect(nilai.poin[0].cakupan).toBe(true);
    expect(nilai.poin[0].retensi).toBe(false);
    expect(nilai.selesai).toBe(false);
  });

  it("percobaan review yang benar 20 hari kemudian memenuhi kedalaman concept (7 hari)", () => {
    const nilai = nilaiJalur(bundle([titikPython], tigaBenar("kp_1", 0)));
    expect(nilai.poin[0].gapHariTerpanjang).toBe(19);
    expect(nilai.poin[0].kedalaman).toBe(true);
    expect(nilai.selesai).toBe(true);
  });

  it("percobaan review yang hanya 2 hari kemudian tidak memenuhi kedalaman", () => {
    const nilai = nilaiJalur(
      bundle(
        [titikPython],
        [
          { knowledgePointId: "kp_1", correct: true, at: HARI(0), source: "session" },
          { knowledgePointId: "kp_1", correct: true, at: HARI(1), source: "session" },
          { knowledgePointId: "kp_1", correct: true, at: HARI(2), source: "session" },
          { knowledgePointId: "kp_1", correct: true, at: HARI(4), source: "review" },
        ],
      ),
    );
    expect(nilai.poin[0].cakupan).toBe(true);
    expect(nilai.poin[0].retensi).toBe(true);
    expect(nilai.poin[0].gapHariTerpanjang).toBe(2);
    expect(nilai.poin[0].kedalaman).toBe(false);
  });

  it("attempt review PERTAMA diukur dari createdAt, bukan dari attempt sebelumnya", () => {
    // Attempt review harus jadi attempt **pertama** (idx 0) agar cabang
    // `index === 0 ? dibuatPada : ...` benar-benar dieksekusi. Menaruhnya di
    // akhir — seperti test di atas — hanya menguji cabang "attempt sebelumnya".
    const nilai = nilaiJalur(
      bundle(
        [titikPython],
        [
          { knowledgePointId: "kp_1", correct: true, at: HARI(30), source: "review" },
          { knowledgePointId: "kp_1", correct: true, at: HARI(31), source: "session" },
          { knowledgePointId: "kp_1", correct: true, at: HARI(32), source: "session" },
        ],
      ),
    );
    // `topic.createdAt` = HARI(0), jadi gap = 30 hari, bukan 0.
    expect(nilai.poin[0].gapHariTerpanjang).toBe(30);
    expect(nilai.poin[0].retensi).toBe(true);
    expect(nilai.poin[0].kedalaman).toBe(true);
    expect(nilai.selesai).toBe(true);
  });
});

describe("nilaiJalur — fail-closed", () => {
  it("topik tanpa poin tidak pernah selesai", () => {
    const nilai = nilaiJalur(bundle([], []));
    expect(nilai.selesai).toBe(false);
    expect(nilai.alasan).toContain("Topik ini belum punya poin pengetahuan");
  });

  it("poin yang salah dan tidak pernah dibetulkan memblokir, walau lain lengkap", () => {
    const nilai = nilaiJalur(bundle([titikPython], tigaBenar("kp_1", 0), ["kp_1"]));
    expect(nilai.selesai).toBe(false);
    expect(nilai.alasan).toContain("1 poin masih salah dan belum dibetulkan");
  });

  it("poin tanpa percobaan apa pun dihitung 0, bukan diabaikan", () => {
    const nilai = nilaiJalur(bundle([titikPython, { ...titikPython, id: "kp_2" }], tigaBenar("kp_1", 0)));
    expect(nilai.ringkasan.totalPoin).toBe(2);
    expect(nilai.poin[1].percobaan).toBe(0);
    expect(nilai.poin[1].terpenuhi).toBe(false);
  });
});

describe("nilaiJalur — ambang provenance", () => {
  it("provenanceMinimum 0 satisfied oleh attempt yang tidak punya field provenance", () => {
    const nilai = nilaiJalur(bundle([titikPython], tigaBenar("kp_1", 0)));
    expect(nilai.poin[0].dariDinilai).toBe(0);
    expect(nilai.selesai).toBe(true);
  });

  it("provenanceMinimum 1 menolak topik yang seluruhnya self-declared", () => {
    const nilai = nilaiJalur(bundle([titikPython], tigaBenar("kp_1", 0)), {
      provenanceMinimum: 1,
      policyVersion: 2,
    });
    expect(nilai.poin[0].terpenuhi).toBe(false);
    expect(nilai.selesai).toBe(false);
  });

  it("attempt bertanda 'dinilai' memenuhi ambang 1", () => {
    const attempts = tigaBenar("kp_1", 0).map((a, i) =>
      i === 2 ? { ...a, provenance: "dinilai" as const } : a,
    );
    const nilai = nilaiJalur(bundle([titikPython], attempts), {
      provenanceMinimum: 1,
      policyVersion: 2,
    });
    expect(nilai.poin[0].dariDinilai).toBe(1);
    expect(nilai.selesai).toBe(true);
  });

  it("AMBANG_JALUR_V1 punya policyVersion 1 dan provenanceMinimum 0", () => {
    expect(AMBANG_JALUR_V1).toEqual({ provenanceMinimum: 0, policyVersion: 1 });
  });
});

describe("snapshotsBuktiJalur — bukti beku", () => {
  it("membawa ambang yang dipakai, supaya verifier tahu bar mana yang berlaku", () => {
    const nilai = nilaiJalur(bundle([titikPython], tigaBenar("kp_1", 0)));
    const snap = snapshotsBuktiJalur(nilai, topic()) as { jalur: Record<string, unknown> };
    expect(snap.jalur.policyVersion).toBe(1);
    expect(snap.jalur.provenanceMinimum).toBe(0);
    expect(snap.jalur.topicId).toBe("topic_1");
  });

  it("tidak pernah enthusiastically mengklaim attempt yang dinilai saat ambang 0", () => {
    const nilai = nilaiJalur(bundle([titikPython], tigaBenar("kp_1", 0)));
    const snap = snapshotsBuktiJalur(nilai, topic()) as {
      jalur: { perBanding: Record<string, number> };
    };
    expect(snap.jalur.perBanding.dinilai).toBe(0);
    expect(snap.jalur.perBanding.dideklarasikan).toBe(3);
  });

  it("deterministik — dua pemanggilan menghasilkan JSON yang sama", () => {
    const nilai = nilaiJalur(bundle([titikPython], tigaBenar("kp_1", 0)));
    const a = JSON.stringify(snapshotsBuktiJalur(nilai, topic()));
    const b = JSON.stringify(snapshotsBuktiJalur(nilai, topic()));
    expect(a).toBe(b);
  });
});

describe("kalimatKlaimJalur — kalimat yang harus jujur", () => {
  it("menyatakan jumlah poin, jumlah percobaan, dan asal attempt review", () => {
    const nilai = nilaiJalur(bundle([titikPython], tigaBenar("kp_1", 0)));
    const kalimat = kalimatKlaimJalur(nilai, topic());
    expect(kalimat).toContain("Percakapan Python");
    expect(kalimat).toContain("1 poin pengetahuan");
    expect(kalimat).toContain("3 percobaan");
    expect(kalimat).toContain("1 di antaranya dari antrean tinjauan");
  });

  it("tidak pernah menyebut 'nilai penuh' — mastery bukan kelulusan", () => {
    const nilai = nilaiJalur(bundle([titikPython], tigaBenar("kp_1", 0)));
    expect(kalimatKlaimJalur(nilai, topic())).not.toMatch(/lulus|penuh|nilai penuh/i);
  });
});
```

- [ ] **Step 4: Jalankan test, pastikan merah**

```bash
npx vitest run src/lib/mastery/selesai.test.ts
```

Expected: FAIL dengan `"Failed to resolve import"` untuk `./selesai`.

- [ ] **Step 5: Implementasikan `selesai.ts`**

`src/lib/mastery/selesai.ts`:

```ts
/**
 * Penilaian penyelesaian jalur penguasaan — **murni, tanpa IO**.
 *
 * Jalur — tidak seperti kursus — tidak punya peristiwa terminal: yang ada hanya
 * log `attempts` dan rata-rata `overall` yang tidak bisa mencapai 1. Modul ini
 * menyediakan peristiwa itu sebagai **fungsi murni**, supaya "jalur ini selesai"
 * bisa dihitung ulang kapan pun dari bukti yang sama dan tidak pernah
 * bergantung pada klaim browser.
 *
 * Semua ambang **diturunkan** dari `scoring.ts`, tidak diketik tangan:
 * `CONFIDENCE_CAP` menyiratkan aturan cakupan, `INTERVAL_SEQUENCES`
 * menyiratkan ambang kedalaman. Menyalin angka itu ke sini akan membuat dua
 * sumber kebenaran yang pasti akan berbeda.
 *
 * Modul ini **tidak** membaca database, `node:fs`, atau `next/headers`.
 */

import { DAY_MS, INTERVAL_SEQUENCES, hitungPenguasaan } from "./scoring";
import type {
  Attempt,
  KnowledgePoint,
  KnowledgeType,
  MasteryTopic,
  MasteryTopicBundle,
  Provenance,
} from "./types";

export type { Provenance };

/** Ambang Minimum Yang Harus Dicapai — naik hanya lewat nomor versi. */
export interface AmbangJalur {
  /** Minimal attempt `dinilai` per poin. `0` = semua self-declared. */
  provenanceMinimum: number;
  /** Versi kebijakan; naik saat aturan berubah. */
  policyVersion: number;
}

export const AMBANG_JALUR_V1: AmbangJalur = { provenanceMinimum: 0, policyVersion: 1 };

/**
 * Hari yang harus survived sebelum sebuah attempt `review` dihitung sebagai
 * kedalaman.
 *
 * Diturunkan dari `INTERVAL_SEQUENCES` dengan `Math.floor((len - 1) / 2)`,
 * mengikuti prinsip yang sudah ditulis di `rentangTinjauan`: angka yang
 * dihitung dari tabel tidak bisa berbeda dari label yang ditulis di
 * sebelahnya. Hasilnya `design` (tabel 2 langkah) menuntut 14 hari, sementara
 * `memory` (7 langkah) menuntut 7 — dan itu memang yang benar, sebab keputusan
 * desain tidak layak ditinjau mingguan.
 */
export function ambangHari(type: KnowledgeType): number {
  const tabel = INTERVAL_SEQUENCES[type];
  const indeks = Math.floor((tabel.length - 1) / 2);
  return tabel[indeks] ?? 0;
}

export interface PenilaianPoin {
  id: string;
  name: string;
  type: KnowledgeType;
  /** 0..1 dari `hitungPenguasaan`. Bukan persentase kelulusan. */
  mastery: number;
  percobaan: number;
  dariTinjauan: number;
  dariDinilai: number;
  /** Gap terbesar, dalam hari, antara dua attempt berurutan pada poin ini. */
  gapHariTerpanjang: number;
  ambangHari: number;
  cakupan: boolean;
  retensi: boolean;
  kedalaman: boolean;
  terpenuhi: boolean;
}

export interface PenilaianJalur {
  selesai: boolean;
  poin: PenilaianPoin[];
  /** Alasan belum selesai, dalam Bahasa yang bisa ditampilkan. */
  alasan: string[];
  ambang: AmbangJalur;
  ringkasan: {
    totalPoin: number;
    poinTerpenuhi: number;
    percobaan: number;
    dariTinjauan: number;
    dariDinilai: number;
    ambangHariMinimum: number;
  };
}

/** Absen berarti `dideklarasikan` — lihat `Provenance` di `types.ts`. */
function provenance(attempt: Attempt): Provenance {
  return attempt.provenance === "dinilai" ? "dinilai" : "dideklarasikan";
}

/**
 * Urut berdasarkan waktu.
 *
 * Log attempt tidak dijamin urutnya di disk: `recordAttempt` menambahkan di
 * akhir array, tapi file bisa ditulis tangan, dan urutan itulah yang diukur
 * kedalaman. Mengurutkan di sini membuat hitungan tidak bergantung pada
 * kebetulan penulisan.
 */
function urutAttempts(attempts: readonly Attempt[]): Attempt[] {
  return [...attempts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function hariAntara(dari: string, ke: string): number {
  const selisih = Date.parse(ke) - Date.parse(dari);
  return Number.isFinite(selisih) && selisih > 0 ? Math.floor(selisih / DAY_MS) : 0;
}

function nilaiPoin(
  point: KnowledgePoint,
  attempts: readonly Attempt[],
  dibuatPada: string,
  minimumDinilai: number,
): PenilaianPoin {
  const urut = urutAttempts(attempts);
  const mastery = hitungPenguasaan(urut.map((a) => a.correct));

  let retensi = false;
  let gapHariTerpanjang = 0;
  urut.forEach((attempt, index) => {
    if (!attempt.correct || attempt.source !== "review") return;
    retensi = true;
    // Attempt pertama tidak punya sebelumnya; jaraknya diukur dari `createdAt`.
    // Tanpa itu, attempt pertama bisa punya gap `Infinity` dan selalu lolos kedalaman.
    const sebelumnya = index === 0 ? dibuatPada : urut[index - 1].at;
    const gap = hariAntara(sebelumnya, attempt.at);
    if (gap > gapHariTerpanjang) gapHariTerpanjang = gap;
  });

  const dariTinjauan = urut.filter((a) => a.source === "review").length;
  const dariDinilai = urut.filter((a) => provenance(a) === "dinilai").length;
  const ambang = ambangHari(point.type);

  // `>= 1` bukan `> 0.99`: `hitungPenguasaan` menjumlahkan bobot yang sama dalam
  // urutan yang sama untuk `earned` dan `total`, jadi hasilnya benar-benar 1. Test
  // "tiga percobaan benar tepat menghasilkan mastery 1" yang mengunci itu.
  const cakupan = mastery >= 1;
  const kedalaman = retensi && gapHariTerpanjang >= ambang;

  return {
    id: point.id,
    name: point.name,
    type: point.type,
    mastery,
    percobaan: urut.length,
    dariTinjauan,
    dariDinilai,
    gapHariTerpanjang,
    ambangHari: ambang,
    cakupan,
    retensi,
    kedalaman,
    terpenuhi: cakupan && retensi && kedalaman && dariDinilai >= minimumDinilai,
  };
}

export function nilaiJalur(
  bundle: MasteryTopicBundle,
  ambang: AmbangJalur = AMBANG_JALUR_V1,
): PenilaianJalur {
  const poin = bundle.points.map((point) =>
    nilaiPoin(
      point,
      bundle.progress.attempts.filter((a) => a.knowledgePointId === point.id),
      bundle.topic.createdAt,
      ambang.provenanceMinimum,
    ),
  );

  const poinTerpenuhi = poin.filter((p) => p.terpenuhi).length;
  const total = poin.length;
  // Fail-closed: tanpa poin tidak ada yang bisa dinyatakan selesai.
  const selesai =
    total > 0 &&
    poinTerpenuhi === total &&
    bundle.progress.errorPointIds.length === 0;

  const alasan: string[] = [];
  if (total === 0) {
    alasan.push("Topik ini belum punya poin pengetahuan");
  } else {
    const belum = total - poinTerpenuhi;
    if (belum > 0) {
      alasan.push(
        `${belum} dari ${total} poin belum memenuhi syarat: butuh mastery penuh, ` +
          `satu kali benar dari antrean tinjauan, dan jarak antarpercobaan yang cukup.`,
      );
    }
    if (bundle.progress.errorPointIds.length > 0) {
      alasan.push(
        `${bundle.progress.errorPointIds.length} poin masih salah dan belum dibetulkan`,
      );
    }
  }

  const ambangHariMinimum = total === 0 ? 0 : Math.min(...poin.map((p) => p.ambangHari));

  return {
    selesai,
    poin,
    alasan,
    ambang,
    ringkasan: {
      totalPoin: total,
      poinTerpenuhi,
      percobaan: poin.reduce((n, p) => n + p.percobaan, 0),
      dariTinjauan: poin.reduce((n, p) => n + p.dariTinjauan, 0),
      dariDinilai: poin.reduce((n, p) => n + p.dariDinilai, 0),
      ambangHariMinimum,
    },
  };
}

/**
 * Bukti beku untuk `submission_versions.content_snapshot`.
 *
 * Menyertakan `provenanceMinimum` **dan** `policyVersion` yang dipakai, supaya
 * verifier bisa membaca bar mana yang berlaku pada badge lama. Badge yang
 * terbit sebelum bridge hidup akan terlihat sebagai `provenanceMinimum: 0`,
 * bukan meniru badge yang dinilai.
 */
export function snapshotsBuktiJalur(
  penilaian: PenilaianJalur,
  topic: MasteryTopic,
): Record<string, unknown> {
  return {
    jalur: {
      topicId: topic.id,
      judul: topic.title,
      courseId: topic.courseId ?? null,
      jobId: topic.jobId ?? null,
      policyVersion: penilaian.ambang.policyVersion,
      provenanceMinimum: penilaian.ambang.provenanceMinimum,
      perBanding: {
        dinilai: penilaian.ringkasan.dariDinilai,
        dideklarasikan: penilaian.ringkasan.percobaan - penilaian.ringkasan.dariDinilai,
      },
      ringkasan: {
        totalPoin: penilaian.ringkasan.totalPoin,
        poinTerpenuhi: penilaian.ringkasan.poinTerpenuhi,
        percobaan: penilaian.ringkasan.percobaan,
        dariTinjauan: penilaian.ringkasan.dariTinjauan,
        ambangHariMinimum: penilaian.ringkasan.ambangHariMinimum,
      },
      poin: penilaian.poin.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        mastery: p.mastery,
        percobaan: p.percobaan,
        dariTinjauan: p.dariTinjauan,
        gapHariTerpanjang: p.gapHariTerpanjang,
        ambangHari: p.ambangHari,
        terpenuhi: p.terpenuhi,
      })),
    },
  };
}

const LABEL_TIPE: Readonly<Record<KnowledgeType, string>> = {
  memory: "hafalan",
  concept: "konsep",
  procedure: "prosedur",
  design: "desain",
};

/**
 * "1 poin" vs "7 poin" — Bahasa Indonesia tidak mengubah bentuk jamak untuk
 * kata benda countable seperti "poin" atau "percobaan", jadi yang dijaga di
 * sini hanya konsistensi, bukan bentuk tunggal.
 */
function jumlah(n: number, kata: string): string {
  return `${n} ${kata}`;
}

/**
 * Kalimat klaim yang dibaca verifier.
 *
 * Sengaja **tidak** memuat kata "lulus" atau "penuh": yang dilakukan peserta adalah
 * adalah menunjukkan penguasaan padaN poin, bukan kelulusan examinations.
 * Kalau kalimat ini tidak bisa ditulis jujur untuk suatu topik, topik itu tidak
 * seharusnya punya badge.
 */
export function kalimatKlaimJalur(
  penilaian: PenilaianJalur,
  topic: MasteryTopic,
): string {
  const r = penilaian.ringkasan;
  const komposisi = Object.entries(LABEL_TIPE)
    .filter(([type]) => penilaian.poin.some((p) => p.type === type))
    .map(([type, label]) => {
      const n = penilaian.poin.filter((p) => p.type === type).length;
      return `${n} ${label}`;
    })
    .join(", ");

  return [
    `Menunjukkan penguasaan ${topic.title} pada ${jumlah(r.totalPoin, "poin pengetahuan")}`,
    komposisi ? `(${komposisi})` : "",
    `· ${jumlah(r.percobaan, "percobaan")}`,
    r.dariTinjauan > 0
      ? `· ${jumlah(r.dariTinjauan, "di antaranya dari antrean tinjauan")}`
      : "",
    r.ambangHariMinimum > 0 ? `· dinilai ulang setelah ${r.ambangHariMinimum} hari` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
```

- [ ] **Step 6: Jalankan test, pastikan hijau**

```bash
npx vitest run src/lib/mastery/selesai.test.ts
```

Expected: PASS.

- [ ] **Step 7: Mutation check**

Ubah `const selesai = total > 0 &&` menjadi `const selesai = true &&` di `selesai.ts`, jalankan test, lalu **kembalikan**:

```bash
# expect: "topik tanpa poin tidak pernah selesai" FAIL
```

Lalu ubah `bakauDiturunkan` — erode `ambangHari` dari `Math.floor((tabel.length - 1) / 2)` menjadi `0`, jalankan test, kembalikan:

```bash
# expect: test ambang 14 hari untuk design FAIL
```

- [ ] **Step 8: Jalankan gate dan commit**

```bash
npm run check
git add src/lib/mastery/selesai.ts src/lib/mastery/selesai.test.ts src/lib/mastery/types.ts src/lib/mastery/store.ts
git commit -m "feat(mastery): penilai penyelesaian jalur murni dengan ambang turunan"
```

---

# BAGIAN C — Migrasi

## Task 2: `submissions.mastery_topic_id`

**Files:**
- Modify: `src/lib/db/schema.ts:773-799`
- Create (generated): `drizzle/0005_*.sql`, `drizzle/meta/*`

**Interfaces:**
- Consumes: tidak ada.
- Produces: `submissions.masteryTopicId: string | null` (`text`, tanpa FK) dan constraint `submissions_binding_check`.

- [ ] **Step 1: Tambah kolom dan constraint di `schema.ts`**

Di dalam `pgTable("submissions", {...})`, tambahkan setelah `enrollmentId`:

```ts
    /**
     * Topik jalur penguasaan yang menjadi bukti submission ini, atau `null`.
     *
     * **Referensi lunak, tanpa FK** — sama seperti `module_progress.evidence_id`.
     * Topik disimpan di `.data/mastery/<hash>/<id>.json` dan **bisa** dihapus
     * peserta; references yang menghambat penghapusan akan membuat kredensial
     * yang sudah terbit bisa ikut runtuh. Karena itu bukti credential bukan
     * kolom ini, melainkan `submission_versions.content_snapshot` yang dibekukan
     * server (`src/lib/mastery/selesai.ts`, `snapshotsBuktiJalur`): snapshot
     * sudah immutable dan sudah di-`restrict`, jadi menghapus topik tidak
     * merusak badge.
     */
    masteryTopicId: text("mastery_topic_id"),
```

Dan tambahkan ke array constraint:

```ts
    // Satu submission tidak boleh terikat kursus **dan** jalur sekaligus:
    // kredensial yang ditandatangani berbeda akan memunculkan dua klaim yang
    // benar. Keduanya `null` = submission portofolio, yang tetap berdiri sendiri.
    check(
      "submissions_binding_check",
      sql`not ("course_id" is not null and "mastery_topic_id" is not null)`,
    ),
```

- [ ] **Step 2: Generate SQL (tanpa DB)**

```bash
npm run db:generate
```

- [ ] **Step 3: Baca SQL yang dihasilkan**

```bash
ls -1 drizzle/*.sql | tail -1 | xargs cat
```

Expected: `ALTER TABLE "submissions" ADD COLUMN "mastery_topic_id" text;` dan
`ALTER TABLE "submissions" ADD CONSTRAINT "submissions_binding_check" CHECK (not (...));`

Kalau yang munculAnything além disso — misalnya DDL untuk tabel lain — **berhenti** dan periksa `schema.ts` sebelum melanjutkan.

- [ ] **Step 4: Terapkan ke DB dev**

```bash
export PGDATA="$HOME/.local/share/pgsql/cluster"
pg_ctl -D "$PGDATA" -l /tmp/pg-careevo.log \
  -o "-p 5432 -c listen_addresses=127.0.0.1 -c unix_socket_directories=$HOME/.local/share/pgsql/run" start
npm run db:migrate
psql -h 127.0.0.1 -p 5432 -U careevo -d careevo -c '\d submissions'
```

Expected: kolom `mastery_topic_id` ada, constraint `submissions_binding_check` ada.

- [ ] **Step 5: Test back-compat integrasi**

Buat `src/lib/db/submissions-binding.integration.test.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { submissions, users } from "@/lib/db/schema";

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
    userId = user.id;
  });

  afterEach(async () => {
    await getDb().delete(users).where(eq(users.id, userId));
  });

  it("terima submission jalur tanpa course_id", async () => {
    const [baris] = await getDb()
      .insert(submissions)
      .values({ userId, masteryTopicId: "topic_abc" })
      .returning({ masteryTopicId: submissions.masteryTopicId });
    expect(baris.masteryTopicId).toBe("topic_abc");
  });

  it("tolak submission yang terikat kursus dan jalur sekaligus", async () => {
    await expect(
      getDb()
        .insert(submissions)
        .values({ userId, courseId: "kursus-1", masteryTopicId: "topic_abc" }),
    ).rejects.toThrow();
  });

  it("submission portofolio kosong tetap sah", async () => {
    const [baris] = await getDb()
      .insert(submissions)
      .values({ userId })
      .returning({ id: submissions.id, masteryTopicId: submissions.masteryTopicId });
    expect(baris.masteryTopicId).toBeNull();
  });
});
```

- [ ] **Step 6: Jalankan test integrasi**

```bash
npm run test:db -- src/lib/db/submissions-binding.integration.test.ts
```

Expected: 3 PASS. Kalau `npm run test:db` gagal berisi "docker compose up -d postgres", PostgreSQL belum hidup — jalankan `pg_ctl` di Step 4. **Jangan** mengganti dengan skips.

- [ ] **Step 7: Pastikan `npm test` tetap hijau**

```bash
npm test
```

Expected: suite tanpa suffix `.integration.test.ts` tetap hijau tanpa DB — itulah alasan file ini memakai suffix itu.

- [ ] **Step 8: Commit (SQL wajib ikut)**

```bash
npm run check
git add src/lib/db/schema.ts drizzle/ src/lib/db/submissions-binding.integration.test.ts
git commit -m "feat(db): submissions.mastery_topic_id sebagai referensi lunak"
```

---

# BAGIAN D — Kelayakan dan pembekuan bukti

## Task 3: `pastikanKelayakanJalur` + snapshot beku

**Files:**
- Modify: `src/lib/review/service.ts:142-179` (tambah fungsi baru **setelah** `daftarKursusSubmission`)
- Modify: `src/lib/review/repository.ts:57-72` (`buatSubmission` menerima `masteryTopicId`)
- Modify: `src/actions/review.ts` (tambah `kirimJalurAction` + import `daftarJalurSubmission`)
- Modify: `src/lib/review/service.test.ts` (test untuk bukti jalur beku)

**Interfaces:**
- Consumes: `getMasteryTopic(owner, topicId)`, `listMasteryTopics(owner)` dari `@/lib/mastery/store`; `nilaiJalur`, `snapshotsBuktiJalur`, `AMBANG_JALUR_V1` dari `@/lib/mastery/selesai`; `cariUserById` (sudah dipakai di `service.ts:370`).
- Produces:
  - `function pastikanKelayakanJalur(userId: string, topicId: string): Promise<PenilaianJalur>`
  - `function daftarJalurSubmission(principal: SessionPrincipal): Promise<{ topicId: string; title: string; selesai: boolean }[]>`
  - `buatSubmission` menerima `masteryTopicId?: string | null`
  - `export type JenisSubmission = "kursus" | "jalur" | "portofolio"`

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `src/lib/review/service.test.ts`:

```ts
import {
  AMBANG_JALUR_V1,
  nilaiJalur,
  snapshotsBuktiJalur,
} from "@/lib/mastery/selesai";
import { DAY_MS } from "@/lib/mastery/scoring";
import type { MasteryTopicBundle } from "@/lib/mastery/types";

const HARI = (n: number): string => new Date(Date.UTC(2026, 0, 1) + n * DAY_MS).toISOString();

function bundleJob(): MasteryTopicBundle {
  const attempts = [0, 1, 20].map((hari) => ({
    knowledgePointId: "kp_1",
    correct: true,
    at: HARI(hari),
    source: (hari === 20 ? "review" : "session") as "session" | "review",
  }));
  return {
    topic: {
      id: "topic_1",
      owner: "peserta@contoh.id",
      title: "Percakapan Python",
      description: "",
      jobId: "loker_9",
      status: "active",
      createdAt: HARI(0),
      updatedAt: HARI(20),
    },
    points: [{ id: "kp_1", name: "Fungsi def", type: "concept", moduleId: "m1" }],
    progress: { attempts, states: {}, knowledgeTypes: {}, errorPointIds: [] },
  };
}

describe("nilaiJalur + snapshotsBuktiJalur — integrasi ke alur kredensial", () => {
  it("path yang complete dipakai sebagai bukti beku", () => {
    const nilai = nilaiJalur(bundleJob());
    expect(nilai.selesai).toBe(true);
    const snap = snapshotsBuktiJalur(nilai, bundleJob().topic) as {
      jalur: { jobId: string; policyVersion: number; poin: unknown[] };
    };
    expect(snap.jalur.jobId).toBe("loker_9");
    expect(snap.jalur.policyVersion).toBe(AMBANG_JALUR_V1.policyVersion);
    expect(snap.jalur.poin).toHaveLength(1);
  });

  it("path yang belum complete tidak menghasilkan bukti", () => {
    const b = bundleJob();
    b.progress.errorPointIds = ["kp_1"];
    expect(nilaiJalur(b).selesai).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan merah**

```bash
npx vitest run src/lib/review/service.test.ts
```

Expected: FAIL — `snapshot.jalur` tidak ada / `nilaiJalur` belum berlaku untuk jalur job.

- [ ] **Step 3: Repository menerima `masteryTopicId`**

Di `src/lib/review/repository.ts`, `buatSubmission`:

```ts
export async function buatSubmission(
  db: EksekutorDb,
  input: {
    userId: string;
    courseId?: string | null;
    enrollmentId?: string | null;
    masteryTopicId?: string | null;
    contentSnapshot: Record<string, unknown>;
  },
): Promise<{ submission: Submission; versi: SubmissionVersion }> {
  const [submission] = await db
    .insert(submissions)
    .values({
      userId: input.userId,
      courseId: input.courseId ?? null,
      enrollmentId: input.enrollmentId ?? null,
      masteryTopicId: input.masteryTopicId ?? null,
      // …sisanya tidak berubah
    })
    // …sisanya tidak berubah
```

- [ ] **Step 4: Fungsi kelayakan jalur di `service.ts`**

Tambahkan **setelah** `daftarKursusSubmission` (line 179):

```ts
/**
 * Jalur mastery wajib punya topik milik subjek di store dan **lengkap** menurut
 * `nilaiJalur`.
 *
 * Cermin persis `pastikanKelayakanKursus`: lihat comment di sana. Bedanya hanya
 * sumber kebenaran — completion tersimpan di DB, sedangkan kelayakan jalur
 * dihitung ulang dari log attempt yang beku. Itu bukan perbedaan tingkat
 * keystrikaan yang diam-diam: `nilaiJalur` murni dan deterministik, jadi
 * penghitungan ulang menghasilkan keputusan yang sama untuk input yang sama.
 *
 * Topik berstatus `archived` ditolak: badge yang dibekukan dari topik yang
 * sudah diarsipkan akan mengarang bukti yang sengaja disimpan Participant.
 */
async function pastikanKelayakanJalur(
  userId: string,
  topicId: string,
): Promise<PenilaianJalur> {
  const user = await cariUserById(getDb(), userId);
  if (!user) throw new GalatReview("kelayakan_ditolak", "Pemilik submission tidak ditemukan.");

  const bundle = await getMasteryTopic(user.email, topicId);
  if (!bundle) {
    throw new GalatReview("kelayakan_ditolak", "Topik jalur tidak ditemukan.");
  }
  if (bundle.topic.status !== "active") {
    throw new GalatReview("kelayakan_ditolak", "Topik jalur sudah diarsipkan.");
  }

  const penilaian = nilaiJalur(bundle, AMBANG_JALUR_V1);
  if (!penilaian.selesai) {
    throw new GalatReview(
      "kelayakan_ditolak",
      "Jalur belum lengkap. " + penilaian.alasan.join(" "),
    );
  }
  return penilaian;
}

/** Pilihan form untuk jalur — diturunkan dari store, bukan dari klaim browser. */
export async function daftarJalurSubmission(principal: SessionPrincipal): Promise<
  { topicId: string; title: string; selesai: boolean }[]
> {
  const topics = await listMasteryTopics(principal.email);
  const hasil: { topicId: string; title: string; selesai: boolean }[] = [];
  for (const topic of topics) {
    if (topic.status !== "active") continue;
    const bundle = await getMasteryTopic(principal.email, topic.id);
    if (!bundle) continue;
    hasil.push({
      topicId: topic.id,
      title: topic.title,
      selesai: nilaiJalur(bundle, AMBANG_JALUR_V1).selesai,
    });
  }
  return hasil;
}
```

Tambahkan import di `service.ts`:

```ts
import { getMasteryTopic, listMasteryTopics } from "@/lib/mastery/store";
import {
  AMBANG_JALUR_V1,
  nilaiJalur,
  snapshotsBuktiJalur,
  type PenilaianJalur,
} from "@/lib/mastery/selesai";
```

> `service.ts` sudah `"server-only"`, jadi mengimpor `node:fs` lewat `@/lib/mastery/store` aman. **Jangan** mengimpor store ini ke komponen client.

- [ ] **Step 5: `buatSubmissionDb` membekukan bukti di server**

Ganti signature dan badan di `service.ts:194-224`:

```ts
export async function buatSubmissionDb(input: {
  principal: SessionPrincipal;
  courseId?: string | null;
  enrollmentId?: string | null;
  masteryTopicId?: string | null;
  konten: KontenSubmission;
}): Promise<{ submission: Submission; versi: SubmissionVersion }> {
  await pastikanKelayakanKursus(
    input.principal.userId,
    input.courseId,
    input.enrollmentId,
  );

  // Bukti jalur ditulis **server**, setelah kelayakan lolos, dan ditambahkan ke
  // snapshot yang sama — bukan ke `konten` dari klien. `KontenSubmission` tidak
  // pernah boleh jadi bahan payload credential, dan snapshot adalah satu-satunya
  // tempat yang dibaca reviewer.
  let buktiJalur: Record<string, unknown> = {};
  if (input.masteryTopicId) {
    const penilaian = await pastikanKelayakanJalur(
      input.principal.userId,
      input.masteryTopicId,
    );
    const bundle = await getMasteryTopic(
      // `pastikanKelayakanJalur` sudah memuat dan memvalidasi topik ini.
      (await cariUserById(getDb(), input.principal.userId))?.email ?? "",
      input.masteryTopicId,
    );
    if (!bundle) throw new GalatReview("kelayakan_ditolak", "Topik jalur tidak ditemukan.");
    buktiJalur = snapshotsBuktiJalur(penilaian, bundle.topic);
  }

  return getDb().transaction(async (tx) => {
    const hasil = await buatSubmission(tx, {
      userId: input.principal.userId,
      courseId: input.courseId ?? null,
      enrollmentId: input.enrollmentId ?? null,
      masteryTopicId: input.masteryTopicId ?? null,
      contentSnapshot: {
        judul: input.konten.judul ?? null,
        catatan: input.konten.catatan ?? null,
        ...buktiJalur,
      },
    });
    await catatAudit(tx, {
      actorUserId: input.principal.userId,
      action: "submission.created",
      entityType: "submission",
      entityId: hasil.submission.id,
      payloadRedacted: {},
    });
    return hasil;
  });
}
```

- [ ] **Step 6: `kirimSubmissionDb` menjaga jalurnya**

Di `service.ts:244`, setelah `await pastikanKelayakanKursus(...)`, tambahkan:

```ts
  if (submission.masteryTopicId) {
    // Hanya **memastikan** bukti beku masih ada dan Topics-nya milik
    // subjek — **bukan** evaluates ulang. Klaim credential adalah snapshot
    // yang dilihat reviewer; penilaian ulang bisa menghasilkan klaim yang
    // berbeda dari yang ditinjau, dan itu akan menimbulkan dua klaim yang berbeda.
    await pastikanKelayakanJalur(submission.userId, submission.masteryTopicId);
  }
```

- [ ] **Step 7: Action memicu jalur**

`kirimJalurAction` **tidak** memakai `buatSchema`. Schema itu `enrollmentId: z.uuid()`, sedangkan `topicId` dihasilkan `newSessionId()` — 12 karakter dari `ID_ALPHABET`, **bukan** UUID (`src/lib/ids.ts:28`). Memaksanya jadi UUID akan menolak setiap topik yang ada. Validasi memakai `isValidSessionId`, sama seperti `catatPercobaanAction` (`src/actions/mastery.ts:101`).

Tambahkan ke blok import `@/lib/review/service` di `src/actions/review.ts` — `kirimSubmissionDb` **sudah** ada di sana, jadi hanya satu nama baru:

```ts
  daftarJalurSubmission,
```

dan tambahkan `isValidSessionId` dari `@/lib/ids` kalau belum ada di file itu.

Lalu tambahkan setelah `buatSubmissionAction`:

```ts
export async function kirimJalurAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const session = await getSession();
  if (!session?.userId) return { ok: false, error: PESAN_AKSES_DITOLAK };
  const topicId = String(formData.get("topicId") ?? "").trim();
  if (!isValidSessionId(topicId)) return { ok: false, error: "Topik jalur tidak valid." };
  try {
    // `topicId` adalah penanda, bukan klaim: daftar di bawah dibaca dari store,
    // dan `buatSubmissionDb` menuliskan buktinya sendiri. Nilai dari form tidak
    // pernah menjadi isi payload.
    const pilihan = (await daftarJalurSubmission(session)).find(
      (item) => item.topicId === topicId,
    );
    if (!pilihan) return { ok: false, error: "Topik jalur tidak ditemukan." };
    if (!pilihan.selesai) {
      return { ok: false, error: "Jalur belum lengkap. Selesaikan syaratnya lebih dulu." };
    }
    const { submission } = await buatSubmissionDb({
      principal: session,
      masteryTopicId: pilihan.topicId,
      konten: { judul: pilihan.title, catatan: null },
    });
    await kirimSubmissionDb({ principal: session, submissionId: submission.id });
    safeRevalidate("/submission", "/belajar/mastery");
    return {
      ok: true,
      submissionId: submission.id,
      message: "Jalur dikirim untuk kredensial.",
    };
  } catch (error) {
    if (error instanceof GalatReview) return { ok: false, error: error.message };
    throw error;
  }
}
```

- [ ] **Step 8: Jalankan test, pastikan hijau**

```bash
npx vitest run src/lib/review/service.test.ts
npm run check
```

- [ ] **Step 9: Mutation check**

Di `service.ts`, ubah `if (!penilaian.selesai) {` menjadi `if (false) {`, jalankan test, kembalikan:

```bash
# expect: test "path yang belum complete tidak menghasilkan bukti" atau gate check gagal
```

Lalu ubah `contentSnapshot` agar **tidak** menyertakan `...buktiJalur`, jalankan, kembalikan:

```bash
# expect: test "path yang complete dipakai sebagai bukti beku" FAIL
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/review/service.ts src/lib/review/service.test.ts src/lib/review/repository.ts src/actions/review.ts
git commit -m "feat(review): kelayakan jalur dan pembekuan bukti di server"
```

---

# BAGIAN E — Badge dan payload

## Task 4: Empat `type`, payload jalur

**Files:**
- Modify: `src/lib/review/service.ts:369-381` (payload), `service.ts:405-410` (badge)
- Modify: `src/lib/review/service.test.ts`

**Interfaces:**
- Consumes: `getMasteryTopic` (sudah diimpor di Task 3).
- Produces: `type BadgeType = "course_submission" | "portfolio_submission" | "mastery_submission" | "job_mastery_submission"` dan `function badgeTypeFor(submission, topic): BadgeType` — **murni**, bisa diuji tanpa DB.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `src/lib/review/service.test.ts`:

```ts
import { badgeTypeFor } from "./service";

describe("badgeTypeFor — empat jenis, tanpa id topik di dalam type", () => {
  const sub = (over: Partial<{ courseId: string | null; masteryTopicId: string | null }>) =>
    ({ courseId: null, enrollmentId: null, masteryTopicId: null, ...over }) as never;

  it("submission kursus tetap course_submission", () => {
    expect(badgeTypeFor(sub({ courseId: "kursus-1" }), undefined)).toBe("course_submission");
  });

  it("submission kosong tetap portfolio_submission", () => {
    expect(badgeTypeFor(sub({}), undefined)).toBe("portfolio_submission");
  });

  it("jalur dari kursus memakai mastery_submission", () => {
    expect(badgeTypeFor(sub({ masteryTopicId: "topic_1" }), { jobId: undefined })).toBe(
      "mastery_submission",
    );
  });

  it("jalur dari loker memakai job_mastery_submission", () => {
    expect(badgeTypeFor(sub({ masteryTopicId: "topic_1" }), { jobId: "loker_9" })).toBe(
      "job_mastery_submission",
    );
  });

  it("tidak pernah menaruh id topik di dalam type", () => {
    const type = badgeTypeFor(sub({ masteryTopicId: "topic_rahasia" }), { jobId: undefined });
    expect(type).not.toContain("topic_rahasia");
  });
});
```

- [ ] **Step 2: Jalankan, pastikan merah**

```bash
npx vitest run src/lib/review/service.test.ts
```

Expected: FAIL — `badgeTypeFor` belum diekspor.

- [ ] **Step 3: Implementasikan `badgeTypeFor` (murni)**

Tambahkan di `service.ts` dekat `wajibReviewer`:

```ts
/**
 * `badges.type` — empat nilai, mengikuti konvensi `text` bebas yang sudah ada.
 *
 * **Id topik sengaja tidak ditulis ke sini.** Binding-nya sudah ada di
 * `submissions.mastery_topic_id`; menyalinnya ke `type` akan membuat dua sumber
 * kebenaran untuk hal yang sama, dan keduanya akan berbeda begitu satu
 *(topik dihapus atau diarsipkan.
 */
export type BadgeType =
  | "course_submission"
  | "portfolio_submission"
  | "mastery_submission"
  | "job_mastery_submission";

export function badgeTypeFor(
  submission: Pick<Submission, "courseId" | "masteryTopicId">,
  topic: Pick<MasteryTopic, "jobId"> | undefined,
): BadgeType {
  if (submission.masteryTopicId) {
    return topic?.jobId ? "job_mastery_submission" : "mastery_submission";
  }
  return submission.courseId ? "course_submission" : "portfolio_submission";
}
```

Tambahkan import `type MasteryTopic` dari `@/lib/mastery/types`.

- [ ] **Step 4: Pakai `badgeTypeFor` di `putuskanReviewDb`**

Di `service.ts:369`, di blok pemuatan data **di luar transaksi**:

```ts
  const course = submission.courseId ? await getCourseById(submission.courseId) : undefined;
  const user = await cariUserById(getDb(), submission.userId);
  if (!user) throw new GalatReview("user_tidak_ditemukan", "Pemilik submission tidak ditemukan.");

  // Topik jalur dimuat di sini juga, di luar transaksi: `getMasteryTopic`
  // membaca `node:fs`, bukan DB.
  const topikJalur = submission.masteryTopicId
    ? await getMasteryTopic(user.email, submission.masteryTopicId)
    : undefined;
```

Lalu ganti payload di `service.ts:373-381`:

```ts
  const payload: AttestationPayload = {
    username: user.usernameNormalized,
    // Untuk jalur, `task_id` adalah id topik — sama-sama "apa yang dibuktikan".
    task_id: submission.masteryTopicId ?? submission.courseId ?? submission.id,
    task_title: topikJalur?.topic.title ?? course?.title ?? "Submission",
    track: topikJalur ? "jalur penguasaan" : (course?.track ?? "portofolio"),
    level: topikJalur ? "independen" : (course?.level ?? "mandiri"),
    // `score` tetap skor rubrik. Persentase mastery adalah **bukti**; skor
    // rubrik adalah **penilaian reviewer**. Menggabungkannya akan membuat
    // kredensial mastery-tinggi/rubrik-rendah terbaca sebagai skor tinggi.
    score,
    issued_at: new Date().toISOString(),
  };
```

Dan badge di `service.ts:406-410`:

```ts
      badge = await buatBadge(tx, {
        userId: submission.userId,
        type: badgeTypeFor(submission, topikJalur?.topic),
        sourceReviewId: review.id,
      });
```

- [ ] **Step 5: Jalankan test, pastikan hijau**

```bash
npx vitest run src/lib/review/service.test.ts
```

- [ ] **Step 6: Mutation check**

Ubah `return submission.courseId ? "course_submission" : "portfolio_submission";` menjadi
`return "portfolio_submission";`, jalankan test, kembalikan:

```bash
# expect: "submission kursus tetap course_submission" FAIL
```

- [ ] **Step 7: `npm run check` dan commit**

```bash
npm run check
git add src/lib/review/service.ts src/lib/review/service.test.ts
git commit -m "feat(review): badge jalur dan payload dengan bentuk tetap"
```

---

# BAGIAN F — UI dan dokumentasi

## Task 5: Gerbang jalur di halaman mastery

**Files:**
- Create: `src/components/features/mastery/gerbang-jalur.tsx`
- Modify: `src/app/(focus)/belajar/mastery/[topicId]/page.tsx`
- Modify: `src/components/features/mastery/mastery-topic-view.tsx` (mount `GerbangJalur`)
- Modify: `src/components/features/review/review-queue.tsx`
- Modify: `src/app/(verifikator)/review/[id]/page.tsx`
- Modify: `src/lib/mastery/selesai.test.ts` (test helper kalimat — file `.ts`, bukan `.tsx`)

**Interfaces:**
- Consumes: `nilaiJalur`, `kalimatKlaimJalur`, `AMBANG_JALUR_V1` dari `@/lib/mastery/selesai`; `getMasteryTopic` (server); `kirimJalurAction` dan `ReviewState` dari `@/actions/review`.
- Produces: komponen `GerbangJalur({ topic, nilai }: { topic: MasteryTopic; nilai: PenilaianJalur })` — **client component** yang menerima `PenilaianJalur` sebagai prop (serializable), sehingga tidak pernah mengimpor `@/lib/mastery/store`.

> **`ReviewState` tidak punya `status`.** Bentuknya (`src/actions/review.ts:22`) adalah `{ ok: boolean; message?: string; error?: string; decision?: string; submissionId?: string }`. Jadi kondisi dirender `!state.ok && state.error` dan `state.ok && state.message` — bukan `state.status === "error"`. `useActionState` diinisialisasi dengan `{ ok: false }`.

- [ ] **Step 1: Pindahkan `kalimatKlaimJalur` ke tempat yang bisa dipakai klien**

`selesai.ts` sudah murni (tanpa IO), jadi **tidak perlu dipindah**. Pastikan `page.tsx` yang memanggilnya, bukan komponen client:

```ts
// src/app/(focus)/belajar/mastery/[topicId]/page.tsx
import { AMBANG_JALUR_V1, nilaiJalur, kalimatKlaimJalur } from "@/lib/mastery/selesai";
```

Tambahkan di badan page, setelah `bundle` dibaca:

```ts
  const nilai = bundle ? nilaiJalur(bundle, AMBANG_JALUR_V1) : null;
```

Dan teruskan ke view:

```tsx
  return (
    <MasteryTopicView
      topic={topic}
      points={points}
      duePointIds={duePointIds}
      upcoming={upcoming}
      nilai={nilai}
    />
  );
```

Lalu **mount** komponennya di `src/components/features/mastery/mastery-topic-view.tsx` — tanpa ini `GerbangJalur` tercipta tapi tidak pernah tampil, dan gerbang badge tidak ada di mana pun. Ubah prop `MasteryTopicView`:

```tsx
export function MasteryTopicView({
  topic,
  points,
  duePointIds,
  upcoming,
  nilai,
}: {
  topic: MasteryTopic;
  points: TopicPoint[];
  duePointIds: string[];
  upcoming: { knowledgePointId: string; nextReviewAt: string }[];
  /** `null` hanya ketika bundle tidak terbaca; gerbang lalu tidak dirender. */
  nilai: PenilaianJalur | null;
}) {
```

dan render di dalam kolom utama, **setelah** daftar poin (bukan di header — header sudah punya cincin progres, dan menumpuk dua ringkasan di sana membuat keduanya tidak terbaca):

```tsx
        {nilai ? <GerbangJalur topic={topic} nilai={nilai} /> : null}
```

Tambahkan import di `mastery-topic-view.tsx`:

```tsx
import { GerbangJalur } from "@/components/features/mastery/gerbang-jalur";
import type { PenilaianJalur } from "@/lib/mastery/selesai";
```

> `type` import untuk `PenilaianJalur` aman di client component karena `selesai.ts` murni. Import **nilai** (bukan tipe) dari `selesai.ts` ke file ini pun aman, tapi tidak perlu — `kalimatKlaimJalur` dipanggil di dalam `GerbangJalur`.

- [ ] **Step 2: Tulis komponen gerbang**

`src/components/features/mastery/gerbang-jalur.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { kirimJalurAction, type ReviewState } from "@/actions/review";
import { kalimatKlaimJalur, type PenilaianJalur } from "@/lib/mastery/selesai";
import type { MasteryTopic } from "@/lib/mastery/types";

/**
 * Gerbang credential jalur.
 *
 * Dua hal yang sengaja ditampilkan, bukan disembunyikan:
 *
 * 1. **Syaratnya**, per poin — supaya peserta tahu apa yang kurang, bukan cuma
 *    ringkasan "belum selesai".
 * 2. **Ambang yang berlaku** (`provenanceMinimum`) — supaya jelas bahwa klaim
 *    ini, untuk now, dibangun dari attempt yang peserta nyatakan sendiri.
 *    Menyembunyikannya akan membuat badge terdengar lebih kuat daripada buktinya.
 */
export function GerbangJalur({
  topic,
  nilai,
}: {
  topic: MasteryTopic;
  nilai: PenilaianJalur;
}) {
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(
    kirimJalurAction,
    { ok: false },
  );

  return (
    <section aria-labelledby="gerbang-judul" className="rounded-2xl border border-border p-5">
      <h2 id="gerbang-judul" className="text-base font-bold tracking-tight text-foreground">
        Kredensial jalur
      </h2>

      {nilai.selesai ? (
        <>
          <p className="mt-2 text-[13px] leading-6 text-foreground">
            {kalimatKlaimJalur(nilai, topic)}
          </p>
          <form action={formAction} className="mt-3">
            <input type="hidden" name="topicId" value={topic.id} />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Mengirim…" : "Kirim untuk kredensial"}
            </button>
          </form>
        </>
      ) : (
        <>
          <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
            {nilai.alasan.map((baris) => (
              <li key={baris}>{baris}</li>
            ))}
          </ul>
          <ul className="mt-3 space-y-1.5">
            {nilai.poin.map((poin) => (
              <li
                key={poin.id}
                className="flex items-center justify-between gap-3 text-[12.5px]"
              >
                <span className="min-w-0 truncate text-foreground">{poin.name}</span>
                <span
                  className={
                    poin.terpenuhi
                      ? "shrink-0 font-semibold text-success"
                      : "shrink-0 text-muted-foreground"
                  }
                >
                  {poin.terpenuhi
                    ? "Terpenuhi"
                    : `Butuh ${poin.ambangHari} hari · ${poin.percobaan} percobaan`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-[11.5px] leading-5 text-muted-foreground/80">
        Kredensial terbit setelah verifikator menilai bukti yang dibekukan saat
        kamu mengirim. Untuk now, ambang minimum attempt yang dinilai adalah{" "}
        <strong className="font-semibold text-muted-foreground">
          {nilai.ambang.provenanceMinimum}
        </strong>{" "}
        — berarti bukti ini dibangun dari jawaban yang kamu nyatakan sendiri, dan
        penilaiannya dilakukan manual.
      </p>

      {!state.ok && state.error ? (
        <p role="status" className="mt-2 text-[12px] font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p role="status" className="mt-2 text-[12px] font-medium text-success">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 3: Test helper kalimat di lingkungan node**

Karena tidak ada jsdom, test hanya untuk logika. Tambahkan ke `src/lib/mastery/selesai.test.ts` (bukan `.tsx`):

```ts
describe("kalimatKlaimJalur — komposisi tipe", () => {
  it("menyebut komposisi bila ada lebih dari satu tipe", () => {
    const nilai = nilaiJalur(
      bundle(
        [
          { ...titikPython, id: "kp_1", type: "concept" },
          { ...titikPython, id: "kp_2", type: "design" },
        ],
        [...tigaBenar("kp_1", 0), ...tigaBenar("kp_2", 0)],
      ),
    );
    const kalimat = kalimatKlaimJalur(nilai, topic());
    expect(kalimat).toContain("1 konsep");
    expect(kalimat).toContain("1 desain");
  });
});
```

```bash
npx vitest run src/lib/mastery/selesai.test.ts
```

Expected: PASS.

- [ ] **Step 4: Reviewer melihat bukti beku**

Di `src/app/(verifikator)/review/[id]/page.tsx`, baca `versi.contentSnapshot` dan render `jalur` kalau ada. **Snapshot, bukan store** — reviewer harus melihat persis apa yang dibekukan, bukan estado yang mungkin sudah berubah:

```tsx
{jalur ? (
  <section aria-labelledby="bukti-judul" className="mt-4 rounded-2xl border border-border p-5">
    <h2 id="bukti-judul" className="text-base font-bold tracking-tight text-foreground">
      Bukti jalur (dibekukan saat dikirim)
    </h2>
    <p className="mt-1 text-[12px] text-muted-foreground">
      Kebijakan versi {jalur.policyVersion} · minimal attempt yang dinilai:{" "}
      {jalur.provenanceMinimum} · {jalur.ringkasan.poinTerpenuhi}/{jalur.ringkasan.totalPoin} poin
      terpenuhi
    </p>
    <ul className="mt-3 space-y-1 text-[12.5px]">
      {jalur.poin.map((poin) => (
        <li key={poin.id} className="flex justify-between gap-3">
          <span className="min-w-0 truncate">{poin.name}</span>
          <span className={poin.terpenuhi ? "text-success" : "text-muted-foreground"}>
            {poin.terpenuhi ? "Terpenuhi" : `butuh ${poin.ambangHari} hari`}
          </span>
        </li>
      ))}
    </ul>
    {jalur.provenanceMinimum === 0 ? (
      <p className="mt-3 text-[12px] text-muted-foreground">
        Perhatikan: seluruh bukti ini berasal dari jawaban yang peserta nyatakan
        sendiri. Yang dinilai di sini adalah kelengkapan dan disiplin belajar,
        bukan kebenaran jawaban.
      </p>
    ) : null}
  </section>
) : null}
```

Tipe `jalur` di-cast dari `contentSnapshot` dengan type guard di `page.tsx` (server component) — **jangan** `as any`.

- [ ] **Step 5: Verifikasi di browser**

```bash
npm run dev
```

Lalu buka `/belajar/mastery/<topicId>` pada 390px dan 1440px:

- Header melekat di atas (`(focus)` tidak punya navbar) — pasti tidak bergeser.
- Bagian "Belajar di AI Mastery" dan gerbang tidak saling tumpang tindih.
- Gate `npm run check` **tidak** membuktikan apa pun soal layout — ukur sendiri, jangan menyimpulkan dari hijau.

**Jawab dalam laporan:** jarak antar poin di 390px, dan apakah teks `ambang minimum` membungkus dengan baik.

- [ ] **Step 6: `npm run check`, `npm run build`, commit**

```bash
npm run check
npm run build
git add src/components/features/mastery/gerbang-jalur.tsx src/components/features/mastery/mastery-topic-view.tsx "src/app/(focus)/belajar/mastery/[topicId]/page.tsx" src/components/features/review/review-queue.tsx "src/app/(verifikator)/review/[id]/page.tsx" src/lib/mastery/selesai.test.ts
git commit -m "feat(mastery): gerbang kredensial di halaman jalur + bukti beku di antrean review"
```

- [ ] **Step 7: Dokumentasi**

Tambahkan ke `docs/adr/0004-review-state-machine-dan-lifecycle-attestation.md` bagian baru:

```markdown
##_addendum — Credential jalur penguasaan (2026-09-27)

`badges.type` gaining dua nilai (`mastery_submission`, `job_mastery_submission`)
**tidak** menambah state machine: jalur tetap melewati `submitted → assigned →
in_review → approved → attested` yang sama, dan `attestations.source_review_id`
tetap `notNull()`. Yang berubah hanya **apa** yang dibuktikan.

Bukti credential adalah `submission_versions.content_snapshot` yang dibekukan
server saat submission dibuat (`src/lib/mastery/selesai.ts`,
`snapshotsBuktiJalur`) — **bukan** file `.data/mastery/`. `submissions.mastery_topic_id`
adalah referensi lunak tanpa FK, sama seperti `module_progress.evidence_id`:
topik boleh dihapus peserta tanpa merusak badge, karena snapshot yang jadi bukti.

`AttestationPayload` tidak bertambah field. `score` tetap `skorDariRubrik`;
persentase mastery hidup di snapshot, karena mastery adalah bukti dan `score`
adalah penilaian reviewer.
```

Dan tambahkan satu baris ke `AGENTS.md` di bagian "Outbox"/arsitektur — di mana pun `attestations` dibahas — bahwa credential jalur tidak menambah sink outbox baru (satu-satunya sink tetap `audit`).

- [ ] **Step 8: Gate penuh dan commit terakhir**

```bash
# Paths eksplisit, bukan `git add -A`: working tree punya perubahan milik sesi
# lain di docs/superpowers/plans/ yang TIDAK boleh ikut commit ini.
git add docs/adr/0004-review-state-machine-dan-lifecycle-attestation.md AGENTS.md
git commit -m "docs: catat credential jalur di ADR 0004 dan AGENTS.md"
```

Expected: `npm run check` hijau, `npm run test:db` hijau (termasuk `submissions-binding.integration.test.ts`).

---

## Yang sengaja TIDAK ada di plan ini

- **Bridge AI Mastery → Careevo** (hasil Task 0 yang jadi plan berikutnya).
- **Badge retensi bertingkat** — log `attempts` menahannya, tidak perlu merchandise sekarang.
- **Migrasi `src/lib/mastery/` ke PostgreSQL** — dibatalkan oleh spec §3.4, bukan ditunda.
- **Mengiscoverykan flow credential kursus** — itu plan sendiri, dan kemungkinan rasio nilai-per-jam lebih tinggi.
- **Menambah nilai ke `completion_path` atau ke empat label `jalur-selesai.ts`.**
