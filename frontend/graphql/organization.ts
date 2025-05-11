import { Organization } from "@/types/organization";
import { gql } from "@apollo/client";

// Define the fragment first before using it
export const ORGANIZATION_FRAGMENT = gql`
  fragment OrganizationFields on Organization {
    id
    name
    description
    owner {
      id
      firstName
      lastName
    }
    members {
      user {
        id
        firstName
        lastName
        email
      }
      role {
        name
        permissions
      }
      status
      email
    }
    roles {
      name
      description
      permissions
      isSystemRole
    }
    status
    mpesaConfig {
      shortCode
      businessName
      accountReference
      isActive
      environment
      callbackUrl
      transactionType
      createdAt
      updatedAt
    }
    smsConfig {
      provider
      isActive
      apiKey
      apiSecret
      accountSid
      authToken
      username
      password
      partnerID
      senderId
      callbackUrl
      environment
      msgType
      createdAt
      updatedAt
    }
    createdAt
    updatedAt
  }
`;

export const GET_ORGANIZATIONS = gql`
  query GetOrganizations {
    organizations {
      success
      message
      organizations {
        id
        name
        description
        owner {
          id
          firstName
          lastName
          email
        }
        members {
          user {
            id
            firstName
            lastName
            email
          }
          email
          role {
            name
            description
            permissions
            isSystemRole
          }
          status
        }
        roles {
          name
          description
          permissions
          isSystemRole
        }
        mpesaConfig {
          shortCode
          businessName
          accountReference
          isActive
          consumerKey
          consumerSecret
          passKey
          environment
          callbackUrl
          stkPushCallbackUrl
          c2bCallbackUrl
          b2cResultUrl
          b2cTimeoutUrl
          transactionType
          stkPushShortCode
          stkPushPassKey
          createdAt
          updatedAt
        }
        status
        createdAt
        updatedAt
      }
    }
  }
`;
export const GET_ORGANIZATION = gql`
  query GetOrganization($id: String!) {
    organization(id: $id) {
      ...OrganizationFields
    }
  }
  ${ORGANIZATION_FRAGMENT}
`;
export const CREATE_ORGANIZATION = gql`
  mutation CreateOrganization($input: CreateOrganizationInput!) {
    createOrganization(input: $input) {
      success
      message
      organization {
        id
        name
        description
        owner {
          id
          firstName
          lastName
          email
        }
        members {
          user {
            id
            firstName
            lastName
            email
          }
          role {
            name
            description
            permissions
            isSystemRole
          }
          status
        }
        roles {
          name
          description
          permissions
          isSystemRole
        }
        status
        createdAt
        updatedAt
      }
    }
  }
`;
export const UPDATE_ORGANIZATION = gql`
  mutation UpdateOrganization($id: String!, $input: CreateOrganizationInput!) {
    updateOrganization(id: $id, input: $input) {
      success
      message
      organization {
        id
        name
        description
        owner {
          id
          firstName
          lastName
          email
        }
        members {
          user {
            id
            firstName
            lastName
            email
          }
          role {
            name
            description
            permissions
            isSystemRole
          }
          status
        }
        roles {
          name
          description
          permissions
          isSystemRole
        }
        status
        createdAt
        updatedAt
      }
    }
  }
`;
export const DELETE_ORGANIZATION = gql`
  mutation DeleteOrganization($id: String!) {
    deleteOrganization(id: $id) {
      success
      message
      organization {
        id
        name
        description
      }
    }
  }
`;
export const INVITE_MEMBER = gql`
  mutation InviteMember(
    $organizationId: String!
    $email: String!
    $roleName: String!
    $message: String
  ) {
    inviteMember(
      organizationId: $organizationId
      email: $email
      roleName: $roleName
      message: $message
    ) {
      success
      message
      organization {
        id
        members {
          user {
            id
            email
          }
          email
          role {
            name
          }
          status
        }
      }
    }
  }
`;
export const ACCEPT_INVITATION = gql`
  mutation AcceptInvitation($token: String!) {
    acceptInvitation(token: $token) {
      success
      message
      organization {
        id
        name
        members {
          user {
            id
            email
          }
          role {
            name
          }
          status
        }
      }
    }
  }
`;
export const CREATE_ROLE = gql`
  mutation CreateRole($organizationId: String!, $input: CreateRoleInput!) {
    createRole(organizationId: $organizationId, input: $input) {
      success
      message
      organization {
        id
        roles {
          name
          description
          permissions
          isSystemRole
        }
      }
    }
  }
`;
export const UPDATE_ROLE = gql`
  mutation UpdateRole(
    $organizationId: String!
    $roleName: String!
    $input: UpdateRoleInput!
  ) {
    updateRole(
      organizationId: $organizationId
      roleName: $roleName
      input: $input
    ) {
      success
      message
      organization {
        id
        roles {
          name
          description
          permissions
          isSystemRole
        }
      }
    }
  }
`;
export const DELETE_ROLE = gql`
  mutation DeleteRole($organizationId: String!, $roleName: String!) {
    deleteRole(organizationId: $organizationId, roleName: $roleName) {
      success
      message
      organization {
        id
        roles {
          name
          description
          permissions
          isSystemRole
        }
      }
    }
  }
`;

