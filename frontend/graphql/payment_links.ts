import { gql } from "@apollo/client";

export const GENERATE_PAYMENT_LINK = gql`
  mutation GeneratePaymentLink($organizationId: String!, $input: GeneratePaymentLinkInput!) {
    generatePaymentLink(organizationId: $organizationId, input: $input) {
      success
      message
      paymentLink {
        paymentLink
        reference
        ussdCode
        qrCode
        expiresAt
      }
    }
  }
`;

export const GET_PAYMENT_STATUS = gql`
  query GetPaymentStatus($reference: String!) {
    paymentStatus(reference: $reference) {
      reference
      status
      amount
      createdAt
      expiresAt
    }
  }
`;

// TypeScript interfaces for better type safety
export interface GeneratePaymentLinkInput {
  customerId: string;
  amount: number;
  description?: string;
  expiryHours?: number;
}

export interface PaymentLinkResponse {
  payment_link: string;
  reference: string;
  ussd_code?: string;
  qr_code?: string;
  expires_at: string;
}

export interface GeneratePaymentLinkResponse {
  generatePaymentLink: {
    success: boolean;
    message: string;
    paymentLink?: PaymentLinkResponse;
  };
}

export interface PaymentStatusResponse {
  paymentStatus: {
    reference: string;
    status: string;
    amount: number;
    created_at: string;
    expires_at: string;
  };
}
