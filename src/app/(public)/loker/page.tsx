import type { Metadata } from "next";
import { PageHead } from "@/components/ui/page-head";
import { JobsBoard } from "@/components/features/jobs/jobs-board";
import { ambilLokerBersih, ambilLokerTampil } from "@/lib/jobs/cache";

export const metadata: Metadata = {
  title: "Job Board",
  description: "Loker resmi KarirHub yang diaudit Sentinel, dengan filter no-fee dan fit score terbuka.",
};

export default async function LokerPage() {
  const jobs = await ambilLokerTampil();
  const bersih = await ambilLokerBersih();

  return (
    <section className="section" aria-labelledby="loker-title">
      <div className="container section-inner">
        <PageHead
          eyebrow="Job Seeking"
          title="Loker yang diaudit"
          lead="Setiap loker lewat Sentinel: pola fee, regex transfer pribadi, usia domain, dan kepercayaan URL. Loker minta biaya tidak pernah lolos."
        />
        <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-box">
            <span className="stat-box-label">Total loker</span>
            <span className="stat-box-value">{jobs.length}</span>
            <p className="stat-box-note">Dari cache KarirHub</p>
          </div>
          <div className="stat-box">
            <span className="stat-box-label">Lolos audit</span>
            <span className="stat-box-value">{bersih.length}</span>
            <p className="stat-box-note">Status AMAN</p>
          </div>
          <div className="stat-box">
            <span className="stat-box-label">No-fee terfilter</span>
            <span className="stat-box-value">100%</span>
            <p className="stat-box-note">Loker berbiaya dikarantina</p>
          </div>
        </div>
        <div className="card">
          <JobsBoard jobs={jobs} />
        </div>
      </div>
    </section>
  );
}
