import { Organization } from "@/types/organization";
import { OrganizationPermissions } from "./permissions";

/**
 * Checks if a user has specific permissions in an organization
 * @param organization - The organization object
 * @param userId - The ID of the user to check
 * @param requiredPermissions - Single permission or array of permissions to check
 * @returns boolean indicating if user has all required permissions
 */
export const hasOrganizationPermissions = (
  organization: Organization,
  userId: string,
  requiredPermissions: OrganizationPermissions | OrganizationPermissions[]
): boolean => {
  // Convert single permission to array
  const permissions = Array.isArray(requiredPermissions) 
    ? requiredPermissions 
    : [requiredPermissions];

  // Check if user is organization owner (has all permissions)
  if (organization.owner.id === userId) {
    return true;
  }

  // Find the member in the organization
  const member = organization.members.find(
    m => m.user?.id === userId
  );
  
  if (!member) return false;

  // Get the member's role
  const role = organization.roles.find(
    r => r.name === member.role.name
  );

  if (!role) return false;

  // Check if the role has all required permissions
  return permissions.every(
    permission => role.permissions.includes(permission)
  );
};
