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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg sm:text-xl font-semibold">Organization Members</h2>
        {canManageMembers ? (
          <Button 
            className="w-full sm:w-auto bg-gradient-custom text-white hover:text-white text-xs sm:text-sm"
            onClick={() => setIsInviteModalOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" disabled className="w-full sm:w-auto text-xs sm:text-sm">
                <LockIcon className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs sm:text-sm">You need member management permissions to invite members</p>
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
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 hover:bg-muted/50 gap-2 sm:gap-4"
              >
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <Avatar className="h-8 sm:h-10 w-8 sm:w-10">
                    <AvatarFallback className="text-xs sm:text-sm">
                      {member.user ? 
                        `${member.user.firstName[0]}${member.user.lastName[0]}` : 
                        member.email?.[0]?.toUpperCase() || '?'
                      }
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm sm:text-base">
                      {member.user ? 
                        `${member.user.firstName} ${member.user.lastName}` : 
                        member.email
                      }
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {member.user?.email || member.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <Badge variant="outline" className="text-xs sm:text-sm">{member.role.name}</Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs sm:text-sm ${
                      member.status === "ACTIVE"
                        ? "bg-green-500/10 text-green-500"
                        : member.status === "PENDING"
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-gray-500/10 text-gray-500"
                    }`}
                  >
                    {member.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 sm:h-10 w-8 sm:w-10">
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




