import { ColumnDef } from "@tanstack/react-table";
import { ISPCustomer } from "@/types/isp_customer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
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

// Separate component for actions cell
function ActionsCell({ customer, canManageCustomers }: { customer: ISPCustomer; canManageCustomers: boolean }) {
  const router = useRouter();
  const params = useParams();
  const organizationId = params.id as string;
  const [deleteCustomer] = useMutation(DELETE_ISP_CUSTOMER);

  const handleDelete = async () => {
    try {
      await deleteCustomer({
        variables: { id: customer.id },
        update: (cache) => {
          const normalizedId = cache.identify({ id: customer.id, __typename: 'ISPCustomer' });
          cache.evict({ id: normalizedId });
          cache.gc();
        },
      });
      toast.success("Customer deleted successfully");
    } catch {
      toast.error("Failed to delete customer");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => router.push(`/${organizationId}/isp/customers/${customer.id}`)}
        >
          View Details
        </DropdownMenuItem>
        {canManageCustomers && (
          <>
            <DropdownMenuItem
              onClick={() => router.push(`/${organizationId}/isp/customers/${customer.id}/edit`)}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={handleDelete}
            >
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
    accessorKey: "package.name",
    header: "Package",
    cell: ({ row }) => (
      <div className="text-sm sm:text-base">
        {row.getValue("package.name")}
      </div>
    ),
  },
  {
    accessorKey: "station.name",
    header: "Station",
    cell: ({ row }) => (
      <div className="text-sm sm:text-base">
        {row.getValue("station.name")}
      </div>
    ),
  },
  {
    accessorKey: "expirationDate",
    header: "Expiration Date",
    cell: ({ row }) => {
      const date = new Date(row.getValue("expirationDate"));
      return (
        <div className="text-sm sm:text-base">
          {date.toLocaleDateString()}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell customer={row.original} canManageCustomers={canManageCustomers} />,
  },
]; 
