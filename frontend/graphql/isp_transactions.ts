import { gql } from "@apollo/client";
import type { 
  ISPTransaction, 
  CreateISPTransactionInput, 
  ISPTransactionResponse, 
  ISPTransactionsResponse 
} from "@/types/isp_transaction";

// Common fragments for reuse
const TRANSACTION_CORE_FIELDS = gql`
  fragment TransactionCoreFields on ISPTransaction {
    id
    organizationId
    transactionType
    callbackType
    status
    amount
    phoneNumber
    
    # Common fields
    transactionId
    paymentMethod
    
    # Customer payment specific fields
    firstName
    middleName
    lastName
    businessShortCode
    billRefNumber
    invoiceNumber
    orgAccountBalance
    thirdPartyTransID
    transTime
    
    # Hotspot voucher specific fields
    voucherCode
    packageId
    packageName
    duration
    dataLimit
    expiresAt
  }
`;

const TRANSACTION_TIMESTAMP_FIELDS = gql`
  fragment TransactionTimestampFields on ISPTransaction {
    createdAt
    updatedAt
  }
`;

const COMPLETE_TRANSACTION_FIELDS = gql`
  fragment CompleteTransactionFields on ISPTransaction {
    ...TransactionCoreFields
    ...TransactionTimestampFields
  }
  ${TRANSACTION_CORE_FIELDS}
  ${TRANSACTION_TIMESTAMP_FIELDS}
`;

export const GET_ISP_TRANSACTIONS = gql`
  query GetISPTransactions(
    $organizationId: String!,
    $page: Int = 1,
    $pageSize: Int = 20,
    $sortBy: String = "createdAt",
    $sortDirection: String = "desc",
    $search: String,
    $transactionType: String
  ) {
    transactions(
      organizationId: $organizationId,
      page: $page,
      pageSize: $pageSize,
      sortBy: $sortBy,
      sortDirection: $sortDirection,
      search: $search,
      transactionType: $transactionType
    ) {
      success
      message
      totalCount
      transactions {
        ...CompleteTransactionFields
      }
    }
  }
  ${COMPLETE_TRANSACTION_FIELDS}
`;

export const GET_ISP_TRANSACTION = gql`
  query GetISPTransaction($id: String!) {
    transaction(id: $id) {
      success
      message
      transaction {
        ...CompleteTransactionFields
      }
    }
  }
  ${COMPLETE_TRANSACTION_FIELDS}
`;

export const CREATE_ISP_TRANSACTION = gql`
  mutation CreateISPTransaction($input: CreateISPTransactionInput!) {
    createTransaction(input: $input) {
      success
      message
      transaction {
        ...CompleteTransactionFields
      }
    }
  }
  ${COMPLETE_TRANSACTION_FIELDS}
`;

export const GET_UNMATCHED_TRANSACTIONS = gql`
  query GetUnmatchedTransactions(
    $organizationId: String!,
    $page: Int = 1,
    $pageSize: Int = 20,
    $sortBy: String = "createdAt",
    $sortDirection: String = "desc"
  ) {
    unmatchedTransactions(
      organizationId: $organizationId,
      page: $page,
      pageSize: $pageSize,
      sortBy: $sortBy,
      sortDirection: $sortDirection
    ) {
      success
      message
      transactions {
        ...CompleteTransactionFields
      }
      totalCount
    }
  }
  ${COMPLETE_TRANSACTION_FIELDS}
`;

export const UPDATE_TRANSACTION_BILL_REF = gql`
  mutation UpdateTransactionBillRef($transactionId: String!, $newBillRef: String!) {
    updateTransactionBillRef(transactionId: $transactionId, newBillRef: $newBillRef) {
      success
      message
      transaction {
        ...CompleteTransactionFields
      }
    }
  }
  ${COMPLETE_TRANSACTION_FIELDS}
`;

export type {
  ISPTransaction,
  CreateISPTransactionInput,
  ISPTransactionResponse,
  ISPTransactionsResponse
};





