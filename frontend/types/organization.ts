import { OrganizationPermissions } from "@/lib/permissions";

export interface Organization {
  id: string;
  name: string;
  description?: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
  };
  members: Array<{
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    role: {
      name: string;
      permissions: OrganizationPermissions[];
    };
    status: string;
    email?: string;
  }>;
  roles: Array<{
    name: string;
    description?: string;
    permissions: OrganizationPermissions[];
    isSystemRole: boolean;
  }>;
  status: string;
  createdAt: string;
  updatedAt: string;
}
