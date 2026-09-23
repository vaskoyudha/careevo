import { Fragment } from "react";
import { AxInner, AxLabel, AxSection } from "@/components/ui/section";
import { Chip } from "@/components/ui/chip";

type Segment = {
  num: string;
  title: string;
  body: string;
};

const SEGMENTS: Segment[] = [
  {
    num: "01",
    title: "Course",
    body:
      "Penjadwalan mandiri, check-in/out, streak dan kepatuhan, Navigator path, learning path kurasi, serta progres modul. Jadwal jadi lapisan akuntabilitas, Navigator jadi lapisan isi materi.",
  },
  {
    num: "02",
    title: "Validasi",
    body:
      "Process Trail (snapshot/diff), Paste Guard, Prompt Log dan AI disclosure, Auto-Check Playwright + Lighthouse, Socrates Defense, report dan VTS, review rubrik verifikator, Cryptographic Attestation HMAC, serta audit log.",
  },
  {
    num: "03",
    title: "Job Seeking",
    body:
      "Agregat loker resmi KarirHub, Sentinel audit (fee, regex transfer, usia domain), filter no-fee, fit score, apply dan tracker, serta profil publik /p/[username].",
  },
];

const CORE_LOOP = "Record → Verify → Match → Prepare → Apply → Track";
const CORE_LOOP_STAGES = CORE_LOOP.split(" → ");

export function Segments() {
  return (
    <AxSection id="segmen" labelledBy="segmen-title">
      <AxInner>
        <AxLabel>Solusi</AxLabel>
        <h2 id="segmen-title" className="ax-h2">
          Tiga segmen, satu loop inti
        </h2>
        <p className="ax-lead">
          Bukan kursus online, bukan job board: lapisan pembuktian skill manusia di era portfolio AI.
        </p>
        <div className="ax-pillars">
          {SEGMENTS.map((segment) => (
            <article className="ax-pillar" key={segment.num}>
              <span className="ax-pillar-num">{segment.num}</span>
              <h3>{segment.title}</h3>
              <p>{segment.body}</p>
            </article>
          ))}
        </div>
        <div className="chips ax-chips" aria-label="Loop inti">
          {CORE_LOOP_STAGES.map((stage, index) => (
            <Fragment key={stage}>
              {index > 0 && (
                <span className="ax-loop-arrow" aria-hidden="true">
                  {" → "}
                </span>
              )}
              <Chip>{stage}</Chip>
            </Fragment>
          ))}
        </div>
      </AxInner>
    </AxSection>
  );
}
