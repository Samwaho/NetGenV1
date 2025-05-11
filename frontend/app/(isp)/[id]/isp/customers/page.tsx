"use client";
import { useQuery } from "@apollo/client";
import { GET_ISP_CUSTOMERS, CustomerFilterOptions } from "@/graphql/isp_customers";
import { DataTable } from "./components/CustomersTable";
import { columns } from "./components/columns";
import { Button } from "@/components/ui/button";
import { Plus, Users, Wifi, UserCheck, UserX, ShieldAlert, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { ISPCustomer } from "@/types/isp_customer";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { useMemo, memo, ReactElement, useState, useCallback, useEffect } from "react";

// Define the props type for StatsCard
interface StatsCardProps {
  title: string;
  value: number;
  percentage: string;
  icon: ReactElement;
  color: string;
}

// Update the interface for GraphQL response
interface CustomersQueryResponse {
  customers: {
    success: boolean;
    message: string;
    customers: ISPCustomer[];
    totalCount: number;
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
          ISP Customers
        </h1>
        <p className="text-muted-foreground">
          Manage your internet service customers
        </p>
      </div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
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

export default function CustomersPage() {
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
  const filterStatus = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;

  // State for filter options - initialize from URL params
  const [filterOptions, setFilterOptions] = useState<CustomerFilterOptions>(() => ({
    page,
    pageSize,
    sortBy,
    sortDirection,
    filterStatus,
    search
  }));

  // Update URL when filter options change - use replace instead of push to avoid history stack
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterOptions.page && filterOptions.page > 1) params.set("page", filterOptions.page.toString());
    if (filterOptions.pageSize && filterOptions.pageSize !== 10) params.set("pageSize", filterOptions.pageSize.toString());
    if (filterOptions.sortBy && filterOptions.sortBy !== "createdAt") params.set("sortBy", filterOptions.sortBy);
    if (filterOptions.sortDirection && filterOptions.sortDirection !== "desc") params.set("sortDirection", filterOptions.sortDirection);
    if (filterOptions.filterStatus) params.set("status", filterOptions.filterStatus);
    if (filterOptions.search) params.set("search", filterOptions.search);
    
    const queryString = params.toString();
    const newPath = queryString 
      ? `/${organizationId}/isp/customers?${queryString}`
      : `/${organizationId}/isp/customers`;

    // Only update if the path has actually changed
    if (window.location.pathname + window.location.search !== newPath) {
      router.replace(newPath);
    }
  }, [filterOptions, organizationId, router]);

  // Handler for filter changes from DataTable - use functional update to avoid stale state
  const handleFilterChange = useCallback((newFilters: CustomerFilterOptions) => {
    setFilterOptions(prev => {
      // Only update if there are actual changes
      const hasChanges = Object.entries(newFilters).some(([key, value]) => 
        prev[key as keyof CustomerFilterOptions] !== value
      );
      
      return hasChanges ? { ...prev, ...newFilters } : prev;
    });
  }, []);

  // Query with pagination and filters
  const { data, loading: dataLoading, error } = useQuery<CustomersQueryResponse>(
    GET_ISP_CUSTOMERS,
    { 
      variables: { 
        organizationId,
        page: filterOptions.page,
        pageSize: filterOptions.pageSize,
        sortBy: filterOptions.sortBy,
        sortDirection: filterOptions.sortDirection,
        filterStatus: filterOptions.filterStatus,
        search: filterOptions.search
      },
      skip: !organization || !user, // Skip the query until we have user and org data
      fetchPolicy: "cache-and-network", // Use cache first, then update from network
      nextFetchPolicy: "cache-first", // Use cache for subsequent requests
      notifyOnNetworkStatusChange: true, // Show loading state on refetch
    }
  );

  const customers = useMemo(() => data?.customers.customers || [], [data?.customers.customers]);
  const totalCount = data?.customers.totalCount || 0;

  // Calculate statistics using useMemo to avoid recalculation on rerenders
  const stats = useMemo(() => {
    const totalCustomers = totalCount;
    const activeCustomers = customers.filter(customer => customer.status === "ACTIVE").length;
    const onlineCustomers = customers.filter(customer => customer.online).length;
    const inactiveCustomers = customers.filter(customer => customer.status !== "ACTIVE").length;
    
    // These percentages are based on the current page, not the total count
    // We could make another query to get the total stats, but this is simpler
    const customersOnPage = customers.length;
    
    return {
      totalCustomers,
      activeCustomers,
      onlineCustomers,
      inactiveCustomers,
      activePercentage: customersOnPage > 0 ? `${((activeCustomers / customersOnPage) * 100).toFixed(1)}% of visible` : 'No customers',
      onlinePercentage: customersOnPage > 0 ? `${((onlineCustomers / customersOnPage) * 100).toFixed(1)}% of visible` : 'No customers',
      inactivePercentage: customersOnPage > 0 ? `${((inactiveCustomers / customersOnPage) * 100).toFixed(1)}% of visible` : 'No customers',
    };
  }, [customers, totalCount]);

  // Show loading state while checking permissions
  if (userLoading || orgLoading) {
    return <LoadingState />;
  }

  const canViewCustomers = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.VIEW_ISP_MANAGER_CUSTOMERS
  );

  const canManageCustomers = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.MANAGE_ISP_MANAGER_CUSTOMERS
  );

  if (!canViewCustomers) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don&apos;t have permission to view customers.
        </p>
      </div>
    );
  }

  if (error) {
    toast.error("Failed to load customers");
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-500">
          Failed to load customers. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-custom">
            ISP Customers
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your internet service customers
          </p>
        </div>
        <div className="flex gap-2">
          {canManageCustomers && (
            <>
              <Link href={`/${organizationId}/isp/customers/create`} prefetch={true}>
                <Button className="w-full sm:w-auto bg-gradient-custom text-white hover:text-white">
                  <Plus className="mr-2 h-4 w-4" /> Add Customer
                </Button>
              </Link>
              <Link href={`/${organizationId}/isp/messaging`} prefetch={true}>
                <Button variant="outline" className="w-full sm:w-auto">
                  <MessageSquare className="mr-2 h-4 w-4" /> Send Messages
                </Button>
              </Link>
            </>
          )}
        </div>
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
            <StatsCard
              title="Total Customers"
              value={stats.totalCustomers}
              percentage="Registered customers"
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              color=""
            />

            <StatsCard
              title="Active Customers"
              value={stats.activeCustomers}
              percentage={stats.activePercentage}
              icon={<UserCheck className="h-4 w-4 text-green-500" />}
              color="text-green-500"
            />

            <StatsCard
              title="Online Now"
              value={stats.onlineCustomers}
              percentage={stats.onlinePercentage}
              icon={<Wifi className="h-4 w-4 text-blue-500" />}
              color="text-blue-500"
            />

            <StatsCard
              title="Inactive Customers"
              value={stats.inactiveCustomers}
              percentage={stats.inactivePercentage}
              icon={<UserX className="h-4 w-4 text-red-500" />}
              color="text-red-500"
            />
          </div>
          <div className="overflow-x-auto p-2 sm:p-4 bg-card rounded-2xl shadow-md dark:border">
            <DataTable 
              columns={columns(canManageCustomers)} 
              data={customers}
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
