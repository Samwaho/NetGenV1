import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { CreateRoleModal } from "../CreateRoleModal";
import { EditRoleModal } from "../EditRoleModal";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { Organization } from "@/types/organization";
import { LockIcon, MoreHorizontal, Plus, ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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

type Role = {
  name: string;
  description?: string;
  isSystemRole: boolean;
  permissions: string[];
};

type RolesTabProps = {
  roles: Role[];
  organizationId: string;
  organization: Organization;
  currentUserId: string;
};

interface ActionsCellProps {
  role: Role;
  canManageRoles: boolean;
  onEdit: (role: Role) => void;
}

function ActionsCell({ role, canManageRoles, onEdit }: ActionsCellProps) {
  if (!canManageRoles || role.isSystemRole) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onEdit(role)}>
          Edit Role
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const RolesTab = ({ roles, organizationId, organization, currentUserId }: RolesTabProps) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const canManageRoles = hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.MANAGE_ROLES
  );

  const columns: ColumnDef<Role>[] = [
    {
      accessorKey: "name",
      header: "Role Name",
      cell: ({ row }) => {
        const role = row.original;
        return (
          <div className="flex items-center space-x-2">
            <ShieldCheck className={`h-4 w-4 ${role.isSystemRole ? 'text-blue-500' : 'text-gray-500'}`} />
            <div>
              <p className="font-medium">{role.name}</p>
              {role.description && (
                <p className="text-sm text-muted-foreground">
                  {role.description}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "permissions",
      header: "Permissions",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.permissions.length} permissions
        </Badge>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => (
        row.original.isSystemRole ? (
          <Badge variant="secondary" className="text-xs">
            System Role
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Custom Role
          </Badge>
        )
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <ActionsCell
          role={row.original}
          canManageRoles={canManageRoles}
          onEdit={setSelectedRole}
        />
      ),
    },
  ];

  const table = useReactTable({
    data: roles,
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

  return (
    <div className="space-y-4 p-2 sm:p-4 bg-card rounded-2xl shadow-md dark:border">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2 sm:py-4">
        <div className="flex-1">
          <Input
            placeholder="Search roles..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm text-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs sm:text-sm">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManageRoles ? (
          <Button 
            className="w-auto bg-gradient-custom text-white hover:text-white text-sm"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Role
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" disabled className="w-auto text-sm">
                <LockIcon className="mr-2 h-4 w-4" />
                Create Role
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">You need role management permissions to create roles</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
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
                  No roles found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-2 py-2 sm:py-4">
        <div className="flex-1 text-xs sm:text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} role(s) total
        </div>
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-xs sm:text-sm font-medium">Page</p>
            <span className="text-xs sm:text-sm font-medium">
              {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>
          </div>
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

      {canManageRoles && (
        <>
          <CreateRoleModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            organizationId={organizationId}
          />

          {selectedRole && (
            <EditRoleModal
              isOpen={!!selectedRole}
              onClose={() => setSelectedRole(null)}
              organizationId={organizationId}
              role={selectedRole}
            />
          )}
        </>
      )}
    </div>
  );
};


