import { AxInner, AxLabel, AxSection } from "@/components/ui/section";

type Row = {
  index: string;
  title: string;
  meta: string;
  tag: string;
  accent?: boolean;
};

const ROWS: Row[] = [
  {
    index: "01",
    title: "Navigator",
    meta:
      "Membedah skill gap user vs tren lowongan KarirHub, lalu merakit urutan modul mikro harian. Hanya merekomendasikan; tidak mengubah skor.",
    tag: "Rekomendasi",
  },
  {
    index: "02",
    title: "Socrates",
    meta:
      "Membedah diff/AST submission, menyusun 2-3 pertanyaan nalar yang dijawab user dalam 48 jam. Nilainya draft, verifikator yang mengesahkan.",
    tag: "Draft",
  },
  {
    index: "03",
    title: "Sentinel",
    meta:
      "Audit loker: usia domain, pola fee, regex transfer pribadi, status karantina. Karantina bisa dibanding dan keputusan akhir verifikator.",
    tag: "Anti-fraud",
  },
  {
    index: "04",
    title: "Attestation HMAC-SHA256",
    meta:
      "Tanda tangan lintas bahasa (JS ↔ Python) dengan key scope publik. Siapa pun bisa memverifikasi badge tanpa login.",
    tag: "Terverifikasi",
    accent: true,
  },
  {
    index: "05",
    title: "Audit chain append-only",
    meta:
      "Hash entry sebelumnya ditautkan ke entry berikutnya. Edit di masa lalu merambat dan langsung gagal verifikasi.",
    tag: "Tamper-evident",
  },
];

export function Agents() {
  return (
    <AxSection id="agen" labelledBy="arch-title">
      <AxInner>
        <AxLabel>Arsitektur</AxLabel>
        <h2 id="arch-title" className="ax-h2">
          Tiga agen · Socrates · rantai audit
        </h2>
        <ul className="ax-rows">
          {ROWS.map((row) => (
            <li className="ax-row" key={row.index}>
              <span className="ax-row-index">{row.index}</span>
              <div className="ax-row-body">
                <div className="ax-row-title">{row.title}</div>
                <div className="ax-row-meta">{row.meta}</div>
              </div>
              <span className={row.accent ? "ax-row-tag accent" : "ax-row-tag"}>{row.tag}</span>
            </li>
          ))}
        </ul>
      </AxInner>
    </AxSection>
  );
}
