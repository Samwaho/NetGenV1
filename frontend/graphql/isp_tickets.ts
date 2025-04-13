import { gql } from "@apollo/client";

// Common fragments for reuse
const TICKET_CORE_FIELDS = gql`
  fragment TicketCoreFields on ISPTicket {
    id
    title
    description
    status
    priority
    category
    dueDate
    resolution
  }
`;

const TICKET_RELATED_FIELDS = gql`
  fragment TicketRelatedFields on ISPTicket {
    organization {
      id
      name
    }
    customer {
      id
      firstName
      lastName
      email
    }
    assignedTo {
      id
      firstName
      lastName
      email
    }
  }
`;

const TICKET_TIMESTAMP_FIELDS = gql`
  fragment TicketTimestampFields on ISPTicket {
    createdAt
    updatedAt
  }
`;

const COMPLETE_TICKET_FIELDS = gql`
  fragment CompleteTicketFields on ISPTicket {
    ...TicketCoreFields
    ...TicketRelatedFields
    ...TicketTimestampFields
  }
  ${TICKET_CORE_FIELDS}
  ${TICKET_RELATED_FIELDS}
  ${TICKET_TIMESTAMP_FIELDS}
`;

export const GET_ISP_TICKETS = gql`
  query GetISPTickets(
    $organizationId: String!,
    $page: Int = 1,
    $pageSize: Int = 20,
    $sortBy: String = "createdAt",
    $sortDirection: String = "desc",
    $status: String = null,
    $category: String = null,
    $search: String = null
  ) {
    tickets(
      organizationId: $organizationId,
      page: $page,
      pageSize: $pageSize,
      sortBy: $sortBy,
      sortDirection: $sortDirection,
      status: $status,
      category: $category,
      search: $search
    ) {
      success
      message
      totalCount
      tickets {
        ...CompleteTicketFields
      }
    }
  }
  ${COMPLETE_TICKET_FIELDS}
`;

export const GET_ISP_TICKET = gql`
  query GetISPTicket($id: String!) {
    ticket(id: $id) {
      ...CompleteTicketFields
    }
  }
  ${COMPLETE_TICKET_FIELDS}
`;

export const CREATE_ISP_TICKET = gql`
  mutation CreateISPTicket($input: CreateISPTicketInput!) {
    createTicket(input: $input) {
      success
      message
      ticket {
        ...CompleteTicketFields
      }
    }
  }
  ${COMPLETE_TICKET_FIELDS}
`;

export const UPDATE_ISP_TICKET = gql`
  mutation UpdateISPTicket($input: UpdateISPTicketInput!) {
    updateTicket(input: $input) {
      success
      message
      ticket {
        ...CompleteTicketFields
      }
    }
  }
  ${COMPLETE_TICKET_FIELDS}
`;

export const DELETE_ISP_TICKET = gql`
  mutation DeleteISPTicket($id: String!) {
    deleteTicket(id: $id)
  }
`;

export const UPDATE_TICKET_STATUS = gql`
  mutation UpdateTicketStatus($ticketId: String!, $status: TicketStatus!) {
    updateTicketStatus(ticketId: $ticketId, status: $status) {
      success
      message
      ticket {
        ...CompleteTicketFields
      }
    }
  }
  ${COMPLETE_TICKET_FIELDS}
`;

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  category: string;
  dueDate?: string;
  resolution?: string;
  organization: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TicketResponse {
  success: boolean;
  message: string;
  ticket: Ticket;
}

export interface TicketsResponse {
  success: boolean;
  message: string;
  tickets: Ticket[];
  totalCount: number;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  priority: TicketPriority;
  customerId?: string;
  organizationId: string;
  category: string;
  dueDate?: string;
  assignedTo?: string;
}

export interface UpdateTicketInput {
  id: string;
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: string;
  dueDate?: string;
  assignedTo?: string;
  resolution?: string;
}

export interface TicketFilterOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  status?: string;
  category?: string;
  search?: string;
}
