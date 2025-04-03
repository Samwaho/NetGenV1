"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { StationActions } from "./StationActions";
import { formatDateToNowInTimezone } from "@/lib/utils";

export const columns: ColumnDef<any>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: "location",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Location" />
    ),
  },
  {
    accessorKey: "buildingType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Building Type" />
    ),
    cell: ({ row }) => {
      const buildingType = row.getValue("buildingType") as string;
      return buildingType.charAt(0) + buildingType.slice(1).toLowerCase();
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
        ACTIVE: "secondary",
        INACTIVE: "destructive",
        MAINTENANCE: "outline",
        OFFLINE: "destructive",
      };

      return (
        <Badge variant={variants[status]}>{status}</Badge>
      );
    },
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
    cell: ({ row }) => <StationActions station={row.original} />,
  },
];




