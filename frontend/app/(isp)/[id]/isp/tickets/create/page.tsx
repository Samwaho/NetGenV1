"use client";

import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TicketForm } from "../components/TicketForm";
import { toast } from "sonner";
import { GET_ISP_CUSTOMERS } from "@/graphql/isp_customers";
import { CREATE_ISP_TICKET } from "@/graphql/isp_tickets";
import { useOrganization } from "@/hooks/useOrganization";
import { useUser } from "@/hooks/useUser";
import { OrganizationPermissions } from "@/lib/permissions";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { hasOrganizationPermissions } from "@/lib/permission-utils";

export default function CreateTicketPage() {
  const router = useRouter();
  const params = useParams();
  const organizationId = params.id as string;

  const { organization, loading: orgLoading } = useOrganization(organizationId);
  const { user, loading: userLoading } = useUser();

  const { data: customersData, loading: customersLoading } = useQuery(GET_ISP_CUSTOMERS, {
    variables: { organizationId },
  });

  const [createTicket, { loading: isSubmitting }] = useMutation(CREATE_ISP_TICKET, {
    onCompleted: (data) => {
      if (data.createTicket.success) {
        toast.success("Ticket created successfully");
        router.push(`/${organizationId}/isp/tickets`);
      } else {
        toast.error(data.createTicket.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
    refetchQueries: ["GetISPTickets"],
  });

  const isPageLoading = userLoading || orgLoading || customersLoading;

  const canCreateTickets = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.MANAGE_ISP_MANAGER_TICKETS
  );

  const users = organization?.members
    .map((member: { user: { id: string; name: string } }) => member.user)
    .filter(Boolean) || [];

  // Correctly extract customers from the nested response
  const customers = customersData?.customers?.customers || [];

  const handleSubmit = async (data: {
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    category: string;
    customerId?: string;
    assignedTo?: string;
    dueDate?: Date;
  }) => {
    await createTicket({
      variables: {
        input: {
          ...data,
          organizationId,
        },
      },
    });
  };

  if (isPageLoading) {
    return <LoadingSpinner />;
  }

  if (!canCreateTickets) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md">
          You don't have permission to create tickets
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gradient-custom">Create New Ticket</h1>
          <p className="text-muted-foreground mt-1">
            Create a new support ticket for customer
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/${organizationId}/isp/tickets`)}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to Tickets
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-6">
          <TicketForm
            onSubmit={handleSubmit}
            customers={customers}
            users={users}
            isLoading={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}


