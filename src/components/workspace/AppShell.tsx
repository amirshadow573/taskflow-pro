import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { NAV_EMPHASIS, MOBILE_NAV_PER_PERSONA } from "@/lib/personas";
import { readTheme, writeTheme } from "@/lib/preferences";
import {
  Bell,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  CircleDot,
  Clock,
  FileJson,
  Lightbulb,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Lock,
  LogOut,
  Menu,
  Rows3,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  HelpCircle,
  Trophy,
  X,
} from "lucide-react";
import { UnlockHint } from "@/components/progress/UnlockCenter";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  /** Marks a planned capability (renders a «به‌زودی» pill, never a route to a fake feature). */
  preview?: boolean;
}

/** A nav item resolved for rendering: the base item plus persona emphasis. */
type NavEntry = NavItem & { emphasized?: boolean };

/**
 * ONE SOURCE OF TRUTH FOR APPLICATION NAVIGATION.
 *
 * The desktop sidebar, the collapsed rail and the mobile hamburger drawer
 * all read from these two arrays — never a private copy — so a new section
 * is added in exactly one place and every surface stays in sync.
 */
const PRIMARY_NAV: NavItem[] = [
  { to: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { to: "/today", label: "امروز", icon: ListChecks },
  { to: "/inbox", label: "صندوق ورودی", icon: Inbox },
  { to: "/tasks", label: "کارهای من", icon: CircleDot },
  { to: "/projects", label: "پروژه‌ها", icon: FolderKanban },
  { to: "/calendar", label: "تقویم", icon: CalendarDays },
  // برنامه زمانی — visual day/week time grid over the same schedule
  { to: "/timeline", label: "برنامه زمانی", icon: Rows3 },
  { to: "/planning", label: "برنامه‌ریزی", icon: Clock },
  // Phase 10.5 — persona-aware import of a plan from the user's own external AI
  { to: "/ai-planning", label: "برنامه با AI", icon: FileJson },
  // Phase 16 — evidence-based AI insights (advanced group, not primary nav)
  { to: "/ai-insights", label: "بینش‌های هوشمند", icon: Lightbulb },
  // پیشرفت من = level / XP / stats / skills / quests / achievements / unlocks
  { to: "/progress", label: "پیشرفت من", icon: Trophy },
  { to: "/analytics", label: "تحلیل", icon: LineChart },
  // قابلیت‌های آینده — preview surface for planned (disabled) capabilities
  { to: "/future", label: "آیندهٔ محصول", icon: Sparkles, preview: true },
  { to: "/settings", label: "تنظیمات", icon: Settings },
];

/**
 * Utility destinations. They live in the sidebar footer on desktop and in the
 * tail of the mobile drawer — again from a single array.
 */
const SECONDARY_NAV: NavItem[] = [{ to: "/help", label: "راهنما", icon: HelpCircle }];

/** Every route the navigation can reach, used for the mobile page title. */
const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

/**
 * Phase 09 navigation grouping — the sidebar is NOT a feature catalogue.
 * Core = daily execution, Progress = progression systems (one hub, not five
 * top-level items), Advanced = optional analysis/settings.
 */
const NAV_GROUPS: { label: string; paths: string[] }[] = [
  {
    label: "روزمره",
    paths: ["/dashboard", "/today", "/inbox", "/tasks", "/projects", "/calendar", "/timeline", "/planning", "/ai-planning"],
  },
  { label: "پیشرفت", paths: ["/progress"] },
  { label: "پیشرفته", paths: ["/analytics", "/ai-insights", "/future", "/settings"] },
];

/** Persona-specific ordering inside the "روزمره" group (priorities first). */
const CORE_ORDER_PER_PERSONA: Record<string, string[]> = {
  student: ["/today", "/dashboard", "/calendar", "/timeline", "/tasks", "/projects", "/planning", "/ai-planning", "/inbox"],
  employee: ["/today", "/tasks", "/calendar", "/timeline", "/projects", "/dashboard", "/planning", "/ai-planning", "/inbox"],
  freelancer: ["/today", "/projects", "/tasks", "/calendar", "/timeline", "/dashboard", "/ai-planning", "/inbox", "/planning"],
  manager: ["/dashboard", "/today", "/projects", "/calendar", "/timeline", "/tasks", "/planning", "/ai-planning", "/inbox"],
  business_owner: ["/dashboard", "/today", "/projects", "/calendar", "/timeline", "/tasks", "/planning", "/ai-planning", "/inbox"],
  personal: ["/today", "/tasks", "/dashboard", "/timeline", "/projects", "/calendar", "/planning", "/ai-planning", "/inbox"],
  team: ["/dashboard", "/today", "/projects", "/calendar", "/timeline", "/tasks", "/planning", "/ai-planning", "/inbox"],
  custom: ["/today", "/dashboard", "/tasks", "/timeline", "/projects", "/calendar", "/planning", "/ai-planning", "/inbox"],
};

/** Touch-target floor for every navigation row (WCAG / mobile ergonomics). */
const ROW_CLASS =
  "flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold transition-all duration-200 md:min-h-0";

/** Active / idle row treatment, shared by the sidebar and the mobile drawer. */
const rowTone = (isActive: boolean) =>
  isActive
    ? "ui-nav-active"
    : "text-muted-foreground hover:bg-primary/10 hover:text-foreground dark:hover:bg-white/5";

/**
 * One navigation row — rendered by the expanded sidebar, the collapsed rail
 * and the mobile hamburger drawer. Defined at module scope (not during render)
 * so React never sees a new component type on every render.
 */
function NavRow({
  item,
  compact = false,
  analyticsLocked = false,
  onNavigate,
}: {
  item: NavEntry;
  compact?: boolean;
  analyticsLocked?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      title={compact ? item.label : undefined}
      onClick={onNavigate}
      className={({ isActive }) => cn(ROW_CLASS, compact && "justify-center px-0", rowTone(isActive))}
    >
      <item.icon className="size-4.5 shrink-0" />
      {!compact && (
        <>
          <span className={cn("flex-1 truncate", item.emphasized && "text-foreground")}>{item.label}</span>
          {item.emphasized && (
            <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          )}
          {item.badge !== undefined && item.badge > 0 && (
            <span className="min-w-5 rounded-full bg-gradient-to-l from-primary to-[#5B5FE6] px-1.5 text-center text-[10px] font-bold leading-5 text-white shadow-[0_3px_10px_-4px_rgba(37,99,235,0.9)]">
              {toFa(item.badge)}
            </span>
          )}
          {item.preview && (
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground dark:bg-white/10">
              به‌زودی
            </span>
          )}
          {item.to === "/analytics" && analyticsLocked && (
            <span
              title="تحلیل پیشرفته هنوز باز نشده"
              aria-label="تحلیل پیشرفته هنوز باز نشده است"
              className="grid size-4 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground dark:bg-white/10"
            >
              <Lock className="size-2.5" aria-hidden="true" />
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/** Theme controller — backed by the shared preferences store (audit fix). */
export function useTheme() {
  const [dark, setDark] = useState(() => readTheme() === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const toggle = () =>
    setDark((d) => {
      writeTheme(d ? "light" : "dark");
      return !d;
    });
  return { dark, toggle };
}

export function AppShell({
  children,
  inboxCount,
  overdueCount,
  notifications,
}: {
  children: React.ReactNode;
  inboxCount: number;
  overdueCount: number;
  notifications: Array<{ id: string; title: string; body: string; tone: "warning" | "info" | "danger" }>;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { personaKey } = useUserProfile();
  const { pathname } = useLocation();
  // Centralized capability map — subtle lock hints on gated nav items only.
  const capabilities = useQuery(api.unlocks.capabilities);
  const analyticsLocked = capabilities?.analytics === false;

  // Persona-aware nav: all items always visible, boosted paths get a visual dot
  const emphasized = useMemo(() => new Set(NAV_EMPHASIS[personaKey] ?? []), [personaKey]);
  const entries = useMemo<NavEntry[]>(
    () =>
      PRIMARY_NAV.map((n) => ({
        ...n,
        badge: n.to === "/inbox" ? inboxCount : undefined,
        emphasized: emphasized.has(n.to),
      })),
    [emphasized, inboxCount],
  );
  const secondaryEntries = useMemo<NavEntry[]>(
    () => SECONDARY_NAV.map((n) => ({ ...n, emphasized: emphasized.has(n.to) })),
    [emphasized],
  );

  /** Groups resolved + persona-ordered — used by BOTH the sidebar and the drawer. */
  const orderedGroups = useMemo(() => {
    const order = CORE_ORDER_PER_PERSONA[personaKey];
    return NAV_GROUPS.map((group) => {
      const items = group.paths
        .map((p) => entries.find((n) => n.to === p))
        .filter(Boolean) as NavEntry[];
      return {
        label: group.label,
        items:
          group.label === "روزمره" && order
            ? [...items].sort((a, b) => order.indexOf(a.to) - order.indexOf(b.to))
            : items,
      };
    }).filter((group) => group.items.length > 0);
  }, [entries, personaKey]);

  // Persona-specific mobile bottom nav (unchanged: a quick 5-item rail)
  const mobilePaths = MOBILE_NAV_PER_PERSONA[personaKey] ?? MOBILE_NAV_PER_PERSONA.personal;
  const mobileNavItems = useMemo(
    () => mobilePaths.map((path) => PRIMARY_NAV.find((n) => n.to === path)).filter(Boolean) as NavItem[],
    [personaKey],
  );

  /** Current page label for the mobile header — derived from the nav config. */
  const pageTitle = useMemo(() => {
    const match =
      ALL_NAV.find((n) => pathname === n.to) ??
      ALL_NAV.find((n) => n.to !== "/dashboard" && pathname.startsWith(`${n.to}/`));
    return match?.label ?? "تسک‌لی";
  }, [pathname]);

  const signOutAndExit = async () => {
    setNavOpen(false);
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex h-svh overflow-hidden bg-app-bg">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "app-chrome hidden shrink-0 flex-col border-e border-border/60 shadow-[0_0_40px_-28px_rgba(37,99,235,0.35)] transition-[width,box-shadow] duration-200 md:flex",
          collapsed ? "w-[72px]" : "w-[272px]",
        )}
      >          <div className={cn("flex h-16 items-center gap-2 border-b border-border/60 px-4", collapsed && "justify-center px-0")}>
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-[#5B5FE6] text-white shadow-md shadow-primary/20">
            <ListChecks className="size-4" />
          </div>
          {!collapsed && <span className="text-base font-extrabold bg-gradient-to-l from-primary to-[#5B5FE6] bg-clip-text text-transparent">تسک‌لی</span>}
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {collapsed ? (
            <nav className="flex flex-col gap-0.5 px-2" aria-label="ناوبری اصلی">
              {entries.map((item) => (
                <NavRow key={item.to} item={item} compact analyticsLocked={analyticsLocked} />
              ))}
            </nav>
          ) : (
            <nav aria-label="ناوبری اصلی" className="flex flex-col gap-4 px-2">
              {orderedGroups.map((group) => (
                <div key={group.label} className="space-y-0.5">
                  <p className="px-3 pb-1 text-[10px] font-bold tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <NavRow key={item.to} item={item} analyticsLocked={analyticsLocked} />
                  ))}
                </div>
              ))}
            </nav>
          )}
        </div>

        <div className="space-y-1 border-t border-border/60 p-2">
          {secondaryEntries.map((item) => (
            <NavRow key={item.to} item={item} analyticsLocked={analyticsLocked} />
          ))}
          <button
            onClick={toggle}
            className={cn(
              ROW_CLASS,
              "w-full bg-transparent dark:bg-transparent",
              "text-muted-foreground hover:bg-primary/10 hover:text-foreground dark:hover:bg-white/5",
              collapsed && "justify-center px-0",
            )}
            title={collapsed ? (dark ? "حالت روشن" : "حالت تیره") : undefined}
          >
            {dark ? <Sun className="size-4.5 shrink-0" /> : <Moon className="size-4.5 shrink-0" />}
            {!collapsed && (dark ? "حالت روشن" : "حالت تیره")}
          </button>
          <div className={cn("flex items-center gap-2 rounded-xl border border-border/60 bg-primary/5 px-2 py-2", collapsed && "justify-center px-0")}>
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-[#5B5FE6] text-xs font-bold text-white shadow-[0_4px_12px_-6px_rgba(37,99,235,0.9)]">
              {(user?.name ?? "کاربر").slice(0, 1)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">{user?.name ?? "کاربر مهمان"}</div>
                <button
                  className="text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={signOutAndExit}
                >
                  خروج از حساب
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "hidden w-full items-center gap-3 rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground md:flex dark:hover:bg-white/5",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "باز کردن منو" : "جمع کردن منو"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!collapsed && "جمع کردن"}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar — mobile: hamburger + brand + page title + search + bell.
            Desktop: search + bell only (the sidebar already carries the nav). */}
        <header className="app-chrome sticky top-0 z-30 flex h-16 shrink-0 items-center gap-1.5 border-b border-border/60 px-2 shadow-[0_8px_30px_-24px_rgba(15,23,42,0.35)] md:gap-2 md:px-5">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="size-11 shrink-0 md:hidden"
                aria-label="باز کردن منوی ناوبری"
                aria-expanded={navOpen}
                aria-controls="mobile-nav-drawer"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>

            {/* RTL navigation drawer — opens from the reading-start (right) edge.
                Radix supplies the backdrop, outside-click close, focus trap,
                Escape handling and the dialog semantics. */}
            <SheetContent
              id="mobile-nav-drawer"
              side="right"
              showCloseButton={false}
              className="flex w-[86vw] max-w-sm flex-col gap-0 border-l border-border/60 bg-app-bg p-0 md:hidden"
            >
              <SheetHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/60 p-3 text-start">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-[#5B5FE6] text-white shadow-md shadow-primary/20">
                    <ListChecks className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-sm font-extrabold">تسک‌لی</SheetTitle>
                    <SheetDescription className="truncate text-[11px] font-medium">
                      ناوبری فضای کاری
                    </SheetDescription>
                  </div>
                </div>
                <SheetClose asChild>
                  <Button variant="outline" className="size-11 shrink-0" aria-label="بستن منوی ناوبری">
                    <X className="size-5" aria-hidden="true" />
                  </Button>
                </SheetClose>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto overscroll-contain p-2">
                <nav aria-label="ناوبری موبایل" className="flex flex-col gap-4">
                  {orderedGroups.map((group) => (
                    <div key={group.label} className="space-y-0.5">
                      <p className="px-3 pb-1 text-[10px] font-bold tracking-wide text-muted-foreground">
                        {group.label}
                      </p>
                      {group.items.map((item) => (
                        <NavRow
                          key={item.to}
                          item={item}
                          analyticsLocked={analyticsLocked}
                          onNavigate={() => setNavOpen(false)}
                        />
                      ))}
                    </div>
                  ))}
                  <div className="space-y-0.5">
                    <p className="px-3 pb-1 text-[10px] font-bold tracking-wide text-muted-foreground">
                      بیشتر
                    </p>
                    {secondaryEntries.map((item) => (
                      <NavRow
                        key={item.to}
                        item={item}
                        analyticsLocked={analyticsLocked}
                        onNavigate={() => setNavOpen(false)}
                      />
                    ))}
                    <button
                      onClick={toggle}
                      className={cn(
                        ROW_CLASS,
                        "w-full bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-foreground dark:bg-transparent dark:hover:bg-white/5",
                      )}
                    >
                      {dark ? <Sun className="size-4.5 shrink-0" /> : <Moon className="size-4.5 shrink-0" />}
                      {dark ? "حالت روشن" : "حالت تیره"}
                    </button>
                    <button
                      onClick={signOutAndExit}
                      className={cn(
                        ROW_CLASS,
                        "w-full bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-foreground dark:bg-transparent dark:hover:bg-white/5",
                      )}
                    >
                      <LogOut className="size-4.5 shrink-0" aria-hidden="true" />
                      خروج از حساب
                    </button>
                  </div>
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          {/* Product identity + current page context (mobile only) */}
          <Link
            to="/dashboard"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 md:hidden"
            aria-label="تسک‌لی — داشبورد"
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ListChecks className="size-4" aria-hidden="true" />
            </div>
            <span className="min-w-0 truncate text-sm font-extrabold">{pageTitle}</span>
          </Link>

          {/* Search: full text affordance on desktop, 44px icon on mobile */}
          <Button
            variant="outline"
            size="sm"
            className="ms-auto hidden h-9 w-full max-w-xs justify-start gap-2 font-medium text-muted-foreground md:ms-0 md:flex"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-command-palette"))
            }
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-start">جست‌وجو…</span>
            <kbd className="hidden rounded-md border border-border/70 bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground md:inline dark:bg-slate-800/60">
              Ctrl K
            </kbd>
          </Button>
          <Button
            variant="outline"
            className="size-11 shrink-0 md:hidden"
            aria-label="جست‌وجو"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-command-palette"))
            }
          >
            <Search className="size-5" aria-hidden="true" />
          </Button>

          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:size-10"
              aria-label="اعلان‌ها"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((o) => !o)}
            >
              <Bell className="size-4.5" />
              {(overdueCount > 0 || notifications.length > 0) && (
                <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-destructive" />
              )}
            </Button>
            {notifOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setNotifOpen(false)}
                />
                <div
                  role="dialog"
                  aria-label="مرکز اعلان‌ها"
                  className="ui-popover absolute end-0 top-12 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-2"
                >
                  <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground">
                    اعلان‌ها
                  </div>
                  {notifications.length === 0 && overdueCount === 0 ? (
                    <p className="px-2 pb-3 pt-1 text-xs text-muted-foreground">
                      فعلاً اعلانی نداری. همه‌چیز مرتب است!
                    </p>
                  ) : (
                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                      {overdueCount > 0 && (
                        <li className="rounded-xl border border-red-200/70 bg-red-50 px-3 py-2 text-xs dark:border-red-500/20 dark:bg-red-500/10">
                          <span className="font-bold text-red-700 dark:text-red-300">
                            {toFa(overdueCount)} کار عقب‌افتاده
                          </span>
                          <p className="mt-0.5 text-red-600/80 dark:text-red-300/70">
                            بهتر است امروز سراغشان بروی.
                          </p>
                        </li>
                      )}
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-xs",
                            n.tone === "danger" && "border-red-200/70 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10",
                            n.tone === "warning" && "border-amber-200/70 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10",
                            n.tone === "info" && "border-primary/20 bg-accent/70",
                          )}
                        >
                          <span className="font-bold">{n.title}</span>
                          <p className="mt-0.5 opacity-80">{n.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

        {/* Compact unlock progression hint — dashboard only, never clutter. */}
        {pathname === "/dashboard" && <UnlockHint />}

        {/*
         * Scrollable content.
         *
         * The canvas (clean off-white / deep navy, no grid) is painted on the
         * scroll container itself, and the page tree is lifted one layer above
         * it — so nothing decorative can ever be stacked on top of UI content.
         */}
        <main className="app-canvas relative flex-1 overflow-y-auto">
          <div className="relative z-10">{children}</div>
        </main>

        {/* Mobile bottom nav — a quick rail; the hamburger drawer carries every
            implemented section. */}
        <nav
          className="app-chrome flex shrink-0 items-stretch justify-around border-t border-border/60 pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="ناوبری موبایل"
        >
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative flex min-h-12 min-w-16 flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-bold transition-colors",
                  isActive
                    ? "text-primary after:absolute after:inset-x-4 after:top-0 after:h-[3px] after:rounded-full after:bg-gradient-to-l after:from-primary after:to-[#5B5FE6] after:content-['']"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
