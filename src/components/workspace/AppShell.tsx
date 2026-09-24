import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { NAV_EMPHASIS, MOBILE_NAV_PER_PERSONA } from "@/lib/personas";
import {
  Archive,
  Bell,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  CircleDot,
  Clock,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Lock,
  Moon,
  Search,
  Settings,
  Sun,
  HelpCircle,
  Trophy,
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
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { to: "/today", label: "امروز", icon: ListChecks },
  { to: "/inbox", label: "صندوق ورودی", icon: Inbox },
  { to: "/tasks", label: "کارهای من", icon: CircleDot },
  { to: "/projects", label: "پروژه‌ها", icon: FolderKanban },
  { to: "/calendar", label: "تقویم", icon: CalendarDays },
  { to: "/planning", label: "برنامه‌ریزی", icon: Clock },
  // پیشرفت من = level / XP / missions / growth paths (single nav entry)
  { to: "/progress", label: "پیشرفت من", icon: Trophy },
  { to: "/analytics", label: "تحلیل", icon: LineChart },
  { to: "/archive", label: "بایگانی", icon: Archive },
  { to: "/settings", label: "تنظیمات", icon: Settings },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { to: "/today", label: "امروز", icon: ListChecks },
  { to: "/progress", label: "پیشرفت من", icon: Trophy },
  { to: "/tasks", label: "کارها", icon: CircleDot },
  { to: "/projects", label: "پروژه‌ها", icon: FolderKanban },
];

/** Theme controller stored on <html class="dark">. */
export function useTheme() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
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
  const { personaKey } = useUserProfile();
  const { pathname } = useLocation();
  // Centralized capability map — subtle lock hints on gated nav items only.
  const capabilities = useQuery(api.unlocks.capabilities);

  // Persona-aware nav: all items always visible, boosted paths get a visual dot
  const emphasized = useMemo(() => new Set(NAV_EMPHASIS[personaKey] ?? []), [personaKey]);
  const withCounts = PRIMARY_NAV.map((n) =>
    n.to === "/inbox" ? { ...n, badge: inboxCount, emphasized: emphasized.has(n.to) } : { ...n, emphasized: emphasized.has(n.to) },
  );

  // Persona-specific mobile bottom nav
  const mobilePaths = MOBILE_NAV_PER_PERSONA[personaKey] ?? MOBILE_NAV_PER_PERSONA.personal;
  const mobileNavItems = useMemo(
    () => mobilePaths.map((path) => PRIMARY_NAV.find((n) => n.to === path)).filter(Boolean) as NavItem[],
    [personaKey],
  );

  const NavLinks = ({ items, compact }: { items: NavItem[]; compact: boolean }) => (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="ناوبری اصلی">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={compact ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold transition-all duration-200",
              compact && "justify-center px-0",
              isActive
                ? "ui-nav-active"
                : "text-muted-foreground hover:bg-primary/10 hover:text-foreground dark:hover:bg-white/5",
            )
          }
        >              <item.icon className="size-4.5 shrink-0" />
              {!compact && (
                <>
                  <span className={cn("flex-1 truncate", (item as any).emphasized && "text-foreground")}>{item.label}</span>
                  {(item as any).emphasized && (
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  )}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="min-w-5 rounded-full bg-gradient-to-l from-primary to-[#5B5FE6] px-1.5 text-center text-[10px] font-bold leading-5 text-white shadow-[0_3px_10px_-4px_rgba(37,99,235,0.9)]">
                      {toFa(item.badge)}
                    </span>
                  )}
                  {item.to === "/analytics" && capabilities?.analytics === false && (
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
      ))}
    </nav>
  );

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "app-chrome hidden shrink-0 flex-col border-e border-border/60 transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >          <div className={cn("flex h-14 items-center gap-2 border-b border-border/60 px-4", collapsed && "justify-center px-0")}>
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-[#5B5FE6] text-white shadow-md shadow-primary/20">
            <ListChecks className="size-4" />
          </div>
          {!collapsed && <span className="text-base font-extrabold bg-gradient-to-l from-primary to-[#5B5FE6] bg-clip-text text-transparent">تسک‌لی</span>}
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <NavLinks items={withCounts} compact={collapsed} />
        </div>

        <div className="space-y-1 border-t border-border/60 p-2">
          <NavLink
            to="/help"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold transition-all duration-200",
                collapsed && "justify-center px-0",
                isActive
                  ? "ui-nav-active"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-foreground dark:hover:bg-white/5",
              )
            }
            title={collapsed ? "راهنما" : undefined}
          >
            <HelpCircle className="size-4.5 shrink-0" />
            {!collapsed && "راهنما"}
          </NavLink>
          <button
            onClick={toggle}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-foreground dark:hover:bg-white/5",
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
                  onClick={async () => {
                    await signOut();
                    navigate("/");
                  }}
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
        {/* Topbar */}
        <header className="app-chrome flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 md:hidden">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ListChecks className="size-4" />
            </div>
          </Link>

          <Button
            variant="outline"
            size="sm"
            className="ms-auto h-9 w-full max-w-xs justify-start gap-2 font-medium text-muted-foreground md:ms-0"
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

          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              aria-label="اعلان‌ها"
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
                  className="ui-popover absolute end-0 top-12 z-50 w-80 rounded-2xl p-2"
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

        {/* Mobile bottom nav */}
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
                  "relative flex min-w-16 flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-bold transition-colors",
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
