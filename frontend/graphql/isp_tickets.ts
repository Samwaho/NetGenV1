import { gql } from "@apollo/client";

export const GET_ISP_TICKETS = gql`
  query GetISPTickets($organizationId: String!) {
    tickets(organizationId: $organizationId) {
      success
      message
      tickets {
        id
        title
        description
        status
        priority
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
        category
        dueDate
        resolution
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

export const GET_ISP_TICKET = gql`
  query GetISPTicket($id: String!) {
    ticket(id: $id) {
      id
      title
      description
      status
      priority
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
      category
      dueDate
      resolution
      organization {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_ISP_TICKET = gql`
  mutation CreateISPTicket($input: CreateTicketInput!) {
    createTicket(input: $input) {
      success
      message
      ticket {
        id
        title
        description
        status
        priority
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
        station {
          id
          name
          location
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

export const UPDATE_ISP_TICKET = gql`
  mutation UpdateISPTicket($input: UpdateISPTicketInput!) {
    updateTicket(input: $input) {
      success
      message
      ticket {
        id
        title
        description
        status
        priority
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
        category
        dueDate
        resolution
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

export const DELETE_ISP_TICKET = gql`
  mutation DeleteISPTicket($id: String!) {
    deleteTicket(id: $id)
  }
`;

export const UPDATE_TICKET_STATUS = gql`
  mutation UpdateTicketStatus($ticketId: String!, $status: String!) {
    updateTicketStatus(ticketId: $ticketId, status: $status) {
      success
      message
      ticket {
        id
        status
        updatedAt
      }
    }
  }
`;

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";  // Remove readonly
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
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
}

export interface CreateTicketInput {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  customerId: string;
  assignedToId?: string;
  stationId?: string;
  organizationId: string;
}

export interface UpdateTicketInput {
  id: string;
  title?: string;
  description?: string;
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  category?: string;
  dueDate?: string;
  assignedTo?: string;
  resolution?: string;
}
