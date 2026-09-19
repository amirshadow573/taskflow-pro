import { useAuth } from "@/hooks/use-auth";
import {
  toFa,
  clampPercent,
  formatJalaliFull,
  dateKey,
  toJalaliDate,
  JALALI_MONTHS,
} from "@/lib/persian";
import {
  CheckCircle2,
  Circle,
  Flame,
  ListChecks,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { COLOR_HEX, COLOR_BG, colorOf, nextColorKey } from "@/lib/colors";

interface Props {
  onSignOut?: () => void;
}

/** Progress ring with animated stroke. */
function ProgressRing({
  pct,
  size = 168,
  stroke = 14,
  color = "#3b82f6",
  label,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = clampPercent(pct);
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="oklch(0.6 0.1 250 / 12%)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (p / 100) * c}
          style={{
            transition: "stroke-dashoffset 0.7s cubic-bezier(.22,1,.36,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div
            className="text-4xl font-extrabold tabular-nums"
            style={{ color }}
          >
            {toFa(p)}
            <span className="text-xl">٪</span>
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ onSignOut }: Props) {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);

  const routines = useQuery(api.routines.listRoutines, {});
  const items = useQuery(api.routines.listAllItems, {});
  const dayCheckins = useQuery(api.routines.listCheckinsForDay, {
    day: todayKey,
  });
  const stats = useQuery(api.routines.getStats, {
    day: todayKey,
    monthPrefix: todayKey.slice(0, 7),
    yearPrefix: todayKey.slice(0, 4),
  });

  const createRoutine = useMutation(api.routines.createRoutine);
  const deleteRoutine = useMutation(api.routines.deleteRoutine);
  const setRoutineColor = useMutation(api.routines.setRoutineColor);
  const createItem = useMutation(api.routines.createItem);
  const deleteItem = useMutation(api.routines.deleteItem);
  const toggleCheckin = useMutation(api.routines.toggleCheckin);

  const [newRoutineTitle, setNewRoutineTitle] = useState("");
  const [newItemTitles, setNewItemTitles] = useState<Record<string, string>>({});

  const loading =
    routines === undefined ||
    items === undefined ||
    dayCheckins === undefined ||
    stats === undefined;

  if (loading) {
    return (
      <div className="app-bg grid min-h-screen place-items-center">
        <div className="glass rounded-2xl px-8 py-6 text-sm text-muted-foreground">
          در حال بارگذاری…
        </div>
      </div>
    );
  }

  const itemsByRoutine = new Map<string, typeof items>();
  for (const it of items ?? []) {
    const arr = itemsByRoutine.get(it.routineId) ?? [];
    arr.push(it);
    itemsByRoutine.set(it.routineId, arr);
  }
  const doneSet = new Set(
    (dayCheckins ?? []).filter((c) => c.done).map((c) => c.itemId),
  );

  const handleAddRoutine = async () => {
    const t = newRoutineTitle.trim();
    if (!t) return;
    try {
      const palette: string[] = ["blue", "emerald", "amber", "rose", "violet", "cyan"];
      await createRoutine({
        title: t,
        colorKey: palette[(routines?.length ?? 0) % palette.length],
      });
      setNewRoutineTitle("");
      toast.success("مجموعه ساخته شد");
    } catch {
      toast.error("خطا در ساخت مجموعه");
    }
  };

  const handleAddItem = async (routineId: Id<"routines">) => {
    const t = (newItemTitles[routineId] ?? "").trim();
    if (!t) return;
    await createItem({ routineId, title: t });
    setNewItemTitles((s) => ({ ...s, [routineId]: "" }));
  };

  const handleToggle = async (itemId: Id<"routineItems">, done: boolean) => {
    try {
      await toggleCheckin({ itemId, day: todayKey, done });
    } catch {
      toast.error("در ثبت وضعیت خطایی رخ داد");
    }
  };

  const handleResetDay = async () => {
    try {
      for (const c of dayCheckins ?? []) {
        if (c.done) {
          await toggleCheckin({ itemId: c.itemId, day: todayKey, done: false });
        }
      }
      toast.success("امروز از نو شروع شد");
    } catch {
      toast.error("خطا در بازنشانی");
    }
  };

  const hour = today.getHours();
  const greeting =
    hour < 5
      ? "شب بخیر"
      : hour < 12
        ? "صبح بخیر"
        : hour < 17
          ? "وقت بخیر"
          : "شب بخیر";

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="glass sticky top-4 z-20 mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/25">
              <ListChecks className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold">روتین‌یار</h1>
              <p className="text-xs text-muted-foreground">
                {greeting}
                {user?.name ? `، ${user.name}` : ""} — {formatJalaliFull(today)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="glass-outline" size="sm" onClick={onSignOut}>
              خروج
            </Button>
          </div>
        </header>

        {/* Stats row */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="glass rounded-2xl p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Flame className="size-4 text-amber-500" />
              پیشرفت امروز
            </div>
            <div className="text-3xl font-extrabold tabular-nums text-blue-600">
              {toFa(stats?.dayPct ?? 0)}٪
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              از {toFa(items?.length ?? 0)} کار ثابت
            </p>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              پیشرفت این ماه
            </div>
            <div className="text-3xl font-extrabold tabular-nums text-emerald-600">
              {toFa(stats?.monthPct ?? 0)}٪
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {JALALI_MONTHS[toJalaliDate(today).jm - 1]}{" "}
              {toFa(toJalaliDate(today).jy)}
            </p>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span className="size-2 rounded-full bg-violet-500" />
              پیشرفت امسال
            </div>
            <div className="text-3xl font-extrabold tabular-nums text-violet-600">
              {toFa(stats?.yearPct ?? 0)}٪
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              سال {toFa(toJalaliDate(today).jy)}
            </p>
          </div>
        </section>

        {/* Progress ring + intro */}
        <section className="mb-8 flex flex-col items-center gap-4 rounded-2xl sm:flex-row sm:justify-between">
          <ProgressRing
            pct={stats?.dayPct ?? 0}
            label="کارهای امروز"
            color="#3b82f6"
          />
          <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-right">
            <h2 className="text-xl font-extrabold">کارهای ثابت امروز</h2>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              هر روز که وارد شوی، همین کارها منتظرت هستند. تیک بزن، پیشرفتت را
              ببین و روندت را حفظ کن.
            </p>
            <Button variant="glass" size="sm" onClick={handleResetDay}>
              <RotateCcw className="size-4" />
              شروع دوباره امروز
            </Button>
          </div>
        </section>

        {/* Routine sets */}
        <section className="space-y-5">
          {(routines ?? []).map((r) => {
            const ck = colorOf(r.colorKey);
            const hex = COLOR_HEX[ck];
            const rItems = itemsByRoutine.get(r._id) ?? [];
            const doneCount = rItems.filter((i) => doneSet.has(i._id)).length;
            const pct = clampPercent(
              rItems.length === 0 ? 0 : (doneCount / rItems.length) * 100,
            );
            return (
              <div key={r._id} className="glass overflow-hidden rounded-2xl">
                <div
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-white/50 px-5 py-4"
                  style={{
                    background: `linear-gradient(90deg, ${hex}14, transparent 60%)`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="size-3 rounded-full"
                      style={{ background: hex }}
                    />
                    <h3 className="font-bold">{r.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      {toFa(doneCount)} از {toFa(rItems.length)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-black/5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: hex }}
                      />
                    </div>
                    <span
                      className="w-10 text-left text-xs font-bold tabular-nums"
                      style={{ color: hex }}
                    >
                      {toFa(pct)}٪
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="تغییر رنگ"
                      onClick={() =>
                        setRoutineColor({
                          id: r._id,
                          colorKey: nextColorKey(r.colorKey),
                        })
                      }
                    >
                      <span
                        className={cn(
                          "size-4 rounded-full ring-2 ring-white/70",
                          COLOR_BG[ck],
                        )}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="حذف مجموعه"
                      onClick={() => {
                        if (confirm(`حذف «${r.title}» و همه کارهایش؟`)) {
                          deleteRoutine({ id: r._id });
                        }
                      }}
                    >
                      <Trash2 className="size-4 text-rose-500" />
                    </Button>
                  </div>
                </div>

                <ul className="space-y-1 px-2 py-2">
                  {rItems.length === 0 && (
                    <li className="px-3 py-4 text-sm text-muted-foreground">
                      هنوز کاری اضافه نشده است.
                    </li>
                  )}
                  {rItems.map((it) => {
                    const done = doneSet.has(it._id);
                    return (
                      <li
                        key={it._id}
                        className="glass-row group flex items-center gap-3 rounded-xl px-3 py-2.5"
                      >
                        <button
                          onClick={() => handleToggle(it._id, !done)}
                          className="grid size-6 shrink-0 place-items-center rounded-full border transition-all"
                          style={{
                            borderColor: done
                              ? hex
                              : "oklch(0.6 0.05 250 / 35%)",
                            background: done ? hex : "transparent",
                          }}
                          aria-pressed={done}
                        >
                          {done ? (
                            <CheckCircle2 className="size-4 text-white" />
                          ) : (
                            <Circle className="size-3.5 text-muted-foreground/50" />
                          )}
                        </button>
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            done && "text-muted-foreground line-through decoration-2",
                          )}
                        >
                          {it.title}
                        </span>
                        <button
                          onClick={() => deleteItem({ id: it._id })}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          title="حذف"
                        >
                          <Trash2 className="size-4 text-rose-400 hover:text-rose-600" />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex gap-2 px-4 pb-4">
                  <Input
                    value={newItemTitles[r._id] ?? ""}
                    onChange={(e) =>
                      setNewItemTitles((s) => ({ ...s, [r._id]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleAddItem(r._id)}
                    placeholder="کار جدید…"
                    className="glass-row border-0"
                  />
                  <Button
                    variant="glass"
                    size="icon"
                    onClick={() => handleAddItem(r._id)}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* New routine card */}
          <div className="glass-soft flex flex-wrap items-center gap-2 rounded-2xl p-4">
            <Input
              value={newRoutineTitle}
              onChange={(e) => setNewRoutineTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddRoutine()}
              placeholder="مجموعه جدید، مثلاً «روتین صبح»…"
              className="glass-row flex-1 border-0"
            />
            <Button onClick={handleAddRoutine}>
              <Plus className="size-4" />
              افزودن مجموعه
            </Button>
          </div>
        </section>

        <footer className="mt-12 pb-6 text-center text-xs text-muted-foreground">
          روتین‌یار — نسخه ۱ · پیگیری کارهای ثابت روزانه
        </footer>
      </div>
    </div>
  );
}
