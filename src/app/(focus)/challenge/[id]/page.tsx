import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { Workbench } from "@/components/features/challenge/workbench";
import { getTask } from "@/lib/fixtures";

export const metadata: Metadata = {
  title: "Challenge",
};

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;
  const task = getTask(id);
  if (!task) notFound();

  return (
    <AppShell session={session} current="/belajar">
        <div className="grid-2" style={{ marginBottom: "1.25rem" }}>
          <div className="card">
            <p className="section-label">Brief</p>
            <p style={{ margin: 0 }}>{task.brief}</p>
          </div>
          <div className="card">
            <p className="section-label">Kriteria dan batasan</p>
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {task.criteria.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="caption muted" style={{ marginTop: "0.5rem" }}>
              Batasan: {task.constraints.join(", ")}
            </p>
          </div>
        </div>
        <Workbench taskId={task.id} taskTitle={task.title} />
    </AppShell>
  );
}
