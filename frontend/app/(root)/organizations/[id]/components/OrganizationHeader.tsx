import { Building2, MoreVertical, Settings, Shield, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

type OrganizationHeaderProps = {
  name: string;
  ownerName: string;
  createdAt: string;
  organizationId: string;
};

export const OrganizationHeader = ({ 
  name, 
  ownerName, 
  createdAt, 
  organizationId 
}: OrganizationHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="h-12 sm:h-16 w-12 sm:w-16 rounded-lg bg-gradient-custom2 flex items-center justify-center">
          <Building2 className="h-6 sm:h-8 w-6 sm:w-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient-custom2">{name}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Created by {ownerName} • {new Date(createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
        <Link href={`/${organizationId}/isp`} className="w-full sm:w-auto">
          <Button 
            variant="outline"
            className="w-full sm:w-auto bg-gradient-custom hover:text-white cursor-pointer text-white transition-all duration-300 text-xs sm:text-sm"
          >
            <Network className="mr-2 h-4 w-4" />
            ISP Management
          </Button>
        </Link>
      </div>
    </div>
  );
};
