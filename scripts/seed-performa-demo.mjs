#!/usr/bin/env node
// Seed data demo untuk dashboard laporan performa (`/performa`).
//
// Menulis langsung ke `.data/performa/` dan `.data/sessions/`, keduanya
// gitignored, jadi aman untuk mesin pengembangan. Menjalankan ulang skrip ini
// menimpa data demo dengan hasil yang sama — tidak menumpuk.
//
// Pakai:
//   node scripts/seed-performa-demo.mjs          seed / timpa data demo
//   node scripts/seed-performa-demo.mjs --clear  hapus data demo saja
//
// Data ini SANGAT TIDAK mewakili catatan nyata: skor kuis dibuat-buat, dan
// sengaja ada peserta yang punya banyak kejadian integritas justru agar terlihat
// bahwa kejadian itu konteks — bukan vonis. Jangan dipakai sebagai dasar keputusan.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const PERFORMA = process.env.CAREEVO_PERFORMA_DIR ?? path.join(process.cwd(), ".data", "performa");
const SESI = process.env.CAREERS_SESSION_DIR ?? path.join(process.cwd(), ".data", "sessions");
const bersihkan = process.argv.includes("--clear");

function hashEmail(email) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function iso(hariLalu, jam = 10) {
  const d = new Date();
  d.setDate(d.getDate() - hariLalu);
  d.setHours(jam, 0, 0, 0);
  return d.toISOString();
}

function mulai(hariLalu, menit = 0) {
  return new Date(Date.parse(iso(hariLalu)) + menit * 60_000).toISOString();
}

const KURSUS = {
  "crs-1": "Fullstack Web Development: Next.js 15 & React 19",
  "crs-2": "Membangun REST API Modern dengan Node.js",
  "crs-3": "Web Security & OWASP Top 10 Defense",
  "crs-7": "Automated Testing: Vitest & Playwright E2E",
};

const PESERTA = [
  {
    owner: "user@careevo.test",
    nama: "Raka Pratama",
    kursus: [
      {
        course_id: "crs-1",
        judul: KURSUS["crs-1"],
        selesai: [
          { modul_id: "crs-1-m1", at: iso(6), sumber: "terverifikasi" },
          { modul_id: "crs-1-m2", at: iso(5), sumber: "terverifikasi" },
          { modul_id: "crs-1-m3", at: iso(4), sumber: "terverifikasi" },
          { modul_id: "crs-1-m4", at: iso(2), sumber: "informal" },
        ],
        kuis: [
          { kuis_id: "kuis-crs-1-m3", modul_id: "crs-1-m3", nilai: 100, total_soal: 8, at: iso(4, 11), sumber: "klien" },
          { kuis_id: "kuis-crs-1-m2", modul_id: "crs-1-m2", nilai: 75, total_soal: 4, at: iso(5, 14), sumber: "klien" },
        ],
      },
      {
        course_id: "crs-7",
        judul: KURSUS["crs-7"],
        selesai: [{ modul_id: "crs-7-m1", at: iso(1), sumber: "terverifikasi" }],
        kuis: [{ kuis_id: "kuis-crs-7-m1", modul_id: "crs-7-m1", nilai: 60, total_soal: 5, at: iso(1, 15), sumber: "klien" }],
      },
    ],
  },
  {
    // Banyak kejadian integritas, tapi skornya bagus. Ini sengaja: untuk
    // memastikan tampilan tidak mengarang vonis dari catatan JW.
    owner: "verifikator@careevo.test",
    nama: "Dewi Larasati",
    kursus: [
      {
        course_id: "crs-3",
        judul: KURSUS["crs-3"],
        selesai: [
          { modul_id: "crs-3-m1", at: iso(9), sumber: "informal" },
          { modul_id: "crs-3-m2", at: iso(8), sumber: "terverifikasi" },
        ],
        kuis: [{ kuis_id: "kuis-crs-3-m2", modul_id: "crs-3-m2", nilai: 90, total_soal: 10, at: iso(8, 16), sumber: "klien" }],
      },
    ],
  },
  {
    // Progres sedikit dan satu sesi kedaluwarsa — status baru yang ditambahkan
    // di sesi ini, supaya terlihat di kolom "sesi".
    owner: "budi@careevo.test",
    nama: "Budi Santoso",
    kursus: [
      {
        course_id: "crs-2",
        judul: KURSUS["crs-2"],
        selesai: [{ modul_id: "crs-2-m1", at: iso(20), sumber: "terverifikasi" }],
        kuis: [{ kuis_id: "kuis-crs-2-m1", modul_id: "crs-2-m1", nilai: 40, total_soal: 5, at: iso(20, 13), sumber: "klien" }],
      },
    ],
  },
];

