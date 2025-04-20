import { gql } from "@apollo/client";

// Common fragments for reuse
const PAYMENT_CORE_FIELDS = gql`
  fragment PaymentCoreFields on ISPCustomerPayment {
    id
    amount
    transactionId
    phoneNumber
    daysAdded
    paidAt
  }
`;

const PAYMENT_RELATED_FIELDS = gql`
  fragment PaymentRelatedFields on ISPCustomerPayment {
    customer {
      id
      firstName
      lastName
      username
      status
    }
    package {
      id
      name
    }
  }
`;

const PAYMENT_TIMESTAMP_FIELDS = gql`
  fragment PaymentTimestampFields on ISPCustomerPayment {
    createdAt
    updatedAt
  }
`;

const COMPLETE_PAYMENT_FIELDS = gql`
  fragment CompletePaymentFields on ISPCustomerPayment {
    ...PaymentCoreFields
    ...PaymentRelatedFields
    ...PaymentTimestampFields
  }
  ${PAYMENT_CORE_FIELDS}
  ${PAYMENT_RELATED_FIELDS}
  ${PAYMENT_TIMESTAMP_FIELDS}
`;

export const GET_CUSTOMER_PAYMENTS = gql`
  query GetCustomerPayments(
    $customerId: String!,
    $page: Int = 1,
    $pageSize: Int = 20,
    $sortBy: String = "paidAt",
    $sortDirection: String = "desc"
  ) {
    customerPayments(
      customerId: $customerId,
      page: $page,
      pageSize: $pageSize,
      sortBy: $sortBy,
      sortDirection: $sortDirection
    ) {
      success
      message
      totalCount
      payments {
        ...CompletePaymentFields
      }
    }
  }
  ${COMPLETE_PAYMENT_FIELDS}
`;

export const GET_ORGANIZATION_PAYMENTS = gql`
  query GetOrganizationPayments(
    $organizationId: String!,
    $page: Int = 1,
    $pageSize: Int = 20,
    $sortBy: String = "paidAt",
    $sortDirection: String = "desc"
  ) {
    organizationPayments(
      organizationId: $organizationId,
      page: $page,
      pageSize: $pageSize,
      sortBy: $sortBy,
      sortDirection: $sortDirection
    ) {
      success
      message
      totalCount
      payments {
        ...CompletePaymentFields
      }
    }
  }
  ${COMPLETE_PAYMENT_FIELDS}
`;

export const CREATE_CUSTOMER_PAYMENT = gql`
  mutation CreateCustomerPayment($input: CreateISPCustomerPaymentInput!) {
    createCustomerPayment(input: $input) {
      success
      message
      payment {
        ...CompletePaymentFields
      }
    }
  }
  ${COMPLETE_PAYMENT_FIELDS}
`;

export type {
  ISPCustomerPayment,
  ISPCustomerPaymentsResponse,
  OrganizationPaymentsResponse,
  CreateISPCustomerPaymentInput,
  ISPCustomerPaymentResponse
} from "@/types/isp_customer_payment";