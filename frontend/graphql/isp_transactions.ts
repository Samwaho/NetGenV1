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
    transactionId
    transactionType
    transTime
    amount
    businessShortCode
    billRefNumber
    invoiceNumber
    orgAccountBalance
    thirdPartyTransID
    phoneNumber
    firstName
    middleName
    lastName
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
    $search: String
  ) {
    transactions(
      organizationId: $organizationId,
      page: $page,
      pageSize: $pageSize,
      sortBy: $sortBy,
      sortDirection: $sortDirection,
      search: $search
    ) {
      success
      message
      totalCount
      transactions {
        id
        transactionId
        transactionType
        transTime
        amount
        businessShortCode
        billRefNumber
        invoiceNumber
        orgAccountBalance
        thirdPartyTransID
        phoneNumber
        firstName
        middleName
        lastName
        createdAt
        updatedAt
      }
    }
  }
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

export type {
  ISPTransaction,
  CreateISPTransactionInput,
  ISPTransactionResponse,
  ISPTransactionsResponse
};

