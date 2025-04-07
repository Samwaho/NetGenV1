"use client";
import { ColumnDef } from "@tanstack/react-table";
import { ISPInventory } from "@/types/isp_inventory";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DataTableRowActions } from "./RowActions";
import { Badge } from "@/components/ui/badge";
import { formatDateToNowInTimezone } from "@/lib/utils";

export const columns = (canManage: boolean): ColumnDef<ISPInventory>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: "category",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
  },
  {
    accessorKey: "quantity",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Quantity" />
    ),
    cell: ({ row }) => {
      const quantity = row.original.quantity;
      const threshold = row.original.quantityThreshold || 0;
      const isLowStock = quantity <= threshold;

      return (
        <div className="flex items-center gap-2">
          <span>{quantity}</span>
          {isLowStock && (
            <Badge variant="destructive" className="text-xs">
              Low Stock
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge
          variant={status === "ACTIVE" ? "default" : "secondary"}
          className="text-xs"
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "location",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Location" />
    ),
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Updated" />
    ),
    cell: ({ row }) => formatDateToNowInTimezone(row.getValue("updatedAt")),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return canManage ? <DataTableRowActions row={row} /> : null;
    },
  },
];