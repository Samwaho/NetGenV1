"use client";

import { useState, useMemo, memo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@apollo/client";
import { toast } from "sonner";
import { ShieldAlert, Radio, Wifi, WifiOff, Wrench, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { GET_ISP_STATIONS } from "@/graphql/isp_stations";
import { columns } from "./components/columns";
import { DataTable } from "./components/StationsTable";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import type { StationFilterOptions, ISPStation } from "@/types/isp_station";
import { Button } from "@/components/ui/button";

// Define types
interface StatCardProps {
  title: string;
  value: number | string;
  subtext: string;
  icon: React.ReactNode;
  color: string;
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

// Loading state component
const LoadingState = () => (
  <div className="container mx-auto space-y-8 p-8">
    <div>
      <h1 className="text-3xl font-bold tracking-tight">ISP Stations</h1>
      <p className="text-muted-foreground">Manage and monitor your ISP stations</p>
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

export default function StationsPage() {
  // 1. Call all hooks unconditionally at the top
  const params = useParams();
  const organizationId = params.id as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);
  
  const [filterOptions, setFilterOptions] = useState<StationFilterOptions>({
    page: 1,
    pageSize: 20,
    sortBy: "createdAt",
    sortDirection: "desc",
    search: "",
  });

  // 2. Permission checks after all hooks
  const canViewStations = useMemo(() => {
    return organization && user && hasOrganizationPermissions(
      organization,
      user.id,
      OrganizationPermissions.VIEW_ISP_MANAGER_STATIONS
    );
  }, [organization, user]);

  const canManageStations = useMemo(() => {
    return organization && user && hasOrganizationPermissions(
      organization,
      user.id,
      OrganizationPermissions.MANAGE_ISP_MANAGER_STATIONS
    );
  }, [organization, user]);

  // 3. Query hook after permissions
  const { data, loading: dataLoading } = useQuery(GET_ISP_STATIONS, {
    variables: {
      organizationId,
      ...filterOptions,
    },
    skip: !organization || !user,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
    onError: (error) => {
      console.error('GraphQL error:', error);
      toast.error(`Error loading stations: ${error.message}`);
    },
    onCompleted: (data) => {
      console.log('Stations data:', data);
      if (!data?.stations?.success) {
        toast.error(data?.stations?.message || 'Failed to load stations');
      }
    },
  });

  // 4. Derived state calculations
  const stations = data?.stations?.stations || [];
  const totalCount = data?.stations?.totalCount || 0;

  const stats = useMemo(() => {
    const activeStations = stations.filter((station: ISPStation) => station.status === "ACTIVE").length;
    const inactiveStations = stations.filter((station: ISPStation) => station.status === "INACTIVE").length;
    const maintenanceStations = stations.filter((station: ISPStation) => station.status === "MAINTENANCE").length;
    
    return {
      totalStations: totalCount,
      activeStations,
      inactiveStations,
      maintenanceStations,
      activePercentage: `${((activeStations / totalCount) * 100).toFixed(1)}% of total`,
      inactivePercentage: `${((inactiveStations / totalCount) * 100).toFixed(1)}% of total`,
      maintenancePercentage: `${((maintenanceStations / totalCount) * 100).toFixed(1)}% of total`,
    };
  }, [stations, totalCount]);

  // 5. Render logic
  if (userLoading || orgLoading || !organizationId) {
    return <LoadingState />;
  }

  if (!canViewStations) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You&apos;t have permission to view stations.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-custom">ISP Stations</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage and monitor your ISP stations across different locations
          </p>
        </div>
        {canManageStations && (
          <Link
            href={`/${organizationId}/isp/stations/create`}
            prefetch={true}
          >
            <Button className="w-full sm:w-auto bg-gradient-custom text-white hover:text-white">
              <Plus className="mr-2 h-4 w-4" /> Add Station
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
              title="Total Stations"
              value={stats.totalStations}
              subtext="All registered stations"
              icon={<Radio className="h-4 w-4 text-muted-foreground" />}
              color=""
            />

            <StatCard
              title="Active Stations"
              value={stats.activeStations}
              subtext={stats.activePercentage}
              icon={<Wifi className="h-4 w-4 text-green-500" />}
              color="text-green-500"
            />

            <StatCard
              title="Inactive Stations"
              value={stats.inactiveStations}
              subtext={stats.inactivePercentage}
              icon={<WifiOff className="h-4 w-4 text-red-500" />}
              color="text-red-500"
            />

            <StatCard
              title="Maintenance"
              value={stats.maintenanceStations}
              subtext={stats.maintenancePercentage}
              icon={<Wrench className="h-4 w-4 text-yellow-500" />}
              color="text-yellow-500"
            />
          </div>

          <div className="overflow-x-auto">
            <DataTable
              columns={columns(canManageStations)}
              data={stations}
              totalCount={totalCount}
              filterOptions={filterOptions}
              onFilterChange={setFilterOptions}
              isLoading={dataLoading}
            />
          </div>
        </>
      )}
    </div>
  );
}
