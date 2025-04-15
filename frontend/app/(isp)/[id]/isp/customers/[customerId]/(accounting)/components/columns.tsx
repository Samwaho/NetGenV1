"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ISPCustomerAccounting } from "@/types/isp_customer_accounting";
import { formatBytes, formatDateToNowInTimezone, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const columns: ColumnDef<ISPCustomerAccounting>[] = [
  {
    accessorKey: "timestamp",
    header: "Time",
    cell: ({ row }) => formatDateToNowInTimezone(row.getValue("timestamp")),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      let color = "default";
      switch (status) {
        case "Start":
          color = "green";
          break;
        case "Stop":
          color = "red";
          break;
        case "Interim-Update":
          color = "blue";
          break;
      }
      return <Badge variant={color as any}>{status}</Badge>;
    },
  },
  {
    accessorKey: "sessionTime",
    header: "Duration",
    cell: ({ row }) => formatDuration(row.getValue("sessionTime")),
  },
  {
    accessorKey: "totalInputBytes",
    header: "Download",
    cell: ({ row }) => formatBytes(row.getValue("totalInputBytes")),
  },
  {
    accessorKey: "totalOutputBytes",
    header: "Upload",
    cell: ({ row }) => formatBytes(row.getValue("totalOutputBytes")),
  },
  {
    accessorKey: "framedIpAddress",
    header: "IP Address",
  },
  {
    accessorKey: "terminateCause",
    header: "Terminate Cause",
  },
];