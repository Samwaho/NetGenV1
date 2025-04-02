"use client";

import { useState } from "react";
import { Plus, Users, Building2, ArrowRight } from "lucide-react";
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

type Organization = {
  id: string;
  name: string;
  description?: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  members: Array<{
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    role: {
      name: string;
    };
  }>;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type OrganizationsResponse = {
  organizations: {
    success: boolean;
    message: string;
    organizations: Organization[];
  };
};

const Page = () => {
  const { loading, error, data } = useQuery<OrganizationsResponse>(GET_ORGANIZATIONS);

  if (error) {
    toast.error("Failed to load organizations");
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-red-500">
          Failed to load organizations. Please try again later.
        </p>
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="text-center mb-16">
          <Skeleton className="h-10 w-64 mx-auto mb-4" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-3">
                  {[1, 2].map((j) => (
                    <Skeleton key={j} className="h-6 w-full" />
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

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
          {organizations.map((org, index) => (
            <Card
              key={org.id}
              className="flex flex-col glow"
            >
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
                <Link href={`/organizations/${org.id}`} className="w-full">
                  <Button
                    className="w-full bg-gradient-custom2 text-white hover:text-white"
                  >
                    View Organization <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
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