import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { getAuthToken } from "./auth-utils";

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
  credentials: "include",
});

const authLink = setContext((operation, { headers }) => {
  const token = getAuthToken();

  const updatedHeaders = {
    ...headers,
    "Content-Type": "application/json",
  };

  if (token) {
    updatedHeaders.authorization = token;
  }

  return {
    headers: updatedHeaders,
  };
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    query: {
      fetchPolicy: "network-only",
    },
    watchQuery: {
      fetchPolicy: "network-only",
      nextFetchPolicy: "cache-and-network",
    },
  },
});
