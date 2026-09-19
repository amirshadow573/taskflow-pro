import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { toFa } from "@/lib/persian";
import { todayKey, addDaysKey } from "@/lib/task-utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { CheckCircle2, Flame, ListTodo, TrendingUp, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import type { Id } from "@/convex/_generated/dataModel";

const DAY_LABELS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export default function ProgressPage() {
  const { tasks, projects } = useWorkspace();

  const root = tasks.filter((t) => !t.parentId);
  const done = root.filter((t) => t.status === "done");

  const stats = useMemo(() => {
    // last 7 days completion counts
    const week: Array<{ day: string; label: string; count: number; created: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const key = addDaysKey(-i);
      const d = new Date(key + "T00:00:00");
      const label = DAY_LABELS[(d.getDay() + 1) % 7];
      week.push({
        day: key,
        label,
        count: done.filter((t) => t.dueDate === key).length,
        created: root.filter((t) => t.dueDate === key).length,
      });
    }

    // last 6 months completion
    const months: Array<{ label: string; count: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        label: prefix,
        count: done.filter((t) => t.dueDate?.startsWith(prefix)).length,
      });
    }

    // streak: consecutive days with >=1 completion ending today/yesterday
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const key = addDaysKey(-i);
      const has = done.some((t) => t.dueDate === key);
      if (has) streak += 1;
      else if (i > 0) break;
      else continue;
    }

    const createdCount = root.length;
    const completionRate = createdCount ? Math.round((done.length / createdCount) * 100) : 0;

    return {
      week,
      months,
      streak,
      createdCount,
      doneCount: done.length,
      completionRate,
      overdue: root.filter((t) => t.dueDate && t.dueDate < todayKey() && t.status !== "done").length,
    };
  }, [root, done]);

  const monthLabel = (prefix: string) => {
    const [, m] = prefix.split("-");
    const names = ["ژانویه","فوریه","مارس","آوریل","مه","ژوئن","ژوئیه","اوت","سپتامبر","اکتبر","نوامبر","دسامبر"];
    return names[Number(m) - 1];
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <TrendingUp className="size-6 text-primary" />
          پیشرفت و بهره‌وری
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          نگاهی به روند کارهای تکمیل‌شده و عادت‌های کاری‌ات.
        </p>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { icon: CheckCircle2, label: "انجام‌شده", value: stats.doneCount, color: "text-emerald-600" },
          { icon: ListTodo, label: "کل کارها", value: stats.createdCount, color: "text-foreground" },
          { icon: TrendingUp, label: "نرخ تکمیل", value: `${stats.completionRate}٪`, color: "text-primary" },
          { icon: Flame, label: "زنجیره روزها", value: stats.streak, color: "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-4 elev-1">
            <k.icon className={`mb-2 size-4 ${k.color}`} />
            <div className="text-2xl font-extrabold tabular-nums">{toFa(k.value)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly chart */}
      <section className="rounded-2xl border border-border bg-card p-5 elev-1">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold">بهره‌وری هفتگی</h2>
          <span className="text-[11px] text-muted-foreground">۷ روز گذشته</span>
        </div>
        <div className="h-56" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.week} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--foreground)", fontWeight: 700 }}
              />
              <Line
                type="monotone"
                dataKey="count"
                name="انجام‌شده"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--primary)" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Monthly + overdue */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 elev-1">
          <h2 className="mb-4 text-sm font-bold">روند ماهانه</h2>
          <div className="h-48" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.months.map((m) => ({ ...m, label: monthLabel(m.label) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" name="تکمیل‌شده" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-5 elev-1">
            <div className="flex items-center gap-2">
              <TriangleAlert className="size-4 text-destructive" />
              <h2 className="text-sm font-bold">کارهای عقب‌افتاده</h2>
            </div>
            <div className="mt-2 text-3xl font-extrabold tabular-nums text-destructive">
              {toFa(stats.overdue)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.overdue === 0
                ? "عالی! هیچ کاری عقب نیفتاده."
                : "بهتر است امروز یا فردا سراغشان بروی."}
            </p>
          </div>

          {/* Per-project breakdown */}
          <div className="rounded-2xl border border-border bg-card p-5 elev-1">
            <h2 className="mb-3 text-sm font-bold">پیشرفت پروژه‌ها</h2>
            <ul className="space-y-3">
              {projects.map((p) => {
                const pts = root.filter((t) => t.projectId === p._id);
                const dn = pts.filter((t) => t.status === "done").length;
                const pct = pts.length ? Math.round((dn / pts.length) * 100) : 0;
                return (
                  <li key={p._id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="size-2 rounded-sm" style={{ background: p.color }} />
                        {p.name}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {toFa(dn)}/{toFa(pts.length)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: p.color }}
                      />
                    </div>
                  </li>
                );
              })}
              {projects.length === 0 && (
                <li className="text-xs text-muted-foreground">پروژه‌ای وجود ندارد.</li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
