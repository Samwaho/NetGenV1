export enum TransactionType {
  CUSTOMER_PAYMENT = "customer_payment",
  HOTSPOT_VOUCHER = "hotspot_voucher"
}

export interface ISPTransaction {
  id: string;
  organizationId: string;
  transactionType: TransactionType;
  callbackType: string;
  status: string;
  amount: number;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
  transactionId: string;
  
  // Common fields
  paymentMethod?: string;
  
  // Customer payment specific fields
  firstName?: string;
  middleName?: string;
  lastName?: string;
  businessShortCode?: string;
  billRefNumber?: string;
  invoiceNumber?: string;
  orgAccountBalance?: string;
  thirdPartyTransID?: string;
  transTime?: string;
  
  // Hotspot voucher specific fields
  voucherCode?: string;
  packageId?: string;
  packageName?: string;
  duration?: number;
  dataLimit?: number;
  expiresAt?: string;
}

export interface CreateISPTransactionInput {
  organizationId: string;
  transactionType: TransactionType;
  callbackType: string;
  status: string;
  amount: number;
  phoneNumber: string;
  transactionId: string;
  
  // Common fields
  paymentMethod?: string;
  
  // Customer payment specific fields
  firstName?: string;
  middleName?: string;
  lastName?: string;
  businessShortCode?: string;
  billRefNumber?: string;
  invoiceNumber?: string;
  orgAccountBalance?: string;
  thirdPartyTransID?: string;
  transTime?: string;
  
  // Hotspot voucher specific fields
  voucherCode?: string;
  packageId?: string;
  packageName?: string;
  duration?: number;
  dataLimit?: number;
  expiresAt?: string;
}

export interface ISPTransactionResponse {
  success: boolean;
  message: string;
  transaction: ISPTransaction;
}

export interface ISPTransactionsResponse {
  success: boolean;
  message: string;
  transactions: ISPTransaction[];
  totalCount: number;
}

export interface TransactionFilterOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
}