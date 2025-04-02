export interface Organization {
  id: string;
  name: string;
  description?: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  members: {
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    email?: string;
    role: {
      name: string;
      description?: string;
      permissions: string[];
      isSystemRole: boolean;
    };
    status: string;
  }[];
  roles: {
    name: string;
    description?: string;
    permissions: string[];
    isSystemRole: boolean;
  }[];
  status: string;
  createdAt: string;
  updatedAt: string;
}