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

export interface SmsConfig {
  provider?: string;
  isActive: boolean;
  apiKey?: string;
  apiSecret?: string;
  accountSid?: string;
  authToken?: string;
  username?: string;
  partnerID?: string;
  senderId?: string;
  callbackUrl?: string;
  environment?: string;
  password?: string;
  msgType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrganizationContact {
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  timezone?: string;
}

export interface OrganizationBusiness {
  legalName?: string;
  taxId?: string;
  registrationNumber?: string;
  industry?: string;
  businessType?: string;
  foundedDate?: string;
  employeeCount?: number;
  annualRevenue?: string;
  logo?: string;
  banner?: string;
  socialMedia?: Record<string, any>;
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
  smsConfig?: SmsConfig;
  
  // New robust fields
  contact?: OrganizationContact;
  business?: OrganizationBusiness;
  
  // Additional metadata
  tags?: string[];
  customFields?: Record<string, any>;
  metadata?: Record<string, any>;
  
  createdAt: string;
  updatedAt: string;
}
