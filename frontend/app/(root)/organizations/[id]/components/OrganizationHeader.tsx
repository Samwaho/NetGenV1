import { Building2, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

type OrganizationHeaderProps = {
  name: string;
  ownerName: string;
  createdAt: string;
  organizationId: string;
  logo?: string;
};

export const OrganizationHeader = ({ 
  name, 
  ownerName, 
  createdAt, 
  organizationId,
  logo
}: OrganizationHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {logo ? (
          <div className="h-12 sm:h-16 w-12 sm:w-16 rounded-lg overflow-hidden border border-border">
            <Image
              src={logo}
              alt={`${name} logo`}
              width={64}
              height={64}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to default icon on error
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="h-12 sm:h-16 w-12 sm:w-16 rounded-lg bg-gradient-custom2 flex items-center justify-center">
                      <svg class="h-6 sm:h-8 w-6 sm:w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                      </svg>
                    </div>
                  `;
                }
              }}
            />
          </div>
        ) : (
          <div className="h-12 sm:h-16 w-12 sm:w-16 rounded-lg bg-gradient-custom2 flex items-center justify-center">
            <Building2 className="h-6 sm:h-8 w-6 sm:w-8 text-white" />
          </div>
        )}
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
