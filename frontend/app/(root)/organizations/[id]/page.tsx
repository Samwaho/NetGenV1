"use client";

import { useQuery, useMutation } from "@apollo/client";
import { GET_ORGANIZATION, DELETE_ROLE } from "@/graphql/organization";
import { useParams } from "next/navigation";
import {
  Users,
  Settings,
  Shield,
  Clock,
  Mail,
  UserPlus,
  Building2,
  ChevronRight,
  Calendar,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useState } from "react";
import InviteMemberModal from "./InviteMemberModal";
import { CreateRoleModal } from "./CreateRoleModal";
import { EditRoleModal } from "./EditRoleModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  status: string;
};

type OrganizationRole = {
  name: string;
  isSystemRole: boolean;
  description: string;
  permissions: string[];
};

const OrganizationPage = () => {
  const params = useParams();
  const { loading, error, data } = useQuery(GET_ORGANIZATION, {
    variables: { id: params.id },
  });

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<OrganizationRole | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<OrganizationRole | null>(null);
  const [deleteRole, { loading: deleteLoading }] = useMutation(DELETE_ROLE, {
    onCompleted: (data) => {
      toast.success(data.deleteRole.message);
      setRoleToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    refetchQueries: ["GetOrganization"],
  });

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    
    await deleteRole({
      variables: {
        organizationId: params.id,
        roleName: roleToDelete.name,
      },
    });
  };

  if (error) {
    toast.error("Failed to load organization details");
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-red-500">
          Failed to load organization details. Please try again later.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-8">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const organization = data.organization;
  const ownerName = `${organization.owner.firstName} ${organization.owner.lastName}`;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl mt-16">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 rounded-lg bg-gradient-custom2 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gradient-custom2">
              {organization.name}
            </h1>
            <p className="text-muted-foreground">
              Created by {ownerName} • {new Date(organization.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Organization Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Shield className="mr-2 h-4 w-4" />
              Roles & Permissions
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-sm dark:shadow-purple-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{organization.members.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm dark:shadow-purple-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{organization.roles.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm dark:shadow-purple-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Organization Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="bg-gradient-custom text-white">
              {organization.status}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Organization Members</h2>
            <Button 
              className="bg-gradient-custom text-white hover:text-white"
              onClick={() => setIsInviteModalOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" /> Invite Member
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {organization.members.map((member: OrganizationMember) => (
                  <div
                    key={member.user?.id || member.email} // Use email as fallback key
                    className="flex items-center justify-between p-4 hover:bg-muted/50"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar>
                        <AvatarFallback>
                          {member.user ? 
                            `${member.user.firstName[0]}${member.user.lastName[0]}` : 
                            member.email?.[0]?.toUpperCase() || '?'
                          }
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {member.user ? 
                            `${member.user.firstName} ${member.user.lastName}` : 
                            member.email
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.user?.email || member.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant="outline">{member.role.name}</Badge>
                      <Badge
                        variant="outline"
                        className={
                          member.status === "ACTIVE"
                            ? "bg-green-500/10 text-green-500"
                            : member.status === "PENDING"
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-gray-500/10 text-gray-500"
                        }
                      >
                        {member.status}
                      </Badge>
                      <Button variant="ghost" size="icon">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          {data?.organization && (
            <InviteMemberModal
              isOpen={isInviteModalOpen}
              onClose={() => setIsInviteModalOpen(false)}
              organizationId={params.id as string}
              roles={data.organization.roles}
            />
          )}
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Organization Roles</h2>
            <Button 
              className="bg-gradient-custom text-white hover:text-white"
              onClick={() => setIsCreateRoleModalOpen(true)}
            >
              <Shield className="mr-2 h-4 w-4" /> Create Role
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {organization.roles.map((role: OrganizationRole) => (
              <Card key={role.name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{role.name}</span>
                    <div className="flex items-center gap-2">
                      {role.isSystemRole && (
                        <Badge variant="outline">System Role</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingRole(role)}
                        disabled={role.isSystemRole}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRoleToDelete(role)}
                        disabled={role.isSystemRole}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>{role.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Permissions:</p>
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map((permission) => (
                        <Badge key={permission} variant="outline">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <CreateRoleModal
            isOpen={isCreateRoleModalOpen}
            onClose={() => setIsCreateRoleModalOpen(false)}
            organizationId={params.id as string}
          />
          {editingRole && (
            <EditRoleModal
              isOpen={!!editingRole}
              onClose={() => setEditingRole(null)}
              organizationId={params.id as string}
              role={editingRole}
            />
          )}
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest actions and changes in the organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Placeholder for activity feed */}
                <p className="text-muted-foreground text-center py-8">
                  Activity feed coming soon...
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete?.name}"? This action cannot be undone.
              Members with this role will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting..." : "Delete Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrganizationPage;










