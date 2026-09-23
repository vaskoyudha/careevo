import { AxInner, AxLabel } from "@/components/ui/section";
import { Btn } from "@/components/ui/btn";

export function Cta() {
  return (
    <section className="ax-cta" id="cta" aria-labelledby="cta-title">
      <AxInner>
        <AxLabel>Call to action</AxLabel>
        <h2 id="cta-title" className="ax-cta-title">
          Jejak yang bisa dibuktikan, bukan klaim.
        </h2>
        <p className="ax-lead">
          Buka Audit Trail untuk melihat rantai append-only, atau mulai loop demo dari jadwal
          belajar.
        </p>
        <div className="hero-actions" style={{ justifyContent: "center" }}>
          <Btn href="/daftar">Daftar</Btn>
          <Btn variant="ghost" href="/masuk">
            Masuk
          </Btn>
          <Btn variant="ghost" href="/audit">
            Buka Audit Trail
          </Btn>
        </div>
      </AxInner>
    </section>
  );
}
