"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ISPTransaction } from "@/types/isp_transaction";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

export const columns: ColumnDef<ISPTransaction>[] = [
  {
    accessorKey: "transactionId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Transaction ID" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.original.transactionId}</div>
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
    cell: ({ row }) => (
      <div>{row.original.phoneNumber}</div>
    ),
  },
  {
    accessorKey: "customerName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer Name" />
    ),
    cell: ({ row }) => {
      const fullName = [
        row.original.firstName,
        row.original.middleName,
        row.original.lastName
      ].filter(Boolean).join(" ");
      return <div>{fullName}</div>;
    },
  },
  {
    accessorKey: "billRefNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bill Ref" />
    ),
    cell: ({ row }) => (
      <div>{row.original.billRefNumber}</div>
    ),
  },
  {
    accessorKey: "businessShortCode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Business Code" />
    ),
    cell: ({ row }) => (
      <div>{row.original.businessShortCode}</div>
    ),
  },
  {
    accessorKey: "transactionType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.original.transactionType;
      return (
        <Badge variant={type === "Pay Bill" ? "default" : "secondary"}>
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "orgAccountBalance",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Account Balance" />
    ),
    cell: ({ row }) => (
      <div className="text-right">
        KES {parseFloat(row.original.orgAccountBalance).toLocaleString()}
      </div>
    ),
  },
  {
    accessorKey: "transTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trans. Time" />
    ),
    cell: ({ row }) => {
      const transTime = row.getValue("transTime") as string;
      
      if (!transTime) {
        return <div className="text-muted-foreground">-</div>;
      }

      try {
        // Format: YYYYMMDDHHmmss to readable date
        const date = new Date(
          Number(transTime.slice(0, 4)),
          Number(transTime.slice(4, 6)) - 1,
          Number(transTime.slice(6, 8)),
          Number(transTime.slice(8, 10)),
          Number(transTime.slice(10, 12)),
          Number(transTime.slice(12, 14))
        );

        // Check if date is valid
        if (isNaN(date.getTime())) {
          return <div className="text-muted-foreground">Invalid date</div>;
        }

        return (
          <div className="text-muted-foreground">
            {format(date, "MMM dd, yyyy HH:mm")}
          </div>
        );
      } catch (error) {
        return <div className="text-muted-foreground">Invalid format</div>;
      }
    },
  }
];



