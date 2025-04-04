import { gql } from "@apollo/client";

export const GET_ISP_CUSTOMERS = gql`
  query GetISPCustomers($organizationId: String!) {
    customers(organizationId: $organizationId) {
      success
      message
      customers {
        id
        firstName
        lastName
        email
        phone
        username
        organization {
          id
          name
        }
        package {
          id
          name
        }
        station {
          id
          name
        }
        expirationDate
        status
        online
        createdAt
        updatedAt
      }
    }
  }
`;

export const GET_ISP_CUSTOMER = gql`
  query GetISPCustomer($id: String!) {
    customer(id: $id) {
      id
      firstName
      lastName
      email
      phone
      username
      organization {
        id
        name
      }
      package {
        id
        name
      }
      station {
        id
        name
      }
      expirationDate
      status
      online
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_ISP_CUSTOMER = gql`
  mutation CreateISPCustomer($input: CreateISPCustomerInput!) {
    createCustomer(input: $input) {
      success
      message
      customer {
        id
        firstName
        lastName
        email
        phone
        username
        organization {
          id
          name
        }
        package {
          id
          name
        }
        station {
          id
          name
        }
        expirationDate
        status
        online
        createdAt
        updatedAt
      }
    }
  }
`;

export const UPDATE_ISP_CUSTOMER = gql`
  mutation UpdateISPCustomer($id: String!, $input: UpdateISPCustomerInput!) {
    updateCustomer(id: $id, input: $input) {
      success
      message
      customer {
        id
        firstName
        lastName
        email
        phone
        username
        organization {
          id
          name
        }
        package {
          id
          name
        }
        station {
          id
          name
        }
        expirationDate
        status
        online
        createdAt
        updatedAt
      }
    }
  }
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
