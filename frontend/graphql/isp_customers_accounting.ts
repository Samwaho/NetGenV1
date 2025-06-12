import { gql } from "@apollo/client";

// Common fragments for reuse
const ACCOUNTING_SESSION_FIELDS = gql`
  fragment AccountingSessionFields on AccountingSession {
    startTime
    endTime
    duration
    inputBytes
    outputBytes
    framedIp
    terminateCause
    nasIpAddress
    serviceType
    nasPortType
    nasPort
    nasIdentifier
    mikrotikRateLimit
    calledStationId
    callingStationId
  }
`;

const ACCOUNTING_CORE_FIELDS = gql`
  fragment AccountingCoreFields on ISPCustomerAccounting {
    id
    username
    customer {
      id
      firstName
      lastName
      username
      status
    }
    sessionId
    status
    timestamp
    lastUpdate
    type
  }
`;

const ACCOUNTING_SESSION_DATA_FIELDS = gql`
  fragment AccountingSessionDataFields on ISPCustomerAccounting {
    sessionTime
    totalInputBytes
    totalOutputBytes
    totalBytes
    framedIpAddress
    nasIpAddress
    terminateCause
    serviceType
    nasPortType
    nasPort
    nasIdentifier
    mikrotikRateLimit
    calledStationId
    callingStationId
  }
`;

const ACCOUNTING_DELTA_FIELDS = gql`
  fragment AccountingDeltaFields on ISPCustomerAccounting {
    deltaInputBytes
    deltaOutputBytes
    deltaSessionTime
    startTime
  }
`;

const ACCOUNTING_SUMMARY_FIELDS = gql`
  fragment AccountingSummaryFields on ISPCustomerAccounting {
    totalSessions
    totalOnlineTime
    lastSeen
    lastSessionId
    lastSession {
      ...AccountingSessionFields
    }
  }
  ${ACCOUNTING_SESSION_FIELDS}
`;

const COMPLETE_ACCOUNTING_FIELDS = gql`
  fragment CompleteAccountingFields on ISPCustomerAccounting {
    ...AccountingCoreFields
    ...AccountingSessionDataFields
    ...AccountingDeltaFields
    ...AccountingSummaryFields
  }
  ${ACCOUNTING_CORE_FIELDS}
  ${ACCOUNTING_SESSION_DATA_FIELDS}
  ${ACCOUNTING_DELTA_FIELDS}
  ${ACCOUNTING_SUMMARY_FIELDS}
`;

export const GET_CUSTOMER_ACCOUNTINGS = gql`
  query GetCustomerAccountings(
    $customerId: String!
    $page: Int = 1
    $pageSize: Int = 20
  ) {
    customerAccountings(
      customerId: $customerId
      page: $page
      pageSize: $pageSize
    ) {
      success
      message
      totalCount
      accountings {
        id
        username
        customer {
          id
          firstName
          lastName
          username
          status
        }
        sessionId
        status
        timestamp
        lastUpdate
        type
        sessionTime
        totalInputBytes
        totalOutputBytes
        totalBytes
        framedIpAddress
        nasIpAddress
        terminateCause
        serviceType
        nasPortType
        nasPort
        nasIdentifier
        mikrotikRateLimit
        calledStationId
        callingStationId
        deltaInputBytes
        deltaOutputBytes
        deltaSessionTime
        startTime
        totalSessions
        totalOnlineTime
        lastSeen
        lastSessionId
        lastSession {
          startTime
          endTime
          duration
          inputBytes
          outputBytes
          framedIp
          terminateCause
          nasIpAddress
          serviceType
          nasPortType
          nasPort
          nasIdentifier
          mikrotikRateLimit
          calledStationId
          callingStationId
        }
      }
    }
  }
`;

// Types for TypeScript integration
export enum AccountingStatusType {
  START = "START",
  STOP = "STOP",
  INTERIM_UPDATE = "INTERIM-UPDATE"
}

export interface AccountingQueryOptions {
  customerId: string;
  page?: number;
  pageSize?: number;
}
