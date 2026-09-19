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
});
