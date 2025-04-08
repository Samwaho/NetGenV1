"use client";

import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import { TicketForm } from "../components/TicketForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const CREATE_TICKET = gql`
  mutation CreateTicket($input: CreateISPTicketInput!) {
    createTicket(input: $input) {
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

export default function NewTicketPage() {
  const router = useRouter();
  const params = useParams();
  const organizationId = params.id as string;

  const { data: customersData } = useQuery(GET_CUSTOMERS, {
    variables: { organizationId },
  });

  const { data: usersData } = useQuery(GET_USERS, {
    variables: { organizationId },
  });

  const [createTicket, { loading }] = useMutation(CREATE_TICKET, {
    onCompleted: (data) => {
      if (data.createTicket.success) {
        toast.success("Ticket created successfully");
        router.push(`/${organizationId}/isp/tickets`);
      } else {
        toast.error(data.createTicket.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = async (data: any) => {
    await createTicket({
      variables: {
        input: {
          ...data,
          organizationId,
        },
      },
    });
  };

  const customers = customersData?.customers?.customers || [];
  const users = usersData?.organization?.members
    .map((member: any) => member.user)
    .filter(Boolean) || [];

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create New Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketForm
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