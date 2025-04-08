export type ISPTicket = {
  id: string;
  title: string;
  description: string;
  organization: {
    id: string;
    name: string;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string;
  category: string;
  dueDate?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
};

export interface ISPTicketsResponse {
  tickets: {
    success: boolean;
    message: string;
    tickets: ISPTicket[];
  };
}

export interface ISPTicketResponse {
  ticket: {
    success: boolean;
    message: string;
    ticket: ISPTicket;
  };
}

export interface CreateISPTicketInput {
  title: string;
  description: string;
  organizationId: string;
  customerId?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category: string;
  dueDate?: string;
  assignedTo?: string;
}

export interface UpdateISPTicketInput {
  id: string;
  title?: string;
  description?: string;
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category?: string;
  dueDate?: string;
  assignedTo?: string;
  resolution?: string;
}
