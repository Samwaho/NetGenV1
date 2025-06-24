"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  Table as TableInstance,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, memo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface ActivityTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount?: number;
  filterOptions: {
    page: number;
    pageSize: number;
    timeFilter: string;
    search: string;
  };
  onFilterChange: (filters: any) => void;
  isLoading?: boolean;
  canClearActivity?: boolean;
  onClearOldActivities?: () => void;
  clearing?: boolean;
}

const PaginationControls = memo(({ 
  table,
  canPreviousPage,
  canNextPage,
  pageCount,
  isLoading
}: { 
  table: TableInstance<unknown>;
  canPreviousPage: boolean;
  canNextPage: boolean;
  pageCount: number;
  isLoading?: boolean;
}) => (
  <div className="flex items-center space-x-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => table.setPageIndex(0)}
      disabled={!canPreviousPage || isLoading}
      className="h-8 w-8 p-0"
      aria-label="First page"
    >
      <ChevronsLeft className="h-4 w-4" />
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => table.previousPage()}
      disabled={!canPreviousPage || isLoading}
      className="h-8 px-2"
    >
      <ChevronLeft className="mr-1 h-4 w-4" />
      Previous
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => table.nextPage()}
      disabled={!canNextPage || isLoading}
      className="h-8 px-2"
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Next
      <ChevronRight className="ml-1 h-4 w-4" />
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => table.setPageIndex(pageCount - 1)}
      disabled={!canNextPage || isLoading}
      className="h-8 w-8 p-0"
      aria-label="Last page"
    >
      <ChevronsRight className="h-4 w-4" />
    </Button>
  </div>
));
PaginationControls.displayName = "PaginationControls";

export function DataTable<TData, TValue>({
  columns,
  data,
  totalCount = 0,
  filterOptions,
  onFilterChange,
  isLoading = false,
  canClearActivity = false,
  onClearOldActivities,
  clearing = false,
}: ActivityTableProps<TData, TValue>) {
  const pageSizeOptions = useMemo(() => [10, 20, 30, 40, 50], []);
  const initialState = useMemo(
    () => ({
      pagination: {
        pageIndex: (filterOptions.page || 1) - 1,
        pageSize: filterOptions.pageSize || 20,
      },
    }),
    [filterOptions.page, filterOptions.pageSize]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    getPaginationRowModel: getPaginationRowModel(),
    manualSorting: true,
    getSortedRowModel: getSortedRowModel(),
    manualFiltering: true,
    getFilteredRowModel: getFilteredRowModel(),
    pageCount: Math.ceil(totalCount / (filterOptions.pageSize || 20)),
    initialState,
    onPaginationChange: (updater) => {
      if (!onFilterChange) return;
      const nextState = typeof updater === "function"
        ? updater(table.getState().pagination)
        : updater;
      if (
        nextState.pageIndex + 1 !== filterOptions.page ||
        nextState.pageSize !== filterOptions.pageSize
      ) {
        onFilterChange({
          ...filterOptions,
          page: nextState.pageIndex + 1,
          pageSize: nextState.pageSize,
        });
      }
    },
    state: {
      pagination: {
        pageIndex: (filterOptions.page || 1) - 1,
        pageSize: filterOptions.pageSize || 20,
      },
    },
  });

  const { pageSize, pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const rowCount = totalCount;
  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex < pageCount - 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2 sm:py-4">
        <Input
          placeholder="Search activities..."
          value={filterOptions.search}
          onChange={(event) => onFilterChange({ ...filterOptions, search: event.target.value, page: 1 })}
          className="w-full sm:max-w-sm text-sm sm:text-base"
          aria-label="Search"
          disabled={isLoading}
        />
        <div className="flex items-center space-x-2">
          <Select
            value={filterOptions.timeFilter}
            onValueChange={(value) => onFilterChange({ ...filterOptions, timeFilter: value, page: 1 })}
            disabled={isLoading}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs sm:text-sm">
              <SelectValue placeholder="Filter by time" />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Past week</SelectItem>
              <SelectItem value="month">Past month</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => onFilterChange({ ...filterOptions, pageSize: Number(value), page: 1 })}
            disabled={isLoading}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs sm:text-sm">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canClearActivity && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onClearOldActivities}
              className="ml-auto flex items-center"
              disabled={clearing}
            >
              {clearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {clearing ? "Clearing..." : "Clear Old Activities"}
            </Button>
          )}
        </div>
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
                    <TableCell key={cell.id} className="text-xs sm:text-sm">
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
                  className="h-24 text-center text-sm sm:text-base"
                >
                  No activities found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-2 py-2 sm:py-4">
        <div className="flex-1 text-xs sm:text-sm text-muted-foreground">
          {rowCount} activities total
        </div>
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-xs sm:text-sm font-medium">Page</p>
            <span className="text-xs sm:text-sm font-medium">
              {pageIndex + 1} of {pageCount || 1}
            </span>
          </div>
          <PaginationControls 
            table={table as TableInstance<unknown>} 
            canPreviousPage={canPreviousPage} 
            canNextPage={canNextPage}
            pageCount={pageCount}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
} 