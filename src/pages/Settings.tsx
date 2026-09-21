import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Settings as SettingsIcon, User, Palette, Bell, Sun, Moon, Monitor, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { useUserProfile } from "@/hooks/use-user-profile";
import { ONBOARDING_PERSONAS, GOALS_BY_PERSONA, PLANNING_STYLES, PRODUCTIVITY_STYLES, buildDashboardConfig, type PersonaKey } from "@/lib/personas";
import { Check, Loader2 } from "lucide-react";

const ACCENTS: Array<{ key: string; color: string; label: string }> = [
  { key: "indigo", color: "#4f46e5", label: "بنفش آبی" },
  { key: "blue", color: "#2563eb", label: "آبی" },
  { key: "emerald", color: "#059669", label: "سبز" },
  { key: "amber", color: "#d97706", label: "کهربایی" },
  { key: "rose", color: "#e11d48", label: "رز" },
];

const START_PAGES = [
  { key: "/dashboard", label: "داشبورد" },
  { key: "/today", label: "امروز" },
  { key: "/inbox", label: "صندوق ورودی" },
  { key: "/projects", label: "پروژه‌ها" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const updateName = useMutation(api.profile.updateName);
  const upsertProfile = useMutation(api.userProfile.upsert);

  // ---- Personalization state (Phase 2) ----
  const { personaKey, goals: savedGoals, planningStyle: savedPlanning, productivityStyle: savedProductivity, onboardingCompleted } = useUserProfile();
  const [editPersona, setEditPersona] = useState<PersonaKey>(personaKey);
  const [editGoals, setEditGoals] = useState<string[]>(savedGoals);
  const [editPlanning, setEditPlanning] = useState<string | null>(savedPlanning);
  const [editProductivity, setEditProductivity] = useState<string | null>(savedProductivity);
  const [savingPersonalization, setSavingPersonalization] = useState(false);

  // Keep local editors in sync when the saved profile loads/changes.
  // Guarded setters (bail out when unchanged) prevent render loops from
  // fresh array identities while the profile is still loading.
  useEffect(() => {
    setEditPersona((cur) => (cur === personaKey ? cur : personaKey));
    setEditGoals((cur) => (JSON.stringify(cur) === JSON.stringify(savedGoals) ? cur : savedGoals));
    setEditPlanning((cur) => (cur === savedPlanning ? cur : savedPlanning));
    setEditProductivity((cur) => (cur === savedProductivity ? cur : savedProductivity));
  }, [personaKey, savedGoals, savedPlanning, savedProductivity]);

  const [name, setName] = useState(user?.name ?? "");
  const [theme, setTheme] = useState<"light" | "dark">(
    () =>
      (localStorage.getItem("taskly-theme") as "light" | "dark") ??
      (document.documentElement.classList.contains("dark") ? "dark" : "light"),
  );
  const [accent, setAccent] = useState(
    () => localStorage.getItem("taskly-accent") ?? "indigo",
  );
  const [startPage, setStartPage] = useState(
    () => localStorage.getItem("taskly-start") ?? "/dashboard",
  );
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("taskly-notifs") ?? "") as Record<string, boolean>;
    } catch {
      return { overdue: true, today: true, project: false };
    }
  });

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  const applyTheme = (t: "light" | "dark") => {
    setTheme(t);
    localStorage.setItem("taskly-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  const applyAccent = (key: string, color: string) => {
    setAccent(key);
    localStorage.setItem("taskly-accent", key);
    document.documentElement.style.setProperty("--primary", color);
    document.documentElement.style.setProperty("--ring", color);
  };

  const saveName = async () => {
    if (!name.trim()) return;
    try {
      await updateName({ name });
      toast.success("نام ذخیره شد");
    } catch {
      toast.error("ذخیره نام ناموفق بود.");
    }
  };

  const saveStart = (v: string) => {
    setStartPage(v);
    localStorage.setItem("taskly-start", v);
    toast.success("صفحه شروع ذخیره شد");
  };

  const toggleNotif = (key: string) => {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    localStorage.setItem("taskly-notifs", JSON.stringify(next));
  };

  /** Re-generate the dashboard configuration from the edited answers. */
  const savePersonalization = async () => {
    setSavingPersonalization(true);
    try {
      const config = buildDashboardConfig({
        personaKey: editPersona,
        goals: editGoals,
        workStyle: {
          planningStyle: (editPlanning ?? null) as never,
          productivityStyle: (editProductivity ?? null) as never,
        },
      });
      await upsertProfile({
        personaKey: editPersona,
        personaSource: "settings",
        goals: editGoals,
        workStyle: editPlanning ?? undefined,
        productivityStyle: editProductivity ?? undefined,
        dashboardConfig: JSON.stringify(config),
        completedOnboarding: true,
      });
      toast.success("شخصی‌سازی ذخیره و داشبورد بازسازی شد");
    } catch {
      toast.error("ذخیره شخصی‌سازی ناموفق بود.");
    } finally {
      setSavingPersonalization(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <SettingsIcon className="size-6 text-primary" />
          تنظیمات
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          فضای کاری‌ات را شخصی‌سازی کن. همه چیز اختیاری است.
        </p>
      </header>

      {/* Profile */}
      <section className="ui-surface rounded-2xl p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
          <User className="size-4 text-primary" />
          پروفایل
        </h2>
        <label className="block text-xs font-semibold text-muted-foreground">
          نام نمایشی
          <div className="mt-1.5 flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نام تو"
              className="bg-background"
            />
            <Button onClick={saveName} disabled={!name.trim() || name === (user?.name ?? "")}>
              ذخیره
            </Button>
          </div>
        </label>
      </section>

      {/* Personalization (Phase 2) */}
      <section className="ui-surface rounded-2xl p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <Sparkles className="size-4 text-primary" />
          شخصی‌سازی
        </h2>
        <p className="mb-4 text-[11px] leading-5 text-muted-foreground">
          نقش، اهداف و سبک کاری‌ات را به‌روز کن — داشبورد متناسب با آن‌ها بازسازی
          می‌شود. هیچ داده‌ای حذف نمی‌شود.
        </p>

        <span className="mb-2 block text-xs font-semibold text-muted-foreground">نقش من</span>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="نقش من">
          {ONBOARDING_PERSONAS.map((p) => (
            <button
              key={p.key}
              role="radio"
              aria-checked={editPersona === p.key}
              onClick={() => setEditPersona(p.key)}
              className={cn(
                "flex items-start gap-2.5 rounded-2xl border p-3 text-start transition-all duration-200",
                editPersona === p.key
                  ? "border-primary/50 bg-accent/70 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                  : "border-border/70 bg-white/50 hover:border-primary/30 hover:bg-white/80 dark:bg-white/5",
              )}
            >
              <span className="text-xl">{p.emoji}</span>
              <span className="min-w-0">
                <span className="block text-xs font-bold">{p.label}</span>
                <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">{p.description}</span>
              </span>
            </button>
          ))}
        </div>

        <span className="mb-2 mt-5 block text-xs font-semibold text-muted-foreground">اهداف من</span>
        <div className="flex flex-wrap gap-1.5">
          {(GOALS_BY_PERSONA[editPersona] ?? []).map((g) => {
            const selected = editGoals.includes(g.key);
            return (
              <button
                key={g.key}
                onClick={() => setEditGoals((gs) => (gs.includes(g.key) ? gs.filter((k) => k !== g.key) : [...gs, g.key]))}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                  selected
                    ? "border-transparent bg-gradient-to-l from-primary to-[#5B5FE6] text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]"
                    : "border-border/70 bg-white/60 hover:border-primary/30 hover:bg-white/90 dark:bg-white/5",
                )}
              >
                {selected && <Check className="size-3" strokeWidth={3} />}
                {g.label}
              </button>
            );
          })}
        </div>

        <span className="mb-2 mt-5 block text-xs font-semibold text-muted-foreground">روش برنامه‌ریزی</span>
        <div className="flex flex-wrap gap-1.5">
          {PLANNING_STYLES.map((s) => (
            <button
              key={s.key}
              onClick={() => setEditPlanning(s.key)}
              aria-pressed={editPlanning === s.key}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                editPlanning === s.key ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <span className="mb-2 mt-4 block text-xs font-semibold text-muted-foreground">سبک بهره‌وری</span>
        <div className="flex flex-wrap gap-1.5">
          {PRODUCTIVITY_STYLES.map((s) => (
            <button
              key={s.key}
              onClick={() => setEditProductivity(s.key)}
              aria-pressed={editProductivity === s.key}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                editProductivity === s.key ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {!onboardingCompleted && (
            <button
              onClick={() => navigate("/onboarding")}
              className="text-xs font-bold text-primary hover:underline"
            >
              تکمیل رویه شخصی‌سازی
            </button>
          )}
          <Button
            className="ms-auto"
            onClick={savePersonalization}
            disabled={savingPersonalization || editGoals.length === 0}
          >
            {savingPersonalization && <Loader2 className="size-4 animate-spin" />}
            ذخیره و بازسازی داشبورد
          </Button>
        </div>
      </section>

      {/* Appearance */}
      <section className="ui-surface rounded-2xl p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
          <Palette className="size-4 text-primary" />
          ظاهر
        </h2>

        <div className="space-y-4">
          <div>
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">
              پوسته
            </span>
            <div className="flex gap-2">
              {[
                { key: "light" as const, label: "روشن", icon: Sun },
                { key: "dark" as const, label: "تیره", icon: Moon },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => applyTheme(t.key)}
                  aria-pressed={theme === t.key}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
                    theme === t.key
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <t.icon className="size-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">
              رنگ اصلی
            </span>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => applyAccent(a.key, a.color)}
                  aria-label={`رنگ ${a.label}`}
                  aria-pressed={accent === a.key}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                    accent === a.key ? "border-primary bg-accent" : "border-border hover:bg-muted",
                  )}
                >
                  <span className="size-4 rounded-full" style={{ background: a.color }} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">
              صفحه شروع
            </span>
            <div className="flex flex-wrap gap-2">
              {START_PAGES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => saveStart(p.key)}
                  aria-pressed={startPage === p.key}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                    startPage === p.key
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="ui-surface rounded-2xl p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
          <Bell className="size-4 text-primary" />
          اعلان‌ها
        </h2>
        <ul className="space-y-2">
          {[
            { key: "overdue", label: "کارهای عقب‌افتاده", desc: "هر روز صبح بهم یادآوری کن" },
            { key: "today", label: "کارهای امروز", desc: "خلاصه روز را نشان بده" },
            { key: "project", label: "به‌روزرسانی پروژه‌ها", desc: "تغییرات مهم پروژه‌ها" },
          ].map((n) => (
            <li
              key={n.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold">{n.label}</p>
                <p className="text-[11px] text-muted-foreground">{n.desc}</p>
              </div>
              <button
                role="switch"
                aria-checked={!!notifPrefs[n.key]}
                aria-label={n.label}
                onClick={() => toggleNotif(n.key)}
                className={cn(
                  "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                  notifPrefs[n.key] ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
                    notifPrefs[n.key] ? "start-4.5" : "start-0.5",
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        <Monitor className="me-1 inline size-3.5" />
        تنظیمات روی همین دستگاه ذخیره می‌شود.
      </p>
    </div>
  );
}
