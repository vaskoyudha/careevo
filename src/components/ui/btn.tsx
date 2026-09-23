import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BtnVariant = "primary" | "ghost";

const variantMap: Record<BtnVariant, "brand" | "glass"> = {
  primary: "brand",
  ghost: "glass",
};

type BtnProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href"> & {
  variant?: BtnVariant;
  className?: string;
  href: string;
  children: ReactNode;
};

export function Btn({ variant = "primary", className, href, children, ...rest }: BtnProps) {
  return (
    <Button asChild variant={variantMap[variant]} size="pill" className={cn(className)}>
      <Link href={href} {...rest}>
        {children}
      </Link>
    </Button>
  );
}
