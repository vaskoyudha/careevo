import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TutorDrawer } from "./tutor-drawer";

/**
 * Drawer tutor — diuji lewat HTML hasil render.
 *
 * Yang dikunci adalah hal-hal yang kalau salah merusak percakapan atau kebijakan:
 * 1. Tertutup **tidak** berarti tidak dirender (iframe harus tetap hidup).
 * 2. `boleh: false` tidak boleh memuat iframe sama sekali.
 * 3. Atribut keamanan frame ikut terpasang.
 */

const SRC = "http://localhost:3790/embed/chat?course=r2";

function render(props: Partial<Parameters<typeof TutorDrawer>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(TutorDrawer, { src: SRC, buka: true, onTutup: () => {}, boleh: true, ...props }),
  );
}

describe("TutorDrawer", () => {
  it("merender iframe saat dibuka", () => {
    const html = render({ buka: true });
    expect(html).toContain("<iframe");
    expect(html).toContain(SRC);
  });

  it("tetap merender iframe saat tertutup — disembunyikan, bukan dilepas", () => {
    // Ini yang menjaga WebSocket dan transkrip tetap hidup saat peserta menutup
    // drawer untuk membaca. Melepas iframe akan memuat ulang dokumennya.
    const html = render({ buka: false });
    expect(html).toContain("<iframe");
    // `hidden` harus ada di kelas `<aside>`, bukan sekadar di suatu tempat di
    // dokumen: gagang resize juga memakai kelas `hidden` (bersama `xl:block`),
    // jadi assertion `toContain("hidden")` yang longgar tetap hijau walau
    // drawer-nya justru terlihat — mutasi "selalu kelas buka" akan lolos.
    const aside = html.match(/<aside[^>]*>/)?.[0] ?? "";
    expect(aside).toContain("hidden");
  });

  it("tidak memuat iframe sama sekali saat kebijakan melarang", () => {
    const html = render({ boleh: false });
    expect(html).not.toContain("<iframe");
  });

  it("memasang sandbox dan referrerPolicy", () => {
    const html = render();
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"');
    // Dibandingkan tanpa peduli huruf besar/kecil: React 19 merender atribut ini
    // sebagai `referrerPolicy` (camelCase) di `renderToStaticMarkup`, sementara
    // HTML sendiri tidak case-sensitive untuk nama atribut. Assertion lowercase
    // yang ketat akan gagal pada kode yang benar.
    expect(html.toLowerCase()).toContain('referrerpolicy="no-referrer"');
  });

  it("punya id yang bisa dirujuk aria-controls tombol", () => {
    expect(render()).toContain('id="drawer-tutor"');
  });

  it("di xl drawer mengapung (bukan lagi ter-dock), dan bukan `static`", () => {
    // Drawer dulu `xl:relative` — saudara flex yang ter-dock, sehingga membuka
    // tutor **menyusutkan** kolom baca. Sekarang ia `fixed` seperti panel
    // silabus: kolom baca tetap selebar penuh dan drawer mengapung di atasnya.
    //
    // Kelas `xl:*`-nya sendiri sudah dibuang dari komponen — geometri `xl`
    // tinggal di `.reader-drawer` (`globals.css`), karena deklarasi yang tak
    // berlapis mengalahkan utility Tailwind sehingga dua tempat itu akan
    // berbeda diam-diam. Yang dikunci di sini: tidak ada lagi `xl:relative`,
    // dan `static` tetap tidak boleh dipakai (gagang resize adalah anak
    // `absolute`; tanpa containing block ia mengukur ke initial containing
    // block dan muncul sebagai garis di tepi viewport).
    //
    // Ini assertion kehadiran kelas pada markup, bukan pemeriksaan layout
    // sungguhan — repo ini tidak punya jsdom. Yang mengukur `fixed`-nya
    // sungguhan adalah `.reader-drawer` di `globals.css` (dijaga di
    // `reader-tutor-drawer.test.ts`).
    const aside = render().match(/<aside[^>]*>/)?.[0] ?? "";
    expect(aside).not.toContain("xl:relative");
    expect(aside).not.toContain("xl:static");
    expect(aside).toContain("reader-drawer");
    // `fixed` tetap dipakai di bawah `xl` (lembar penuh dengan scrim).
    expect(aside).toContain("fixed");
  });
});
