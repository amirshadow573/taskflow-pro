/**
 * Phase 10 smoke check — six realistic persona scenarios.
 * Temporary: run with `bun planning-smoke.ts`, then delete.
 */
import { computePlanning, type PlanningInput } from "@/lib/planning";
import { todayKey, addDaysKey } from "@/lib/task-utils";

const T = todayKey();
const D = (n: number) => addDaysKey(n);

const project = {
  _id: "p1",
  name: "پروژه نمونه",
  status: "active",
  deadline: D(3),
  goalRef: "personal:g1",
};
const goal = {
  ref: "personal:g1",
  kind: "personal",
  id: "g1",
  title: "هدف نمونه",
  description: null,
  dueDate: D(30),
  progress: 40,
  status: "active",
};

const task = (
  id: string,
  title: string,
  extra: Partial<PlanningInput["tasks"][number]> = {},
): PlanningInput["tasks"][number] => ({
  _id: id,
  title,
  status: "todo",
  priority: "medium",
  tags: [],
  ...extra,
});

function run(name: string, input: PlanningInput) {
  const a = computePlanning(input);
  const b = computePlanning(input);
  const ids = a.recommendations.map((r) => r.id);
  const dup = ids.length !== new Set(ids).size;
  const stable =
    JSON.stringify(ids) === JSON.stringify(b.recommendations.map((r) => r.id));
  const mutated = input.tasks.some(
    (t, i) => t.priority !== input.tasks[i].priority,
  );
  console.log(
    [
      `### ${name}`,
      `  workload: ${a.workload.state} (${a.workload.confidence}) — ${a.workload.explanation || "(empty state)"}`,
      `  buckets: must=${a.buckets.mustDo.length} should=${a.buckets.shouldDo.length} could=${a.buckets.couldDo.length} deferred=${a.buckets.deferred.length} blocked=${a.buckets.blocked.length}`,
      `  overdue=${a.snapshot.overdueCount} dueSoon=${a.snapshot.dueSoonCount} critical=${a.snapshot.criticalItems.length} blockers=${a.snapshot.blockers.length}`,
      `  next: ${a.nextAction ? `${a.nextAction.task.title} [${a.nextAction.reason}]` : "—"}`,
      `  priority(first): ${a.priorities[0] ? `${a.priorities[0].task.title} score=${a.priorities[0].attention.score} band=${a.priorities[0].attention.attention}` : "—"}`,
      `  recs: ${a.recommendations.map((r) => r.type).join(", ") || "(none)"}`,
      `  overload: ${a.overloadSignals.map((s) => s.key).join(",") || "-"}`,
      `  dupIds=${dup} stableAcrossRuns=${stable} userPriorityTouched=${mutated}`,
    ].join("\n"),
  );
}

/* 1 — Student: overdue assignment + exam in 2 days + study block */
run("student", {
  persona: "student",
  dayKey: T,
  tasks: [
    task("t1", "تکلیف ریاضی", { priority: "high", dueDate: D(-1) }),
    task("t2", "مرور فصل زیست", { dueDate: T, estimateMinutes: 60, projectId: "p1" }),
    task("t3", "حل تمرین فیزیک", { dueDate: D(1), priority: "low" }),
  ],
  projects: [project],
  goals: [goal],
  todayEvents: [{ _id: "e1", title: "کلاس زیست", type: "class", startTime: "10:00", endTime: "12:00" }],
  upcomingEvents: [{ _id: "e1", title: "کلاس زیست", type: "class", date: T }],
  timeBlocks: [{ title: "مطالعه", day: T, startTime: "14:00", endTime: "15:30", kind: "focus" }],
  personaItems: [
    { id: "exam:e1", title: "زیست‌شناسی", kind: "exam", label: "آزمون", dueDate: D(2), detail: "آمادگی ۳۰٪ ثبت شده" },
    { id: "assignment:a1", title: "گزارش ادبیات", kind: "assignment", label: "تکلیف", dueDate: D(1) },
  ],
  recentStudyMinutes: 0,
});

/* 2 — Employee: estimates + meeting + focus time */
run("employee", {
  persona: "employee",
  dayKey: T,
  tasks: [
    task("t1", "گزارش هفتگی", { dueDate: T, priority: "high", estimateMinutes: 90, projectId: "p1" }),
    task("t2", "بازبینی PR", { dueDate: T, estimateMinutes: 60 }),
    task("t3", "پاسخ به ایمیل‌ها", { priority: "low", estimateMinutes: 30 }),
  ],
  projects: [project],
  goals: [goal],
  todayEvents: [{ _id: "e1", title: "جلسه تیم", type: "meeting", startTime: "09:00", endTime: "10:00" }],
  upcomingEvents: [{ _id: "e1", title: "جلسه تیم", type: "meeting", date: T }],
  timeBlocks: [],
  meetingsToday: [{ title: "جلسه تیم", date: T, time: "09:00" }],
  focusPlannedMinutes: 120,
  personaItems: [],
});

