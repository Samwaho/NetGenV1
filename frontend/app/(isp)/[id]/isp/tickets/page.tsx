"use client";

import { useQuery } from "@apollo/client";
import { GET_ISP_TICKETS } from "@/graphql/isp_tickets";
import { Button } from "@/components/ui/button";
import { Plus, Ticket, Clock, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { useParams } from "next/navigation";
import { KanbanBoard } from "./components/KanbanBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TicketsPage() {
  const params = useParams();
  const organizationId = params.id as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  const { data, loading: dataLoading, error } = useQuery(GET_ISP_TICKETS, {
    variables: { organizationId },
    skip: !organization || !user,
  });

  const loading = userLoading || orgLoading || dataLoading;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-[200px] mb-4" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
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
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-500">Error loading tickets: {error.message}</p>
      </div>
    );
  }

  const tickets = data?.tickets?.tickets || [];

  // Calculate statistics
  const stats = {
    total: tickets.length,
    urgent: tickets.filter((ticket: { priority: string }) => ticket.priority === "URGENT").length,
    overdue: tickets.filter((ticket: { dueDate: string }) => {
      if (!ticket.dueDate) return false;
      return new Date(ticket.dueDate) < new Date();
    }).length,
    resolved: tickets.filter((ticket: { status: string }) => 
      ticket.status === "RESOLVED" || ticket.status === "CLOSED"
    ).length,
  };

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
          <Link href={`/${organizationId}/isp/tickets/create`}>
            <Button className="w-full sm:w-auto bg-gradient-custom text-white hover:text-white">
              <Plus className="mr-2 h-4 w-4" /> Create Ticket
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Active and resolved tickets
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.urgent}</div>
            <p className="text-xs text-muted-foreground">
              High priority tickets
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">
              Past due date
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">
              Completed tickets
            </p>
          </CardContent>
        </Card>
      </div>

      <KanbanBoard tickets={tickets} />
    </div>
  );
}

