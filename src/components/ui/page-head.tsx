import type { ReactNode } from "react";

export function PageHead({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
      <h1 className="page-title">{title}</h1>
      {lead ? <p className="page-lead">{lead}</p> : null}
      {actions ? <div className="hero-actions" style={{ marginTop: "1rem" }}>{actions}</div> : null}
    </div>
  );
}
