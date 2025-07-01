"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ISPPackage } from "@/types/isp_package";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { PackageActions } from "./PackageActions";

export const columns = (canManagePackages: boolean): ColumnDef<ISPPackage>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: "serviceType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Service Type" />
    ),
    cell: ({ row }) => {
      const serviceType = row.getValue("serviceType") as string;
      return (
        <Badge
          variant={
            serviceType === "PPPOE"
              ? "default"
              : serviceType === "HOTSPOT"
              ? "secondary"
              : "outline"
          }
        >
          {serviceType}
        </Badge>
      );
    },
  },
  {
    accessorKey: "downloadSpeed",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Download" />
    ),
    cell: ({ row }) => {
      const downloadSpeed = row.getValue("downloadSpeed") as number;
      const burstDownload = row.original.burstDownload;
      return (
        <div className="flex flex-col">
          <span>{downloadSpeed} Mbps</span>
          {burstDownload && (
            <span className="text-xs text-muted-foreground">
              Burst: {burstDownload} Mbps
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "uploadSpeed",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Upload" />
    ),
    cell: ({ row }) => {
      const uploadSpeed = row.getValue("uploadSpeed") as number;
      const burstUpload = row.original.burstUpload;
      return (
        <div className="flex flex-col">
          <span>{uploadSpeed} Mbps</span>
          {burstUpload && (
            <span className="text-xs text-muted-foreground">
              Burst: {burstUpload} Mbps
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "thresholdDownload",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Threshold" />
    ),
    cell: ({ row }) => {
      const thresholdDownload = row.original.thresholdDownload;
      const thresholdUpload = row.original.thresholdUpload;
      return (
        <div className="flex flex-col">
          {thresholdDownload && (
            <span className="text-xs">
              Down: {thresholdDownload} Mbps
            </span>
          )}
          {thresholdUpload && (
            <span className="text-xs">
              Up: {thresholdUpload} Mbps
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "burstTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Burst Time" />
    ),
    cell: ({ row }) => {
      const burstTime = row.getValue("burstTime") as number;
      return burstTime ? `${burstTime}s` : "-";
    },
  },
  {
    accessorKey: "addressPool",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Address Pool" />
    ),
    cell: ({ row }) => {
      const addressPool = row.getValue("addressPool") as string;
      return addressPool || "-";
    },
  },
  {
    accessorKey: "price",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Price" />
    ),
    cell: ({ row }) => {
      const price = row.getValue("price") as number;
      return <div className="font-medium">Ksh {price.toFixed(2)}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => canManagePackages ? (
      <PackageActions package={row.original} />
    ) : null,
  },
];
