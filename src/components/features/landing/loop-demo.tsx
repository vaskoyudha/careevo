import { AxInner, AxLabel, AxSection } from "@/components/ui/section";

type Step = {
  num: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    num: "01",
    title: "Set jadwal, check-in, kerjakan task",
    body:
      "User menentukan jadwal dan check-in sesi, lalu mengerjakan task di IDE-lite. Snapshot, Paste Guard, dan prompt log aktif merekam proses.",
  },
  {
    num: "02",
    title: "Submit + auto-check + VTS",
    body:
      "Test suite Playwright dan Lighthouse mobile jalan otomatis saat submit. Report menyertakan Vibe Transparency Score sebagai bukti proses.",
  },
  {
    num: "03",
    title: "Socrates bertanya",
    body:
      "Agen menyusun 2-3 pertanyaan nalar dari diff. User menjawab dalam 48 jam; nilainya masih draft sebelum verifikator mengesahkan.",
  },
  {
    num: "04",
    title: "Review rubrik 5 kriteria",
    body:
      "Verifikator menilai kelengkapan, kualitas, orisinalitas, ketepatan brief, dan dokumentasi. Approve atau reject wajib disertai alasan.",
  },
  {
    num: "05",
    title: "Badge, attestation, lalu match kerja",
    body:
      "Badge ditandatangani HMAC-SHA256 dan masuk rantai audit append-only. Fit score muncul di Job Board, lanjut apply dan tracker outcome.",
  },
];

export function LoopDemo() {
  return (
    <AxSection id="loop" labelledBy="how-title">
      <AxInner>
        <AxLabel>Loop demo</AxLabel>
        <h2 id="how-title" className="ax-h2">
          Dari task sampai badge
        </h2>
        <p className="ax-lead">Acceptance gate per langkah, siap didemokan dalam 5 menit.</p>
        <ol className="ax-steps">
          {STEPS.map((step) => (
            <li key={step.num}>
              <span className="ax-step-num">{step.num}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="caption ax-caption">
          Demo aman lewat PWA: mode offline-first, tidak bergantung pada jaringan.
        </p>
      </AxInner>
    </AxSection>
  );
}
