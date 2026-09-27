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

  it("di xl drawer memakai `relative`, bukan `static`, agar gagang resize punya containing block", () => {
    // Gagang resize adalah anak `absolute`. Elemen `static` tidak membentuk
    // containing block, dan tidak ada leluhur yang `position`-ed (body tidak),
    // jadi dengan `xl:static` gagangnya mengukur ke initial containing block:
    // garis ~4px setinggi viewport di tepi kiri, bukan di tepi kiri drawer.
    //
    // Ini assertion kehadiran kelas pada markup, bukan pemeriksaan layout
    // sungguhan — repo ini tidak punya jsdom, jadi tidak ada cara mengukur
    // containing block di test. Yang dikunci hanya "kelas yang benar ada di
    // <aside>"; regresi layout nyata tetap butuh mata di browser.
    const aside = render().match(/<aside[^>]*>/)?.[0] ?? "";
    expect(aside).toContain("xl:relative");
    expect(aside).not.toContain("xl:static");
  });
});
