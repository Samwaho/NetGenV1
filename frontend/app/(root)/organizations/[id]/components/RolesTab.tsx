import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { CreateRoleModal } from "../CreateRoleModal";
import { EditRoleModal } from "../EditRoleModal";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { Organization } from "@/types/organization";
import { LockIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Role = {
  name: string;
  description?: string;
  isSystemRole: boolean;
  permissions: string[];
};

type RolesTabProps = {
  roles: Role[];
  organizationId: string;
  organization: Organization;
  currentUserId: string;
};

export const RolesTab = ({ roles, organizationId, organization, currentUserId }: RolesTabProps) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const canManageRoles = hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.MANAGE_ROLES
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Organization Roles</h2>
        {canManageRoles ? (
          <Button 
            className="bg-gradient-custom text-white hover:text-white"
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create Role
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" disabled>
                <LockIcon className="mr-2 h-4 w-4" />
                Create Role
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>You need role management permissions to create roles</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {roles.map((role) => (
              <div
                key={role.name}
                className={`flex items-center justify-between p-4 ${
                  canManageRoles ? 'hover:bg-muted/50 cursor-pointer' : ''
                }`}
                onClick={() => canManageRoles && setSelectedRole(role)}
              >
                <div>
                  <p className="font-medium">{role.name}</p>
                  {role.description && (
                    <p className="text-sm text-muted-foreground">
                      {role.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {role.isSystemRole && (
                    <Badge variant="secondary">System Role</Badge>
                  )}
                  <Badge variant="outline">
                    {role.permissions.length} permissions
                  </Badge>
                  {!canManageRoles && (
                    <LockIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {canManageRoles && (
        <>
          <CreateRoleModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            organizationId={organizationId}
          />

          {selectedRole && (
            <EditRoleModal
              isOpen={!!selectedRole}
              onClose={() => setSelectedRole(null)}
              organizationId={organizationId}
              role={selectedRole}
            />
          )}
        </>
      )}
    </div>
  );
};



