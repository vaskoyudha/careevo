"use client";

import { cn } from "@/lib/utils";
import React, { useState } from "react";

/**
 * Beautiful skeleton loading animations with shimmer effects
 * Matches AI Mastery's ocean-blue theme palette
 */

interface SkeletonProps {
  className?: string;
  variant?: "pulse" | "shimmer" | "bounce" | "fade";
}

export function Skeleton({ 
  className, 
  variant = "shimmer" 
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-loading-skeleton rounded-lg",
        "bg-gradient-to-r from-[#e2eef4] via-[#f0f7fa] to-[#e2eef4]",
        "bg-[length:200%_100%]",
        variant === "pulse" && "animate-pulse bg-muted",
        variant === "bounce" && "animate-bounce bg-muted",
        variant === "fade" && "animate-fade bg-muted",
        className
      )}
    />
  );
}

// Common layout skeletons for different content types

interface SkeletonTextProps {
  className?: string;
  lines?: number;
}

export function SkeletonText({ className, lines = 1 }: SkeletonTextProps) {
  const lineClasses = [
    "h-4 w-full mb-2 last:mb-0",
    "h-5 w-3/4 mb-2 last:mb-0",
    "h-6 w-1/2 mb-2 last:mb-0",
  ];

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={lineClasses[i % lineClasses.length]} 
        />
      ))}
    </div>
  );
}

export interface SkeletonAvatarProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function SkeletonAvatar({ 
  size = "md",
  className 
}: SkeletonAvatarProps) {
  const sizes = {
    xs: "w-8 h-8",
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  return (
    <Skeleton
      className={cn(
        "rounded-full shrink-0",
        sizes[size],
        className
      )}
    />
  );
}

interface SkeletonCardProps {
  title?: boolean;
  description?: boolean;
  image?: boolean;
  buttons?: boolean;
  className?: string;
}

export function SkeletonCard({ 
  title = true,
  description = true,
  image = false,
  buttons = false,
  className
}: SkeletonCardProps) {
  return (
    <div className={cn(
      "rounded-xl border border-[var(--border)] bg-card p-4",
      "shadow-sm animate-fade-in",
      className
    )}>
      {image && (
        <Skeleton className="w-full h-48 rounded-lg mb-4" />
      )}
      
      {title && (
        <>
          <Skeleton className="w-3/4 h-6 mb-3" />
          <Skeleton className="w-1/2 h-6 mb-4" />
        </>
      )}
      
      {description && (
        <div className="space-y-2 mb-4">
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-2/3 h-4" />
        </div>
      )}
      
      {buttons && (
        <div className="flex gap-3">
          <Skeleton className="h-10 px-6 rounded-lg" />
          <Skeleton className="h-10 px-6 rounded-lg opacity-60" />
        </div>
      )}
    </div>
  );
}

export interface SkeletonListProps {
  itemLength?: number;
  className?: string;
}

export function SkeletonList({ 
  itemLength = 5,
  className 
}: SkeletonListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: itemLength }).map((_, i) => (
        <SkeletonCard 
          key={i} 
          title 
          description 
          className={`animate-fade-in delay-${(i + 1) * 50}`}
        />
      ))}
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  hasActions?: boolean;
  className?: string;
}

export function SkeletonTable({ 
  rows = 5, 
  columns = 4,
  hasActions = false,
  className
}: SkeletonTableProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-[var(--border)] bg-card", className)}>
      <div className="p-4 border-b border-[var(--border)]">
        <Skeleton className="w-1/3 h-6" />
      </div>
      
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center p-4 gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton 
                key={colIndex}
                className={cn(
                  "flex-1 h-4",
                  colIndex === 0 ? "w-1/4" : undefined,
                  colIndex === 1 ? "w-1/3" : undefined,
                )}
              />
            ))}
            {hasActions && <Skeleton className="w-20 h-8" />}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SkeletonOverlayProps {
  fullScreen?: boolean;
  children?: React.ReactNode;
  showContentBehind?: boolean;
  title?: string;
  description?: string;
  className?: string;
}

export function SkeletonOverlay({ 
  fullScreen = false,
  children,
  showContentBehind = false,
  title,
  description,
  className
}: SkeletonOverlayProps) {
  return (
    <div className={cn(
      "relative min-h-[200px] rounded-lg overflow-hidden",
      fullScreen && "fixed inset-0 z-50 flex items-center justify-center",
      !showContentBehind && "bg-background/95 backdrop-blur-sm",
      className
    )}>
      {/* Content behind if needed */}
      {showContentBehind && children}
      
      {/* Loading overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="animate-spin mb-6">
          <svg 
            className="w-12 h-12 text-primary" 
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        </div>
        
        {/* Progress ring */}
        <div className="relative w-32 h-32 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin">
            <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin-slow" />
          </div>
          
          {/* Shimmer effect in center */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#e2eef4] via-[#f0f7fa] to-[#e2eef4] animate-loading-skeleton bg-[length:200%_100%]" />
        </div>
        
        {title ? (
          <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
        ) : null}
        {description ? (
          <p className="max-w-xs text-center text-sm text-muted-foreground">{description}</p>
        ) : (
          <SkeletonText 
            lines={2} 
            className="text-center max-w-xs"
          />
        )}
      </div>
    </div>
  );
}

interface SkeletonButtonProps {
  className?: string;
  fullWidth?: boolean;
}

export function SkeletonButton({ 
  className, 
  fullWidth 
}: SkeletonButtonProps) {
  return (
    <Skeleton
      className={cn(
        "h-10 px-4 rounded-lg",
        fullWidth && "w-full",
        className
      )}
    />
  );
}

interface SkeletonInputProps {
  label?: boolean;
  placeholder?: boolean;
  className?: string;
}

export function SkeletonInput({ 
  label = false as const,
  placeholder = false as const,
  className 
}: SkeletonInputProps) {
  return (
    <div className={cn(className)}>
      {label && <Skeleton className="w-1/3 h-5 mb-2" />}
      <Skeleton className="w-full h-10 rounded-lg" />
      {placeholder && (
        <div className="mt-2 space-y-2">
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-2/3 h-4" />
        </div>
      )}
    </div>
  );
}

// Custom hooks for managing loading states
export function useLoadingState(defaultValue = false) {
  const [isLoading, setIsLoading] = useState(defaultValue);
  
  const withLoading = async <TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    ...args: TArgs
  ): Promise<TReturn> => {
    setIsLoading(true);
    try {
      return await fn(...args);
    } finally {
      setIsLoading(false);
    }
  };
  
  return { isLoading, setIsLoading, withLoading };
}

export default Skeleton;
