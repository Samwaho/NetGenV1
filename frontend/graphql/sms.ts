import { gql } from "@apollo/client";

export const SEND_SMS = gql`
  mutation SendSMS($organizationId: String!, $to: String!, $message: String!) {
    sendSms(organizationId: $organizationId, to: $to, message: $message) {
      success
      message
      messageId
      status
    }
  }
`;

export const SEND_BULK_SMS = gql`
  mutation SendBulkSMS($organizationId: String!, $to: [String!]!, $message: String!) {
    sendBulkSms(organizationId: $organizationId, to: $to, message: $message) {
      success
      message
      totalSent
      failed
    }
  }
`;

export interface SendSmsResponse {
  sendSms: {
    success: boolean;
    message: string;
    messageId?: string;
    status?: string;
  };
}

export interface SendBulkSmsResponse {
  sendBulkSms: {
    success: boolean;
    message: string;
    totalSent: number;
    failed: number;
  };
}

export interface SendSmsVariables {
  organizationId: string;
  to: string;
  message: string;
}

export interface SendBulkSmsVariables {
  organizationId: string;
  to: string[];
  message: string;
} 