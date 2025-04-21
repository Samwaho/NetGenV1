"use client";

import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client";
import { EditTicketForm } from "../../components/EditTicketForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { GET_ISP_TICKET, UPDATE_ISP_TICKET } from "@/graphql/isp_tickets";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  ShieldAlert, 
  CircleDot, 
  Timer, 
  Clock, 
  CheckCircle2, 
  ArrowDown, 
  ArrowRight, 
  ArrowUp,
  Calendar as CalendarIcon 
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

function EditTicketSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-10 w-full" />
      </div>
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

  const isPageLoading = userLoading || orgLoading || ticketLoading;
  
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

  const users = organization?.members
    .map((member: { user: { id: string; name: string } }) => member.user)
    .filter(Boolean) || [];

  const handleSubmit = async (data: {
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    category: string;
    customerId?: string;
    assignedTo?: string;
    dueDate?: Date;
  }) => {
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

  if (!canViewTickets) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don&apos;t have permission to view tickets.
        </p>
      </div>
    );
  }

  if (!canManageTickets) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don&apos;t have permission to edit tickets.
        </p>
      </div>
    );
  }

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
    <div className="container max-w-5xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-8">
        <BackButton />
        <Button
          variant="outline"
          onClick={() => router.push(`/${organizationId}/isp/tickets/${ticketId}`)}
          className="hover:bg-accent"
        >
          View Ticket
        </Button>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary/60 to-primary text-transparent bg-clip-text">
              Edit Ticket
            </span>
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Update ticket information and settings
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-8">
            <div className="bg-card rounded-lg p-4 border border-border/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <StatusIcon status={ticket.status} />
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-lg font-semibold">{ticket.status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <PriorityIcon priority={ticket.priority} />
                  <div>
                    <p className="text-sm text-muted-foreground">Priority</p>
                    <p className="text-lg font-semibold">{ticket.priority}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="text-lg font-semibold">
                      {format(new Date(ticket.createdAt), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <EditTicketForm
              initialData={initialData}
              onSubmit={handleSubmit}
              users={users}
              isLoading={updateLoading}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const StatusIcon = ({ status }: { status: string }) => {
  const statusConfig = {
    OPEN: { color: 'text-emerald-500', icon: CircleDot },
    IN_PROGRESS: { color: 'text-blue-500', icon: Timer },
    PENDING: { color: 'text-yellow-500', icon: Clock },
    CLOSED: { color: 'text-slate-500', icon: CheckCircle2 },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.OPEN;
  const Icon = config.icon;

  return (
    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
      <Icon className={cn("h-5 w-5", config.color)} />
    </div>
  );
};

const PriorityIcon = ({ priority }: { priority: string }) => {
  const priorityConfig = {
    LOW: { color: 'text-emerald-500', icon: ArrowDown },
    MEDIUM: { color: 'text-yellow-500', icon: ArrowRight },
    HIGH: { color: 'text-red-500', icon: ArrowUp },
  };

  const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.MEDIUM;
  const Icon = config.icon;

  return (
    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
      <Icon className={cn("h-5 w-5", config.color)} />
    </div>
  );
};


