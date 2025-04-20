import { OrganizationPermissions } from "@/lib/permissions";

export interface MpesaConfig {
  shortCode?: string;
  businessName?: string;
  accountReference?: string;
  isActive: boolean;
  consumerKey?: string;
  consumerSecret?: string;
  passKey?: string;
  environment?: 'sandbox' | 'production';
  
  // Callback URLs
  callbackUrl?: string;
  stkPushCallbackUrl?: string;
  c2bCallbackUrl?: string;
  b2cResultUrl?: string;
  b2cTimeoutUrl?: string;
  
  // Transaction configuration
  transactionType?: string;
  stkPushShortCode?: string;
  stkPushPassKey?: string;
  
  createdAt?: string;
  updatedAt?: string;
}

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
  mpesaConfig?: MpesaConfig;
  createdAt: string;
  updatedAt: string;
}