/** Sesi demo: status `diakhiri` dan `kedaluwarsa` sengaja keduanya ada. */
function sesiUntuk(owner, courseId, hariLalu, status, kejadian) {
  const mulaiAt = iso(hariLalu, 9);
  const run = {
    id: `sesi-demo-${randomUUID().slice(0, 8)}`,
    course_id: courseId,
    owner,
    policy_version: 1,
    status,
    mulai_at: mulaiAt,
    berlaku_hingga: mulai(0, 30),
    berakhir_at: status === "aktif" ? null : mulai(hariLalu, 10),
    ...(status === "kedaluwarsa" ? { alasan_akhir: "kedaluwarsa_waktu" } : { alasan_akhir: "peserta_akhiri" }),
    kejadian,
  };
  return run;
}

const kej = (jenis, klasifikasi, menit, vis = "hidden") => ({
  at: mulai(0, menit),
  jenis,
  jenis_klasifikasi: klasifikasi,
  visibilitas: vis,
});

const RUN = [
  sesiUntuk("user@careevo.test", "crs-1", 6, "diakhiri", [
    kej("sesi_dimulai", "kejadian", 0, "visible"),
    kej("fokus_hilang", "kejadian", 8, "visible"),
    kej("sesi_diakhiri", "kejadian", 25, "visible"),
  ]),
  sesiUntuk("user@careevo.test", "crs-1", 2, "diakhiri", [
    kej("sesi_dimulai", "kejadian", 0, "visible"),
    kej("pindah_tab", "kejadian", 6),
    kej("sesi_diakhiri", "kejadian", 18, "visible"),
  ]),
  sesiUntuk("user@careevo.test", "crs-7", 1, "aktif", [kej("sesi_dimulai", "kejadian", 0, "visible")]),

  // Catatan integritasnya biasanya banyak, tapi ini konteks — bukan vonis.
  sesiUntuk("verifikator@careevo.test", "crs-3", 8, "diakhiri", [
    kej("sesi_dimulai", "kejadian", 0, "visible"),
    kej("pindah_tab", "kejadian", 3),
    kej("pindah_tab", "kejadian", 5),
    kej("fokus_hilang", "kejadian", 9, "visible"),
    kej("pindah_tab", "kejadian", 14),
    kej("sesi_diakhiri", "kejadian", 29, "visible"),
  ]),

  sesiUntuk("budi@careevo.test", "crs-2", 20, "kedaluwarsa", [
    kej("sesi_dimulai", "kejadian", 0, "visible"),
    kej("kamera_gagal", "celah", 7, null),
    kej("pindah_tab", "kejadian", 11),
  ]),
];

async function hapusDemo() {
  await rm(PERFORMA, { recursive: true, force: true });
  let berkas = [];
  try {
    berkas = await readdir(SESI);
  } catch {
    return;
  }
  for (const n of berkas) {
    if (n.startsWith("sesi-demo-") && n.endsWith(".json")) {
      await rm(path.join(SESI, n), { force: true });
    }
  }
}

async function seed() {
  await mkdir(PERFORMA, { recursive: true });
  await mkdir(SESI, { recursive: true });

  for (const p of PESERTA) {
    const record = { owner: p.owner, nama: p.nama, versi_skema: 1, kursus: p.kursus };
    await writeFile(
      path.join(PERFORMA, `${hashEmail(p.owner)}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
  }
  for (const run of RUN) {
    await writeFile(path.join(SESI, `${run.id}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  }
}

await hapusDemo();
if (bersihkan) {
  console.log("Data demo dihapus.");
} else {
  await seed();
  console.log(`Data demo ditulis ke ${PERFORMA}`);
  console.log(`${PESERTA.length} peserta, ${RUN.length} sesi.`);
  console.log("Buka http://localhost:3000/performa sebagai akun verifikator.");
}
