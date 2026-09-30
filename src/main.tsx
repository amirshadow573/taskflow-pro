import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router";
import "./index.css";
import { cn } from "@/lib/utils";
import { applyStoredPreferences, readStartPage } from "@/lib/preferences";
import { Plus } from "lucide-react";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Onboarding = lazy(() => import("@/components/onboarding/OnboardingFlow"));
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { CapabilityGate } from "@/components/progress/UnlockCenter";
const TestMode = lazy(() => import("@/components/landing/TestMode"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Today = lazy(() => import("./pages/Today.tsx"));
const InboxPage = lazy(() => import("./pages/Inbox.tsx"));
const MyTasks = lazy(() => import("./pages/MyTasks.tsx"));
const Projects = lazy(() => import("./pages/Projects.tsx"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail.tsx"));
const CalendarPage = lazy(() => import("./pages/Calendar.tsx"));
// Phase 17 — visual timeline (time-grid view of the existing schedule)
const TimelinePage = lazy(() => import("./pages/Timeline.tsx"));
const Planning = lazy(() => import("./pages/Planning.tsx"));
const AnalyticsPage = lazy(() => import("./pages/Progress.tsx"));

/** تحلیل پیشرفته — an ADVANCED capability gated by the Phase 08 unlock system. */
function GatedAnalytics() {
  return (
    <CapabilityGate featureKey="analytics">
      <AnalyticsPage />
    </CapabilityGate>
  );
}
const MyProgress = lazy(() => import("./pages/MyProgress.tsx"));
const GrowthPathDetail = lazy(() => import("./pages/GrowthPathDetail.tsx"));
const FuturePage = lazy(() => import("./pages/Future.tsx"));
const AIPlanningPage = lazy(() => import("./pages/AIPlanning.tsx"));
// Phase 15 — full-screen AI assistant workspace (contextual, NOT in primary nav)
const AIWorkspace = lazy(() => import("./pages/AIWorkspace.tsx"));
// Phase 16 — AI Insights Center (evidence → insight → recommendation)
const AIInsights = lazy(() => import("./pages/AIInsights.tsx"));
const SettingsPage = lazy(() => import("./pages/Settings.tsx"));
const Help = lazy(() => import("./pages/Help.tsx"));

// Workspace chrome (sidebar shell + providers) wraps all app pages
import {
  WorkspaceData,
  PageSkeleton,
} from "@/components/workspace/WorkspaceData";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { QuickAddModal } from "@/components/workspace/QuickAddModal";

function RouteLoading() {
  return (
    <div className="grid min-h-svh place-items-center bg-background">
      <div className="animate-pulse text-sm text-muted-foreground">در حال بارگذاری…</div>
    </div>
  );
}

/** Renders the workspace pages inside the shell, with task detail + quick add. */
function Workspace({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceData>
      <div className="flex h-full">
        <div className="min-w-0 flex-1">{children}</div>
        <TaskDetailHost />
      </div>
      <QuickAddModalHost />
      <MobileFabHost />
    </WorkspaceData>
  );
}

function MobileFabHost() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("quick-add-task"))}
      aria-label="افزودن کار جدید"
      className="fixed bottom-20 end-4 z-40 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[#5B5FE6] text-white shadow-[0_14px_30px_-10px_rgba(37,99,235,0.85)] transition-transform hover:scale-105 active:scale-95 md:hidden"
    >
      <Plus className="size-6" />
    </button>
  );
}

/** Mounted once; reads openTaskId from workspace context. */
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useGoals } from "@/hooks/use-goals";
import { findGoal } from "@/lib/goals";
import { useState } from "react";
import { X } from "lucide-react";

function TaskDetailHost() {
  const { tasks, projects, openTaskId, openTask, updateTask, toggleDone, deleteTask, createTask } =
    useWorkspace();
  const goals = useGoals();
  const task = tasks.find((t) => t._id === openTaskId);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!task) return null;
  const project = projects.find((p) => p._id === task.projectId);
  const goal = findGoal(goals, project?.goalRef as string | undefined);
  const subtasks = tasks.filter((t) => t.parentId === openTaskId);

  const panel = (
    <TaskDetailPanel
      task={task}
      project={project}
      goal={goal ? { ref: goal.ref, title: goal.title } : null}
      subtasks={subtasks}
      onClose={() => openTask(null)}
      onUpdate={(patch) => updateTask(task._id, patch)}
      onToggleDone={(done) => toggleDone(task, done)}
      onDelete={() => {
        deleteTask(task._id);
        setMobileOpen(false);
      }}
      onAddSubtask={(title) =>
        createTask({
          title,
          parentId: task._id,
          projectId: task.projectId,
          status: "todo",
        })
      }
      onToggleSubtask={(id, done) => {
        const t = tasks.find((x) => x._id === id);
        if (t) void toggleDone(t, done);
      }}
      onDeleteSubtask={(id) => deleteTask(id)}
    />
  );

  return (
    <>
      {/* Desktop: persistent side panel */}
      <div className="hidden w-[360px] shrink-0 border-s border-border/60 lg:block">{panel}</div>
      {/* Mobile/tablet: full-screen overlay sheet */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-y-0" : "translate-y-full pointer-events-none",
        )}
      >
        <div className="flex h-12 items-center justify-between border-b border-border/60 px-3">
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="بستن جزئیات"
            className="grid size-9 place-items-center rounded-xl border border-border/60 bg-white/70 transition-colors hover:bg-white dark:bg-white/5"
          >
            <X className="size-4.5" />
          </button>
          <span className="text-xs font-bold text-muted-foreground">جزئیات کار</span>
        </div>
        <div className="h-[calc(100%-3rem)] overflow-hidden">{panel}</div>
      </div>
      {/* Open trigger — clicking a task sets openTaskId; on mobile we show the sheet */}
      <MobileOpenEffect onOpen={() => setMobileOpen(true)} taskId={openTaskId} />
    </>
  );
}

