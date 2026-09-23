import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { ResourceList } from "@/components/features/learning/resource-list";
import { StatusBadge } from "@/components/ui/status-badge";
import { Btn } from "@/components/ui/btn";
import { resources, tasks } from "@/lib/fixtures";

export const metadata: Metadata = {
  title: "Belajar",
};

export default async function BelajarPage() {
  const session = await getSession();
  if (!session) return null;

  const nextTask = tasks.find((task) => task.status === "available" || task.status === "review");

  return (
    <AppShell session={session} current="/belajar">
      <PageHead
          eyebrow="Learning Path"
          title="Belajar terukur"
          lead="Resource terkurasi, progres modul, dan task praktik berikutnya. Setiap modul tersambung ke challenge."
        />

        {nextTask ? (
          <section className="card" style={{ marginBottom: "1.25rem" }} aria-labelledby="next-task">
            <div className="card-head">
              <div>
                <p className="section-label">Task berikutnya</p>
                <h2 className="card-title" id="next-task">
                  {nextTask.title}
                </h2>
                <p className="card-sub">{nextTask.brief}</p>
              </div>
              <StatusBadge status={nextTask.status === "review" ? "waiting_review" : "clean"} />
            </div>
            <div className="hero-actions" style={{ marginTop: 0 }}>
              <Btn href={`/challenge/${nextTask.id}`}>Buka challenge</Btn>
            </div>
          </section>
        ) : null}

        <section className="card" aria-labelledby="resource-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="resource-title">
                Resource by tag dan level
              </h2>
              <p className="card-sub">YouTube API dan course gratis maupun berbayar</p>
            </div>
          </div>
          <ResourceList resources={resources} />
        </section>
    </AppShell>
  );
}
