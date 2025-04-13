"use client";

import { useState, useCallback, useMemo, memo } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  Table as TableInstance,
  PaginationState
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InventoryFilterOptions } from "@/graphql/isp_inventory";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount?: number;
  filterOptions?: InventoryFilterOptions;
  onFilterChange?: (filters: InventoryFilterOptions) => void;
  isLoading?: boolean;
}

// Type-safe pagination controls component
interface PaginationControlsProps<TData> {
  table: TableInstance<TData>;
  canPreviousPage: boolean;
  canNextPage: boolean;
  pageCount: number;
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  isLoading?: boolean;
}

function PaginationControlsComponent<TData>({ 
  table,
  canPreviousPage,
  canNextPage,
  pageCount,
  isLoading
}: PaginationControlsProps<TData>) {
  return (
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
  );
}

// Memoized version
const PaginationControls = memo(PaginationControlsComponent) as typeof PaginationControlsComponent;

// Type-safe view options component
interface ViewOptionsProps<TData> {
  table: TableInstance<TData>;
}

function ViewOptionsComponent<TData>({ table }: ViewOptionsProps<TData>) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-sm text-muted-foreground">View</p>
      <Select
        value={`${table.getState().pagination.pageSize}`}
        onValueChange={(value) => {
          table.setPageSize(Number(value));
        }}
      >
        <SelectTrigger className="h-8 w-[70px]">
          <SelectValue placeholder={table.getState().pagination.pageSize} />
        </SelectTrigger>
        <SelectContent side="top">
          {[10, 20, 30, 50, 100].map((pageSize) => (
            <SelectItem key={pageSize} value={`${pageSize}`}>
              {pageSize}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Memoized version
const ViewOptions = memo(ViewOptionsComponent) as typeof ViewOptionsComponent;

export function DataTable<TData, TValue>({
  columns,
  data,
  totalCount = 0,
  filterOptions = {
    page: 1,
    pageSize: 20,
    sortBy: "createdAt",
    sortDirection: "desc",
  },
  onFilterChange,
  isLoading = false
}: DataTableProps<TData, TValue>) {
  // Local state for search value
  const [globalFilterValue, setGlobalFilterValue] = useState<string>(() => filterOptions.search || "");
  
  // Memoize the initial pagination state
  const initialPaginationState = useMemo<PaginationState>(
    () => ({
      pageIndex: (filterOptions.page || 1) - 1, // Convert 1-indexed to 0-indexed
      pageSize: filterOptions.pageSize || 20,
    }),
    [filterOptions.page, filterOptions.pageSize]
  );

  // Create the table instance
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
    initialState: {
      pagination: initialPaginationState,
    },
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
      pagination: initialPaginationState,
    },
  });

  // Memoize table state values
  const { pageSize, pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex < pageCount - 1;

  // Handle search changes
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    
    if (onFilterChange) {
      onFilterChange({
        ...filterOptions,
        search: value,
        page: 1, // Reset to first page on new search
      });
    }
  }, [filterOptions, onFilterChange]);

  return (
    <div className="space-y-4 bg-card rounded-md p-4 shadow-md">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search inventory..."
            value={globalFilterValue}
            onChange={handleSearchChange}
            className="max-w-xs w-full"
            disabled={isLoading}
          />
        </div>
        <ViewOptions table={table} />
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
            {isLoading ? (
              // Loading rows
              Array.from({ length: pageSize }).map((_, index) => (
                <TableRow key={`loading-${index}`} className="animate-pulse">
                  {table.getHeaderGroups()[0]?.headers.map((header) => (
                    <TableCell key={`loading-cell-${header.id}-${index}`}>
                      <div className="h-4 bg-gray-200 rounded dark:bg-gray-700 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {data.length > 0 ? pageIndex * pageSize + 1 : 0} to {Math.min((pageIndex + 1) * pageSize, totalCount)} of {totalCount} items
        </div>
        <PaginationControls 
          table={table}
          canPreviousPage={canPreviousPage}
          canNextPage={canNextPage}
          pageCount={pageCount}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

