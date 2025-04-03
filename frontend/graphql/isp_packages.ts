import { gql } from "@apollo/client";
export const GET_ISP_PACKAGES = gql`
  query GetISPPackages($organizationId: String!) {
    packages(organizationId: $organizationId) {
      success
      message
      packages {
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
    }
  }
`;
export const GET_ISP_PACKAGE = gql`
  query GetISPPackage($id: String!) {
    package(id: $id) {
      success
      message
      package {
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
    }
  }
`;
export const CREATE_ISP_PACKAGE = gql`
  mutation CreateISPPackage($input: CreateISPPackageInput!) {
    createPackage(input: $input) {
      success
      message
      package {
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
    }
  }
`;
export const UPDATE_ISP_PACKAGE = gql`
  mutation UpdateISPPackage($id: String!, $input: UpdateISPPackageInput!) {
    updatePackage(id: $id, input: $input) {
      success
      message
      package {
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
        updatedAt
      }
    }
  }
`;
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
