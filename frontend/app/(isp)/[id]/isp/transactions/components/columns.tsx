"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ISPTransaction, TransactionType } from "@/types/isp_transaction";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

const getTransactionTypeLabel = (type: string): string => {
  switch (type) {
    case TransactionType.CUSTOMER_PAYMENT:
      return "Customer Payment";
    case TransactionType.HOTSPOT_VOUCHER:
      return "Hotspot Voucher";
    case TransactionType.STK_PUSH:
      return "STK Push";
    case TransactionType.C2B:
      return "C2B";
    default:
      return type;
  }
};

export const columns: ColumnDef<ISPTransaction>[] = [
  {
    accessorKey: "transactionId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Transaction ID" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.original.transactionId || "-"}</div>
    ),
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">
        KES {row.original.amount.toLocaleString()}
      </div>
    ),
  },
  {
    accessorKey: "phoneNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone Number" />
    ),
    cell: ({ row }) => <div>{row.original.phoneNumber || "-"}</div>,
  },
  {
    accessorKey: "transactionType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.original.transactionType;
      let variant: "default" | "secondary" | "outline" = "default";

      switch (type) {
        case TransactionType.CUSTOMER_PAYMENT:
          variant = "default";
          break;
        case TransactionType.HOTSPOT_VOUCHER:
          variant = "secondary";
          break;
        case TransactionType.STK_PUSH:
          variant = "outline";
          break;
        case TransactionType.C2B:
          variant = "outline";
          break;
        default:
          variant = "outline";
      }

      return (
        <Badge variant={variant}>
          {getTransactionTypeLabel(type)}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      let variant: "default" | "secondary" | "destructive" | "outline" = "default";
      let label = status;

      switch (status) {
        case "completed":
          variant = "default";
          break;
        case "pending":
          variant = "secondary";
          break;
        case "failed":
          variant = "destructive";
          break;
        default:
          variant = "outline";
      }

      return (
        <Badge variant={variant}>
          {label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "customerName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer Name" />
    ),
    cell: ({ row }) => {
      if (row.original.transactionType === "hotspot_voucher") {
        return <div>Hotspot User</div>;
      }
      const fullName = [
        row.original.firstName,
        row.original.middleName,
        row.original.lastName,
      ]
        .filter(Boolean)
        .join(" ");
      return <div>{fullName || "-"}</div>;
    },
  },
  {
    accessorKey: "voucherCode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Voucher Code" />
    ),
    cell: ({ row }) => {
      // Check for voucher code in any transaction type with hotspot_voucher callbackType
      if (row.original.voucherCode || row.original.callbackType === "hotspot_voucher") {
        return <div>{row.original.voucherCode || "-"}</div>;
      }
      return <div>-</div>;
    },
  },
  {
    accessorKey: "packageName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Package" />
    ),
    cell: ({ row }) => {
      // Check for package name in any transaction type with hotspot_voucher callbackType
      if (row.original.packageName || row.original.callbackType === "hotspot_voucher") {
        return <div>{row.original.packageName || "-"}</div>;
      }
      return <div>-</div>;
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      return (
        <div className="text-muted-foreground">
          {format(date, "MMM dd, yyyy HH:mm")}
        </div>
      );
    },
  },
];

