/**
 * Time distribution (Phase 13 §4).
 *
 * Answers "where is my time going?" using ONLY real recorded execution:
 * execution sessions (by kind), focus sessions that are not already counted,
 * grouped by work type, project and goal (via project → goalRef).
 *
 * No invented categories: a slice exists only when something was actually
 * executed against it, and the persona only changes the WORDING (§25), never
 * the underlying data.
 */
import { sessionLabel, sessionMinutes, type ExecutionSession } from "@/lib/execution";
import { uniqueFocusRows } from "./rows";
import type { IntelFocus, IntelGoal, IntelProject } from "./input";
import type { TimeDistribution, TimeSlice } from "./types";

export interface TimeDistributionInput {
  sessions: ExecutionSession[];
  focusSessions: IntelFocus[];
  projects: IntelProject[];
  goals: IntelGoal[];
  persona: string;
  nowMs: number;
  /** Only rows inside the analysed window should be passed in. */
}

function toSlices(map: Map<string, { label: string; minutes: number }>, total: number): TimeSlice[] {
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      minutes: Math.round(v.minutes),
      pct: total > 0 ? Math.round((v.minutes / total) * 100) : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes || a.key.localeCompare(b.key));
}

export function buildTimeDistribution(input: TimeDistributionInput): TimeDistribution {
  const focusRows = uniqueFocusRows(input.sessions, input.focusSessions);

  type Entry = { minutes: number; kind: string; projectId?: string; taskId?: string };
  const entries: Entry[] = [
    ...input.sessions.map((s) => ({
      minutes: sessionMinutes(s, input.nowMs),
      kind: s.kind,
      projectId: s.projectId,
      taskId: s.taskId,
    })),
    ...focusRows.map((f) => ({
      minutes: f.actualMinutes,
      kind: "focus",
      projectId: f.projectId,
      taskId: f.taskId,
    })),
  ].filter((e) => e.minutes > 0);

  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);

  /* ---- by work type ---- */
  const typeMap = new Map<string, { label: string; minutes: number }>();
  for (const e of entries) {
    const cur = typeMap.get(e.kind) ?? { label: sessionLabel(e.kind, input.persona), minutes: 0 };
    cur.minutes += e.minutes;
    typeMap.set(e.kind, cur);
  }

  /* ---- by project ---- */
  const projectById = new Map(input.projects.map((p) => [p._id, p]));
  const projectMap = new Map<string, { label: string; minutes: number }>();
  for (const e of entries) {
    if (!e.projectId) continue;
    const project = projectById.get(e.projectId);
    if (!project) continue; // deleted project — never fabricate a slice (§39)
    const cur = projectMap.get(project._id) ?? { label: project.name, minutes: 0 };
    cur.minutes += e.minutes;
    projectMap.set(project._id, cur);
  }

  /* ---- by goal (project → goalRef) ---- */
  const goalByRef = new Map(input.goals.map((g) => [g.ref, g]));
  const goalMap = new Map<string, { label: string; minutes: number }>();
  for (const e of entries) {
    if (!e.projectId) continue;
    const project = projectById.get(e.projectId);
    if (!project?.goalRef) continue;
    const goal = goalByRef.get(project.goalRef);
    if (!goal) continue;
    const cur = goalMap.get(goal.ref) ?? { label: goal.title, minutes: 0 };
    cur.minutes += e.minutes;
    goalMap.set(goal.ref, cur);
  }

  return {
    totalMinutes: Math.round(totalMinutes),
    byType: toSlices(typeMap, totalMinutes),
    byProject: toSlices(projectMap, totalMinutes),
    byGoal: toSlices(goalMap, totalMinutes),
    empty: totalMinutes <= 0,
  };
}
