/**
 * Shared display helpers for the Productivity Intelligence UI (Phase 13).
 *
 * Pure tone/icon/label maps — no React state, no side effects. Kept in one
 * module so the Insight Center, Today strip and dashboard module word a
 * severity, a category and a window exactly the same way, and so status is
 * never communicated by color alone (§38): every tone also has a Persian label.
 */
import {
  Activity,
  Clock,
  Flame,
  FolderKanban,
  Info,
  Layers,
  TrendingUp,
  TriangleAlert,
  Target,
  CalendarClock,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/components/progress/progress-ui";
import {
  INSIGHT_CATEGORY_LABELS_FA,
  INSIGHT_SEVERITY_LABELS_FA,
  INSIGHT_TYPE_LABELS_FA,
  INTELLIGENCE_WINDOWS,
  type InsightCategory,
  type InsightSeverity,
  type InsightType,
  type TimeWindow,
} from "@/lib/intelligence";

export const SEVERITY_TONE: Record<InsightSeverity, Tone> = {
  critical: "rose",
  warning: "amber",
  info: "blue",
  positive: "emerald",
};

export const SEVERITY_ICON: Record<InsightSeverity, LucideIcon> = {
  critical: TriangleAlert,
  warning: TriangleAlert,
  info: Info,
  positive: CircleCheck,
};

/** Order insights are grouped in (worst first) — never color-only (§38). */
export const SEVERITY_ORDER: InsightSeverity[] = ["critical", "warning", "info", "positive"];

/** Dot + chip classes per severity (always paired with a text label). */
export const SEVERITY_DOT: Record<InsightSeverity, string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  positive: "bg-emerald-500",
};

/** Health state of a project/goal → chip classes (text label always shown). */
export const HEALTH_CHIP: Record<string, string> = {
  healthy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  needs_attention: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  at_risk: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  blocked: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  completed: "bg-muted text-muted-foreground",
};

export const CATEGORY_META: Record<InsightCategory, { label: string; Icon: LucideIcon }> = {
  overview: { label: INSIGHT_CATEGORY_LABELS_FA.overview, Icon: Layers },
  planning: { label: INSIGHT_CATEGORY_LABELS_FA.planning, Icon: CalendarClock },
  execution: { label: INSIGHT_CATEGORY_LABELS_FA.execution, Icon: Activity },
  time: { label: INSIGHT_CATEGORY_LABELS_FA.time, Icon: Clock },
  projects: { label: INSIGHT_CATEGORY_LABELS_FA.projects, Icon: FolderKanban },
  goals: { label: INSIGHT_CATEGORY_LABELS_FA.goals, Icon: Target },
  focus: { label: INSIGHT_CATEGORY_LABELS_FA.focus, Icon: Flame },
  trends: { label: INSIGHT_CATEGORY_LABELS_FA.trends, Icon: TrendingUp },
};

export const CATEGORY_ORDER: InsightCategory[] = [
  "overview",
  "planning",
  "execution",
  "time",
  "projects",
  "goals",
  "focus",
  "trends",
];

export function severityLabelFa(severity: InsightSeverity): string {
  return INSIGHT_SEVERITY_LABELS_FA[severity];
}

export function typeLabelFa(type: InsightType): string {
  return INSIGHT_TYPE_LABELS_FA[type];
}

export function windowLabelFa(window: TimeWindow): string {
  return INTELLIGENCE_WINDOWS.find((w) => w.window === window)?.labelFa ?? window;
}

export const WINDOW_OPTIONS = INTELLIGENCE_WINDOWS.map((w) => ({
  window: w.window,
  label: w.labelFa,
}));

/** Trend direction as a Persian, non-judgmental label (§16 / §38). */
export function trendLabelFa(direction: string): string {
  switch (direction) {
    case "up":
      return "افزایشی";
    case "down":
      return "کاهشی";
    case "stable":
      return "ثابت";
    default:
      return "داده ناکافی";
  }
}
