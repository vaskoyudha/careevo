"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const HIDDEN = "translate-y-6 opacity-0";

type TimelineAnimationProps = {
  as?: React.ElementType;
  animationNum?: number;
  timelineRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  href?: string;
  id?: string;
};

export function TimelineAnimation({
  as: Tag = "div",
  animationNum = 0,
  timelineRef,
  className,
  style,
  children,
  ...rest
}: TimelineAnimationProps) {
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reveal = () => {
      el.classList.remove("translate-y-6", "opacity-0");
      el.classList.add("translate-y-0", "opacity-100");
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      reveal();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal();
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  void timelineRef;

  const Comp = Tag as React.ElementType;

  return (
    <Comp
      ref={ref}
      className={cn(
        "transition duration-700 ease-out motion-reduce:transition-none",
        HIDDEN,
        className,
      )}
      style={{ transitionDelay: `${Math.min(Math.max(animationNum, 0), 10) * 90}ms`, ...style }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
