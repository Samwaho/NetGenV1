import { gql } from "@apollo/client";

// Common fragments for reuse
const CUSTOMER_CORE_FIELDS = gql`
  fragment CustomerCoreFields on ISPCustomer {
    id
    firstName
    lastName
    email
    phone
    username
    status
    online
    initialAmount
    isNew
  }
`;

const CUSTOMER_RELATED_FIELDS = gql`
  fragment CustomerRelatedFields on ISPCustomer {
    organization {
      id
      name
    }
    package {
      id
      name
      price
      description
      duration
      durationUnit
      dataLimit
      dataLimitUnit
    }
    station {
      id
      name
    }
  }
`;

const CUSTOMER_TIMESTAMP_FIELDS = gql`
  fragment CustomerTimestampFields on ISPCustomer {
    expirationDate
    createdAt
    updatedAt
  }
`;

const COMPLETE_CUSTOMER_FIELDS = gql`
  fragment CompleteCustomerFields on ISPCustomer {
    ...CustomerCoreFields
    ...CustomerRelatedFields
    ...CustomerTimestampFields
  }
  ${CUSTOMER_CORE_FIELDS}
  ${CUSTOMER_RELATED_FIELDS}
  ${CUSTOMER_TIMESTAMP_FIELDS}
`;

export const GET_ISP_CUSTOMERS = gql`
  query GetISPCustomers(
    $organizationId: String!,
    $page: Int = 1,
    $pageSize: Int = 20,
    $sortBy: String = "createdAt",
    $sortDirection: String = "desc",
    $filterStatus: String = null,
    $search: String = null
  ) {
    customers(
      organizationId: $organizationId,
      page: $page,
      pageSize: $pageSize,
      sortBy: $sortBy,
      sortDirection: $sortDirection,
      filterStatus: $filterStatus,
      search: $search
    ) {
      success
      message
      totalCount
      stats {
        total
        active
        online
        inactive
      }
      customers {
        ...CompleteCustomerFields
      }
    }
  }
  ${COMPLETE_CUSTOMER_FIELDS}
`;

export const GET_ISP_CUSTOMER = gql`
  query GetISPCustomer($id: String!) {
    customer(id: $id) {
      ...CustomerCoreFields
      ...CustomerRelatedFields
      ...CustomerTimestampFields
      password
    }
  }
  ${CUSTOMER_CORE_FIELDS}
  ${CUSTOMER_RELATED_FIELDS}
  ${CUSTOMER_TIMESTAMP_FIELDS}
`;

export const CREATE_ISP_CUSTOMER = gql`
  mutation CreateISPCustomer($input: CreateISPCustomerInput!) {
    createCustomer(input: $input) {
      success
      message
      customer {
        ...CompleteCustomerFields
      }
    }
  }
  ${COMPLETE_CUSTOMER_FIELDS}
`;

export const UPDATE_ISP_CUSTOMER = gql`
  mutation UpdateISPCustomer($id: String!, $input: UpdateISPCustomerInput!) {
    updateCustomer(id: $id, input: $input) {
      success
      message
      customer {
        ...CompleteCustomerFields
      }
    }
  }
  ${COMPLETE_CUSTOMER_FIELDS}
`;

export const DELETE_ISP_CUSTOMER = gql`
  mutation DeleteISPCustomer($id: String!) {
    deleteCustomer(id: $id) {
      success
      message
      customer {
        id
        firstName
        lastName
      }
    }
  }
`;

export const PROCESS_MANUAL_PAYMENT = gql`
  mutation ProcessManualPayment(
    $customerId: String!,
    $amount: Float!,
    $paymentMethod: String = "manual",
    $transactionId: String = null,
    $phoneNumber: String = null
  ) {
    processManualPayment(
      customerId: $customerId,
      amount: $amount,
      paymentMethod: $paymentMethod,
      transactionId: $transactionId,
      phoneNumber: $phoneNumber
    ) {
      success
      message
      customer {
        ...CompleteCustomerFields
      }
    }
  }
  ${COMPLETE_CUSTOMER_FIELDS}
`;

// Types for better TypeScript integration
export interface ISPCustomerInput {
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
  initialAmount?: number;
  isNew?: boolean;
}

export interface ISPCustomerUpdateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  username?: string;
  password?: string;
  packageId?: string;
  stationId?: string;
  expirationDate?: string;
  status?: string;
  initialAmount?: number;
  isNew?: boolean;
}

export interface CustomerFilterOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filterStatus?: string;
  search?: string;
}
