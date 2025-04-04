import { UserPlus, ChevronRight, LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useState } from "react";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { Organization } from "@/types/organization";

type OrganizationMember = {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  email?: string;
  role: {
    name: string;
  };
  status: "ACTIVE" | "PENDING" | "INACTIVE";
};

type MembersTabProps = {
  members: OrganizationMember[];
  organizationId: string;
  organization: Organization;
  currentUserId: string;
};

export const MembersTab = ({ members, organization, currentUserId }: MembersTabProps) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const canManageMembers = hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.MANAGE_MEMBERS
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Organization Members</h2>
        {canManageMembers ? (
          <Button 
            className="bg-gradient-custom text-white hover:text-white"
            onClick={() => setIsInviteModalOpen(true)}
          >
            Invite Member
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" disabled>
                <LockIcon className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>You need member management permissions to invite members</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div
                key={member.user?.id || member.email}
                className="flex items-center justify-between p-4 hover:bg-muted/50"
              >
                <div className="flex items-center space-x-4">
                  <Avatar>
                    <AvatarFallback>
                      {member.user ? 
                        `${member.user.firstName[0]}${member.user.lastName[0]}` : 
                        member.email?.[0]?.toUpperCase() || '?'
                      }
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {member.user ? 
                        `${member.user.firstName} ${member.user.lastName}` : 
                        member.email
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.user?.email || member.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge variant="outline">{member.role.name}</Badge>
                  <Badge
                    variant="outline"
                    className={
                      member.status === "ACTIVE"
                        ? "bg-green-500/10 text-green-500"
                        : member.status === "PENDING"
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-gray-500/10 text-gray-500"
                    }
                  >
                    {member.status}
                  </Badge>
                  <Button variant="ghost" size="icon">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};




