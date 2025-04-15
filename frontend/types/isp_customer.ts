export interface ISPCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  organization: {
    id: string;
    name: string;
  };
  package: {
    id: string;
    name: string;
  };
  station: {
    id: string;
    name: string;
  };
  expirationDate: string;
  status: "ACTIVE" | "INACTIVE";
  online: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ISPCustomersResponse {
  customers: {
    success: boolean;
    message: string;
    customers: ISPCustomer[];
  };
}

export interface CustomerResponse {
  customer: {
    __typename: string;
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    status: string;
    // ... other fields
  };
}

export interface CreateISPCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  organizationId: string;
  packageId: string;
  stationId: string;
  expirationDate: string;
}

export interface UpdateISPCustomerInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  username?: string;
  password?: string;
  packageId?: string;
  stationId?: string;
  expirationDate?: string;
  status?: "ACTIVE" | "INACTIVE";
} 
