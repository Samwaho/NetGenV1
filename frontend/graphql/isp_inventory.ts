import { gql } from '@apollo/client';

export const GET_ISP_INVENTORIES = gql`
  query GetISPInventories($organizationId: String!) {
    inventories(organizationId: $organizationId) {
      success
      message
      inventories {
        id
        name
        category
        model
        manufacturer
        serialNumber
        macAddress
        ipAddress
        quantity
        quantityThreshold
        unitPrice
        status
        location
        assignedTo
        warrantyExpirationDate
        purchaseDate
        specifications
        notes
        createdAt
        updatedAt
        organization {
          id
          name
        }
      }
    }
  }
`;

export const GET_ISP_INVENTORY = gql`
  query GetISPInventory($id: String!) {
    inventory(id: $id) {
      success
      message
      inventory {
        id
        name
        category
        model
        manufacturer
        serialNumber
        macAddress
        ipAddress
        quantity
        quantityThreshold
        unitPrice
        status
        location
        assignedTo
        warrantyExpirationDate
        purchaseDate
        specifications
        notes
        createdAt
        updatedAt
        organization {
          id
          name
        }
      }
    }
  }
`;

export const CREATE_ISP_INVENTORY = gql`
  mutation CreateISPInventory($input: CreateISPInventoryInput!) {
    createInventory(input: $input) {
      success
      message
      inventory {
        id
        name
        category
        model
        manufacturer
        serialNumber
        macAddress
        ipAddress
        quantity
        quantityThreshold
        unitPrice
        status
        location
        assignedTo
        warrantyExpirationDate
        purchaseDate
        specifications
        notes
        organization {
          id
          name
        }
      }
    }
  }
`;

export const UPDATE_ISP_INVENTORY = gql`
  mutation UpdateISPInventory($id: String!, $input: UpdateISPInventoryInput!) {
    updateInventory(id: $id, input: $input) {
      success
      message
      inventory {
        id
        name
        category
        model
        manufacturer
        serialNumber
        macAddress
        ipAddress
        quantity
        quantityThreshold
        unitPrice
        status
        location
        assignedTo
        warrantyExpirationDate
        purchaseDate
        specifications
        notes
        organization {
          id
          name
        }
      }
    }
  }
`;

export const DELETE_ISP_INVENTORY = gql`
  mutation DeleteISPInventory($id: String!) {
    deleteInventory(id: $id) {
      success
      message
    }
  }
`;