"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import createGlobe, { type COBEOptions } from "cobe";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 0,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  baseColor: [1, 1, 1],
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
  config?: COBEOptions;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const phiRef = useRef(0);
  const widthRef = useRef(0);
  const rRef = useRef(0);

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
      rRef.current = delta / 200;
    }
  };

  useEffect(() => {
    const onResize = () => {
      if (canvasRef.current) {
        widthRef.current = canvasRef.current.offsetWidth;
      }
    };

    window.addEventListener("resize", onResize);
    onResize();

    const globe = createGlobe(canvasRef.current!, {
      ...config,
      width: (widthRef.current || 600) * 2,
      height: (widthRef.current || 600) * 2,
      onRender: (state: Record<string, number>) => {
        if (pointerInteracting.current === null) {
          phiRef.current += 0.005;
        }
        state.phi = phiRef.current + rRef.current;
        state.width = (widthRef.current || 600) * 2;
        state.height = (widthRef.current || 600) * 2;
      },
    });

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
  }, [config]);

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

export default function Featured_05({ className }: { className?: string }) {
  return (
    <section className={cn("relative w-full overflow-hidden rounded-none bg-white dark:bg-neutral-950 border-y border-neutral-200 dark:border-neutral-800 shadow-none px-6 py-14 sm:px-10 md:px-14 md:py-20 my-0", className)}>
      <div className="mx-auto max-w-7xl flex flex-col-reverse items-center justify-between gap-10 md:flex-row">
        <div className="z-10 max-w-xl text-left">
          <h2 className="text-3xl font-normal text-neutral-900 dark:text-white tracking-tight">
            Setiap lowongan di sini pernah melewati{" "}
            <span className="text-primary font-medium">Sentinel</span>{" "}
            <span className="text-neutral-500 dark:text-neutral-400 block mt-2 text-lg leading-relaxed">
              Sebelum kamu membacanya, lowongan itu diaudit lebih dulu. Sentinel membaca
              isinya dan mencari tanda penipuan yang memang terjadi di Indonesia: permintaan
              transfer ke rekening pribadi, link unduhan APK, tiket travel fiktif, pungutan
              seragam, dan permintaan KTP atau OTP. Lowongan yang bersih ditandai aman — dan
              alasannya bisa kamu periksa sendiri, bukan label yang menempel.
            </span>
          </h2>
          <Button asChild className="mt-6 inline-flex items-center gap-2 rounded-none bg-foreground px-5 py-2 text-sm font-semibold text-background transition hover:bg-black">
            <Link href="/loker">
              Lihat papan lowongan <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="relative h-[220px] sm:h-[260px] md:h-[280px] w-full max-w-xl overflow-hidden md:overflow-visible">
          <Globe className="absolute -bottom-16 -right-20 sm:-bottom-20 sm:-right-40 scale-125 sm:scale-150" />
        </div>
      </div>
    </section>
  );
}
