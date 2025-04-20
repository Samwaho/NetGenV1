export interface ISPCustomerPayment {
  id: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    status: string;
  };
  amount: number;
  transactionId?: string;
  phoneNumber?: string;
  package?: {
    id: string;
    name: string;
  };
  daysAdded: number;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ISPCustomerPaymentsResponse {
  customerPayments: {
    success: boolean;
    message: string;
    totalCount: number;
    payments: ISPCustomerPayment[];
  };
}

export interface OrganizationPaymentsResponse {
  organizationPayments: {
    success: boolean;
    message: string;
    totalCount: number;
    payments: ISPCustomerPayment[];
  };
}

export interface CreateISPCustomerPaymentInput {
  customerId: string;
  amount: number;
  transactionId?: string;
  phoneNumber?: string;
  packageId?: string;
  daysAdded: number;
}

export interface ISPCustomerPaymentResponse {
  createCustomerPayment: {
    success: boolean;
    message: string;
    payment?: ISPCustomerPayment;
  };
}