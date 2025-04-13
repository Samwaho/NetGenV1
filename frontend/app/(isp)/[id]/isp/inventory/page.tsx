"use client";
import { useQuery } from "@apollo/client";
import { GET_ISP_INVENTORIES, InventoryFilterOptions } from "@/graphql/isp_inventory";
import { DataTable } from "./components/InventoryTable";
import { columns } from "./components/columns";
import { Button } from "@/components/ui/button";
import { Plus, Package, ShieldAlert, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ISPInventory, EquipmentStatus } from "@/types/isp_inventory";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { useMemo, memo, ReactElement, useState, useCallback, useEffect } from "react";
import Link from "next/link";

// Define the props type for StatsCard
interface StatsCardProps {
  title: string;
  value: number;
  percentage: string;
  icon: ReactElement;
  color: string;
}

// Update the interface for GraphQL response
interface InventoryQueryResponse {
  inventories: {
    success: boolean;
    message: string;
    inventories: ISPInventory[];
    total_count: number;
  }
}

// Memoized stats card component to prevent unnecessary re-renders
const StatsCard = memo(({ title, value, percentage, icon, color }: StatsCardProps) => (
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
        {percentage}
      </p>
    </CardContent>
  </Card>
));
StatsCard.displayName = "StatsCard";

// Loading component to reduce duplication
const LoadingState = () => (
  <div className="container mx-auto px-4 py-8 space-y-8">
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gradient-custom">
          ISP Inventory
        </h1>
        <p className="text-muted-foreground">
          Manage your equipment and inventory items
        </p>
      </div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Loading...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
          </CardContent>
        </Card>
      ))}
    </div>
    <TableSkeleton columns={5} rows={5} />
  </div>
);

