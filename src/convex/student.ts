import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { handleFocusSession } from "./gamification";

/* ================================================================== */
/*  SUBJECTS                                                           */
/* ================================================================== */

export const listSubjects = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("subjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const createSubject = mutation({
  args: {
    name: v.string(),
    teacher: v.optional(v.string()),
    color: v.string(),
    targetGrade: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("subjects", {
      userId,
      name: args.name,
      teacher: args.teacher,
      color: args.color,
      targetGrade: args.targetGrade,
      currentGrade: undefined,
      studyHours: 0,
      archived: false,
      createdAt: Date.now(),
    });
  },
});

export const updateSubject = mutation({
  args: {
    id: v.id("subjects"),
    name: v.optional(v.string()),
    teacher: v.optional(v.string()),
    color: v.optional(v.string()),
    targetGrade: v.optional(v.number()),
    currentGrade: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.teacher !== undefined) patch.teacher = args.teacher;
    if (args.color !== undefined) patch.color = args.color;
    if (args.targetGrade !== undefined) patch.targetGrade = args.targetGrade;
    if (args.currentGrade !== undefined) patch.currentGrade = args.currentGrade;
    await ctx.db.patch(args.id, patch);
  },
});

export const archiveSubject = mutation({
  args: { id: v.id("subjects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(args.id, { archived: true });
  },
});

/* ================================================================== */
/*  EXAMS                                                              */
/* ================================================================== */

export const listExams = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("exams")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const createExam = mutation({
  args: {
    subjectId: v.id("subjects"),
    title: v.string(),
    date: v.string(),
    time: v.optional(v.string()),
    location: v.optional(v.string()),
    importance: v.string(),
    targetGrade: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("exams", {
      userId,
      subjectId: args.subjectId,
      title: args.title,
      date: args.date,
      time: args.time,
      location: args.location,
      importance: args.importance,
      targetGrade: args.targetGrade,
      preparationProgress: 0,
      completed: false,
      actualGrade: undefined,
      archived: false,
      createdAt: Date.now(),
    });
  },
});

export const updateExam = mutation({
  args: {
    id: v.id("exams"),
    title: v.optional(v.string()),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    location: v.optional(v.string()),
    importance: v.optional(v.string()),
    targetGrade: v.optional(v.number()),
    preparationProgress: v.optional(v.number()),
    completed: v.optional(v.boolean()),
    actualGrade: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    for (const [k, v_] of Object.entries(args)) {
      if (k !== "id" && v_ !== undefined) patch[k] = v_;
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteExam = mutation({
  args: { id: v.id("exams") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  ASSIGNMENTS                                                        */
/* ================================================================== */

export const listAssignments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("assignments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const createAssignment = mutation({
  args: {
    subjectId: v.id("subjects"),
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.string(),
    difficulty: v.string(),
    estimatedMinutes: v.optional(v.number()),
    priority: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("assignments", {
      userId,
      subjectId: args.subjectId,
      title: args.title,
      description: args.description,
      dueDate: args.dueDate,
      difficulty: args.difficulty,
      estimatedMinutes: args.estimatedMinutes,
      status: "pending",
      priority: args.priority,
      completedAt: undefined,
      archived: false,
      createdAt: Date.now(),
    });
  },
});

export const updateAssignment = mutation({
  args: {
    id: v.id("assignments"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    difficulty: v.optional(v.string()),
    estimatedMinutes: v.optional(v.number()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    for (const [k, v_] of Object.entries(args)) {
      if (k !== "id" && v_ !== undefined) patch[k] = v_;
    }
    if (args.status === "completed") patch.completedAt = Date.now();
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteAssignment = mutation({
  args: { id: v.id("assignments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  GRADES                                                             */
/* ================================================================== */

export const listGrades = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("grades")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const createGrade = mutation({
  args: {
    subjectId: v.id("subjects"),
    title: v.string(),
    score: v.number(),
    maxScore: v.number(),
    weight: v.number(),
    date: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("grades", {
      userId,
      subjectId: args.subjectId,
      title: args.title,
      score: args.score,
      maxScore: args.maxScore,
      weight: args.weight,
      date: args.date,
      notes: args.notes,
      createdAt: Date.now(),
    });
  },
});

export const deleteGrade = mutation({
  args: { id: v.id("grades") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  STUDY SESSIONS                                                     */
/* ================================================================== */

export const listStudySessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("studySessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const createStudySession = mutation({
  args: {
    subjectId: v.optional(v.id("subjects")),
    title: v.optional(v.string()),
    plannedMinutes: v.number(),
    actualMinutes: v.number(),
    date: v.string(),
    completed: v.boolean(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Update subject study hours if linked
    if (args.subjectId && args.completed && args.actualMinutes > 0) {
      const subject = await ctx.db.get(args.subjectId);
      if (subject) {
        await ctx.db.patch(args.subjectId, {
          studyHours: subject.studyHours + args.actualMinutes,
        });
      }
    }
    const id = await ctx.db.insert("studySessions", {
      userId,
      subjectId: args.subjectId,
      title: args.title,
      plannedMinutes: args.plannedMinutes,
      actualMinutes: args.actualMinutes,
      date: args.date,
      completed: args.completed,
      type: args.type,
      createdAt: Date.now(),
    });
    // XP: completed study sessions earn focus XP (shared engine + daily cap).
    if (args.completed) {
      await handleFocusSession(
        ctx,
        { userId, _id: id, title: args.title, plannedMinutes: args.plannedMinutes, actualMinutes: args.actualMinutes, completed: args.completed },
        "جلسه مطالعه",
      );
    }
    return id;
  },
});

export const updateStudySession = mutation({
  args: {
    id: v.id("studySessions"),
    actualMinutes: v.optional(v.number()),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    if (args.actualMinutes !== undefined) patch.actualMinutes = args.actualMinutes;
    if (args.completed !== undefined) patch.completed = args.completed;
    await ctx.db.patch(args.id, patch);
    // XP: award/revoke when a study session's completion state changes.
    const nextCompleted = args.completed ?? doc.completed;
    const nextMinutes = args.actualMinutes ?? doc.actualMinutes;
    if (nextCompleted !== doc.completed || nextMinutes !== doc.actualMinutes) {
      await handleFocusSession(
        ctx,
        { userId, _id: args.id, title: doc.title ?? undefined, plannedMinutes: doc.plannedMinutes, actualMinutes: nextMinutes, completed: nextCompleted },
        "جلسه مطالعه",
      );
    }
  },
});

export const deleteStudySession = mutation({
  args: { id: v.id("studySessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  STUDENT NOTES                                                      */
/* ================================================================== */

export const listNotes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("studentNotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const createNote = mutation({
  args: {
    subjectId: v.optional(v.id("subjects")),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    noteType: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("studentNotes", {
      userId,
      subjectId: args.subjectId,
      title: args.title,
      content: args.content,
      tags: args.tags,
      isFavorite: false,
      noteType: args.noteType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateNote = mutation({
  args: {
    id: v.id("studentNotes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isFavorite: v.optional(v.boolean()),
    noteType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, v_] of Object.entries(args)) {
      if (k !== "id" && v_ !== undefined) patch[k] = v_;
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteNote = mutation({
  args: { id: v.id("studentNotes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});
