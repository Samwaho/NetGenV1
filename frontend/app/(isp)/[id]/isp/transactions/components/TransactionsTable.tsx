"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
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
import { useState, useMemo, memo } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Define the interface here since it's not exported from the module
interface TransactionFilterOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
  transactionType?: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount?: number;
  filterOptions?: TransactionFilterOptions;
  onFilterChange?: (filters: TransactionFilterOptions) => void;
  isLoading?: boolean;
}

// Transaction Type Filter Component
const TransactionTypeFilter = memo(({ 
  value, 
  onChange 
}: { 
  value: string;
  onChange: (value: string) => void;
}) => (
  <Select value={value || "all"} onValueChange={onChange}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="All Transactions" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Transactions</SelectItem>
      <SelectItem value="customer_payment">Customer Payments</SelectItem>
      <SelectItem value="hotspot_voucher">Hotspot Vouchers</SelectItem>
    </SelectContent>
  </Select>
));
TransactionTypeFilter.displayName = "TransactionTypeFilter";

// Pagination Controls Component
const PaginationControls = memo(({ 
  table, 
  canPreviousPage, 
  canNextPage, 
  pageCount,
  isLoading 
}: { 
  table: { 
    setPageIndex: (index: number) => void;
    previousPage: () => void;
    nextPage: () => void;
  };
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
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
  isLoading
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const pageCount = Math.ceil(totalCount / (filterOptions.pageSize || 10));
  const pageIndex = (filterOptions.page || 1) - 1;

  const pagination = useMemo(
    () => ({
      pageIndex,
      pageSize: filterOptions.pageSize || 10,
    }),
    [filterOptions.pageSize, pageIndex]
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
    pageCount: Math.ceil(totalCount / (filterOptions.pageSize || 10)),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      if (!onFilterChange) return;
      
      const nextState = typeof updater === 'function' 
        ? updater(table.getState().pagination) 
        : updater;

      onFilterChange({
        ...filterOptions,
        page: nextState.pageIndex + 1,
        pageSize: nextState.pageSize,
      });
    },
  });

  const { pageIndex: currentPageIndex } = table.getState().pagination;
  const rowCount = data.length;
  const canPreviousPage = currentPageIndex > 0;
  const canNextPage = currentPageIndex < pageCount - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={filterOptions.search || ""}
            onChange={(event) => {
              onFilterChange?.({
                ...filterOptions,
                search: event.target.value,
                page: 1, // Reset to first page on search
              });
            }}
            className="pl-8"
          />
        </div>
        <TransactionTypeFilter
          value={filterOptions.transactionType || "all"}
          onChange={(value) => {
            onFilterChange?.({
              ...filterOptions,
              transactionType: value,
              page: 1, // Reset to first page on filter change
            });
          }}
        />
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
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading transactions...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
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
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {rowCount} rows total
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
