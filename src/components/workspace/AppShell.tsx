import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
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
  Moon,
  Settings,
  Sun,
  HelpCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";

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
  { to: "/progress", label: "پیشرفت", icon: LineChart },
  { to: "/archive", label: "بایگانی", icon: Archive },
  { to: "/settings", label: "تنظیمات", icon: Settings },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { to: "/today", label: "امروز", icon: ListChecks },
  { to: "/tasks", label: "کارها", icon: CircleDot },
  { to: "/projects", label: "پروژه‌ها", icon: FolderKanban },
  { to: "/settings", label: "تنظیمات", icon: Settings },
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

  const withCounts = PRIMARY_NAV.map((n) =>
    n.to === "/inbox" ? { ...n, badge: inboxCount } : n,
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
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              compact && "justify-center px-0",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          <item.icon className="size-4.5 shrink-0" />
          {!compact && (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="rounded-full bg-primary px-1.5 min-w-5 text-center text-[10px] font-bold leading-5 text-white">
                  {toFa(item.badge)}
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
          "hidden shrink-0 flex-col border-e border-white/30 bg-white/40 backdrop-blur-xl transition-[width] duration-200 md:flex shadow-[1px_0_8px_rgba(79,70,229,0.04)]",
          collapsed ? "w-16" : "w-60",
        )}
      >          <div className={cn("flex h-14 items-center gap-2 border-b border-white/30 px-4", collapsed && "justify-center px-0")}>
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-[#5B5FE6] text-white shadow-md shadow-primary/20">
            <ListChecks className="size-4" />
          </div>
          {!collapsed && <span className="text-base font-extrabold bg-gradient-to-l from-primary to-[#5B5FE6] bg-clip-text text-transparent">تسک‌لی</span>}
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <NavLinks items={withCounts} compact={collapsed} />
        </div>

        <div className="space-y-1 border-t border-white/30 p-2">
          <NavLink
            to="/help"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
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
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted",
              collapsed && "justify-center px-0",
            )}
            title={collapsed ? (dark ? "حالت روشن" : "حالت تیره") : undefined}
          >
            {dark ? <Sun className="size-4.5 shrink-0" /> : <Moon className="size-4.5 shrink-0" />}
            {!collapsed && (dark ? "حالت روشن" : "حالت تیره")}
          </button>
          <div className={cn("flex items-center gap-2 rounded-lg px-2 py-2", collapsed && "justify-center px-0")}>
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
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
              "hidden w-full items-center gap-3 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted md:flex",
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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/30 bg-white/50 px-4 backdrop-blur-xl shadow-[0_1px_4px_rgba(79,70,229,0.04)]">
          <Link to="/dashboard" className="flex items-center gap-2 md:hidden">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ListChecks className="size-4" />
            </div>
          </Link>

          <Button
            variant="outline"
            size="sm"
            className="ms-auto h-9 w-full max-w-xs justify-start gap-2 text-muted-foreground md:ms-0"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-command-palette"))
            }
          >
            <CircleDot className="size-3.5" />
            <span className="flex-1 text-start">جست‌وجو…</span>
            <kbd className="hidden rounded border border-border bg-muted px-1.5 text-[10px] font-semibold md:inline">
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
                  className="absolute end-0 top-11 z-50 w-80 rounded-xl border border-white/40 bg-white/80 backdrop-blur-xl p-2 shadow-xl shadow-primary/5"
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
                        <li className="rounded-lg bg-red-50 px-3 py-2 text-xs dark:bg-red-500/10">
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
                            "rounded-lg px-3 py-2 text-xs",
                            n.tone === "danger" && "bg-red-50 dark:bg-red-500/10",
                            n.tone === "warning" && "bg-amber-50 dark:bg-amber-500/10",
                            n.tone === "info" && "bg-accent",
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

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Mobile bottom nav */}
        <nav
          className="flex shrink-0 items-stretch justify-around border-t border-white/30 bg-white/60 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="ناوبری موبایل"
        >
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex min-w-16 flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-semibold",
                  isActive ? "text-primary" : "text-muted-foreground",
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
