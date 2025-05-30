import { gql } from "@apollo/client";

export const GET_DASHBOARD_STATS = gql`
  query DashboardStats($organizationId: String!) {
    dashboardStats(organizationId: $organizationId) {
      customers {
        id
        firstName
        lastName
        email
        phone
        username
        status
        online
        expirationDate
        package { id name }
        createdAt
        updatedAt
      }
      tickets {
        id
        title
        status
        priority
        category
        createdAt
        updatedAt
      }
      inventories {
        id
        name
        category
        status
        quantity
        quantityThreshold
        unitPrice
        createdAt
        updatedAt
      }
      packages {
        id
        name
        price
        createdAt
        updatedAt
      }
      transactions {
        id
        transactionId
        transactionType
        amount
        createdAt
        updatedAt
      }
      totalCustomers
      totalTickets
      totalInventoryItems
      totalPackages
      totalTransactions
    }
  }
`; 