"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  Table as TableInstance
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
import { useState, useCallback, useMemo, memo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerFilterOptions } from "@/graphql/isp_customers";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount?: number;
  filterOptions?: CustomerFilterOptions;
  onFilterChange?: (filters: CustomerFilterOptions) => void;
  isLoading?: boolean;
}

// Memoized pagination controls component with proper generic type
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
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
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
  filterOptions = {
    page: 1,
    pageSize: 10,
    sortBy: "createdAt",
    sortDirection: "desc",
  },
  onFilterChange,
  isLoading = false,
}: DataTableProps<TData, TValue>) {
  // Local state for server-driven table configuration
  const [globalFilterValue, setGlobalFilterValue] = useState<string>(() => filterOptions.search || "");
  
  // Default page sizes - memoize to prevent recreation
  const pageSizeOptions = useMemo(() => [10, 20, 30, 40, 50], []);
  
  // Memoize the initial table state from server filter options
  const initialState = useMemo(
    () => ({
      pagination: { 
        pageIndex: (filterOptions.page || 1) - 1, // Convert 1-indexed to 0-indexed
        pageSize: filterOptions.pageSize || 10,
      }
    }),
    [filterOptions.page, filterOptions.pageSize]
  );

  // Create the table instance outside of useMemo
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
    pageCount: Math.ceil(totalCount / (filterOptions.pageSize || 10)),
    initialState,
    onPaginationChange: (updater) => {
      if (!onFilterChange) return;
      
      const nextState = typeof updater === 'function' 
        ? updater(table.getState().pagination) 
        : updater;
        
      // Only update if there are actual changes
      if (nextState.pageIndex + 1 !== filterOptions.page || 
          nextState.pageSize !== filterOptions.pageSize) {
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
        pageSize: filterOptions.pageSize || 10,
      },
    },
  });

  // Memoize table state values that are used in the UI
  const { pageSize, pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const rowCount = totalCount;
  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex < pageCount - 1;

  // Handle page size change manually - memoize the handler
  const handlePageSizeChange = useCallback((value: string) => {
    const newPageSize = Number(value);
    if (onFilterChange && newPageSize !== filterOptions.pageSize) {
      onFilterChange({
        ...filterOptions,
        pageSize: newPageSize,
        page: 1, // Reset to first page when changing page size
      });
    }
  }, [filterOptions, onFilterChange]);

  return (
    <div className="space-y-4 p-2 sm:p-4 bg-card rounded-2xl shadow-md dark:border">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2 sm:py-4">
        <Input
          placeholder="Search all fields..."
          value={globalFilterValue}
          onChange={(event) => setGlobalFilterValue(event.target.value)}
          className="w-full sm:max-w-sm text-sm sm:text-base"
          aria-label="Search"
          disabled={isLoading}
        />
        <div className="flex items-center space-x-2">
          <Select
            value={`${pageSize}`}
            onValueChange={handlePageSizeChange}
            disabled={isLoading}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs sm:text-sm">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  {isLoading ? (
                    <div className="flex justify-center items-center">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Loading data...
                    </div>
                  ) : (
                    "No results."
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-2 py-2 sm:py-4">
        <div className="flex-1 text-xs sm:text-sm text-muted-foreground">
          {rowCount} row(s) total
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
