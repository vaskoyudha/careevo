import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ChipProps = {
  ok?: boolean;
  className?: string;
  children: ReactNode;
};

export function Chip({ ok = false, className, children }: ChipProps) {
  return (
    <Badge variant="outline" className={cn("chip", ok && "ok", className)}>
      {children}
    </Badge>
  );
}
