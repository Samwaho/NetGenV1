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

  const [deleteTicket] = useMutation(DELETE_ISP_TICKET, {
    onCompleted: () => {
      toast.success("Ticket deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent card click navigation
    await deleteTicket({
      variables: { id: ticket.id },
      update: (cache) => {
        cache.evict({ id: cache.identify({ id: ticket.id, __typename: 'Ticket' }) });
        cache.gc();
      },
    });
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent card click navigation
    router.push(`/${organizationId}/isp/tickets/${ticket.id}/edit`);
  };

  return (
    <Link href={`/${organizationId}/isp/tickets/${ticket.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="p-4 pb-2">
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
        </CardHeader>
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

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => e.preventDefault()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the ticket.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={(e) => e.preventDefault()}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}