export default function InventoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  // Get filter parameters from URL or use defaults
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortDirection = (searchParams.get("sortDirection") || "desc") as "asc" | "desc";
  const filterCategory = searchParams.get("category") || undefined;
  const filterStatus = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;

  // State for filter options - initialize from URL params
  const [filterOptions, setFilterOptions] = useState<InventoryFilterOptions>(() => ({
    page,
    pageSize,
    sortBy,
    sortDirection,
    filterCategory,
    filterStatus,
    search
  }));

  // Update URL when filter options change - use replace instead of push to avoid history stack
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterOptions.page && filterOptions.page > 1) params.set("page", filterOptions.page.toString());
    if (filterOptions.pageSize && filterOptions.pageSize !== 20) params.set("pageSize", filterOptions.pageSize.toString());
    if (filterOptions.sortBy && filterOptions.sortBy !== "createdAt") params.set("sortBy", filterOptions.sortBy);
    if (filterOptions.sortDirection && filterOptions.sortDirection !== "desc") params.set("sortDirection", filterOptions.sortDirection);
    if (filterOptions.filterCategory) params.set("category", filterOptions.filterCategory);
    if (filterOptions.filterStatus) params.set("status", filterOptions.filterStatus);
    if (filterOptions.search) params.set("search", filterOptions.search);
    
    const queryString = params.toString();
    const newPath = queryString 
      ? `/${organizationId}/isp/inventory?${queryString}`
      : `/${organizationId}/isp/inventory`;

    // Only update if the path has actually changed
    if (window.location.pathname + window.location.search !== newPath) {
      router.replace(newPath);
    }
  }, [filterOptions, organizationId, router]);

  // Handler for filter changes from DataTable - use functional update to avoid stale state
  const handleFilterChange = useCallback((newFilters: InventoryFilterOptions) => {
    setFilterOptions(prev => {
      // Only update if there are actual changes
      const hasChanges = Object.entries(newFilters).some(([key, value]) => 
        prev[key as keyof InventoryFilterOptions] !== value
      );
      
      return hasChanges ? { ...prev, ...newFilters } : prev;
    });
  }, []);

  // Query with pagination and filters
  const { data, loading: dataLoading, error } = useQuery<InventoryQueryResponse>(
    GET_ISP_INVENTORIES,
    { 
      variables: { 
        organizationId,
        page: filterOptions.page,
        pageSize: filterOptions.pageSize,
        sortBy: filterOptions.sortBy,
        sortDirection: filterOptions.sortDirection,
        filterCategory: filterOptions.filterCategory,
        filterStatus: filterOptions.filterStatus,
        search: filterOptions.search
      },
      skip: !organization || !user, // Skip the query until we have user and org data
      fetchPolicy: "cache-and-network", // Use cache first, then update from network
      nextFetchPolicy: "cache-first", // Use cache for subsequent requests
      notifyOnNetworkStatusChange: true, // Show loading state on refetch
    }
  );

  const inventoryItems = data?.inventories.inventories || [];
  const totalCount = data?.inventories.total_count || 0;

  // Calculate statistics using useMemo to avoid recalculation on rerenders
  const stats = useMemo(() => {
    const totalItems = totalCount;
    const lowStockItems = inventoryItems.filter(item => 
      item.quantity <= (item.quantityThreshold || 0)
    ).length;
    const activeItems = inventoryItems.filter(item => 
      item.status === EquipmentStatus.AVAILABLE
    ).length;
    
    // These percentages are based on the current page, not the total count
    const itemsOnPage = inventoryItems.length;
    
    return {
      totalItems,
      lowStockItems,
      activeItems,
      lowStockPercentage: itemsOnPage > 0 ? `${((lowStockItems / itemsOnPage) * 100).toFixed(1)}% of visible` : 'No items',
      activePercentage: itemsOnPage > 0 ? `${((activeItems / itemsOnPage) * 100).toFixed(1)}% of visible` : 'No items',
    };
  }, [inventoryItems, totalCount]);

  // Show loading state while checking permissions
  if (userLoading || orgLoading) {
    return <LoadingState />;
  }

  const canViewInventory = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.VIEW_ISP_MANAGER_INVENTORY
  );

  const canManageInventory = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.MANAGE_ISP_MANAGER_INVENTORY
  );

  if (!canViewInventory) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don&apos;t have permission to view inventory.
        </p>
      </div>
    );
  }

  if (error) {
    toast.error("Failed to load inventory items");
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-500">
          Failed to load inventory items. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-custom">
            ISP Inventory
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your equipment and inventory items
          </p>
        </div>
        {canManageInventory && (
          <Link href={`/${organizationId}/isp/inventory/create`} prefetch={true}>
            <Button className="w-full sm:w-auto bg-gradient-custom text-white hover:text-white">
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </Link>
        )}
      </div>

      {dataLoading && !data ? (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
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
      ) : inventoryItems.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Total Items"
              value={stats.totalItems}
              percentage="In inventory"
              icon={<Package className="h-4 w-4 text-muted-foreground" />}
              color=""
            />

            <StatsCard
              title="Active Items"
              value={stats.activeItems}
              percentage={stats.activePercentage}
              icon={<Package className="h-4 w-4 text-green-500" />}
              color="text-green-500"
            />

            <StatsCard
              title="Low Stock Items"
              value={stats.lowStockItems}
              percentage={stats.lowStockPercentage}
              icon={<AlertCircle className="h-4 w-4 text-red-500" />}
              color="text-red-500"
            />
          </div>
          <div className="overflow-x-auto p-2 sm:p-4 bg-card rounded-2xl shadow-md dark:border">
            <DataTable 
              columns={columns(canManageInventory)} 
              data={inventoryItems} 
              totalCount={totalCount}
              filterOptions={filterOptions}
              onFilterChange={handleFilterChange}
              isLoading={dataLoading}
            />
          </div>
        </>
      ) : (
        <div className="text-center py-10">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No inventory items</h3>
          <p className="text-muted-foreground">
            Get started by adding your first inventory item.
          </p>
          {canManageInventory && (
            <Button
              onClick={() => router.push(`/${organizationId}/isp/inventory/create`)}
              className="mt-4 bg-gradient-custom text-white hover:text-white"
            >
              <Plus className="mr-2 h-4 w-4" /> Add First Item
            </Button>
          )}
        </div>
      )}
    </div>
  );
}




