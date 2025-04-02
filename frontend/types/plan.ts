export interface Plan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlansResponse {
  plans: {
    success: boolean;
    message: string;
    plans: Plan[];
  };
}

export interface PlanResponse {
  plan: {
    success: boolean;
    message: string;
    plan: Plan;
  };
}