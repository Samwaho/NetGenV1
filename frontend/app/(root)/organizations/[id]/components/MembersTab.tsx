import { UserPlus, MoreHorizontal, Lock as LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { toast } from "sonner";
import { 
  UPDATE_MEMBER, 
  REMOVE_MEMBER,
  UpdateMemberResponse,
  RemoveMemberResponse
} from "@/graphql/organization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { Organization } from "@/types/organization";
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
import { Input } from "@/components/ui/input";
import { GET_ORGANIZATION } from "@/graphql/organization";
import InviteMemberModal from "../InviteMemberModal";


type OrganizationMember = {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  email?: string;
  role: {
    name: string;
  };
  status: "ACTIVE" | "PENDING" | "INACTIVE";
};

type OrganizationRole = {
  name: string;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
};

interface ActionsCellProps {
  member: OrganizationMember;
  organizationId: string;
  canManageMembers: boolean;
  roles: OrganizationRole[];
  refetch: () => void;
}

function ActionsCell({ 
  member, 
  organizationId, 
  canManageMembers, 
  roles,
  refetch 
}: ActionsCellProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(member.role.name);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [updateMember] = useMutation<UpdateMemberResponse>(UPDATE_MEMBER, {
    onCompleted: (data) => {
      if (data.updateMember.success) {
        toast.success(data.updateMember.message);
        setIsEditModalOpen(false);
        refetch();
      } else {
        toast.error(data.updateMember.message);
      }
      setIsUpdating(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsUpdating(false);
    }
  });

  const [removeMember] = useMutation<RemoveMemberResponse>(REMOVE_MEMBER, {
    onCompleted: (data) => {
      if (data.removeMember.success) {
        toast.success(data.removeMember.message);
        setIsDeleteModalOpen(false);
        refetch();
      } else {
        toast.error(data.removeMember.message);
      }
      setIsDeleting(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsDeleting(false);
    }
  });

  const handleEdit = async () => {
    setIsUpdating(true);
    await updateMember({
      variables: {
        organizationId,
        userId: member.user?.id,
        roleName: selectedRole,
      },
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await removeMember({
      variables: {
        organizationId,
        userId: member.user?.id || member.email, // fallback to email for pending
      },
    });
  };

  if (!canManageMembers) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem 
            onClick={() => setIsEditModalOpen(true)}
            disabled={isUpdating || isDeleting}
          >
            Edit Role
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setIsDeleteModalOpen(true)}
            className="text-red-600"
            disabled={isUpdating || isDeleting}
          >
            Remove Member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member Role</DialogTitle>
            <DialogDescription>
              Change the role for {member.user?.firstName} {member.user?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedRole}
              onValueChange={setSelectedRole}
              disabled={isUpdating}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role: OrganizationRole) => (
                  <SelectItem key={role.name} value={role.name}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEdit}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {member.user?.firstName} {member.user?.lastName} from the organization?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface MembersTabProps {
  members: OrganizationMember[];
  organization: Organization;
  currentUserId: string;
}

export const MembersTab = ({ members, organization, currentUserId }: MembersTabProps) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const { refetch } = useQuery(GET_ORGANIZATION, {
    variables: { id: organization.id },
    skip: true // Skip initial query since we already have the data
  });

  const canManageMembers = hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.MANAGE_MEMBERS
  );

  const columns: ColumnDef<OrganizationMember>[] = [
    {
      accessorFn: (row) => row.user?.firstName || row.email,
      id: "member",
      header: "Member",
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {member.user ? 
                  `${member.user.firstName?.[0] || ""}${member.user.lastName?.[0] || ""}` : 
                  member.email?.[0]?.toUpperCase() || '?'
                }
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">
                {member.user ? 
                  `${member.user.firstName || ""} ${member.user.lastName || ""}` : 
                  member.email
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {member.user?.email || member.email}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role.name",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.role.name}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant="outline"
            className={`text-xs ${
              status === "ACTIVE"
                ? "bg-green-500/10 text-green-500"
                : status === "PENDING"
                ? "bg-yellow-500/10 text-yellow-500"
                : "bg-gray-500/10 text-gray-500"
            }`}
          >
            {status}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <ActionsCell
          member={row.original}
          organizationId={organization.id}
          canManageMembers={canManageMembers}
          roles={organization.roles}
          refetch={refetch}
        />
      ),
    },
  ];

  const table = useReactTable({
    data: members,
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search members..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm text-sm"
          />
        </div>
        {canManageMembers ? (
          <Button 
            className="w-auto bg-gradient-custom text-white hover:text-white text-sm"
            onClick={() => setIsInviteModalOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" disabled className="w-auto text-sm">
                <LockIcon className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">You need member management permissions to invite members</p>
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
                  No members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-2 py-2 sm:py-4">
        <div className="flex-1 text-xs sm:text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} member(s) total
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

      {canManageMembers && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          organizationId={organization.id}
          roles={organization.roles}
        />
      )}
    </div>
  );
};

