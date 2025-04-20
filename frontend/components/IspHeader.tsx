"use client";

import React from "react";
import ProfileAction from "./ProfileAction";
import { ModeToggle } from "./ModeToggle";
import { useQuery } from "@apollo/client";
import { GET_ORGANIZATION } from "@/graphql/organization";
import { Skeleton } from "./ui/skeleton";

interface IspHeaderProps {
  organizationId: string;
}

const IspHeader = ({ organizationId }: IspHeaderProps) => {
  const { data, loading } = useQuery(GET_ORGANIZATION, {
    variables: { id: organizationId },
    skip: !organizationId,
  });

  const organizationName = data?.organization?.name || "NetGen";

  return (
    <div className="flex w-full max-w-7xl items-center justify-between p-4">   
        <h1 className="text-2xl font-bold text-gradient-custom">
          {loading ? (
            <Skeleton className="w-32 h-8" />
          ) : (
            organizationName
          )}
        </h1>
        <div className="flex items-center gap-2">
            <ModeToggle/>
           <ProfileAction/> 
        </div>
    </div>
  );
};

export default IspHeader;
