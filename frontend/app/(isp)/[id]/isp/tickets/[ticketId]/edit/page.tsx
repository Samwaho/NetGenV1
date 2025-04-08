"use client";

import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import { TicketForm } from "../../components/TicketForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const GET_TICKET = gql`
  query GetTicket($id: String!) {
    ticket(id: $id) {
      id
      title
      description
      priority
      category
      customerId
      assignedTo {
        id
      }
      dueDate
    }
  }
`;

const UPDATE_TICKET = gql`
  mutation UpdateTicket($input: UpdateISPTicketInput!) {
    updateTicket(input: $input) {
      success
      message
      ticket {
        id
      }
    }
  }
`;

const GET_CUSTOMERS = gql`
  query GetCustomers($organizationId: String!) {
    customers(organizationId: $organizationId) {
      customers {
        id
        firstName
        lastName
      }
    }
  }
`;

const GET_USERS = gql`
  query GetOrganizationUsers($organizationId: String!) {
    organization(id: $organizationId) {
      members {
        user {
          id
          firstName
          lastName
        }
      }
    }
  }
`;

export default function EditTicketPage() {
  const router = useRouter();
  const params = useParams();
  const organizationId = params.id as string;
  const ticketId = params.ticketId as string;

  const { data: ticketData, loading: ticketLoading } = useQuery(GET_TICKET, {
    variables: { id: ticketId },
  });

  const { data: customersData } = useQuery(GET_CUSTOMERS, {
    variables: { organizationId },
  });

  const { data: usersData } = useQuery(GET_USERS, {
    variables: { organizationId },
  });

  const [updateTicket, { loading }] = useMutation(UPDATE_TICKET, {
    onCompleted: (data) => {
      if (data.updateTicket.success) {
        toast.success("Ticket updated successfully");
        router.push(`/${organizationId}/isp/tickets/${ticketId}`);
      } else {
        toast.error(data.updateTicket.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = async (data: any) => {
    await updateTicket({
      variables: {
        input: {
          id: ticketId,
          ...data,
        },
      },
    });
  };

  const customers = customersData?.customers?.customers || [];
  const users = usersData?.organization?.members
    .map((member: any) => member.user)
    .filter(Boolean) || [];

  if (ticketLoading) {
    return <div>Loading...</div>;
  }

  const initialData = {
    ...ticketData?.ticket,
    assignedTo: ticketData?.ticket?.assignedTo?.id,
    dueDate: ticketData?.ticket?.dueDate ? new Date(ticketData.ticket.dueDate) : undefined,
  };

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Edit Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketForm
            initialData={initialData}
            onSubmit={handleSubmit}
            customers={customers}
            users={users}
            isLoading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}