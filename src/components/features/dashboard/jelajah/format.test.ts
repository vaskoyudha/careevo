import { describe, it, expect } from "vitest";
import { PROGRAMS_REGISTRY, getProgramBySlug } from "@/lib/courses/catalog-data";
import {
  kategoriProgram,
  kredensialProgram,
  keterampilanProgram,
  levelProgram,
  mulaiProgram,
  subkategoriProgram,
} from "./format";

/**
 * Halaman detail program menampilkan `type`, `level`, `startDate`,
 * `category`, `subcategory`, dan `skills` apa adanya, sementara nilai-nilai itu
 * sengaja tetap bahasa Inggris di `catalog-data.ts` karena `explore-queries.ts`
 * mencocokkannya dengan string literal. Terjemahannya ada di `format.ts`.
 *
 * Konsekuensinya: menambah program ke registry tanpa menambah kunci ke peta di
 * sini tidak melempar apa pun — `?? nilai` mengembalikan teks Inggris apa
 * adanya, jadi chip "Data Cleaning" muncul di antara teks Indonesia. Itu kelas
 * regresi yang enak dilihat tapi tidak pernah gagal build, jadi tes di bawah
 * mengunci peta yang bisa lapar diam-diam.
 */

/**
 * Nilai yang boleh lewat apa adanya: nama produk, akronim, dan istilah teknis
 * yang lazim tidak diterjemahkan dalam bahasa Indonesia. "Machine Learning"
 * ada di sini karena seluruh halaman sudah memakainya sebagai istilah —
 * menerjemahkannya hanya membuat program dan subkategori memakai dua nama
 * berbeda untuk satu hal.
 */
const BUKAN_LABEL = new Set([
  "IBM Cognos",
  "Linux CLI",
  "Pandas & NumPy",
  "Tableau Dashboards",
  "Machine Learning",
]);

describe("terjemahan label program", () => {
  it("setiap skill program punya terjemahan, kecuali yang memang produk", () => {
    const belum: string[] = [];

    for (const program of Object.values(PROGRAMS_REGISTRY)) {
      const hasil = keterampilanProgram(program.skills);
      program.skills.forEach((skill, i) => {
        if (hasil[i] === skill && !BUKAN_LABEL.has(skill)) belum.push(skill);
      });
    }

    expect([...new Set(belum)]).toEqual([]);
  });

  it("setiap category dan subcategory punya terjemahan, termasuk program sintetis", () => {
    const belum: string[] = [];
    const lolos = (nilai: string) => !BUKAN_LABEL.has(nilai);

    // Program sintetis ikut diperiksa: `getProgramBySlug` synthesnya memakai
    // category "Professional Development" dan subcategory "Applied Learning",
    // yang tidak ada di registry.
    const program = [
      ...Object.values(PROGRAMS_REGISTRY),
      getProgramBySlug("slug-yang-tidak-ada-di-registry"),
    ];

    for (const p of program) {
      if (lolos(p.category) && kategoriProgram(p.category) === p.category) {
        belum.push(p.category);
      }
      if (lolos(p.subcategory) && subkategoriProgram(p.subcategory) === p.subcategory) {
        belum.push(p.subcategory);
      }
    }

    expect([...new Set(belum)]).toEqual([]);
  });

  it("kredensial dan level diterjemahkan, bukan dikembalikan apa adanya", () => {
    const program = getProgramBySlug("google-data-analytics");
    expect(kredensialProgram(program.type)).toBe("Sertifikat Profesional");
    expect(levelProgram(program.level)).toBe("Pemula");
  });

  it("tanggal mulai diterjemahkan ke kosakata Indonesia", () => {
    expect(mulaiProgram("Starts Today")).toBe("Mulai hari ini");
    expect(mulaiProgram("Starts Sep 24")).toBe("Mulai 24 Sep");
  });
});
