import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { CreateRoleModal } from "../CreateRoleModal";
import { EditRoleModal } from "../EditRoleModal";

type Role = {
  name: string;
  description?: string;
  isSystemRole: boolean;
  permissions: string[];
};

type RolesTabProps = {
  roles: Role[];
  organizationId: string;
};

export const RolesTab = ({ roles, organizationId }: RolesTabProps) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Organization Roles</h2>
        <Button 
          className="bg-gradient-custom text-white hover:text-white"
          onClick={() => setIsCreateModalOpen(true)}
        >
          Create Role
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {roles.map((role) => (
              <div
                key={role.name}
                className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
                onClick={() => setSelectedRole(role)}
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
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
};