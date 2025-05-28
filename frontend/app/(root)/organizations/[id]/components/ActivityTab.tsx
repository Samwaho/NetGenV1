"use client";

import { useQuery, useMutation } from "@apollo/client";
import { GET_ACTIVITIES } from "@/graphql/activity";
import { CLEAR_OLD_ACTIVITIES } from "@/graphql/activity";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDateToNowInTimezone } from "@/lib/utils";
import { Clock, Activity as ActivityIcon, AlertCircle, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
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
import { toast } from "sonner";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { Organization } from "@/types/organization";
import { isToday, isThisMonth, parseISO, differenceInDays } from "date-fns";

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
  organization: Organization;
  currentUserId: string;
};

export const ActivityTab = ({ organizationId, organization, currentUserId }: ActivityTabProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, loading, error, refetch } = useQuery(GET_ACTIVITIES, {
    variables: { 
      organizationId,
      limit: pageSize,
      skip: page * pageSize
    },
    skip: !organizationId
  });

  const [clearOldActivities, { loading: clearing }] = useMutation(CLEAR_OLD_ACTIVITIES, {
    onCompleted: (data) => {
      if (data.clearOldActivities.success) {
        toast.success(data.clearOldActivities.message);
      } else {
        toast.error(data.clearOldActivities.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
    refetchQueries: [
      { query: GET_ACTIVITIES, variables: { organizationId, limit: 100, skip: 0 } },
    ],
  });

  const columns: ColumnDef<Activity>[] = useMemo(() => [
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
  ], []);

  const allActivities = data?.activities?.activities || [];
  const totalCount = data?.activities?.total_count || 0;
  const filteredActivities = useMemo(() =>
    allActivities.filter((activity: Activity) => {
      if (timeFilter === "all") return true;
      const createdAt = typeof activity.createdAt === "string" ? parseISO(activity.createdAt) : new Date(activity.createdAt);
      if (timeFilter === "today") return isToday(createdAt);
      if (timeFilter === "week") return differenceInDays(new Date(), createdAt) < 7;
      if (timeFilter === "month") return isThisMonth(createdAt);
      return true;
    })
  , [allActivities, timeFilter]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const table = useReactTable({
    data: filteredActivities,
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

  const canViewActivity =  hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.VIEW_ACTIVITY
  );
  const canClearActivity =  hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.CLEAR_ACTIVITY
  );

  if (!canViewActivity) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-muted-foreground py-8">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>You do not have permission to view activities.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 bg-card rounded-2xl shadow-md dark:border p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
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
        {canClearActivity && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => clearOldActivities({ variables: { days: 90 } })}
            className="ml-auto flex items-center"
            disabled={clearing}
          >
            {clearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {clearing ? "Clearing..." : "Clear Old Activities"}
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
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
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(0)}
            disabled={page === 0}
            className="h-8 w-8 p-0"
          >
            {"<<"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-8 px-2"
          >
            Previous
          </Button>
          <span className="px-2 text-xs">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="h-8 px-2"
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="h-8 w-8 p-0"
          >
            {">>"}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground ml-4">
          {totalCount} activities total
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




