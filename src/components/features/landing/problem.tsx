import { AxInner, AxLabel, AxSection } from "@/components/ui/section";
import { Chip } from "@/components/ui/chip";

const PROBLEMS = [
  {
    title: "Pengangguran terdidik struktural.",
    body:
      "Pengangguran usia 15-24 tahun 17,37% (BPS Sakernas Mei 2026). Lulusan dan training ada, jembatan terpercaya ke pekerjaan pertama tidak ada.",
  },
  {
    title: "Loker palsu memajaki yang putus asa.",
    body:
      "Rp7,9 triliun kerugian scam Nov 2024 - Nov 2025. Fee admin fiktif, panen KTP/selfie/OTP, dan APK berbahaya menyasar anak muda tanpa penghasilan.",
  },
  {
    title: "KarirHub listing, tapi tidak membimbing.",
    body:
      "81.171 loker aktif, verifikasi 3x24 jam. Belum ada rekam kompetensi portable, fit scoring, maupun outcome loop serapan lulusan.",
  },
  {
    title: "Cognitive debt dan portfolio AI tidak dipercaya.",
    body:
      "Prompt-and-pray menghasilkan web fungsional tanpa pergulatan logika. Recruiter tidak bisa membedakan yang paham dari operator prompt.",
  },
  {
    title: "Experience paradox dan skill mismatch.",
    body:
      "Lowongan entry-level menuntut 1-2 tahun pengalaman. Sertifikat LSP/BNSP dan proyek MSIB/magang tidak terverifikasi di mata industri.",
  },
];

const STACK_CHIPS = [
  "Next.js",
  "Tailwind v4",
  "Supabase",
  "Zod",
  "HMAC-SHA256 lintas bahasa",
  "PWA",
  "Playwright · Lighthouse",
];

export function Problem() {
  return (
    <AxSection id="masalah" labelledBy="problem-title">
      <AxInner>
        <AxLabel>Latar belakang</AxLabel>
        <h2 id="problem-title" className="ax-h2">
          Masalah &amp; solusi
        </h2>
        <div className="ax-split">
          <div className="ax-split-col">
            <h3 className="ax-split-title danger">Masalah</h3>
            <ul className="ax-list">
              {PROBLEMS.map((problem) => (
                <li key={problem.title}>
                  <strong>{problem.title}</strong> {problem.body}
                </li>
              ))}
            </ul>
          </div>
          <div className="ax-split-rule" aria-hidden="true" />
          <div className="ax-split-col">
            <h3 className="ax-split-title success">Solusi</h3>
            <p>
              Tiga segmen Course, Validasi, dan Job Seeking plus bukti proses (Process Trail, prompt
              log, VTS, dan attestation HMAC), bukan klaim portfolio AI. Proses terekam, hasil
              ditandatangani, dan keputusan akhir tetap di verifikator manusia. Tanpa biometrik, tanpa
              silent reject.
            </p>
          </div>
        </div>
        <div className="chips ax-chips">
          {STACK_CHIPS.map((item) => (
            <Chip ok key={item}>
              {item}
            </Chip>
          ))}
        </div>
      </AxInner>
    </AxSection>
  );
}