export const UPDATE_MEMBER = gql`
  mutation UpdateMember(
    $organizationId: String!
    $userId: String!
    $roleName: String!
  ) {
    updateMember(
      organizationId: $organizationId
      userId: $userId
      roleName: $roleName
    ) {
      success
      message
      organization {
        id
        members {
          user {
            id
            firstName
            lastName
            email
          }
          email
          role {
            name
          }
          status
        }
      }
    }
  }
`;

export const REMOVE_MEMBER = gql`
  mutation RemoveMember(
    $organizationId: String!
    $userId: String!
  ) {
    removeMember(
      organizationId: $organizationId
      userId: $userId
    ) {
      success
      message
      organization {
        id
        members {
          user {
            id
            email
          }
          role {
            name
          }
          status
        }
      }
    }
  }
`;

export const UPDATE_MPESA_CONFIGURATION = gql`
  mutation UpdateMpesaConfiguration(
    $organizationId: String!,
    $input: MpesaConfigurationInput!
  ) {
    updateMpesaConfiguration(
      organizationId: $organizationId,
      input: $input
    ) {
      success
      message
      organization {
        id
        mpesaConfig {
          shortCode
          businessName
          accountReference
          isActive
          consumerKey
          consumerSecret
          passKey
          environment
          callbackUrl
          stkPushCallbackUrl
          c2bCallbackUrl
          b2cResultUrl
          b2cTimeoutUrl
          transactionType
          stkPushShortCode
          stkPushPassKey
          createdAt
          updatedAt
        }
      }
    }
  }
`;

export const UPDATE_SMS_CONFIGURATION = gql`
  mutation UpdateSmsConfiguration(
    $organizationId: String!,
    $input: SmsConfigurationInput!
  ) {
    updateSmsConfiguration(
      organizationId: $organizationId,
      input: $input
    ) {
      success
      message
      organization {
        id
        smsConfig {
          provider
          isActive
          apiKey
          apiSecret
          accountSid
          authToken
          username
          password
          partnerID
          senderId
          callbackUrl
          environment
          msgType
          createdAt
          updatedAt
        }
      }
    }
  }
`;

export interface UpdateMemberResponse {
  updateMember: {
    success: boolean;
    message: string;
    organization: Organization;
  };
}

export interface RemoveMemberResponse {
  removeMember: {
    success: boolean;
    message: string;
    organization: Organization;
  };
}

export interface UpdateMpesaConfigurationVariables {
  organizationId: string;
  input: {
    shortCode: string;
    businessName: string;
    accountReference?: string;
    isActive: boolean;
    consumerKey?: string;
    consumerSecret?: string;
    passKey?: string;
    environment?: string;
    transactionType?: string;
    stkPushShortCode?: string;
    stkPushPassKey?: string;
  };
}

export interface UpdateMpesaConfigurationResponse {
  updateMpesaConfiguration: {
    success: boolean;
    message: string;
    organization: Organization;
  };
}

export interface UpdateSmsConfigurationVariables {
  organizationId: string;
  input: {
    provider: string;
    isActive: boolean;
    apiKey?: string;
    apiSecret?: string;
    accountSid?: string;
    authToken?: string;
    username?: string;
    partnerID?: string;
    senderId?: string;
    environment?: string;
    password?: string;
    msgType?: string;
  };
}

export interface UpdateSmsConfigurationResponse {
  updateSmsConfiguration: {
    success: boolean;
    message: string;
    organization: Organization;
  };
}
