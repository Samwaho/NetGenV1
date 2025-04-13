"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
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
import { StationFilterOptions } from "@/types/isp_station";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount?: number;
  filterOptions?: StationFilterOptions;
  onFilterChange?: (filters: StationFilterOptions) => void;
  isLoading?: boolean;
}

// Memoized search input component
const SearchInput = memo(({ value, onChange, isLoading }: { 
  value: string; 
  onChange: (value: string) => void;
  isLoading: boolean;
}) => (
  <Input
    placeholder="Search all fields..."
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full sm:max-w-sm text-sm sm:text-base"
    disabled={isLoading}
  />
));
SearchInput.displayName = 'SearchInput';

// Memoized page size selector component
const PageSizeSelector = memo(({ pageSize, onValueChange, options, isLoading }: {
  pageSize: number;
  onValueChange: (value: string) => void;
  options: number[];
  isLoading: boolean;
}) => (
  <Select
    value={String(pageSize)}
    onValueChange={onValueChange}
    disabled={isLoading}
  >
    <SelectTrigger className="h-8 w-[70px] text-xs sm:text-sm">
      <SelectValue placeholder={pageSize} />
    </SelectTrigger>
    <SelectContent side="top">
      {options.map((size) => (
        <SelectItem key={size} value={String(size)}>
          {size}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
));
PageSizeSelector.displayName = 'PageSizeSelector';

// Table empty state component
const TableEmptyState = memo(({ colSpan, isLoading }: { 
  colSpan: number; 
  isLoading: boolean;
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
TableEmptyState.displayName = 'TableEmptyState';

export function DataTable<TData, TValue>({
  columns,
  data,
  totalCount = 0,
  filterOptions = {
    page: 1,
    pageSize: 10,
    sortBy: "createdAt",
    sortDirection: "desc",
    search: "",
  },
  onFilterChange,
  isLoading = false,
}: DataTableProps<TData, TValue>) {
  const [globalFilterValue, setGlobalFilterValue] = useState<string>(() => filterOptions.search || "");
  
  useEffect(() => {
    if (filterOptions.search !== undefined && filterOptions.search !== globalFilterValue) {
      setGlobalFilterValue(filterOptions.search);
    }
  }, [filterOptions.search, globalFilterValue]);

  const pageCount = Math.ceil(totalCount / (filterOptions.pageSize || 10));
  const pageSizeOptions = [10, 20, 30, 40, 50];

  const initialState = useMemo(() => ({
    pagination: {
      pageIndex: (filterOptions.page || 1) - 1,
      pageSize: filterOptions.pageSize || 10,
    },
  }), [filterOptions.page, filterOptions.pageSize]);

  const handleGlobalFilterChange = useCallback((value: string) => {
    setGlobalFilterValue(value);
    onFilterChange?.({
      ...filterOptions,
      search: value,
      page: 1, // Reset to first page on search
    });
  }, [filterOptions, onFilterChange]);

  const handlePageChange = useCallback((newPage: number) => {
    onFilterChange?.({
      ...filterOptions,
      page: newPage,
    });
  }, [filterOptions, onFilterChange]);

  const handlePageSizeChange = useCallback((newSize: string) => {
    onFilterChange?.({
      ...filterOptions,
      pageSize: parseInt(newSize),
      page: 1, // Reset to first page when changing page size
    });
  }, [filterOptions, onFilterChange]);

  const table = useReactTable({
    data,
    columns,
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    getPaginationRowModel: getPaginationRowModel(),
    manualSorting: true,
    getSortedRowModel: getSortedRowModel(),
    manualFiltering: true,
    getFilteredRowModel: getFilteredRowModel(),
    initialState,
  });

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
            pageSize={filterOptions.pageSize || 10}
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
          {totalCount} row(s) total
        </div>
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-xs sm:text-sm font-medium">Page</p>
            <span className="text-xs sm:text-sm font-medium">
              {filterOptions.page} of {pageCount}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={filterOptions.page <= 1 || isLoading}
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(filterOptions.page - 1)}
              disabled={filterOptions.page <= 1 || isLoading}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(filterOptions.page + 1)}
              disabled={filterOptions.page >= pageCount || isLoading}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pageCount)}
              disabled={filterOptions.page >= pageCount || isLoading}
              className="h-8 w-8 p-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
