"use client";

import React from "react";
import ProfileAction from "./ProfileAction";
import { ModeToggle } from "./ModeToggle";
import { useQuery } from "@apollo/client";
import { GET_ORGANIZATION } from "@/graphql/organization";
import { Skeleton } from "./ui/skeleton";
import Link from "next/link";
import Image from "next/image";
import { Building2 } from "lucide-react";

interface IspHeaderProps {
  organizationId: string;
}

const IspHeader = ({ organizationId }: IspHeaderProps) => {
  const { data, loading } = useQuery(GET_ORGANIZATION, {
    variables: { id: organizationId },
    skip: !organizationId,
  });

  const organizationName = data?.organization?.name || "NetGen";
  const organizationLogo = data?.organization?.business?.logo;

  return (
    <div className="flex w-full max-w-7xl items-center justify-between p-4">
      <Link href={`/organizations/${organizationId}`} className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {loading ? (
          <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex-shrink-0" />
        ) : organizationLogo ? (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-border flex-shrink-0">
            <Image
              src={organizationLogo}
              alt={`${organizationName} logo`}
              width={40}
              height={40}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to default icon on error
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-custom2 flex items-center justify-center">
                      <svg class="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                      </svg>
                    </div>
                  `;
                }
              }}
            />
          </div>
        ) : (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-custom2 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
        )}
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gradient-custom truncate min-w-0">
          {loading ? (
            <Skeleton className="w-24 sm:w-32 h-6 sm:h-8" />
          ) : (
            organizationName
          )}
        </h1>
      </Link>
       
        <div className="flex items-center gap-2 flex-shrink-0">
            <ModeToggle/>
           <ProfileAction/> 
        </div>
    </div>
  );
};

export default IspHeader;
