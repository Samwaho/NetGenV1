"use client";
import { useState } from "react";
import { useQuery } from "@apollo/client";
import { GET_ISP_PACKAGES } from "@/graphql/isp_packages";
import { DataTable } from "./components/PackagesTable";
import { columns } from "./components/columns";
import { Button } from "@/components/ui/button";
import { Plus, Wifi, Network, Radio, TrendingUp, ShieldAlert } from "lucide-react";
import { PackageDialog } from "./components/PackageDialog";
import { toast } from "sonner";
import { ISPPackagesResponse } from "@/types/isp_package";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";

export default function PackagesPage() {
  const params = useParams();
  const organizationId = params.id as string;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  const { data, loading: dataLoading, error } = useQuery<ISPPackagesResponse>(
    GET_ISP_PACKAGES,
    { 
      variables: { organizationId },
      skip: !organization || !user, // Skip the query until we have user and org data
    }
  );

  // Show loading state while checking permissions
  if (userLoading || orgLoading) {
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-custom">
              ISP Packages
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage your internet service packages and plans
            </p>
          </div>
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Loading...
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">--</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <TableSkeleton columns={5} rows={5} />
      </div>
    );
  }

  const canViewPackages = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.VIEW_ISP_MANAGER_PACKAGES
  );

  const canManagePackages = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.MANAGE_ISP_MANAGER_PACKAGES
  );

  if (!canViewPackages) {
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don&apos;t have permission to view packages.
        </p>
      </div>
    );
  }

  if (error) {
    toast.error("Failed to load packages");
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <p className="text-red-500">
          Failed to load packages. Please try again later.
        </p>
      </div>
    );
  }

  const packages = data?.packages.packages || [];

  // Calculate statistics
  const totalPackages = packages.length;
  const pppoePackages = packages.filter(pkg => pkg.serviceType === "PPPOE").length;
  const hotspotPackages = packages.filter(pkg => pkg.serviceType === "HOTSPOT").length;
  
  // Find most popular service type
  const serviceTypeCounts = packages.reduce((acc, pkg) => {
    acc[pkg.serviceType] = (acc[pkg.serviceType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostPopularServiceType = Object.entries(serviceTypeCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || "N/A";

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-custom">
            ISP Packages
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your internet service packages and plans
          </p>
        </div>
        {canManagePackages && (
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="w-full sm:w-auto bg-gradient-custom text-white hover:text-white"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Package
          </Button>
        )}
      </div>

      {dataLoading ? (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">
                    Loading...
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">--</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <TableSkeleton columns={5} rows={5} />
        </>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Total Packages
                </CardTitle>
                <Wifi className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{totalPackages}</div>
                <p className="text-xs text-muted-foreground">
                  Available service packages
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  PPPoE Packages
                </CardTitle>
                <Network className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-blue-500">
                  {pppoePackages}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalPackages > 0 ? `${((pppoePackages / totalPackages) * 100).toFixed(1)}% of total` : 'No packages'}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Hotspot Packages
                </CardTitle>
                <Radio className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-green-500">
                  {hotspotPackages}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalPackages > 0 ? `${((hotspotPackages / totalPackages) * 100).toFixed(1)}% of total` : 'No packages'}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Most Popular
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-yellow-500">
                  {mostPopularServiceType}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalPackages > 0 ? `${((serviceTypeCounts[mostPopularServiceType] / totalPackages) * 100).toFixed(1)}% of packages` : 'No packages'}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="overflow-x-auto">
            <DataTable columns={columns(canManagePackages)} data={packages} />
          </div>
        </>
      )}
      {canManagePackages && (
        <PackageDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          organizationId={organizationId}
        />
      )}
    </div>
  );
}
