import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation, Navigate, Outlet } from "react-router";
import "./index.css";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Today = lazy(() => import("./pages/Today.tsx"));
const InboxPage = lazy(() => import("./pages/Inbox.tsx"));
const MyTasks = lazy(() => import("./pages/MyTasks.tsx"));
const Projects = lazy(() => import("./pages/Projects.tsx"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail.tsx"));
const CalendarPage = lazy(() => import("./pages/Calendar.tsx"));
const Planning = lazy(() => import("./pages/Planning.tsx"));
const ProgressPage = lazy(() => import("./pages/Progress.tsx"));
const ArchivePage = lazy(() => import("./pages/Archive.tsx"));
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
      className="fixed bottom-20 end-4 z-40 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 md:hidden"
    >
      <Plus className="size-6" />
    </button>
  );
}

/** Mounted once; reads openTaskId from workspace context. */
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useState } from "react";
import { X } from "lucide-react";

function TaskDetailHost() {
  const { tasks, projects, openTaskId, openTask, updateTask, toggleDone, deleteTask, createTask } =
    useWorkspace();
  const task = tasks.find((t) => t._id === openTaskId);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!task) return null;
  const project = projects.find((p) => p._id === task.projectId);
  const subtasks = tasks.filter((t) => t.parentId === openTaskId);

  const panel = (
    <TaskDetailPanel
      task={task}
      project={project}
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
      <div className="hidden w-[360px] shrink-0 border-s border-border lg:block">{panel}</div>
      {/* Mobile/tablet: full-screen overlay sheet */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-background transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-y-0" : "translate-y-full pointer-events-none",
        )}
      >
        <div className="flex h-12 items-center justify-between border-b border-border px-3">
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="بستن جزئیات"
            className="grid size-9 place-items-center rounded-lg hover:bg-muted"
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

const workspaceRoutes = (
  <>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/today" element={<Today />} />
    <Route path="/inbox" element={<InboxPage />} />
    <Route path="/tasks" element={<MyTasks />} />
    <Route path="/projects" element={<Projects />} />
    <Route path="/projects/:id" element={<ProjectDetail />} />
    <Route path="/calendar" element={<CalendarPage />} />
    <Route path="/planning" element={<Planning />} />
    <Route path="/progress" element={<ProgressPage />} />
    <Route path="/archive" element={<ArchivePage />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/help" element={<Help />} />
  </>
);

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
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/onboarding" />}
              />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route
                path="/app"
                element={
                  <RequireAuth>
                    <Workspace>
                      <Outlet />
                    </Workspace>
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                {workspaceRoutes}
              </Route>
              {/* Friendly top-level redirects into the workspace */}
              {["/dashboard", "/today", "/inbox", "/tasks", "/projects", "/calendar", "/planning", "/progress", "/archive", "/settings", "/help"].map(
                (p) => (
                  <Route
                    key={p}
                    path={p}
                    element={
                      <Navigate to={`/app${p}`} replace />
                    }
                  />
                ),
              )}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster richColors position="bottom-left" />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
