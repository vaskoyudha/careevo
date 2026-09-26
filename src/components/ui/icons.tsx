import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Fingerprint,
  GitBranch,
  GraduationCap,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Radar,
  Route,
  ScanLine,
  ScanSearch,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkle,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Attio-spec icon default properties:
 * - strokeWidth: 1.5 (refined hairline precision)
 * - default sizing: 15px (matches navbar & micro-UI grid)
 */
export const ATTIO_ICON_DEFAULTS = {
  size: 15,
  strokeWidth: 1.5,
  "aria-hidden": true,
} as const;

export interface IconBadgeProps extends ComponentPropsWithoutRef<"span"> {
  icon: ElementType<{ className?: string; size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}

/**
 * Attio-style geometric icon mark / chip wrapper
 */
export function ProductMark({
  icon: Icon,
  size = "md",
  className,
  ...props
}: IconBadgeProps) {
  const sizeClasses = {
    sm: "size-7 rounded-[8px] text-[#2a7fb8]",
    md: "size-9 rounded-[11px] text-[#2a7fb8]",
    lg: "size-10 rounded-[12px] text-[#124e78]",
  };

  const iconSizes = {
    sm: 13,
    md: 15,
    lg: 18,
  };

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-[#bfd9e7] bg-white/85 shadow-[0_1px_2px_rgba(10,61,98,0.08)]",
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      <Icon
        size={iconSizes[size]}
        strokeWidth={1.5}
        className="shrink-0"
        aria-hidden={true}
      />
    </span>
  );
}

// Re-export core curated icons with standard types
export {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Fingerprint,
  GitBranch,
  GraduationCap,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Radar,
  Route,
  ScanLine,
  ScanSearch,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkle,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
  type LucideProps,
};
