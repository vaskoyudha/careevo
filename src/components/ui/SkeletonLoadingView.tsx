"use client";

import { SkeletonOverlay, SkeletonList, SkeletonTable } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface SkeletonLoadingViewProps {
  className?: string;
}

export default function SkeletonLoadingView({ className }: SkeletonLoadingViewProps) {
  return (
    <div className={cn("min-h-screen bg-gray-50 p-8 space-y-8", className)}>
      <SkeletonOverlay
        fullScreen={false}
        title="Menyiapkan konten..."
        description="Mohon tunggu sebentar."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonList itemLength={4} />
        </div>
        <div>
          <SkeletonList itemLength={6} />
        </div>
      </div>

      <SkeletonTable rows={5} columns={4} hasActions />
    </div>
  );
}
