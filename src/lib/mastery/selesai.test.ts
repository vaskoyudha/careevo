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
): MasteryTopicBundle {
  return {
    topic: topic(),
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
