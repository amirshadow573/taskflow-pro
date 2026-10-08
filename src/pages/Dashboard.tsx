import { WorkspaceRouter } from "@/components/workspaces/WorkspaceRouter";
import { FutureFeatureSection } from "@/components/future/ComingSoonFeature";
import { AIPlanEntryCard } from "@/components/ai-planning/AIPlanEntryCard";
import { AIOverviewCard } from "@/components/ai/AIOverviewCard";
import { AIInsightStrip } from "@/components/ai/AIInsightStrip";

/**
 * Dashboard page — routes to the persona-specific workspace.
 *
 * The actual rendering is handled by WorkspaceRouter, which reads
 * the user's personalization profile and dispatches to:
 * - StudentWorkspace
 * - EmployeeWorkspace
 * - FreelancerWorkspace
 * - ManagerWorkspace
 * - PersonalWorkspace (default / fallback)
 *
 * Each workspace uses the shared task/project data from WorkspaceData
 * but renders different modules, layouts, and features.
 */
export default function Dashboard() {
  return (
    <div className="dashboard-page space-y-6">
      <WorkspaceRouter />
      {/*
        Phase 10.5 — one compact entry point for the external-AI plan import.
        It is deliberately small: the dashboard shows the resulting plan, not
        the import mechanism (§22).
      */}
      {/* Phase 15 — compact assistant strip. Real numbers only (§29). */}
      <AIOverviewCard />

      {/* Phase 16 — top 1–3 deterministic findings. No model call (§15). */}
      <AIInsightStrip />

      <AIPlanEntryCard />
      {/*
        Future capabilities — a SMALL, persona-aware preview (max 3 cards) at
        the bottom of the dashboard. It never competes with the live modules
        above it and it is not a loading state: everything renders instantly
        from a static catalog.
      */}
      <div className="mx-auto max-w-6xl px-4 pb-8 md:px-8">
        <FutureFeatureSection
          title="قابلیت‌های آینده"
          surface="dashboard"
          limit={3}
          description="مسیر بعدی محصول برای شخصیت شما — همه در مرحله «به‌زودی» هستند."
        />
      </div>
    </div>
  );
}
