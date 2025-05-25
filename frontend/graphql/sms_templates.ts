import { gql } from '@apollo/client';
import type {
  SmsTemplate,
  SmsTemplateInput,
  SmsTemplateResponse,
  SmsTemplatesResponse,
  TemplateCategory,
  GetSmsTemplatesResponse,
  GetSmsTemplateResponse,
  CreateSmsTemplateResponse,
  UpdateSmsTemplateResponse,
  DeleteSmsTemplateResponse
} from '@/types/sms_template';

// Common fragment for template fields
const TEMPLATE_FIELDS = gql`
  fragment TemplateFields on SmsTemplate {
    id
    organizationId
    name
    content
    category
    description
    variables
    isActive
    createdAt
    updatedAt
    createdBy
  }
`;

// Query to get all templates for an organization
export const GET_SMS_TEMPLATES = gql`
  query GetSmsTemplates(
    $organizationId: String!,
    $category: TemplateCategory,
    $isActive: Boolean
  ) {
    listSmsTemplates(
      organizationId: $organizationId,
      category: $category,
      isActive: $isActive
    ) {
      success
      message
      templates {
        ...TemplateFields
      }
    }
  }
  ${TEMPLATE_FIELDS}
`;

// Query to get a specific template
export const GET_SMS_TEMPLATE = gql`
  query GetSmsTemplate($templateId: String!, $organizationId: String!) {
    getSmsTemplate(templateId: $templateId, organizationId: $organizationId) {
      success
      message
      template {
        ...TemplateFields
      }
    }
  }
  ${TEMPLATE_FIELDS}
`;

// Mutation to create a new template
export const CREATE_SMS_TEMPLATE = gql`
  mutation CreateSmsTemplate($organizationId: String!, $input: SmsTemplateInput!) {
    createSmsTemplate(organizationId: $organizationId, input: $input) {
      success
      message
      template {
        ...TemplateFields
      }
    }
  }
  ${TEMPLATE_FIELDS}
`;

// Mutation to update an existing template
export const UPDATE_SMS_TEMPLATE = gql`
  mutation UpdateSmsTemplate(
    $templateId: String!,
    $organizationId: String!,
    $input: SmsTemplateInput!
  ) {
    updateSmsTemplate(
      templateId: $templateId,
      organizationId: $organizationId,
      input: $input
    ) {
      success
      message
      template {
        ...TemplateFields
      }
    }
  }
  ${TEMPLATE_FIELDS}
`;

// Mutation to delete a template
export const DELETE_SMS_TEMPLATE = gql`
  mutation DeleteSmsTemplate($templateId: String!, $organizationId: String!) {
    deleteSmsTemplate(templateId: $templateId, organizationId: $organizationId) {
      success
      message
    }
  }
`;

export type {
  SmsTemplate,
  SmsTemplateInput,
  SmsTemplateResponse,
  SmsTemplatesResponse,
  GetSmsTemplatesResponse,
  GetSmsTemplateResponse,
  CreateSmsTemplateResponse,
  UpdateSmsTemplateResponse,
  DeleteSmsTemplateResponse
};

export { TemplateCategory };