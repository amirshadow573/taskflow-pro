/**
 * Dashboard module registry — Phase 09.
 *
 * One data-driven catalog describing WHICH modules the persona-aware command
 * center renders, in which order (information hierarchy level), and which of
 * them the user may hide. Components never hardcode the layout: CommandCenter
 * renders whatever this config says for the active persona + saved preferences.
 *
 * Hierarchy levels (per the Phase 09 spec):
 *   1 — Today            (what matters right now)
 *   2 — Next Action      (what to do next)
 *   3 — Progression      (level / XP / stats / skill / quest / achievement)
 *   4 — Planning         (upcoming: tomorrow, deadlines, calendar, projects)
 *   5 — Longer-term      (goals, skill development, growth paths)
 */
import type { PersonaKey } from "@/lib/personas";

export type CommandModuleKey =
  | "first-steps"
  | "today"
  | "next-action"
  | "spotlight"
  | "progress"
  | "stats"
  | "planning"
  | "long-term"
  | "routines"
  | "quests";

export interface CommandModuleDef {
  key: CommandModuleKey;
  /** Information-hierarchy level (1..5). Lower renders first. */
  level: 1 | 2 | 3 | 4 | 5;
  /** Order within a level (higher first). */
  priority: number;
  label: string;
  description: string;
  /** Personas eligible for this module; "all" = every persona. */
  personas: PersonaKey[] | "all";
  /** May the user hide this module? Core modules (today / next-action) never. */
  optional: boolean;
  /**
   * Responsive behavior: "full" spans the main column on desktop, "side" is a
   * compact secondary panel, "pair" is designed for the 2-up bottom grid.
   */
  layout: "full" | "side" | "pair";
  /**
   * Persona-specific weight. A persona that does NOT list a module keeps the
   * default priority; listing it re-orders that persona's dashboard so the
   * shared foundation stays shared but the emphasis is genuinely different.
   */
  personaPriority?: Partial<Record<PersonaKey, number>>;
}

export const COMMAND_MODULES: CommandModuleDef[] = [
  {
    key: "first-steps",
    level: 1,
    priority: 100,
    label: "شروع کار",
    description: "اولین قدم‌های سبک برای کاربر تازه‌وارد",
    personas: "all",
    optional: false,
    layout: "full",
  },
  {
    key: "today",
    level: 1,
    priority: 90,
    label: "امروز",
    description: "کارهای مهم امروز، برنامه زمانی و پیشرفت روز",
    personas: "all",
    optional: false,
    layout: "full",
  },
  {
    key: "next-action",
    level: 2,
    priority: 80,
    label: "قدم بعدی",
    description: "پیشنهاد قطعی بعدی بر اساس داده‌های واقعی",
    personas: "all",
    optional: false,
    layout: "full",
  },
  {
    key: "spotlight",
    level: 2,
    priority: 70,
    label: "نمای ویژه شخصیت",
    description: "امتحان، جلسه، تحویل، تیم یا مالی — بسته به شخصیت شما",
    personas: "all",
    optional: true,
    layout: "full",
    // The spotlight IS the persona-specific module — it ranks just under the
    // next action for every persona, because it carries the domain emphasis.
    personaPriority: {
      student: 75,
      employee: 75,
      freelancer: 75,
      manager: 78,
      business_owner: 78,
      personal: 75,
    },
  },
  {
    key: "progress",
    level: 3,
    priority: 60,
    label: "پیشرفت",
    description: "سطح، XP، مهارت و ماموریت مرتبط",
    personas: "all",
    optional: false,
    layout: "full",
  },
  {
    key: "stats",
    level: 3,
    priority: 50,
    label: "آمار شخصیت",
    description: "الگوی آمار مرتبط با شخصیت شما",
    personas: "all",
    optional: true,
    layout: "full",
    // Progression stays secondary: a Manager or Business Owner sees the team /
    // money numbers first, so their stats module is boosted and quests lowered.
    personaPriority: {
      student: 55,
      employee: 50,
      freelancer: 50,
      manager: 30,
      business_owner: 30,
      personal: 50,
    },
  },
  {
    key: "quests",
    level: 3,
    priority: 40,
    label: "ماموریت‌های مسیر",
    description: "ماموریت‌های فعال مسیر رشد، فقط وقتی وجود دارند",
    personas: "all",
    optional: true,
    layout: "full",
    // Business owner sees missions as business outcomes; manager sees them as
    // team outcomes. Everyone else keeps them quieter.
    personaPriority: {
      manager: 55,
      business_owner: 55,
      freelancer: 45,
    },
  },
  {
    key: "planning",
    level: 4,
    priority: 30,
    label: "برنامه پیش رو",
    description: "فردا، هفته پیش رو و نزدیک‌ترین موعدها",
    personas: "all",
    optional: true,
    layout: "pair",
    // Students plan around exams/assignments; the personal persona plans around
    // its weekly plan and time blocks.
    personaPriority: {
      student: 38,
      employee: 34,
      personal: 36,
      manager: 28,
      business_owner: 26,
      freelancer: 32,
    },
  },
  {
    key: "routines",
    level: 4,
    priority: 20,
    label: "روتین‌ها",
    description: "کارهای ثابت روزانه",
    personas: "all",
    optional: true,
    layout: "pair",
  },
  {
    key: "long-term",
    level: 5,
    priority: 10,
    label: "اهداف و مسیر بلندمدت",
    description: "پیوند هدف ← پروژه ← کار و مسیر رشد فعال",
    personas: "all",
    optional: true,
    layout: "pair",
  },
];

/** Effective priority of a module for a given persona. */
export function priorityFor(
  module: CommandModuleDef,
  persona: PersonaKey,
): number {
  return module.personaPriority?.[persona] ?? module.priority;
}

/** Modules eligible for a persona, in render order (persona-weighted). */
export function modulesForPersona(persona: PersonaKey): CommandModuleDef[] {
  return COMMAND_MODULES.filter(
    (m) => m.personas === "all" || m.personas.includes(persona),
  ).sort(
    (a, b) =>
      a.level - b.level || priorityFor(b, persona) - priorityFor(a, persona),
  );
}

const MODULE_KEYS = new Set<string>(COMMAND_MODULES.map((m) => m.key));

export function isModuleKey(key: string): boolean {
  return MODULE_KEYS.has(key);
}