/* 3 — Freelancer: overdue deliverable + unpaid invoice */
run("freelancer", {
  persona: "freelancer",
  dayKey: T,
  tasks: [
    task("t1", "نسخه نهایی سایت", { dueDate: T, priority: "urgent", projectId: "p1" }),
    task("t2", "پیش‌نویس قرارداد", { dueDate: D(5) }),
  ],
  projects: [project],
  goals: [goal],
  todayEvents: [],
  upcomingEvents: [],
  timeBlocks: [],
  personaItems: [
    { id: "deliverable:d1", title: "طراحی لوگو", kind: "deliverable", label: "تحویل", dueDate: D(-2) },
    { id: "invoice:i1", title: "صورتحساب پروژه", kind: "invoice", label: "صورتحساب", dueDate: D(1), detail: "۵٬۰۰۰٬۰۰۰ تومان — پیگیری طلب" },
  ],
});

/* 4 — Manager: at-risk project + milestone due soon */
run("manager", {
  persona: "manager",
  dayKey: T,
  tasks: [
    task("t1", "هم‌راستا کردن تیم", { dueDate: D(-3), priority: "high", projectId: "p1" }),
    task("t2", "مرور اسپرینت", { dueDate: T }),
    task("t3", "بازخورد به عضو تیم", { priority: "low" }),
  ],
  projects: [{ ...project, deadline: D(1) }],
  goals: [goal],
  todayEvents: [{ _id: "e1", title: "جلسه اسپرینت", type: "meeting", startTime: "11:00" }],
  upcomingEvents: [{ _id: "e1", title: "جلسه اسپرینت", type: "meeting", date: T }],
  timeBlocks: [],
  meetingsToday: [{ title: "جلسه اسپرینت", date: T, time: "11:00" }],
  personaItems: [
    { id: "milestone:m1", title: "انتشار نسخه ۱", kind: "milestone", label: "گام پروژه", dueDate: D(2), detail: "پیشرفت ۵۰٪" },
  ],
});

/* 5 — Business owner: initiative due soon + heavy load */
run("business_owner", {
  persona: "business_owner",
  dayKey: T,
  tasks: [
    task("t1", "پیگیری سرنخ فروش", { dueDate: T, priority: "urgent", estimateMinutes: 120, projectId: "p1" }),
    task("t2", "بررسی بودجه", { dueDate: T, estimateMinutes: 90 }),
    task("t3", "جلسه بازاریابی", { dueDate: T, estimateMinutes: 60 }),
    task("t4", "گزارش مالی", { dueDate: T, estimateMinutes: 180 }),
    task("t5", "برنامه هفته", { dueDate: T, estimateMinutes: 60 }),
  ],
  projects: [project],
  goals: [goal],
  todayEvents: [{ _id: "e1", title: "جلسه هیئت", type: "meeting", startTime: "08:00", endTime: "10:00" }],
  upcomingEvents: [{ _id: "e1", title: "جلسه هیئت", type: "meeting", date: T }],
  timeBlocks: [{ title: "بلوک استراتژی", day: T, startTime: "13:00", endTime: "15:00", kind: "focus" }],
  personaItems: [
    { id: "initiative:i1", title: "ورود به بازار جدید", kind: "initiative", label: "ابتکار", dueDate: D(4), detail: "پیشرفت ۲۰٪" },
  ],
});

/* 6 — Personal: paused project (blocked) + deferred + no calendar */
run("personal", {
  persona: "personal",
  dayKey: T,
  tasks: [
    task("t1", "تمیزکاری خانه", { dueDate: T, priority: "low" }),
    task("t2", "خرید هفتگی", { dueDate: T, tags: ["blocked"] }),
    task("t3", "ورزش صبح", { dueDate: D(2) }),
    task("t4", "کار پروژه متوقف", { dueDate: T, projectId: "p2" }),
  ],
  projects: [{ _id: "p2", name: "پروژه متوقف", status: "paused" }],
  goals: [],
  todayEvents: [],
  upcomingEvents: [],
  timeBlocks: [],
  personaItems: [],
});

/* 7 — Empty workspace → graceful, no fabrication */
run("empty", {
  persona: "personal",
  dayKey: T,
  tasks: [],
  projects: [],
  goals: [],
  todayEvents: [],
  upcomingEvents: [],
  timeBlocks: [],
  personaItems: [],
});

console.log("\nDONE");
