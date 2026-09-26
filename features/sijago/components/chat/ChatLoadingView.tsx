"use client";

import { Skeleton, SkeletonCard } from "@/components/common/Skeleton";
import { cn } from "@/lib/utils";
import React from "react";

interface ChatLoadingViewProps {
  className?: string;
}

export function ChatLoadingView({ className }: ChatLoadingViewProps) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-card p-4">
        <SkeletonCard 
          title={false} 
          description={false}
          buttons={false}
          className="h-10"
        />
      </div>
      
      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className={cn(
            "flex gap-3 animate-fade-in",
            i % 2 === 0 ? "self-end" : "self-start"
          )}>
            <SkeletonAvatar size={i % 2 === 0 ? "sm" : "md"} />
            
            <div className={cn(
              "flex flex-col max-w-md",
              i % 2 === 0 && "items-end"
            )}>
              <div className={cn(
                "rounded-xl border p-4 shadow-sm",
                i % 2 === 0 
                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                  : "bg-card border-[var(--border)] rounded-tl-none"
              )}>
                <div className="space-y-2 mb-2">
                  <SkeletonText lines={2} className="w-2/3 h-5" />
                  <SkeletonText lines={2} className="w-full h-4" />
                </div>
              </div>
              
              {/* Typing indicators for user messages */}
              {i % 2 !== 0 && (
                <div className="flex gap-1 mt-2">
                  <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Last message with more content */}
        <div className="flex gap-3 self-start">
          <SkeletonAvatar size="md" />
          
          <div className="flex flex-col max-w-lg items-start">
            <div className="rounded-xl border border-[var(--border)] bg-card p-6 rounded-tl-none shadow-sm animate-fade-in">
              <div className="space-y-3">
                <SkeletonText lines={1} className="w-1/2 h-6" />
                <SkeletonText lines={3} className="w-full h-4" />
                <SkeletonText lines={2} className="w-3/4 h-4" />
              </div>
              
              {/* Code block placeholder */}
              <div className="mt-4 rounded-lg bg-muted/50 p-4">
                <div className="flex gap-2 mb-2">
                  <Skeleton className="w-16 h-4" />
                  <Skeleton className="w-8 h-4" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="w-2/3 h-3" />
                  <Skeleton className="w-3/4 h-3" />
                  <Skeleton className="w-1/2 h-3" />
                </div>
              </div>
              
              {/* Actions */}
              <div className="mt-4 flex gap-3">
                <SkeletonButton className="h-9 px-4" />
                <SkeletonButton className="h-9 px-4 opacity-60" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple helper components for inline use
function SkeletonAvatar({ size = "md" }: { size?: string }) {
  const sizes = {
    xs: "w-8 h-8",
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };
  
  return (
    <Skeleton 
      className={`rounded-full shrink-0 ${sizes[size as keyof typeof sizes]}`} 
    />
  );
}

function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
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

function SkeletonButton({ className }: { className?: string }) {
  return (
    <Skeleton className={`h-10 px-4 rounded-lg ${className}`} />
  );
}

export default ChatLoadingView;
