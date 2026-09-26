import { describe, expect, it } from "vitest";
import { dariKanonik, kanonik } from "./payload";
import type { AttestationPayload } from "./sign";

const payload: AttestationPayload = {
  username: "budi",
  task_id: "task-1",
  task_title: "Rebuild Landing Page",
  track: "web-dev",
  level: "dasar",
  score: 87,
  issued_at: "2026-09-21T00:00:00.000Z",
};

describe("kanonik — payload canonical", () => {
  it("mengurutkan kunci sehingga urutan tidak mengubah hasil", () => {
    const reordered: AttestationPayload = {
      issued_at: payload.issued_at,
      score: payload.score,
      level: payload.level,
      track: payload.track,
      task_title: payload.task_title,
      task_id: payload.task_id,
      username: payload.username,
    };
    expect(kanonik(reordered)).toBe(kanonik(payload));
  });

  it("roundtrip kanonik → dariKanonik mengembalikan payload yang sama", () => {
    const teks = kanonik(payload);
    expect(dariKanonik(teks)).toEqual(payload);
  });

  it("dariKanonik menolak payload yang hilang field wajib", () => {
    const { username, ...tanpaUsername } = payload;
    void username;
    expect(dariKanonik(JSON.stringify(tanpaUsername))).toBeNull();
  });

  it("dariKanonik menolak skor non-numerik", () => {
    expect(dariKanonik(JSON.stringify({ ...payload, score: "87" }))).toBeNull();
    expect(dariKanonik(JSON.stringify({ ...payload, score: Number.NaN }))).toBeNull();
  });

  it("dariKanonik menolak teks bukan JSON", () => {
    expect(dariKanonik("bukan-json")).toBeNull();
    expect(dariKanonik("")).toBeNull();
  });
});
