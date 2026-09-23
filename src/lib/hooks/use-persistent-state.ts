"use client";

import { useSyncExternalStore } from "react";

const channel = new EventTarget();

function subscribe(callback: () => void) {
  channel.addEventListener("change", callback);
  return () => channel.removeEventListener("change", callback);
}

export function usePersistentValue(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key),
    () => null,
  );
}

export function setPersistentValue(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  if (value === null) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, value);
  }
  channel.dispatchEvent(new Event("change"));
}

export function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
