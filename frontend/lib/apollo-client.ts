import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { getAuthToken } from "./auth-utils";

// Determine GraphQL URL based on environment
const getGraphQLUrl = () => {
  // If environment variable is set, use it
  if (process.env.NEXT_PUBLIC_GRAPHQL_URL) {
    return process.env.NEXT_PUBLIC_GRAPHQL_URL;
  }
  
  // In production, use the same domain
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `${window.location.protocol}//${window.location.host}/graphql`;
  }
  
  // Default to localhost for development
  return 'http://localhost:8000/graphql';
};

const httpLink = createHttpLink({
  uri: getGraphQLUrl(),
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
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          dashboardStats: {
            keyArgs: ["organizationId"],
            merge(existing, incoming) {
              // If there's no incoming data, return existing
              if (!incoming) return existing;
              // If there's no existing data, return incoming
              if (!existing) return incoming;
              
              // Merge the data, preferring incoming for updated fields
              return {
                ...existing,
                ...incoming,
                // For arrays, always use the incoming data (complete replacement)
                customers: incoming.customers,
                tickets: incoming.tickets,
                inventories: incoming.inventories,
                packages: incoming.packages,
                transactions: incoming.transactions,
              };
            },
          },
          // Other field policies remain the same
        },
      },
    },
  }),
  defaultOptions: {
    query: {
      fetchPolicy: "cache-first",
    },
    watchQuery: {
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
    },
  },
});
