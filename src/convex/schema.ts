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

  // A named set of daily routine tasks ("برنامه روتین"), e.g. "روتین صبح"
  routines: defineTable({
    userId: v.id("users"),
    title: v.string(),
    colorKey: v.string(), // one of COLOR_KEYS (see src/lib/colors.ts)
    sortOrder: v.number(),
    archived: v.optional(v.boolean()),
  })
    .index("by_user", ["userId", "archived"])
    .index("by_user_order", ["userId", "sortOrder"]),

  // One fixed task inside a routine
  routineItems: defineTable({
    userId: v.id("users"),
    routineId: v.id("routines"),
    title: v.string(),
    sortOrder: v.number(),
    archived: v.optional(v.boolean()),
  })
    .index("by_routine", ["routineId", "archived"])
    .index("by_user", ["userId"]),

  // A check-in record for one routine item on one day.
  // Only rows for days the user actually checked (or explicitly unchecked)
  // are stored; absence means "not done".
  checkins: defineTable({
    userId: v.id("users"),
    itemId: v.id("routineItems"),
    day: v.string(), // YYYY-MM-DD (Gregorian, local)
    done: v.boolean(),
  })
    .index("by_user_day", ["userId", "day"])
    .index("by_item", ["itemId"]),
});
