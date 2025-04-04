"use client";

import { useState } from "react";
import { Plus, Users, Building2, ArrowRight, LockIcon } from "lucide-react";
import { useQuery } from "@apollo/client";
import { GET_ORGANIZATIONS } from "@/graphql/organization";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";
import { 
  hasOrganizationPermissions, 
} from "@/lib/permission-utils";
import { CURRENT_USER } from "@/graphql/auth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Organization } from "@/types/organization";
import { OrganizationPermissions } from "@/lib/permissions";

type OrganizationsResponse = {
  organizations: {
    success: boolean;
    message: string;
    organizations: Organization[];
  };
};

const OrganizationCard = ({ 
  org, 
  currentUserId 
}: { 
  org: Organization;
  currentUserId: string;
}) => {
  const hasViewPermission = hasOrganizationPermissions(
    org, 
    currentUserId, 
    OrganizationPermissions.VIEW_ORGANIZATION
  );

  return (
    <Card className="flex flex-col glow">
      <CardHeader>
        <CardTitle className="text-2xl text-gradient-custom2">
          {org.name}
        </CardTitle>
        <CardDescription>
          {org.description || "No description provided"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-4">
          <div className="flex items-center text-muted-foreground">
            <Users className="h-5 w-5 mr-2" />
            <span>{org.members.length} members</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Created {new Date(org.createdAt).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        {hasViewPermission ? (
          <Link href={`/organizations/${org.id}`} className="w-full">
            <Button
              className="w-full bg-gradient-custom2 text-white hover:text-white"
            >
              View Organization <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="w-full"
                variant="outline"
                disabled
              >
                <LockIcon className="mr-2 h-4 w-4" />
                No View Access
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>You don't have permission to view this organization</p>
            </TooltipContent>
          </Tooltip>
        )}
      </CardFooter>
    </Card>
  );
};

const Page = () => {
  const { data: userData, loading: userLoading } = useQuery(CURRENT_USER);
  const { loading, error, data } = useQuery<OrganizationsResponse>(GET_ORGANIZATIONS);

  if (loading || userLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[200px]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !userData?.currentUser) {
    toast.error("Failed to load organizations");
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-red-500">
          Failed to load organizations. Please try again later.
        </p>
      </div>
    );
  }

  const currentUserId = userData.currentUser.id;

  const organizations = data?.organizations.organizations || [];

  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-gradient-custom">
          Your Organizations
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Manage your organizations and team collaborations
        </p>

        <div className="mt-8">
          <Link href="/organizations/create">
            <Button
              className="bg-gradient-custom text-white hover:text-white cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4" /> Create Organization
            </Button>
          </Link>
        </div>
      </div>

      {organizations.length === 0 ? (
        <Card className="text-center p-8">
          <CardHeader>
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle className="text-2xl text-gradient-custom2">No Organizations Yet</CardTitle>
            <CardDescription>
              Create your first organization to start collaborating with your team
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/organizations/create">
              <Button
                className="bg-gradient-custom2 text-white hover:text-white"
              >
                <Plus className="mr-2 h-4 w-4" /> Create Organization
              </Button>
            </Link>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {organizations.map((org) => (
            <OrganizationCard 
              key={org.id} 
              org={org} 
              currentUserId={currentUserId!}
            />
          ))}
        </div>
      )}

      <div className="mt-16 text-center">
        <p className="text-muted-foreground">
          Need help managing your organization?{" "}
          <a href="#" className="text-gradient-custom font-medium hover:underline underline-offset-4">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
};

export default Page;




