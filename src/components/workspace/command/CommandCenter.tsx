/**
 * Command Center — Phase 09 orchestrator.
 *
 * Renders the persona-aware dashboard from the data-driven module registry
 * (./modules.ts) instead of hardcoding a layout per persona. Hierarchy:
 *
 *   LEVEL 1  Today (+ first-time steps)
 *   LEVEL 2  Next Action (+ persona spotlight)
 *   LEVEL 3  Compact progression (+ persona stats, active path missions)
 *   LEVEL 4  Planning (upcoming, routines)
 *   LEVEL 5  Longer term (goal → project → task, growth path)
 *
 * Every value comes from real queries; modules with nothing relevant render
 * nothing. User preferences (visibility of OPTIONAL modules) are persisted in
 * the existing userProfile.dashboardConfig — no new storage, no new settings
 * pages, and core modules can never be hidden.
 */
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { PersonaStatsStrip } from "@/components/progress/PersonaStats";
import { TodayPathMissions } from "@/components/progress/TodayPathMissions";
import { TodayRoutines } from "@/components/workspace/TodayRoutines";
import { FirstSteps } from "./FirstSteps";
import { TodayFocus } from "./TodayFocus";
import { NextActionCard } from "./NextActionCard";
import { PersonaSpotlight } from "./PersonaSpotlight";
import { ProgressCompact } from "./ProgressCompact";
import { LongTermGoals, PlanningAhead } from "./Outlook";
import { DashboardSuggestions } from "@/components/planning/DashboardSuggestions";
import { modulesForPersona, type CommandModuleDef } from "./modules";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface QuickLink {
  label: string;
  onClick: () => void;
}

const MODULE_CONTENT: Record<string, () => React.ReactNode> = {
  "first-steps": () => <FirstSteps />,
  today: () => <TodayFocus />,
  "next-action": () => <NextActionCard />,
  spotlight: () => <PersonaSpotlight />,
  progress: () => <ProgressCompact />,
  stats: () => <PersonaStatsStrip />,
  quests: () => <TodayPathMissions />,
  suggestions: () => <DashboardSuggestions />,
  planning: () => <PlanningAhead />,
  "long-term": () => <LongTermGoals />,
};

/** Routines only matter once the user actually created some. */
function RoutinesModule() {
  const routines = useQuery(api.routines.listRoutines, {});
  if (!routines || routines.length === 0) return null;
  return (
    <div>
      <TodayRoutines />
    </div>
  );
}

MODULE_CONTENT.routines = () => <RoutinesModule />;

export function CommandCenter({ quickLinks }: { quickLinks?: QuickLink[] }) {
  const { personaKey, dashboardConfig, saveProfile } = useUserProfile();
  const { tasks } = useWorkspace();
  const [customizing, setCustomizing] = useState(false);
  const [savingWidget, setSavingWidget] = useState<string | null>(null);

  const modules = useMemo(() => modulesForPersona(personaKey), [personaKey]);

  const visibility = (key: string) =>
    dashboardConfig.rows.find((r) => r.widget === key)?.visible ?? true;

  const visibleModules = modules.filter(
    (m) => !m.optional || visibility(m.key),
  );
  const optionalModules = modules.filter((m) => m.optional);

  const hasContent = tasks.length > 0;

  const toggleModule = async (def: CommandModuleDef, next: boolean) => {
    const existing = dashboardConfig.rows.filter((r) => r.widget !== def.key);
    const rows = [
      ...existing,
      { widget: def.key, visible: next, priority: def.priority },
    ];
    setSavingWidget(def.key);
    try {
      await saveProfile({ dashboardConfig: JSON.stringify({ version: 1, rows }) });
    } catch {
      // Surface the failure instead of silently reverting the switch.
      toast.error("ذخیره شخصی‌سازی داشبورد ناموفق بود.");
    } finally {
      setSavingWidget(null);
    }
  };

  // Group consecutive pair-layout modules so the desktop grid stays balanced.
  const chunks: Array<
    { type: "single"; def: CommandModuleDef } | { type: "pair"; defs: CommandModuleDef[] }
  > = [];
  for (const def of visibleModules) {
    const last = chunks[chunks.length - 1];
    if (def.layout === "pair" && last && last.type === "pair") {
      last.defs.push(def);
    } else if (def.layout === "pair") {
      chunks.push({ type: "pair", defs: [def] });
    } else {
      chunks.push({ type: "single", def });
    }
  }

  return (
    <div className="space-y-5">
      {/* Slim toolbar: persona quick links + advanced customization */}
      {(quickLinks?.length || optionalModules.length) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {quickLinks?.map((l) => (
            <Button
              key={l.label}
              size="sm"
              variant="outline"
              onClick={l.onClick}
              className="h-7 rounded-lg text-[11px]"
            >
              {l.label}
            </Button>
          ))}
          {optionalModules.length > 0 && (
            <div className="relative">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() => setCustomizing((v) => !v)}
                aria-expanded={customizing}
                aria-label="شخصی‌سازی داشبورد"
              >
                <SlidersHorizontal className="size-3.5" />
                شخصی‌سازی
              </Button>
              {customizing && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setCustomizing(false)}
                  />
                  <div className="ui-popover absolute end-0 top-9 z-50 w-72 rounded-2xl p-3">
                    <p className="px-1 pb-2 text-[11px] font-bold text-muted-foreground">
                      بخش‌های داشبورد
                    </p>
                    <ul className="space-y-1.5">
                      {optionalModules.map((m) => (
                        <li
                          key={m.key}
                          className="flex items-center justify-between gap-2 rounded-xl px-1.5 py-1"
                        >
                          <span className="min-w-0">
                            <span className="block text-[12px] font-bold">{m.label}</span>
                            <span className="block text-[10px] text-muted-foreground">
                              {m.description}
                            </span>
                          </span>
                          <Switch
                            checked={visibility(m.key)}
                            disabled={savingWidget === m.key}
                            onCheckedChange={(v) => void toggleModule(m, v)}
                            aria-label={`نمایش ${m.label}`}
                          />
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 px-1 text-[10px] leading-4 text-muted-foreground">
                      امروز، قدم بعدی و پیشرفت همیشه نمایش داده می‌شوند.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mobile-first order: Today → Next Action → Progress → Planning → Long term */}
      {chunks.map((chunk, i) =>
        chunk.type === "single" ? (
          <div key={chunk.def.key} className={cn(i === 0 && !hasContent && "order-none")}>
            {MODULE_CONTENT[chunk.def.key]?.()}
          </div>
        ) : (
          <div
            key={chunk.defs.map((d) => d.key).join("-")}
            className="grid gap-5 lg:grid-cols-2"
          >
            {chunk.defs.map((d) => (
              <div key={d.key}>{MODULE_CONTENT[d.key]?.()}</div>
            ))}
          </div>
        ),
      )}
    </div>
  );
}
