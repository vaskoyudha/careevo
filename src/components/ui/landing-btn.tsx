import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Landing-page button.
 *
 * Reuses the exact classes the marketing pages use so that in-app surfaces
 * (e.g. /profil and its "Edit profile" dialog) share one visual language with
 * the landing page: `grad-btn` for the primary action and a soft grey
 * secondary. `rounded-lg`, `h-11`, `text-base font-medium`.
 */
type LandingBtnVariant = "primary" | "secondary";

const VARIANT_CLASS: Record<LandingBtnVariant, string> = {
  primary: "grad-btn",
  secondary:
    "border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100",
};

const BASE_CLASS =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-medium transition duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-60 hover:no-underline";

export function LandingBtn({
  variant = "primary",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: LandingBtnVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(BASE_CLASS, VARIANT_CLASS[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LandingBtnLink({
  variant = "primary",
  className,
  href,
  children,
  ...rest
}: {
  variant?: LandingBtnVariant;
  className?: string;
  href: string;
  children: ReactNode;
  target?: string;
  rel?: string;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(BASE_CLASS, VARIANT_CLASS[variant], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
