import { Building2, MoreVertical, Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type OrganizationHeaderProps = {
  name: string;
  ownerName: string;
  createdAt: string;
};

export const OrganizationHeader = ({ name, ownerName, createdAt }: OrganizationHeaderProps) => {
  return (
    <div className="flex items-start justify-between mb-8">
      <div className="flex items-center space-x-4">
        <div className="h-16 w-16 rounded-lg bg-gradient-custom2 flex items-center justify-center">
          <Building2 className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gradient-custom2">{name}</h1>
          <p className="text-muted-foreground">
            Created by {ownerName} • {new Date(createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            Organization Settings
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Shield className="mr-2 h-4 w-4" />
            Roles & Permissions
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};