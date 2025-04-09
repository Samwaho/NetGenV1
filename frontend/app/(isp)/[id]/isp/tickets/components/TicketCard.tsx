import { Ticket } from "@/graphql/isp_tickets";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Pencil, Trash2, User2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useMutation } from "@apollo/client";
import { DELETE_ISP_TICKET } from "@/graphql/isp_tickets";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";

interface TicketCardProps {
  ticket: Ticket;
}

const priorityColors = {
  LOW: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  URGENT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const statusColors = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  RESOLVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CLOSED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export function TicketCard({ ticket }: TicketCardProps) {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { user } = useUser();
  const { organization } = useOrganization(organizationId);

  const canManageTickets = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.MANAGE_ISP_MANAGER_TICKETS
  );

  const [deleteTicket] = useMutation(DELETE_ISP_TICKET, {
    onCompleted: () => {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      toast.success("Ticket deleted successfully");
    },
    onError: (error) => {
      setIsDeleting(false);
      toast.error(error.message);
    },
    update: (cache) => {
      cache.evict({ id: `Ticket:${ticket.id}` });
      cache.gc();
    },
    refetchQueries: ['GetISPTickets'],
  });

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent card click navigation
    setIsDeleting(true);
    try {
      await deleteTicket({
        variables: { id: ticket.id }
      });
    } catch (error) {
      // Error is handled by onError above
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent card click navigation
    router.push(`/${organizationId}/isp/tickets/${ticket.id}/edit`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Stop event from reaching the Link component
    setIsDeleteDialogOpen(true);
  };

  return (
      <Card className="hover:bg-muted/50 transition-colors cursor-grab">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <h4 className="font-semibold text-sm line-clamp-2">{ticket.title}</h4>
              {ticket.customer && (
                <div className="flex items-center gap-1.5">
                  <User2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {ticket.customer.firstName} {ticket.customer.lastName}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Badge variant="secondary" className={priorityColors[ticket.priority]}>
                {ticket.priority}
              </Badge>
              <Badge variant="secondary" className={statusColors[ticket.status]}>
                {ticket.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
        </CardContent>
        <CardContent className="p-4 pt-2 space-y-2">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {ticket.description}
          </p>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {ticket.assignedTo ? (
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-6 w-6">
                    <AvatarImage
                      src={`https://avatar.vercel.sh/${ticket.assignedTo.email}`}
                      alt={`${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`}
                    />
                    <AvatarFallback>
                      {ticket.assignedTo.firstName[0]}
                      {ticket.assignedTo.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">
                    {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                  </span>
                </div>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Unassigned
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">
                {new Date(ticket.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {canManageTickets && (
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleEdit}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={handleDeleteClick}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Ticket</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this ticket? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>
  );
}


