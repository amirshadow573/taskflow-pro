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
});