function MobileOpenEffect({ taskId, onOpen }: { taskId: string | null; onOpen: () => void }) {
  useEffect(() => {
    if (taskId && window.innerWidth < 1024) onOpen();
    if (!taskId) return;
  }, [taskId, onOpen]);
  return null;
}

function QuickAddModalHost() {
  const [open, setOpen] = useState(false);
  return <QuickAddModal open={open} onOpenChange={setOpen} />;
}

/** /app/... → /... — keeps legacy workspace URLs working, preserving query + hash. */
function AppPrefixRedirect() {
  const { pathname, search, hash } = useLocation();
  const rest = pathname.replace(/^\/app\/?/, "/");
  return <Navigate to={`${rest}${search}${hash}`} replace />;
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">خطای اجرای برنامه</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Audit fix: persisted theme/accent were never re-applied on boot, so a
// refresh reverted the user's saved appearance. Apply before first paint.
applyStoredPreferences();

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/**
 * Workspace pages live at friendly top-level URLs (/dashboard, /today, …).
 * Each page is wrapped in the shared auth guard + workspace shell. Routes are
 * deliberately FLAT: React Router forbids absolute child paths under a nested
 * parent route ("/dashboard" inside "/app" is invalid).
 */
const WORKSPACE_PAGES = [
  { path: "/dashboard", Page: Dashboard },
  { path: "/today", Page: Today },
  { path: "/inbox", Page: InboxPage },
  { path: "/tasks", Page: MyTasks },
  { path: "/projects", Page: Projects },
  { path: "/projects/:id", Page: ProjectDetail },
  { path: "/calendar", Page: CalendarPage },
  // برنامه زمانی — visual day/week time grid over the same timeBlocks
  { path: "/timeline", Page: TimelinePage },
  { path: "/planning", Page: Planning },
  // پیشرفت من — level-up / missions / growth paths
  { path: "/progress", Page: MyProgress },
  { path: "/progress/paths/:pathKey", Page: GrowthPathDetail },
  // تحلیل — historical productivity analytics (unlocked via progress)
  { path: "/analytics", Page: GatedAnalytics },
  // قابلیت‌های آینده (AI) — structured «به‌زودی» showcase in the Advanced group
  { path: "/future", Page: FuturePage },
  // Phase 10.5 — import a plan produced by the user's OWN external AI
  { path: "/ai-planning", Page: AIPlanningPage },
  // Phase 15 — AI Productivity Assistant (full screen / mobile)
  { path: "/assistant", Page: AIWorkspace },
  // Phase 16 — AI Insights Center
  { path: "/ai-insights", Page: AIInsights },
  { path: "/settings", Page: SettingsPage },
  { path: "/help", Page: Help },
] as const;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              {/* Auth lands on the user's chosen start page (audit fix: the
                  "start page" preference was stored but never used). */}
              <Route path="/auth" element={<AuthPage redirectAfterAuth={readStartPage()} />} />
              <Route path="/test-mode" element={<TestMode />} />
              <Route
                path="/onboarding" element={
                <RequireAuth>
                  <WorkspaceData chrome={false}>
                    <OnboardingGate>
                      <Onboarding />
                    </OnboardingGate>
                  </WorkspaceData>
                </RequireAuth>
              } />
              {/* Workspace pages at friendly top-level URLs */}
              {WORKSPACE_PAGES.map(({ path, Page }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <RequireAuth>
                      <Workspace>
                        <Page />
                      </Workspace>
                    </RequireAuth>
                  }
                />
              ))}
              {/* Legacy /app/* URLs → friendly top-level URLs */}
              <Route path="/app" element={<Navigate to={readStartPage()} replace />} />
              <Route path="/app/*" element={<AppPrefixRedirect />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster richColors position="bottom-left" />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
