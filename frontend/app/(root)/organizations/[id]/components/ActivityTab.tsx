"use client";

import { useQuery } from "@apollo/client";
import { GET_ACTIVITIES } from "@/graphql/activity";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDateToNowInTimezone } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock, Activity as ActivityIcon, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Activity = {
  id: string;
  action: string;
  userDetails: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  organization: {
    id: string;
    name: string;
  };
  createdAt: string;
};

type ActivityTabProps = {
  organizationId: string;
};

export const ActivityTab = ({ organizationId }: ActivityTabProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");

  const { data, loading, error } = useQuery(GET_ACTIVITIES, {
    variables: { 
      organizationId,
      limit: 100, // Adjust as needed
      skip: 0
    },
    skip: !organizationId,
    pollInterval: 30000, // Poll every 30 seconds for new activities
  });

  const columns: ColumnDef<Activity>[] = [
    {
      accessorFn: (row) => row.userDetails ? `${row.userDetails.firstName} ${row.userDetails.lastName}` : 'Deleted User',
      id: "user",
      header: "User",
      cell: ({ row }) => {
        const activity = row.original;
        
        // Handle case where user details are not available
        if (!activity.userDetails) {
          return (
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-muted">
                  DU
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm text-muted-foreground">
                  Deleted User
                </p>
              </div>
            </div>
          );
        }

        return (
          <div className="flex items-center space-x-3 ">
            <Avatar className="h-8 w-8">
              <AvatarImage src={`https://avatar.vercel.sh/${activity.userDetails.email}`} />
              <AvatarFallback className="">
                {`${activity.userDetails.firstName[0]}${activity.userDetails.lastName[0]}`}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">
                {activity.userDetails.firstName} {activity.userDetails.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {activity.userDetails.email}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <div className="text-sm">{row.original.action}</div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Time",
      cell: ({ row }) => (
        <div className="flex items-center text-xs text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          {formatDateToNowInTimezone(row.original.createdAt)}
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: data?.activities?.activities || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  });

  if (!organizationId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-muted-foreground py-8">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>Organization ID is required</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <ActivityLoadingSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-destructive py-8">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>Error loading activities</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 bg-card rounded-2xl shadow-md dark:border p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search activities..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Past week</SelectItem>
            <SelectItem value="month">Past month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs sm:text-sm">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <ActivityIcon className="h-12 w-12 mb-4" />
                    <p className="text-lg font-medium">No activities found</p>
                    <p className="text-sm">Activities will appear here as they happen</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="h-8 w-8 p-0"
          >
            {"<<"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 px-2"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 px-2"
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="h-8 w-8 p-0"
          >
            {">>"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const ActivityLoadingSkeleton = () => (
  <Card>
    <CardContent className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="h-10 w-[250px] bg-muted rounded-md animate-pulse" />
        <div className="h-10 w-[180px] bg-muted rounded-md animate-pulse" />
      </div>

      <div className="rounded-md border">
        <div className="h-10 bg-muted/50" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border-t">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/4 bg-muted rounded animate-pulse" />
              <div className="h-3 w-1/6 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);




