import { gql } from "@apollo/client";

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
      id
      name
      description
      status
      createdAt
      updatedAt
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
    }
  }
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
