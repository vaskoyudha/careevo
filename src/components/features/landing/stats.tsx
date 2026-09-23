import { AxInner, AxLabel, AxSection } from "@/components/ui/section";

type Stat = {
  label: string;
  value: string;
  source: string;
  tone?: "alert" | "warn";
};

const STATS: Stat[] = [
  {
    label: "Pengangguran usia 15-24",
    value: "17,37%",
    source: "BPS Sakernas Mei 2026",
    tone: "alert",
  },
  {
    label: "Kerugian scam finansial",
    value: "Rp7,9T",
    source: "OJK Anti-Scam Centre, Nov 2024 - Nov 2025",
    tone: "warn",
  },
  {
    label: "Loker aktif KarirHub",
    value: "81.171",
    source: "KarirHub Sep 2026 · 7,22 juta penganggur nasional",
  },
  {
    label: "Target lead time to hire",
    value: "< 3 bulan",
    source: "Baseline 6-9 bulan pada cohort pilot",
  },
];

export function Stats() {
  return (
    <AxSection labelledBy="stats-title">
      <AxInner wide>
        <AxLabel>Indikator</AxLabel>
        <h2 id="stats-title" className="sr-only">
          Indikator utama
        </h2>
        <div className="ax-stats" role="list">
          {STATS.map((stat) => (
            <div className="ax-stat" role="listitem" key={stat.label}>
              <span className="ax-stat-label">{stat.label}</span>
              <span className={["ax-stat-value", stat.tone].filter(Boolean).join(" ")}>
                {stat.value}
              </span>
              <span className="ax-stat-source">{stat.source}</span>
            </div>
          ))}
        </div>
      </AxInner>
    </AxSection>
  );
}
