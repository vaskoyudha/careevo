"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Reveal({
  className,
  delay = 0,
  variant = "up",
  children,
  id,
}: {
  className?: string;
  delay?: number;
  variant?: "up" | "scale";
  children?: ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.classList.add("is-visible");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      show();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            show();
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className={cn(
        "reveal",
        variant === "scale" && "reveal-scale",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full bg-blue-500",
        className,
      )}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path
          d="M8.37605 2.7251L3.82605 7.2751L1.62396 5.07304"
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function CheckMutedIcon() {
  return (
    <span className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full bg-gray-400">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path
          d="M8.37605 2.7251L3.82605 7.2751L1.62396 5.07304"
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Stars() {
  return (
    <div className="mb-3 flex gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={index}
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="text-yellow-400"
          aria-hidden="true"
        >
          <path
            d="M7.99998 0.375C8.28511 0.375125 8.54618 0.53691 8.67258 0.79248L10.7319 4.96484L15.3364 5.63379C15.6186 5.67486 15.8535 5.87412 15.9419 6.14526C16.0298 6.41652 15.9556 6.71396 15.7514 6.91309L12.4189 10.1602L13.2063 14.7476C13.2545 15.0288 13.1392 15.3134 12.9084 15.4812C12.6776 15.6489 12.3712 15.6711 12.1186 15.5386L7.99998 13.373L3.88132 15.5386C3.62873 15.6714 3.32245 15.6488 3.09153 15.4812C2.8609 15.3134 2.74429 15.0287 2.79246 14.7476L3.57859 10.1602L0.247289 6.91309C0.0435071 6.71392 -0.0298309 6.41635 0.0580801 6.14526C0.146406 5.87404 0.381259 5.67486 0.663549 5.63379L5.26682 4.96484L7.32737 0.79248L7.38108 0.700928C7.51954 0.498869 7.75055 0.375073 7.99998 0.375Z"
            fill="currentColor"
          />
        </svg>
      ))}
    </div>
  );
}
