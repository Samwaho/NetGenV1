"use client";

import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client";
import { EditTicketForm } from "../../components/EditTicketForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { GET_ISP_TICKET, UPDATE_ISP_TICKET } from "@/graphql/isp_tickets";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";

function EditTicketSkeleton() {
  return (
    <div className="space-y-4">
      {/* Title field skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" /> {/* Label */}
        <Skeleton className="h-10 w-full" /> {/* Input */}
      </div>

      {/* Description field skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" /> {/* Label */}
        <Skeleton className="h-32 w-full" /> {/* Textarea */}
      </div>

      {/* Priority field skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" /> {/* Label */}
        <Skeleton className="h-10 w-full" /> {/* Select */}
      </div>

      {/* Category field skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" /> {/* Label */}
        <Skeleton className="h-10 w-full" /> {/* Input */}
      </div>

      {/* Assigned To field skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" /> {/* Label */}
        <Skeleton className="h-10 w-full" /> {/* Select */}
      </div>

      {/* Due Date field skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" /> {/* Label */}
        <Skeleton className="h-10 w-full" /> {/* Date picker */}
      </div>

      {/* Submit button skeleton */}
      <Skeleton className="h-10 w-[120px] mt-6" />
    </div>
  );
}

const BackButton = () => {
  const router = useRouter();
  const params = useParams();
  const organizationId = params.id as string;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.push(`/${organizationId}/isp/tickets`)}
      className="hover:bg-transparent hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back to Tickets
    </Button>
  );
};

export default function EditTicketPage() {
  const router = useRouter();
  const params = useParams();
  const organizationId = params.id as string;
  const ticketId = params.ticketId as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  const { data: ticketData, loading: ticketLoading } = useQuery(GET_ISP_TICKET, {
    variables: { id: ticketId },
    fetchPolicy: "network-only"
  });

  const isPageLoading = userLoading || orgLoading || ticketLoading;

  if (isPageLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <BackButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold tracking-tight">
              <Skeleton className="h-8 w-[200px]" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EditTicketSkeleton />
          </CardContent>
        </Card>
      </div>
    );
  }

  const canViewTickets = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.VIEW_ISP_MANAGER_TICKETS
  );

  console.log(canViewTickets);

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

  if (!canManageTickets) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don&apos;t have permission to edit tickets.
        </p>
      </div>
    );
  }

  const [updateTicket, { loading: updateLoading }] = useMutation(UPDATE_ISP_TICKET, {
    onCompleted: (data) => {
      if (data.updateTicket.success) {
        toast.success("Ticket updated successfully");
        router.push(`/${organizationId}/isp/tickets`);
      } else {
        toast.error(data.updateTicket.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = async (data: any) => {
    const { ...updateData } = data;
    
    await updateTicket({
      variables: {
        input: {
          id: ticketId,
          ...updateData,
        },
      },
    });
  };

  const users = organization?.members
    .map((member: any) => member.user)
    .filter(Boolean) || [];

  // Check if we have the ticket data
  if (!ticketData?.ticket) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <BackButton />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              Ticket not found
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ticket = ticketData.ticket;
  
  const initialData = {
    title: ticket.title || "",
    description: ticket.description || "",
    priority: ticket.priority || "MEDIUM",
    category: ticket.category || "",
    assignedTo: ticket.assignedTo?.id || "",
    dueDate: ticket.dueDate ? new Date(ticket.dueDate) : undefined,
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center gap-4 mb-6">
        <BackButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight text-gradient-custom">
            Edit Ticket
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EditTicketForm
            initialData={initialData}
            onSubmit={handleSubmit}
            users={users}
            isLoading={updateLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}









