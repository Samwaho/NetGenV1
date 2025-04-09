import { gql } from "@apollo/client";

// Create a reusable fragment for ISP package fields
const ISP_PACKAGE_FRAGMENT = gql`
  fragment PackageFields on ISPPackage {
    id
    name
    description
    price
    organization {
      id
      name
    }
    downloadSpeed
    uploadSpeed
    burstDownload
    burstUpload
    thresholdDownload
    thresholdUpload
    burstTime
    serviceType
    addressPool
    createdAt
    updatedAt
  }
`;

// Query to get packages with pagination, sorting, and filtering options
export const GET_ISP_PACKAGES = gql`
  query GetISPPackages(
    $organizationId: String!,
    $page: Int = 1,
    $pageSize: Int = 20,
    $sortBy: String = "createdAt",
    $sortDirection: String = "desc",
    $search: String = null
  ) {
    packages(
      organizationId: $organizationId, 
      page: $page, 
      pageSize: $pageSize, 
      sortBy: $sortBy, 
      sortDirection: $sortDirection,
      search: $search
    ) {
      success
      message
      packages {
        ...PackageFields
      }
      totalCount
    }
  }
  ${ISP_PACKAGE_FRAGMENT}
`;

// Query to get a single package by ID
export const GET_ISP_PACKAGE = gql`
  query GetISPPackage($id: String!) {
    package(id: $id) {
      success
      message
      package {
        ...PackageFields
      }
    }
  }
  ${ISP_PACKAGE_FRAGMENT}
`;

// Mutation to create a new package
export const CREATE_ISP_PACKAGE = gql`
  mutation CreateISPPackage($input: CreateISPPackageInput!) {
    createPackage(input: $input) {
      success
      message
      package {
        ...PackageFields
      }
    }
  }
  ${ISP_PACKAGE_FRAGMENT}
`;

// Mutation to update an existing package
export const UPDATE_ISP_PACKAGE = gql`
  mutation UpdateISPPackage($id: String!, $input: UpdateISPPackageInput!) {
    updatePackage(id: $id, input: $input) {
      success
      message
      package {
        ...PackageFields
      }
    }
  }
  ${ISP_PACKAGE_FRAGMENT}
`;

// Mutation to delete a package
export const DELETE_ISP_PACKAGE = gql`
  mutation DeleteISPPackage($id: String!) {
    deletePackage(id: $id) {
      success
      message
      package {
        id
        name
      }
    }
  }
`;

// Type definitions for filter options
export interface PackageFilterOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  search?: string;
}
