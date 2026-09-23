import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="card-title" style={{ marginBottom: "0.35rem" }}>
        {title}
      </p>
      {children ? <p className="muted" style={{ margin: "0 auto", maxWidth: "48ch" }}>{children}</p> : null}
      {action ? <div style={{ marginTop: "1rem" }}>{action}</div> : null}
    </div>
  );
}
