import { useQuery } from "@apollo/client";
import { CURRENT_USER } from "@/graphql/auth";

export function useUser() {
  const { data, loading, error } = useQuery(CURRENT_USER);

  return {
    user: data?.currentUser,
    loading,
    error
  };
}
