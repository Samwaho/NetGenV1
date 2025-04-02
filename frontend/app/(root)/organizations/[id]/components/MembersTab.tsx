import { UserPlus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  onInvite: () => void;
};

export const MembersTab = ({ members, onInvite }: MembersTabProps) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Organization Members</h2>
        <Button 
          className="bg-gradient-custom text-white hover:text-white"
          onClick={onInvite}
        >
          <UserPlus className="mr-2 h-4 w-4" /> Invite Member
        </Button>
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
