import { WorkspaceRouter } from "@/components/workspaces/WorkspaceRouter";

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
  return <WorkspaceRouter />;
}
