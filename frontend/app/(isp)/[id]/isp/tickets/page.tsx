"use client";

import { useQuery } from "@apollo/client";
import { GET_ISP_TICKETS } from "@/graphql/isp_tickets";
import { Button } from "@/components/ui/button";
import { Plus, Ticket } from "lucide-react";
import { useParams } from "next/navigation";
import { KanbanBoard } from "./components/KanbanBoard";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import Link from "next/link";

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

  const canManageTickets = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    [OrganizationPermissions.MANAGE_ISP_MANAGER_TICKETS]
  );

  if (loading) {
    return <TableSkeleton columns={4} rows={5} />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-500">Error loading tickets: {error.message}</p>
      </div>
    );
  }

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

      <KanbanBoard tickets={data?.tickets?.tickets || []} />
    </div>
  );
}

