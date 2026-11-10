import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ninermarket-theme";

function getSystemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function applyThemeToDocument(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

// Resolved once at module load (before React ever renders) so the very first
// paint already has the right theme - no light-then-dark flash on reload.
let currentTheme: Theme = readStoredTheme() ?? getSystemTheme();
applyThemeToDocument(currentTheme);

const listeners = new Set<() => void>();

export function setTheme(theme: Theme): void {
  currentTheme = theme;
  applyThemeToDocument(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage errors
  }
  listeners.forEach((listener) => listener());
}

export function toggleTheme(): void {
  setTheme(currentTheme === "dark" ? "light" : "dark");
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return currentTheme;
}

/** Reactive current theme - re-renders the calling component on toggle. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot);
}
