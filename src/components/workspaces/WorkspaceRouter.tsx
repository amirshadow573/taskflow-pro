import { useUserProfile } from "@/hooks/use-user-profile";
import { type PersonaKey } from "@/lib/personas";
import { StudentWorkspace } from "./StudentWorkspace";
import { EmployeeWorkspace } from "./EmployeeWorkspace";
import { FreelancerWorkspace } from "./FreelancerWorkspace";
import { BusinessOwnerWorkspace } from "./BusinessOwnerWorkspace";
import { ManagerWorkspace } from "./ManagerWorkspace";
import { PersonalWorkspace } from "./PersonalWorkspace";

/**
 * Dispatches to the correct persona-specific workspace.
 * Falls back to PersonalWorkspace for unknown or default personas.
 */
export function WorkspaceRouter() {
  const { personaKey } = useUserProfile();

  const workspaceMap: Record<string, React.FC> = {
    student: StudentWorkspace,
    employee: EmployeeWorkspace,
    freelancer: FreelancerWorkspace,
    business_owner: BusinessOwnerWorkspace,
    manager: ManagerWorkspace,
    team: ManagerWorkspace,
    personal: PersonalWorkspace,
    custom: PersonalWorkspace,
  };

  const Workspace = workspaceMap[personaKey] ?? PersonalWorkspace;

  return <Workspace />;
}
