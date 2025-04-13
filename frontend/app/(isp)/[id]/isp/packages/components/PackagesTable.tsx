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
import { useState, useCallback, useMemo, memo, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PackageFilterOptions } from "@/graphql/isp_packages";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount?: number;
  filterOptions?: PackageFilterOptions;
  onFilterChange?: (filters: PackageFilterOptions) => void;
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

// Memoized search input component
const SearchInput = memo(({ 
  value, 
  onChange, 
  isLoading 
}: { 
  value: string, 
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void, 
  isLoading: boolean 
}) => (
  <Input
    placeholder="Search all fields..."
    value={value}
    onChange={onChange}
    className="w-full sm:max-w-sm text-sm sm:text-base"
    aria-label="Search"
    disabled={isLoading}
  />
));
SearchInput.displayName = "SearchInput";

// Memoized page size selector component
const PageSizeSelector = memo(({
  pageSize,
  onValueChange,
  options,
  isLoading
}: {
  pageSize: number,
  onValueChange: (value: string) => void,
  options: number[],
  isLoading: boolean
}) => (
  <Select
    value={`${pageSize}`}
    onValueChange={onValueChange}
    disabled={isLoading}
  >
    <SelectTrigger className="h-8 w-[70px] text-xs sm:text-sm">
      <SelectValue placeholder={pageSize} />
    </SelectTrigger>
    <SelectContent side="top">
      {options.map((size) => (
        <SelectItem key={size} value={`${size}`}>
          {size}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
));
PageSizeSelector.displayName = "PageSizeSelector";

// Memoized empty state component
const TableEmptyState = memo(({ 
  colSpan, 
  isLoading 
}: { 
  colSpan: number, 
  isLoading: boolean 
}) => (
  <TableRow>
    <TableCell
      colSpan={colSpan}
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
));
TableEmptyState.displayName = "TableEmptyState";

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
  // Local state for search input with initial value from filter options
  const [globalFilterValue, setGlobalFilterValue] = useState<string>(() => filterOptions.search || "");
  
  // Sync local search state with external filter options when they change
  useEffect(() => {
    if (filterOptions.search !== undefined && filterOptions.search !== globalFilterValue) {
      setGlobalFilterValue(filterOptions.search);
    }
  }, [filterOptions.search, globalFilterValue]);
  
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

  // Memoize table state
  const tableState = useMemo(() => ({
    pagination: {
      pageIndex: (filterOptions.page || 1) - 1,
      pageSize: filterOptions.pageSize || 10,
    },
  }), [filterOptions.page, filterOptions.pageSize]);

  // Define pagination types
  type PaginationState = { pageIndex: number; pageSize: number };
  type PaginationUpdater = 
    | Partial<PaginationState> 
    | ((prev: PaginationState) => PaginationState);
  
  // First create table with a dummy pagination handler
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
    onPaginationChange: () => {}, // Dummy handler, will be replaced
    state: tableState,
  });
  
  // Now define the real pagination handler, with table available
  const handlePaginationChange = useCallback((updater: PaginationUpdater) => {
    if (!onFilterChange) return;
    
    const nextState = typeof updater === 'function' 
      ? updater(table.getState().pagination) 
      : { ...table.getState().pagination, ...updater };
      
    // Only update if there are actual changes
    if (nextState.pageIndex + 1 !== filterOptions.page || 
        nextState.pageSize !== filterOptions.pageSize) {
      onFilterChange({
        ...filterOptions,
        page: nextState.pageIndex + 1,
        pageSize: nextState.pageSize,
      });
    }
  }, [filterOptions, onFilterChange, table]);

  // Update the table with the real handler
  useEffect(() => {
    table.setOptions((prev) => ({
      ...prev,
      onPaginationChange: handlePaginationChange as (updater: PaginationUpdater) => void,
    }));
  }, [handlePaginationChange, table]);

  // Memoize table state values that are used in the UI
  const paginationState = table.getState().pagination;
  const pageSize = paginationState.pageSize;
  const pageIndex = paginationState.pageIndex;
  const pageCount = useMemo(() => table.getPageCount(), [table]);
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

  // Handle global filter changes with debouncing
  const handleGlobalFilterChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setGlobalFilterValue(value);
    
    // Only update external state if the filter has actually changed
    if (onFilterChange && value !== filterOptions.search) {
      onFilterChange({
        ...filterOptions,
        search: value || undefined,
        page: 1, // Reset to first page on search
      });
    }
  }, [filterOptions, onFilterChange]);

  // Memoize table header and body components
  const tableHeader = useMemo(() => (
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
  ), [table.getHeaderGroups()]);

  const tableBody = useMemo(() => (
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
        <TableEmptyState colSpan={columns.length} isLoading={isLoading} />
      )}
    </TableBody>
  ), [table.getRowModel().rows, columns.length, isLoading]);

  return (
    <div className="space-y-4 ">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2 sm:py-4">
        <SearchInput 
          value={globalFilterValue} 
          onChange={handleGlobalFilterChange} 
          isLoading={isLoading} 
        />
        <div className="flex items-center space-x-2">
          <PageSizeSelector 
            pageSize={pageSize} 
            onValueChange={handlePageSizeChange} 
            options={pageSizeOptions} 
            isLoading={isLoading} 
          />
        </div>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          {tableHeader}
          {tableBody}
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