import { gql } from '@apollo/client';

// Common fragments for reuse
const INVENTORY_CORE_FIELDS = gql`
  fragment InventoryCoreFields on ISPInventory {
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
  }
`;

const INVENTORY_RELATED_FIELDS = gql`
  fragment InventoryRelatedFields on ISPInventory {
    organization {
      id
      name
    }
  }
`;

const INVENTORY_DETAIL_FIELDS = gql`
  fragment InventoryDetailFields on ISPInventory {
    specifications
    notes
    warrantyExpirationDate
    purchaseDate
  }
`;

const INVENTORY_TIMESTAMP_FIELDS = gql`
  fragment InventoryTimestampFields on ISPInventory {
    createdAt
    updatedAt
  }
`;

const COMPLETE_INVENTORY_FIELDS = gql`
  fragment CompleteInventoryFields on ISPInventory {
    ...InventoryCoreFields
    ...InventoryRelatedFields
    ...InventoryDetailFields
    ...InventoryTimestampFields
  }
  ${INVENTORY_CORE_FIELDS}
  ${INVENTORY_RELATED_FIELDS}
  ${INVENTORY_DETAIL_FIELDS}
  ${INVENTORY_TIMESTAMP_FIELDS}
`;

export const GET_ISP_INVENTORIES = gql`
  query GetISPInventories(
    $organizationId: String!,
    $page: Int = 1,
    $pageSize: Int = 20,
    $sortBy: String = "createdAt",
    $sortDirection: String = "desc",
    $filterCategory: EquipmentCategory = null,
    $filterStatus: EquipmentStatus = null,
    $search: String = null
  ) {
    inventories(
      organizationId: $organizationId,
      page: $page,
      pageSize: $pageSize,
      sortBy: $sortBy,
      sortDirection: $sortDirection,
      filterCategory: $filterCategory,
      filterStatus: $filterStatus,
      search: $search
    ) {
      success
      message
      totalCount
      inventories {
        ...CompleteInventoryFields
      }
    }
  }
  ${COMPLETE_INVENTORY_FIELDS}
`;

export const GET_ISP_INVENTORY = gql`
  query GetISPInventory($id: String!) {
    inventory(id: $id) {
      success
      message
      inventory {
        ...CompleteInventoryFields
      }
    }
  }
  ${COMPLETE_INVENTORY_FIELDS}
`;

export const CREATE_ISP_INVENTORY = gql`
  mutation CreateISPInventory($input: CreateISPInventoryInput!) {
    createInventory(input: $input) {
      success
      message
      inventory {
        ...CompleteInventoryFields
      }
    }
  }
  ${COMPLETE_INVENTORY_FIELDS}
`;

export const UPDATE_ISP_INVENTORY = gql`
  mutation UpdateISPInventory($id: String!, $input: UpdateISPInventoryInput!) {
    updateInventory(id: $id, input: $input) {
      success
      message
      inventory {
        ...CompleteInventoryFields
      }
    }
  }
  ${COMPLETE_INVENTORY_FIELDS}
`;

export const DELETE_ISP_INVENTORY = gql`
  mutation DeleteISPInventory($id: String!) {
    deleteInventory(id: $id) {
      success
      message
      inventory {
        id
        name
      }
    }
  }
`;

// Types for better TypeScript integration
export interface ISPInventoryInput {
  name: string;
  category: string;
  organizationId: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  macAddress?: string;
  ipAddress?: string;
  quantity: number;
  quantityThreshold?: number;
  unitPrice: number;
  location?: string;
  specifications?: string;
  notes?: string;
  warrantyExpirationDate?: string;
  purchaseDate?: string;
}

export interface ISPInventoryUpdateInput {
  name?: string;
  category?: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  macAddress?: string;
  ipAddress?: string;
  quantity?: number;
  quantityThreshold?: number;
  unitPrice?: number;
  status?: string;
  location?: string;
  assignedTo?: string;
  specifications?: string;
  notes?: string;
  warrantyExpirationDate?: string;
  purchaseDate?: string;
}

export interface InventoryFilterOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filterCategory?: string;
  filterStatus?: string;
  search?: string;
}