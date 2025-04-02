import { gql } from '@apollo/client';

// Query to get a single subscription
export const GET_SUBSCRIPTION = gql`
  query GetSubscription($id: String!) {
    subscription(id: $id) {
      id
      organization {
        id
        name
      }
      plan {
        id
        name
        price
        currency
        features
      }
      status
      startDate
      endDate
      autoRenew
      createdAt
      updatedAt
    }
  }
`;

// Query to get all subscriptions
export const GET_SUBSCRIPTIONS = gql`
  query GetSubscriptions {
    subscriptions {
      success
      message
      subscriptions {
        id
        organization {
          id
          name
        }
        plan {
          id
          name
          price
          currency
          features
        }
        status
        startDate
        endDate
        autoRenew
        createdAt
        updatedAt
      }
    }
  }
`;

// Mutation to create a subscription
export const CREATE_SUBSCRIPTION = gql`
  mutation CreateSubscription($input: CreateSubscriptionInput!) {
    createSubscription(input: $input) {
      success
      message
      subscription {
        id
        organization {
          id
          name
        }
        plan {
          id
          name
        }
        status
        startDate
        endDate
        autoRenew
        createdAt
        updatedAt
      }
    }
  }
`;

// Mutation to update a subscription
export const UPDATE_SUBSCRIPTION = gql`
  mutation UpdateSubscription($id: String!, $input: UpdateSubscriptionInput!) {
    updateSubscription(id: $id, input: $input) {
      success
      message
      subscription {
        id
        status
        startDate
        endDate
        autoRenew
        updatedAt
      }
    }
  }
`;

// Mutation to cancel a subscription
export const CANCEL_SUBSCRIPTION = gql`
  mutation CancelSubscription($id: String!) {
    cancelSubscription(id: $id) {
      success
      message
      subscription {
        id
        status
        updatedAt
      }
    }
  }
`;

// TypeScript types based on the backend schema
export type Subscription = {
  id: string;
  organization: {
    id: string;
    name: string;
  };
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    features: string[];
  };
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PENDING' | 'SUSPENDED';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionResponse = {
  success: boolean;
  message: string;
  subscription: Subscription;
};

export type SubscriptionsResponse = {
  success: boolean;
  message: string;
  subscriptions: Subscription[];
};

export type CreateSubscriptionInput = {
  organizationId: string;
  planId: string;
  startDate: string;
  endDate: string;
  autoRenew?: boolean;
};

export type UpdateSubscriptionInput = {
  status?: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PENDING' | 'SUSPENDED';
  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
};