import { Plan } from './plan';
import { Organization } from './organization';

export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PENDING' | 'SUSPENDED';

export interface Subscription {
  id: string;
  organization: Organization;
  plan: Plan;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionsResponse {
  subscriptions: {
    success: boolean;
    message: string;
    subscriptions: Subscription[];
  };
}

export interface SubscriptionResponse {
  subscription: {
    success: boolean;
    message: string;
    subscription: Subscription;
  };
}
