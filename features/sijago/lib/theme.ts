/**
 * Theme persistence utilities
 * Handles light/dark theme with localStorage fallback and system preference detection
 */

import { browserStorage } from "@/shared/storage";

export type Theme = "light" | "dark" | "glass" | "snow";

export const THEME_STORAGE_KEY = "deeptutor-theme";

type ThemeChangeListener = (theme: Theme) => void;
const themeListeners = new Set<ThemeChangeListener>();

/**
 * Subscribe to theme changes
 */
export function subscribeToThemeChanges(
  listener: ThemeChangeListener,
): () => void {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

/**
 * Notify all listeners of theme change
 */
function notifyThemeChange(theme: Theme): void {
  themeListeners.forEach((listener) => listener(theme));
}

/**
 * Get the stored theme from localStorage
 */
export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = browserStorage.readRaw("local", THEME_STORAGE_KEY);
    if (
      stored === "light" ||
      stored === "dark" ||
      stored === "glass" ||
      stored === "snow"
    ) {
      return stored;
    }
  } catch (e) {
    // Silently fail - localStorage may be disabled
  }

  return null;
}

/**
 * Save theme to localStorage
 */
export function saveThemeToStorage(theme: Theme): boolean {
  if (typeof window === "undefined") return false;

  try {
    return browserStorage.writeRaw("local", THEME_STORAGE_KEY, theme);
  } catch (e) {
    // Silently fail - localStorage may be disabled or full
    return false;
  }
}

/**
 * Theme to open with when this browser has stored no preference.
 *
 * Always "snow" (the pure-white Default) — never the OS. AI Mastery is framed inside
 * Careevo, whose chrome is always light, so following `prefers-color-scheme`
 * would open a warm-black frame under a white navbar. The inline `ThemeScript`
 * already ignores the OS for exactly this reason; this must agree with it,
 * because it seeds the React state that later calls `applyThemeToDocument`.
 * When the two disagreed, a dark-mode machine could flip the canvas to Dark.
 *
 * Dark and Glass stay available as explicit choices in Settings -> Appearance.
 */
export function getSystemTheme(): Theme {
  return "snow";
}

/**
 * Apply theme to document
 */
export function applyThemeToDocument(theme: Theme): void {
  if (typeof document === "undefined") return;

  const html = document.documentElement;

  html.classList.remove("dark", "theme-glass", "theme-snow");

  if (theme === "dark") {
    html.classList.add("dark");
  } else if (theme === "glass") {
    html.classList.add("dark", "theme-glass");
  } else if (theme === "snow") {
    html.classList.add("theme-snow");
  }
}

/**
 * Initialize theme on app startup.
 * Priority: stored preference > the light Default. Never the OS — see
 * `getSystemTheme`.
 */
export function initializeTheme(): Theme {
  // Check localStorage first
  const stored = getStoredTheme();
  if (stored) {
    applyThemeToDocument(stored);
    return stored;
  }

  // Fall back to system preference
  const systemTheme = getSystemTheme();
  applyThemeToDocument(systemTheme);
  saveThemeToStorage(systemTheme);
  return systemTheme;
}

/**
 * Set theme and persist it
 */
export function setTheme(theme: Theme): void {
  applyThemeToDocument(theme);
  saveThemeToStorage(theme);
  notifyThemeChange(theme);
}
