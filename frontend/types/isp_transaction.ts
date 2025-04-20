export interface ISPTransaction {
  id: string;
  transactionId: string;
  transactionType: string;
  transTime: string;
  amount: number;
  businessShortCode: string;
  billRefNumber: string;
  invoiceNumber: string;
  orgAccountBalance: string;
  thirdPartyTransID: string;
  phoneNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateISPTransactionInput {
  organizationId: string;
  transactionId: string;
  transactionType: string;
  transTime: string;
  amount: number;
  businessShortCode: string;
  billRefNumber: string;
  invoiceNumber: string;
  orgAccountBalance: string;
  thirdPartyTransID: string;
  phoneNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
}

export interface ISPTransactionResponse {
  transaction: {
    success: boolean;
    message: string;
    transaction: ISPTransaction;
  };
}

export interface ISPTransactionsResponse {
  transactions: {
    success: boolean;
    message: string;
    transactions: ISPTransaction[];
    totalCount: number;
  };
}

export interface TransactionFilterOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
}