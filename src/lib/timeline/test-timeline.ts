import type { TimelineBlockRow } from "@/lib/timeline/timeline-model";

const STORAGE_KEY = "taskflow-test-timeline-blocks";

export function readTestTimelineBlocks(): TimelineBlockRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(rows: TimelineBlockRow[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function addTestTimelineBlock(block: TimelineBlockRow): void {
  write([...readTestTimelineBlocks(), block]);
}

export function updateTestTimelineBlock(id: string, patch: Partial<TimelineBlockRow>): void {
  write(readTestTimelineBlocks().map((row) => row._id === id ? { ...row, ...patch } : row));
}

export function deleteTestTimelineBlock(id: string): void {
  write(readTestTimelineBlocks().filter((row) => row._id !== id));
}
