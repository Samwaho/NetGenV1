"use client";
import { useQuery } from "@apollo/client";
import { GET_ISP_PACKAGES, PackageFilterOptions } from "@/graphql/isp_packages";
import { DataTable } from "./components/PackagesTable";
import { columns } from "./components/columns";
import { Button } from "@/components/ui/button";
import { Plus, Wifi, Network, Radio, TrendingUp, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ISPPackage } from "@/types/isp_package";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import Link from "next/link";
import { useMemo, useCallback, useEffect, memo, useState, useRef } from "react";

// Define types
interface StatCardProps {
  title: string;
  value: number | string;
  subtext: string;
  icon: React.ReactNode;
  color: string;
}

// Update the interface for GraphQL response
interface PackagesQueryResponse {
  packages: {
    success: boolean;
    message: string;
    packages: ISPPackage[];
    totalCount: number;
  }
}

// Memoized stats card component to prevent unnecessary re-renders
const StatCard = memo(({ title, value, subtext, icon, color }: StatCardProps) => (
  <Card className="shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs sm:text-sm font-medium">
        {title}
      </CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className={`text-xl sm:text-2xl font-bold ${color}`}>
        {value}
      </div>
      <p className="text-xs text-muted-foreground">
        {subtext}
      </p>
    </CardContent>
  </Card>
));
StatCard.displayName = "StatCard";

export default function PackagesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  // Get filter parameters from URL or use defaults
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "10");
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortDirection = (searchParams.get("sortDirection") || "desc") as "asc" | "desc";
  const search = searchParams.get("search") || undefined;

  // State for filter options - initialize from URL params
  const [filterOptions, setFilterOptions] = useState<PackageFilterOptions>(() => ({
    page,
    pageSize,
    sortBy,
    sortDirection,
    search
  }));

  // Update URL when filter options change - use replace instead of push to avoid history stack
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterOptions.page && filterOptions.page > 1) params.set("page", filterOptions.page.toString());
    if (filterOptions.pageSize && filterOptions.pageSize !== 10) params.set("pageSize", filterOptions.pageSize.toString());
    if (filterOptions.sortBy && filterOptions.sortBy !== "createdAt") params.set("sortBy", filterOptions.sortBy);
    if (filterOptions.sortDirection && filterOptions.sortDirection !== "desc") params.set("sortDirection", filterOptions.sortDirection);
    if (filterOptions.search) params.set("search", filterOptions.search);
    
    const queryString = params.toString();
    const newPath = queryString 
      ? `/${organizationId}/isp/packages?${queryString}`
      : `/${organizationId}/isp/packages`;

    // Only update if the path has actually changed
    if (window.location.pathname + window.location.search !== newPath) {
      router.replace(newPath);
    }
  }, [filterOptions, organizationId, router]);

  // Handler for filter changes from DataTable
  const handleFilterChange = useCallback((newFilters: PackageFilterOptions) => {
    setFilterOptions(prev => {
      // Only update if there are actual changes
      const hasChanges = Object.entries(newFilters).some(([key, value]) => 
        prev[key as keyof PackageFilterOptions] !== value
      );
      
      return hasChanges ? { ...prev, ...newFilters } : prev;
    });
  }, []);

  // Query with pagination, sorting and filtering
  const { data, loading: dataLoading, error, refetch } = useQuery<PackagesQueryResponse>(
    GET_ISP_PACKAGES,
    { 
      variables: { 
        organizationId,
        page: filterOptions.page,
        pageSize: filterOptions.pageSize,
        sortBy: filterOptions.sortBy,
        sortDirection: filterOptions.sortDirection,
        search: filterOptions.search
      },
      skip: !organization || !user, // Skip the query until we have user and org data
      fetchPolicy: "cache-and-network", // Use cache first, then update from network
      nextFetchPolicy: "cache-first", // Use cache for subsequent requests
      notifyOnNetworkStatusChange: true, // Show loading state on refetch
    }
  );

  // Refetch if ?refresh=1 is present in the URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('refresh') === '1') {
      refetch();
      url.searchParams.delete('refresh');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [refetch]);

  const packages = useMemo(() => data?.packages.packages || [], [data?.packages.packages]);
  const totalCount = data?.packages.totalCount || 0;

  // Calculate statistics using useMemo to avoid recalculation on rerenders
  const stats = useMemo(() => {
    const pppoePackages = packages.filter(pkg => pkg.serviceType === "PPPOE").length;
    const hotspotPackages = packages.filter(pkg => pkg.serviceType === "HOTSPOT").length;
    const staticPackages = packages.filter(pkg => pkg.serviceType === "STATIC").length;
    const dhcpPackages = packages.filter(pkg => pkg.serviceType === "DHCP").length;
    
    // Find most popular service type
    const serviceTypeCounts = packages.reduce((acc, pkg) => {
      acc[pkg.serviceType] = (acc[pkg.serviceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostPopularEntry = Object.entries(serviceTypeCounts)
      .sort(([, a], [, b]) => b - a)[0] || ["N/A", 0];
    
    const mostPopularType = mostPopularEntry[0];
    const mostPopularCount = mostPopularEntry[1];
    
    return {
      totalPackages: totalCount,
      pppoePackages,
      hotspotPackages,
      staticPackages,
      dhcpPackages,
      mostPopularType,
      mostPopularCount,
      pppoePercentage: totalCount > 0 ? `${((pppoePackages / packages.length) * 100).toFixed(1)}% of visible` : 'No packages',
      hotspotPercentage: totalCount > 0 ? `${((hotspotPackages / packages.length) * 100).toFixed(1)}% of visible` : 'No packages',
      popularPercentage: totalCount > 0 && mostPopularCount > 0 
        ? `${((mostPopularCount / packages.length) * 100).toFixed(1)}% of packages` 
        : 'No packages',
    };
  }, [packages, totalCount]);

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
          <Link
            href={`/${organizationId}/isp/packages/create`}
            prefetch={true}
          >
          <Button
            className="w-full sm:w-auto bg-gradient-custom text-white hover:text-white"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Package
          </Button>
          </Link>
        )}
      </div>

      {dataLoading && !data ? (
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
            <StatCard
              title="Total Packages"
              value={stats.totalPackages}
              subtext="Available service packages"
              icon={<Wifi className="h-4 w-4 text-muted-foreground" />}
              color=""
            />

            <StatCard
              title="PPPoE Packages"
              value={stats.pppoePackages}
              subtext={stats.pppoePercentage}
              icon={<Network className="h-4 w-4 text-blue-500" />}
              color="text-blue-500"
            />

            <StatCard
              title="Hotspot Packages"
              value={stats.hotspotPackages}
              subtext={stats.hotspotPercentage}
              icon={<Radio className="h-4 w-4 text-green-500" />}
              color="text-green-500"
            />

            <StatCard
              title="Most Popular"
              value={stats.mostPopularType}
              subtext={stats.popularPercentage}
              icon={<TrendingUp className="h-4 w-4 text-yellow-500" />}
              color="text-yellow-500"
            />
          </div>
          <div className="overflow-x-auto p-2 sm:p-4 bg-card rounded-2xl shadow-md dark:border">
            <DataTable 
              columns={columns(canManagePackages)} 
              data={packages}
              totalCount={totalCount}
              filterOptions={filterOptions}
              onFilterChange={handleFilterChange}
              isLoading={dataLoading}
            />
          </div>
        </>
      )}
    </div>
  );
}
