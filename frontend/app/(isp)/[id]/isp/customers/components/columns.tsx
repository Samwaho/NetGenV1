import { ColumnDef } from "@tanstack/react-table";
import { ISPCustomer } from "@/types/isp_customer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter, useParams } from "next/navigation";
import { useMutation } from "@apollo/client";
import { DELETE_ISP_CUSTOMER } from "@/graphql/isp_customers";
import { toast } from "sonner";
import { useState, memo } from "react";

// Separate component for actions cell
const ActionsCell = memo(({ customer, canManageCustomers }: { customer: ISPCustomer; canManageCustomers: boolean }) => {
  const router = useRouter();
  const params = useParams();
  const organizationId = params.id as string;
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [deleteCustomer] = useMutation(DELETE_ISP_CUSTOMER, {
    update: (cache) => {
      // Properly handle cache updates after deletion
      const normalizedId = cache.identify({ id: customer.id, __typename: 'ISPCustomer' });
      cache.evict({ id: normalizedId });
      cache.gc();
    },
    onCompleted: () => {
      toast.success("Customer deleted successfully");
      setIsDeleting(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete customer");
      setIsDeleting(false);
    }
  });

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteCustomer({
        variables: { id: customer.id },
      });
    } catch {
      // Error is handled in onError callback
    }
  };

  // Prefetch the edit page on hover
  const prefetchEdit = () => {
    router.prefetch(`/${organizationId}/isp/customers/${customer.id}/edit`);
  };

  // Prefetch the details page on hover
  const prefetchDetails = () => {
    router.prefetch(`/${organizationId}/isp/customers/${customer.id}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isDeleting}>
          <span className="sr-only">Open menu</span>
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => router.push(`/${organizationId}/isp/customers/${customer.id}`)}
          onMouseEnter={prefetchDetails}
        >
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/${organizationId}/isp/customers/${customer.id}/payments`)}
          onMouseEnter={prefetchDetails}
        >
          View Payment History
        </DropdownMenuItem>
        {canManageCustomers && (
          <>
            <DropdownMenuItem
              onClick={() => router.push(`/${organizationId}/isp/customers/${customer.id}/edit`)}
              onMouseEnter={prefetchEdit}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
ActionsCell.displayName = "ActionsCell";

// Format date consistently
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return 'Invalid date';
  }
};

// Define columns as a regular function - no need for useMemo here as it's called once
// and the component using it will handle memoization if needed
export const columns = (canManageCustomers: boolean): ColumnDef<ISPCustomer>[] => [
  {
    accessorKey: "username",
    header: "Username",
    cell: ({ row }) => (
      <div className="font-medium text-sm sm:text-base">
        {row.getValue("username")}
      </div>
    ),
  },
  {
    accessorKey: "firstName",
    header: "First Name",
    cell: ({ row }) => (
      <div className="text-sm sm:text-base">
        {row.getValue("firstName")}
      </div>
    ),
  },
  {
    accessorKey: "lastName",
    header: "Last Name",
    cell: ({ row }) => (
      <div className="text-sm sm:text-base">
        {row.getValue("lastName")}
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <div className="text-sm sm:text-base">
        {row.getValue("email")}
      </div>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => (
      <div className="text-sm sm:text-base">
        {row.getValue("phone")}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge
          variant={status === "ACTIVE" ? "default" : "destructive"}
          className="capitalize text-xs sm:text-sm"
        >
          {status.toLowerCase()}
        </Badge>
      );
    },
  },
  {
    accessorKey: "online",
    header: "Online",
    cell: ({ row }) => {
      const online = row.getValue("online") as boolean;
      return (
        <Badge variant={online ? "default" : "secondary"} className="text-xs sm:text-sm">
          {online ? "Online" : "Offline"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "package",
    header: "Package",
    cell: ({ row }) => (
      <div className="text-sm sm:text-base">
        {row.original.package?.name || '-'}
      </div>
    ),
  },
  {
    accessorKey: "station",
    header: "Station",
    cell: ({ row }) => (
      <div className="text-sm sm:text-base">
        {row.original.station?.name || '-'}
      </div>
    ),
  },
  {
    accessorKey: "expirationDate",
    header: "Expiration Date",
    cell: ({ row }) => {
      return (
        <div className="text-sm sm:text-base">
          {formatDate(row.getValue("expirationDate") as string)}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell customer={row.original} canManageCustomers={canManageCustomers} />,
  },
]; 
