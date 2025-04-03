import { gql } from "@apollo/client";

export const GET_ACTIVITIES = gql`
  query GetActivities($organizationId: String!) {
    activities(organizationId: $organizationId) {
      success
      message
      activities {
        id
        action
        user {
          id
          firstName
          lastName
          email
        }
        organization {
          id
          name
        }
        createdAt
        updatedAt
      }
    }
  }
`;
export const GET_ACTIVITY = gql`
  query GetActivity($id: String!) {
    activity(id: $id) {
      id
      action
      user {
        id
        firstName
        lastName
        email
      }
      organization {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
`;
export const CREATE_ACTIVITY = gql`
  mutation CreateActivity($organizationId: String!, $action: String!) {
    createActivity(organizationId: $organizationId, action: $action) {
      success
      message
      activity {
        id
        action
        user {
          id
          firstName
          lastName
          email
        }
        organization {
          id
          name
        }
        createdAt
        updatedAt
      }
    }
  }
`;
export const DELETE_ACTIVITY = gql`
  mutation DeleteActivity($id: String!) {
    deleteActivity(id: $id) {
      success
      message
      activity {
        id
        action
        user {
          id
          firstName
          lastName
          email
        }
        organization {
          id
          name
        }
        createdAt
        updatedAt
      }
    }
  }
`;
