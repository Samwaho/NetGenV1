"use client";

import { useQuery } from "@apollo/client";
import { GET_ISP_TICKETS, TicketFilterOptions } from "@/graphql/isp_tickets";
import { Button } from "@/components/ui/button";
import { Plus, Ticket, Clock, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { KanbanBoard } from "./components/KanbanBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useMemo, memo, ReactElement, useState, useCallback, useEffect } from "react";
import { Ticket as TicketType } from "@/graphql/isp_tickets";

// Define the props type for StatsCard
interface StatsCardProps {
  title: string;
  value: number;
  description: string;
  icon: ReactElement;
  iconColor?: string;
}

// Update the interface for GraphQL response
interface TicketsQueryResponse {
  tickets: {
    success: boolean;
    message: string;
    tickets: TicketType[];
    totalCount: number;
  }
}

// Memoized stats card component to prevent unnecessary re-renders
const StatsCard = memo(({ title, value, description, icon, iconColor }: StatsCardProps) => (
  <Card className="shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className={iconColor || "text-muted-foreground"}>{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">
        {description}
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
          ISP Tickets
        </h1>
        <p className="text-muted-foreground">
          Manage support tickets in a Kanban board view
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
    <Skeleton className="h-[500px] w-full" />
  </div>
);

export default function TicketsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  // Get filter parameters from URL or use defaults
  const status = searchParams.get("status") || undefined;
  const category = searchParams.get("category") || undefined;
  const search = searchParams.get("search") || undefined;
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortDirection = (searchParams.get("sortDirection") || "desc") as "asc" | "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  // State for filter options - initialize from URL params
  const [filterOptions, setFilterOptions] = useState<TicketFilterOptions>(() => ({
    page,
    pageSize,
    sortBy,
    sortDirection,
    status,
    category,
    search
  }));

  // Update URL when filter options change - use replace instead of push to avoid history stack
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterOptions.page && filterOptions.page > 1) params.set("page", filterOptions.page.toString());
    if (filterOptions.pageSize && filterOptions.pageSize !== 20) params.set("pageSize", filterOptions.pageSize.toString());
    if (filterOptions.sortBy && filterOptions.sortBy !== "createdAt") params.set("sortBy", filterOptions.sortBy);
    if (filterOptions.sortDirection && filterOptions.sortDirection !== "desc") params.set("sortDirection", filterOptions.sortDirection);
    if (filterOptions.status) params.set("status", filterOptions.status);
    if (filterOptions.category) params.set("category", filterOptions.category);
    if (filterOptions.search) params.set("search", filterOptions.search);
    
    const queryString = params.toString();
    const newPath = queryString 
      ? `/${organizationId}/isp/tickets?${queryString}`
      : `/${organizationId}/isp/tickets`;

    // Only update if the path has actually changed
    if (window.location.pathname + window.location.search !== newPath) {
      router.replace(newPath);
    }
  }, [filterOptions, organizationId, router]);

  // Handler for filter changes - use functional update to avoid stale state
  const handleFilterChange = useCallback((newFilters: TicketFilterOptions) => {
    setFilterOptions(prev => {
      // Only update if there are actual changes
      const hasChanges = Object.entries(newFilters).some(([key, value]) => 
        prev[key as keyof TicketFilterOptions] !== value
      );
      
      return hasChanges ? { ...prev, ...newFilters } : prev;
    });
  }, []);

  // Query with pagination and filters
  const { data, loading: dataLoading, error } = useQuery<TicketsQueryResponse>(
    GET_ISP_TICKETS,
    { 
      variables: { 
        organizationId,
        page: filterOptions.page,
        pageSize: filterOptions.pageSize,
        sortBy: filterOptions.sortBy,
        sortDirection: filterOptions.sortDirection,
        status: filterOptions.status,
        category: filterOptions.category,
        search: filterOptions.search
      },
      skip: !organization || !user, // Skip the query until we have user and org data
      fetchPolicy: "cache-and-network", // Use cache first, then update from network
      nextFetchPolicy: "cache-first", // Use cache for subsequent requests
      notifyOnNetworkStatusChange: true, // Show loading state on refetch
    }
  );

  const loading = userLoading || orgLoading || (dataLoading && !data);

  // Calculate statistics using useMemo to avoid recalculation on rerenders
  const stats = useMemo(() => {
    const tickets = data?.tickets?.tickets || [];
    const totalCount = data?.tickets?.totalCount || 0;
    
    return {
      total: totalCount,
      urgent: tickets.filter((ticket) => ticket.priority === "URGENT").length,
      overdue: tickets.filter((ticket) => {
        if (!ticket.dueDate) return false;
        return new Date(ticket.dueDate) < new Date();
      }).length,
      resolved: tickets.filter((ticket) => 
        ticket.status === "RESOLVED" || ticket.status === "CLOSED"
      ).length,
    };
  }, [data]);

  if (loading) {
    return <LoadingState />;
  }

  const canViewTickets = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.VIEW_ISP_MANAGER_TICKETS
  );

  const canManageTickets = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.MANAGE_ISP_MANAGER_TICKETS
  );

  if (!canViewTickets) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don&apos;t have permission to view tickets.
        </p>
      </div>
    );
  }

  if (error) {
    toast.error(`Error loading tickets: ${error.message}`);
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-500">Failed to load tickets. Please try again later.</p>
      </div>
    );
  }

  const tickets = data?.tickets?.tickets || [];

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-custom">
            ISP Tickets
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage support tickets in a Kanban board view
          </p>
        </div>
        {canManageTickets && (
          <Link href={`/${organizationId}/isp/tickets/create`} prefetch={true}>
            <Button className="w-full sm:w-auto bg-gradient-custom text-white hover:text-white">
              <Plus className="mr-2 h-4 w-4" /> Create Ticket
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Tickets"
          value={stats.total}
          description="Active and resolved tickets"
          icon={<Ticket className="h-4 w-4" />}
        />

        <StatsCard
          title="Urgent"
          value={stats.urgent}
          description="High priority tickets"
          icon={<AlertCircle className="h-4 w-4" />}
          iconColor="text-red-500"
        />

        <StatsCard
          title="Overdue"
          value={stats.overdue}
          description="Past due date"
          icon={<Clock className="h-4 w-4" />}
          iconColor="text-orange-500"
        />

        <StatsCard
          title="Resolved"
          value={stats.resolved}
          description="Completed tickets"
          icon={<CheckCircle2 className="h-4 w-4" />}
          iconColor="text-green-500"
        />
      </div>

      {dataLoading && !data ? (
        <Skeleton className="h-[500px] w-full" />
      ) : (
        <KanbanBoard 
          tickets={tickets} 
          onFilterChange={handleFilterChange}
          filterOptions={filterOptions}
        />
      )}
    </div>
  );
}

