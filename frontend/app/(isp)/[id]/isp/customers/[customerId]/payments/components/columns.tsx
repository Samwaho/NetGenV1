"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatKESCurrency, formatDateToNowInTimezone } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

export type Payment = {
  id: string;
  amount: number;
  status?: "COMPLETED" | "PENDING" | "FAILED";
  transactionId?: string;
  phoneNumber?: string;
  paidAt: string;
  package?: {
    id: string;
    name: string;
  };
  daysAdded?: number;
};

export const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: "paidAt",
    header: "Date",
    cell: ({ row }) => formatDateToNowInTimezone(row.getValue("paidAt")),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => formatKESCurrency(row.getValue("amount")),
  },
  {
    accessorKey: "package",
    header: "Package",
    cell: ({ row }) => {
      const packageData = row.getValue("package") as Payment["package"];
      return packageData?.name || "N/A";
    },
  },
  {
    accessorKey: "daysAdded",
    header: "Days Added",
    cell: ({ row }) => {
      const days = row.getValue("daysAdded");
      return days ? `${days} days` : "N/A";
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = (row.getValue("status") as string) || "COMPLETED";
      return (
        <Badge
          variant={
            status === "COMPLETED"
              ? "default"
              : status === "PENDING"
              ? "secondary"
              : "destructive"
          }
          className="flex items-center gap-1"
        >
          {status === "COMPLETED" ? (
            <Check className="h-3 w-3" />
          ) : status === "FAILED" ? (
            <X className="h-3 w-3" />
          ) : null}
          {status.charAt(0) + status.slice(1).toLowerCase()}
        </Badge>
      );
    },
  },
  {
    accessorKey: "transactionId",
    header: "Transaction ID",
    cell: ({ row }) => row.getValue("transactionId") || "N/A",
  },
  {
    accessorKey: "phoneNumber",
    header: "Phone Number",
    cell: ({ row }) => row.getValue("phoneNumber") || "N/A",
  },
];



