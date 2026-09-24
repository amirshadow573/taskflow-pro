/**
 * Persona spotlight — Phase 09.
 *
 * The ONE module that makes each workspace feel genuinely different, while the
 * foundation (Today / Next Action / Progress) stays shared. It reads the real
 * persona data (exams, meetings, deliverables, team goals, revenue/expenses,
 * habits) and returns null when there is nothing relevant — so a Manager never
 * sees exam cards and a Student never sees finance cards.
 */
import { useQuery } from "convex/react";
import { useMemo } from "react";
import {
  Banknote,
  Briefcase,
  CalendarClock,
  FileText,
  GraduationCap,
  Receipt,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useUserProfile } from "@/hooks/use-user-profile";
import { Bar, Panel, Pill } from "@/components/progress/progress-ui";
import { todayKey, addDaysKey } from "@/lib/task-utils";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";

function dayDiffLabel(day: string): string {
  const t = todayKey();
  if (day === t) return "امروز";
  if (day === addDaysKey(1)) return "فردا";
  if (day === addDaysKey(2)) return "پس‌فردا";
  return toFa(day.slice(5).replace("-", "/"));
}

function Line({
  icon: Icon,
  text,
  meta,
  tone = "slate",
}: {
  icon: LucideIcon;
  text: string;
  meta?: string;
  tone?: "slate" | "blue" | "emerald" | "amber" | "rose" | "violet";
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-white/50 px-3 py-2 dark:bg-white/5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{text}</span>
      {meta && <Pill toneKey={tone}>{meta}</Pill>}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Student — exams + assignments                                       */
/* ------------------------------------------------------------------ */
function StudentSpotlight() {
  const exams = useQuery(api.student.listExams);
  const assignments = useQuery(api.student.listAssignments);
  const t = todayKey();

  const upcomingExams = (exams ?? [])
    .filter((e) => !e.completed && e.date >= t)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);
  const openAssignments = (assignments ?? [])
    .filter((a) => a.status !== "completed" && a.dueDate >= t)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 2);

  if (upcomingExams.length === 0 && openAssignments.length === 0) return null;

  return (
    <Panel
      title="درس و آزمون"
      icon={<GraduationCap className="size-4 text-blue-600" aria-hidden />}
      description="نزدیک‌ترین امتحان‌ها و تکالیف باقی‌مانده"
    >
      <ul className="space-y-2">
        {upcomingExams.map((e) => (
          <Line
            key={e._id}
            icon={CalendarClock}
            text={e.title}
            meta={`امتحان · ${dayDiffLabel(e.date)}`}
            tone="violet"
          />
        ))}
        {openAssignments.map((a) => (
          <Line
            key={a._id}
            icon={FileText}
            text={a.title}
            meta={`تکلیف · ${dayDiffLabel(a.dueDate)}`}
            tone={a.priority === "high" ? "rose" : "amber"}
          />
        ))}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Employee — meetings + today's focus time                            */
/* ------------------------------------------------------------------ */
function EmployeeSpotlight() {
  const meetings = useQuery(api.employee.listMyMeetings);
  const sessions = useQuery(api.employee.listFocusSessions);
  const t = todayKey();

  const upcoming = (meetings ?? [])
    .filter((m) => m.date >= t)
    .sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`))
    .slice(0, 3);
  const focusToday = (sessions ?? [])
    .filter((s) => s.date === t)
    .reduce((n, s) => n + s.actualMinutes, 0);

  if (upcoming.length === 0 && focusToday === 0) return null;

  return (
    <Panel
      title="کار امروز"
      icon={<Briefcase className="size-4 text-cyan-600" aria-hidden />}
      description="جلسات نزدیک و زمان تمرکز امروز"
      action={
        focusToday > 0 ? (
          <Pill toneKey="emerald">
            <Timer className="size-3" aria-hidden />
            {toFa(Math.round(focusToday / 6) / 10)} ساعت تمرکز
          </Pill>
        ) : undefined
      }
    >
      <ul className="space-y-2">
        {upcoming.map((m) => (
          <Line
            key={m._id}
            icon={CalendarClock}
            text={m.title}
            meta={`${dayDiffLabel(m.date)}${m.time ? ` · ${toFa(m.time)}` : ""}`}
            tone={m.date === t ? "blue" : "slate"}
          />
        ))}
        {upcoming.length === 0 && focusToday > 0 && (
          <li className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
            جلسه‌ای ثبت نشده — {toFa(Math.round(focusToday / 6) / 10)} ساعت تمرکز ثبت شده.
          </li>
        )}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Freelancer — deliverables + invoices                                */
/* ------------------------------------------------------------------ */
function FreelancerSpotlight() {
  const deliverables = useQuery(api.freelancer.listDeliverables);
  const invoices = useQuery(api.freelancer.listInvoices);
  const t = todayKey();

  const open = (deliverables ?? [])
    .filter((d) => d.status !== "delivered" && d.status !== "approved")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
  const unpaid = (invoices ?? []).filter(
    (i) => i.status !== "paid" && i.status !== "cancelled" && i.dueDate < t,
  );

  if (open.length === 0 && unpaid.length === 0) return null;

  return (
    <Panel
      title="کار مشتریان"
      icon={<Briefcase className="size-4 text-violet-600" aria-hidden />}
      description="تحویل‌های نزدیک و پیگیری‌های مالی"
      action={
        unpaid.length > 0 ? (
          <Pill toneKey="rose">
            <Receipt className="size-3" aria-hidden />
            {toFa(unpaid.length)} صورتحساب
          </Pill>
        ) : undefined
      }
    >
      <ul className="space-y-2">
        {open.map((d) => (
          <Line
            key={d._id}
            icon={Briefcase}
            text={d.title}
            meta={`${dayDiffLabel(d.dueDate)}${d.priority === "urgent" ? " · فوری" : ""}`}
            tone={
              d.dueDate < t ? "rose" : d.dueDate === t ? "amber" : "blue"
            }
          />
        ))}
        {open.length === 0 && unpaid.length > 0 && (
          <li className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-[11px] text-muted-foreground">
            {toFa(unpaid.length)} صورتحساب از موعد گذشته — پیگیری کن.
          </li>
        )}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Manager — team goals + meetings (never an individual task board)    */
/* ------------------------------------------------------------------ */
function ManagerSpotlight() {
  const goals = useQuery(api.manager.listTeamGoals, {});
  const meetings = useQuery(api.manager.listMeetings, {});
  const t = todayKey();

  const activeGoals = (goals ?? []).filter((g) => g.status !== "completed").slice(0, 3);
  const upcoming = (meetings ?? [])
    .filter((m) => m.date >= t)
    .sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`))
    .slice(0, 2);

  if (activeGoals.length === 0 && upcoming.length === 0) return null;

  return (
    <Panel
      title="تیم"
      icon={<Users className="size-4 text-emerald-600" aria-hidden />}
      description="اهداف تیمی و جلسات پیش رو"
    >
      <ul className="space-y-2.5">
        {activeGoals.map((g) => (
          <li
            key={g._id}
            className="rounded-xl border border-border/60 bg-white/50 px-3 py-2 dark:bg-white/5"
          >
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate font-bold">{g.title}</span>
              <span className="shrink-0 tabular-nums font-bold text-muted-foreground">
                {toFa(g.progress)}٪
              </span>
            </div>
            <Bar
              pct={g.progress}
              toneKey={g.status === "at_risk" ? "rose" : "emerald"}
              className="mt-1.5 h-1.5"
            />
          </li>
        ))}
        {upcoming.map((m) => (
          <Line
            key={m._id}
            icon={CalendarClock}
            text={m.title}
            meta={`${dayDiffLabel(m.date)}${m.time ? ` · ${toFa(m.time)}` : ""}`}
            tone="blue"
          />
        ))}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Business Owner — decisions first, progression stays secondary       */
/* ------------------------------------------------------------------ */
function BusinessSpotlight() {
  const revenue = useQuery(api.business.listRevenue);
  const expenses = useQuery(api.business.listExpenses);
  const t = todayKey();
  const weekAgo = addDaysKey(-6);

  const sums = useMemo(() => {
    const sum = (
      rows: Array<{ amount: number; date: string; status?: string }> | undefined,
      from: string,
      skipCancelled = true,
    ) =>
      (rows ?? [])
        .filter((r) => r.date >= from)
        .filter((r) => (skipCancelled ? r.status !== "cancelled" : true))
        .reduce((n, r) => n + r.amount, 0);
    return {
      todayIn: sum(revenue, t, false),
      todayOut: sum(expenses, t),
      weekIn: sum(revenue, weekAgo),
      weekOut: sum(expenses, weekAgo),
    };
  }, [revenue, expenses, t, weekAgo]);

  if (
    (revenue ?? []).length === 0 &&
    (expenses ?? []).length === 0
  ) {
    return null;
  }

  const net = sums.todayIn - sums.todayOut;

  return (
    <Panel
      title="سلامت کسب‌وکار"
      icon={<Wallet className="size-4 text-emerald-600" aria-hidden />}
      description="تصمیم‌های امروز بر پایه اعداد واقعی"
    >
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-border/60 bg-white/50 px-2 py-2.5 dark:bg-white/5">
          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <TrendingUp className="size-3 text-emerald-500" aria-hidden />
            درآمد امروز
          </div>
          <div className="mt-1 text-sm font-extrabold tabular-nums">
            {toFa(Math.round(sums.todayIn))}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-white/50 px-2 py-2.5 dark:bg-white/5">
          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <TrendingDown className="size-3 text-rose-500" aria-hidden />
            هزینه امروز
          </div>
          <div className="mt-1 text-sm font-extrabold tabular-nums">
            {toFa(Math.round(sums.todayOut))}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-white/50 px-2 py-2.5 dark:bg-white/5">
          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <Banknote className="size-3 text-primary" aria-hidden />
            خالص امروز
          </div>
          <div
            className={cn(
              "mt-1 text-sm font-extrabold tabular-nums",
              net >= 0 ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {toFa(Math.round(net))}
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-[11px] text-muted-foreground">
        ۷ روز اخیر: درآمد {toFa(Math.round(sums.weekIn))} · هزینه{" "}
        {toFa(Math.round(sums.weekOut))}
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Personal Productivity — habits + next time block                    */
/* ------------------------------------------------------------------ */
function PersonalSpotlight() {
  const habits = useQuery(api.personal.habitsState, { day: todayKey() });
  const blocks = useQuery(api.personal.listTimeBlocks, { day: todayKey() });
  const list = habits ?? [];
  const done = list.filter((h) => h.doneToday).length;
  const nextBlock = (blocks ?? [])
    .filter((b) => b.endTime >= new Date().toTimeString().slice(0, 5))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

  if (list.length === 0 && !nextBlock) return null;

  return (
    <Panel
      title="عادت‌ها و بلوک زمانی"
      icon={<Timer className="size-4 text-violet-600" aria-hidden />}
      description={nextBlock ? `بلوک بعدی: ${nextBlock.title}` : undefined}
      action={
        list.length > 0 ? (
          <Pill toneKey={done === list.length ? "emerald" : "violet"}>
            {toFa(done)}/{toFa(list.length)}
          </Pill>
        ) : undefined
      }
    >
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.slice(0, 6).map((h) => (
            <span
              key={h._id}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold",
                h.doneToday
                  ? "border-emerald-200/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-border/60 text-muted-foreground",
              )}
            >
              {h.title}
              {h.streak > 0 && (
                <span className="tabular-nums text-[10px] opacity-70">
                  {toFa(h.streak)} روز
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      {nextBlock && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CalendarClock className="size-3.5" aria-hidden />
          {toFa(nextBlock.startTime)} – {toFa(nextBlock.endTime)}
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

export function PersonaSpotlight() {
  const { personaKey } = useUserProfile();
  switch (personaKey) {
    case "student":
      return <StudentSpotlight />;
    case "employee":
      return <EmployeeSpotlight />;
    case "freelancer":
      return <FreelancerSpotlight />;
    case "manager":
    case "team":
      return <ManagerSpotlight />;
    case "business_owner":
      return <BusinessSpotlight />;
    default:
      return <PersonalSpotlight />;
  }
}
