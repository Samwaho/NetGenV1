import { useQuery } from "@apollo/client";
import { GET_ORGANIZATION } from "@/graphql/organization";

export function useOrganization(organizationId: string) {
  const { data, loading, error } = useQuery(GET_ORGANIZATION, {
    variables: { id: organizationId },
    skip: !organizationId
  });

  return {
    organization: data?.organization,
    loading,
    error
  };
}