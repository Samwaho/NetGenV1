"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@apollo/client";
import { GET_DASHBOARD_STATS } from "@/graphql/dashboard_stats";
import { CustomerStats } from "./components/CustomerStats";
import { TicketStats } from "./components/TicketStats";
import { InventoryStats } from "./components/InventoryStats";
import { RevenueChart } from "./components/RevenueChart";
import { PackageChart } from "./components/PackageChart";
import { Users, TicketIcon, Package, DollarSign, PieChart, RefreshCw } from "lucide-react";
import type { ISPCustomer } from "@/types/isp_customer";
import type { ISPTicket } from "@/types/isp_ticket";
import type { ISPInventory } from "@/types/isp_inventory";
import type { ISPPackage } from "@/types/isp_package";
import type { ISPTransaction } from "@/types/isp_transaction";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

interface DashboardStats {
  customers: ISPCustomer[];
  tickets: ISPTicket[];
  inventories: ISPInventory[];
  packages: ISPPackage[];
  transactions: ISPTransaction[];
  total_customers: number;
  total_tickets: number;
  total_inventory_items: number;
  total_packages: number;
  total_transactions: number;
}

interface DashboardData {
  dashboardStats: DashboardStats;
}

function DashboardSkeleton() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-4 w-32 rounded" />
      </div>
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full rounded mb-2" />
              <Skeleton className="h-4 w-1/2 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-40 w-full rounded mb-2" />
              <Skeleton className="h-4 w-1/3 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DashboardClient() {
  const params = useParams();
  const organizationId = params.id as string;
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { data, loading, error, refetch } = useQuery<DashboardData>(GET_DASHBOARD_STATS, {
    variables: { organizationId },
    fetchPolicy: "cache-first", // Use cache first to avoid unnecessary network requests
    nextFetchPolicy: "cache-only", // Don't refetch after initial load
    notifyOnNetworkStatusChange: true,
  });

  // Function to manually refresh data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Dashboard data refreshed");
    } catch (err) {
      toast.error("Failed to refresh dashboard data");
      console.error("Refresh error:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Show skeleton while loading AND no data is available
  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  // Handle error state
  if (error) {
    console.error("Dashboard data error:", error);
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-xl font-semibold text-red-500">Error loading dashboard data</h2>
        <p className="mt-2 text-gray-600">{error.message}</p>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          className="mt-4"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </>
          )}
        </Button>
      </div>
    );
  }

  const stats = data?.dashboardStats;

  // If no data is available after loading
  if (!stats) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="text-xs sm:text-sm text-muted-foreground">
            <span>Last updated: {new Date().toLocaleDateString()}</span>
          </div>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={isRefreshing || loading}
          >
            {isRefreshing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full">
        {/* Summary Cards */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Customer Overview
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CustomerStats customers={stats?.customers || []} />
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Support Tickets
            </CardTitle>
            <TicketIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <TicketStats tickets={stats?.tickets || []} />
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Inventory Status
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <InventoryStats inventories={stats?.inventories || []} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Additional Dashboard Widgets */}
        <Card className="col-span-full lg:col-span-1 transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Package Distribution
            </CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <PackageChart packages={stats?.packages || []} customers={stats?.customers || []} />
          </CardContent>
        </Card>

        <Card className="col-span-full lg:col-span-1 transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Network Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] sm:h-[320px] flex items-center justify-center border-2 border-dashed rounded-lg">
              <p className="text-xs sm:text-sm text-muted-foreground text-center px-4">
                Network status metrics will be displayed here
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Revenue Overview
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <RevenueChart transactions={stats?.transactions || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
