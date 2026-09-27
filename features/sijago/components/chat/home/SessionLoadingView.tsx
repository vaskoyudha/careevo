"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RotateCw, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Beautiful indeterminate loading overlay with elegant animations
 * Replaces basic spinners with shimmer skeleton effects
 */
interface SessionLoadingViewProps {
  onCancel?: () => void;
  failed?: boolean;
  onRetry?: () => void;
}

const STILL_LOADING_AFTER_MS = 8000;

export default function SessionLoadingView({
  onCancel,
  failed = false,
  onRetry,
}: SessionLoadingViewProps) {
  const { t } = useTranslation();
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (failed) return;
    const timer = setTimeout(() => setShowHint(true), STILL_LOADING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  return (
    <div className={cn(
      "relative flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center gap-6 px-4",
      "bg-card animate-fade-in"
    )}>
      {/* Cancel button */}
      {onCancel && (
        <button
          type="button"
          aria-label={t("Cancel")}
          onClick={onCancel}
          className={cn(
            "absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-lg",
            "text-muted-foreground transition-all duration-200",
            "hover:bg-muted hover:text-foreground hover:shadow-md",
            "active:scale-95 focus-visible:ring-2 focus-visible:ring-primary"
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Animated logo container */}
      <div className="flex flex-col items-center gap-6">
        <div className={cn(
          "relative flex items-center gap-4 p-6 rounded-2xl bg-gradient-to-br",
          "from-[#e2eef4] via-[#f0f7fa] to-[#e2eef4]",
          "bg-[length:200%_100%] animate-loading-skeleton",
          "shadow-lg border border-white/50"
        )}>
          {!failed && (
            <>
              {/* Animated ring effect */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className={cn(
                  "absolute inset-[-100%] animate-[spin_3s_linear_infinite]",
                  "bg-gradient-to-r from-transparent via-[#3b82f6]/20 to-transparent"
                )} />
              </div>
              
              {/* Logo */}
              <img
                src="/careevo-logo.png"
                alt="AI Mastery"
                width={720}
                height={228}
                className={cn(
                  "h-10 w-auto select-none relative z-10",
                  "transition-transform duration-300",
                  "animate-pulse-slow hover:scale-105"
                )}
                draggable={false}
              />
              
              {/* Loading indicator */}
              <div className="relative z-10 shrink-0">
                <Loader2 className={cn(
                  "h-6 w-6 text-primary",
                  "animate-spin-slow ease-linear"
                )} />
              </div>
            </>
          )}
          
          {failed && (
            <TriangleAlert className="h-6 w-6 text-destructive relative z-10" />
          )}
        </div>

        {/* Status message with gradient */}
        <div className="space-y-2 text-center max-w-md">
          <h2 className={cn(
            "text-lg font-semibold relative inline-block",
            !failed && "bg-gradient-to-r from-[#1e6fff] to-[#0a84ff]",
            "bg-clip-text text-transparent animate-fade-in"
          )}>
            {failed ? t("Failed to load session") : t("Loading conversation")}
          </h2>
          
          {!failed && (
            <p className={cn(
              "text-sm text-muted-foreground",
              "animate-pulse-soft"
            )}>
              {t("Preparing your workspace...")}
            </p>
          )}
        </div>

        {/* Retry action */}
        {failed && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium",
              "bg-gradient-to-r from-[#3b82f6] to-[#60a5fa]",
              "text-white shadow-md hover:shadow-lg",
              "transition-all duration-200 transform hover:-translate-y-0.5",
              "active:scale-95 active:shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            )}
          >
            <RotateCw className="h-4 w-4 animate-spin-slow" />
            {t("Retry again")}
          </button>
        )}

        {/* Slow-load hint with improved styling */}
        {showHint && (
          <div className={cn(
            "animate-fade-in-up flex items-center gap-2",
            "px-3 py-1.5 rounded-full bg-primary/10",
            "border border-primary/20"
          )}>
            <div className={cn(
              "h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
            )} />
            <span className={cn(
              "text-xs font-medium text-primary",
              "animate-pulse"
            )}>
              {t("Still loading…")}
            </span>
          </div>
        )}
      </div>
      
      {/* Background decoration elements */}
      {!failed && (
        <>
          <div className="absolute bottom-1/4 left-10 w-32 h-32 rounded-full bg-primary/5 blur-3xl animate-pulse-slow" />
          <div className="absolute top-1/4 right-10 w-40 h-40 rounded-full bg-blue-300/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        </>
      )}
    </div>
  );
}
