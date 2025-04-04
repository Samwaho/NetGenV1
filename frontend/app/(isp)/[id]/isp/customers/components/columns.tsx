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
function ActionsCell({ customer }: { customer: ISPCustomer }) {
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const columns: ColumnDef<ISPCustomer>[] = [
  {
    accessorKey: "username",
    header: "Username",
  },
  {
    accessorKey: "firstName",
    header: "First Name",
  },
  {
    accessorKey: "lastName",
    header: "Last Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge
          variant={status === "ACTIVE" ? "default" : "destructive"}
          className="capitalize"
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
        <Badge variant={online ? "default" : "secondary"}>
          {online ? "Online" : "Offline"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "package.name",
    header: "Package",
  },
  {
    accessorKey: "station.name",
    header: "Station",
  },
  {
    accessorKey: "expirationDate",
    header: "Expiration Date",
    cell: ({ row }) => {
      const date = new Date(row.getValue("expirationDate"));
      return date.toLocaleDateString();
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell customer={row.original} />,
  },
]; 
