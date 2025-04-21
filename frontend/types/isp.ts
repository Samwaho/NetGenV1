export interface ISPCustomerPayment {
  id: string;
  amount: number;
  date: string;
  status: string;
  method: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
} 