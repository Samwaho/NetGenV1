import { gql } from '@apollo/client';

export interface SendSmsResponse {
  sendSms: {
    success: boolean;
    message: string;
    messageId: string | null;
    status: string | null;
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
