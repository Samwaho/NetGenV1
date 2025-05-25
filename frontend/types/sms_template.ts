export enum TemplateCategory {
  CUSTOMER_ONBOARDING = 'customer_onboarding',
  INVOICE_PAYMENT = 'invoice_payment',
  PAYMENT_REMINDER = 'payment_reminder',
  PAYMENT_CONFIRMATION = 'payment_confirmation',
  SERVICE_OUTAGE = 'service_outage',
  PLAN_UPGRADE = 'plan_upgrade',
  TECHNICAL_SUPPORT = 'technical_support',
  GENERAL_NOTIFICATION = 'general_notification',
  MARKETING = 'marketing',
  CUSTOM = 'custom'
}

export interface SmsTemplate {
  id: string;
  organizationId: string;
  name: string;
  content: string;
  category: TemplateCategory;
  description?: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface SmsTemplateInput {
  name: string;
  content: string;
  category: TemplateCategory;
  description?: string;
  variables: string[];
  isActive: boolean;
}

export interface SmsTemplateResponse {
  success: boolean;
  message: string;
  template?: SmsTemplate;
}

export interface SmsTemplatesResponse {
  success: boolean;
  message: string;
  templates: SmsTemplate[];
}

// Response types for GraphQL queries
export interface GetSmsTemplatesResponse {
  listSmsTemplates: SmsTemplatesResponse;
}

export interface GetSmsTemplateResponse {
  getSmsTemplate: SmsTemplateResponse;
}

export interface CreateSmsTemplateResponse {
  createSmsTemplate: SmsTemplateResponse;
}

export interface UpdateSmsTemplateResponse {
  updateSmsTemplate: SmsTemplateResponse;
}

export interface DeleteSmsTemplateResponse {
  deleteSmsTemplate: {
    success: boolean;
    message: string;
  };
}
