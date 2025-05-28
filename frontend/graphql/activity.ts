import { gql } from "@apollo/client";

export const GET_ACTIVITIES = gql`
  query GetActivities($organizationId: String!, $limit: Int, $skip: Int) {
    activities(organizationId: $organizationId, limit: $limit, skip: $skip) {
      success
      message
      activities {
        id
        action
        userDetails {
          firstName
          lastName
          email
          role
        }
        organization {
          id
          name
        }
        createdAt
        updatedAt
      }
      totalCount
    }
  }
`;
export const GET_ACTIVITY = gql`
  query GetActivity($id: String!) {
    activity(id: $id) {
      success
      message
      activity {
        id
        action
        userDetails {
          firstName
          lastName
          email
          role
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
export const CREATE_ACTIVITY = gql`
  mutation CreateActivity($organizationId: String!, $action: String!) {
    createActivity(organizationId: $organizationId, action: $action) {
      success
      message
      activity {
        id
        action
        userDetails {
          firstName
          lastName
          email
          role
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
        userDetails {
          firstName
          lastName
          email
          role
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
export const CLEAR_OLD_ACTIVITIES = gql`
  mutation ClearOldActivities($days: Int) {
    clearOldActivities(days: $days) {
      success
      message
      activity {
        id
      }
    }
  }
`;
