"use client";

import React, { useEffect, useRef, useState } from "react";
import createGlobe, { type COBEOptions } from "cobe";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type GlobeState = {
  phi?: number;
  theta?: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
};

type GlobeConfig = COBEOptions & {
  onRender?: (state: GlobeState) => void;
};

const GLOBE_CONFIG: GlobeConfig = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 0,
  diffuse: 1.2,
  mapSamples: 16000,
  mapBrightness: 2.5,
  baseColor: [0.75, 0.82, 0.92],
  markerColor: [251 / 255, 100 / 255, 21 / 255],
  glowColor: [1, 1, 1],
  markers: [
    { location: [14.5995, 120.9842], size: 0.03 },
    { location: [19.076, 72.8777], size: 0.1 },
    { location: [23.8103, 90.4125], size: 0.05 },
    { location: [30.0444, 31.2357], size: 0.07 },
    { location: [39.9042, 116.4074], size: 0.08 },
    { location: [-23.5505, -46.6333], size: 0.1 },
    { location: [19.4326, -99.1332], size: 0.1 },
    { location: [40.7128, -74.006], size: 0.1 },
    { location: [34.6937, 135.5022], size: 0.05 },
    { location: [41.0082, 28.9784], size: 0.06 },
  ],
};

export function Globe({
  className,
  config = GLOBE_CONFIG,
}: {
  className?: string;
  config?: GlobeConfig;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const [r, setR] = useState(0);

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value !== null ? "grabbing" : "grab";
    }
  };

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
      setR(delta / 200);
    }
  };

  useEffect(() => {
    let phi = 0;
    let width = canvasRef.current?.offsetWidth || 600;

    const onResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth || 600;
      }
    };

    window.addEventListener("resize", onResize);
    onResize();

    const onRender = (state: GlobeState) => {
      if (pointerInteracting.current === null) {
        phi += 0.005;
      }
      state.phi = phi + r;
      state.width = width * 2;
      state.height = width * 2;
    };

    const globe = createGlobe(canvasRef.current!, {
      ...config,
      width: width * 2,
      height: width * 2,
      onRender,
    } as unknown as COBEOptions);

    const timer = setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.style.opacity = "1";
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      globe.destroy();
    };
  }, [config, r]);

  return (
    <div
      className={cn(
        "absolute inset-0 mx-auto aspect-[1/1] w-full max-w-[600px]",
        className
      )}
    >
      <canvas
        className={cn(
          "size-full opacity-0 transition-opacity duration-500 [contain:layout_paint_size]"
        )}
        ref={canvasRef}
        onPointerDown={(e) =>
          updatePointerInteraction(
            e.clientX - pointerInteractionMovement.current
          )
        }
        onPointerUp={() => updatePointerInteraction(null)}
        onPointerOut={() => updatePointerInteraction(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) =>
          e.touches[0] && updateMovement(e.touches[0].clientX)
        }
      />
    </div>
  );
}

export default function Featured_05() {
  return (
    <section className="relative w-full overflow-hidden rounded-3xl bg-muted/60 dark:bg-muted/20 border border-neutral-200 dark:border-neutral-800 shadow-md px-6 py-14 sm:px-10 md:px-16 md:py-20 my-12 sm:my-16">
      <div className="flex flex-col-reverse items-center justify-between gap-10 md:flex-row">
        <div className="z-10 max-w-xl text-left">
          <h2 className="text-3xl font-normal text-gray-900 dark:text-white">
            Build with <span className="text-primary font-medium">Ruixen UI</span>{" "}
            <span className="text-gray-500 dark:text-gray-400 text-xl block mt-2">
              Empower your team with fast, elegant, and scalable UI components. Ruixen UI brings simplicity and performance to your modern apps.
            </span>
          </h2>
          <Button className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition hover:bg-black">
            Join Today <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative h-[220px] sm:h-[260px] md:h-[280px] w-full max-w-xl overflow-hidden md:overflow-visible">
          <Globe className="absolute -bottom-16 -right-20 sm:-bottom-20 sm:-right-40 scale-125 sm:scale-150" />
        </div>
      </div>
    </section>
  );
}
