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
    /**
     * Optional link to the persona goal this project serves, as `${kind}:${id}`
     * (kind = personal | work | team | business). Phase 09 — lets the UI show
     * Goal → Project → Task relationships without a second hierarchy.
     */
    goalRef: v.optional(v.string()),
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
    /*
     * Phase 12 — observable postponement data for repeated-delay detection
     * (§13). Incremented by tasks.update whenever the due date actually moves
     * forward; nothing is inferred about the user from it.
     */
    postponeCount: v.optional(v.number()),
    lastPostponedAt: v.optional(v.number()),
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

  // XP ledger — every award / reversal is one auditable event.
  xpEvents: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    // task | subtask | routine | mission | challenge | path | stage | streak | bonus
    // | project | goal | focus
    kind: v.string(),
    label: v.string(),
    day: v.string(),
    createdAt: v.number(),
    /** "awarded" (default) | "reversed" — reversals are kept for audit. */
    status: v.optional(v.string()),
    /** When the award was reversed (correction / source undone). */
    reversedAt: v.optional(v.number()),
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
  /* Persona Stats (Phase 04)                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Cached persona-stat state — one row per user + statKey.
   * Values are always *derived* from real activity (see statRules.ts /
   * personaStats.ts), never incremented, so deleted or reversed source
   * activity can never inflate them. Definitions themselves live in code
   * config (config-driven, not hard-coded in UI).
   */
  personaStats: defineTable({
    userId: v.id("users"),
    /** PersonaKey the value was computed under. */
    persona: v.string(),
    /** Stat key from the statRules catalog (e.g. focus, planning). */
    statKey: v.string(),
    /** False when there is not enough meaningful activity yet. */
    hasData: v.boolean(),
    /** Normalized 0–100 (0 when hasData is false). */
    value: v.number(),
    /** Value for the previous comparable window. */
    previousValue: v.optional(v.number()),
    /** up | down | flat — null-ish when data is insufficient. */
    trend: v.optional(v.string()),
    /** Config-driven tier label key (developing … exceptional). */
    tier: v.string(),
    /** Window (in days) the value was computed for. */
    windowDays: v.number(),
    /** Short human explanation of what fed the value. */
    reason: v.optional(v.string()),
    computedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_stat", ["userId", "statKey"]),

  /** Daily value snapshots — history/trend chart input for future analytics. */
  statSnapshots: defineTable({
    userId: v.id("users"),
    statKey: v.string(),
    day: v.string(), // YYYY-MM-DD
    value: v.number(), // 0–100
    delta: v.optional(v.number()), // vs previous snapshot
    reason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_stat_day", ["userId", "statKey", "day"])
    .index("by_user_day", ["userId", "day"]),

  /* ------------------------------------------------------------------ */
  /* Skills & Evolution (Phase 05)                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Cached skill state — one row per user + skillKey.
   * Skills are *derived* from persona stats + real activity (see skillRules
   * config), never incremented — reversed/invalidated activity self-heals on
   * the next sync. Level-ups are logged as auditable skillEvents.
   */
  userSkills: defineTable({
    userId: v.id("users"),
    persona: v.string(),
    /** Skill key from the skillRules persona path. */
    skillKey: v.string(),
    /** False until at least one contributing persona stat has data. */
    hasData: v.boolean(),
    /** Normalized 0–100 progress. */
    progress: v.number(),
    /** 0 (not started) … 5 — derived from SKILL_LEVEL_THRESHOLDS. */
    level: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_skill", ["userId", "skillKey"]),

  /** Auditable skill history — level-ups and evolution-stage changes. */
  skillEvents: defineTable({
    userId: v.id("users"),
    persona: v.string(),
    /** Skill key, or "evolution" for stage changes. */
    skillKey: v.string(),
    /** "levelUp" | "evolution" (future: quest/achievement hooks). */
    type: v.string(),
    from: v.number(),
    to: v.number(),
    /** Persian explanation of what developed. */
    label: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user_skill", ["userId", "skillKey", "createdAt"])
    .index("by_user", ["userId", "createdAt"]),

  /** Current evolution stage per user + persona. */
  userEvolution: defineTable({
    userId: v.id("users"),
    persona: v.string(),
    stageIndex: v.number(),
    stageKey: v.string(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_persona", ["userId", "persona"]),

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

  /* ------------------------------------------------------------------ */
  /* Employee-specific entities                                           */
  /* ------------------------------------------------------------------ */

  /** Focus sessions — personal focus/tracking blocks. */
  focusSessions: defineTable({
    userId: v.id("users"),
    taskId: v.optional(v.id("tasks")),
    projectId: v.optional(v.id("projects")),
    title: v.optional(v.string()),
    plannedMinutes: v.number(),
    actualMinutes: v.number(),
    date: v.string(),
    completed: v.boolean(),
    type: v.string(), // focus | deep_work | break
    createdAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_date", ["userId", "date"]),

  /** Recurring task configurations. */
  recurringConfigs: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    priority: v.string(),
    estimateMinutes: v.optional(v.number()),
    recurrence: v.string(), // daily | weekly | monthly | custom
    recurrenceDays: v.optional(v.array(v.number())), // 0=Sun..6=Sat for weekly
    lastGenerated: v.optional(v.string()), // YYYY-MM-DD
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Work goals — professional objectives. */
  workGoals: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    period: v.string(), // quarterly | monthly | weekly | custom
    dueDate: v.optional(v.string()),
    progress: v.number(), // 0-100
    status: v.string(), // active | completed | paused | at_risk
    relatedProjectIds: v.array(v.id("projects")),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Employee work notes. */
  employeeNotes: defineTable({
    userId: v.id("users"),
    title: v.string(),
    content: v.string(),
    noteType: v.string(), // quick | meeting | project | personal
    projectId: v.optional(v.id("projects")),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /* ---------------------------------------------------------------- */
  /* Business Owner workspace (Phase 2.5E)                             */
  /* ---------------------------------------------------------------- */

  /** Business customers / clients. */
  customers: defineTable({
    userId: v.id("users"),
    name: v.string(),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: v.string(), // lead | prospect | active | inactive | lost
    source: v.optional(v.string()),
    totalRevenue: v.number(),
    pendingPayments: v.number(),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    color: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Sales opportunities / deals. */
  salesOpportunities: defineTable({
    userId: v.id("users"),
    customerId: v.optional(v.id("customers")),
    title: v.string(),
    value: v.number(),
    currency: v.string(),
    stage: v.string(), // lead | contacted | qualified | proposal | negotiation | won | lost
    expectedCloseDate: v.optional(v.string()),
    probability: v.optional(v.number()), // 0-100 manual
    owner: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Revenue entries. */
  revenueEntries: defineTable({
    userId: v.id("users"),
    customerId: v.optional(v.id("customers")),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.string(), // expected | invoiced | received | cancelled
    category: v.optional(v.string()),
    date: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Business expenses. */
  expenses: defineTable({
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    amount: v.number(),
    currency: v.string(),
    category: v.string(), // marketing | operations | software | equipment | personnel | services | other
    date: v.string(),
    notes: v.optional(v.string()),
    recurring: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Payment tracking. */
  payments: defineTable({
    userId: v.id("users"),
    customerId: v.optional(v.id("customers")),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    amount: v.number(),
    currency: v.string(),
    type: v.string(), // incoming | outgoing
    status: v.string(), // pending | paid | partial | overdue | cancelled
    dueDate: v.string(),
    paidDate: v.optional(v.string()),
    paidAmount: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Business goals (strategic). */
  businessGoals: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    type: v.string(), // numeric | completion | milestone | binary
    period: v.string(), // quarterly | monthly | weekly | annual | custom
    target: v.optional(v.number()),
    current: v.number(),
    unit: v.optional(v.string()), // toman | customers | projects | etc.
    progress: v.number(), // 0-100
    status: v.string(), // active | completed | paused | at_risk
    dueDate: v.optional(v.string()),
    relatedProjectIds: v.array(v.id("projects")),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Strategic initiatives. */
  initiatives: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(), // planning | in_progress | completed | paused
    goalId: v.optional(v.id("businessGoals")),
    projectId: v.optional(v.id("projects")),
    priority: v.string(),
    dueDate: v.optional(v.string()),
    progress: v.number(), // 0-100
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /* ---------------------------------------------------------------- */
  /* Personal Productivity Workspace (Phase 2.5F)                      */
  /* ---------------------------------------------------------------- */

  /** Areas of the user's life — where attention is going. */
  lifeAreas: defineTable({
    userId: v.id("users"),
    name: v.string(),
    color: v.string(), // hex
    emoji: v.optional(v.string()),
    archived: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Personal goals with milestones (hierarchy: goal → milestones → tasks). */
  personalGoals: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    lifeAreaId: v.optional(v.id("lifeAreas")),
    dueDate: v.optional(v.string()), // YYYY-MM-DD
    progress: v.number(), // 0-100
    status: v.string(), // active | completed | paused
    milestones: v.array(
      v.object({
        title: v.string(),
        done: v.boolean(),
      }),
    ),
    relatedProjectIds: v.array(v.id("projects")),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Habits — repeated behaviors (separate from routines). */
  habits: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    frequency: v.string(), // daily | weekly
    target: v.number(), // completions per frequency period
    color: v.optional(v.string()),
    lifeAreaId: v.optional(v.id("lifeAreas")),
    archived: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Per-day habit completion logs (for streaks & consistency). */
  habitLogs: defineTable({
    userId: v.id("users"),
    habitId: v.id("habits"),
    day: v.string(), // YYYY-MM-DD
    done: v.boolean(),
  })
    .index("by_user_day", ["userId", "day"])
    .index("by_habit", ["habitId"]),

  /** Time blocks — when the user intends to do something. */
  timeBlocks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    day: v.string(), // YYYY-MM-DD
    startTime: v.string(), // HH:mm
    endTime: v.string(), // HH:mm
    kind: v.string(), // focus | task | meeting | study | routine | personal | break | review | planning | admin | other
    taskId: v.optional(v.id("tasks")),
    projectId: v.optional(v.id("projects")),
    goalId: v.optional(v.id("personalGoals")),
    /* Phase 11 — adaptive scheduling (all optional: legacy blocks stay valid) */
    /** planned | completed | missed | cancelled — defaults to "planned". */
    status: v.optional(v.string()),
    /** Fixed commitments never move automatically; flexible ones may be proposed to move. */
    fixed: v.optional(v.boolean()),
    /** manual | planning | reschedule | ai_import — where the block came from. */
    source: v.optional(v.string()),
    /** Mirrors the linked task's priority at scheduling time (context only). */
    priority: v.optional(v.string()),
    /**
     * Visual Timeline (Phase 17) — the block's multi-line description.
     * Reuses the existing free-text `notes` field rather than adding a
     * duplicate one.
     */
    notes: v.optional(v.string()),
    /**
     * Visual Timeline (Phase 17) — user-chosen colour from the timeline
     * palette. Purely visual: the engine never assigns meaning to it, and
     * blocks created before this field simply fall back to their kind tone.
     */
    color: v.optional(v.string()),
    /** Traceability: the routine item this block was scheduled for (§21). */
    routineId: v.optional(v.id("routineItems")),
    /** Traceability: the habit this block was scheduled for (§22). */
    habitId: v.optional(v.id("habits")),
    completedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_day", ["userId", "day"]),

  /** Daily / weekly / monthly personal reviews. */
  personalReviews: defineTable({
    userId: v.id("users"),
    type: v.string(), // daily | weekly | monthly
    periodKey: v.string(), // YYYY-MM-DD (daily), week start (weekly), YYYY-MM (monthly)
    completedWork: v.string(),
    remainingWork: v.string(),
    wentWell: v.string(),
    focusNext: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "type"]),

  /** Lightweight personal notes. */
  personalNotes: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    lifeAreaId: v.optional(v.id("lifeAreas")),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /* ---------------------------------------------------------------- */
  /* Context & Environment Engine (Phase 02.6)                         */
  /* ---------------------------------------------------------------- */

  /**
   * A real-world environment the user operates within.
   * Generic by design — school, institute, company, team, business,
   * client ecosystem, personal life… never hard-coded to one domain.
   */
  environments: defineTable({
    userId: v.id("users"),
    name: v.string(),
    /** EnvironmentType: school | institute | university | company | department | team | business | clients | personal | community | other */
    type: v.string(),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    timezone: v.optional(v.string()),
    /** Weekday numbers the environment is active (0=Sunday … 6=Saturday). */
    schedule: v.array(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /** The user's relationship to an environment (role + localized label). */
  environmentMemberships: defineTable({
    userId: v.id("users"),
    environmentId: v.id("environments"),
    /** member | student | employee | manager | owner | client | freelancer */
    role: v.string(),
    /** Free-form localized label, e.g. "پایه ۱۲ — تجربی" or "تیم محصول". */
    label: v.optional(v.string()),
    status: v.string(), // active | left
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_env", ["userId", "environmentId"]),

  /**
   * Flexible context attribute with full provenance metadata.
   * Distinguishes user-provided / discovered / imported / inferred data.
   */
  contextAttributes: defineTable({
    userId: v.id("users"),
    environmentId: v.optional(v.id("environments")),
    /** Attribute key, e.g. "education_level", "department", "field_of_study". */
    key: v.string(),
    value: v.string(),
    /** user_provided | discovered | imported | inferred */
    origin: v.string(),
    /** known | inferred | unknown — confidence of the value. */
    confidence: v.string(),
    userConfirmed: v.boolean(),
    sourceId: v.optional(v.id("contextSources")),
    lastUpdated: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "key"]),

  /**
   * Contextual events feed Calendar/Today with origin retained.
   * One-off events use `date`; recurring events use `weekdays`.
   */
  contextEvents: defineTable({
    userId: v.id("users"),
    environmentId: v.optional(v.id("environments")),
    title: v.string(),
    /** class | exam | meeting | deadline | commitment | event | other */
    type: v.string(),
    /** One-off occurrence (YYYY-MM-DD). */
    date: v.optional(v.string()),
    /** Weekly recurrence — weekday numbers (0=Sunday … 6=Saturday). */
    weekdays: v.array(v.number()),
    startTime: v.optional(v.string()), // HH:mm
    endTime: v.optional(v.string()), // HH:mm
    /** user | environment | external */
    origin: v.string(),
    sourceId: v.optional(v.id("contextSources")),
    /** known | inferred | unknown */
    confidence: v.string(),
    userConfirmed: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  /**
   * Registry of external/public information sources.
   * Stores references only — no credentials, no scraping mechanisms.
   */
  contextSources: defineTable({
    userId: v.id("users"),
    environmentId: v.optional(v.id("environments")),
    name: v.string(),
    /** public_website | official_api | import | oauth | manual */
    sourceType: v.string(),
    url: v.optional(v.string()),
    lastChecked: v.optional(v.number()),
    status: v.string(), // active | paused | failed
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /**
   * Lightweight confirmation queue for potentially useful discovered info.
   * Nothing is applied automatically — the user always confirms.
   */
  contextConfirmations: defineTable({
    userId: v.id("users"),
    /** environment | event | attribute */
    kind: v.string(),
    /** JSON payload describing the proposed item. */
    payload: v.string(),
    /** inferred | unknown — never auto-applied. */
    confidence: v.string(),
    status: v.string(), // pending | accepted | dismissed
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  /* ------------------------------------------------------------------ */
  /* Quests (Phase 06)                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * One row per user + quest definition instance. Daily/weekly quests recur
   * per period (period = day key or week start key) — the instance key is
   * `${questKey}:${period}` so a period can never hold duplicates. Progress is
   * always *derived* from real activity (see questRules.ts / quests.ts), never
   * incremented, and XP is paid at most once via awardXp refId idempotency.
   * Definitions themselves live in code config (config-driven).
   */
  userQuests: defineTable({
    userId: v.id("users"),
    /** Quest key from the questRules catalog (e.g. daily_priority_3). */
    questKey: v.string(),
    /** PersonaKey the quest was generated under. */
    persona: v.string(),
    /** daily | weekly | special | persona | goal */
    type: v.string(),
    /** easy | medium | hard | major */
    difficulty: v.string(),
    /** Day key (daily) or week-start key (weekly); equals key for special. */
    period: v.string(),
    /** active | completed | expired | cancelled */
    status: v.string(),
    /** Current derived progress (0..target). */
    progress: v.number(),
    target: v.number(),
    /** Configured XP reward at generation time. */
    xp: v.number(),
    title: v.string(),
    description: v.string(),
    /** Metric key from the questRules requirement catalog. */
    metric: v.string(),
    /** Optional deadline (YYYY-MM-DD) — special quests, tight dailies. */
    deadline: v.optional(v.string()),
    /** Related goal id when the quest is goal-based. */
    goalId: v.optional(v.string()),
    /** Human explanation of what actions count (shown in detail view). */
    countsText: v.optional(v.string()),
    /** Skill key this quest relates to (context only — skills stay derived). */
    skillKey: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    /** True once the XP reward has been paid (awardXp is also idempotent). */
    rewardPaid: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_key_period", ["userId", "questKey", "period"])
    .index("by_user_status", ["userId", "status"]),

  /* ------------------------------------------------------------------ */
  /* Unlocks / Capabilities (Phase 08)                                    */
  /* ------------------------------------------------------------------ */

  /**
   * One row per user + unlock definition, created ONLY when all requirements
   * are legitimately met (see unlockRules.ts config / unlocks.ts engine).
   * Grants are idempotent (by_user_key) and persistent — a granted capability
   * is never revoked by later progression regressions.
   */
  userUnlocks: defineTable({
    userId: v.id("users"),
    /** PersonaKey the capability was granted under. */
    persona: v.string(),
    /** Unlock key from the unlockRules catalog (e.g. analytics). */
    unlockKey: v.string(),
    /** "unlocked" — states are derived live for locked/available. */
    status: v.string(),
    unlockedAt: v.number(),
    /** "requirements_met" | "bootstrap" — why the grant happened. */
    trigger: v.string(),
    /** JSON snapshot of the met requirements at grant time (audit). */
    requirementsSnapshot: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "unlockKey"]),

  /** Auditable history of unlock grants (feeds subtle user feedback). */
  unlockEvents: defineTable({
    userId: v.id("users"),
    unlockKey: v.string(),
    /** "granted" (extensible for future event types). */
    type: v.string(),
    /** Persian label of the capability, denormalized for display. */
    label: v.string(),
    trigger: v.string(),
    snapshot: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),

  /* ------------------------------------------------------------------ */
  /* Adaptive Execution & Productivity Feedback Loop (Phase 12)          */
  /* ------------------------------------------------------------------ */

  /**
   * One execution attempt: what the user is ACTUALLY doing, right now.
   *
   * Task status answers "what is the state of the work"; a session answers
   * "what happened while the user was attempting it" (§3). Kept as a separate
   * entity so neither concept can overwrite the other, and so an interrupted
   * browser session is recoverable (§35).
   */
  executionSessions: defineTable({
    userId: v.id("users"),
    taskId: v.optional(v.id("tasks")),
    blockId: v.optional(v.id("timeBlocks")),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    /** task | focus | study | admin | other — decides the outcome path (§21). */
    kind: v.string(),
    /** in_progress | paused | completed | abandoned */
    state: v.string(),
    /** Local YYYY-MM-DD the session started on (day-boundary math stays local). */
    day: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    /** Completed pause spans only — never counted as work time. */
    pausedMs: v.number(),
    /** Timestamp the current pause began (undefined while running). */
    pausedAt: v.optional(v.number()),
    /** Wall-clock ms at completion — frozen, never recomputed from "now". */
    elapsedMs: v.optional(v.number()),
    /** Estimated/planned minutes (context for variance — never rewritten). */
    plannedMinutes: v.optional(v.number()),
    /** Optional minimal feedback (§8): completed | partial | blocked | longer | easier | irrelevant | waiting. */
    feedback: v.optional(v.string()),
    feedbackNote: v.optional(v.string()),
    /** completed | abandoned | replaced — why the session stopped. */
    endedReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId", "startedAt"])
    .index("by_user_state", ["userId", "state"])
    .index("by_user_day", ["userId", "day"])
    .index("by_task", ["userId", "taskId"]),

  /**
   * Auditable execution event log (§23 / §36). Append-only, user-scoped,
   * timestamped. Recovery and scheduling adjustments are traceable here; the
   * progression systems are NEVER driven from this table — they stay on their
   * existing idempotent paths (xpEvents / stats / quests / achievements).
   */
  executionEvents: defineTable({
    userId: v.id("users"),
    /** See EXECUTION_EVENT_TYPES in src/lib/execution/types.ts. */
    type: v.string(),
    day: v.string(),
    at: v.number(),
    sessionId: v.optional(v.id("executionSessions")),
    taskId: v.optional(v.id("tasks")),
    blockId: v.optional(v.id("timeBlocks")),
    projectId: v.optional(v.id("projects")),
    /** user | system — who caused the event. */
    source: v.string(),
    /** Short Persian label, denormalized for the audit trail. */
    label: v.string(),
    /** JSON payload (deviation data, recovery action, variance, …). */
    meta: v.optional(v.string()),
  })
    .index("by_user", ["userId", "at"])
    .index("by_user_day", ["userId", "day"])
    .index("by_user_task", ["userId", "taskId"]),

  /* ---------------------------------------------------------------- */
  /* Phase 14 — Smart Workflow & Automation Engine                     */
  /* ---------------------------------------------------------------- */
  /**
   * One user-defined automation rule (WHEN → IF → THEN). All definitions are
   * validated against the shared catalog in automationRules.ts before they
   * are stored; trigger / conditions / actions are structured JSON so the
   * engine, the builder and the dry-run preview read the exact same shape.
   * Strictly user-scoped: an automation can only ever touch its owner's rows.
   */
  automations: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    enabled: v.boolean(),
    /** { kind: "event" | "state" | "time", key, config? } — see automationRules. */
    trigger: v.any(),
    /** AutomationCondition[] — AND semantics. */
    conditions: v.array(v.any()),
    /** AutomationAction[] — executed in order through the action service. */
    actions: v.array(v.any()),
    /** Template key when the rule was created from a template. */
    createdFromTemplate: v.optional(v.string()),
    /** Fixed-offset timezone captured at save time (minutes east of UTC). */
    tzOffsetMinutes: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastExecutedAt: v.optional(v.number()),
    /** Next due fire for time triggers (epoch ms, computed in the owner tz). */
    nextExecutionAt: v.optional(v.number()),
    /** Cadence guard for state sweeps (epoch ms). */
    lastEvaluatedAt: v.optional(v.number()),
    runCount: v.number(),
    lastStatus: v.optional(v.string()),
    lastFailureReason: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_enabled", ["userId", "enabled"])
    .index("by_enabled", ["enabled"]),

  /**
   * Append-only execution history (audit trail) — successes AND failures are
   * stored, never hidden. Doubles as the idempotency ledger: one row per
   * (automation, dedupeKey), so the same occurrence can never run twice.
   * `notify*` rows are the automation notification channel — they surface in
   * the EXISTING bell/popover list (no second notification system).
   */
  automationExecutions: defineTable({
    userId: v.id("users"),
    automationId: v.id("automations"),
    /** Denormalized so history stays readable after an automation is deleted. */
    automationName: v.string(),
    /** Idempotency key — unique per (userId, automationId, dedupeKey). */
    dedupeKey: v.string(),
    /** success | failed | skipped */
    status: v.string(),
    /** time | state | event:<key> | manual */
    origin: v.string(),
    /** Persian summary of what fired (shown in history). */
    triggerLabel: v.string(),
    /** Persian summary of what the actions did. */
    actionSummary: v.string(),
    /** Persian failure / skip reason — always surfaced, never swallowed. */
    reason: v.optional(v.string()),
    /** JSON details per action (ids, values) for the inspect view. */
    details: v.optional(v.string()),
    /** Loop-protection chain depth (0 = top level). */
    depth: v.number(),
    at: v.number(),
    day: v.string(),
    /** Notification-producing execution (surfaces in the bell). */
    notify: v.optional(v.boolean()),
    notifyTitle: v.optional(v.string()),
    notifyBody: v.optional(v.string()),
  })
    .index("by_user_at", ["userId", "at"])
    .index("by_user_auto_key", ["userId", "automationId", "dedupeKey"])
    .index("by_day", ["day"]),

  /* Phase 10.5 — external AI planning import (user-supplied file)        */
  /* ------------------------------------------------------------------ */
  /**
   * One row per uploaded external-AI plan: the full audit trail of Phase 10.5
   * (upload → validated → needs review → applied / partially applied /
   * rejected). The platform never calls an AI API — this table only records
   * what the USER imported, what the validator found, and what actually landed
   * in the workspace.
   *
   * Layer separation (§12 of the spec) is preserved: `contextSnapshot` stores
   * the USER INPUT layer, `planSnapshot` the AI-GENERATED layer. Nothing is
   * ever executed from the file — it is stored as plain JSON text.
   */
  aiPlanningImports: defineTable({
    userId: v.id("users"),
    /** uploaded | validated | needs_review | applied | partially_applied | rejected | failed */
    status: v.string(),
    persona: v.string(),
    /** external_chatgpt | external_gemini | external_claude | future_api | future_provider */
    sourceType: v.string(),
    sourceProvider: v.string(),
    schemaVersion: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    appliedAt: v.optional(v.number()),
    /** JSON: per-entity counts found in the file. */
    inputCounts: v.string(),
    /** JSON: per-entity counts actually written. */
    appliedCounts: v.string(),
    /** JSON: created ids per entity (audit + review). */
    appliedIds: v.optional(v.string()),
    /** JSON: PlanIssue[] (errors, warnings, dropped items). */
    issues: v.optional(v.string()),
    /** JSON: PlanConflict[] (overlaps, capacity, references, past dates). */
    conflicts: v.optional(v.string()),
    /** JSON: PlanDuplicate[] (title matches against existing data). */
    duplicates: v.optional(v.string()),
    /** JSON: the USER INPUT layer (context + inputs + assumptions). */
    contextSnapshot: v.optional(v.string()),
    /** JSON: the normalized AI-GENERATED plan (capped), for review only. */
    planSnapshot: v.optional(v.string()),
    /** JSON: what the user chose at confirmation time. */
    applyOptions: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_at", ["userId", "createdAt"]),

  /* ---------------------------------------------------------------- */
  /* Phase 15 — AI Intelligence Layer                                   */
  /*                                                                   */
  /* The assistant is NOT a second memory system (§22). Conversations  */
  /* and messages exist so a thread can keep its recent turns, but no   */
  /* field here is ever read back as a source of truth about the user.  */
  /* Persistent facts stay in tasks/projects/goals/contextTables.       */
  /* ---------------------------------------------------------------- */

  /** One assistant thread. Bounded and short-lived by design. */
  aiConversations: defineTable({
    userId: v.id("users"),
    persona: v.string(),
    /** Which surface started it: dashboard | today | planning | assistant. */
    feature: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    /** Set when the thread is archived from the UI. */
    archivedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_at", ["userId", "createdAt"]),

  /** One user turn + one assistant turn, with the proposal made in it. */
  aiMessages: defineTable({
    userId: v.id("users"),
    conversationId: v.id("aiConversations"),
    /** user | assistant | system */
    role: v.string(),
    /** User text, or the assistant's rendered summary. */
    content: v.string(),
    /** analysis | action_plan | refusal | clarify */
    responseType: v.optional(v.string()),
    /**
     * JSON: the VALIDATED action plan shown at confirmation time.
     * Stored so a refresh cannot silently re-target different records (§25).
     */
    plan: v.optional(v.string()),
    /** JSON: labels of the context sections actually transmitted (§27). */
    contextSources: v.optional(v.string()),
    /** applied | discarded | pending | no_actions */
    status: v.optional(v.string()),
    /** JSON: ids actually written, for the audit trail. */
    appliedIds: v.optional(v.string()),
    appliedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user_at", ["userId", "createdAt"]),

  /**
   * AI usage accounting (§23). Present so free limits, quotas and provider
   * fallback can be built later WITHOUT changing the schema or the call sites.
   * Never surfaced to normal users.
   */
  aiUsage: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    model: v.string(),
    feature: v.string(),
    latencyMs: v.number(),
    ok: v.boolean(),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    errorKind: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user_at", ["userId", "createdAt"]),

  /**
   * Phase 16 — AI Insights history (§14, §23).
   *
   * One row per generated insight or review. The row keeps BOTH layers so the
   * history can be audited months later:
   *   patterns  — what the DETERMINISTIC engine proved (the ground truth)
   *   plan      — the interpreted/recommended actions awaiting confirmation
   *
   * Without `patterns` the history would degrade into a log of model opinions,
   * which is exactly what §11 forbids.
   */
  aiInsights: defineTable({
    userId: v.id("users"),
    persona: v.string(),
    /** insight | daily_review | weekly_review */
    kind: v.string(),
    /** 7d | 14d | 30d — the window the evidence was measured over. */
    window: v.string(),
    summary: v.string(),
    /** JSON: DetectedPattern[] — proven patterns, never model-authored. */
    patterns: v.string(),
    /** JSON: AIInsightInterpretation[] — the model's reading of those. */
    interpretations: v.optional(v.string()),
    /** JSON: ReviewSection[] for review kinds. */
    sections: v.optional(v.string()),
    /** JSON: the validated action plan, applied via ai.applyProposal (§6). */
    plan: v.optional(v.string()),
    /** FK into aiMessages when actions are pending confirmation. */
    messageId: v.optional(v.id("aiMessages")),
    /** strong_pattern | emerging_pattern | limited_data */
    confidence: v.string(),
    /** True when there was not enough activity to say anything. */
    insufficient: v.boolean(),
    /** JSON: labels of the context sections actually transmitted (§27). */
    contextSources: v.optional(v.string()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user_at", ["userId", "createdAt"]),
});
