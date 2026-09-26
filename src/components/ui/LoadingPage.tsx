"use client";

import { SkeletonOverlay } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface LoadingPageProps {
  fullScreen?: boolean;
  showContentBehind?: boolean;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Universal loading wrapper for any page or section
 */
export function LoadingPage({
  fullScreen = false,
  showContentBehind = false,
  title,
  description,
  className,
}: LoadingPageProps) {
  return (
    <div className={cn(
      "min-h-full flex flex-col items-center justify-center p-8",
      className
    )}>
      <SkeletonOverlay 
        fullScreen={fullScreen}
        showContentBehind={showContentBehind}
        className={cn(!fullScreen && "min-h-[400px]")}
      />
      
      {!fullScreen && (
        <div className="mt-12 max-w-xl text-center animate-fade-in">
          <h2 className="text-xl font-semibold mb-3 text-foreground">
            {title || "Loading"}
          </h2>
          <p className="text-muted-foreground">
            {description || "Please wait while we prepare your content."}
          </p>
        </div>
      )}
    </div>
  );
}

// Simple loading indicator for inline use
export function LoadingIndicator({ 
  size = "md", 
  variant = "spin",
  label 
}: { 
  size?: "sm" | "md" | "lg";
  variant?: "spin" | "pulse" | "dots";
  label?: string;
}) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };
  
  if (variant === "spin") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className={`${sizes[size]} animate-spin`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        </div>
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
      </div>
    );
  }
  
  if (variant === "pulse") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className={cn(sizes[size], "rounded-lg bg-primary animate-pulse")} />
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
      </div>
    );
  }
  
  if (variant === "dots") {
    return (
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
        {label && <span className="ml-2 text-sm text-muted-foreground">{label}</span>}
      </div>
    );
  }
}

export default LoadingPage;
