/**
 * User preferences — single source of truth (audit fix).
 *
 * Before this module, Settings wrote four localStorage keys
 * (`taskly-theme`, `taskly-accent`, `taskly-start`, `taskly-notifs`) and NOTHING
 * ever read them back. The UI reported success, then a refresh silently
 * reverted theme + accent, the start page was ignored, and notification
 * preferences had no effect. Every read/write now goes through here, and
 * `applyStoredPreferences()` is run once at boot so the saved values are real.
 */
import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export type AccentKey = "indigo" | "blue" | "emerald" | "amber" | "rose";

export const ACCENT_COLORS: Record<AccentKey, string> = {
  indigo: "#4f46e5",
  blue: "#2563eb",
  emerald: "#059669",
  amber: "#d97706",
  rose: "#e11d48",
};

export const START_PAGE_OPTIONS = [
  "/dashboard",
  "/today",
  "/inbox",
  "/projects",
] as const;
export type StartPage = (typeof START_PAGE_OPTIONS)[number];

export interface NotifPrefs {
  overdue: boolean;
  today: boolean;
  project: boolean;
}

export const DEFAULT_NOTIFS: NotifPrefs = {
  overdue: true,
  today: true,
  project: true,
};

const K = {
  theme: "taskly-theme",
  accent: "taskly-accent",
  start: "taskly-start",
  notifs: "taskly-notifs",
} as const;

/* ------------------------------------------------------------------ */
/* Change notification (one subscription point for all preference keys) */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let snapshot = "";
function emit() {
  // A primitive snapshot keeps useSyncExternalStore comparisons cheap & stable.
  snapshot = readAll();
  for (const l of listeners) l();
}
function readAll(): string {
  if (typeof localStorage === "undefined") return "";
  return `${localStorage.getItem(K.theme) ?? ""}|${localStorage.getItem(K.accent) ?? ""}|${localStorage.getItem(K.start) ?? ""}|${localStorage.getItem(K.notifs) ?? ""}`;
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot(): string {
  if (snapshot === "") snapshot = readAll();
  return snapshot;
}

/** Re-render the caller whenever any preference changes. */
export function usePreferencesVersion(): number {
  const v = useSyncExternalStore(subscribe, getSnapshot, () => "");
  // A changing string guarantees a re-render; the number is just a handle.
  return v.length;
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

export function readTheme(): Theme {
  if (typeof localStorage === "undefined") return "light";
  const raw = localStorage.getItem(K.theme);
  if (raw === "light" || raw === "dark") return raw;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function writeTheme(theme: Theme): void {
  localStorage.setItem(K.theme, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  emit();
}

/* ------------------------------------------------------------------ */
/* Accent                                                              */
/* ------------------------------------------------------------------ */

export function readAccent(): AccentKey {
  if (typeof localStorage === "undefined") return "indigo";
  const raw = localStorage.getItem(K.accent) as AccentKey | null;
  return raw && raw in ACCENT_COLORS ? raw : "indigo";
}

export function writeAccent(key: AccentKey): void {
  const color = ACCENT_COLORS[key] ?? ACCENT_COLORS.indigo;
  localStorage.setItem(K.accent, key);
  applyAccentColor(color);
  emit();
}

function applyAccentColor(color: string): void {
  document.documentElement.style.setProperty("--primary", color);
  document.documentElement.style.setProperty("--ring", color);
}

/* ------------------------------------------------------------------ */
/* Start page                                                          */
/* ------------------------------------------------------------------ */

export function readStartPage(): StartPage {
  if (typeof localStorage === "undefined") return "/dashboard";
  const raw = localStorage.getItem(K.start);
  return (START_PAGE_OPTIONS as readonly string[]).includes(raw ?? "")
    ? (raw as StartPage)
    : "/dashboard";
}

export function writeStartPage(page: StartPage): void {
  localStorage.setItem(K.start, page);
  emit();
}

/* ------------------------------------------------------------------ */
/* Notification preferences                                            */
/* ------------------------------------------------------------------ */

export function readNotifPrefs(): NotifPrefs {
  if (typeof localStorage === "undefined") return DEFAULT_NOTIFS;
  try {
    const parsed = JSON.parse(localStorage.getItem(K.notifs) ?? "") as Partial<NotifPrefs>;
    return { ...DEFAULT_NOTIFS, ...parsed };
  } catch {
    return DEFAULT_NOTIFS;
  }
}

export function writeNotifPrefs(next: NotifPrefs): void {
  localStorage.setItem(K.notifs, JSON.stringify(next));
  emit();
}

/** Hook form — returns a live copy of the notification preferences. */
export function useNotifPrefs(): [NotifPrefs, (next: NotifPrefs) => void] {
  usePreferencesVersion();
  const value = readNotifPrefs();
  const setValue = useCallback((next: NotifPrefs) => writeNotifPrefs(next), []);
  return [value, setValue];
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

/**
 * Apply persisted theme + accent to <html> before the first paint, so a
 * refresh no longer flashes/reverts the user's saved appearance.
 */
export function applyStoredPreferences(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", readTheme() === "dark");
  applyAccentColor(ACCENT_COLORS[readAccent()]);
}
