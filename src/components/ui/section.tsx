import type { ElementType, ReactNode } from "react";

type AxSectionProps = {
  id?: string;
  className?: string;
  labelledBy?: string;
  ariaLabel?: string;
  children: ReactNode;
};

export function AxSection({ id, className, labelledBy, ariaLabel, children }: AxSectionProps) {
  return (
    <section
      id={id}
      className={["ax-section", className].filter(Boolean).join(" ")}
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
    >
      {children}
    </section>
  );
}

type AxInnerProps = {
  wide?: boolean;
  className?: string;
  children: ReactNode;
};

export function AxInner({ wide = false, className, children }: AxInnerProps) {
  return (
    <div className={["ax-inner", wide ? "ax-wide" : null, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

type AxLabelProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
};

export function AxLabel({ as, className, children }: AxLabelProps) {
  const Tag = as ?? "p";
  return <Tag className={["ax-label", className].filter(Boolean).join(" ")}>{children}</Tag>;
}
