import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Careevo wordmark — the same treatment as the landing page header
 * (`.chrome-brand`): "Care" in ocean-deep navy, "evo" in leaf-dark green,
 * bold, tight tracking. Reused on the onboarding screen so the brand reads
 * identically everywhere.
 */
export function CareevoLogo({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-baseline text-[1.06rem] font-bold tracking-[-0.02em] no-underline",
        className,
      )}
    >
      <span className="text-[#0A3D62]">Care</span>
      <span className="text-[#1F6B40]">evo</span>
    </Link>
  );
}
