import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  }).index("email", ["email"]),

  /* ---------------------------------------------------------------- */
  /* Personalization foundation (Phase 1)                               */
  /* ---------------------------------------------------------------- */

  /**
   * One per user. Persona + goals + preferences + dashboard configuration.
   * Extends (never replaces) the existing auth users table; the shared
   * productivity data (tasks/projects/routines) stays persona-agnostic.
   */
  userProfile: defineTable({
    userId: v.id("users"),
    /** PersonaKey from src/lib/personas.ts (open string for future keys). */
    personaKey: v.string(),
    /** "onboarding" | "settings" | "inferred" | "default" */
    personaSource: v.string(),
    /** Free-form persona-specific answers (field, courseCount, teamSize…). */
    personaDetails: v.optional(v.string()), // JSON
    /** Goal keys from onboarding (persona-adaptive, e.g. study_plan/exam_prep). */
    goals: v.array(v.string()),
    /** Work style: planning cadence (daily/weekly/project_based/…). */
    workStyle: v.optional(v.string()),
    /** Productivity preference (deep_focus/fast_execution/goal_oriented…). */
    productivityStyle: v.optional(v.string()),
    /** Preferences JSON (planningStyle, startPage, notifications…). */
    preferences: v.optional(v.string()), // JSON
    /** DashboardConfig JSON (widget rows: key/visible/priority). */
    dashboardConfig: v.optional(v.string()), // JSON
    /** True once the user finished the personalized onboarding. */
    completedOnboarding: v.optional(v.boolean()),
    /** Future reference for migration tracking. */
    schemaVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Projects group tasks together
  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(), // hex
    deadline: v.optional(v.string()), // YYYY-MM-DD
    status: v.string(), // active | paused | completed
    createdAt: v.number(),
    archived: v.boolean(),
  }).index("by_user", ["userId"]),

  // Unified task model: inbox capture, today lists, projects, kanban, subtasks
  tasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(), // inbox | todo | in_progress | review | done
    priority: v.string(), // low | medium | high | urgent
    dueDate: v.optional(v.string()), // YYYY-MM-DD (local)
    dueTime: v.optional(v.string()), // HH:mm
    projectId: v.optional(v.id("projects")),
    tags: v.array(v.string()),
    parentId: v.optional(v.id("tasks")), // subtask of another task
    estimateMinutes: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    sortOrder: v.number(),
    createdAt: v.number(),
    archived: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_parent", ["parentId"]),

  // Daily fixed routines ("برنامه روتین") — used by the Planning page
  routines: defineTable({
    userId: v.id("users"),
    title: v.string(),
    colorKey: v.string(),
    sortOrder: v.number(),
    archived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId", "archived"])
    .index("by_user_order", ["userId", "sortOrder"]),

  routineItems: defineTable({
    userId: v.id("users"),
    routineId: v.id("routines"),
    title: v.string(),
    sortOrder: v.number(),
    archived: v.optional(v.boolean()),
  })
    .index("by_routine", ["routineId", "archived"])
    .index("by_user", ["userId"]),

  checkins: defineTable({
    userId: v.id("users"),
    itemId: v.id("routineItems"),
    day: v.string(),
    done: v.boolean(),
  })
    .index("by_user_day", ["userId", "day"])
    .index("by_item", ["itemId"]),

  /* ---------------------------------------------------------------- */
  /* Level-up / gamification system                                    */
  /* ---------------------------------------------------------------- */

  // Aggregate progression state — one document per user (fast leaderboard).
  progress: defineTable({
    userId: v.id("users"),
    totalXp: v.number(),
    level: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastActiveDay: v.optional(v.string()),
    restDaysUsed: v.number(),
    weekKey: v.optional(v.string()),
    weekXp: v.number(),
    monthKey: v.optional(v.string()),
    monthXp: v.number(),
    lastLevelUpAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Per-day rollup: heatmap, daily score history, future AI analysis input.
  dailyStats: defineTable({
    userId: v.id("users"),
    day: v.string(),
    plannedTasks: v.number(),
    completedTasks: v.number(),
    routineItems: v.number(),
    routineDone: v.number(),
    focusMinutes: v.number(),
    xpEarned: v.number(),
    missionsDone: v.number(),
    missionsTotal: v.number(),
    taskScore: v.number(),
    routineScore: v.number(),
    consistencyScore: v.number(),
    missionScore: v.number(),
    score: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_day", ["userId", "day"])
    .index("by_user", ["userId"]),

  // XP ledger — every award / reversal is one immutable event.
  xpEvents: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    kind: v.string(), // task | subtask | routine | mission | challenge | path | stage | streak | bonus
    label: v.string(),
    day: v.string(),
    createdAt: v.number(),
    refType: v.optional(v.string()),
    refId: v.optional(v.string()),
    meta: v.optional(v.string()),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_day", ["userId", "day"])
    .index("by_user_ref", ["userId", "refType", "refId"]),

  // Unlocked achievements.
  achievementUnlocks: defineTable({
    userId: v.id("users"),
    key: v.string(),
    unlockedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "key"]),

  // Daily / weekly mission progress (period = day key or week key).
  missionState: defineTable({
    userId: v.id("users"),
    key: v.string(),
    scope: v.string(), // daily | weekly
    period: v.string(),
    progress: v.number(),
    target: v.number(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user_scope", ["userId", "scope"])
    .index("by_user_key_period", ["userId", "key", "period"]),

  // Enrolled long-running challenges.
  challengeState: defineTable({
    userId: v.id("users"),
    key: v.string(),
    status: v.string(), // active | completed | failed
    startedAt: v.number(),
    startedDay: v.string(),
    endsDay: v.string(),
    progress: v.number(),
    target: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "key"]),

  // Growth path membership + stage progression.
  pathEnrollments: defineTable({
    userId: v.id("users"),
    pathKey: v.string(),
    status: v.string(), // active | completed
    stageIndex: v.number(),
    stageStartedDay: v.string(),
    completedMissionIds: v.array(v.string()),
    stageBonusesPaid: v.array(v.string()),
    xpEarned: v.number(),
    startedAt: v.number(),
    lastActiveAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId", "lastActiveAt"])
    .index("by_user_path", ["userId", "pathKey"]),

  // Rewards unlocked by level (digital customisation only).
  rewardUnlocks: defineTable({
    userId: v.id("users"),
    key: v.string(),
    unlockedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "key"]),

  /* ------------------------------------------------------------------ */
  /* Student-specific academic entities                                   */
  /* ------------------------------------------------------------------ */

  /** Academic subjects — one per course/module. */
  subjects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    teacher: v.optional(v.string()),
    color: v.string(), // tailwind color class or hex
    targetGrade: v.optional(v.number()), // 0-20 scale
    currentGrade: v.optional(v.number()),
    studyHours: v.number(), // total minutes studied
    archived: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Exams — linked to a subject. */
  exams: defineTable({
    userId: v.id("users"),
    subjectId: v.id("subjects"),
    title: v.string(),
    date: v.string(), // YYYY-MM-DD
    time: v.optional(v.string()), // HH:mm
    location: v.optional(v.string()),
    importance: v.string(), // high | medium | low
    targetGrade: v.optional(v.number()),
    preparationProgress: v.number(), // 0-100
    completed: v.boolean(),
    actualGrade: v.optional(v.number()),
    archived: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_subject", ["subjectId"]),

  /** Assignments / homework — linked to a subject. */
  assignments: defineTable({
    userId: v.id("users"),
    subjectId: v.id("subjects"),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.string(), // YYYY-MM-DD
    difficulty: v.string(), // easy | medium | hard
    estimatedMinutes: v.optional(v.number()),
    status: v.string(), // pending | in_progress | completed | overdue
    priority: v.string(), // low | medium | high
    completedAt: v.optional(v.number()),
    archived: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_subject", ["subjectId"]),

  /** Academic grades — one per assessment result. */
  grades: defineTable({
    userId: v.id("users"),
    subjectId: v.id("subjects"),
    title: v.string(), // e.g. "آزمون میان‌ترم"
    score: v.number(),
    maxScore: v.number(), // usually 20
    weight: v.number(), // percentage weight
    date: v.string(), // YYYY-MM-DD
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_subject", ["subjectId"]),

  /** Study sessions — linked to a subject optionally. */
  studySessions: defineTable({
    userId: v.id("users"),
    subjectId: v.optional(v.id("subjects")),
    title: v.optional(v.string()),
    plannedMinutes: v.number(),
    actualMinutes: v.number(),
    date: v.string(), // YYYY-MM-DD
    completed: v.boolean(),
    type: v.string(), // study | focus | review
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_subject", ["subjectId"]),

  /** Academic notes — linked to subject/exam/assignment optionally. */
  studentNotes: defineTable({
    userId: v.id("users"),
    subjectId: v.optional(v.id("subjects")),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    isFavorite: v.boolean(),
    noteType: v.string(), // subject | lecture | exam | quick | revision
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_subject", ["subjectId"]),

  /* ------------------------------------------------------------------ */
  /* Manager / Team-specific entities                                     */
  /* ------------------------------------------------------------------ */

  /** Teams — one per user who acts as manager. */
  teams: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    archived: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Team members — each row is one member of a team. */
  teamMembers: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    name: v.string(),
    role: v.string(), // manager | member | lead
    email: v.optional(v.string()),
    capacity: v.number(), // max tasks per week
    archived: v.boolean(),
    createdAt: v.number(),
  }).index("by_team", ["teamId"]).index("by_user", ["userId"]),

  /** Milestones — project-level checkpoints. */
  milestones: defineTable({
    userId: v.id("users"),
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.string(),
    status: v.string(), // pending | in_progress | completed | delayed
    progress: v.number(), // 0-100
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_project", ["projectId"]).index("by_user", ["userId"]),

  /** Team goals — team-level objectives. */
  teamGoals: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    title: v.string(),
    description: v.optional(v.string()),
    period: v.string(), // quarterly | monthly | weekly | custom
    dueDate: v.optional(v.string()),
    progress: v.number(), // 0-100
    status: v.string(), // active | completed | paused | at_risk
    ownerId: v.optional(v.id("teamMembers")),
    relatedProjectIds: v.array(v.id("projects")),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_team", ["teamId"]).index("by_user", ["userId"]),

  /** Meetings — team meetings with agenda and action items. */
  meetings: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    title: v.string(),
    date: v.string(),
    time: v.optional(v.string()),
    participants: v.array(v.string()), // member names
    projectId: v.optional(v.id("projects")),
    agenda: v.optional(v.string()),
    notes: v.optional(v.string()),
    decisions: v.optional(v.string()),
    actionItems: v.optional(v.string()), // JSON array of {title, assignee, done}
    status: v.string(), // scheduled | in_progress | completed | cancelled
    createdAt: v.number(),
  }).index("by_team", ["teamId"]).index("by_user", ["userId"]),

  /** Team activity log — operational events for the manager feed. */
  teamActivity: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    type: v.string(), // task_assigned | task_completed | task_overdue | project_updated | goal_updated | meeting_scheduled | member_added
    title: v.string(),
    description: v.optional(v.string()),
    memberId: v.optional(v.id("teamMembers")),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")),
    createdAt: v.number(),
  }).index("by_team", ["teamId", "createdAt"]).index("by_user", ["userId"]),

  /* ------------------------------------------------------------------ */
  /* Freelancer-specific entities                                          */
  /* ------------------------------------------------------------------ */

  /** Clients — independent professionals the freelancer works with. */
  clients: defineTable({
    userId: v.id("users"),
    name: v.string(),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    color: v.string(),
    archived: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Invoices — billing records for client work. */
  invoices: defineTable({
    userId: v.id("users"),
    clientId: v.id("clients"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    amount: v.number(), // in local currency units
    currency: v.string(), // e.g. "IRR" | "USD"
    status: v.string(), // draft | sent | paid | overdue | cancelled
    dueDate: v.string(),
    paidAt: v.optional(v.number()),
    items: v.optional(v.string()), // JSON line items
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]).index("by_client", ["clientId"]),

  /** Time entries — billable/non-billable time tracked. */
  timeEntries: defineTable({
    userId: v.id("users"),
    clientId: v.optional(v.id("clients")),
    projectId: v.optional(v.id("projects")),
    description: v.optional(v.string()),
    startTime: v.number(), // timestamp
    endTime: v.optional(v.number()), // null = running
    duration: v.number(), // seconds
    billable: v.boolean(),
    hourlyRate: v.optional(v.number()),
    date: v.string(), // YYYY-MM-DD
    createdAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_date", ["userId", "date"]),

  /** Deliverables — client-facing deliverables with status tracking. */
  deliverables: defineTable({
    userId: v.id("users"),
    clientId: v.id("clients"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.string(),
    status: v.string(), // pending | in_progress | delivered | revised | approved
    priority: v.string(), // low | medium | high | urgent
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]).index("by_client", ["clientId"]),

  /** Proposals — project proposals sent to clients. */
  proposals: defineTable({
    userId: v.id("users"),
    clientId: v.id("clients"),
    title: v.string(),
    description: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    status: v.string(), // draft | sent | accepted | rejected | expired
    validUntil: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]).index("by_client", ["clientId"]),
});
